// Persistencia de jugadas: versiones inmutables + proyecciones + registro de comandos (docs/12 §6, docs/15 §11).
import { applyPlayCommand, canonicalHash, createSetPiece, ENGINE_VERSION, CATALOG_VERSION, type Clarification, type Command, type Diagnostic, type EngineContext, type PlayDoc } from "@fcs/engine";
import { one, type Tx } from "./db";
import { HttpError, uuidv7 } from "./util";

export const PLAY_EDIT_OPS = new Set(["play.move_actor", "play.shift_timing", "play.adjust_delivery", "play.set_delivery", "play.set_movement", "play.constraint", "play.assign_player", "play.set_taker", "play.remove_actor", "play.mark"]);
export const PLAY_CREATE_OPS = new Set(["play.create", "play.set_taker", "play.set_delivery", "play.add_roles", "play.set_role", "play.relation", "play.constraint", "assert"]);

export interface ApplyOutcome { doc: PlayDoc | null; clarifications: Clarification[]; diagnostics: Diagnostic[]; applied: Command[] }

/** Aplica una lista de comandos de edición sobre un documento; se detiene en la primera aclaración. */
export function applyEdits(doc: PlayDoc, commands: Command[], ctx: EngineContext): ApplyOutcome {
  let cur = doc;
  const applied: Command[] = [];
  for (const cmd of commands) {
    if (!PLAY_EDIT_OPS.has(cmd.op)) throw new HttpError(422, "VALIDATION_ERROR", `Operación no válida para editar una jugada: ${cmd.op}`);
    const r = applyPlayCommand(cur, cmd, ctx);
    if (r.clarifications.length) return { doc: cur, clarifications: r.clarifications, diagnostics: cur.diagnostics, applied };
    cur = r.doc;
    applied.push(cmd);
  }
  return { doc: cur, clarifications: [], diagnostics: cur.diagnostics, applied };
}

export function planPlay(commands: Command[], ctx: EngineContext): ApplyOutcome {
  for (const c of commands) if (!PLAY_CREATE_OPS.has(c.op)) throw new HttpError(422, "VALIDATION_ERROR", `Operación no válida para crear una jugada: ${c.op}`);
  const create = commands.find((c) => c.op === "play.create");
  if (!create) throw new HttpError(422, "VALIDATION_ERROR", "Falta play.create.");
  const r = createSetPiece(commands, ctx);
  const unsupported = r.diagnostics.find((d) => d.rule_id === "UNSUPPORTED-01");
  if (unsupported) throw new HttpError(422, "NOT_SUPPORTED", unsupported.message);
  return { doc: r.doc, clarifications: r.clarifications, diagnostics: r.diagnostics, applied: r.doc ? commands : [] };
}

export async function insertVersion(c: Tx, playId: string, version: number, parent: number | null, doc: PlayDoc, userId: string) {
  await c.query(`INSERT INTO tactical_play_version(play_id, version, document, document_hash, engine_version, catalog_version, parent_version, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [playId, version, JSON.stringify(doc), canonicalHash(doc), ENGINE_VERSION, CATALOG_VERSION, parent, userId]);
  for (const a of doc.actors)
    await c.query("INSERT INTO tactical_role(play_id, version, actor_id, team_side, role, player_id, provenance) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [playId, version, a.id, a.team, a.role, a.player_id ?? null, String(a.provenance.role ?? "")]);
  for (const m of doc.movements)
    await c.query("INSERT INTO tactical_movement(play_id, version, movement_id, actor_id, type, t_start, t_end) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [playId, version, m.id, m.actor, m.type, m.t_start, m.t_end]);
  await c.query("UPDATE tactical_play SET current_version = $2, updated_at = now() WHERE id = $1", [playId, version]);
}

export async function logCommands(c: Tx, teamId: string, playId: string, from: number | null, to: number, userId: string, commands: Command[], source: string, status = "APPLIED") {
  await c.query(`INSERT INTO parsed_command(id, team_id, nlu_version, ir, status, target_type, target_id, version_from, version_to, applied_by, applied_at, source)
    VALUES ($1,$2,'n/a',$3,$4,'TACTICAL_PLAY',$5,$6,$7,$8,now(),$9)`, [uuidv7(), teamId, JSON.stringify({ commands }), status, playId, from, to, userId, source]);
}

export async function currentDoc(c: Tx, playId: string): Promise<{ version: number; doc: PlayDoc; team_id: string; match_id: string | null }> {
  const r = await one<{ version: number; document: PlayDoc; team_id: string; match_id: string | null }>(c,
    `SELECT v.version, v.document, p.team_id, (SELECT match_id FROM match_play mp WHERE mp.play_id = p.id LIMIT 1) AS match_id
     FROM tactical_play p JOIN tactical_play_version v ON v.play_id = p.id AND v.version = p.current_version WHERE p.id = $1 AND p.deleted_at IS NULL`, [playId]);
  if (!r) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
  return { version: r.version, doc: r.document, team_id: r.team_id, match_id: r.match_id };
}
