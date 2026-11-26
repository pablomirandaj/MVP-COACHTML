import type { FastifyInstance } from "fastify";
import { requireStaff, requireUser, teamOf } from "../app";
import { parseCalendar } from "../csv";
import { many, one, tx, type Tx } from "../db";
import { HttpError, normalizeName, uuidv7 } from "../util";

const MATCH_SELECT = `
  SELECT m.id, m.team_id, m.status, m.kickoff_at, m.original_kickoff_at, m.is_home, m.venue, m.goals_for, m.goals_against,
         m.objectives, m.training_notes, m.post_match_notes, md.number AS matchday, c.name AS competition, o.id AS opponent_id, o.name AS opponent
  FROM match m LEFT JOIN matchday md ON md.id = m.matchday_id LEFT JOIN competition c ON c.id = md.competition_id
  LEFT JOIN opponent o ON o.id = m.opponent_id`;

async function opponentId(c: Tx, teamId: string, name: string): Promise<string> {
  const club = (await one<{ club_id: string }>(c, "SELECT club_id FROM team WHERE id = $1", [teamId]))!.club_id;
  const n = normalizeName(name);
  const found = await one<{ id: string }>(c, "SELECT id FROM opponent WHERE club_id = $1 AND normalized = $2", [club, n]);
  if (found) return found.id;
  const id = uuidv7();
  await c.query("INSERT INTO opponent(id, club_id, name, normalized) VALUES ($1,$2,$3,$4)", [id, club, name.trim(), n]);
  return id;
}

async function matchdayId(c: Tx, teamId: string, number: number | null): Promise<string | null> {
  if (number === null) return null;
  const comp = await one<{ id: string }>(c, "SELECT id FROM competition WHERE team_id = $1 ORDER BY name LIMIT 1", [teamId]);
  if (!comp) return null;
  const md = await one<{ id: string }>(c, "SELECT id FROM matchday WHERE competition_id = $1 AND number = $2", [comp.id, number]);
  if (md) return md.id;
  const id = uuidv7();
  await c.query("INSERT INTO matchday(id, competition_id, number, label) VALUES ($1,$2,$3,$4)", [id, comp.id, number, `Jornada ${number}`]);
  return id;
}

