// Escenas de fases de juego (docs/32): posiciones de los 22 jugadores calculadas por reglas a partir de
// formaciones, parámetros de bloque y estados del balón. Marco: nuestro equipo ataca hacia x = L.
import { FORMATIONS } from "../catalog/index";
import { add, dist, scale, sub, unit } from "../geometry";
import { slotInfo } from "../lineup";
import type { Diagnostic, M, Pitch, Pt } from "../types";
import { lexOptimalAssignment } from "../util/assignment";
import { clamp, r2, r4 } from "../util/num";

export type SceneType = "PRESS_OWN" | "PRESS_OPP" | "RETREAT" | "REST_DEFENSE";
export type BlockHeight = "HIGH" | "MID" | "LOW";

export interface Jump { who: string; to: string; curve?: "SCREEN_GK" }
export interface SceneKeyframe { t: number; ball: { holder: string }; event?: "TRIGGER"; note?: string }
export interface SceneSpec {
  type: SceneType;
  title?: string;
  own: { formation: string; labels?: Record<string, string> };
  opp: { formation: string; labels?: Record<string, string> };
  params: {
    block_height?: BlockHeight;
    compactness_m?: number;
    lateral_shift?: number;
    jumps?: Jump[];
    /** REST_DEFENSE: delanteros rivales que se quedan arriba (códigos de ranura del rival). */
    opp_staying?: string[];
    /** REST_DEFENSE: número de vigilantes; por defecto rivales arriba + 1 (REST-01). */
    rest_count?: number;
  };
  keyframes: SceneKeyframe[];
}
export interface SceneFrame { t: number; event?: string; note?: string; ball: Pt; own: Record<string, Pt>; opp: Record<string, Pt>; roles: Record<string, string> }
export interface SceneDoc {
  schema: "fcs.scene/1"; type: SceneType; title: string; pitch: Pitch;
  own_labels: Record<string, string>; opp_labels: Record<string, string>;
  frames: SceneFrame[]; diagnostics: Diagnostic[];
}

const LINE: Record<string, "GK" | "DEF" | "MID" | "ATT"> = {
  GK: "GK", RB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF", CB: "DEF",
  DM: "MID", CM: "MID", RM: "MID", LM: "MID", AM: "MID", RW: "ATT", LW: "ATT", ST: "ATT", SS: "ATT",
};
const ABBR: Record<string, string> = {
  GK: "POR", RB: "LD", LB: "LI", RWB: "CAD", LWB: "CAI", CB: "DFC", DM: "MCD", CM: "MC", RM: "MD", LM: "MI", AM: "MCO", RW: "ED", LW: "EI", ST: "DC", SS: "SD",
};
const LINE_SHIFT_WEIGHT = { GK: 0.15, DEF: 0.5, MID: 0.6, ATT: 0.4 } as const;
const BLOCK_DEF_X: Record<BlockHeight, number> = { HIGH: 46, MID: 36, LOW: 22 };
const BLOCK_COMPACT: Record<BlockHeight, number> = { HIGH: 32, MID: 30, LOW: 25 };

const slotsOf = (f: string) => {
  const def = FORMATIONS[f];
  if (!def) throw new Error(`Formación desconocida: ${f}`);
  return def.slots;
};
const lineOf = (slot: string, u: number) => {
  const l = LINE[slotInfo(slot).pos];
  if (l === "DEF" && u >= 0.3) return "MID"; // carrileros adelantados (3-5-2)
  if (l === "ATT" && u <= 0.56) return "MID"; // extremos de un 4-2-3-1
  return l;
};
const defaultLabels = (f: string) => Object.fromEntries(slotsOf(f).map((s) => [s.slot, ABBR[slotInfo(s.slot).pos] ?? s.slot]));
const mirror = (m: M, p: Pitch): M => ({ x: p.length_m - m.x, y: p.width_m - m.y });
const toPt = (m: M, p: Pitch): Pt => ({ u: r4(m.x / p.length_m), v: r4(m.y / p.width_m) });

/** Forma de un equipo con balón, en su propio marco de ataque. phase: BUILD_UP (salida) o ATTACK (en campo rival). */
function possessionShape(formation: string, pitch: Pitch, phase: "BUILD_UP" | "ATTACK"): Record<string, M> {
  const out: Record<string, M> = {};
  for (const s of slotsOf(formation)) {
    const { pos } = slotInfo(s.slot);
    let u = s.u, v = 0.5 + (s.v - 0.5) * 1.15;
    if (["LB", "RB", "LWB", "RWB"].includes(pos)) u += 0.06;
    if (phase === "ATTACK" && pos !== "GK") u = Math.min(0.9, u + 0.3);
    if (phase === "ATTACK" && pos === "GK") u = 0.12;
    out[s.slot] = { x: u * pitch.length_m, y: clamp(v, 0.04, 0.96) * pitch.width_m };
  }
  return out;
}

