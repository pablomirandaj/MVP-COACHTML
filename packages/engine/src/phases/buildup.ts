// Salida de balón (Pizarra Studio §6.2): estructura de primera línea (2+1, 3+1 o lateral por dentro) frente a la
// presión rival de 1–3 jugadores; el hombre libre es el de la estructura sin rival a menos de 5 m.
import { slotInfo } from "../lineup";
import type { Diagnostic, M, Pitch } from "../types";
import { lexOptimalAssignment } from "../util/assignment";
import { clamp } from "../util/num";
import { defendingBlock, mirror, possessionShape, slotsOf, type SceneSpec } from "./scene";

export const FREE_RADIUS_M = 5;
const PRESS_GAP_M = 2.5;

export interface BuildUpFrame { own: Record<string, M>; opp: Record<string, M>; ball: M; roles: Record<string, string>; structure: string[] }

const posOf = (k: string) => slotInfo(k).pos;
const dist = (a: M, b: M) => Math.hypot(a.x - b.x, a.y - b.y);

/** El pivote que baja o hace de "+1": el MCD, o el mediocentro más centrado si no hay. */
function pivotOf(formation: string): string | undefined {
  const s = slotsOf(formation);
  return s.find((x) => posOf(x.slot) === "DM")?.slot
    ?? [...s].filter((x) => posOf(x.slot) === "CM").sort((a, b) => Math.abs(a.v - 0.5) - Math.abs(b.v - 0.5) || a.slot.localeCompare(b.slot))[0]?.slot;
}

export function buildUpFrame(spec: SceneSpec, holder: string, pitch: Pitch): BuildUpFrame {
  const W = pitch.width_m;
  const structure = spec.params.structure ?? "3+1";
  const own = possessionShape(spec.own.formation, pitch, "BUILD_UP");
  const slots = slotsOf(spec.own.formation).map((s) => s.slot);
  const cbs = slots.filter((k) => posOf(k) === "CB").sort();
  const fbs = slots.filter((k) => ["LB", "RB", "LWB", "RWB"].includes(posOf(k))).sort();
  const gk = slots.find((k) => posOf(k) === "GK");
  const pivot = pivotOf(spec.own.formation);
  const xCb = cbs.length ? Math.min(...cbs.map((k) => own[k].x)) : 12;
  if (gk) own[gk] = { x: 5, y: W / 2 };

  let members: string[] = [];
  if (structure === "3+1" && pivot && cbs.length >= 2) {
    const pivotX = own[pivot].x;
    own[pivot] = { x: xCb, y: W / 2 };
    own[cbs[0]] = { x: xCb, y: W / 2 - 12 };
    own[cbs[cbs.length - 1]] = { x: xCb, y: W / 2 + 12 };
    for (const f of fbs) own[f] = { x: pivotX, y: own[f].y };
    const plus = slots.filter((k) => ["CM", "AM"].includes(posOf(k)) && k !== pivot)
      .sort((a, b) => Math.abs(own[a].y - W / 2) - Math.abs(own[b].y - W / 2) || a.localeCompare(b))[0];
    if (plus) own[plus] = { x: xCb + 13, y: W / 2 };
    members = [cbs[0], pivot, cbs[cbs.length - 1], ...(plus ? [plus] : [])];
  } else if (structure === "FB_INSIDE" && pivot) {
    const weak = fbs.find((f) => (own[f].y > W / 2) !== (own[holder]?.y > W / 2)) ?? fbs[0];
    if (weak) own[weak] = { x: own[pivot].x, y: W / 2 + (own[weak].y > W / 2 ? 10 : -10) };
    members = [...cbs, pivot, ...(weak ? [weak] : [])];
  } else {
    // 2+1: centrales abiertos a lo ancho del área y el pivote por delante, entre ellos.
    if (cbs.length >= 2) { own[cbs[0]] = { x: xCb, y: W / 2 - 20.16 }; own[cbs[cbs.length - 1]] = { x: xCb, y: W / 2 + 20.16 }; }
    if (pivot) own[pivot] = { x: xCb + 11, y: W / 2 };
    members = [...cbs, ...(pivot ? [pivot] : [])];
  }

  const holderAt = own[holder] ?? own[gk ?? slots[0]];
  const ball = { x: holderAt.x + 0.8, y: holderAt.y };
  // Rival en bloque alto (su marco), reflejado al nuestro; sus N más adelantados presionan a nuestra estructura.
  const opp: Record<string, M> = {};
  for (const [k, m] of Object.entries(defendingBlock(spec.opp.formation, pitch, "HIGH", 32, 0.55, mirror(ball, pitch)))) opp[k] = mirror(m, pitch);
  const n = clamp(spec.params.opp_pressers ?? 2, 1, 3);
  const pressers = Object.keys(opp).filter((k) => posOf(k) !== "GK").sort((a, b) => opp[a].x - opp[b].x || a.localeCompare(b)).slice(0, n);
  const targets = members.filter((k) => own[k]);
  if (pressers.length && targets.length) {
    const cols = lexOptimalAssignment(pressers.map((p) => targets.map((t) => 100000 - Math.round(dist(opp[p], own[t]) * 100))));
    pressers.forEach((p, i) => {
      const t = own[targets[cols[i]]];
      if (!t) return;
      opp[p] = { x: t.x + PRESS_GAP_M, y: t.y + Math.sign(W / 2 - t.y) * 0.5 };
    });
  }
  const roles: Record<string, string> = {};
  const free = targets.filter((k) => k !== holder && Object.values(opp).every((o) => dist(o, own[k]) >= FREE_RADIUS_M))
    .sort((a, b) => dist(own[a], ball) - dist(own[b], ball) || a.localeCompare(b));
  if (free[0]) roles[free[0]] = "FREE_MAN";
  for (const k of targets) if (!roles[k] && k !== holder) roles[k] = "SUPPORT";
  return { own, opp, ball, roles, structure: targets };
}

export function buildUpDiagnostics(frames: { roles: Record<string, string> }[]): Diagnostic[] {
  return frames.some((f) => Object.values(f.roles).includes("FREE_MAN")) ? [] : [{
    rule_id: "BUILD-01", class: "TACTICAL", severity: "warning",
    message: "La presión iguala la salida: no hay hombre libre. Prueba con 3+1 o con un lateral por dentro.",
  }];
}
