// Planificador de córners (docs/15 §5–8): comandos IR de creación → documento fcs.play/1.
import { CATALOG_VERSION, ENGINE_VERSION, HEIGHT_NORM, MIN_SPACING_M, MOVEMENTS, ROLES, template } from "../catalog/index";
import { add, catalogPoint, placeInZone as placeAt, resolveZone, toN, type ResolvedZone } from "../geometry";
import type {
  Actor, Clarification, Command, Diagnostic, EngineContext, M, Movement, MovementType, Origin, PlayDoc, Player, Relation,
  Role, Side, Swing, ZoneId,
} from "../types";
import { lexOptimalAssignment } from "../util/assignment";
import { ACTOR_ORDER, ATTACK_FOR_ZONE, ATTACKING_ROLES, HOLD_ZONE_FOR_ROLE, naturalSwing, roleForMovement, roleForZone, SCORING_ZONES, startZoneOf, endZoneOf } from "./common";
import { derive } from "./derive";
import { validatePlay } from "./validate";

interface Slot {
  role?: Role; roleOrigin: Origin;
  zone?: ZoneId; movement?: MovementType; movementOrigin: Origin;
  player?: string; group?: string; index?: number;
  explicit: boolean; strictLegal?: boolean; order: number;
}

export interface PlanResult { doc: PlayDoc | null; clarifications: Clarification[]; diagnostics: Diagnostic[] }

/** Lo que cambia entre tipos de balón parado ofensivo: dónde está el balón, cómo se colocan y quién defiende. */
export interface SetPieceGeometry {
  type: string;
  templateId: string;
  /** Balón y lanzador en metros. */
  ball(side: Side, pitch: EngineContext["pitch"], create: Command): M;
  taker(ball: M, side: Side, pitch: EngineContext["pitch"]): M;
  takerRule: string;
  /** Punto de salida de un actor que no es el lanzador. */
  start(role: Role, movement: MovementType, zone: ZoneId | undefined, side: Side, occ: M[], env: GeoEnv): M;
  /** Rivales y marcas a partir de las posiciones iniciales propias. */
  opponents(env: GeoEnv, primary: { id: string; at: M } | undefined, secondaries: { id: string; at: M }[]): { actors: { role: Role; at: M; label: string; marks?: string }[] };
  /** Línea de fuera de juego (m) o undefined si no aplica. */
  offside?(env: GeoEnv): number | undefined;
  /** Las carreras no arrancan antes de este instante (0 = golpeo, por el fuera de juego). */
  runNotBefore?: number;
}
export interface GeoEnv { pitch: EngineContext["pitch"]; side: Side; ball: M; create: Command; xOff?: number }

export const CORNER_GEOMETRY: SetPieceGeometry = {
  type: "CORNER_ATT", templateId: "CRN_ATT_STANDARD", takerRule: "RULE:CRN-POS-01",
  ball(side, pitch) {
    const L = pitch.length_m, W = pitch.width_m, inward = side === "LEFT" ? 1 : -1;
    return { x: L - 0.354, y: (side === "LEFT" ? 0 : W) + inward * 0.354 };
  },
  taker(ball, side) {
    const inward = side === "LEFT" ? 1 : -1;
    return add(ball, { x: 2 * Math.sin(Math.PI / 6), y: -inward * 2 * Math.cos(Math.PI / 6) });
  },
  start(role, movement, zone, side, occ, env) {
    const z: ZoneId = ATTACKING_ROLES.includes(role) ? (role === "BLOCKER" ? "Z_START_CLUSTER" : startZoneOf(movement)) : (zone ?? "Z_EDGE");
    return placeAt(resolveZone(z, side, env.pitch), occ, MIN_SPACING_M);
  },
  opponents(env, primary, secondaries) {
    const oppTpl = template("OPP_CORNER_DEF_MIXED");
    const out: { role: Role; at: M; label: string; marks?: string }[] = [];
    let zN = 0, mN = 0;
    for (const o of oppTpl.actors as any[]) {
      if (o.role === "MAN_MARKER") {
        const target = o.marks === "PRIMARY_TARGET" ? primary : secondaries[o.index ?? 0];
        if (!target) continue;
        out.push({ role: "MAN_MARKER", at: { x: target.at.x + 1, y: target.at.y }, label: `M${++mN}`, marks: target.id });
      } else {
        out.push({ role: o.role, at: catalogPoint("Z_GK", o.at[0], o.at[1], env.side, env.pitch), label: o.role === "GOALKEEPER" ? "P" : o.role === "COUNTER_OUTLET" ? "C" : `Z${++zN}` });
      }
    }
    return { actors: out };
  },
};

