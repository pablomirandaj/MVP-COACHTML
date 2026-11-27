// Explicación por pasos (diseño Pizarra Studio §6.4): cada paso dice qué pasa (title) y qué implica (implies).
// Plantillas deterministas por tipo de evento; una nota del entrenador o del asistente prevalece sobre la generada.
import { ZONES } from "./catalog/index";
import type { PhaseScene as SceneDoc } from "./phases/types";
import { SPACE_LABEL, SPACE_WHY } from "./phases/spaces";
import type { Actor, Origin, Player, PlayDoc, Pt, ZoneId } from "./types";

export interface Step { t: number; title: string; implies: string; source: Origin }

const ARTICLE: Partial<Record<ZoneId, string>> = { Z_FAR_ZONE: "", Z_GK: "", Z_EDGE: "la ", Z_REBOUND: "la ", Z_SHORT: "la ", Z_REST: "la ", Z_START_CLUSTER: "la " };
/** Zona con su artículo: «el segundo palo», «la frontal del área», «fuera del segundo palo». */
const zoneLabel = (z?: ZoneId) => (z && ZONES[z] ? `${ARTICLE[z] ?? "el "}${ZONES[z].label.toLowerCase()}` : "su zona");
const SWING_ES = { INSWING: "cerrado", OUTSWING: "abierto", NONE: "tenso" } as const;

function who(a: Actor | undefined, roster: Player[]): string {
  if (!a) return "un compañero";
  if (a.team === "OPP") return `su ${a.label || "defensor"}`.trim();
  const p = a.player_id ? roster.find((x) => x.id === a.player_id) : undefined;
  if (!p) return `el ${a.label}`;
  const name = p.surname || p.name;
  return p.n != null ? `el ${p.n} (${name})` : name;
}

/** Pasos de una jugada de balón parado: colocación, golpeo, bloqueos, desmarques y llegada. */
const SCHEME_ES: Record<string, string> = { CRN_DEF_MIXED: "mixta", CRN_DEF_ZONAL: "zonal", CRN_DEF_MAN: "al hombre", FK_DEF_STANDARD: "mixta con barrera" };

/** Balón parado en contra: organización, golpeo rival, marcas y salida a la contra. */
function narrateDefense(doc: PlayDoc, roster: Player[]): Step[] {
  const actor = (id?: string) => doc.actors.find((a) => a.id === id);
  const own = doc.actors.filter((a) => a.team === "OWN");
  const nz = own.filter((a) => a.role === "ZONAL_DEFENDER").length, nm = own.filter((a) => a.role === "MAN_MARKER").length;
  const t0 = doc.movements.length ? Math.min(0, ...doc.movements.map((m) => m.t_start)) : 0;
  const steps: Step[] = [{
    t: t0, title: `Defendemos en ${SCHEME_ES[doc.template ?? ""] ?? "mixta"}: ${nz} en zona y ${nm} al hombre`,
    implies: "El portero manda; cada uno tiene su referencia antes del saque y no la cambia.", source: "RULE:NARR-SETUP",
  }];
  steps.push({
    t: doc.delivery.kick_t, title: `Su lanzador golpea hacia ${zoneLabel(doc.delivery.target_zone)}`,
    implies: "El de zona más cercano ataca el balón; los marcadores no pierden a su hombre.", source: "RULE:NARR-DELIVERY",
  });
  const runs = doc.movements.filter((m) => actor(m.actor)?.team === "OPP" && m.path.length > 1).sort((a, b) => a.t_start - b.t_start);
  if (nm) steps.push({
    t: runs[0]?.t_start ?? 0, title: `Los marcadores siguen a su hombre (${nm})`,
    implies: "Siempre por el lado de la portería: si ganan la posición, que rematen incómodos y hacia fuera.", source: "RULE:NARR-MARK",
  });
  const out = own.find((a) => a.role === "COUNTER_OUTLET");
  if (out) steps.push({
    t: doc.delivery.arrival_t, title: `${cap(who(out, roster))} se queda arriba para la contra`,
    implies: "Fija a sus centrales: no pueden subir todos al remate y tenemos salida al despejar.", source: "RULE:NARR-COUNTER",
  });
  return sortSteps(steps);
}

