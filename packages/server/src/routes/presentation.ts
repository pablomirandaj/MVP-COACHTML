// Charla prepartido (docs/20): guion con secciones activables y exportación HTML/PDF.
// Principio: los datos se representan; los textos son del entrenador; no se redacta nada.
import { lineupPositions, playTracks, sceneTracks } from "@fcs/engine";
import { lineupSvg, tracksFrameSvg } from "@fcs/render";
import type { FastifyInstance } from "fastify";
import { requireUser, teamOf } from "../app";
import { many, one, tx, type Tx } from "../db";
import { loadPrimaryLineup, teamContext } from "../repo";
import { HttpError, uuidv7 } from "../util";

export interface OutlineEntry { key: string; title: string; enabled: boolean; text?: string }
const SECTIONS: { key: string; title: string }[] = [
  { key: "context", title: "Rival y contexto" }, { key: "lineup", title: "Nuestra alineación" }, { key: "plan", title: "Plan de juego" },
  { key: "opponent", title: "Análisis del rival" }, { key: "exploit", title: "Lo que debemos aprovechar" }, { key: "avoid", title: "Lo que debemos evitar" },
  { key: "setpieces", title: "Balón parado" }, { key: "phases", title: "Fases de juego" }, { key: "instructions", title: "Instrucciones clave" }, { key: "final", title: "Mensaje final" },
];
const CAT_OPPONENT = ["SYSTEM", "OFFENSIVE_ORG", "DEFENSIVE_ORG", "PRESSING", "TRANSITIONS", "KEY_PLAYERS", "SET_PIECES_ATT", "SET_PIECES_DEF", "OTHER"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function gather(c: Tx, matchId: string, teamId: string) {
  const match = await one(c, `SELECT m.*, o.name AS opponent, md.number AS matchday, comp.name AS competition, t.name AS team FROM match m
    JOIN team t ON t.id = m.team_id LEFT JOIN opponent o ON o.id = m.opponent_id LEFT JOIN matchday md ON md.id = m.matchday_id
    LEFT JOIN competition comp ON comp.id = md.competition_id WHERE m.id = $1`, [matchId]);
  const items = await many<{ category: string; text: string; evidence: string }>(c,
    `SELECT i.category, i.text, i.evidence FROM opponent_analysis a JOIN analysis_item i ON i.analysis_id = a.id WHERE a.match_id = $1 ORDER BY i.ord`, [matchId]);
  const plays = await many<{ id: string; name: string; document: any }>(c, `SELECT p.id, p.name, v.document FROM match_play mp JOIN tactical_play p ON p.id = mp.play_id
    JOIN tactical_play_version v ON v.play_id = p.id AND v.version = p.current_version WHERE mp.match_id = $1 AND p.deleted_at IS NULL ORDER BY mp.ord, p.created_at`, [matchId]);
  const scenes = await many<{ id: string; name: string; document: any }>(c, "SELECT id, name, document FROM phase_scene WHERE match_id = $1 AND deleted_at IS NULL ORDER BY created_at", [matchId]);
  const lineup = await loadPrimaryLineup(c, matchId);
  const ctx = await teamContext(c, teamId);
  return { match, items, plays, scenes, lineup, ctx };
}

function defaultOutline(d: Awaited<ReturnType<typeof gather>>): OutlineEntry[] {
  const has = (cats: string[]) => d.items.some((i) => cats.includes(i.category));
  const enabled: Record<string, boolean> = {
    context: true, lineup: !!d.lineup, plan: !!d.match.objectives || has(["COACH_RECOMMENDATION"]), opponent: has(CAT_OPPONENT),
    exploit: has(["WEAKNESS"]), avoid: has(["STRENGTH"]), setpieces: d.plays.length > 0, phases: d.scenes.length > 0, instructions: false, final: false,
  };
  return SECTIONS.map((s) => ({ ...s, enabled: enabled[s.key] }));
}

function renderTalk(d: Awaited<ReturnType<typeof gather>>, outline: OutlineEntry[]): string {
  const m = d.match;
  const date = m.kickoff_at ? new Date(m.kickoff_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "Fecha por confirmar";
  const list = (cats: string[]) => d.items.filter((i) => cats.includes(i.category))
    .map((i) => `<li>${esc(i.text)}${i.evidence === "HYPOTHESIS" ? ' <span class="tag">por confirmar</span>' : ""}</li>`).join("");
  const text = (e: OutlineEntry) => (e.text ? `<p class="coach">${esc(e.text).replace(/\n/g, "<br>")}</p>` : "");
  const slides: string[] = [];
  for (const e of outline.filter((x) => x.enabled)) {
    const h = `<h2>${esc(e.title)}</h2>`;
    switch (e.key) {
      case "context":
        slides.push(`<section class="title">${m.matchday ? `<p class="kicker">Jornada ${m.matchday}${m.competition ? ` · ${esc(m.competition)}` : ""}</p>` : ""}
          <h1>${esc(m.team)} <span>vs</span> ${esc(m.opponent ?? "—")}</h1><p class="meta">${esc(date)}${m.venue ? ` · ${esc(m.venue)}` : ""}${m.is_home === true ? " · en casa" : m.is_home === false ? " · fuera" : ""}</p>${text(e)}</section>`);
        break;
      case "lineup": {
        if (!d.lineup) break;
        const pos = lineupPositions(d.lineup.doc, d.ctx);
        const players: Record<string, { label: string; name: string } | undefined> = {};
        for (const [slot, pid] of Object.entries(d.lineup.doc.slots)) {
          const p = d.ctx.roster.find((x) => x.id === pid);
          players[slot] = p ? { label: String(p.n ?? ""), name: p.name } : undefined;
        }
        slides.push(`<section>${h}<div class="figure">${lineupSvg(pos, players, d.ctx.pitch)}</div><p class="caption">${esc(d.lineup.formation.replace("F_", "").split("").join("-"))}</p>${text(e)}</section>`);
        break;
      }
      case "plan": slides.push(`<section>${h}${m.objectives ? `<p class="coach">${esc(m.objectives).replace(/\n/g, "<br>")}</p>` : ""}<ul>${list(["COACH_RECOMMENDATION"])}</ul>${text(e)}</section>`); break;
      case "opponent": slides.push(`<section>${h}<ul>${list(CAT_OPPONENT)}</ul>${text(e)}</section>`); break;
      case "exploit": slides.push(`<section>${h}<ul>${list(["WEAKNESS"])}</ul>${text(e)}</section>`); break;
      case "avoid": slides.push(`<section>${h}<ul>${list(["STRENGTH"])}</ul>${text(e)}</section>`); break;
      case "setpieces":
        for (const p of d.plays) {
          const tr = playTracks(p.document, d.ctx.roster, p.name);
          // Una diapositiva por jugada con dos fases: colocación y llegada del balón (docs/20 §5).
          slides.push(`<section>${h}<h3>${esc(p.name)}</h3><div class="pair"><figure>${tracksFrameSvg(tr, tr.t0, { paths: true })}<figcaption>Colocación y carreras</figcaption></figure>
            <figure>${tracksFrameSvg(tr, p.document.delivery.arrival_t, { paths: false })}<figcaption>Llegada del balón</figcaption></figure></div></section>`);
        }
        break;
      case "phases":
        for (const s of d.scenes) {
          const tr = sceneTracks(s.document, s.name);
          const last = s.document.frames.length - 1;
          const tLast = tr.markers[last]?.t ?? tr.t1;
          const notes = s.document.frames.map((f: any) => f.note).filter(Boolean).map((n: string) => `<li>${esc(n)}</li>`).join("");
          slides.push(`<section>${h}<h3>${esc(s.name)}</h3><div class="figure">${tracksFrameSvg(tr, tLast)}</div>${notes ? `<ul class="small">${notes}</ul>` : ""}</section>`);
        }
        break;
      case "instructions": case "final": if (e.text) slides.push(`<section class="${e.key === "final" ? "title" : ""}">${h}${text(e)}</section>`); break;
    }
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Charla · ${esc(m.team)} vs ${esc(m.opponent ?? "")}</title>
<style>
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#14201a;background:#e9ece8}
section{width:1280px;height:720px;padding:48px 64px;background:#fff;page-break-after:always;break-after:page;display:flex;flex-direction:column;overflow:hidden;margin:0 auto 16px}
section.title{justify-content:center;background:#14201a;color:#fff}
h1{font-size:64px;margin:0}h1 span{color:#9db0a5;font-weight:400}h2{font-size:40px;margin:0 0 20px}h3{font-size:24px;margin:0 0 12px;color:#357240}
.kicker{font-size:22px;color:#9db0a5;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px}.meta{font-size:26px;color:#cfd8d2}
ul{font-size:26px;line-height:1.45;margin:0;padding-left:28px}ul.small{font-size:18px;margin-top:10px}li{margin:6px 0}
.coach{font-size:28px;line-height:1.45;margin:8px 0}.tag{font-size:16px;background:#fde8c8;color:#6b4300;border-radius:6px;padding:2px 8px}
.figure{flex:1;min-height:0;display:flex;justify-content:center}.figure svg{height:100%;max-width:100%}
.pair{flex:1;min-height:0;display:flex;gap:24px}.pair figure{flex:1;margin:0;display:flex;flex-direction:column}.pair svg{flex:1;min-height:0;width:100%}
figcaption,.caption{text-align:center;color:#5b6b62;font-size:18px;margin-top:6px}
@media print{body{background:#fff}section{margin:0}}
</style></head><body>${slides.join("\n")}</body></html>`;
}

export async function presentationRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  const load = async (c: Tx, matchId: string, teamId: string) => {
    const d = await gather(c, matchId, teamId);
    const row = await one<{ id: string; outline: OutlineEntry[]; revision: number }>(c, "SELECT id, outline, revision FROM match_presentation WHERE match_id = $1", [matchId]);
    return { d, row, outline: row?.outline ?? defaultOutline(d) };
  };

  app.get<{ Params: { id: string } }>("/matches/:id/presentation", async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const { row, outline, d } = await load(c, req.params.id, teamId);
      return { outline, revision: row?.revision ?? 0, available: { plays: d.plays.length, scenes: d.scenes.length, analysis_items: d.items.length, lineup: !!d.lineup } };
    });
  });

  app.put<{ Params: { id: string }; Body: { outline: OutlineEntry[]; revision: number } }>("/matches/:id/presentation", {
    schema: { body: { type: "object", required: ["outline", "revision"], properties: { revision: { type: "integer" }, outline: { type: "array", maxItems: 20, items: { type: "object", required: ["key", "title", "enabled"], properties: {
      key: { enum: SECTIONS.map((s) => s.key) }, title: { type: "string", minLength: 1, maxLength: 80 }, enabled: { type: "boolean" }, text: { type: "string", maxLength: 3000 } } } } } } },
  }, async (req) => {
    const u = requireUser(req);
    return tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const cur = await one<{ id: string; revision: number }>(c, "SELECT id, revision FROM match_presentation WHERE match_id = $1", [req.params.id]);
      if ((cur?.revision ?? 0) !== req.body.revision) throw new HttpError(409, "STALE_REVISION", "La charla ha cambiado; recarga.");
      if (cur) await c.query("UPDATE match_presentation SET outline = $2, revision = revision + 1, updated_at = now() WHERE id = $1", [cur.id, JSON.stringify(req.body.outline)]);
      else await c.query("INSERT INTO match_presentation(id, match_id, team_id, outline, created_by) VALUES ($1,$2,$3,$4,$5)", [uuidv7(), req.params.id, teamId, JSON.stringify(req.body.outline), u.id]);
      return { outline: req.body.outline, revision: (cur?.revision ?? 0) + 1 };
    });
  });

  const html = async (userId: string, matchId: string) => tx(db, userId, async (c) => {
    const teamId = await teamOf(c, userId, "match", matchId);
    const { d, outline } = await load(c, matchId, teamId);
    return renderTalk(d, outline);
  });

  app.get<{ Params: { id: string } }>("/matches/:id/presentation.html", async (req, reply) => {
    const u = requireUser(req);
    return reply.type("text/html; charset=utf-8").send(await html(u.id, req.params.id));
  });

  app.get<{ Params: { id: string } }>("/matches/:id/presentation.pdf", async (req, reply) => {
    const u = requireUser(req);
    if (!app.opts.chromiumPath) throw new HttpError(503, "PDF_UNAVAILABLE", "La exportación a PDF no está configurada en este servidor.");
    const page = await html(u.id, req.params.id);
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: app.opts.chromiumPath });
    try {
      const p = await browser.newPage();
      await p.setContent(page, { waitUntil: "load" });
      const pdf = await p.pdf({ width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
      return reply.type("application/pdf").header("content-disposition", 'attachment; filename="charla.pdf"').send(Buffer.from(pdf));
    } finally {
      await browser.close();
    }
  });
}
