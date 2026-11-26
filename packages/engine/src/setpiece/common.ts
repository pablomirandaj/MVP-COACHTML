import { MOVEMENTS } from "../catalog/index";
import type { Foot, MovementType, Role, Side, Swing, ZoneId } from "../types";

export const SCORING_ZONES: ZoneId[] = ["Z_NEAR_POST", "Z_FAR_POST", "Z_GA_CENTER", "Z_PEN_SPOT", "Z_FAR_ZONE"];
export const ATTACKING_ROLES: Role[] = ["PRIMARY_TARGET", "SECONDARY_TARGET", "BLOCKER", "DECOY"];

/** Orden de identificadores y de presentación (de la jugada hacia atrás). */
export const ACTOR_ORDER: Role[] = [
  "TAKER", "BLOCKER", "PRIMARY_TARGET", "SECONDARY_TARGET", "DECOY", "SHORT_RECEIVER", "GK_SCREEN", "REBOUND", "COVER", "REST_DEFENDER",
];

export const ATTACK_FOR_ZONE: Partial<Record<ZoneId, MovementType>> = {
  Z_NEAR_POST: "ATTACK_NEAR_POST", Z_FAR_POST: "ATTACK_FAR_POST", Z_PEN_SPOT: "ATTACK_PEN_SPOT", Z_GA_CENTER: "ATTACK_GA_CENTER",
};

export const HOLD_ZONE_FOR_ROLE: Partial<Record<Role, ZoneId>> = {
  REBOUND: "Z_REBOUND", REST_DEFENDER: "Z_REST", GK_SCREEN: "Z_GK", SHORT_RECEIVER: "Z_SHORT", COVER: "Z_EDGE",
};

/** TECH-SWING-01: con golpeo de interior, pie contrario a la banda → cerrado; mismo lado → abierto. */
export function naturalSwing(foot: Foot, side: Side, outsideFoot = false): Swing | null {
  if (foot === "BOTH") return null;
  const inswing = (foot === "RIGHT" && side === "LEFT") || (foot === "LEFT" && side === "RIGHT");
  const s: Swing = inswing ? "INSWING" : "OUTSWING";
  return outsideFoot ? (s === "INSWING" ? "OUTSWING" : "INSWING") : s;
}

export function roleForMovement(m: MovementType): Role {
  if (m === "SCREEN") return "BLOCKER";
  if (m === "DECOY_RUN") return "DECOY";
  if (m === "SHORT_OPTION") return "SHORT_RECEIVER";
  if (m === "HOLD") return "REBOUND";
  return "SECONDARY_TARGET";
}

export function roleForZone(z: ZoneId): Role {
  if (z === "Z_REBOUND" || z === "Z_EDGE") return "REBOUND";
  if (z === "Z_REST") return "REST_DEFENDER";
  if (z === "Z_GK") return "GK_SCREEN";
  if (z === "Z_SHORT") return "SHORT_RECEIVER";
  return "SECONDARY_TARGET";
}

export function endZoneOf(m: MovementType): ZoneId | null {
  const e = MOVEMENTS[m]?.end_zone;
  return e && e.startsWith("Z_") ? (e as ZoneId) : null;
}
export function startZoneOf(m: MovementType): ZoneId {
  const s = MOVEMENTS[m]?.default_start_zone;
  return s && s.startsWith("Z_") ? (s as ZoneId) : "Z_START_CLUSTER";
}

export const ROLE_ES: Record<string, string> = {
  TAKER: "lanzador", PRIMARY_TARGET: "rematador principal", SECONDARY_TARGET: "rematador secundario", BLOCKER: "bloqueo",
  DECOY: "arrastre", SHORT_RECEIVER: "receptor del corto", REBOUND: "rechace", REST_DEFENDER: "vigilancia",
  GK_SCREEN: "molestar al portero", COVER: "cobertura",
};