/** Bloque defensivo (pasos 1–3 de docs/32 §3) en el marco del equipo que defiende. */
function defendingBlock(formation: string, pitch: Pitch, height: BlockHeight, compact: number, shift: number, ball: M): Record<string, M> {
  const slots = slotsOf(formation);
  const W = pitch.width_m;
  const defU = slots.filter((s) => lineOf(s.slot, s.u) === "DEF").map((s) => s.u);
  const attU = slots.filter((s) => lineOf(s.slot, s.u) === "ATT").map((s) => s.u);
  const uDef = defU.length ? mean(defU) : 0.22, uAtt = attU.length ? mean(attU) : Math.max(...slots.map((s) => s.u));
  const xDef = BLOCK_DEF_X[height];
  const out: Record<string, M> = {};
  const xs: number[] = [];
  for (const s of slots) {
    const line = lineOf(s.slot, s.u);
    if (line === "GK") { out[s.slot] = { x: Math.max(4, xDef * 0.35), y: W / 2 + LINE_SHIFT_WEIGHT.GK * (ball.y - W / 2) }; continue; }
    // La línea defensiva se alinea (SHAPE-02); el resto se reparte en la distancia de compactación.
    const x = line === "DEF" ? xDef : xDef + ((s.u - uDef) / (uAtt - uDef || 1)) * compact;
    const y = clamp(s.v * W + shift * (ball.y - W / 2) * LINE_SHIFT_WEIGHT[line], 2, W - 2);
    out[s.slot] = { x, y };
    xs.push(x);
  }
  const center = mean(xs);
  const dx = clamp(0.1 * (ball.x - center), -5, 5);
  for (const s of slots) if (lineOf(s.slot, s.u) !== "GK") out[s.slot] = { x: out[s.slot].x + dx, y: out[s.slot].y };
  return out;
}

/** Pasos 4–5: saltos de presión y coberturas (algoritmo húngaro por distancia). */
function applyJumps(formation: string, own: Record<string, M>, opp: Record<string, M>, jumps: Jump[], oppGk: string | undefined): Record<string, string> {
  const roles: Record<string, string> = {};
  const slots = slotsOf(formation);
  const before = { ...own };
  for (const j of jumps) {
    const t = opp[j.to];
    if (!t || !own[j.who]) continue;
    let p: M;
    if (j.curve === "SCREEN_GK" && oppGk && opp[oppGk]) p = add(t, scale(unit(sub(opp[oppGk], t)), 2));
    else {
      const inside = Math.sign(34 - t.y) || 1;
      p = add(t, scale(unit({ x: -0.6, y: inside }), 1.5));
    }
    own[j.who] = p;
    roles[j.who] = "PRESSER";
  }
  const order = ["ATT", "MID", "DEF"] as const;
  const jumpers = jumps.map((j) => j.who).filter((w) => roles[w]);
  const covers: { jumper: string; candidates: string[] }[] = jumpers.map((w) => {
    const s = slots.find((x) => x.slot === w)!;
    const li = order.indexOf(lineOf(w, s.u) as any);
    const behind = order[li + 1];
    return { jumper: w, candidates: behind ? slots.filter((x) => lineOf(x.slot, x.u) === behind && !roles[x.slot]).map((x) => x.slot) : [] };
  });
  const pool = [...new Set(covers.flatMap((c) => c.candidates))].sort();
  const active = covers.filter((c) => c.candidates.length);
  if (active.length && pool.length >= active.length) {
    const BIG = 100000;
    const score = active.map((c) => pool.map((p) => (c.candidates.includes(p) ? BIG - Math.round(dist(before[p], before[c.jumper]) * 100) : 0)));
    const cols = lexOptimalAssignment(score);
    active.forEach((c, i) => {
      const p = pool[cols[i]];
      if (!c.candidates.includes(p)) return;
      own[p] = add(before[p], scale(sub(before[c.jumper], before[p]), 0.5));
      roles[p] = "COVER";
    });
  }
  return roles;
}

