// Saque de banda a favor (Pizarra Studio §6.1).
// LONG: mismo planificador que el córner con el balón en la banda; balón al primer palo, peinada y bloqueo.
// SHORT: tercer hombre. Apoyo corto, devolución al lanzador y pase a la espalda del lateral (pases encadenados).
import { CATALOG_VERSION, ENGINE_VERSION, template } from "../catalog/index";
import { resolveZone, toN } from "../geometry";
import type { Actor, Command, EngineContext, M, Movement, MovementType, PlayDoc, Relation, Role, Side } from "../types";
import { lexOptimalAssignment } from "../util/assignment";
import { clamp } from "../util/num";
import { derive } from "./derive";
import { CORNER_GEOMETRY, planSetPiece, suitability, type PlanResult, type SetPieceGeometry } from "./plan";
import { validatePlay } from "./validate";

const touch = (side: Side, W: number) => (side === "LEFT" ? 0 : W);
const inward = (side: Side) => (side === "LEFT" ? 1 : -1);
const distanceOf = (create: Command, tplId: string) => {
  const p = template(tplId).params.distance_m;
  return clamp(Number(create.distance_m ?? p.default), p.min, p.max);
};

const LONG_GEOMETRY: SetPieceGeometry = {
  ...CORNER_GEOMETRY,
  type: "THROW_IN_ATT", templateId: "THR_ATT_LONG", takerRule: "RULE:THR-POS-01",
  ball(side, pitch, create) { return { x: pitch.length_m - distanceOf(create, "THR_ATT_LONG"), y: touch(side, pitch.width_m) }; },
  taker(ball, side) { return { x: ball.x, y: ball.y - inward(side) * 0.3 }; },
};

export function createThrowIn(cmds: Command[], ctx: EngineContext): PlanResult {
  const create = cmds.find((c) => c.op === "play.create");
  if (!create || create.type !== "THROW_IN_ATT") throw new Error("createThrowIn necesita play.create {type: THROW_IN_ATT}");
  if (create.variant === "SHORT") return createShortThrow(create, cmds, ctx);
  const explicit = cmds.some((c) => c.op === "play.relation" || c.op === "play.add_roles");
  const defaults: Command[] = explicit ? [] : [
    { op: "play.add_roles", count: 1, role: "PRIMARY_TARGET", zone: "Z_NEAR_POST", group_id: "thr_p" },
    { op: "play.add_roles", count: 1, role: "BLOCKER", group_id: "thr_b" },
    { op: "play.relation", type: "SCREENS", blocker: { group: "thr_b", index: 0 }, beneficiary: { group: "thr_p", index: 0 } },
  ];
  const delivery: Command = { op: "play.set_delivery", swing: "NONE", trajectory: "LOFTED", target_zone: "Z_NEAR_POST" };
  const userDelivery = cmds.filter((c) => c.op === "play.set_delivery");
  return planSetPiece([create, ...defaults, delivery, ...cmds.filter((c) => c !== create && c.op !== "play.set_delivery"), ...userDelivery], ctx, LONG_GEOMETRY);
}

