// Vocabulario de entrenador (español de España): puestos, numeración por puesto, alias por sistema y conceptos
// tácticos. Determinista: traduce lo que dice el entrenador ("el pivote", "el que juega de 6", "los interiores",
// "Raúl") a ranuras del sistema; si un dorsal y un puesto apuntan a jugadores distintos, lo marca como ambiguo.
import { FORMATIONS } from "../catalog/index";
import { slotInfo } from "../lineup";
import type { Player } from "../types";

/** Números por puesto (numeración clásica española). */
export const ROLE_NUMBER_ES: Record<string, number[]> = { GK: [1], RB: [2], RWB: [2], LB: [3], LWB: [3], CB: [4, 5], DM: [6], CM: [8, 10], AM: [10], RW: [7], RM: [7], LW: [11], LM: [11], ST: [9], SS: [9] };

interface Alias { text: string; pos: string[]; side?: "L" | "R" | "C"; plural?: boolean }
const A = (text: string, pos: string[], side?: Alias["side"], plural?: boolean): Alias => ({ text, pos, ...(side ? { side } : {}), ...(plural ? { plural } : {}) });
const ALIASES: Alias[] = [
  A("portero", ["GK"]), A("guardameta", ["GK"]), A("arquero", ["GK"]), A("meta", ["GK"]),
  A("centrales", ["CB"], undefined, true), A("defensa central", ["CB"]), A("central izquierdo", ["CB"], "L"), A("central derecho", ["CB"], "R"),
  A("central del medio", ["CB"], "C"), A("libero", ["CB"], "C"), A("central", ["CB"]), A("zagueros", ["CB"], undefined, true), A("zaguero", ["CB"]),
  A("laterales", ["RB", "LB", "RWB", "LWB"], undefined, true), A("lateral derecho", ["RB", "RWB"], "R"), A("lateral izquierdo", ["LB", "LWB"], "L"),
  A("carrileros", ["RWB", "LWB"], undefined, true), A("carrilero derecho", ["RWB", "RB"], "R"), A("carrilero izquierdo", ["LWB", "LB"], "L"),
  A("doble pivote", ["DM"], undefined, true), A("pivotes", ["DM"], undefined, true), A("pivote izquierdo", ["DM"], "L"), A("pivote derecho", ["DM"], "R"),
  A("pivote", ["DM"]), A("mediocentro defensivo", ["DM"]), A("medio centro defensivo", ["DM"]), A("medio de la base", ["DM"]), A("ancla", ["DM"]),
  A("mediocentro de contencion", ["DM"]),
  A("interiores", ["CM"], undefined, true), A("interior izquierdo", ["CM"], "L"), A("interior derecho", ["CM"], "R"), A("interior", ["CM"]),
  A("mediocentros", ["CM"], undefined, true), A("mediocentro", ["CM", "DM"]), A("medio centro", ["CM", "DM"]),
  A("mediapunta", ["AM"]), A("media punta", ["AM"]), A("enganche", ["AM"]),
  A("medio derecho", ["RM"]), A("medio izquierdo", ["LM"]), A("volante derecho", ["RM"]), A("volante izquierdo", ["LM"]),
  A("extremos", ["RW", "LW"], undefined, true), A("extremo derecho", ["RW"]), A("extremo izquierdo", ["LW"]),
  A("delanteros", ["ST"], undefined, true), A("puntas", ["ST"], undefined, true), A("delantero centro", ["ST"]), A("falso 9", ["ST"]), A("falso nueve", ["ST"]),
  A("delantero", ["ST"]), A("ariete", ["ST"]), A("punta", ["ST"]), A("nueve", ["ST"]),
];

