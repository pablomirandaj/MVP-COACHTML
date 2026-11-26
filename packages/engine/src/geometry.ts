// Sistema de coordenadas (docs/14 §1): marco de ataque, normalizado [0,1]² con margen, cálculo en metros.
import { ZONES, ZONE_ANCHORING, type ZoneDef } from "./catalog/index";
import type { M, Pitch, Pt, Side, ZoneId } from "./types";
import { r4 } from "./util/num";

export const DEFAULT_PITCH: Pitch = { length_m: 105, width_m: 68 };
const REF_L = 105, REF_W = 68;

export const toM = (p: Pt, pitch: Pitch): M => ({ x: p.u * pitch.length_m, y: p.v * pitch.width_m });
export const toN = (m: M, pitch: Pitch): Pt => ({ u: r4(m.x / pitch.length_m), v: r4(m.y / pitch.width_m) });
export const dist = (a: M, b: M) => Math.hypot(a.x - b.x, a.y - b.y);
export const add = (a: M, b: M): M => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: M, b: M): M => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: M, k: number): M => ({ x: a.x * k, y: a.y * k });
export const unit = (a: M): M => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };

/** Refleja respecto al eje longitudinal (lado izquierdo ↔ derecho). */
export const mirrorM = (m: M, pitch: Pitch): M => ({ x: m.x, y: pitch.width_m - m.y });

/** Convierte un punto del catálogo (definido para el campo de referencia, lado izquierdo) al campo y lado reales. */
export function catalogPoint(zone: ZoneId, x: number, y: number, side: Side, pitch: Pitch): M {
  const L = pitch.length_m, W = pitch.width_m;
  let p: M;
  if (ZONE_ANCHORING.goal_relative.includes(zone)) p = { x: L - (REF_L - x), y: W / 2 + (y - REF_W / 2) };
  else if (ZONE_ANCHORING.corner_relative.includes(zone)) p = { x: L - (REF_L - x), y };
  else p = { x: (x * L) / REF_L, y: (y * W) / REF_W };
  return side === "RIGHT" ? mirrorM(p, pitch) : p;
}

export interface ResolvedZone { id: ZoneId; x: [number, number]; y: [number, number]; anchors: M[] }

export function resolveZone(zone: ZoneId, side: Side, pitch: Pitch): ResolvedZone {
  const def: ZoneDef = ZONES[zone];
  if (!def) throw new Error(`Zona desconocida: ${zone}`);
  const c1 = catalogPoint(zone, def.rect.x[0], def.rect.y[0], side, pitch);
  const c2 = catalogPoint(zone, def.rect.x[1], def.rect.y[1], side, pitch);
  return {
    id: zone,
    x: [Math.min(c1.x, c2.x), Math.max(c1.x, c2.x)],
    y: [Math.min(c1.y, c2.y), Math.max(c1.y, c2.y)],
    anchors: def.anchors.map(([x, y]) => catalogPoint(zone, x, y, side, pitch)),
  };
}

/**
 * Coloca n puntos en una zona respetando la separación mínima con los ya ocupados (docs/14 §3):
 * primero las anclas en orden, después una rejilla de 1 m (x desc, |y - ancla0.y| asc, y asc).
 */
export function placeInZone(zone: ResolvedZone, occupied: M[], minSpacing: number): M {
  const ok = (p: M) => occupied.every((o) => dist(o, p) >= minSpacing - 1e-9);
  for (const a of zone.anchors) if (ok(a)) return a;
  const a0 = zone.anchors[0];
  const grid: M[] = [];
  for (let x = Math.floor(zone.x[1]); x >= Math.ceil(zone.x[0]); x--)
    for (let y = Math.ceil(zone.y[0]); y <= Math.floor(zone.y[1]); y++) grid.push({ x, y });
  grid.sort((p, q) => q.x - p.x || Math.abs(p.y - a0.y) - Math.abs(q.y - a0.y) || p.y - q.y);
  for (const g of grid) if (ok(g)) return g;
  return a0; // zona saturada: se devuelve el ancla y la regla GEO-SPACING-01 avisará
}

/** Bézier cuadrática y su longitud por muestreo (determinista, 32 segmentos). */
export function quad(p0: M, c: M, p1: M, s: number): M {
  const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, d = s * s;
  return { x: a * p0.x + b * c.x + d * p1.x, y: a * p0.y + b * c.y + d * p1.y };
}
export function quadLength(p0: M, c: M, p1: M, segments = 32): number {
  let len = 0, prev = p0;
  for (let i = 1; i <= segments; i++) { const q = quad(p0, c, p1, i / segments); len += dist(prev, q); prev = q; }
  return len;
}
/** Punto de control perpendicular a la cuerda; side = +1 hacia x mayor (línea de fondo rival), -1 hacia el campo. */
export function controlPoint(p0: M, p1: M, k: number, towardGoal: 1 | -1): M {
  const mid = scale(add(p0, p1), 0.5);
  const d = sub(p1, p0), len = Math.hypot(d.x, d.y) || 1;
  let n: M = { x: -d.y / len, y: d.x / len };
  if (Math.sign(n.x) !== towardGoal && n.x !== 0) n = scale(n, -1);
  return add(mid, scale(n, k * len));
}
