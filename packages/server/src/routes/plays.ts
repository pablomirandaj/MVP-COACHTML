import { playTracks, type Command } from "@fcs/engine";
import { renderTracksHtml } from "@fcs/render";
import type { FastifyInstance } from "fastify";
import { requireStaff, requireUser, teamOf } from "../app";
import { many, one, tx, type Tx } from "../db";
import { applyEdits, currentDoc, insertVersion, logCommands, planCorner } from "../plays";
import { teamContext } from "../repo";
import { HttpError, uuidv7 } from "../util";

const commandsSchema = { type: "array", minItems: 1, maxItems: 40, items: { type: "object", required: ["op"] } };

async function playView(c: Tx, playId: string) {
  const p = await one<{ id: string; name: string; type: string; current_version: number; state: string; team_id: string }>(c,
    "SELECT id, name, type, current_version, state, team_id FROM tactical_play WHERE id = $1", [playId]);
  const cur = await currentDoc(c, playId);
  const undoable = await undoCandidate(c, playId);
  const redoable = await redoCandidate(c, playId);
  return { ...p, match_id: cur.match_id, document: cur.doc, diagnostics: cur.doc.diagnostics, can_undo: !!undoable, can_redo: !!redoable };
}

export async function playRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.get<{ Params: { id: string }; Querystring: { match_id?: string } }>("/teams/:id/plays", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    return many(db, `SELECT p.id, p.name, p.type, p.current_version, p.state, p.updated_at,
        (SELECT match_id FROM match_play mp WHERE mp.play_id = p.id LIMIT 1) AS match_id
      FROM tactical_play p WHERE p.team_id = $1 AND p.deleted_at IS NULL
        AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM match_play mp WHERE mp.play_id = p.id AND mp.match_id = $2::uuid))
      ORDER BY p.updated_at DESC`, [req.params.id, req.query.match_id ?? null]);
  });

  // Crear una jugada a partir de comandos IR (asistente de formulario o chat). Si el motor pregunta, no se guarda.
  app.post<{ Params: { id: string }; Body: { name?: string; match_id?: string; commands: Command[]; source?: string } }>("/teams/:id/plays", {
    schema: { body: { type: "object", required: ["commands"], properties: { name: { type: "string", maxLength: 120 }, match_id: { type: "string", format: "uuid" }, commands: commandsSchema, source: { enum: ["MANUAL", "ASSISTANT", "CLARIFICATION"] } } } },
  }, async (req, reply) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await requireStaff(c, u.id, req.params.id);
      if (req.body.match_id) {
        const m = await one<{ team_id: string }>(c, "SELECT team_id FROM match WHERE id = $1", [req.body.match_id]);
        if (m?.team_id !== req.params.id) throw new HttpError(422, "VALIDATION_ERROR", "El partido no es de este equipo.");
      }
      const ctx = await teamContext(c, req.params.id, req.body.match_id);
      const out = planCorner(req.body.commands, ctx);
      if (!out.doc || out.clarifications.length) return reply.status(200).send({ created: false, clarifications: out.clarifications, diagnostics: out.diagnostics });
      const id = uuidv7();
      const create = req.body.commands.find((x) => x.op === "play.create")!;
      const name = req.body.name?.trim() || `Córner ${create.side === "LEFT" ? "izquierda" : "derecha"} · ${out.doc.delivery.swing === "INSWING" ? "cerrado" : "abierto"}`;
      await c.query("INSERT INTO tactical_play(id, team_id, type, name, created_by) VALUES ($1,$2,$3,$4,$5)", [id, req.params.id, "CORNER_ATT", name, u.id]);
      if (req.body.match_id) await c.query("INSERT INTO match_play(match_id, play_id) VALUES ($1,$2)", [req.body.match_id, id]);
      await insertVersion(c, id, 1, null, out.doc, u.id);
      await logCommands(c, req.params.id, id, null, 1, u.id, req.body.commands, req.body.source ?? "MANUAL");
      return reply.status(201).send({ created: true, clarifications: [], play: await playView(c, id) });
    });
  });

  app.get<{ Params: { id: string } }>("/plays/:id", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => { await teamOf(c, u.id, "tactical_play", req.params.id); return playView(c, req.params.id); });
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/plays/:id", {
    schema: { body: { type: "object", additionalProperties: false, properties: { name: { type: "string", minLength: 1, maxLength: 120 } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await teamOf(c, u.id, "tactical_play", req.params.id);
      if (req.body.name) await c.query("UPDATE tactical_play SET name = $2, updated_at = now() WHERE id = $1", [req.params.id, req.body.name.trim()]);
      return playView(c, req.params.id);
    });
  });

  app.delete<{ Params: { id: string } }>("/plays/:id", async (req, reply) => {
    const u = requireUser(req);
    await tx(db, u.id, async (c) => {
      await teamOf(c, u.id, "tactical_play", req.params.id);
      await c.query("UPDATE tactical_play SET deleted_at = now() WHERE id = $1", [req.params.id]);
    });
    return reply.status(204).send();
  });

  // Edición incremental: cada llamada es una transacción (un mensaje o una acción) y crea una versión nueva.
  app.post<{ Params: { id: string }; Body: { commands: Command[]; base_version: number; source?: string } }>("/plays/:id/commands", {
    schema: { body: { type: "object", required: ["commands", "base_version"], properties: { commands: commandsSchema, base_version: { type: "integer" }, source: { enum: ["MANUAL", "ASSISTANT", "CLARIFICATION"] } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "tactical_play", req.params.id);
      const cur = await currentDoc(c, req.params.id);
      if (cur.version !== req.body.base_version) throw new HttpError(409, "STALE_REVISION", "La jugada ha cambiado; recarga.", { current_version: cur.version });
      const ctx = await teamContext(c, teamId, cur.match_id);
      const out = applyEdits(cur.doc, req.body.commands, ctx);
      if (out.clarifications.length) return { applied: false, clarifications: out.clarifications, play: await playView(c, req.params.id) };
      if (JSON.stringify(out.doc) === JSON.stringify(cur.doc)) return { applied: false, clarifications: [], play: await playView(c, req.params.id) };
      // Las acciones nuevas invalidan el "rehacer" pendiente.
      await c.query("UPDATE parsed_command SET status = 'REJECTED' WHERE target_id = $1 AND status = 'UNDONE'", [req.params.id]);
      await insertVersion(c, req.params.id, cur.version + 1, cur.version, out.doc!, u.id);
      await logCommands(c, teamId, req.params.id, cur.version, cur.version + 1, u.id, req.body.commands, req.body.source ?? "MANUAL");
      return { applied: true, clarifications: [], play: await playView(c, req.params.id) };
    });
  });

  // Deshacer: restaura el documento anterior al último cambio como versión nueva (el historial no se reescribe).
  app.post<{ Params: { id: string } }>("/plays/:id/undo", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await teamOf(c, u.id, "tactical_play", req.params.id);
      const cur = await currentDoc(c, req.params.id);
      const cmd = await undoCandidate(c, req.params.id);
      if (!cmd) throw new HttpError(409, "NOTHING_TO_UNDO", "No hay nada que deshacer.");
      const prev = await one<{ document: any }>(c, "SELECT document FROM tactical_play_version WHERE play_id = $1 AND version = $2", [req.params.id, cmd.version_from]);
      await insertVersion(c, req.params.id, cur.version + 1, cmd.version_from, prev!.document, u.id);
      await c.query("UPDATE parsed_command SET status = 'UNDONE' WHERE id = $1", [cmd.id]);
      return playView(c, req.params.id);
    });
  });

  // Rehacer: vuelve a aplicar los comandos deshechos (el motor es determinista: mismo resultado).
  app.post<{ Params: { id: string } }>("/plays/:id/redo", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "tactical_play", req.params.id);
      const cur = await currentDoc(c, req.params.id);
      const cmd = await redoCandidate(c, req.params.id);
      if (!cmd) throw new HttpError(409, "NOTHING_TO_REDO", "No hay nada que rehacer.");
      const out = applyEdits(cur.doc, cmd.ir.commands, await teamContext(c, teamId, cur.match_id));
      await insertVersion(c, req.params.id, cur.version + 1, cur.version, out.doc!, u.id);
      await c.query("UPDATE parsed_command SET status = 'APPLIED', version_to = $2 WHERE id = $1", [cmd.id, cur.version + 1]);
      return playView(c, req.params.id);
    });
  });

  app.get<{ Params: { id: string } }>("/plays/:id/export.html", async (req, reply) => {
    const u = requireUser(req);
    const { html, name } = await tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "tactical_play", req.params.id);
      const v = await playView(c, req.params.id);
      const ctx = await teamContext(c, teamId);
      return { html: renderTracksHtml(playTracks(v.document, ctx.roster, v.name ?? "Jugada")), name: v.name ?? "jugada" };
    });
    return reply.type("text/html; charset=utf-8").header("content-disposition", `attachment; filename="${slug(name)}.html"`).send(html);
  });
}

