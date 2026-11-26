import { applyLineupCommand, emptyLineup, FORMATIONS, lineupPositions, validateLineup, type Command, type LineupDoc } from "@fcs/engine";
import type { FastifyInstance } from "fastify";
import { requireUser, teamOf } from "../app";
import { tx, type Tx } from "../db";
import { formationId, loadPrimaryLineup, teamContext } from "../repo";
import { HttpError, uuidv7 } from "../util";

const LINEUP_OPS = new Set(["lineup.set_formation", "lineup.assign", "lineup.assign_group", "lineup.substitute", "lineup.swap", "lineup.shift_group", "lineup.shift_slot", "lineup.compact", "lineup.clear_slot"]);

async function persist(c: Tx, matchId: string, teamId: string, userId: string, doc: LineupDoc, expected: number | undefined, source: string, commands: Command[]) {
  const cur = await loadPrimaryLineup(c, matchId);
  if (cur && expected !== undefined && cur.revision !== expected) throw new HttpError(409, "STALE_REVISION", "La alineación ha cambiado; recarga y vuelve a intentarlo.", { revision: cur.revision });
  const fid = await formationId(c, doc.formation);
  let id = cur?.id;
  if (!id) {
    id = uuidv7();
    await c.query(`INSERT INTO lineup(id, team_id, match_id, formation_id, is_primary, slot_overrides, created_by) VALUES ($1,$2,$3,$4,true,$5,$6)`,
      [id, teamId, matchId, fid, JSON.stringify(doc.overrides), userId]);
  } else {
    await c.query("UPDATE lineup SET formation_id = $2, slot_overrides = $3, revision = revision + 1, state = 'DRAFT', updated_at = now() WHERE id = $1",
      [id, fid, JSON.stringify(doc.overrides)]);
  }
  await c.query("DELETE FROM lineup_assignment WHERE lineup_id = $1", [id]);
  for (const [slot, pid] of Object.entries(doc.slots)) {
    if (!pid) continue;
    await c.query("INSERT INTO lineup_assignment(lineup_id, slot, player_id, provenance) VALUES ($1,$2,$3,$4)", [id, slot, pid, doc.slot_provenance[slot] ?? "MANUAL"]);
  }
  await c.query(`INSERT INTO parsed_command(id, team_id, nlu_version, ir, status, target_type, target_id, applied_by, applied_at, source) VALUES ($1,$2,'n/a',$3,'APPLIED','LINEUP',$4,$5,now(),$6)`,
    [uuidv7(), teamId, JSON.stringify({ commands }), id, userId, source]);
}

export async function lineupRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  const view = async (c: Tx | typeof db, matchId: string, teamId: string) => {
    const l = await loadPrimaryLineup(c, matchId);
    if (!l) return { lineup: null };
    const ctx = await teamContext(c, teamId);
    return { lineup: { id: l.id, revision: l.revision, state: l.state, doc: l.doc, positions: lineupPositions(l.doc, ctx), diagnostics: validateLineup(l.doc, ctx) } };
  };

  app.get<{ Params: { id: string } }>("/matches/:id/lineup", async (req) => {
    const u = requireUser(req);
    const teamId = await teamOf(db, u.id, "match", req.params.id);
    return view(db, req.params.id, teamId);
  });

  // Aplica comandos IR con el motor (autoritativo). Si el motor pregunta, no se guarda nada.
  app.post<{ Params: { id: string }; Body: { commands: Command[]; revision?: number; source?: string } }>("/matches/:id/lineup/commands", {
    schema: { body: { type: "object", required: ["commands"], properties: { commands: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", required: ["op"] } }, revision: { type: "integer" }, source: { enum: ["MANUAL", "ASSISTANT", "CLARIFICATION"] } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const ctx = await teamContext(c, teamId);
      const cur = await loadPrimaryLineup(c, req.params.id);
      const first = req.body.commands.find((x) => x.op === "lineup.set_formation");
      let doc: LineupDoc = cur?.doc ?? emptyLineup(first?.formation ?? "F_433");
      for (const cmd of req.body.commands) {
        if (!LINEUP_OPS.has(cmd.op)) throw new HttpError(422, "VALIDATION_ERROR", `Operación no válida para alineaciones: ${cmd.op}`);
        if (cmd.op === "lineup.set_formation" && !FORMATIONS[cmd.formation]) throw new HttpError(422, "VALIDATION_ERROR", "Formación desconocida.");
        for (const k of ["player", "out", "in", "a", "b"]) if (cmd[k] && !ctx.roster.some((p) => p.id === cmd[k])) throw new HttpError(422, "VALIDATION_ERROR", "Jugador desconocido.");
        for (const p of cmd.players ?? []) if (!ctx.roster.some((x) => x.id === p)) throw new HttpError(422, "VALIDATION_ERROR", "Jugador desconocido.");
        const r = applyLineupCommand(doc, cmd, ctx);
        if (r.clarifications.length) return { applied: false, clarifications: r.clarifications, ...(await view(c, req.params.id, teamId)) };
        doc = r.doc;
      }
      await persist(c, req.params.id, teamId, u.id, doc, req.body.revision ?? cur?.revision, req.body.source ?? "MANUAL", req.body.commands);
      return { applied: true, clarifications: [], ...(await view(c, req.params.id, teamId)) };
    });
  });

  // Guardado completo desde el editor (arrastrar y soltar).
  app.put<{ Params: { id: string }; Body: { doc: LineupDoc; revision?: number } }>("/matches/:id/lineup", {
    schema: { body: { type: "object", required: ["doc"], properties: { doc: { type: "object", required: ["formation", "slots"] }, revision: { type: "integer" } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const ctx = await teamContext(c, teamId);
      const d = req.body.doc;
      if (!FORMATIONS[d.formation]) throw new HttpError(422, "VALIDATION_ERROR", "Formación desconocida.");
      const doc = emptyLineup(d.formation);
      const used = new Set<string>();
      for (const [slot, pid] of Object.entries(d.slots ?? {})) {
        if (!(slot in doc.slots) || !pid) continue;
        if (!ctx.roster.some((p) => p.id === pid)) throw new HttpError(422, "VALIDATION_ERROR", "Jugador desconocido.");
        if (used.has(pid)) throw new HttpError(422, "LINEUP-02", "Un jugador está en dos posiciones.");
        used.add(pid);
        doc.slots[slot] = pid; doc.slot_provenance[slot] = d.slot_provenance?.[slot] ?? "MANUAL";
      }
      for (const [slot, o] of Object.entries(d.overrides ?? {})) if (slot in doc.slots) doc.overrides[slot] = { dx_m: Number(o.dx_m) || 0, dy_m: Number(o.dy_m) || 0 };
      await persist(c, req.params.id, teamId, u.id, doc, req.body.revision, "MANUAL", [{ op: "lineup.save_manual" }]);
      return view(c, req.params.id, teamId);
    });
  });

  app.post<{ Params: { id: string } }>("/matches/:id/lineup/confirm", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const l = await loadPrimaryLineup(c, req.params.id);
      if (!l) throw new HttpError(404, "NOT_FOUND", "No hay alineación.");
      const errors = validateLineup(l.doc, await teamContext(c, teamId)).filter((d) => d.severity === "error");
      if (errors.length) throw new HttpError(422, "LINEUP_INVALID", errors.map((e) => e.message).join(" "), { diagnostics: errors });
      await c.query("UPDATE lineup SET state = 'PUBLISHED', updated_at = now() WHERE id = $1", [l.id]);
      return view(c, req.params.id, teamId);
    });
  });
}
