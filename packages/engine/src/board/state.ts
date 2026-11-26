// Estado de la pizarra paso a paso (función pura).
import type { Pt } from "../types";
import type { BoardDoc, BoardState, BoardStep } from "./types";

export const PRESS_GAP_M = 1.5;
const clampPt = (p: Pt): Pt => ({ u: Math.min(1, Math.max(0, p.u)), v: Math.min(1, Math.max(0, p.v)) });

export function initialState(doc: BoardDoc): BoardState {
  const pos: Record<string, Pt> = {};
  for (const [k, p] of Object.entries(doc.start.own)) pos[`own:${k}`] = p;
  for (const [k, p] of Object.entries(doc.start.opp)) pos[`opp:${k}`] = p;
  const L = doc.pitch.length_m, W = doc.pitch.width_m;
  let holder: string | null = null, best = 3;
  for (const [id, p] of Object.entries(pos)) {
    if (!id.startsWith("own:")) continue;
    const d = Math.hypot((p.u - doc.start.ball.u) * L, (p.v - doc.start.ball.v) * W);
    if (d < best || (d === best && holder !== null && id < holder)) { best = d; holder = id; }
  }
  return { pos, holder, ball: doc.start.ball };
}

/** Destino de un presionador: a 1,5 m del rival, del lado de su portería. */
export function pressPoint(doc: BoardDoc, from: Pt, target: Pt): Pt {
  const L = doc.pitch.length_m, W = doc.pitch.width_m;
  const dx = (from.u - target.u) * L, dy = (from.v - target.v) * W, n = Math.hypot(dx, dy) || 1;
  return clampPt({ u: target.u + (dx / n) * PRESS_GAP_M / L, v: target.v + (dy / n) * PRESS_GAP_M / W });
}

export function applyStep(doc: BoardDoc, prev: BoardState, step: BoardStep): BoardState {
  const pos = { ...prev.pos };
  for (const m of step.moves) if (pos[m.actor]) pos[m.actor] = m.to;
  for (const p of step.press ?? []) if (pos[p.actor] && pos[p.target]) pos[p.actor] = pressPoint(doc, prev.pos[p.actor], pos[p.target]);
  let holder = prev.holder, ball = prev.ball;
  const dribble = step.moves.find((m) => m.kind === "DRIBBLE" && m.actor === holder);
  if (dribble) ball = dribble.to;
  if (step.pass) {
    if (typeof step.pass.to === "string") { holder = step.pass.to; ball = pos[step.pass.to] ?? ball; }
    else { holder = null; ball = step.pass.to; }
  } else if (holder) ball = pos[holder];
  return { pos, holder, ball };
}

export function states(doc: BoardDoc): BoardState[] {
  const out = [initialState(doc)];
  for (const s of doc.steps) out.push(applyStep(doc, out[out.length - 1], s));
  return out;
}
