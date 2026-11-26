// Cálculos derivados de una jugada: punto de bloqueo, seguimiento de marcadores, trayectoria del balón
// y temporización (docs/15 §8–9). Es una función pura que se reejecuta tras cada comando: lo que no
// cambió en la entrada produce exactamente el mismo resultado (localidad, G2).
import { BALL_SPEEDS, TIMELINE, movementSpeed } from "../catalog/index";
import { add, controlPoint, dist, quad, quadLength, scale, sub, toM, toN, unit } from "../geometry";
import type { M, Movement, PlayDoc } from "../types";
import { clamp, r2 } from "../util/num";

const SCREEN_OFFSET_M = 1.2;
const SCREEN_LEAD_S = 0.3;
const FOLLOW_DELAY_S = 0.15;
const PASS_SPEED_MPS = 14;
const PASS_GAP_S = 0.3;

/** Posición final (m) de un actor: el final de su movimiento o su inicio. */
export function endOf(doc: PlayDoc, actorId: string): M {
  const m = doc.movements.find((x) => x.actor === actorId);
  const a = doc.actors.find((x) => x.id === actorId)!;
  return toM(m && m.path.length ? m.path[m.path.length - 1] : a.start, doc.pitch);
}

export function ballCurve(doc: PlayDoc): { p0: M; c: M; p1: M } {
  const p0 = toM(doc.delivery.ball_start, doc.pitch), p1 = toM(doc.delivery.target_point, doc.pitch);
  if (doc.delivery.swing === "INSWING") return { p0, c: controlPoint(p0, p1, doc.delivery.curve, -1), p1 };
  if (doc.delivery.swing === "NONE" || doc.delivery.trajectory === "SHORT" || doc.delivery.trajectory === "LOW")
    return { p0, c: scale(add(p0, p1), 0.5), p1 };
  // Abierto: el control va hacia la línea de fondo y se recorta para que el balón no salga (BALL-03).
  const maxX = doc.pitch.length_m - 0.5;
  let k = doc.delivery.curve;
  for (let i = 0; i < 40; i++) {
    const c = controlPoint(p0, p1, k, 1);
    let ok = true;
    for (let s = 0; s <= 1.0001; s += 1 / 32) if (quad(p0, c, p1, s).x > maxX) { ok = false; break; }
    if (ok) return { p0, c, p1 };
    k *= 0.85;
  }
  return { p0, c: scale(add(p0, p1), 0.5), p1 };
}

export function movementLength(doc: PlayDoc, m: Movement): number {
  if (m.path.length < 2) return 0;
  const a = toM(m.path[0], doc.pitch), b = toM(m.path[m.path.length - 1], doc.pitch);
  if (m.shape === "CURVED_IN") return quadLength(a, controlPoint(a, b, 0.15, -1), b);
  let len = 0;
  for (let i = 1; i < m.path.length; i++) len += dist(toM(m.path[i - 1], doc.pitch), toM(m.path[i], doc.pitch));
  return len;
}

