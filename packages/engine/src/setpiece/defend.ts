// Balón parado en contra (Pizarra Studio §6.1): córner y falta lateral del rival.
// La portería que defendemos se dibuja a la derecha (x = L), con las mismas zonas que el balón parado ofensivo.
// El ataque rival es genérico (plantilla OPP_SETPIECE_ATT); nuestras marcas se asignan con el algoritmo húngaro.
import { CATALOG_VERSION, ENGINE_VERSION, MIN_SPACING_M, MOVEMENTS, template } from "../catalog/index";
import { add, placeInZone, resolveZone, toN, type ResolvedZone } from "../geometry";
import type { Actor, Command, EngineContext, M, Movement, MovementType, PlayDoc, Relation, Role, Side, ZoneId } from "../types";
import { lexOptimalAssignment } from "../util/assignment";
import { derive } from "./derive";
import { FREE_KICK_WIDE_GEOMETRY, offsideLine } from "./freekick";
import { CORNER_GEOMETRY, suitability, type PlanResult } from "./plan";
import { validatePlay } from "./validate";

type Scheme = "ZONAL" | "MAN" | "MIXED";
const END_ZONE: Record<string, ZoneId> = {
  ATTACK_NEAR_POST: "Z_NEAR_POST", ATTACK_FAR_POST: "Z_FAR_POST", ATTACK_PEN_SPOT: "Z_PEN_SPOT", ATTACK_GA_CENTER: "Z_GA_CENTER", LATE_ARRIVAL: "Z_FAR_ZONE",
};

interface SlotSpec { role: Role; at: M; marks?: string; priority: number }