export function computeScene(spec: SceneSpec, pitch: Pitch): SceneDoc {
  const frames: SceneFrame[] = [];
  const diags: Diagnostic[] = [];
  const height = spec.params.block_height ?? (spec.type === "RETREAT" ? "LOW" : spec.type === "REST_DEFENSE" ? "HIGH" : "HIGH");
  const compact = spec.params.compactness_m ?? BLOCK_COMPACT[height];
  const shift = spec.params.lateral_shift ?? 0.55;
  let triggered = false;

  for (const kf of [...spec.keyframes].sort((a, b) => a.t - b.t)) {
    if (kf.event === "TRIGGER") triggered = true;
    let own: Record<string, M>, opp: Record<string, M>, ball: M;
    let roles: Record<string, string> = {};

    if (spec.type === "PRESS_OWN" || spec.type === "RETREAT" || spec.type === "PRESS_OPP") {
      // Defiende D y tiene el balón P. En PRESS_OPP defiende el rival: se calcula en su marco y se refleja.
      const defending = spec.type === "PRESS_OPP" ? spec.opp.formation : spec.own.formation;
      const possessing = spec.type === "PRESS_OPP" ? spec.own.formation : spec.opp.formation;
      const posShape = possessionShape(possessing, pitch, spec.type === "RETREAT" ? "ATTACK" : "BUILD_UP");
      const P: Record<string, M> = {};
      for (const [k, m] of Object.entries(posShape)) P[k] = mirror(m, pitch); // el poseedor ataca hacia x = 0 en el marco del defensor
      const holder = P[kf.ball.holder];
      if (!holder) throw new Error(`Poseedor desconocido: ${kf.ball.holder}`);
      const b = { x: holder.x - 0.8, y: holder.y };
      const D = defendingBlock(defending, pitch, height, compact, shift, b);
      if (triggered && spec.params.jumps?.length) {
        const gk = Object.keys(P).find((k) => slotInfo(k).pos === "GK");
        roles = applyJumps(defending, D, P, spec.params.jumps, gk);
      }
      if (spec.type === "PRESS_OPP") {
        own = mapObj(P, (m) => mirror(m, pitch)); opp = mapObj(D, (m) => mirror(m, pitch)); ball = mirror(b, pitch);
        roles = Object.fromEntries(Object.entries(roles).map(([k, v]) => [`opp:${k}`, v]));
      } else { own = D; opp = P; ball = b; }
    } else {
      // REST_DEFENSE: atacamos; el rival defiende bajo con algunos delanteros arriba.
      const A = possessionShape(spec.own.formation, pitch, "ATTACK");
      const holder = A[kf.ball.holder];
      if (!holder) throw new Error(`Poseedor desconocido: ${kf.ball.holder}`);
      ball = { x: holder.x + 0.8, y: holder.y };
      const oppBlockTheirFrame = defendingBlock(spec.opp.formation, pitch, "LOW", 25, shift, mirror(ball, pitch));
      opp = mapObj(oppBlockTheirFrame, (m) => mirror(m, pitch));
      const staying = spec.params.opp_staying ?? slotsOf(spec.opp.formation).filter((s) => slotInfo(s.slot).pos === "ST").map((s) => s.slot);
      for (const s of staying) if (opp[s]) opp[s] = { x: 47, y: opp[s].y };
      own = { ...A };
      const restCount = spec.params.rest_count ?? staying.length + 1;
      if (restCount < staying.length + 1)
        diags.push({ rule_id: "REST-01", class: "TACTICAL", severity: "warning", message: `Recomendación: ${restCount} vigilantes para ${staying.length} rivales arriba (se recomienda uno más).` });
      const slots = slotsOf(spec.own.formation);
      const ballSideRight = ball.y > pitch.width_m / 2;
      const priority = (s: string) => {
        const { pos, side } = slotInfo(s);
        if (pos === "CB") return 0;
        if (pos === "DM") return 1;
        if (["LB", "RB", "LWB", "RWB"].includes(pos)) return (side === "R") === ballSideRight ? 3 : 2; // el lateral del lado contrario al balón antes
        return 9;
      };
      const rest = slots.map((s) => s.slot).filter((s) => priority(s) < 9 && s !== kf.ball.holder)
        .sort((a, b) => priority(a) - priority(b) || slotsOf(spec.own.formation).findIndex((x) => x.slot === a) - slotsOf(spec.own.formation).findIndex((x) => x.slot === b))
        .slice(0, restCount);
      const refs = staying.filter((s) => opp[s]);
      const markers = rest.slice(0, Math.min(refs.length, rest.length));
      if (markers.length) {
        const score = markers.map((m) => refs.map((r) => 100000 - Math.round(dist(A[m], opp[r]) * 100)));
        const cols = lexOptimalAssignment(score);
        markers.forEach((m, i) => {
          const r = opp[refs[cols[i]]];
          own[m] = { x: r.x - 2.5, y: r.y + (Math.sign(pitch.width_m / 2 - r.y) || 0) * 1 };
          roles[m] = "REST_MARKER";
        });
      }
      for (const free of rest.slice(markers.length)) {
        const minX = refs.length ? Math.min(...refs.map((r) => opp[r].x)) : 47;
        own[free] = { x: minX - 6, y: pitch.width_m / 2 + 0.3 * (ball.y - pitch.width_m / 2) };
        roles[free] = "REST_FREE";
      }
    }

    frames.push({
      t: r2(kf.t), ...(kf.event ? { event: kf.event } : {}), ...(kf.note ? { note: kf.note } : {}),
      ball: toPt(ball, pitch), own: mapObj(own, (m) => toPt(m, pitch)), opp: mapObj(opp, (m) => toPt(m, pitch)), roles,
    });
  }

  diags.push(...shapeDiagnostics(spec, frames, pitch));
  return {
    schema: "fcs.scene/1", type: spec.type, title: spec.title ?? spec.type, pitch,
    own_labels: { ...defaultLabels(spec.own.formation), ...(spec.own.labels ?? {}) },
    opp_labels: { ...defaultLabels(spec.opp.formation), ...(spec.opp.labels ?? {}) },
    frames, diagnostics: diags,
  };
}

