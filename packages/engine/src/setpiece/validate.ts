// Validador de jugadas (docs/15 §10). Cada regla devuelve diagnósticos con el id del catálogo.
import { MIN_SPACING_M, ZONES } from "../catalog/index";
import { dist, resolveZone, toM } from "../geometry";
import type { Diagnostic, EngineContext, PlayDoc } from "../types";
import { naturalSwing } from "./common";
import { SCREEN_LEAD_S } from "./derive";

const EPS = 1e-6;
const SWING_ES = { INSWING: "cerrado", OUTSWING: "abierto", NONE: "sin efecto" } as const;

export function validatePlay(doc: PlayDoc, ctx: EngineContext): Diagnostic[] {
  const out: Diagnostic[] = [];
  const pitch = doc.pitch;
  const own = doc.actors.filter((a) => a.team === "OWN");
  const opp = doc.actors.filter((a) => a.team === "OPP");
  const name = (pid?: string | null) => {
    const p = ctx.roster.find((x) => x.id === pid);
    return p ? `${p.name}${p.n ? ` (${p.n})` : ""}` : "Jugador";
  };
  const actorName = (id: string) => { const a = doc.actors.find((x) => x.id === id)!; return a.player_id ? name(a.player_id) : a.label; };
  const mov = (id: string) => doc.movements.find((m) => m.actor === id);

  for (const a of doc.actors) {
    if (a.start.u < -0.04 || a.start.u > 1.04 || a.start.v < -0.04 || a.start.v > 1.04)
      out.push({ rule_id: "GEO-01", class: "GEOMETRY", severity: "error", message: `${actorName(a.id)} está fuera del terreno de juego.`, actors: [a.id] });
  }
  for (const [team, list] of [["propios", own], ["rivales", opp]] as const) {
    if (list.length > 11) out.push({ rule_id: "GEO-02", class: "GEOMETRY", severity: "error", message: `Hay ${list.length} jugadores ${team}; el máximo es 11.` });
  }
  const seen = new Map<string, string>();
  for (const a of own) {
    if (!a.player_id) continue;
    if (seen.has(a.player_id)) out.push({ rule_id: "GEO-03", class: "GEOMETRY", severity: "error", message: `${name(a.player_id)} aparece dos veces.`, actors: [seen.get(a.player_id)!, a.id] });
    seen.set(a.player_id, a.id);
  }
  const field = own.filter((a) => a.role !== "TAKER");
  for (let i = 0; i < field.length; i++)
    for (let j = i + 1; j < field.length; j++)
      if (dist(toM(field[i].start, pitch), toM(field[j].start, pitch)) < MIN_SPACING_M - EPS)
        out.push({ rule_id: "GEO-SPACING-01", class: "GEOMETRY", severity: "warning", message: `${actorName(field[i].id)} y ${actorName(field[j].id)} están a menos de 1 m.`, actors: [field[i].id, field[j].id] });

  for (const a of own) {
    const p = ctx.roster.find((x) => x.id === a.player_id);
    if (p && p.status !== "AVAILABLE") out.push({ rule_id: "AVAIL-01", class: "ROSTER", severity: "warning", message: `${name(p.id)} figura como ${p.status.toLowerCase()}.`, actors: [a.id] });
  }

  if (doc.type.startsWith("CORNER")) {
    const corner = { x: pitch.length_m, y: doc.side === "LEFT" ? 0 : pitch.width_m };
    for (const o of opp) if (dist(toM(o.start, pitch), corner) < 9.15 + 1 - EPS)
      out.push({ rule_id: "LAW-CRN-02", class: "LAW", severity: "warning", message: "Reglamento (Regla 17): los rivales deben estar a 9,15 m del área de esquina hasta el saque.", actors: [o.id] });
  }

  // Técnica del golpeo.
  const taker = doc.actors.find((a) => a.id === doc.delivery.taker_actor);
  const tp = ctx.roster.find((x) => x.id === taker?.player_id);
  if (tp && doc.delivery.swing !== "NONE") {
    const nat = naturalSwing(tp.foot, doc.side, doc.delivery.technique === "OUTSIDE_FOOT");
    if (nat && nat !== doc.delivery.swing)
      out.push({ rule_id: "TECH-SWING-01", class: "TECHNIQUE", severity: "warning", actors: [taker!.id],
        message: `Técnica: ${name(tp.id)} es ${tp.foot === "RIGHT" ? "diestro" : "zurdo"}; desde la ${doc.side === "LEFT" ? "izquierda" : "derecha"} su golpeo natural sale ${SWING_ES[nat]}. Has pedido ${SWING_ES[doc.delivery.swing]}.` });
  }

  if (doc.type === "CORNER_ATT") {
    if (!own.some((a) => a.role === "REST_DEFENDER"))
      out.push({ rule_id: "TAC-CRN-REST-01", class: "TACTICAL", severity: "warning", message: "Recomendación: no queda nadie de vigilancia." });
    const tz = resolveZone(doc.delivery.target_zone, doc.side, pitch);
    const inZone = (u: number, v: number) => {
      const m = toM({ u, v }, pitch);
      return m.x >= tz.x[0] - 0.5 && m.x <= tz.x[1] + 0.5 && m.y >= tz.y[0] - 0.5 && m.y <= tz.y[1] + 0.5;
    };
    const attacks = doc.movements.some((m) => {
      const a = doc.actors.find((x) => x.id === m.actor)!;
      if (a.team !== "OWN" || m.type === "HOLD" || m.type === "SCREEN" || m.type === "DECOY_RUN") return false;
      const e = m.path[m.path.length - 1];
      return inZone(e.u, e.v);
    });
    if (!attacks) out.push({ rule_id: "TAC-CRN-TGT-01", class: "TACTICAL", severity: "warning", message: `Recomendación: nadie ataca la zona donde va el balón (${ZONES[tz.id].label.toLowerCase()}).` });
  }

  for (const r of doc.relations) {
    if (r.type !== "SCREENS" || !r.blocker || !r.beneficiary) continue;
    const bm = mov(r.blocker), em = mov(r.beneficiary);
    if (!bm || !em) continue;
    const gap = bm.t_end - (em.t_start - SCREEN_LEAD_S);
    if (gap > EPS) {
      out.push({ rule_id: "SEQ-SCREEN-01", class: "SEQUENCE", severity: "warning", actors: [r.blocker],
        message: `El bloqueo se establece ${gap.toFixed(2)} s tarde. Propuesta: empezar ${gap.toFixed(2)} s antes.` });
      if (r.strict_legal) out.push({ rule_id: "LAW-IMP-01", class: "LAW", severity: "warning", actors: [r.blocker],
        message: "El bloqueo sigue en movimiento cuando pasa el rival: riesgo de sanción por impedir el avance (Regla 12). La legalidad la decide el árbitro." });
    }
  }

  const primary = own.find((a) => a.role === "PRIMARY_TARGET");
  const pm = primary && mov(primary.id);
  if (pm && pm.type !== "HOLD" && Math.abs(pm.t_end - doc.delivery.arrival_t) > 0.15 + EPS)
    out.push({ rule_id: "SCH-SYNC-01", class: "SEQUENCE", severity: "warning", actors: [primary!.id],
      message: `${actorName(primary!.id)} llega ${Math.abs(pm.t_end - doc.delivery.arrival_t).toFixed(2)} s ${pm.t_end > doc.delivery.arrival_t ? "tarde" : "pronto"} respecto al balón.` });

  for (const c of doc.constraints) {
    const m = mov(c.actor);
    if (c.rule === "NO_JOIN_ATTACK" && m && m.type !== "HOLD")
      out.push({ rule_id: "SEQ-CONSTR-01", class: "SEQUENCE", severity: "error", actors: [c.actor], message: `${actorName(c.actor)} incumple tu indicación: no debe incorporarse al remate.` });
  }

  if (doc.delivery.provenance.target_zone === "RULE:BALL-TGT-01")
    out.push({ rule_id: "BALL-TGT-01", class: "TACTICAL", severity: "info", message: `Destino del balón propuesto: ${ZONES[doc.delivery.target_zone].label.toLowerCase()} (zona del rematador principal).` });
  if (doc.type.startsWith("CORNER"))
    out.push({ rule_id: "LAW-OFF-INFO", class: "LAW", severity: "info", message: "No hay fuera de juego al recibir directamente de córner." });
  return out;
}