export interface Concept { term: string[]; meaning: string; command: string }
/** Conceptos tácticos frecuentes y la orden del motor que les corresponde. */
export const CONCEPTS: Concept[] = [
  { term: ["salida lavolpiana", "salida de tres", "el pivote entre centrales"], meaning: "El pivote baja entre los centrales, que se abren; los laterales suben.", command: "update_scene BUILD_UP params.structure \"3+1\"" },
  { term: ["salida con dos", "2+1"], meaning: "Los centrales abiertos y el pivote por delante, entre ellos.", command: "update_scene BUILD_UP params.structure \"2+1\"" },
  { term: ["lateral por dentro", "falso lateral"], meaning: "El lateral del lado débil cierra al carril interior.", command: "update_scene BUILD_UP params.structure \"FB_INSIDE\"" },
  { term: ["saltar", "saltar a la presion", "ir a presionar", "apretar"], meaning: "Un jugador sale a presionar a un rival.", command: "board.press {actor, target} / params.jumps [{who, to}]" },
  { term: ["tapar el pase al portero", "cerrar la linea con el portero"], meaning: "El delantero presiona al central cortando el pase a su portero.", command: "params.jumps [{who: ST, to: CB, curve: \"SCREEN_GK\"}]" },
  { term: ["bascular", "basculacion"], meaning: "El bloque se desplaza hacia el lado del balón.", command: "params.lateral_shift (0–1)" },
  { term: ["bloque alto", "presion alta"], meaning: "Defendemos lejos de nuestra portería.", command: "params.block_height \"HIGH\"" },
  { term: ["bloque medio"], meaning: "Defendemos alrededor de medio campo.", command: "params.block_height \"MID\"" },
  { term: ["bloque bajo", "replegar", "repliegue"], meaning: "Defendemos cerca de nuestra área.", command: "type RETREAT / params.block_height \"LOW\"" },
  { term: ["juntar lineas", "estar compactos"], meaning: "Menos distancia entre defensa, medio y delantera.", command: "params.compactness_m (menor)" },
  { term: ["vigilancias", "quedarse atras", "basculacion defensiva al atacar"], meaning: "Quién se queda cuando atacamos.", command: "type REST_DEFENSE / params.rest_count" },
  { term: ["atacar la espalda", "desmarque de ruptura", "romper al espacio"], meaning: "Carrera detrás de la línea rival.", command: "board.move {kind: \"RUN\"} hacia detrás de su línea / ATTACK_SPACE target BEHIND_FULLBACK" },
  { term: ["entre lineas", "recibir entre lineas"], meaning: "Recibir entre su medio y su defensa.", command: "ATTACK_SPACE target BETWEEN_LINES" },
  { term: ["cambio de orientacion", "cambiar el juego", "lado debil"], meaning: "Pase largo al lado contrario donde hay espacio.", command: "board.pass {kind: \"AIR\"} / ATTACK_SPACE target WEAK_SIDE" },
  { term: ["tercer hombre"], meaning: "A pasa a B, B devuelve y A busca a C que ya corre.", command: "varios board.pass encadenados / THROW_IN_ATT variant SHORT" },
  { term: ["fijar", "fijar al central"], meaning: "Un jugador se queda quieto para que su rival no salga.", command: "board.move kind MOVE (sin desplazamiento grande)" },
  { term: ["apoyo", "dar apoyo", "ofrecerse"], meaning: "Acercarse al poseedor para dar una línea de pase.", command: "board.move {kind: \"MOVE\"} hacia el poseedor" },
  { term: ["conducir", "conduccion"], meaning: "Avanzar con el balón.", command: "board.move {kind: \"DRIBBLE\"}" },
  { term: ["bloqueo", "bloquear"], meaning: "Ponerse en el camino del marcador de un compañero.", command: "play.relation SCREENS / play.add_roles BLOCKER" },
  { term: ["arrastre", "arrastrar"], meaning: "Carrera para llevarse a un defensa y abrir hueco.", command: "play.add_roles DECOY" },
  { term: ["primer palo"], meaning: "La zona del poste más cercano al balón.", command: "zona Z_NEAR_POST" },
  { term: ["segundo palo"], meaning: "La zona del poste más lejano al balón.", command: "zona Z_FAR_POST" },
  { term: ["cerrado", "con rosca hacia porteria"], meaning: "Centro que se acerca a la portería.", command: "play.set_delivery {swing: \"INSWING\"}" },
  { term: ["abierto", "hacia fuera"], meaning: "Centro que se aleja de la portería.", command: "play.set_delivery {swing: \"OUTSWING\"}" },
  { term: ["zonal", "defensa en zona"], meaning: "Cada uno defiende un espacio.", command: "play.create CORNER_DEF scheme ZONAL" },
  { term: ["al hombre", "individual"], meaning: "Cada uno sigue a un rival.", command: "play.create CORNER_DEF scheme MAN / play.mark" },
  { term: ["mixta"], meaning: "Unos en zona y otros al hombre.", command: "play.create CORNER_DEF scheme MIXED" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const WORD_NUM: Record<string, number> = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11 };
const slotsOf = (f: string) => FORMATIONS[f]?.slots.map((s) => s.slot) ?? [];
const sideOf = (slot: string): "L" | "R" | "C" | undefined => { const s = slotInfo(slot).side; return s === "L" || s === "R" ? s : s === "C" ? "C" : undefined; };

/** Ranuras de un número de puesto en un sistema (6 = pivote, 8 y 10 = interiores, 4 y 5 = centrales…). */
export function numberSlots(formation: string, n: number): string[] {
  const slots = slotsOf(formation);
  const by = (pos: string) => slots.filter((s) => slotInfo(s).pos === pos);
  const pick = (...cands: string[]) => cands.filter((c) => slots.includes(c));
  const dm = by("DM"), cm = by("CM");
  switch (n) {
    case 1: return by("GK");
    case 2: return pick("RB").length ? pick("RB") : pick("RWB");
    case 3: return pick("LB").length ? pick("LB") : pick("LWB");
    case 4: return pick("CB_R").length ? pick("CB_R") : by("CB").slice(-1);
    case 5: return pick("CB_L").length ? pick("CB_L") : by("CB").slice(0, 1);
    case 6: return dm.length === 1 ? dm : dm.length > 1 ? pick("DM_L") : pick("CM_C").length ? pick("CM_C") : pick("CM_L");
    case 8: return dm.length > 1 ? pick("DM_R") : pick("CM_R");
    case 10: return by("AM").length ? by("AM") : dm.length ? pick("CM_L") : [];
    case 7: return by("RW").length ? by("RW") : by("RM");
    case 11: return by("LW").length ? by("LW") : by("LM");
    case 9: return by("ST");
    default: return [];
  }
}

/** Nombres de entrenador de cada ranura en un sistema (para el contexto del asistente y la interfaz). */
export function slotAliases(formation: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const slot of slotsOf(formation)) {
    const { pos } = slotInfo(slot), side = sideOf(slot);
    const names = ALIASES.filter((a) => !a.plural && a.pos.includes(pos) && (!a.side || a.side === side || (a.side === "C" && !side))).map((a) => a.text);
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => numberSlots(formation, n).includes(slot)).map((n) => `el ${n}`);
    out[slot] = [...new Set([...names, ...nums])];
  }
  return out;
}