export const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "jugada";

/** Último comando aplicado cuyo resultado es el documento actual (por hash): permite deshacer varios niveles. */
async function undoCandidate(c: Tx, playId: string) {
  return one<{ id: string; version_from: number }>(c, `
    SELECT pc.id, pc.version_from FROM parsed_command pc
    JOIN tactical_play p ON p.id = pc.target_id
    JOIN tactical_play_version cur ON cur.play_id = p.id AND cur.version = p.current_version
    JOIN tactical_play_version res ON res.play_id = p.id AND res.version = pc.version_to
    WHERE pc.target_id = $1 AND pc.status = 'APPLIED' AND pc.version_from IS NOT NULL AND res.document_hash = cur.document_hash
    ORDER BY pc.created_at DESC LIMIT 1`, [playId]);
}
/** Último comando deshecho que parte del documento actual (por hash). */
async function redoCandidate(c: Tx, playId: string) {
  return one<{ id: string; ir: { commands: Command[] } }>(c, `
    SELECT pc.id, pc.ir FROM parsed_command pc
    JOIN tactical_play p ON p.id = pc.target_id
    JOIN tactical_play_version cur ON cur.play_id = p.id AND cur.version = p.current_version
    JOIN tactical_play_version src ON src.play_id = p.id AND src.version = pc.version_from
    WHERE pc.target_id = $1 AND pc.status = 'UNDONE' AND src.document_hash = cur.document_hash
    ORDER BY pc.created_at DESC LIMIT 1`, [playId]);
}
