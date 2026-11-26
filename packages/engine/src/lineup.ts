// Motor de alineaciones (docs/18). Funciones puras: (documento, comando, contexto) → resultado.
import { FORMATIONS } from "./catalog/index";
import type { Clarification, Command, Diagnostic, EngineContext, Origin, Player, Pt } from "./types";
import { lexOptimalAssignment } from "./util/assignment";
import { r2, r4 } from "./util/num";

export interface LineupDoc {
  formation: string;
  slots: Record<string, string | null>;
  slot_provenance: Record<string, Origin>;
  overrides: Record<string, { dx_m: number; dy_m: number }>;
}

export interface LineupResult { doc: LineupDoc; clarifications: Clarification[]; diagnostics: Diagnostic[]; changed: boolean }

const LINE_OF_POS: Record<string, "GK" | "DEF" | "MID" | "ATT"> = {
  GK: "GK", RB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF", CB: "DEF",
  DM: "MID", CM: "MID", RM: "MID", LM: "MID", AM: "MID", RW: "ATT", LW: "ATT", ST: "ATT", SS: "ATT",
};
const POS_LABEL: Record<string, string> = {
  GK: "portero", RB: "lateral derecho", LB: "lateral izquierdo", RWB: "carrilero derecho", LWB: "carrilero izquierdo",
  CB: "central", DM: "mediocentro defensivo", CM: "mediocentro", RM: "medio derecho", LM: "medio izquierdo",
  AM: "mediapunta", RW: "extremo derecho", LW: "extremo izquierdo", ST: "delantero", SS: "segundo delantero",
};

export function slotInfo(slot: string): { pos: string; side: "L" | "C" | "R" } {
  const [pos, suffix] = slot.split("_");
  if (suffix === "L" || suffix === "R" || suffix === "C") return { pos, side: suffix };
  if (["LB", "LWB", "LM", "LW"].includes(pos)) return { pos, side: "L" };
  if (["RB", "RWB", "RM", "RW"].includes(pos)) return { pos, side: "R" };
  return { pos, side: "C" };
}

const formationSlots = (code: string) => {
  const f = FORMATIONS[code];
  if (!f) throw new Error(`Formación desconocida: ${code}`);
  return f.slots;
};

/** Ranuras de un grupo semántico (docs/14 §4) en la formación, ordenadas de izquierda a derecha. */
export function groupSlots(formation: string, group: string): string[] {
  const slots = formationSlots(formation);
  const line = (u: number) => (u < 0.3 ? "DEF" : u <= 0.56 ? "MID" : "ATT");
  const match = (s: { slot: string; u: number }) => {
    const { pos } = slotInfo(s.slot);
    switch (group) {
      case "GK": return pos === "GK";
      case "CENTER_BACKS": return pos === "CB";
      case "FULLBACKS": return ["LB", "RB", "LWB", "RWB"].includes(pos);
      case "WINGERS": return ["LW", "RW"].includes(pos);
      case "STRIKERS": return ["ST", "SS"].includes(pos);
      case "DEF": case "MID": case "ATT": return pos !== "GK" && line(s.u) === group;
      default: return false;
    }
  };
  return slots.filter(match).sort((a, b) => a.v - b.v || a.u - b.u).map((s) => s.slot);
}

export function emptyLineup(formation: string): LineupDoc {
  const slots: Record<string, string | null> = {};
  for (const s of formationSlots(formation)) slots[s.slot] = null;
  return { formation, slots, slot_provenance: {}, overrides: {} };
}

function positionFit(p: Player, slot: string): number {
  const { pos, side } = slotInfo(slot);
  let s = 0;
  if (p.pos === pos) s += 100;
  else if (p.secondary?.includes(pos)) s += 60;
  else if (LINE_OF_POS[p.pos] === LINE_OF_POS[pos]) s += 20;
  if ((p.foot === "LEFT" && side === "L") || (p.foot === "RIGHT" && side === "R")) s += 10;
  else if (p.foot === "BOTH" && side !== "C") s += 5;
  return s;
}

