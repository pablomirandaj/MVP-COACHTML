// Ficha de la jugada (como la J5): quién hace qué, el hueco que atacamos, la clave y si sale mal. Es una propuesta
// determinista a partir de la pieza; el entrenador la edita y el asistente puede reescribirla.
import { ZONES } from "../catalog/index";
import type { BoardDoc } from "../board/types";
import type { PhaseScene as SceneDoc } from "../phases/types";
import { SPACE_LABEL, SPACE_WHY } from "../phases/spaces";
import type { PlayDoc, ZoneId } from "../types";
import type { Sequence } from "./types";

export interface Sheet { subtitle: string; table: [string, string][]; hueco: string; clave: string; riesgo: string }
export type SheetSource = { kind: "SETPIECE"; doc: PlayDoc } | { kind: "SCENE"; scene: SceneDoc } | { kind: "BOARD"; doc: BoardDoc };

const zl = (z?: ZoneId) => (z && ZONES[z] ? ZONES[z].label.toLowerCase() : "su zona");
const SWING = { INSWING: "cerrado", OUTSWING: "abierto", NONE: "tenso" } as const;

/** Agrupa filas con la misma tarea: «5 · 6 · 8». */
function group(rows: [string, string][]): [string, string][] {
  const out: [string, string][] = [];
  for (const [who, what] of rows) {
    const same = out.find((r) => r[1] === what);
    if (same) same[0] = same[0].split(" · ").includes(who) ? same[0] : `${same[0]} · ${who}`;
    else out.push([who, what]);
  }
  return out;
}

function playTasks(doc: PlayDoc, seq: Sequence): [string, string][] {
  const label = (id: string) => seq.actors.find((a) => a.id === id)?.label ?? id;
  const markOf = (id: string) => doc.relations.find((r) => r.type === "MARKS" && r.a === id)?.b;
  const freed = (id: string) => doc.relations.find((r) => r.type === "SCREENS" && r.blocker === id)?.beneficiary;
  const order = { TAKER: 0, BLOCKER: 1, PRIMARY_TARGET: 2, SECONDARY_TARGET: 3, DECOY: 4, SHORT_RECEIVER: 5, GK_SCREEN: 6, REBOUND: 7, EDGE_GUARD: 7, REST_DEFENDER: 9 } as Record<string, number>;
  const own = doc.actors.filter((a) => a.team === "OWN").sort((a, b) => (order[a.role] ?? 8) - (order[b.role] ?? 8) || seq.actors.findIndex((x) => x.id === a.id) - seq.actors.findIndex((x) => x.id === b.id));
  const rows: [string, string][] = own.map((a) => {
    const z = zl(a.action_zone);
    switch (a.role) {
      case "TAKER": return [label(a.id), doc.type.startsWith("THROW_IN") ? (doc.passes?.length ? "Saca en corto, entra al campo y recibe la devolución" : "Saque largo al primer palo") : `Balón ${SWING[doc.delivery.swing]} al ${zl(doc.delivery.target_zone).replace(/^el /, "")}`];
      case "BLOCKER": { const f = freed(a.id); return [label(a.id), `Bloquea al marcador ${f ? `del ${label(f)}` : "de su compañero"} y después entra`]; }
      case "PRIMARY_TARGET": return [label(a.id), doc.passes?.length ? "Ataca la espalda del lateral y recibe el último pase" : `Rematador principal: ataca ${z} de frente`];
      case "SECONDARY_TARGET": return [label(a.id), `Ataca ${z}`];
      case "DECOY": return [label(a.id), `Arrastre hacia ${z}: se lleva a su marca`];
      case "SHORT_RECEIVER": return [label(a.id), "Apoyo corto: recibe y devuelve de primeras"];
      case "GK_SCREEN": return [label(a.id), "Encima del portero: que no pueda salir"];
      case "REBOUND": case "EDGE_GUARD": return [label(a.id), "En la frontal, para el rechace"];
      case "REST_DEFENDER": return [label(a.id), "Cierran atrás: no suben al remate"];
      case "ZONAL_DEFENDER": return [label(a.id), "En zona: ataca el balón que caiga en su sitio"];
      case "MAN_MARKER": { const m = markOf(a.id); return [label(a.id), `Al hombre${m ? ` con su ${seq.actors.find((x) => x.id === m)?.label || "rematador"}` : ""}, siempre por el lado de la portería`]; }
      case "COUNTER_OUTLET": return [label(a.id), "Se queda arriba para la contra"];
      case "WALL": return [label(a.id), "Barrera a 9,15 m"];
      case "GOALKEEPER": return [label(a.id), "Manda en el área y sale si el balón es suyo"];
      case "POST_GUARD": return [label(a.id), "Vigila el saque en corto"];
      case "COVER": return [label(a.id), "Cobertura en el área"];
      default: return [label(a.id), "—"];
    }
  });
  return group(rows);
}