export function narratePlay(doc: PlayDoc, roster: Player[]): Step[] {
  if (doc.type.endsWith("_DEF")) return narrateDefense(doc, roster);
  const actor = (id?: string) => doc.actors.find((a) => a.id === id);
  const steps: Step[] = [];
  const own = doc.actors.filter((a) => a.team === "OWN");
  const t0 = doc.movements.length ? Math.min(0, ...doc.movements.map((m) => m.t_start)) : 0;
  const manual = doc.notes.find((n) => !String(n.origin).startsWith("RULE:"));
  steps.push(manual
    ? { t: t0, title: manual.text, implies: `${own.length} jugadores en la jugada; el balón va ${toWho(zoneLabel(doc.delivery.target_zone))}.`, source: manual.origin }
    : { t: t0, title: "Colocación inicial", implies: `${own.length} jugadores en la jugada; el balón irá ${toWho(zoneLabel(doc.delivery.target_zone))}.`, source: "RULE:NARR-SETUP" });

  for (const rel of doc.relations.filter((r) => r.type === "SCREENS")) {
    const mv = doc.movements.find((m) => m.actor === rel.blocker);
    const target = actor(rel.beneficiary);
    steps.push({
      t: mv ? mv.t_start : t0,
      title: `${cap(who(actor(rel.blocker), roster))} bloquea ${toWho(who(actor(rel.defender), roster))}`,
      implies: `${cap(who(target, roster))} queda libre de marca para atacar ${zoneLabel(target?.action_zone)}.`,
      source: "RULE:NARR-BLOCK",
    });
  }

  const taker = actor(doc.delivery.taker_actor);
  if (doc.type.startsWith("THROW_IN")) {
    const short = doc.delivery.trajectory === "SHORT";
    const recv = short && doc.passes?.length ? actor(doc.passes[0].from) : undefined;
    steps.push({
      t: doc.delivery.kick_t,
      title: short ? `${cap(who(taker, roster))} saca en corto ${toWho(who(recv, roster))}` : `${cap(who(taker, roster))} saca largo hacia ${zoneLabel(doc.delivery.target_zone)}`,
      implies: short ? "El apoyo atrae a su extremo; el lanzador entra al campo para recibir la devolución." : "El rematador del primer palo peina el balón hacia el segundo palo.",
      source: "RULE:NARR-DELIVERY",
    });
  } else steps.push({
    t: doc.delivery.kick_t,
    title: `${cap(who(taker, roster))} golpea ${SWING_ES[doc.delivery.swing] ?? ""} hacia ${zoneLabel(doc.delivery.target_zone)}`.replace(/\s+/g, " "),
    implies: `El balón tarda ${doc.delivery.arrival_t.toFixed(1)} s: los rematadores tienen que llegar a la vez, no esperar parados.`,
    source: "RULE:NARR-DELIVERY",
  });

  for (const ps of doc.passes ?? []) {
    steps.push({
      t: ps.t_start,
      title: `${cap(who(actor(ps.from), roster))} pasa ${toWho(who(actor(ps.to), roster))}`,
      implies: ps === doc.passes![doc.passes!.length - 1]
        ? "El último pase llega al compañero en carrera, a la espalda de su lateral."
        : "Pase corto de seguridad: atrae al rival y libera al siguiente.",
      source: "RULE:NARR-PASS",
    });
  }
  const runs = doc.movements.filter((m) => m.type !== "SCREEN" && m.type !== "HOLD" && actor(m.actor)?.team === "OWN")
    .sort((a, b) => a.t_start - b.t_start || a.actor.localeCompare(b.actor));
  for (const m of runs.slice(0, 4)) {
    const a = actor(m.actor);
    const decoy = a?.role === "DECOY";
    steps.push({
      t: m.t_start,
      title: `${cap(who(a, roster))} ${decoy ? "arrastra" : "ataca"} ${zoneLabel(a?.action_zone)}`,
      implies: decoy ? "Se lleva a su marca y abre hueco para el rematador principal." : "Llega en carrera para ganar el primer contacto.",
      source: "RULE:NARR-RUN",
    });
  }
  return sortSteps(steps);
}

const POSSESSION_OWN = new Set(["PRESS_OPP", "REST_DEFENSE", "BUILD_UP", "ATTACK_SPACE"]);
const near = (p: Pt, set: Record<string, Pt>) => {
  let best = "", d = Infinity;
  for (const [k, q] of Object.entries(set)) { const e = Math.hypot((p.u - q.u) * 105, (p.v - q.v) * 68); if (e < d || (e === d && k < best)) { d = e; best = k; } }
  return best;
};