export function derive(input: PlayDoc): PlayDoc {
  const doc: PlayDoc = JSON.parse(JSON.stringify(input));
  const pitch = doc.pitch;
  const actor = (id: string) => doc.actors.find((a) => a.id === id)!;
  const mov = (actorId: string) => doc.movements.find((m) => m.actor === actorId);

  // 1. Punto de bloqueo: sobre la recta defensor → destino del beneficiario, a 1,2 m del defensor.
  for (const r of doc.relations) {
    if (r.type !== "SCREENS" || !r.blocker || !r.beneficiary || !r.defender) continue;
    const bm = mov(r.blocker), em = mov(r.beneficiary);
    if (!bm || !em || bm.type !== "SCREEN") continue;
    const d = toM(actor(r.defender).start, pitch);
    const e = toM(em.path[em.path.length - 1], pitch);
    const p = add(d, scale(unit(sub(e, d)), SCREEN_OFFSET_M));
    bm.path = [actor(r.blocker).start, toN(p, pitch)];
  }

  // 2. Balón.
  const { p0, c, p1 } = ballCurve(doc);
  const ballLen = quadLength(p0, c, p1);
  const arrival = r2(ballLen / BALL_SPEEDS[doc.delivery.trajectory]);
  doc.delivery.arrival_t = arrival;
  const holdEnd = r2(arrival + TIMELINE.end_after_arrival_s);

  // 3. Temporización de movimientos propios (orden: los anclados al balón o al golpeo primero).
  const own = doc.movements.filter((m) => actor(m.actor).team === "OWN");
  const times = new Map<string, { s: number; e: number }>();
  const solve = (m: Movement): { s: number; e: number } => {
    const hit = times.get(m.id);
    if (hit) return hit;
    let s: number, e: number;
    if (m.type === "HOLD" || !m.anchor) { s = TIMELINE.prep_start_s; e = holdEnd; }
    else {
      const dur = movementLength(doc, m) / (m.speed_mps ?? movementSpeed(m.type));
      const a = m.anchor;
      let ref: number;
      if (a.event === "KICK") ref = 0;
      else if (a.event === "BALL_ARRIVAL") ref = arrival;
      else {
        const target = doc.movements.find((x) => x.id === a.ref);
        const rt = target ? solve(target) : { s: 0, e: 0 };
        ref = a.event === "MOVEMENT_START" ? rt.s : rt.e;
      }
      if (a.kind === "STARTS_AT") { s = ref + a.offset_s; e = s + dur; }
      else { e = ref + a.offset_s; s = e - dur; }
      if (s < TIMELINE.prep_start_s) { e += TIMELINE.prep_start_s - s; s = TIMELINE.prep_start_s; }
      if (a.not_before_s !== undefined && s < a.not_before_s) { e += a.not_before_s - s; s = a.not_before_s; }
    }
    const t = { s: r2(s), e: r2(e) };
    times.set(m.id, t);
    return t;
  };
  for (const m of own) { const t = solve(m); m.t_start = t.s; m.t_end = t.e; }

  // 4. Rivales que siguen a su marca (FOLLOW): mismo recorrido desplazado 1 m hacia su portería, con 0,15 s de retraso.
  for (const r of doc.relations) {
    if (r.type !== "MARKS" || !r.a || !r.b) continue;
    const fm = mov(r.a), tm = mov(r.b);
    if (!fm || fm.type !== "FOLLOW") continue;
    if (!tm || tm.type === "HOLD") { fm.path = [actor(r.a).start]; fm.t_start = TIMELINE.prep_start_s; fm.t_end = holdEnd; continue; }
    const end = toM(tm.path[tm.path.length - 1], pitch);
    fm.path = [actor(r.a).start, toN({ x: clamp(end.x + 1, 0, pitch.length_m - 0.3), y: end.y }, pitch)];
    fm.t_start = r2(Math.min(tm.t_start + FOLLOW_DELAY_S, tm.t_end));
    fm.t_end = tm.t_end;
    fm.depends_on = [tm.id];
  }
  // 5. Pases encadenados: cada uno sale 0,3 s después de recibir y llega cuando el receptor termina su carrera.
  if (doc.passes?.length) {
    let prev = arrival;
    for (const ps of doc.passes) {
      const a0 = endOf(doc, ps.from), b0 = endOf(doc, ps.to);
      const dur = dist(a0, b0) / PASS_SPEED_MPS;
      let s = prev + PASS_GAP_S, e = s + dur;
      const rm = mov(ps.to);
      if (rm && rm.type !== "HOLD" && rm.t_end > e) { e = rm.t_end; s = Math.max(s, e - dur); }
      ps.t_start = r2(s); ps.t_end = r2(e); prev = e;
    }
    const end = r2(prev + TIMELINE.end_after_arrival_s);
    for (const m of doc.movements) if (m.type === "HOLD") m.t_end = Math.max(m.t_end, end);
  }
  for (const m of doc.movements) if (actor(m.actor).team === "OPP" && m.type === "HOLD") { m.t_start = TIMELINE.prep_start_s; m.t_end = holdEnd; }
  return doc;
}

export { SCREEN_LEAD_S };