export function createDefensiveSetPiece(cmds: Command[], ctx: EngineContext): PlanResult {
  const create = cmds.find((c) => c.op === "play.create");
  if (!create || (create.type !== "CORNER_DEF" && create.type !== "FK_WIDE_DEF")) throw new Error("createDefensiveSetPiece necesita play.create {type: CORNER_DEF | FK_WIDE_DEF}");
  const isFK = create.type === "FK_WIDE_DEF";
  const side: Side = create.side ?? "LEFT";
  const scheme: Scheme = isFK ? "MIXED" : (create.scheme ?? "MIXED");
  const tplId = isFK ? "FK_DEF_STANDARD" : `CRN_DEF_${scheme}`;
  const tpl = template(tplId);
  const RULE = `RULE:TPL-${tplId}`, RULE_OPP = "RULE:TPL-OPP_SETPIECE_ATT";
  const pitch = ctx.pitch, L = pitch.length_m, W = pitch.width_m;
  const ns = side === "LEFT" ? -1 : 1; // el primer palo está del lado del saque
  const geo = isFK ? FREE_KICK_WIDE_GEOMETRY : CORNER_GEOMETRY;
  const ball = geo.ball(side, pitch, create), takerAt = geo.taker(ball, side, pitch);
  const xOff = isFK ? offsideLine(ball, pitch, create) : undefined;

  // ---- Ataque rival ----------------------------------------------------------------------
  const actors: Actor[] = [], movements: Movement[] = [], relations: Relation[] = [];
  const opp = (role: Role, at: M, label: string, run?: { type: MovementType; to: M }) => {
    const id = `o${actors.filter((a) => a.team === "OPP").length + 1}`;
    actors.push({ id, team: "OPP", label, role, start: toN(at, pitch), provenance: { start: RULE_OPP } });
    const def = run ? MOVEMENTS[run.type] : undefined;
    movements.push(run
      ? { id: `m${id}`, actor: id, type: run.type, path: [toN(at, pitch), toN(run.to, pitch)], shape: "STRAIGHT",
          anchor: { kind: "ARRIVES_AT", event: "BALL_ARRIVAL", offset_s: def?.anchor?.event === "BALL_ARRIVAL" ? def.anchor.offset_s : 0, ...(isFK ? { not_before_s: 0 } : {}) },
          t_start: 0, t_end: 0, provenance: { type: RULE_OPP } }
      : { id: `m${id}`, actor: id, type: "HOLD", path: [toN(at, pitch)], t_start: 0, t_end: 0, provenance: { type: RULE_OPP } });
    return id;
  };
  const taker = opp("TAKER", takerAt, "L");
  const startZone: ResolvedZone = isFK
    ? { id: "Z_START_CLUSTER", x: [xOff! - 2.5, xOff! - 0.5], y: [W / 2 - 9, W / 2 + 9], anchors: [-6, -2, 2, 6, 9].map((dy) => ({ x: xOff! - 1, y: W / 2 + dy })) }
    : resolveZone("Z_START_CLUSTER", side, pitch);
  const occ: M[] = [], endOcc: M[] = [];
  const attackers: { id: string; end: M }[] = [];
  (template("OPP_SETPIECE_ATT").box_runs as MovementType[]).forEach((type, i) => {
    const at = placeInZone(startZone, occ, MIN_SPACING_M); occ.push(at);
    const end = placeInZone(resolveZone(END_ZONE[type], side, pitch), endOcc, MIN_SPACING_M); endOcc.push(end);
    attackers.push({ id: opp(i === 0 ? "PRIMARY_TARGET" : "SECONDARY_TARGET", at, `R${i + 1}`, { type, to: end }), end });
  });
  opp("REBOUND", resolveZone("Z_EDGE", side, pitch).anchors[0], "F");
  opp("REST_DEFENDER", { x: L - 55, y: W / 2 - 10 }, "A");
  opp("REST_DEFENDER", { x: L - 55, y: W / 2 + 10 }, "A");

  // ---- Nuestros puestos por prioridad ----------------------------------------------------
  const slots: SlotSpec[] = [];
  const zonal: [number, number][] = (tpl.zonal ?? []) as [number, number][];
  if (zonal[0]) slots.push({ role: "ZONAL_DEFENDER", at: { x: L - zonal[0][0], y: W / 2 + ns * zonal[0][1] }, priority: 0 });
  if (isFK) for (let i = 0; i < tpl.wall.players; i++) {
    const near: M = { x: L, y: W / 2 + ns * 3.66 };
    const d = { x: near.x - ball.x, y: near.y - ball.y }, n = Math.hypot(d.x, d.y);
    const a = 0.8 / tpl.wall.distance_m * i * -ns;
    const u = { x: (d.x / n) * Math.cos(a) - (d.y / n) * Math.sin(a), y: (d.x / n) * Math.sin(a) + (d.y / n) * Math.cos(a) };
    slots.push({ role: "WALL", at: add(ball, { x: u.x * tpl.wall.distance_m, y: u.y * tpl.wall.distance_m }), priority: 1 });
  }
  if (tpl.markers === "all_box_attackers")
    attackers.forEach((at, i) => {
      const s = actors.find((a) => a.id === at.id)!.start;
      slots.push({ role: "MAN_MARKER", at: { x: Math.min(s.u * L + 1, xOff !== undefined ? xOff + 0.5 : L), y: s.v * W }, marks: at.id, priority: 2 + i });
    });
  zonal.slice(1).forEach(([dx, dy], i) => slots.push({ role: "ZONAL_DEFENDER", at: { x: L - dx, y: W / 2 + ns * dy }, priority: 10 + i }));
  let lineN = 0, coverN = 0;
  (tpl.extra as string[]).forEach((e, i) => {
    const pr = 20 + i;
    if (e === "EDGE_GUARD") slots.push({ role: "EDGE_GUARD", at: { x: L - 19, y: W / 2 - ns * 2 }, priority: pr });
    else if (e === "POST_GUARD") slots.push({ role: "POST_GUARD", at: { x: L - 9, y: side === "LEFT" ? 9 : W - 9 }, priority: pr });
    else if (e === "COUNTER_OUTLET") slots.push({ role: "COUNTER_OUTLET", at: { x: L - 45, y: W / 2 + ns * 8 }, priority: pr });
    else if (e === "COVER") slots.push({ role: "COVER", at: { x: L - 8, y: W / 2 + (coverN++ ? 6 : -6) }, priority: pr });
    else if (e === "ZONAL_LINE") slots.push({ role: "ZONAL_DEFENDER", at: { x: xOff! + 0.5, y: W / 2 + (lineN++ ? 10 : -10) }, priority: pr });
  });

  // ---- Jugadores -------------------------------------------------------------------------
  const player = (id: string) => ctx.roster.find((p) => p.id === id);
  const ids = (ctx.lineupPlayerIds ?? ctx.roster.filter((p) => p.status === "AVAILABLE").map((p) => p.id)).filter((id) => player(id));
  const gk = ids.map(player).find((p) => p!.pos === "GK");
  const pool = ids.map(player).filter((p) => p && p !== gk).sort((a, b) => (a!.n ?? 999) - (b!.n ?? 999) || a!.id.localeCompare(b!.id)) as NonNullable<ReturnType<typeof player>>[];
  const used = slots.sort((a, b) => a.priority - b.priority).slice(0, pool.length);
  const cols = lexOptimalAssignment(used.map((s) => [...pool.map((p) => suitability(s.role, p, side)), ...used.map(() => 0)]));

  const ownActor = (role: Role, at: M, pid: string | null, origin: string) => {
    const id = `a${actors.filter((a) => a.team === "OWN").length + 1}`;
    const p = pid ? player(pid) : undefined;
    actors.push({ id, team: "OWN", player_id: pid, label: p?.n ? String(p.n) : role.slice(0, 2), role, start: toN(at, pitch), provenance: { role: origin, player_id: "RULE:ASG-01", start: origin } });
    return id;
  };
  if (gk) { const id = ownActor("GOALKEEPER", { x: L - 0.8, y: W / 2 }, gk.id, RULE); movements.push({ id: `m${id}`, actor: id, type: "HOLD", path: [actors.at(-1)!.start], t_start: 0, t_end: 0, provenance: { type: RULE } }); }
  used.forEach((s, i) => {
    const pid = cols[i] < pool.length ? pool[cols[i]].id : null;
    const id = ownActor(s.role, s.at, pid, RULE);
    movements.push({ id: `m${id}`, actor: id, type: s.marks ? "FOLLOW" : "HOLD", path: [toN(s.at, pitch)], t_start: 0, t_end: 0, provenance: { type: RULE } });
    if (s.marks) relations.push({ type: "MARKS", a: id, b: s.marks, origin: RULE });
  });

  let doc: PlayDoc = {
    schema: "fcs.play/1", engine_version: ENGINE_VERSION, catalog_version: CATALOG_VERSION, template: tplId,
    type: create.type, side, pitch,
    delivery: {
      taker_actor: taker, ball_start: toN(ball, pitch), swing: "INSWING", trajectory: "DRIVEN", technique: "INSIDE_FOOT",
      target_zone: "Z_FAR_POST", target_point: toN(attackers[1]?.end ?? attackers[0].end, pitch), curve: 0.18, kick_t: 0, arrival_t: 0,
      provenance: { swing: RULE_OPP, trajectory: RULE_OPP, target_zone: RULE_OPP, ball_start: RULE_OPP },
    },
    actors, movements, relations, constraints: [], notes: [], diagnostics: [],
  };
  doc = derive(doc);
  doc.diagnostics = validatePlay(doc, ctx);
  return { doc, clarifications: [], diagnostics: doc.diagnostics };
}