const player = (ctx: EngineContext, id: string) => {
  const p = ctx.roster.find((x) => x.id === id);
  if (!p) throw new Error(`Jugador desconocido: ${id}`);
  return p;
};
const slotOf = (doc: LineupDoc, pid: string) => Object.keys(doc.slots).find((k) => doc.slots[k] === pid);
const nameOf = (ctx: EngineContext, id: string) => { const p = player(ctx, id); return p.n ? `${p.name} (${p.n})` : p.name; };
const clone = (d: LineupDoc): LineupDoc => JSON.parse(JSON.stringify(d));

export function applyLineupCommand(doc: LineupDoc, cmd: Command, ctx: EngineContext): LineupResult {
  const next = clone(doc);
  const clar: Clarification[] = [];
  const done = (): LineupResult => {
    const changed = JSON.stringify(next) !== JSON.stringify(doc);
    return { doc: changed ? next : doc, clarifications: clar, diagnostics: validateLineup(changed ? next : doc, ctx), changed };
  };
  const ask = (code: string, question: string, options: { label: string; commands: Command[] }[]): LineupResult => {
    clar.push({ id: `clar_${code}_${clar.length}`, code, question, options });
    return { doc, clarifications: clar, diagnostics: validateLineup(doc, ctx), changed: false };
  };

  switch (cmd.op) {
    case "lineup.set_formation": {
      if (cmd.formation === doc.formation) return done();
      const fresh = emptyLineup(cmd.formation);
      for (const [slot, pid] of Object.entries(doc.slots)) {
        if (!pid) continue;
        if (slot in fresh.slots && !fresh.slots[slot]) { fresh.slots[slot] = pid; fresh.slot_provenance[slot] = doc.slot_provenance[slot] ?? "EXPLICIT"; continue; }
        const { pos } = slotInfo(slot);
        const alt = Object.keys(fresh.slots).find((s) => slotInfo(s).pos === pos && !fresh.slots[s]);
        if (alt) { fresh.slots[alt] = pid; fresh.slot_provenance[alt] = "RULE:LU-FORMATION-MAP"; }
      }
      Object.assign(next, fresh);
      return done();
    }
    case "lineup.assign": {
      const occupant = next.slots[cmd.slot];
      const current = slotOf(next, cmd.player);
      if (!(cmd.slot in next.slots)) return ask("AMB-OP", `El ${next.formation.replace("F_", "")} no tiene esa posición.`, [{ label: "Cancelar", commands: [] }]);
      if (current === cmd.slot) return done();
      if (current && occupant && occupant !== cmd.player && !cmd.force) {
        return ask("AMB-OP", `${nameOf(ctx, cmd.player)} ya juega de ${POS_LABEL[slotInfo(current).pos]} y en esa posición está ${nameOf(ctx, occupant)}.`, [
          { label: `Mover a ${player(ctx, cmd.player).name} (${player(ctx, occupant).name} al banquillo)`, commands: [{ ...cmd, force: true }] },
          { label: `Intercambiar ${player(ctx, cmd.player).name} y ${player(ctx, occupant).name}`, commands: [{ op: "lineup.swap", a: cmd.player, b: occupant }] },
          { label: "Cancelar", commands: [] },
        ]);
      }
      if (current) { next.slots[current] = null; delete next.slot_provenance[current]; }
      next.slots[cmd.slot] = cmd.player;
      next.slot_provenance[cmd.slot] = "EXPLICIT";
      return done();
    }
    case "lineup.assign_group": {
      const slots = groupSlots(next.formation, cmd.group);
      const players: string[] = cmd.players;
      if (slots.length === 0) return ask("AMB-OP", `El sistema actual no tiene ese grupo de posiciones.`, [{ label: "Cancelar", commands: [] }]);
      if (players.length !== slots.length) {
        return ask("AMB-OP", `Ese grupo tiene ${slots.length} posiciones y has nombrado ${players.length} jugadores.`, [{ label: "Cancelar", commands: [] }]);
      }
      // Filas = jugadores en orden hablado; columnas = ranuras de izquierda a derecha (docs/18 §4).
      const score = players.map((pid) => slots.map((s) => positionFit(player(ctx, pid), s)));
      const cols = lexOptimalAssignment(score);
      for (const pid of players) { const cur = slotOf(next, pid); if (cur) { next.slots[cur] = null; delete next.slot_provenance[cur]; } }
      players.forEach((pid, i) => {
        const slot = slots[cols[i]];
        next.slots[slot] = pid;
        next.slot_provenance[slot] = slots.length === 1 ? "EXPLICIT" : "RULE:LU-POSITION-FIT";
      });
      return done();
    }
    case "lineup.substitute": {
      const outSlot = slotOf(next, cmd.out), inSlot = slotOf(next, cmd.in);
      const a = player(ctx, cmd.out).name, b = player(ctx, cmd.in).name;
      if (outSlot && !inSlot) { next.slots[outSlot] = cmd.in; next.slot_provenance[outSlot] = "EXPLICIT"; return done(); }
      if (outSlot && inSlot) return ask("AMB-OP", `${a} y ${b} ya son titulares.`, [
        { label: `Intercambiar posiciones de ${a} y ${b}`, commands: [{ op: "lineup.swap", a: cmd.out, b: cmd.in }] },
        { label: "Cancelar", commands: [] },
      ]);
      if (!outSlot && inSlot) return ask("AMB-OP", `${a} no está en el once; ${b} sí.`, [
        { label: `Sale ${b}, entra ${a}`, commands: [{ op: "lineup.substitute", out: cmd.in, in: cmd.out }] },
        { label: "Cancelar", commands: [] },
      ]);
      return ask("AMB-OP", `Ni ${a} ni ${b} están en el once.`, [{ label: "Cancelar", commands: [] }]);
    }
    case "lineup.swap": {
      const sa = slotOf(next, cmd.a), sb = slotOf(next, cmd.b);
      if (!sa || !sb) return ask("AMB-OP", "Para intercambiar, los dos jugadores deben estar en el once.", [{ label: "Cancelar", commands: [] }]);
      next.slots[sa] = cmd.b; next.slots[sb] = cmd.a;
      next.slot_provenance[sa] = "EXPLICIT"; next.slot_provenance[sb] = "EXPLICIT";
      return done();
    }
    case "lineup.clear_slot": {
      const s = slotOf(next, cmd.player);
      if (s) { next.slots[s] = null; delete next.slot_provenance[s]; }
      return done();
    }
    case "lineup.shift_group": {
      const slots = groupSlots(next.formation, cmd.group);
      if (slots.length === 0) {
        const alt = cmd.group === "WINGERS" ? groupSlots(next.formation, "MID").filter((s) => ["LM", "RM"].includes(slotInfo(s).pos)) : [];
        return ask("AMB-OP", "En este sistema no hay extremos.", [
          ...(alt.length ? [{ label: "Aplicarlo a los medios de banda (MI y MD)", commands: alt.map((slot) => ({ op: "lineup.shift_slot", slot, du_m: cmd.du_m })) }] : []),
          { label: "Cancelar", commands: [] },
        ]);
      }
      shiftSlots(next, slots, cmd, ctx);
      return done();
    }
    case "lineup.shift_slot": {
      shiftSlots(next, [cmd.slot], cmd, ctx);
      return done();
    }
    case "lineup.compact": {
      const pos = slotMeters(next, ctx);
      const outfield = Object.keys(pos).filter((s) => slotInfo(s).pos !== "GK");
      const axis = cmd.axis ?? "U";
      const cx = outfield.reduce((a, s) => a + pos[s].x, 0) / outfield.length;
      const cy = outfield.reduce((a, s) => a + pos[s].y, 0) / outfield.length;
      for (const s of outfield) {
        const o = (next.overrides[s] ??= { dx_m: 0, dy_m: 0 });
        if (axis === "U" || axis === "BOTH") o.dx_m = r2(o.dx_m + (cx + (pos[s].x - cx) * cmd.factor - pos[s].x));
        if (axis === "V" || axis === "BOTH") o.dy_m = r2(o.dy_m + (cy + (pos[s].y - cy) * cmd.factor - pos[s].y));
      }
      return done();
    }
    default:
      throw new Error(`Operación de alineación no soportada: ${cmd.op}`);
  }
}