export async function matchRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.get<{ Params: { id: string } }>("/teams/:id/matches", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    return many(db, `${MATCH_SELECT} WHERE m.team_id = $1 ORDER BY md.number NULLS LAST, m.kickoff_at NULLS LAST`, [req.params.id]);
  });

  app.post<{ Params: { id: string }; Body: { opponent?: string; matchday?: number; kickoff_at?: string; is_home?: boolean; venue?: string; status?: string } }>("/teams/:id/matches", {
    schema: { body: { type: "object", properties: {
      opponent: { type: "string", minLength: 1, maxLength: 120 }, matchday: { type: "integer", minimum: 1, maximum: 60 }, kickoff_at: { type: "string", format: "date-time" },
      is_home: { type: "boolean" }, venue: { type: "string", maxLength: 160 }, status: { enum: ["SCHEDULED", "BYE"] } } } },
  }, async (req, reply) => {
    const u = requireUser(req);
    const b = req.body;
    if (b.status !== "BYE" && !b.opponent) throw new HttpError(422, "VALIDATION_ERROR", "Indica el rival.");
    const id = await tx(db, u.id, async (c) => {
      await requireStaff(c, u.id, req.params.id);
      const id = uuidv7();
      await c.query(`INSERT INTO match(id, team_id, matchday_id, opponent_id, status, kickoff_at, is_home, venue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, req.params.id, await matchdayId(c, req.params.id, b.matchday ?? null), b.status === "BYE" ? null : await opponentId(c, req.params.id, b.opponent!),
          b.status ?? "SCHEDULED", b.kickoff_at ?? null, b.is_home ?? null, b.venue ?? null]);
      return id;
    });
    return reply.status(201).send(await one(db, `${MATCH_SELECT} WHERE m.id = $1`, [id]));
  });

  app.get<{ Params: { id: string } }>("/matches/:id", async (req) => {
    const u = requireUser(req);
    await teamOf(db, u.id, "match", req.params.id);
    return one(db, `${MATCH_SELECT} WHERE m.id = $1`, [req.params.id]);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, any> }>("/matches/:id", {
    // additionalProperties: false es obligatorio: las claves se usan como nombres de columna.
    schema: { body: { type: "object", additionalProperties: false, properties: {
      kickoff_at: { type: ["string", "null"], format: "date-time" }, status: { enum: ["SCHEDULED", "POSTPONED", "PLAYED", "CANCELLED", "BYE"] },
      venue: { type: ["string", "null"] }, is_home: { type: ["boolean", "null"] }, goals_for: { type: ["integer", "null"] }, goals_against: { type: ["integer", "null"] },
      objectives: { type: ["string", "null"], maxLength: 4000 }, training_notes: { type: ["string", "null"], maxLength: 4000 }, post_match_notes: { type: ["string", "null"], maxLength: 4000 } } } },
  }, async (req) => {
    const u = requireUser(req);
    await tx(db, u.id, async (c) => {
      await teamOf(c, u.id, "match", req.params.id);
      const b = req.body;
      if (b.status === "POSTPONED" || ("kickoff_at" in b)) await c.query("UPDATE match SET original_kickoff_at = COALESCE(original_kickoff_at, kickoff_at) WHERE id = $1 AND kickoff_at IS NOT NULL", [req.params.id]);
      const cols = Object.entries(b);
      if (cols.length) await c.query(`UPDATE match SET ${cols.map(([k], i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`, [req.params.id, ...cols.map(([, v]) => v)]);
    });
    return one(db, `${MATCH_SELECT} WHERE m.id = $1`, [req.params.id]);
  });

  // Importación en dos fases: sin `commit` devuelve la previsualización; con `commit` crea las jornadas (docs/13 §2).
  app.post<{ Params: { id: string }; Body: { csv: string; aliases?: string[]; commit?: boolean } }>("/teams/:id/calendar/import", {
    schema: { body: { type: "object", required: ["csv"], properties: { csv: { type: "string", maxLength: 500000 }, aliases: { type: "array", items: { type: "string" } }, commit: { type: "boolean" } } } },
  }, async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    const team = (await one<{ name: string }>(db, "SELECT name FROM team WHERE id = $1", [req.params.id]))!;
    const { rows, columns } = parseCalendar(req.body.csv, team.name, req.body.aliases);
    const missing = ["date", "home", "away"].filter((k) => columns[k] === undefined);
    if (missing.length) throw new HttpError(422, "CSV_COLUMNS", `No encuentro las columnas: ${missing.join(", ")}.`, { columns });
    if (!req.body.commit) return { rows, columns };
    const valid = rows.filter((r) => r.bye || (r.opponent && r.kickoff_at));
    await tx(db, u.id, async (c) => {
      for (const r of valid) {
        await c.query(`INSERT INTO match(id, team_id, matchday_id, opponent_id, status, kickoff_at, is_home, venue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv7(), req.params.id, await matchdayId(c, req.params.id, r.matchday), r.bye ? null : await opponentId(c, req.params.id, r.opponent!),
            r.bye ? "BYE" : "SCHEDULED", r.kickoff_at, r.is_home, r.venue]);
      }
    });
    return { created: valid.length, skipped: rows.length - valid.length };
  });

  // Análisis del rival (formulario por categorías; docs/19). Un análisis por partido en el MVP.
  app.get<{ Params: { id: string } }>("/matches/:id/analysis", async (req) => {
    const u = requireUser(req);
    await teamOf(db, u.id, "match", req.params.id);
    return many(db, `SELECT i.id, i.category, i.text, i.evidence, i.ord FROM opponent_analysis a JOIN analysis_item i ON i.analysis_id = a.id
      WHERE a.match_id = $1 ORDER BY i.ord`, [req.params.id]);
  });

  app.put<{ Params: { id: string }; Body: { items: { category: string; text: string; evidence?: string }[] } }>("/matches/:id/analysis", {
    schema: { body: { type: "object", required: ["items"], properties: { items: { type: "array", maxItems: 80, items: { type: "object", required: ["category", "text"], properties: {
      category: { enum: ["SYSTEM", "OFFENSIVE_ORG", "DEFENSIVE_ORG", "PRESSING", "TRANSITIONS", "STRENGTH", "WEAKNESS", "SET_PIECES_ATT", "SET_PIECES_DEF", "KEY_PLAYERS", "COACH_RECOMMENDATION", "OTHER"] },
      text: { type: "string", minLength: 1, maxLength: 600 }, evidence: { enum: ["OBSERVED", "HYPOTHESIS", "CONFIRMED", "REFUTED"] } } } } } } },
  }, async (req) => {
    const u = requireUser(req);
    await tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "match", req.params.id);
      const m = await one<{ opponent_id: string | null }>(c, "SELECT opponent_id FROM match WHERE id = $1", [req.params.id]);
      if (!m?.opponent_id) throw new HttpError(422, "NO_OPPONENT", "Este partido no tiene rival.");
      let a = await one<{ id: string }>(c, "SELECT id FROM opponent_analysis WHERE match_id = $1", [req.params.id]);
      if (!a) {
        a = { id: uuidv7() };
        await c.query("INSERT INTO opponent_analysis(id, opponent_id, team_id, match_id, source_kind, author_id) VALUES ($1,$2,$3,$4,'OTHER',$5)", [a.id, m.opponent_id, teamId, req.params.id, u.id]);
      }
      await c.query("DELETE FROM analysis_item WHERE analysis_id = $1", [a.id]);
      for (const [i, it] of req.body.items.entries())
        await c.query("INSERT INTO analysis_item(id, analysis_id, category, text, evidence, ord) VALUES ($1,$2,$3,$4,$5,$6)", [uuidv7(), a.id, it.category, it.text, it.evidence ?? "OBSERVED", i]);
      await c.query("UPDATE opponent_analysis SET updated_at = now() WHERE id = $1", [a.id]);
    });
    return many(db, `SELECT i.id, i.category, i.text, i.evidence, i.ord FROM opponent_analysis a JOIN analysis_item i ON i.analysis_id = a.id WHERE a.match_id = $1 ORDER BY i.ord`, [req.params.id]);
  });
}
