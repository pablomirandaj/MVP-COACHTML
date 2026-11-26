import { canonicalHash, computeScene, ENGINE_VERSION, FORMATIONS, sceneTracks, type SceneSpec } from "@fcs/engine";
import { renderTracksHtml } from "@fcs/render";
import type { FastifyInstance } from "fastify";
import { requireStaff, requireUser, teamOf } from "../app";
import { many, one, tx, type Tx } from "../db";
import { loadPrimaryLineup, teamContext } from "../repo";
import { HttpError, uuidv7 } from "../util";
import { slug } from "./plays";

export const SCENE_TYPES = ["PRESS_OWN", "PRESS_OPP", "RETREAT", "REST_DEFENSE"];
const specSchema = {
  type: "object", required: ["type", "own", "opp", "params", "keyframes"],
  properties: {
    type: { enum: SCENE_TYPES }, title: { type: "string", maxLength: 120 },
    own: { type: "object", required: ["formation"], properties: { formation: { type: "string" }, labels: { type: "object" } } },
    opp: { type: "object", required: ["formation"], properties: { formation: { type: "string" }, labels: { type: "object" } } },
    params: { type: "object", properties: {
      block_height: { enum: ["HIGH", "MID", "LOW"] }, compactness_m: { type: "number", minimum: 10, maximum: 50 }, lateral_shift: { type: "number", minimum: 0, maximum: 1 },
      jumps: { type: "array", maxItems: 6, items: { type: "object", required: ["who", "to"], properties: { who: { type: "string" }, to: { type: "string" }, curve: { enum: ["SCREEN_GK"] } } } },
      opp_staying: { type: "array", maxItems: 4, items: { type: "string" } }, rest_count: { type: "integer", minimum: 1, maximum: 6 } } },
    keyframes: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", required: ["t", "ball"], properties: {
      t: { type: "number", minimum: 0, maximum: 60 }, ball: { type: "object", required: ["holder"], properties: { holder: { type: "string" } } },
      event: { enum: ["TRIGGER"] }, note: { type: "string", maxLength: 400 } } } },
  },
} as const;

/** Valida referencias (formaciones y ranuras) y calcula la escena; los errores del motor se devuelven como 422. */
export async function buildScene(c: Tx, teamId: string, matchId: string | null, spec: SceneSpec) {
  for (const f of [spec.own.formation, spec.opp.formation]) if (!FORMATIONS[f]) throw new HttpError(422, "VALIDATION_ERROR", `Formación desconocida: ${f}`);
  const ownSlots = new Set(FORMATIONS[spec.own.formation].slots.map((s) => s.slot));
  const oppSlots = new Set(FORMATIONS[spec.opp.formation].slots.map((s) => s.slot));
  const possessing = spec.type === "PRESS_OWN" || spec.type === "RETREAT" ? oppSlots : ownSlots;
  const pressing = spec.type === "PRESS_OPP" ? oppSlots : ownSlots;
  const target = spec.type === "PRESS_OPP" ? ownSlots : oppSlots;
  for (const k of spec.keyframes) if (!possessing.has(k.ball.holder)) throw new HttpError(422, "VALIDATION_ERROR", `Poseedor no válido para esta escena: ${k.ball.holder}`);
  for (const j of spec.params.jumps ?? []) if (!pressing.has(j.who) || !target.has(j.to)) throw new HttpError(422, "VALIDATION_ERROR", `Salto no válido: ${j.who} → ${j.to}`);
  for (const s of spec.params.opp_staying ?? []) if (!oppSlots.has(s)) throw new HttpError(422, "VALIDATION_ERROR", `Delantero rival no válido: ${s}`);
  // Si el once del partido usa la misma formación, los jugadores se rotulan con su dorsal.
  if (matchId && !spec.own.labels) {
    const l = await loadPrimaryLineup(c, matchId);
    if (l && l.formation === spec.own.formation) {
      const ctx = await teamContext(c, teamId);
      const labels: Record<string, string> = {};
      for (const [slot, pid] of Object.entries(l.doc.slots)) { const p = ctx.roster.find((x) => x.id === pid); if (p?.n) labels[slot] = String(p.n); }
      spec = { ...spec, own: { ...spec.own, labels } };
    }
  }
  const pitch = (await teamContext(c, teamId)).pitch;
  return { spec, doc: computeScene(spec, pitch) };
}

