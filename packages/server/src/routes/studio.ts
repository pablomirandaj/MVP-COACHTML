// Pizarra Studio en el servidor (diseño §5.1, anfitrión "servidor"): piezas con revisión, exportación HTML y el
// asistente con el mismo bucle y espacios de trabajo que la página de Claude (@fcs/assistant).
import { boardTracks, computeScene, DEFAULT_PITCH, playTracks, sceneTracks, type BoardDoc, type PlayDoc, type SceneSpec } from "@fcs/engine";
import { boardWorkspace, runTurn, sceneWorkspace, setPieceWorkspace, type LlmMessage, type Workspace } from "@fcs/assistant";
import { renderTracksHtml } from "@fcs/render";
import type { FastifyInstance } from "fastify";
import { noContent, requireStaff, requireUser, teamOf } from "../app";
import { many, one, tx } from "../db";
import { teamContext } from "../repo";
import { HttpError } from "../util";
import { slug } from "./plays";

const KINDS = ["BOARD", "SETPIECE", "SCENE"] as const;
const itemBody = {
  type: "object", required: ["id", "kind", "title", "doc"], properties: {
    id: { type: "string", pattern: "^[a-z0-9_]{3,64}$" }, kind: { enum: KINDS }, title: { type: "string", minLength: 1, maxLength: 120 },
    doc: { type: "object" }, history: { type: "array", maxItems: 500 }, match: { type: "integer", minimum: 1, maximum: 60 },
    opponent: { type: "string", maxLength: 120 }, revision: { type: "integer", minimum: 0 },
  },
} as const;
interface ItemBody { id: string; kind: (typeof KINDS)[number]; title: string; doc: unknown; history?: unknown[]; match?: number; opponent?: string; revision?: number }
const SELECT = `SELECT id, kind, title, match_number AS match, opponent, doc, history, revision, updated_at FROM studio_item`;
const clean = (r: any) => { const o = { ...r }; if (o.match === null) delete o.match; if (o.opponent === null) delete o.opponent; return o; };

export async function studioRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.get<{ Params: { id: string } }>("/teams/:id/studio/items", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    return (await many(db, `${SELECT} WHERE team_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id`, [req.params.id])).map(clean);
  });

  app.post<{ Params: { id: string }; Body: ItemBody }>("/teams/:id/studio/items", { schema: { body: itemBody } }, async (req, reply) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await requireStaff(c, u.id, req.params.id);
      const b = req.body;
      if (await one(c, "SELECT 1 FROM studio_item WHERE id = $1", [b.id])) throw new HttpError(409, "conflict", "Ya existe una pieza con ese identificador.");
      const r = await one(c, `INSERT INTO studio_item(id, team_id, kind, title, match_number, opponent, doc, history, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, revision, updated_at`,
        [b.id, req.params.id, b.kind, b.title, b.match ?? null, b.opponent ?? null, JSON.stringify(b.doc), JSON.stringify(b.history ?? []), u.id]);
      return reply.status(201).send(r);
    });
  });

  app.get<{ Params: { id: string } }>("/studio/items/:id", async (req) => {
    const u = requireUser(req);
    await teamOf(db, u.id, "studio_item", req.params.id);
    const r = await one(db, `${SELECT} WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!r) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
    return clean(r);
  });

  app.put<{ Params: { id: string }; Body: ItemBody }>("/studio/items/:id", { schema: { body: { ...itemBody, required: ["kind", "title", "doc", "revision"] } } }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      await teamOf(c, u.id, "studio_item", req.params.id);
      const b = req.body;
      const r = await one(c, `UPDATE studio_item SET title = $2, match_number = $3, opponent = $4, doc = $5, history = $6, revision = revision + 1, updated_at = now()
        WHERE id = $1 AND revision = $7 AND deleted_at IS NULL RETURNING id, revision, updated_at`,
        [req.params.id, b.title, b.match ?? null, b.opponent ?? null, JSON.stringify(b.doc), JSON.stringify(b.history ?? []), b.revision]);
      if (!r) throw new HttpError(409, "conflict", "Otra persona ha guardado esta pieza.");
      return r;
    });
  });

  app.delete<{ Params: { id: string } }>("/studio/items/:id", async (req, reply) => {
    const u = requireUser(req);
    await teamOf(db, u.id, "studio_item", req.params.id);
    await db.query("UPDATE studio_item SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    return noContent(reply);
  });

  app.get<{ Params: { id: string } }>("/studio/items/:id/export.html", async (req, reply) => {
    const u = requireUser(req);
    const teamId = await teamOf(db, u.id, "studio_item", req.params.id);
    const it = await one<any>(db, `${SELECT} WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!it) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
    const ctx = await teamContext(db, teamId);
    const team = await one<{ name: string }>(db, "SELECT name FROM team WHERE id = $1", [teamId]);
    const tracks = it.kind === "BOARD" ? boardTracks(it.doc as BoardDoc, ctx.roster)
      : it.kind === "SETPIECE" ? playTracks(it.doc as PlayDoc, ctx.roster, it.title)
      : sceneTracks(computeScene(it.doc as SceneSpec, DEFAULT_PITCH), it.title);
    const html = renderTracksHtml({ ...tracks, title: it.title }, { teamColor: "#1f9d55", teamInk: "#0b0f0c", oppColor: "#d64545",
      meta: { team: team?.name, match: it.match ? `Jornada ${it.match}` : undefined, opponent: it.opponent ?? undefined } });
    return reply.type("text/html; charset=utf-8").header("content-disposition", `attachment; filename="${slug(it.title)}.html"`).send(html);
  });

  app.get("/studio/assistant", async (req) => { requireUser(req); return { available: !!app.opts.llm }; });

  app.post<{ Params: { id: string }; Body: { kind: (typeof KINDS)[number]; state: any; history?: { role: "user" | "assistant"; content: string }[]; message: string; context?: { opponent?: string } } }>(
    "/teams/:id/studio/assistant", { schema: { body: { type: "object", required: ["kind", "state", "message"], properties: {
      kind: { enum: KINDS }, state: { type: ["object", "null"] }, message: { type: "string", minLength: 1, maxLength: 2000 },
      history: { type: "array", maxItems: 40, items: { type: "object", required: ["role", "content"], properties: { role: { enum: ["user", "assistant"] }, content: { type: "string", maxLength: 8000 } } } },
      context: { type: "object", properties: { opponent: { type: "string", maxLength: 120 } } } } } } },
    async (req) => {
      const u = requireUser(req);
      await requireStaff(db, u.id, req.params.id);
      const llm = app.opts.llm;
      if (!llm) throw new HttpError(503, "ASSISTANT_UNAVAILABLE", "El asistente no está configurado en este servidor.");
      const { roster } = await teamContext(db, req.params.id);
      let state = req.body.state;
      const opponent = req.body.context?.opponent;
      const set = (s: unknown) => { state = s; };
      const ws: Workspace = req.body.kind === "BOARD" ? boardWorkspace({ doc: state as BoardDoc, roster, opponent }, set)
        : req.body.kind === "SETPIECE" ? setPieceWorkspace({ doc: state as PlayDoc | null, type: (state as PlayDoc | null)?.type ?? "CORNER_ATT", roster, opponent }, set)
        : sceneWorkspace({ spec: state as SceneSpec, roster, opponent }, set);
      const history: LlmMessage[] = (req.body.history ?? []).map((h) => ({ role: h.role, content: [{ type: "text", text: h.content }] }));
      const r = await runTurn(llm, ws, history, req.body.message);
      return { reply: r.reply, clarification: r.clarification, state };
    });
}