function createShortThrow(create: Command, cmds: Command[], ctx: EngineContext): PlanResult {
  const side: Side = create.side ?? "LEFT";
  const pitch = ctx.pitch, L = pitch.length_m, W = pitch.width_m, s = inward(side), y0 = touch(side, W);
  const x = L - distanceOf(create, "THR_ATT_SHORT");
  const yIn = (d: number) => y0 + s * d;
  const RULE = "RULE:TPL-THR_ATT_SHORT";

  // Puestos y jugadores (misma idoneidad que el resto de balón parado; el lanzador puede fijarse con play.set_taker).
  const roles: { role: Role; key: string }[] = [
    { role: "TAKER", key: "T" }, { role: "SHORT_RECEIVER", key: "S" }, { role: "PRIMARY_TARGET", key: "R" },
    { role: "SECONDARY_TARGET", key: "B1" }, { role: "SECONDARY_TARGET", key: "B2" },
    { role: "REST_DEFENDER", key: "D1" }, { role: "REST_DEFENDER", key: "D2" },
  ];
  const fixedTaker = cmds.find((c) => c.op === "play.set_taker")?.player as string | undefined;
  const player = (id: string) => ctx.roster.find((p) => p.id === id)!;
  const poolIds = (ctx.lineupPlayerIds ?? ctx.roster.filter((p) => p.status === "AVAILABLE").map((p) => p.id))
    .filter((id) => player(id) && player(id).pos !== "GK" && id !== fixedTaker);
  const pool = poolIds.map(player).sort((a, b) => (a.n ?? 999) - (b.n ?? 999) || a.id.localeCompare(b.id));
  const open = roles.filter((r) => !(r.role === "TAKER" && fixedTaker));
  const score = open.map((r) => [...pool.map((p) => suitability(r.role, p, side)), ...open.map(() => 0)]);
  const cols = lexOptimalAssignment(score);
  const assigned = new Map<string, string | null>(roles.map((r) => [r.key, r.role === "TAKER" && fixedTaker ? fixedTaker : null]));
  open.forEach((r, i) => { if (cols[i] < pool.length) assigned.set(r.key, pool[cols[i]].id); });

  const pen = resolveZone("Z_PEN_SPOT", side, pitch).anchors[0], far = resolveZone("Z_FAR_POST", side, pitch).anchors[0];
  const start: Record<string, M> = {
    T: { x, y: y0 - s * 0.3 }, S: { x: x - 2, y: yIn(6) }, R: { x: x - 6, y: yIn(15) },
    B1: pen, B2: far, D1: { x: x - 25, y: W / 2 - 8 }, D2: { x: x - 25, y: W / 2 + 8 },
  };
  const ends: Partial<Record<string, { to: M; type: MovementType; offset: number }>> = {
    T: { to: { x: x + 1.5, y: yIn(3.5) }, type: "CHECK_TO_BALL", offset: 0.3 },
    R: { to: { x: Math.min(L - 8, x + 14), y: yIn(5) }, type: "RUN_IN_BEHIND", offset: 0.9 },
  };
  const ids = new Map(roles.map((r, i) => [r.key, `a${i + 1}`]));
  const actors: Actor[] = roles.map((r) => {
    const pid = assigned.get(r.key) ?? null, p = pid ? player(pid) : undefined;
    return {
      id: ids.get(r.key)!, team: "OWN", player_id: pid, label: p?.n ? String(p.n) : r.role.slice(0, 2), role: r.role,
      start: toN(start[r.key], pitch),
      provenance: { role: RULE, player_id: r.role === "TAKER" && fixedTaker ? "EXPLICIT" : "RULE:ASG-01", start: r.role === "TAKER" ? "RULE:THR-POS-01" : RULE },
    };
  });
  const movements: Movement[] = roles.map((r) => {
    const e = ends[r.key];
    return e
      ? { id: `m${ids.get(r.key)!.slice(1)}`, actor: ids.get(r.key)!, type: e.type, path: [toN(start[r.key], pitch), toN(e.to, pitch)], shape: "STRAIGHT",
          anchor: { kind: "STARTS_AT", event: "KICK", offset_s: e.offset }, t_start: 0, t_end: 0, provenance: { type: RULE } }
      : { id: `m${ids.get(r.key)!.slice(1)}`, actor: ids.get(r.key)!, type: "HOLD", path: [toN(start[r.key], pitch)], t_start: 0, t_end: 0, provenance: { type: RULE } };
  });

  // Rivales: su lateral sigue al tercer hombre, un extremo presiona el apoyo, un medio vigila la devolución.
  const opp: { role: Role; at: M; label: string; marks?: string }[] = [
    { role: "GOALKEEPER", at: { x: L - 1, y: W / 2 }, label: "P" },
    { role: "MAN_MARKER", at: { x: start.R.x + 1.5, y: start.R.y - s * 1 }, label: "LAT", marks: ids.get("R") },
    { role: "MAN_MARKER", at: { x: start.S.x + 1.2, y: start.S.y + s * 1.5 }, label: "EXT", marks: ids.get("S") },
    { role: "ZONAL_DEFENDER", at: { x: x + 5, y: yIn(11) }, label: "MC" },
    { role: "ZONAL_DEFENDER", at: { x: L - 14, y: W / 2 - 5 }, label: "DFC" },
    { role: "ZONAL_DEFENDER", at: { x: L - 14, y: W / 2 + 5 }, label: "DFC" },
    { role: "COUNTER_OUTLET", at: { x: x - 12, y: W / 2 }, label: "C" },
  ];
  const relations: Relation[] = [];
  opp.forEach((o, i) => {
    const id = `o${i + 1}`;
    actors.push({ id, team: "OPP", label: o.label, role: o.role, start: toN(o.at, pitch), provenance: { start: RULE } });
    movements.push({ id: `m${id}`, actor: id, type: o.marks ? "FOLLOW" : "HOLD", path: [toN(o.at, pitch)], t_start: 0, t_end: 0, provenance: { type: RULE } });
    if (o.marks) relations.push({ type: "MARKS", a: id, b: o.marks, origin: RULE });
  });

  let doc: PlayDoc = {
    schema: "fcs.play/1", engine_version: ENGINE_VERSION, catalog_version: CATALOG_VERSION, template: "THR_ATT_SHORT",
    type: "THROW_IN_ATT", side, pitch,
    delivery: {
      taker_actor: ids.get("T")!, ball_start: toN({ x, y: y0 }, pitch), swing: "NONE", trajectory: "SHORT", technique: "INSIDE_FOOT",
      target_zone: "Z_SHORT", target_point: toN(start.S, pitch), curve: 0, kick_t: 0, arrival_t: 0,
      provenance: { swing: RULE, trajectory: RULE, target_zone: RULE, ball_start: "RULE:THR-POS-01" },
    },
    passes: [
      { id: "p1", from: ids.get("S")!, to: ids.get("T")!, t_start: 0, t_end: 0, origin: RULE },
      { id: "p2", from: ids.get("T")!, to: ids.get("R")!, t_start: 0, t_end: 0, origin: RULE },
    ],
    actors, movements, relations, constraints: [], notes: [], diagnostics: [],
  };
  doc = derive(doc);
  doc.diagnostics = validatePlay(doc, ctx);
  return { doc, clarifications: [], diagnostics: doc.diagnostics };
}