/** Pasos de una escena de fase de juego: uno por fotograma clave. */
export function narrateScene(doc: SceneDoc): Step[] {
  const ownL = (k: string) => doc.own_labels[k] ?? k;
  const oppL = (k: string) => doc.opp_labels[k] ?? k;
  const ownHas = POSSESSION_OWN.has(doc.type);
  return doc.frames.map((f) => {
    const holder = ownHas ? near(f.ball, f.own) : near(f.ball, f.opp);
    const holderTxt = ownHas ? `nuestro ${ownL(holder)}` : `su ${oppL(holder)}`;
    const entries = Object.entries(f.roles).sort(([a], [b]) => a.localeCompare(b));
    const pressers = entries.filter(([, r]) => r === "PRESSER").map(([k]) => k);
    const covers = entries.filter(([, r]) => r === "COVER").map(([k]) => k);
    const markers = entries.filter(([, r]) => r === "REST_MARKER").map(([k]) => k);
    const free = entries.filter(([, r]) => r === "FREE_MAN").map(([k]) => k);
    const runner = entries.find(([, r]) => r === "RUNNER")?.[0];
    const sp = doc.target_space;
    const lab = (k: string) => (k.startsWith("opp:") ? oppL(k.slice(4)) : ownL(k));
    const pos = (k: string) => (k.startsWith("opp:") ? f.opp[k.slice(4)] : f.own[k]);
    const rivals = (k: string) => (k.startsWith("opp:") ? f.own : f.opp);
    const rivalL = (k: string, r: string) => (k.startsWith("opp:") ? ownL(r) : oppL(r));

    let title: string, implies: string, source: Origin;
    if (runner && sp) {
      title = `El ${ownL(runner)} ataca ${SPACE_LABEL[sp.kind]}`;
      implies = `${SPACE_WHY[sp.kind]} Objetivo: ${SPACE_LABEL[sp.kind]}.`;
      source = "RULE:NARR-SPACE";
    } else if (pressers.length) {
      title = pressers.map((p) => `El ${lab(p)} presiona al ${rivalL(p, near(pos(p), rivals(p)))}`).join(" y ");
      implies = covers.length
        ? `${covers.map((c) => `el ${lab(c)}`).join(" y ")} ${covers.length > 1 ? "cierran" : "cierra"} el pase interior; el balón solo puede ir largo o fuera.`
        : "Sin coberturas detrás: si superan al presionador, hay que replegar rápido.";
      source = "RULE:NARR-PRESS";
    } else if (markers.length) {
      title = `Vigilancias: ${markers.map((m) => `el ${ownL(m)} con el ${oppL(near(f.own[m], f.opp))}`).join(", ")}`;
      implies = "Si perdemos el balón, su delantero no recibe solo: ganamos tiempo para el repliegue.";
      source = "RULE:NARR-REST";
    } else if (free.length) {
      title = `Balón en ${holderTxt}; el hombre libre es el ${ownL(free[0])}`;
      implies = `Hay que llegar al ${ownL(free[0])}: es el pase que supera su primera línea de presión.`;
      source = "RULE:NARR-FREE";
    } else {
      title = `Balón en ${holderTxt}`;
      implies = ownHas
        ? "Circulamos con paciencia hasta encontrar la ventaja."
        : doc.type === "RETREAT"
          ? "El bloque se cierra por dentro y bascula hacia el balón: les dejamos la banda, no el carril central."
          : "El bloque bascula hacia el balón y espera el disparador para saltar.";
      source = "RULE:NARR-BALL";
    }
    const marks = entries.filter(([, r]) => r === "MARK").map(([k]) => k);
    if (marks.length) implies = `${implies} ${marks.map((m) => `${cap(`el ${lab(m)}`)} vigila a su ${rivalL(m, near(pos(m), rivals(m)))}`).join("; ")}.`;
    if (sp && !implies.includes(SPACE_LABEL[sp.kind])) implies = `${implies} Objetivo: ${SPACE_LABEL[sp.kind]}.`;
    if (f.note) { title = f.note; source = "MANUAL"; }
    if (f.implies) { implies = f.implies; source = "MANUAL"; }
    return { t: f.t, title, implies, source };
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** «a» + «el X» → «al X» (contracción obligatoria en español). */
export const toWho = (s: string) => (s.startsWith("el ") ? `al ${s.slice(3)}` : `a ${s}`);
const sortSteps = (s: Step[]) => s.map((x, i) => [x, i] as const).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([x]) => ({ ...x, t: Math.round(x.t * 100) / 100 }));
