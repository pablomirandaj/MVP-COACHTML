import type { FastifyInstance } from "fastify";
import { noContent, requireStaff, requireUser, teamOf } from "../app";
import { one, tx, type Tx } from "../db";
import { listPlayers, phoneticKey, type PlayerDto } from "../repo";
import { HttpError, uuidv7 } from "../util";

const POSITIONS = ["GK", "RB", "LB", "RWB", "LWB", "CB", "DM", "CM", "RM", "LM", "AM", "RW", "LW", "ST", "SS"];
const playerBody = {
  type: "object",
  properties: {
    first_name: { type: "string", minLength: 1, maxLength: 60 }, last_name: { type: "string", maxLength: 80 }, nickname: { type: ["string", "null"], maxLength: 40 },
    shirt_number: { type: ["integer", "null"], minimum: 1, maximum: 99 }, primary_position: { enum: POSITIONS },
    secondary_positions: { type: "array", maxItems: 3, items: { enum: POSITIONS } }, dominant_foot: { enum: ["RIGHT", "LEFT", "BOTH"] },
    height_cm: { type: ["integer", "null"], minimum: 120, maximum: 220 },
    attributes: { type: "object", additionalProperties: { type: "integer", minimum: 0, maximum: 5 } },
    setpiece_roles: { type: "array", items: { type: "string", maxLength: 40 } },
    status: { enum: ["AVAILABLE", "INJURED", "SUSPENDED", "UNAVAILABLE", "DOUBTFUL"] },
    status_note: { type: ["string", "null"], maxLength: 200 }, coach_notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

async function writeExtras(c: Tx, id: string, b: Partial<PlayerDto>) {
  if (b.primary_position || b.secondary_positions) {
    const cur = await one<{ position: string }>(c, "SELECT position FROM player_position WHERE player_id = $1 AND is_primary", [id]);
    const primary = b.primary_position ?? cur?.position ?? "CM";
    const secondary = (b.secondary_positions ?? (await c.query("SELECT position FROM player_position WHERE player_id = $1 AND NOT is_primary ORDER BY rank", [id])).rows.map((r) => r.position))
      .filter((p: string) => p !== primary);
    await c.query("DELETE FROM player_position WHERE player_id = $1", [id]);
    await c.query("INSERT INTO player_position(player_id, position, is_primary, rank) VALUES ($1,$2,true,0)", [id, primary]);
    for (const [i, p] of secondary.entries()) await c.query("INSERT INTO player_position(player_id, position, is_primary, rank) VALUES ($1,$2,false,$3)", [id, p, i + 1]);
  }
  if (b.attributes) {
    await c.query("DELETE FROM player_attribute WHERE player_id = $1", [id]);
    for (const [k, v] of Object.entries(b.attributes)) if (v > 0) await c.query("INSERT INTO player_attribute(player_id, key, value) VALUES ($1,$2,$3)", [id, k, v]);
  }
  if (b.setpiece_roles) {
    await c.query("DELETE FROM player_setpiece_role WHERE player_id = $1", [id]);
    for (const r of new Set(b.setpiece_roles)) await c.query("INSERT INTO player_setpiece_role(player_id, role_key) VALUES ($1,$2)", [id, r]);
  }
}

const shirtTaken = (e: any) => e?.code === "23505" && String(e?.constraint).includes("player_shirt_uq");

export async function playerRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.get<{ Params: { id: string } }>("/teams/:id/players", async (req) => {
    const u = requireUser(req);
    await requireStaff(db, u.id, req.params.id);
    return listPlayers(db, req.params.id);
  });

  app.post<{ Params: { id: string }; Body: Partial<PlayerDto> }>("/teams/:id/players", {
    schema: { body: { ...playerBody, required: ["first_name", "primary_position"] } },
  }, async (req, reply) => {
    const u = requireUser(req);
    const b = req.body;
    const id = uuidv7();
    try {
      await tx(db, u.id, async (c) => {
        await requireStaff(c, u.id, req.params.id);
        const name = `${b.first_name} ${b.last_name ?? ""} ${b.nickname ?? ""}`;
        await c.query(`INSERT INTO player(id, team_id, first_name, last_name, nickname, shirt_number, dominant_foot, height_cm, status, status_note, coach_notes, phonetic_key)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, req.params.id, b.first_name, b.last_name ?? "", b.nickname ?? null, b.shirt_number ?? null, b.dominant_foot ?? "RIGHT", b.height_cm ?? null,
            b.status ?? "AVAILABLE", b.status_note ?? null, b.coach_notes ?? null, phoneticKey(name)]);
        await writeExtras(c, id, b);
        await c.query("INSERT INTO audit_log(actor_id, team_id, action, entity, entity_id, via) VALUES ($1,$2,'player.create','player',$3,'UI')", [u.id, req.params.id, id]);
      });
    } catch (e) {
      if (shirtTaken(e)) throw new HttpError(409, "SHIRT_TAKEN", `El dorsal ${b.shirt_number} ya está asignado.`);
      throw e;
    }
    return reply.status(201).send((await listPlayers(db, req.params.id)).find((p) => p.id === id));
  });

  app.patch<{ Params: { id: string }; Body: Partial<PlayerDto> & { via?: string } }>("/players/:id", {
    schema: { body: { ...playerBody, properties: { ...playerBody.properties, via: { enum: ["UI", "ASSISTANT", "CLARIFICATION"] } } } },
  }, async (req) => {
    const u = requireUser(req);
    const b = req.body;
    let teamId = "";
    try {
      await tx(db, u.id, async (c) => {
        teamId = await teamOf(c, u.id, "player", req.params.id);
        const before = await one(c, "SELECT dominant_foot, shirt_number, status FROM player WHERE id = $1", [req.params.id]);
        const cols: [string, unknown][] = [];
        for (const k of ["first_name", "last_name", "nickname", "shirt_number", "dominant_foot", "height_cm", "status", "status_note", "coach_notes"] as const)
          if (k in b) cols.push([k, (b as any)[k]]);
        if (cols.length) {
          const set = cols.map(([k], i) => `${k} = $${i + 2}`).join(", ");
          await c.query(`UPDATE player SET ${set}, updated_at = now() WHERE id = $1`, [req.params.id, ...cols.map(([, v]) => v)]);
          const p = await one<{ first_name: string; last_name: string; nickname: string | null }>(c, "SELECT first_name, last_name, nickname FROM player WHERE id = $1", [req.params.id]);
          await c.query("UPDATE player SET phonetic_key = $2 WHERE id = $1", [req.params.id, phoneticKey(`${p!.first_name} ${p!.last_name} ${p!.nickname ?? ""}`)]);
        }
        await writeExtras(c, req.params.id, b);
        await c.query("INSERT INTO audit_log(actor_id, team_id, action, entity, entity_id, diff, via) VALUES ($1,$2,'player.update','player',$3,$4,$5)",
          [u.id, teamId, req.params.id, JSON.stringify({ before, after: Object.fromEntries(cols.filter(([k]) => k !== "coach_notes")) }), b.via ?? "UI"]);
      });
    } catch (e) {
      if (shirtTaken(e)) throw new HttpError(409, "SHIRT_TAKEN", `El dorsal ${b.shirt_number} ya está asignado.`);
      throw e;
    }
    return (await listPlayers(db, teamId)).find((p) => p.id === req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/players/:id", async (req, reply) => {
    const u = requireUser(req);
    await tx(db, u.id, async (c) => {
      const teamId = await teamOf(c, u.id, "player", req.params.id);
      await c.query("UPDATE player SET deleted_at = now() WHERE id = $1", [req.params.id]);
      await c.query("INSERT INTO audit_log(actor_id, team_id, action, entity, entity_id, via) VALUES ($1,$2,'player.delete','player',$3,'UI')", [u.id, teamId, req.params.id]);
    });
    return noContent(reply);
  });
}
