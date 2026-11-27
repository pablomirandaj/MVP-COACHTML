// Secuencia por pasos (fcs.seq/1): el formato de la ficha de la J5. Cada paso es un estado del campo con su título,
// su frase, los jugadores clave y las flechas de ese paso. La genera el motor a partir de cualquier pieza y la pinta
// el reproductor (@fcs/render) igual en la app y en el HTML exportado. Coordenadas en metros del marco de ataque.
import type { Pitch } from "../types";

/** Recta [x1,y1,x2,y2] o curva cuadrática [x1,y1,cx,cy,x2,y2]. */
export type Line = [number, number, number, number] | [number, number, number, number, number, number];
export interface SeqActor { id: string; team: "OWN" | "OPP"; label: string; kind?: "back" | "edge" | "taker" }
export interface SeqFrame {
  beat: string; txt: string; trig?: boolean; key?: string[];
  /** Cambios de posición respecto al paso anterior. */
  pos?: Record<string, [number, number]>;
  ball?: [number, number];
  runs?: Line[]; passes?: Line[]; blocks?: Line[];
}
export interface Sequence {
  schema: "fcs.seq/1"; title: string; view: "HALF" | "FULL"; pitch: Pitch;
  actors: SeqActor[]; start: Record<string, [number, number]>; ball: [number, number]; frames: SeqFrame[];
}

export const r2 = (x: number) => Math.round(x * 100) / 100;
export const pt = (x: number, y: number): [number, number] => [r2(x), r2(y)];

/** Estado acumulado (posiciones y balón) en cada paso. */
export function sequenceStates(seq: Sequence): { pos: Record<string, [number, number]>; ball: [number, number] }[] {
  const out: { pos: Record<string, [number, number]>; ball: [number, number] }[] = [];
  let pos = { ...seq.start }, ball = seq.ball;
  for (const f of seq.frames) {
    pos = { ...pos, ...(f.pos ?? {}) };
    if (f.ball) ball = f.ball;
    out.push({ pos, ball });
  }
  return out;
}

/** Quita jugadores clave que no existen y pasos vacíos de flechas. */
export function cleanFrame(f: SeqFrame, ids: Set<string>): SeqFrame {
  const out: SeqFrame = { beat: f.beat, txt: f.txt };
  if (f.trig) out.trig = true;
  const key = (f.key ?? []).filter((k) => ids.has(k));
  if (key.length) out.key = [...new Set(key)];
  if (f.pos && Object.keys(f.pos).length) out.pos = Object.fromEntries(Object.entries(f.pos).filter(([k]) => ids.has(k)));
  if (f.ball) out.ball = f.ball;
  for (const k of ["runs", "passes", "blocks"] as const) if (f[k]?.length) out[k] = f[k];
  return out;
}
