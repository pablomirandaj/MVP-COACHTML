// Redondeo determinista (docs/15 §14): 4 decimales para coordenadas normalizadas, 2 para tiempos y metros.
export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
}
export const r4 = (n: number) => roundTo(n, 4);
export const r2 = (n: number) => roundTo(n, 2);
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
