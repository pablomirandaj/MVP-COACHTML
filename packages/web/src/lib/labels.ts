export const POSITIONS: Record<string, string> = {
  GK: "Portero", RB: "Lateral derecho", LB: "Lateral izquierdo", RWB: "Carrilero derecho", LWB: "Carrilero izquierdo", CB: "Central",
  DM: "Mediocentro defensivo", CM: "Mediocentro", RM: "Medio derecho", LM: "Medio izquierdo", AM: "Mediapunta", RW: "Extremo derecho",
  LW: "Extremo izquierdo", ST: "Delantero centro", SS: "Segundo delantero",
};
export const SLOT_ABBR: Record<string, string> = {
  GK: "POR", RB: "LD", LB: "LI", RWB: "CAD", LWB: "CAI", CB: "DFC", DM: "MCD", CM: "MC", RM: "MD", LM: "MI", AM: "MCO", RW: "ED", LW: "EI", ST: "DC", SS: "SD",
};
export const slotLabel = (slot: string) => {
  const [pos, side] = slot.split("_");
  return `${SLOT_ABBR[pos] ?? pos}${side === "L" ? " izq." : side === "R" ? " der." : ""}`;
};
export const FOOT: Record<string, string> = { RIGHT: "Diestro", LEFT: "Zurdo", BOTH: "Ambidiestro" };
export const STATUS: Record<string, string> = { AVAILABLE: "Disponible", INJURED: "Lesionado", SUSPENDED: "Sancionado", UNAVAILABLE: "No disponible", DOUBTFUL: "Duda" };
export const ATTRIBUTES: Record<string, string> = {
  aerial: "Juego aéreo", pace: "Velocidad", physical: "Físico", long_shot: "Disparo lejano", technical: "Técnica", finishing: "Definición", set_piece_specialist: "Especialista ABP",
};
export const SETPIECE_ROLES: Record<string, string> = {
  corner_taker_left: "Saca córners desde la izquierda", corner_taker_right: "Saca córners desde la derecha", primary_target: "Rematador principal", blocker: "Bloqueador",
};
export const ROLES: Record<string, string> = {
  TAKER: "Lanzador", PRIMARY_TARGET: "Rematador principal", SECONDARY_TARGET: "Rematador secundario", BLOCKER: "Bloqueo", DECOY: "Arrastre",
  SHORT_RECEIVER: "Receptor del corto", REBOUND: "Rechace", REST_DEFENDER: "Vigilancia", GK_SCREEN: "Molestar al portero", COVER: "Cobertura",
};
export const ZONES: Record<string, string> = {
  Z_NEAR_POST: "Primer palo", Z_FAR_POST: "Segundo palo", Z_GA_CENTER: "Centro del área pequeña", Z_PEN_SPOT: "Punto de penalti", Z_FAR_ZONE: "Fuera del segundo palo",
  Z_EDGE: "Frontal", Z_REBOUND: "Rechace", Z_GK: "Junto al portero", Z_SHORT: "En corto", Z_REST: "Vigilancia", Z_START_CLUSTER: "Salida agrupada",
};
export const SCENE_TYPES: Record<string, string> = {
  PRESS_OWN: "Nuestra presión", PRESS_OPP: "Presión del rival", RETREAT: "Repliegue", REST_DEFENSE: "Vigilancias en ataque",
};
export const ANALYSIS_CATEGORIES: Record<string, string> = {
  SYSTEM: "Sistema de juego", OFFENSIVE_ORG: "Organización ofensiva", DEFENSIVE_ORG: "Organización defensiva", PRESSING: "Presión", TRANSITIONS: "Transiciones",
  STRENGTH: "Punto fuerte", WEAKNESS: "Punto débil", SET_PIECES_ATT: "Su balón parado ofensivo", SET_PIECES_DEF: "Su balón parado defensivo",
  KEY_PLAYERS: "Jugador relevante", COACH_RECOMMENDATION: "Nuestra idea", OTHER: "Otro",
};
export const severityIcon = (s: string) => (s === "error" ? "⛔" : s === "warning" ? "⚠️" : "ℹ️");
export const ruleClass = (c?: string) => (c === "LAW" ? "Reglamento" : c === "TECHNIQUE" ? "Técnica" : c === "TACTICAL" ? "Recomendación" : c === "SEQUENCE" ? "Secuencia" : c === "LINEUP" ? "Alineación" : "Aviso");
export const fmtDate = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  : "Fecha por confirmar";