export interface PlayerRef { slots: string[]; via: "position" | "shirt" | "name" | "none"; ambiguous: boolean }

export function resolvePlayerRef(text: string, ctx: { formation: string; labels?: Record<string, string>; roster?: Player[] }): PlayerRef {
  const t = ` ${norm(text).replace(/[.,;:!?¿¡()]/g, " ").replace(/\s+/g, " ")} `;
  const slots = slotsOf(ctx.formation);
  const labels = ctx.labels ?? {};
  type Hit = { at: number; len: number; kind: "alias" | "num" | "name"; alias?: Alias; n?: number; positionOnly?: boolean; slots?: string[] };
  const hits: Hit[] = [];
  for (const a of ALIASES) {
    const at = t.indexOf(` ${a.text} `);
    if (at >= 0) hits.push({ at, len: a.text.length, kind: "alias", alias: a });
  }
  const numRe = /\b(el|la|al|del|de|numero|n|no)\s+(\d{1,2}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once)\b(?!\s*-|-)/g;
  for (const m of t.matchAll(numRe)) {
    if (/^(falso)$/.test(t.slice(0, m.index).trim().split(" ").pop() ?? "")) continue;
    const n = /\d/.test(m[2]) ? Number(m[2]) : WORD_NUM[m[2]];
    const before = t.slice(0, m.index);
    const positionOnly = m[1] === "de" && /\b(juega|juegue|jugando|jugar|pon|poner|coloca|colocar)\b/.test(before);
    if (m[1] === "de" && !positionOnly) continue;
    hits.push({ at: m.index!, len: m[0].length, kind: "num", n, positionOnly });
  }
  for (const p of ctx.roster ?? []) {
    const slot = Object.keys(labels).find((s) => p.n != null && labels[s] === String(p.n));
    if (!slot) continue;
    for (const w of [p.name, p.surname].filter(Boolean) as string[]) {
      const at = t.indexOf(` ${norm(w)} `);
      if (at >= 0) hits.push({ at, len: w.length, kind: "name", slots: [slot] });
    }
  }
  if (!hits.length) return { slots: [], via: "none", ambiguous: false };
  hits.sort((a, b) => a.at - b.at || b.len - a.len);
  const h = hits[0];
  if (h.kind === "name") return { slots: h.slots!, via: "name", ambiguous: false };
  if (h.kind === "num") {
    const bySlot = h.positionOnly ? [] : slots.filter((s) => labels[s] === String(h.n));
    const byPos = numberSlots(ctx.formation, h.n!);
    if (bySlot.length) {
      if (!byPos.length || byPos.every((s) => bySlot.includes(s)) || byPos.includes(bySlot[0]) && byPos.length === 1)
        return { slots: bySlot, via: "shirt", ambiguous: false };
      return { slots: [...bySlot, ...byPos.filter((s) => !bySlot.includes(s))], via: "shirt", ambiguous: true };
    }
    return { slots: byPos, via: "position", ambiguous: byPos.length > 1 };
  }
  const a = h.alias!;
  const article = t.slice(Math.max(0, h.at - 6), h.at);
  const plural = a.plural || /\b(los|las|dos|tres)\s*$/.test(article);
  let found = slots.filter((s) => a.pos.includes(slotInfo(s).pos));
  if (a.pos.length > 1 && !plural) {
    // Un alias que vale para varios puestos (lateral/carrilero, mediocentro): el primero de la lista que exista.
    for (const p of a.pos) { const f = found.filter((s) => slotInfo(s).pos === p); if (f.length) { found = f; break; } }
  }
  if (a.side) found = found.filter((s) => (a.side === "C" ? sideOf(s) === "C" || !sideOf(s) : sideOf(s) === a.side));
  if (!plural && found.length > 1) {
    const center = found.filter((s) => sideOf(s) === "C");
    if (center.length === 1) found = center;
  }
  return { slots: found, via: "position", ambiguous: !plural && found.length > 1 };
}

/** Tabla «quién es quién» del sistema actual: ranura = nombres · número · jugador (dorsal). */
export function whoIsWho(formation: string, labels: Record<string, string>, roster: Player[]): string {
  const al = slotAliases(formation);
  return slotsOf(formation).map((slot) => {
    const names = al[slot].filter((x) => !x.startsWith("el ")).slice(0, 3);
    const nums = al[slot].filter((x) => x.startsWith("el ")).map((x) => x.slice(3));
    const p = roster.find((r) => r.n != null && labels[slot] === String(r.n));
    return `${slot} = ${names.join(", ") || slot}${nums.length ? ` · ${nums.join("/")}` : ""}${p ? ` · ${p.name}${p.surname ? " " + p.surname : ""} (${p.n})` : labels[slot] ? ` · dorsal ${labels[slot]}` : ""}`;
  }).join("\n");
}