export function createCorner(cmds: Command[], ctx: EngineContext): PlanResult {
  const create = cmds.find((c) => c.op === "play.create");
  if (!create || create.type !== "CORNER_ATT") throw new Error("createCorner necesita play.create {type: CORNER_ATT}");
  return planSetPiece(cmds, ctx, CORNER_GEOMETRY);
}

export function planSetPiece(cmds: Command[], ctx: EngineContext, g: SetPieceGeometry): PlanResult {
  const TEMPLATE_ID = g.templateId;
  const RULE_TPL = `RULE:TPL-${TEMPLATE_ID}`;
  const tpl = template(TEMPLATE_ID);
  const clarifications: Clarification[] = [];
  const create = cmds.find((c) => c.op === "play.create")!;
  if (!create.side) {
    return { doc: null, diagnostics: [], clarifications: [{
      id: "clar_side", code: "AMB-MISSING-REQUIRED", question: "¿Desde qué lado?",
      options: (["LEFT", "RIGHT"] as Side[]).map((s) => ({ label: s === "LEFT" ? "Izquierda" : "Derecha", commands: cmds.map((c) => (c === create ? { ...c, side: s } : c)) })),
    }] };
  }
  const side: Side = create.side;
  const pitch = ctx.pitch;
  const player = (id: string) => ctx.roster.find((p) => p.id === id)!;

  // ---- 1. Especificación a partir de los comandos -------------------------------------------
  const slots: Slot[] = [];
  let order = 0;
  const delivery: { swing?: Swing; trajectory?: string; target_zone?: ZoneId; technique?: string } = {};
  const relations: { blocker: Slot; beneficiary: Slot; strict?: boolean }[] = [];
  const constraints: { slot: Slot; rule: string }[] = [];
  const groups = new Map<string, Slot[]>();
  const pick = (sel: any): Slot | undefined => (sel?.group !== undefined ? groups.get(sel.group)?.[sel.index ?? 0] : undefined);

  for (const c of cmds) {
    switch (c.op) {
      case "play.create": break;
      case "play.set_taker": {
        const s = slots.find((x) => x.role === "TAKER");
        if (s) s.player = c.player;
        else slots.push({ role: "TAKER", roleOrigin: "EXPLICIT", movementOrigin: "EXPLICIT", player: c.player, explicit: true, order: order++ });
        break;
      }
      case "assert": {
        const p = player(c.player);
        if (c.attribute === "dominant_foot" && p.foot !== c.value) {
          const es = (f: string) => (f === "RIGHT" ? "diestro" : f === "LEFT" ? "zurdo" : "ambidiestro");
          clarifications.push({ id: `clar_foot_${p.id}`, code: "AMB-CONFLICT-FACT", question: `Has dicho que ${p.name} es ${es(c.value)}, pero su ficha indica ${es(p.foot)}.`, options: [
            { label: `Actualizar ficha: ${p.name} es ${es(c.value)}`, commands: [{ op: "player.update", player: p.id, dominant_foot: c.value }] },
            { label: `Mantener ficha (${es(p.foot)}) y golpear de exterior`, commands: [{ op: "play.set_delivery", technique: "OUTSIDE_FOOT" }] },
            { label: "Elegir otro lanzador", commands: [] },
            { label: "Cancelar", commands: [] },
          ] });
        }
        break;
      }
      case "play.set_delivery":
        for (const k of ["swing", "trajectory", "target_zone", "technique"] as const) if (c[k]) (delivery as any)[k] = c[k];
        break;
      case "play.add_roles": {
        const list: Slot[] = [];
        for (let i = 0; i < c.count; i++) {
          const s: Slot = {
            role: c.role, roleOrigin: c.role ? "EXPLICIT" : "RULE:ROLE-INFER-01", zone: c.zone, movement: c.movement,
            movementOrigin: c.movement ? "EXPLICIT" : "RULE:TPL", player: c.players?.[i], group: c.group_id, index: i, explicit: true, order: order++,
          };
          slots.push(s); list.push(s);
        }
        if (c.group_id) groups.set(c.group_id, list);
        break;
      }
      case "play.set_role": {
        const s = pick(c.target);
        if (s) { s.role = c.role; s.roleOrigin = "EXPLICIT"; if (c.strict_legal) s.strictLegal = true; }
        break;
      }
      case "play.relation": {
        if (c.type !== "SCREENS") break;
        const b = pick(c.blocker), e = pick(c.beneficiary ?? c.defender?.marker_of);
        if (b && e) relations.push({ blocker: b, beneficiary: e, strict: b.strictLegal });
        break;
      }
      case "play.constraint": {
        for (const s of slots) if (c.target?.role && s.role === c.target.role) constraints.push({ slot: s, rule: c.rule });
        break;
      }
      default: break; // el resto de operaciones se aplican como ediciones sobre el documento (edit.ts)
    }
  }

  // ---- 2. Inferencia de roles no expresados ------------------------------------------------
  for (const s of slots) {
    if (s.role) continue;
    s.role = s.movement ? roleForMovement(s.movement) : s.zone ? roleForZone(s.zone) : "SECONDARY_TARGET";
  }
  if (!slots.some((s) => s.role === "PRIMARY_TARGET")) {
    const want = delivery.target_zone;
    const cand = slots.find((s) => s.role === "SECONDARY_TARGET" && (!want || s.zone === want || (s.movement && endZoneOf(s.movement) === want)))
      ?? slots.find((s) => s.role === "SECONDARY_TARGET");
    if (cand) { cand.role = "PRIMARY_TARGET"; cand.roleOrigin = "RULE:ROLE-PRIMARY-01"; }
  }
  if (!slots.some((s) => s.role === "TAKER")) slots.push({ role: "TAKER", roleOrigin: RULE_TPL, movementOrigin: RULE_TPL, explicit: false, order: order++ });

  // ---- 3. Completar con la plantilla (fill_order) hasta 10 jugadores de campo -----------------
  const outfield = tpl.outfield_total as number;
  if (slots.length > outfield) {
    const diag: Diagnostic = { rule_id: "GEO-02", class: "GEOMETRY", severity: "error", message: `Has pedido ${slots.length} jugadores de campo; el máximo es ${outfield}.` };
    return { doc: null, diagnostics: [diag], clarifications: [...clarifications, {
      id: "clar_count", code: "AMB-CONFLICT-RULE", question: `La jugada tendría ${slots.length} jugadores de campo y solo hay ${outfield}. ¿Qué quitas?`, options: [{ label: "Cancelar", commands: [] }],
    }] };
  }
  for (const role of tpl.fill_order as Role[]) {
    const def = tpl.role_defaults[role];
    if (!def) continue;
    const missing = def.count - slots.filter((s) => s.role === role).length;
    for (let i = 0; i < missing && slots.length < outfield; i++)
      slots.push({ role, roleOrigin: RULE_TPL, movementOrigin: RULE_TPL, explicit: false, order: order++ });
  }

  // ---- 4. Destino del balón y golpeo ------------------------------------------------------
  const primary = slots.find((s) => s.role === "PRIMARY_TARGET");
  let targetZone: ZoneId, targetOrigin: Origin;
  if (delivery.target_zone) { targetZone = delivery.target_zone; targetOrigin = "EXPLICIT"; }
  else {
    const pz = primary?.zone ?? (primary?.movement ? endZoneOf(primary.movement) ?? undefined : undefined);
    targetZone = pz && SCORING_ZONES.includes(pz) ? pz : "Z_FAR_POST";
    targetOrigin = "RULE:BALL-TGT-01";
  }

  // ---- 5. Movimientos por rol --------------------------------------------------------------
  const secondaryDefaults: MovementType[] = tpl.role_defaults.SECONDARY_TARGET.movements;
  const usedSecondary = new Set(slots.filter((s) => s.role === "SECONDARY_TARGET" && s.movement).map((s) => s.movement));
  for (const s of slots) {
    if (s.movement) continue;
    switch (s.role) {
      case "PRIMARY_TARGET": s.movement = ATTACK_FOR_ZONE[targetZone] ?? "ATTACK_FAR_POST"; break;
      case "SECONDARY_TARGET": {
        const zoneMove = s.zone ? ATTACK_FOR_ZONE[s.zone] : undefined;
        if (zoneMove) { s.movement = zoneMove; s.movementOrigin = "RULE:MOV-ZONE"; break; }
        const next = secondaryDefaults.find((m) => !usedSecondary.has(m)) ?? "ATTACK_PEN_SPOT";
        usedSecondary.add(next); s.movement = next; break;
      }
      case "BLOCKER": s.movement = "SCREEN"; break;
      case "DECOY": s.movement = "DECOY_RUN"; break;
      case "SHORT_RECEIVER": s.movement = "SHORT_OPTION"; break;
      default: s.movement = "HOLD";
    }
  }
  for (const s of slots) if (!s.zone) {
    s.zone = s.role === "TAKER" ? undefined
      : ATTACKING_ROLES.includes(s.role!) ? (endZoneOf(s.movement!) ?? (s.role === "BLOCKER" ? targetZone : undefined))
      : HOLD_ZONE_FOR_ROLE[s.role!];
  }
  if (primary && primary.movement && endZoneOf(primary.movement)) primary.zone = endZoneOf(primary.movement)!;

  // ---- 6. Asignación de jugadores (húngaro + desempate lexicográfico) ----------------------
  const fillIdx = (r: Role) => { const i = (tpl.fill_order as Role[]).indexOf(r); return i < 0 ? 99 : i; };
  const toAssign = slots.filter((s) => !s.player).sort((a, b) => fillIdx(a.role!) - fillIdx(b.role!) || Number(b.explicit) - Number(a.explicit) || a.order - b.order);
  const explicitPlayers = new Set(slots.map((s) => s.player).filter(Boolean));
  const poolIds = (ctx.lineupPlayerIds ?? ctx.roster.filter((p) => p.status === "AVAILABLE").map((p) => p.id))
    .filter((id) => player(id)?.pos !== "GK" && !explicitPlayers.has(id));
  const pool = poolIds.map(player).sort((a, b) => (a.n ?? 999) - (b.n ?? 999) || a.id.localeCompare(b.id));
  const requested = delivery.swing;
  const score = toAssign.map((s) => [...pool.map((p) => suitability(s.role!, p, side, requested)), ...toAssign.map(() => 0)]);
  const cols = lexOptimalAssignment(score);
  toAssign.forEach((s, i) => { if (cols[i] < pool.length) s.player = pool[cols[i]].id; });

  // Golpeo efectivo: el pedido o el natural del lanzador.
  const takerSlot = slots.find((s) => s.role === "TAKER")!;
  const takerPlayer = takerSlot.player ? player(takerSlot.player) : undefined;
  const technique = delivery.technique ?? "INSIDE_FOOT";
  const natural = takerPlayer ? naturalSwing(takerPlayer.foot, side, technique === "OUTSIDE_FOOT") : null;
  const swing: Swing = delivery.swing ?? natural ?? "INSWING";

  // ---- 7. Actores, identificadores y colocación -------------------------------------------
  const ordered = [...slots].sort((a, b) => ACTOR_ORDER.indexOf(a.role!) - ACTOR_ORDER.indexOf(b.role!) || Number(b.explicit) - Number(a.explicit) || a.order - b.order);
  const idOf = new Map<Slot, string>();
  ordered.forEach((s, i) => idOf.set(s, `a${i + 1}`));
  const dorsal = (s: Slot) => (s.player ? player(s.player).n ?? 999 : 999);

  const ballM: M = g.ball(side, pitch, create);
  const takerM: M = g.taker(ballM, side, pitch);
  const env: GeoEnv = { pitch, side, ball: ballM, create };
  env.xOff = g.offside?.(env);

  const startOcc: M[] = [];
  const startPos = new Map<Slot, M>();
  const placeOrder = [...slots].filter((s) => s.role !== "TAKER")
    .sort((a, b) => Number(b.explicit) - Number(a.explicit) || (a.explicit ? a.order - b.order : fillIdx(a.role!) - fillIdx(b.role!) || dorsal(a) - dorsal(b)));
  for (const s of placeOrder) {
    const p = g.start(s.role!, s.movement!, s.zone, side, startOcc, env);
    startOcc.push(p); startPos.set(s, p);
  }
  startPos.set(takerSlot, takerM);

  // Puntos finales de las carreras (primero el rematador principal en el destino del balón).
  const endOcc: M[] = [];
  const endPos = new Map<Slot, M>();
  const runners = placeOrder.filter((s) => ATTACKING_ROLES.includes(s.role!) && s.movement !== "SCREEN")
    .sort((a, b) => Number(b.role === "PRIMARY_TARGET") - Number(a.role === "PRIMARY_TARGET"));
  const zoneCache = new Map<ZoneId, ResolvedZone>();
  const rz = (z: ZoneId) => { if (!zoneCache.has(z)) zoneCache.set(z, resolveZone(z, side, pitch)); return zoneCache.get(z)!; };
  const targetPoint = rz(targetZone).anchors[0];
  for (const s of runners) {
    let z = endZoneOf(s.movement!);
    if (s.movement === "DECOY_RUN") {
      const cands: ZoneId[] = ["Z_NEAR_POST", "Z_PEN_SPOT", "Z_GA_CENTER", "Z_FAR_POST"];
      z = [...cands].sort((a, b) => dist2(rz(b).anchors[0], targetPoint) - dist2(rz(a).anchors[0], targetPoint))[0];
    }
    if (!z) continue;
    const p = s.role === "PRIMARY_TARGET" && z === targetZone ? targetPoint : placeAt(rz(z), endOcc, MIN_SPACING_M);
    endOcc.push(p); endPos.set(s, p);
    if (s.movement === "DECOY_RUN") s.zone = z;
    else s.zone = s.zone ?? z;
  }

  const actors: Actor[] = ordered.map((s) => {
    const p = s.player ? player(s.player) : undefined;
    return {
      id: idOf.get(s)!, team: "OWN", player_id: s.player ?? null, label: p?.n ? String(p.n) : s.role!.slice(0, 2),
      role: s.role!, start: toN(startPos.get(s)!, pitch),
      ...(s.role !== "TAKER" && s.zone ? { action_zone: s.zone } : {}),
      ...(s.group ? { group: s.group } : {}),
      provenance: {
        role: s.roleOrigin, player_id: s.player && explicitPlayers.has(s.player) ? "EXPLICIT" : "RULE:ASG-01",
        start: s.role === "TAKER" ? g.takerRule : s.role === "REST_DEFENDER" ? "RULE:CRN-POS-07" : "RULE:ZONE-ANCHOR",
      },
    };
  });

  // ---- 8. Rivales (defensa mixta por defecto) ------------------------------------------------
  const oppTplId: string = tpl.opponents_default;
  const oppActors: Actor[] = [];
  const marks: Relation[] = [];
  const markOf = new Map<Slot, string>();
  const secondaries = ordered.filter((s) => s.role === "SECONDARY_TARGET");
  const slotOfId = new Map<string, Slot>([...idOf].map(([k, v]) => [v, k]));
  const asRef = (s: Slot | undefined) => (s ? { id: idOf.get(s)!, at: startPos.get(s)! } : undefined);
  const opps = g.opponents(env, asRef(primary), secondaries.map((s) => asRef(s)!));
  opps.actors.forEach((o, i) => {
    const id = `o${i + 1}`;
    if (o.marks) {
      markOf.set(slotOfId.get(o.marks)!, id);
      marks.push({ type: "MARKS", a: id, b: o.marks, origin: `RULE:TPL-${oppTplId}` });
    }
    oppActors.push({ id, team: "OPP", label: o.label, role: o.role, start: toN(o.at, pitch), provenance: { start: `RULE:TPL-${oppTplId}` } });
  });

  // ---- 9. Movimientos y relaciones -----------------------------------------------------------
  const movements: Movement[] = [];
  const movId = (s: Slot) => `m${idOf.get(s)!.slice(1)}`;
  for (const s of ordered) {
    if (s.role === "TAKER") continue;
    const start = startPos.get(s)!;
    const def = MOVEMENTS[s.movement!];
    const isHold = s.movement === "HOLD";
    const end = endPos.get(s);
    const m: Movement = {
      id: movId(s), actor: idOf.get(s)!, type: s.movement!,
      path: isHold || !end ? [toN(start, pitch)] : [toN(start, pitch), toN(end, pitch)],
      ...(isHold ? {} : { shape: (def.shape === "CURVED_IN" ? "CURVED_IN" : "STRAIGHT") as Movement["shape"] }),
      t_start: 0, t_end: 0,
      provenance: { type: s.movementOrigin === "EXPLICIT" ? "EXPLICIT" : s.explicit ? s.roleOrigin : s.movementOrigin === "RULE:TPL" ? RULE_TPL : s.movementOrigin },
    };
    if (!isHold && def.anchor) m.anchor = { kind: def.anchor.kind as any, event: def.anchor.event as any, offset_s: def.anchor.offset_s, ...(g.runNotBefore !== undefined ? { not_before_s: g.runNotBefore } : {}) };
    movements.push(m);
  }
  for (const o of oppActors) movements.push({ id: `m${o.id}`, actor: o.id, type: o.role === "MAN_MARKER" ? "FOLLOW" : "HOLD", path: [o.start], t_start: 0, t_end: 0, provenance: { type: o.provenance.start } });

  const rels: Relation[] = [];
  for (const r of relations) {
    const defender = markOf.get(r.beneficiary);
    const bm = movements.find((m) => m.actor === idOf.get(r.blocker))!;
    const em = movements.find((m) => m.actor === idOf.get(r.beneficiary))!;
    bm.anchor = { kind: "ARRIVES_AT", event: "MOVEMENT_START", ref: em.id, offset_s: -0.3 };
    bm.depends_on = [];
    em.depends_on = [bm.id];
    rels.push({ type: "SCREENS", blocker: idOf.get(r.blocker), defender, beneficiary: idOf.get(r.beneficiary), strict_legal: !!r.strict, origin: "EXPLICIT" });
  }
  rels.push(...marks);

  const cons = [
    ...constraints.map((c) => ({ actor: idOf.get(c.slot)!, rule: c.rule, origin: "EXPLICIT" as Origin })),
    ...ordered.filter((s) => s.role === "REST_DEFENDER" && !constraints.some((c) => c.slot === s)).map((s) => ({ actor: idOf.get(s)!, rule: "NO_JOIN_ATTACK", origin: RULE_TPL as Origin })),
  ];

  const notes = rels.some((r) => r.type === "SCREENS" && r.strict_legal)
    ? [{ id: "n1", text: "Bloqueo sin contacto: llegar parado antes de que arranque el compañero.", origin: "RULE:LAW-IMP-01", anchor_actor: rels.find((r) => r.type === "SCREENS")!.blocker }]
    : [];

  let doc: PlayDoc = {
    schema: "fcs.play/1", engine_version: ENGINE_VERSION, catalog_version: CATALOG_VERSION, template: TEMPLATE_ID,
    type: g.type, side, pitch,
    ...(env.xOff !== undefined ? { offside_x: Math.round((env.xOff / pitch.length_m) * 10000) / 10000 } : {}),
    delivery: {
      taker_actor: idOf.get(takerSlot)!, ball_start: toN(ballM, pitch), swing,
      trajectory: (delivery.trajectory as any) ?? "DRIVEN", technique: technique as any,
      target_zone: targetZone, target_point: toN(targetPoint, pitch), curve: 0.18, kick_t: 0, arrival_t: 0,
      provenance: {
        swing: delivery.swing ? "EXPLICIT" : "RULE:TECH-SWING-01", trajectory: delivery.trajectory ? "EXPLICIT" : RULE_TPL,
        target_zone: targetOrigin, ball_start: g.takerRule,
      },
    },
    actors: [...actors, ...oppActors], movements, relations: rels, constraints: cons, notes, diagnostics: [],
  };
  doc = derive(doc);
  doc.diagnostics = validatePlay(doc, ctx);
  return { doc, clarifications, diagnostics: doc.diagnostics };
}

