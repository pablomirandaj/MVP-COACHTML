// Falta lateral a favor (Pizarra Studio §6.1): mismo planificador que el córner (planSetPiece) con su propia
// geometría: balón a depth_m de la línea de fondo y distance_m de la banda, línea de fuera de juego del rival,
// barrera de 2 a 9,15 m y carreras que no arrancan antes del golpeo.
import { MIN_SPACING_M, template } from "../catalog/index";
import { add, dist, placeInZone, resolveZone, scale, sub, unit, type ResolvedZone } from "../geometry";
import type { Command, EngineContext, M, Role } from "../types";
import { clamp } from "../util/num";
import { ATTACKING_ROLES } from "./common";
import { planSetPiece, type GeoEnv, type PlanResult, type SetPieceGeometry } from "./plan";

const TPL = "FK_WIDE_ATT_STANDARD";

function params(create: Command) {
  const t = template(TPL);
  const depth = clamp(Number(create.depth_m ?? t.params.depth_m.default), t.params.depth_m.min, t.params.depth_m.max);
  const wide = clamp(Number(create.distance_m ?? t.params.distance_m.default), t.params.distance_m.min, t.params.distance_m.max);
  return { depth, wide, line: t.offside_line, wall: t.wall };
}

/** Línea de fuera de juego en metros: por delante del balón, sin pasar de 7 m de la portería. */
export function offsideLine(ball: M, pitch: { length_m: number }, create: Command): number {
  const { depth, line } = params(create);
  const gap = clamp(depth * line.gap_ratio, line.min_gap_m, line.max_gap_m);
  return Math.max(ball.x, Math.min(pitch.length_m - line.max_x_from_goal_m, ball.x + gap));
}

const clusterZone = (env: GeoEnv): ResolvedZone => {
  const W = env.pitch.width_m, x = env.xOff! - 1;
  return {
    id: "Z_START_CLUSTER", x: [env.xOff! - 2.5, env.xOff! - 0.5], y: [W / 2 - 9, W / 2 + 9],
    anchors: [-6, -2, 2, 6, -9, 9].map((dy) => ({ x, y: W / 2 + dy })),
  };
};

export const FREE_KICK_WIDE_GEOMETRY: SetPieceGeometry = {
  type: "FK_WIDE_ATT", templateId: TPL, takerRule: "RULE:FK-POS-01",
  runNotBefore: 0,
  ball(side, pitch, create) {
    const { depth, wide } = params(create);
    return { x: pitch.length_m - depth, y: side === "LEFT" ? wide : pitch.width_m - wide };
  },
  taker(ball, side, pitch) {
    return { x: clamp(ball.x - 1.6, 0, pitch.length_m), y: clamp(ball.y + (side === "LEFT" ? -1 : 1), 0.3, pitch.width_m - 0.3) };
  },
  offside(env) { return offsideLine(env.ball, env.pitch, env.create); },
  start(role, _movement, zone, side, occ, env) {
    const p = ATTACKING_ROLES.includes(role)
      ? placeInZone(clusterZone(env), occ, MIN_SPACING_M)
      : placeInZone(resolveZone(zone ?? "Z_REBOUND", side, env.pitch), occ, MIN_SPACING_M);
    return { x: Math.min(p.x, env.xOff! - 0.5), y: p.y };
  },
  opponents(env, primary, secondaries) {
    const { pitch, side, ball } = env;
    const L = pitch.length_m, W = pitch.width_m, xLine = env.xOff! + 0.5;
    const { wall } = params(env.create);
    const nearPost: M = { x: L, y: W / 2 + (side === "LEFT" ? -3.66 : 3.66) };
    const d = unit(sub(nearPost, ball));
    const out: { role: Role; at: M; label: string; marks?: string }[] = [{ role: "GOALKEEPER", at: { x: L - 1, y: W / 2 }, label: "P" }];
    const theta = 0.8 / wall.distance_m * (side === "LEFT" ? 1 : -1);
    const rot = (v: M, a: number): M => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
    for (let i = 0; i < wall.players; i++) out.push({ role: "WALL", at: add(ball, scale(rot(d, theta * i), wall.distance_m)), label: `B${i + 1}` });
    let mN = 0;
    for (const t of [primary, ...secondaries].filter(Boolean).slice(0, 4))
      out.push({ role: "MAN_MARKER", at: { x: Math.min(t!.at.x + 1, xLine), y: t!.at.y }, label: `M${++mN}`, marks: t!.id });
    out.push({ role: "ZONAL_DEFENDER", at: { x: xLine, y: W / 2 - 10 }, label: "Z1" }, { role: "ZONAL_DEFENDER", at: { x: xLine, y: W / 2 + 10 }, label: "Z2" });
    out.push({ role: "COUNTER_OUTLET", at: { x: L - 50, y: W / 2 }, label: "C" });
    return { actors: out.filter((o) => dist(o.at, ball) >= wall.distance_m - 1e-6 || o.role === "WALL") };
  },
};

export function createFreeKickWide(cmds: Command[], ctx: EngineContext): PlanResult {
  const create = cmds.find((c) => c.op === "play.create");
  if (!create || create.type !== "FK_WIDE_ATT") throw new Error("createFreeKickWide necesita play.create {type: FK_WIDE_ATT}");
  return planSetPiece(cmds, ctx, FREE_KICK_WIDE_GEOMETRY);
}