export function proposeSheet(seq: Sequence, src: SheetSource): Sheet {
  if (src.kind === "SETPIECE") {
    const d = src.doc, tz = zl(d.delivery.target_zone);
    if (d.type.endsWith("_DEF")) return {
      subtitle: d.type === "CORNER_DEF" ? "Córner en contra: cada uno sabe su referencia" : "Falta lateral en contra: barrera, línea y marcas",
      table: playTasks(d, seq),
      hueco: "El primer palo y el punto de penalti: ahí no puede rematar nadie solo.",
      clave: "Atacar el balón de frente: el de zona más cercano sale a por él y los marcadores no pierden a su hombre.",
      riesgo: "Si un marcador se queda mirando el balón, su rematador llega solo al remate.",
    };
    if (d.type.startsWith("THROW_IN")) return d.passes?.length ? {
      subtitle: "Saque corto con tercer hombre", table: playTasks(d, seq),
      hueco: "La espalda de su lateral, que sale a por el apoyo corto.",
      clave: "La devolución va de primeras y el tercer hombre arranca cuando el balón vuelve al lanzador.",
      riesgo: "Si el apoyo controla en vez de devolver, su extremo le encima y perdemos el balón en banda.",
    } : {
      subtitle: "Saque largo al primer palo con peinada", table: playTasks(d, seq),
      hueco: "El segundo palo, donde cae la peinada.",
      clave: "El bloqueo deja libre al que peina; el resto ataca el segundo palo a la vez.",
      riesgo: "Si el saque se queda corto, lo despeja el primer defensor y nos pillan arriba.",
    };
    return {
      subtitle: d.type === "FK_WIDE_ATT" ? `Falta lateral: balón ${SWING[d.delivery.swing]} a ${tz}` : `Córner ${SWING[d.delivery.swing]} a ${tz}`,
      table: playTasks(d, seq),
      hueco: `${tz.charAt(0).toUpperCase()}${tz.slice(1)}: ahí llega el rematador principal${d.relations.some((r) => r.type === "SCREENS") ? " con su marcador bloqueado" : ""}.`,
      clave: d.type === "FK_WIDE_ATT" ? "Nadie sale antes del golpeo: la línea está en su fuera de juego y el balón tiene que llegar con el rematador lanzado."
        : "Primero se bloquea y después se entra; el balón tiene que llegar a la vez que el rematador.",
      riesgo: d.type === "FK_WIDE_ATT" ? "Si alguien arranca antes del golpeo, fuera de juego y perdemos la falta." : "Si el bloqueo llega tarde, su marcador sigue al rematador y el balón se lo lleva el defensa.",
    };
  }
  if (src.kind === "SCENE") {
    const sc = src.scene;
    const base: Record<string, Omit<Sheet, "table">> = {
      BUILD_UP: { subtitle: "Salida de balón", hueco: "El hombre libre: el de nuestra primera línea que no tiene a nadie a menos de 5 m.", clave: "Atraer y soltar: el poseedor espera a que salte un rival antes de pasar.", riesgo: "Si conducimos hacia la presión sin pasar, nos roban cerca de nuestra área." },
      PRESS_OWN: { subtitle: "Presión", hueco: "Su lateral pegado a la banda: la banda hace de defensa.", clave: "Se salta todos a la vez en el disparador; el que no salta cierra el pase interior.", riesgo: "Si salta uno solo, superan la presión con un pase y nos pillan desordenados." },
      PRESS_OPP: { subtitle: "Su presión", hueco: "El pase por detrás de su primera línea de presión.", clave: "Moverse antes de recibir y jugar a uno o dos toques.", riesgo: "Si recibimos de espaldas con su presión encima, perdemos el balón en salida." },
      RETREAT: { subtitle: "Repliegue", hueco: "Les dejamos la banda, no el carril central.", clave: "El bloque se cierra por dentro y bascula hacia el balón todos a la vez.", riesgo: "Si un medio se queda arriba, se abre el pasillo entre líneas." },
      REST_DEFENSE: { subtitle: "Vigilancias", hueco: "Su contra: la tapamos antes de que empiece.", clave: "Siempre uno más que sus delanteros que se quedan arriba.", riesgo: "Si suben todos al ataque, una pérdida es un mano a mano." },
      ATTACK_SPACE: { subtitle: "Atacar espacios", hueco: sc.target_space ? `${SPACE_LABEL[sc.target_space.kind].charAt(0).toUpperCase()}${SPACE_LABEL[sc.target_space.kind].slice(1)}. ${SPACE_WHY[sc.target_space.kind]}` : "El espacio que deje su bloque.", clave: "El desmarque sale cuando el pasador puede pasar, ni antes ni después.", riesgo: "Si el pase llega tarde, el receptor está en fuera de juego o lo cierra su central." },
    };
    const b = base[sc.type] ?? base.PRESS_OWN;
    const roles = new Map<string, string>();
    for (const f of sc.frames) for (const [k, r] of Object.entries(f.roles)) {
      if (k.startsWith("opp:") || roles.has(k)) continue;
      const t = r === "PRESSER" ? "Salta a presionar en el disparador" : r === "COVER" ? "Cierra el pase interior" : r === "MARK" ? "Vigila a su mediocentro" : r === "FREE_MAN" ? "Hombre libre: se ofrece para recibir" : r === "RUNNER" ? "Ataca el espacio" : r === "REST_MARKER" ? "Vigila a su delantero" : r === "REST_FREE" ? "Vigilancia libre" : r === "SUPPORT" ? "Apoyo en la salida" : "";
      if (t) roles.set(k, t);
    }
    return { ...b, table: group([...roles].map(([k, t]) => [sc.own_labels[k] ?? k, t])) };
  }
  return { subtitle: src.doc.title, table: [], hueco: "El espacio al que llega el último pase de la jugada.", clave: "Cada paso empieza cuando termina el anterior: nadie se adelanta.", riesgo: "Si un pase sale tarde, el rival cierra la línea y hay que volver a empezar." };
}