async function sceneView(c: Tx, id: string) {
  const s = await one(c, "SELECT id, team_id, match_id, name, spec, document, revision, updated_at FROM phase_scene WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!s) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
  return { ...s, diagnostics: s.document.diagnostics };
}

export async function sceneRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.get<{ Params: { id: string }; Querystring: { match_id?: string } }>("/teams/:id/scenes", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    return many(db, `SELECT id, match_id, name, spec->>'type' AS type, revision, updated_at FROM phase_scene
      WHERE team_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR match_id = $2::uuid) ORDER BY updated_at DESC`, [req.params.id, req.query.match_id ?? null]);
  });

  app.post<{ Params: { id: string }; Body: { name: string; match_id?: string; spec: SceneSpec } }>("/teams/:id/scenes", {
    schema: { body: { type: "object", required: ["name", "spec"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, match_id: { type: "string", format: "uuid" }, spec: specSchema } } },
  }, async (req, reply) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await requireStaff(c, u.id, req.params.id);
      if (req.body.match_id && (await one<{ team_id: string }>(c, "SELECT team_id FROM match WHERE id = $1", [req.body.match_id]))?.team_id !== req.params.id)
        throw new HttpError(422, "VALIDATION_ERROR", "El partido no es de este equipo.");
      const { spec, doc } = await buildScene(c, req.params.id, req.body.match_id ?? null, req.body.spec);
      const id = uuidv7();
      await c.query(`INSERT INTO phase_scene(id, team_id, match_id, name, spec, document, document_hash, engine_version, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, req.params.id, req.body.match_id ?? null, req.body.name.trim(), JSON.stringify(spec), JSON.stringify(doc), canonicalHash(doc), ENGINE_VERSION, u.id]);
      return reply.status(201).send(await sceneView(c, id));
    });
  });

  app.get<{ Params: { id: string } }>("/scenes/:id", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => { await teamOf(c, u.id, "phase_scene", req.params.id); return sceneView(c, req.params.id); });
  });

  app.put<{ Params: { id: string }; Body: { name?: string; spec: SceneSpec; revision: number } }>("/scenes/:id", {
    schema: { body: { type: "object", required: ["spec", "revision"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, spec: specSchema, revision: { type: "integer" } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "phase_scene", req.params.id);
      const cur = await sceneView(c, req.params.id);
      if (cur.revision !== req.body.revision) throw new HttpError(409, "STALE_REVISION", "La escena ha cambiado; recarga.", { revision: cur.revision });
      const { spec, doc } = await buildScene(c, teamId, cur.match_id, req.body.spec);
      await c.query(`UPDATE phase_scene SET name = COALESCE($2, name), spec = $3, document = $4, document_hash = $5, engine_version = $6, revision = revision + 1, updated_at = now() WHERE id = $1`,
        [req.params.id, req.body.name?.trim() ?? null, JSON.stringify(spec), JSON.stringify(doc), canonicalHash(doc), ENGINE_VERSION]);
      return sceneView(c, req.params.id);
    });
  });

  app.delete<{ Params: { id: string } }>("/scenes/:id", async (req, reply) => {
    const u = requireUser(req);
    await tx(db, u.id, async (c) => { await teamOf(c, u.id, "phase_scene", req.params.id); await c.query("UPDATE phase_scene SET deleted_at = now() WHERE id = $1", [req.params.id]); });
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>("/scenes/:id/export.html", async (req, reply) => {
    const u = requireUser(req);
    const s = await tx(db, u.id, async (c) => { await teamOf(c, u.id, "phase_scene", req.params.id); return sceneView(c, req.params.id); });
    const tracks = sceneTracks(s.document, s.name);
    return reply.type("text/html; charset=utf-8").header("content-disposition", `attachment; filename="${slug(s.name)}.html"`).send(renderTracksHtml(tracks));
  });
}