function shiftSlots(doc: LineupDoc, slots: string[], cmd: Command, ctx: EngineContext) {
  const pos = slotMeters(doc, ctx);
  const W = ctx.pitch.width_m;
  for (const s of slots) {
    const o = (doc.overrides[s] ??= { dx_m: 0, dy_m: 0 });
    if (cmd.du_m) o.dx_m = r2(o.dx_m + cmd.du_m);
    const away = cmd.away_from_center_m ?? (cmd.toward === "CENTER" ? -(cmd.dv_m ?? 3) : cmd.toward === "TOUCHLINE" ? (cmd.dv_m ?? 3) : 0);
    if (away) {
      const y = pos[s].y, dir = Math.sign(y - W / 2);
      const ny = Math.min(W - 2, Math.max(2, y + dir * away));
      o.dy_m = r2(o.dy_m + (ny - y));
    } else if (cmd.dv_m) o.dy_m = r2(o.dy_m + cmd.dv_m);
  }
}

/** Posición de cada ranura en metros (formación base + ajustes). */
export function slotMeters(doc: LineupDoc, ctx: EngineContext): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const s of formationSlots(doc.formation)) {
    const o = doc.overrides[s.slot] ?? { dx_m: 0, dy_m: 0 };
    out[s.slot] = { x: s.u * ctx.pitch.length_m + o.dx_m, y: s.v * ctx.pitch.width_m + o.dy_m };
  }
  return out;
}
export function lineupPositions(doc: LineupDoc, ctx: EngineContext): Record<string, Pt> {
  const m = slotMeters(doc, ctx);
  const out: Record<string, Pt> = {};
  for (const [s, p] of Object.entries(m)) out[s] = { u: r4(p.x / ctx.pitch.length_m), v: r4(p.y / ctx.pitch.width_m) };
  return out;
}

