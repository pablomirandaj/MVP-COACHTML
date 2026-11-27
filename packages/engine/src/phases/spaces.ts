// Ataque a espacios (Pizarra Studio §6.2): huecos del bloque rival según su colocación, en nuestro marco
// (atacamos hacia x = L). Las líneas rivales se agrupan por x con un umbral de 6 m.
import { slotInfo } from "../lineup";
import type { M, Pitch, Pt, Side } from "../types";

export type SpaceKind = "BETWEEN_LINES" | "BEHIND_FULLBACK" | "WEAK_SIDE" | "HALF_SPACE";
export interface Space {
  kind: SpaceKind; side: Side | "CENTER"; center: Pt; area_m2: number;
  /** Rectángulo del espacio en coordenadas normalizadas. */
  rect: { u: [number, number]; v: [number, number] };
}
export const SPACE_LABEL: Record<SpaceKind, string> = {
  BETWEEN_LINES: "entre líneas", BEHIND_FULLBACK: "la espalda del lateral", HALF_SPACE: "el carril interior", WEAK_SIDE: "el lado débil",
};
export const SPACE_WHY: Record<SpaceKind, string> = {
  BETWEEN_LINES: "Recibir entre su medio y su defensa obliga a un central a salir y abre la línea.",
  BEHIND_FULLBACK: "Su lateral está adelantado: el desmarque a su espalda deja al central en un 1 contra 1 en campo abierto.",
  HALF_SPACE: "Entre su lateral y su central nadie tiene la marca clara: desde ahí se llega al área de cara.",
  WEAK_SIDE: "Su bloque ha basculado: un cambio de orientación encuentra al extremo solo.",
};

const LINE_GAP_M = 6, LANE_FREE_M = 6, ORDER: SpaceKind[] = ["BETWEEN_LINES", "BEHIND_FULLBACK", "HALF_SPACE", "WEAK_SIDE"];
const SIDE_ORDER = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

function make(kind: SpaceKind, side: Space["side"], x: [number, number], y: [number, number], pitch: Pitch): Space | null {
  const L = pitch.length_m, W = pitch.width_m;
  const x0 = Math.max(0, x[0]), x1 = Math.min(L, x[1]), y0 = Math.max(0, y[0]), y1 = Math.min(W, y[1]);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  return {
    kind, side, area_m2: Math.round((x1 - x0) * (y1 - y0)),
    center: { u: r4((x0 + x1) / 2 / L), v: r4((y0 + y1) / 2 / W) },
    rect: { u: [r4(x0 / L), r4(x1 / L)], v: [r4(y0 / W), r4(y1 / W)] },
  };
}

export function findSpaces(opp: Record<string, Pt>, pitch: Pitch): Space[] {
  const L = pitch.length_m, W = pitch.width_m;
  const field = Object.entries(opp).filter(([k]) => slotInfo(k).pos !== "GK").map(([k, p]) => ({ k, x: p.u * L, y: p.v * W }))
    .sort((a, b) => a.x - b.x || a.k.localeCompare(b.k));
  if (field.length < 3) return [];
  const lines: (typeof field)[] = [];
  for (const p of field) {
    const cur = lines[lines.length - 1];
    if (cur && p.x - cur[cur.length - 1].x <= LINE_GAP_M) cur.push(p); else lines.push([p]);
  }
  const mean = (l: typeof field) => l.reduce((s, p) => s + p.x, 0) / l.length;
  const def = lines[lines.length - 1], mid = lines.length > 1 ? lines[lines.length - 2] : undefined;
  const xDef = mean(def), xMid = mid ? mean(mid) : xDef - 20;
  const out: (Space | null)[] = [];
  const near = (x: number, y: number, r: number) => field.some((p) => Math.hypot(p.x - x, p.y - y) < r);

  if (xDef - xMid >= 8) {
    const lanes: [Space["side"], number, number][] = [["LEFT", 8, W / 3], ["CENTER", W / 3, (2 * W) / 3], ["RIGHT", (2 * W) / 3, W - 8]];
    for (const [side, y0, y1] of lanes) if (!near((xMid + xDef) / 2, (y0 + y1) / 2, LANE_FREE_M)) out.push(make("BETWEEN_LINES", side, [xMid + 2, xDef - 2], [y0, y1], pitch));
  }
  const byY = [...def].sort((a, b) => a.y - b.y || a.k.localeCompare(b.k));
  const left = byY[0], right = byY[byY.length - 1];
  out.push(make("BEHIND_FULLBACK", "LEFT", [left.x + 1, L - 6], [1, 15], pitch));
  out.push(make("BEHIND_FULLBACK", "RIGHT", [right.x + 1, L - 6], [W - 15, W - 1], pitch));
  if (byY.length >= 4) {
    for (const [side, a, b] of [["LEFT", byY[0], byY[1]], ["RIGHT", byY[byY.length - 2], byY[byY.length - 1]]] as const)
      if (b.y - a.y > 10) out.push(make("HALF_SPACE", side, [xDef - 8, xDef + 4], [a.y + 3, b.y - 3], pitch));
  }
  const block = [...def, ...(mid ?? [])];
  const minY = Math.min(...block.map((p) => p.y)), maxY = Math.max(...block.map((p) => p.y));
  if (minY > 25) out.push(make("WEAK_SIDE", "LEFT", [xMid - 5, xDef + 5], [0, minY - 3], pitch));
  if (W - maxY > 25) out.push(make("WEAK_SIDE", "RIGHT", [xMid - 5, xDef + 5], [maxY + 3, W], pitch));

  return (out.filter(Boolean) as Space[]).sort((a, b) =>
    b.area_m2 - a.area_m2 || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || SIDE_ORDER[a.side] - SIDE_ORDER[b.side]);
}

/** Nuestra forma en ataque escalada al bloque rival: delanteros en su línea defensiva (sin fuera de juego). */
export function attackShape(slots: { slot: string; u: number; v: number }[], xDef: number, pitch: Pitch): Record<string, M> {
  const W = pitch.width_m, maxU = Math.max(...slots.map((s) => s.u));
  const out: Record<string, M> = {};
  for (const s of slots) {
    const gk = slotInfo(s.slot).pos === "GK";
    const x = gk ? 14 : 22 + ((s.u - 0.15) / Math.max(0.01, maxU - 0.15)) * (xDef - 1 - 22);
    out[s.slot] = { x, y: Math.min(W - 2, Math.max(2, (0.5 + (s.v - 0.5) * 1.2) * W)) };
  }
  return out;
}