/** SHAPE-01/02 y PRESS-01 sobre el equipo que defiende (docs/32 §3). */
function shapeDiagnostics(spec: SceneSpec, frames: SceneFrame[], pitch: Pitch): Diagnostic[] {
  if (spec.type === "REST_DEFENSE") return [];
  const out: Diagnostic[] = [];
  const formation = spec.type === "PRESS_OPP" ? spec.opp.formation : spec.own.formation;
  const team = (f: SceneFrame) => (spec.type === "PRESS_OPP" ? f.opp : f.own);
  const slots = slotsOf(formation);
  const first = frames[0];
  if (first) {
    const pos = team(first);
    const lines: Record<string, number[]> = {};
    for (const s of slots) { const l = lineOf(s.slot, s.u); if (l !== "GK") (lines[l] ??= []).push(pos[s.slot].u * pitch.length_m); }
    const xs = ["DEF", "MID", "ATT"].filter((l) => lines[l]).map((l) => mean(lines[l]));
    for (let i = 1; i < xs.length; i++) {
      const gap = Math.abs(xs[i] - xs[i - 1]);
      if (gap < 6 || gap > 20) out.push({ rule_id: "SHAPE-01", class: "TACTICAL", severity: "warning", message: `Recomendación: ${gap.toFixed(1)} m entre líneas (lo habitual es 6–20 m).` });
    }
    if (xs.length > 1 && Math.abs(xs[xs.length - 1] - xs[0]) > 40)
      out.push({ rule_id: "SHAPE-01", class: "TACTICAL", severity: "warning", message: "Recomendación: el bloque mide más de 40 m." });
    const def = slots.filter((s) => lineOf(s.slot, s.u) === "DEF").map((s) => pos[s.slot].u * pitch.length_m);
    if (def.length > 1 && Math.max(...def) - Math.min(...def) > 2 + 1e-6)
      out.push({ rule_id: "SHAPE-02", class: "TACTICAL", severity: "warning", message: "Recomendación: la línea defensiva no está alineada (±2 m)." });
  }
  for (const j of spec.params.jumps ?? []) {
    const f = frames.find((x) => x.event === "TRIGGER");
    if (!f) continue;
    const before = frames[frames.indexOf(f) - 1] ?? f;
    const target = spec.type === "PRESS_OPP" ? before.own[j.to] : before.opp[j.to];
    const mine = team(before);
    if (!target || !mine[j.who]) continue;
    const d = (s: string) => Math.hypot((mine[s].u - target.u) * pitch.length_m, (mine[s].v - target.v) * pitch.width_m);
    const nearest = slots.filter((s) => slotInfo(s.slot).pos !== "GK").map((s) => s.slot).sort((a, b) => d(a) - d(b))[0];
    if (nearest !== j.who) out.push({ rule_id: "PRESS-01", class: "TACTICAL", severity: "info", message: `Información: el más cercano a ${j.to} es ${nearest}, no ${j.who}.` });
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function mapObj<T, U>(o: Record<string, T>, f: (v: T) => U): Record<string, U> {
  const out: Record<string, U> = {};
  for (const k of Object.keys(o).sort()) out[k] = f(o[k]);
  return out;
}