export function validateLineup(doc: LineupDoc, ctx: EngineContext): Diagnostic[] {
  const d: Diagnostic[] = [];
  const filled = Object.entries(doc.slots).filter(([, p]) => p);
  if (filled.length !== 11) d.push({ rule_id: "LINEUP-01", class: "LINEUP", severity: "error", message: `La alineación tiene ${filled.length} jugadores.` });
  const gk = filled.filter(([s]) => slotInfo(s).pos === "GK").length;
  if (gk !== 1) d.push({ rule_id: "LINEUP-03", class: "LINEUP", severity: "error", message: "Debe haber exactamente un portero." });
  for (const [slot, pid] of filled) {
    const p = player(ctx, pid!);
    if (p.status !== "AVAILABLE") d.push({ rule_id: "LINEUP-04", class: "LINEUP", severity: "warning", message: `${nameOf(ctx, p.id)} no está disponible (${p.status.toLowerCase()}).` });
    const { pos } = slotInfo(slot);
    if (p.pos !== pos && !p.secondary?.includes(pos)) d.push({ rule_id: "LINEUP-05", class: "LINEUP", severity: "info", message: `${nameOf(ctx, p.id)} no tiene «${POS_LABEL[pos]}» entre sus posiciones.` });
  }
  // LINEUP-06: distancia entre líneas consecutivas (media de x por línea).
  const m = slotMeters(doc, ctx);
  const lines: Record<string, number[]> = {};
  for (const s of Object.keys(m)) { const l = LINE_OF_POS[slotInfo(s).pos]; if (l !== "GK") (lines[l] ??= []).push(m[s].x); }
  const order = ["DEF", "MID", "ATT"].filter((l) => lines[l]);
  for (let i = 1; i < order.length; i++) {
    const a = mean(lines[order[i - 1]]), b = mean(lines[order[i]]);
    if (b - a < 6) d.push({ rule_id: "LINEUP-06", class: "LINEUP", severity: "warning", message: `Las líneas ${order[i - 1]} y ${order[i]} están a menos de 6 m.` });
  }
  return d;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
