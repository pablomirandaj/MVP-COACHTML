// Lectura de datos del dominio en el formato que espera @fcs/engine.
import type { Player as EnginePlayer, EngineContext, LineupDoc } from "@fcs/engine";
import { many, one, type Db, type Tx } from "./db";
import { normalizeName } from "./util";

export interface PlayerDto {
  id: string; first_name: string; last_name: string; nickname: string | null; shirt_number: number | null;
  primary_position: string; secondary_positions: string[]; dominant_foot: "RIGHT" | "LEFT" | "BOTH";
  height_cm: number | null; attributes: Record<string, number>; setpiece_roles: string[];
  status: EnginePlayer["status"]; status_note: string | null; coach_notes: string | null;
}

export async function listPlayers(c: Tx | Db, teamId: string): Promise<PlayerDto[]> {
  return many<PlayerDto>(c, `
    SELECT p.id, p.first_name, p.last_name, p.nickname, p.shirt_number, p.dominant_foot, p.height_cm, p.status, p.status_note, p.coach_notes,
      COALESCE((SELECT position FROM player_position pp WHERE pp.player_id = p.id AND pp.is_primary), 'CM') AS primary_position,
      COALESCE((SELECT array_agg(position ORDER BY rank) FROM player_position pp WHERE pp.player_id = p.id AND NOT pp.is_primary), '{}') AS secondary_positions,
      COALESCE((SELECT jsonb_object_agg(key, value) FROM player_attribute pa WHERE pa.player_id = p.id), '{}'::jsonb) AS attributes,
      COALESCE((SELECT array_agg(role_key ORDER BY role_key) FROM player_setpiece_role ps WHERE ps.player_id = p.id), '{}') AS setpiece_roles
    FROM player p WHERE p.team_id = $1 AND p.deleted_at IS NULL
    ORDER BY p.shirt_number NULLS LAST, p.first_name`, [teamId]);
}

export function toEnginePlayer(p: PlayerDto): EnginePlayer {
  return {
    id: p.id, n: p.shirt_number ?? undefined, name: p.nickname || p.first_name, surname: p.last_name || undefined,
    pos: p.primary_position, secondary: p.secondary_positions, foot: p.dominant_foot, height: p.height_cm ?? undefined,
    tags: Object.entries(p.attributes).filter(([, v]) => v > 0).map(([k]) => k).sort(), setpiece: p.setpiece_roles, status: p.status,
  };
}

export async function teamContext(c: Tx | Db, teamId: string, matchId?: string | null): Promise<EngineContext> {
  const t = await one<{ l: number; w: number }>(c, "SELECT pitch_length_m::float AS l, pitch_width_m::float AS w FROM team WHERE id = $1", [teamId]);
  const roster = (await listPlayers(c, teamId)).map(toEnginePlayer);
  let lineupPlayerIds: string[] | undefined;
  if (matchId) {
    const ids = await many<{ player_id: string }>(c,
      `SELECT a.player_id FROM lineup l JOIN lineup_assignment a ON a.lineup_id = l.id WHERE l.match_id = $1 AND l.is_primary AND l.deleted_at IS NULL`, [matchId]);
    if (ids.length) lineupPlayerIds = ids.map((r) => r.player_id);
  }
  return { pitch: { length_m: t?.l ?? 105, width_m: t?.w ?? 68 }, roster, lineupPlayerIds };
}

/** Clave fonética española para el emparejamiento de nombres (docs/16 §6.1). */
export function phoneticKey(name: string): string {
  return normalizeName(name)
    .replace(/ll/g, "y").replace(/v/g, "b").replace(/h/g, "").replace(/qu/g, "k").replace(/c([ei])/g, "s$1")
    .replace(/z/g, "s").replace(/g([ei])/g, "j$1").replace(/c/g, "k").replace(/(.)\1+/g, "$1");
}

export interface LineupRow { id: string; match_id: string; formation: string; revision: number; doc: LineupDoc; state: string }

export async function loadPrimaryLineup(c: Tx | Db, matchId: string): Promise<LineupRow | null> {
  const l = await one<{ id: string; match_id: string; code: string; revision: number; slot_overrides: any; state: string }>(c,
    `SELECT l.id, l.match_id, f.code, l.revision, l.slot_overrides, l.state FROM lineup l JOIN formation f ON f.id = l.formation_id
     WHERE l.match_id = $1 AND l.is_primary AND l.deleted_at IS NULL`, [matchId]);
  if (!l) return null;
  const rows = await many<{ slot: string; player_id: string; provenance: string }>(c, "SELECT slot, player_id, provenance FROM lineup_assignment WHERE lineup_id = $1", [l.id]);
  const { emptyLineup } = await import("@fcs/engine");
  const doc = emptyLineup(l.code);
  for (const r of rows) { doc.slots[r.slot] = r.player_id; doc.slot_provenance[r.slot] = r.provenance; }
  doc.overrides = l.slot_overrides ?? {};
  return { id: l.id, match_id: l.match_id, formation: l.code, revision: l.revision, doc, state: l.state };
}

/** Devuelve el id de la formación del catálogo (la crea la primera vez). */
export async function formationId(c: Tx | Db, code: string): Promise<string> {
  const f = await one<{ id: string }>(c, "SELECT id FROM formation WHERE team_id IS NULL AND code = $1", [code]);
  if (f) return f.id;
  const { FORMATIONS } = await import("@fcs/engine");
  const def = FORMATIONS[code];
  if (!def) throw new Error(`Formación desconocida: ${code}`);
  const { uuidv7 } = await import("./util");
  const id = uuidv7();
  await c.query("INSERT INTO formation(id, team_id, code, label, slots) VALUES ($1, NULL, $2, $3, $4) ON CONFLICT DO NOTHING", [id, code, def.label, JSON.stringify(def.slots)]);
  return (await one<{ id: string }>(c, "SELECT id FROM formation WHERE team_id IS NULL AND code = $1", [code]))!.id;
}
