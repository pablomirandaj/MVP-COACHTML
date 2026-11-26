// Reglas de la pizarra: BOARD-02 (jugadores encima), BOARD-03 (pase arriesgado), BOARD-04 (fuera de juego).
import type { Pt } from "../types";
import { states } from "./state";
import type { BoardDoc } from "./types";

export const MAX_SAFE_PASS_M = 45, LANE_RISK_M = 1.5;

export function validateBoard(doc: BoardDoc): BoardDoc["diagnostics"] {
  const L = doc.pitch.length_m, W = doc.pitch.width_m;
  const m = (p: Pt) => ({ x: p.u * L, y: p.v * W });
  const out: BoardDoc["diagnostics"] = [];
  const st = states(doc);
  doc.steps.forEach((step, i) => {
    const before = st[i], after = st[i + 1], n = i + 1;
    const own = Object.keys(after.pos).filter((k) => k.startsWith("own:"));
    for (let a = 0; a < own.length; a++) for (let b = a + 1; b < own.length; b++) {
      const p = m(after.pos[own[a]]), q = m(after.pos[own[b]]);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 1) out.push({ rule_id: "BOARD-02", class: "GEOMETRY", severity: "warning", actors: [own[a], own[b]], message: `Paso ${n}: ${doc.own.labels[own[a].slice(4)] ?? own[a]} y ${doc.own.labels[own[b].slice(4)] ?? own[b]} están a menos de 1 m.` });
    }
    const ps = step.pass;
    if (!ps) return;
    const moved = step.moves.find((x) => x.actor === ps.from);
    const a = m(moved ? moved.to : before.pos[ps.from] ?? before.ball);
    const target = typeof ps.to === "string" ? after.pos[ps.to] : ps.to;
    if (!target) return;
    const b = m(target), len = Math.hypot(b.x - a.x, b.y - a.y);
    const opp = Object.entries(after.pos).filter(([k]) => k.startsWith("opp:"));
    const close = opp.filter(([, p]) => {
      const o = m(p), t = len ? Math.max(0, Math.min(1, ((o.x - a.x) * (b.x - a.x) + (o.y - a.y) * (b.y - a.y)) / (len * len))) : 0;
      return Math.hypot(o.x - (a.x + t * (b.x - a.x)), o.y - (a.y + t * (b.y - a.y))) < LANE_RISK_M;
    });
    if (len > MAX_SAFE_PASS_M || (ps.kind === "GROUND" && close.length))
      out.push({ rule_id: "BOARD-03", class: "TACTICAL", severity: "warning", actors: [ps.from, ...close.map(([k]) => k)],
        message: `Paso ${n}: riesgo de pérdida (${len > MAX_SAFE_PASS_M ? `pase de ${Math.round(len)} m` : "un rival corta la línea de pase"}).` });
    // Fuera de juego: receptor por delante del balón y del penúltimo rival, en campo contrario, al salir el pase.
    if (typeof ps.to === "string") {
      const r = m(before.pos[ps.to]);
      const xs = opp.map(([, p]) => m(p).x).sort((x, y) => y - x);
      const second = xs[1] ?? L;
      if (r.x > L / 2 && r.x > a.x && r.x > second + 0.01)
        out.push({ rule_id: "BOARD-04", class: "LAW", severity: "warning", actors: [ps.to], message: `Paso ${n}: el receptor está en fuera de juego al salir el pase.` });
    }
  });
  return out;
}
