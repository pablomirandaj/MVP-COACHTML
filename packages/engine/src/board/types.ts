// Pizarra libre por pasos (Pizarra Studio §6.3). Actores: "own:<ranura>" y "opp:<ranura>".
import type { Diagnostic, Origin, Pitch, Pt } from "../types";

export type MoveKind = "RUN" | "DRIBBLE" | "MOVE";
export interface BoardMove { actor: string; to: Pt; kind: MoveKind; origin: Origin }
export interface BoardPass { from: string; to: string | Pt; kind: "GROUND" | "AIR"; origin: Origin }
export interface BoardPress { actor: string; target: string }
export interface BoardStep {
  id: string;
  moves: BoardMove[];
  pass?: BoardPass;
  press?: BoardPress[];
  note?: { title: string; implies: string; origin: Origin };
  /** Jugadores protagonistas del paso (borde dorado en el reproductor). */
  key?: string[];
  /** Paso clave: «AHORA». */
  trig?: boolean;
}
export interface BoardDoc {
  schema: "fcs.board/1";
  title: string;
  pitch: Pitch;
  own: { formation: string; labels: Record<string, string> };
  opp: { formation: string };
  start: { own: Record<string, Pt>; opp: Record<string, Pt>; ball: Pt };
  steps: BoardStep[];
  diagnostics: { rule_id: string; class: Diagnostic["class"]; severity: Diagnostic["severity"]; message: string; actors?: string[] }[];
}

/** Estado tras cada paso: posiciones, poseedor del balón (actor) o punto libre. */
export interface BoardState { pos: Record<string, Pt>; holder: string | null; ball: Pt }