const dist2 = (a: M, b: M) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Matriz de idoneidad entera (docs/15 §7, docs/engine/rules/roles.yaml). */
export function suitability(role: Role, p: Player, side: Side, requestedSwing?: Swing): number {
  const def = ROLES[role];
  if (!def) return 0;
  let total = 0;
  for (const f of def.suitability) {
    let v = 0;
    switch (f.factor) {
      case "tag": v = p.tags?.includes(String(f.value)) ? 100 : 0; break;
      case "setpiece_role": v = p.setpiece?.includes(String(f.value).replace("{side}", side.toLowerCase())) ? 100 : 0; break;
      case "height_norm": {
        v = p.height === undefined ? HEIGHT_NORM.missing
          : Math.round(Math.min(100, Math.max(0, ((p.height - HEIGHT_NORM.min_cm) / (HEIGHT_NORM.max_cm - HEIGHT_NORM.min_cm)) * 100)));
        break;
      }
      case "position_in": {
        const list = f.value as string[];
        v = list.includes(p.pos) ? 100 : p.secondary?.some((s) => list.includes(s)) ? 60 : 0;
        break;
      }
      case "foot_matches_requested_swing": {
        const nat = naturalSwing(p.foot, side);
        v = !requestedSwing || nat === null || nat === requestedSwing ? 100 : 0;
        break;
      }
    }
    total += f.weight * v;
  }
  return total;
}
