import type { FastifyInstance } from "fastify";
import { requireStaff, requireUser } from "../app";
import { one, tx } from "../db";
import { HttpError, uuidv7 } from "../util";

export async function teamRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.post<{ Body: { name: string; category: string; season_label: string; competition?: string; pitch_length_m?: number; pitch_width_m?: number } }>("/teams", {
    schema: { body: { type: "object", required: ["name", "category", "season_label"], properties: {
      name: { type: "string", minLength: 1, maxLength: 100 }, category: { type: "string", minLength: 1, maxLength: 60 },
      season_label: { type: "string", pattern: "^\\d{4}/\\d{2}$" }, competition: { type: "string", maxLength: 120 },
      pitch_length_m: { type: "number", minimum: 90, maximum: 120 }, pitch_width_m: { type: "number", minimum: 45, maximum: 90 } } } },
  }, async (req, reply) => {
    const u = requireUser(req);
    const b = req.body;
    const team = await tx(db, u.id, async (c) => {
      // Plan individual: club implícito (docs/05 §1.1).
      let club = await one<{ id: string }>(c, `SELECT club_id AS id FROM club_admin WHERE user_id = $1 LIMIT 1`, [u.id]);
      if (!club) {
        club = { id: uuidv7() };
        await c.query("INSERT INTO club(id, name) VALUES ($1,$2)", [club.id, b.name]);
        await c.query("INSERT INTO club_admin(club_id, user_id) VALUES ($1,$2)", [club.id, u.id]);
      }
      let season = await one<{ id: string }>(c, "SELECT id FROM season WHERE club_id = $1 AND label = $2", [club.id, b.season_label]);
      if (!season) {
        const y = Number(b.season_label.slice(0, 4));
        season = { id: uuidv7() };
        await c.query("INSERT INTO season(id, club_id, label, starts_on, ends_on) VALUES ($1,$2,$3,$4,$5)", [season.id, club.id, b.season_label, `${y}-07-01`, `${y + 1}-06-30`]);
      }
      const id = uuidv7();
      await c.query(`INSERT INTO team(id, club_id, season_id, name, category, is_youth, pitch_length_m, pitch_width_m) VALUES ($1,$2,$3,$4,$5,false,$6,$7)`,
        [id, club.id, season.id, b.name, b.category, b.pitch_length_m ?? 105, b.pitch_width_m ?? 68]);
      await c.query("INSERT INTO team_membership(id, team_id, user_id, role, accepted_at) VALUES ($1,$2,$3,'HEAD_COACH', now())", [uuidv7(), id, u.id]);
      await c.query("INSERT INTO competition(id, team_id, name, season_id) VALUES ($1,$2,$3,$4)", [uuidv7(), id, b.competition ?? "Liga", season.id]);
      return { id, name: b.name, category: b.category, season: b.season_label };
    });
    return reply.status(201).send(team);
  });

  app.get<{ Params: { id: string } }>("/teams/:id", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    const t = await one(db, `SELECT t.id, t.name, t.category, t.pitch_length_m::float AS pitch_length_m, t.pitch_width_m::float AS pitch_width_m, s.label AS season
      FROM team t JOIN season s ON s.id = t.season_id WHERE t.id = $1`, [req.params.id]);
    if (!t) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
    return t;
  });
}
