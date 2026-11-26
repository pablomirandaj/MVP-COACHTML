import {
  CATALOG_VERSION, ZONES_YAML, ROLES_YAML, MOVEMENTS_YAML, TEMPLATES_YAML, FORMATIONS_YAML, CONSTRAINTS_YAML,
} from "./generated";
import type { Role, MovementType, ZoneId } from "../types";

export { CATALOG_VERSION };
export const ENGINE_VERSION = "0.1.0";

export interface ZoneDef { label: string; rect: { x: [number, number]; y: [number, number] }; anchors: [number, number][] }
export const ZONES = ZONES_YAML.zones as unknown as Record<ZoneId, ZoneDef>;
export const ZONE_ANCHORING = ZONES_YAML.anchoring as unknown as { goal_relative: ZoneId[]; corner_relative: ZoneId[]; proportional: ZoneId[] };
export const MIN_SPACING_M = ZONES_YAML.placement.min_spacing_m as number;

export interface SuitabilityFactor { factor: string; value?: string | string[]; weight: number }
export interface RoleDef { label: string; phases: string[]; movements: MovementType[]; suitability: SuitabilityFactor[] }
export const ROLES = ROLES_YAML.roles as unknown as Record<Role, RoleDef>;
export const HEIGHT_NORM = ROLES_YAML.height_norm as unknown as { min_cm: number; max_cm: number; missing: number };

export interface MovementDef {
  label: string; default_start_zone?: string; end_zone?: string; shape?: string;
  speed?: string | number; anchor?: { kind: string; event: string; ref?: string; offset_s: number };
}
export const MOVEMENTS = MOVEMENTS_YAML.movements as unknown as Record<MovementType, MovementDef>;
export const SPEEDS = MOVEMENTS_YAML.speeds_mps as unknown as Record<string, number>;
export const BALL_SPEEDS = MOVEMENTS_YAML.ball_speeds_mps as unknown as Record<string, number>;
export const TIMELINE = MOVEMENTS_YAML.timeline as unknown as { prep_start_s: number; end_after_arrival_s: number };

export const TEMPLATES = TEMPLATES_YAML.templates as unknown as any[];
export const template = (id: string) => {
  const t = TEMPLATES.find((x) => x.template === id);
  if (!t) throw new Error(`Plantilla desconocida: ${id}`);
  return t;
};

export interface SlotDef { slot: string; u: number; v: number }
export const FORMATIONS = FORMATIONS_YAML.formations as unknown as Record<string, { label: string; voice: string[]; slots: SlotDef[] }>;

export interface RuleDef { id: string; class: string; severity: string; message: string; law?: string }
export const RULES = (CONSTRAINTS_YAML.rules as unknown as RuleDef[]).reduce<Record<string, RuleDef>>((acc, r) => {
  acc[r.id] = r; return acc;
}, {});

export function movementSpeed(t: MovementType): number {
  const s = MOVEMENTS[t]?.speed;
  if (typeof s === "number") return s;
  if (typeof s === "string") return SPEEDS[s];
  return SPEEDS.sprint;
}
