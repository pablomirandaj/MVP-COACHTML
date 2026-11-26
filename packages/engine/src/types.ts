// Tipos del dominio (docs/14) y del documento de jugada fcs.play/1 (docs/engine/play.schema.json).

export type Foot = "RIGHT" | "LEFT" | "BOTH";
export type PlayerStatus = "AVAILABLE" | "INJURED" | "SUSPENDED" | "UNAVAILABLE" | "DOUBTFUL";

export interface Player {
  id: string;
  n?: number; // dorsal
  name: string;
  surname?: string;
  pos: string; // posición principal (GK, CB, RW…)
  secondary?: string[];
  foot: Foot;
  height?: number;
  tags?: string[];
  setpiece?: string[];
  status: PlayerStatus;
}

export interface Pitch { length_m: number; width_m: number }
export interface Pt { u: number; v: number }
export interface M { x: number; y: number }

export type Side = "LEFT" | "RIGHT";
export type Origin = string; // EXPLICIT | TEAM_PREF | MANUAL | ASSISTANT | RULE:<id>

export type Role =
  | "TAKER" | "PRIMARY_TARGET" | "SECONDARY_TARGET" | "BLOCKER" | "DECOY" | "SHORT_RECEIVER"
  | "REBOUND" | "REST_DEFENDER" | "GK_SCREEN" | "COVER" | "ZONAL_DEFENDER" | "MAN_MARKER"
  | "POST_GUARD" | "EDGE_GUARD" | "COUNTER_OUTLET" | "WALL" | "GOALKEEPER";

export type MovementType =
  | "ATTACK_NEAR_POST" | "ATTACK_FAR_POST" | "ATTACK_PEN_SPOT" | "ATTACK_GA_CENTER" | "RUN_IN_BEHIND"
  | "DECOY_RUN" | "SCREEN" | "CROSS_RUN" | "LATE_ARRIVAL" | "CHECK_TO_BALL" | "SHORT_OPTION" | "HOLD" | "FOLLOW";

export type ZoneId =
  | "Z_NEAR_POST" | "Z_FAR_POST" | "Z_GA_CENTER" | "Z_PEN_SPOT" | "Z_FAR_ZONE" | "Z_EDGE"
  | "Z_REBOUND" | "Z_GK" | "Z_SHORT" | "Z_REST" | "Z_START_CLUSTER";

export type Swing = "INSWING" | "OUTSWING" | "NONE";
export type Trajectory = "DRIVEN" | "LOFTED" | "LOW" | "SHORT";

export interface Actor {
  id: string;
  team: "OWN" | "OPP";
  player_id?: string | null;
  label: string;
  role: Role;
  start: Pt;
  action_zone?: ZoneId;
  group?: string;
  locked?: boolean;
  provenance: Record<string, Origin>;
}

export interface Anchor { kind: "STARTS_AT" | "ARRIVES_AT"; event: "KICK" | "BALL_ARRIVAL" | "MOVEMENT_START" | "MOVEMENT_END"; ref?: string; offset_s: number; /** No arrancar antes de este instante (p. ej. 0 = el golpeo, por el fuera de juego). */ not_before_s?: number }

export interface Movement {
  id: string;
  actor: string;
  type: MovementType;
  path: Pt[];
  shape?: "STRAIGHT" | "CURVED_IN" | "CURVED_OUT" | "POLYLINE";
  speed_mps?: number;
  anchor?: Anchor;
  t_start: number;
  t_end: number;
  depends_on?: string[];
  provenance: Record<string, Origin>;
}

export interface Delivery {
  taker_actor: string;
  ball_start: Pt;
  swing: Swing;
  trajectory: Trajectory;
  technique: "INSIDE_FOOT" | "OUTSIDE_FOOT" | "INSTEP";
  target_zone: ZoneId;
  target_point: Pt;
  curve: number;
  kick_t: 0;
  arrival_t: number;
  provenance: Record<string, Origin>;
}

export interface Relation {
  type: "SCREENS" | "CROSSES_WITH" | "MARKS";
  blocker?: string; defender?: string; beneficiary?: string; a?: string; b?: string;
  strict_legal?: boolean;
  origin: Origin;
}

export type Severity = "error" | "warning" | "info" | "clarification";
export interface Diagnostic {
  rule_id: string;
  class: "LAW" | "GEOMETRY" | "ROSTER" | "TECHNIQUE" | "TACTICAL" | "SEQUENCE" | "LINEUP";
  severity: Severity;
  message: string;
  actors?: string[];
}

export interface PlayDoc {
  schema: "fcs.play/1";
  engine_version: string;
  catalog_version: string;
  template: string | null;
  type: string;
  side: Side;
  pitch: Pitch;
  /** Línea de fuera de juego del rival en el golpeo (u normalizada), si aplica (faltas). */
  offside_x?: number;
  delivery: Delivery;
  actors: Actor[];
  movements: Movement[];
  relations: Relation[];
  constraints: { actor: string; rule: string; origin: Origin }[];
  notes: { id: string; text: string; origin: Origin; anchor_actor?: string }[];
  diagnostics: Diagnostic[];
}

/** Comando IR (docs/engine/command-ir.schema.json). Se tipa de forma laxa: lo valida el esquema. */
export type Command = { op: string; [k: string]: any };

export interface ClarificationOption { label: string; commands: Command[] }
export interface Clarification { id: string; code: string; question: string; options: ClarificationOption[] }

export interface EngineContext {
  pitch: Pitch;
  roster: Player[];
  /** Jugadores del once (ids) disponibles para asignar roles; si falta, se usa la plantilla disponible. */
  lineupPlayerIds?: string[];
}
