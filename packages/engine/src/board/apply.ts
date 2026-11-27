// Creación y edición de la pizarra con comandos IR board.* (función pura y determinista).
import { resolveZone } from "../geometry";
import { possessionShape, defendingBlock, mirror, slotsOf } from "../phases/scene";
import { slotInfo } from "../lineup";
import type { Command, Pitch, Pt, ZoneId } from "../types";
import { DEFAULT_PITCH } from "../geometry";
import type { BoardDoc, BoardStep } from "./types";
import { validateBoard } from "./validate";

const ABBR: Record<string, string> = { GK: "POR", RB: "LD", LB: "LI", RWB: "CAD", LWB: "CAI", CB: "DFC", DM: "MCD", CM: "MC", RM: "MD", LM: "MI", AM: "MCO", RW: "ED", LW: "EI", ST: "DC", SS: "SD" };
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const toPt = (x: number, y: number, p: Pitch): Pt => ({ u: r4(x / p.length_m), v: r4(y / p.width_m) });

function placeTeams(own: string, opp: string, pitch: Pitch) {
  const o = possessionShape(own, pitch, "BUILD_UP");
  const gk = Object.keys(o).find((k) => slotInfo(k).pos === "GK") ?? Object.keys(o)[0];
  const ball = { x: o[gk].x + 1, y: o[gk].y };
  const block = defendingBlock(opp, pitch, "MID", 30, 0.55, mirror(ball, pitch));
  return {
    own: Object.fromEntries(Object.entries(o).map(([k, m]) => [k, toPt(m.x, m.y, pitch)])),
    opp: Object.fromEntries(Object.entries(block).map(([k, m]) => { const q = mirror(m, pitch); return [k, toPt(q.x, q.y, pitch)]; })),
    ball: toPt(ball.x, ball.y, pitch),
  };
}

export function createBoard(spec: { own: string; opp: string; title?: string }, pitch: Pitch = DEFAULT_PITCH): BoardDoc {
  const labels = Object.fromEntries(slotsOf(spec.own).map((s) => [s.slot, ABBR[slotInfo(s.slot).pos] ?? s.slot]));
  const doc: BoardDoc = {
    schema: "fcs.board/1", title: spec.title ?? "Pizarra", pitch,
    own: { formation: spec.own, labels }, opp: { formation: spec.opp },
    start: placeTeams(spec.own, spec.opp, pitch), steps: [], diagnostics: [],
  };
  doc.diagnostics = validateBoard(doc);
  return doc;
}

export interface BoardEditResult { doc: BoardDoc; diagnostics: BoardDoc["diagnostics"]; changed: boolean }

export function applyBoardCommand(input: BoardDoc, cmd: Command, origin = "EXPLICIT"): BoardEditResult {
  const doc: BoardDoc = JSON.parse(JSON.stringify(input));
  const extra: BoardDoc["diagnostics"] = [];
  const step = (id: string): BoardStep => {
    const s = doc.steps.find((x) => x.id === id);
    if (!s) throw new Error(`Paso desconocido: ${id}`);
    return s;
  };
  const actor = (id: string) => {
    const [team, slot] = String(id).split(":");
    if (!(team === "own" ? doc.start.own : team === "opp" ? doc.start.opp : {})[slot as string]) throw new Error(`Jugador desconocido en la pizarra: ${id}`);
    return id;
  };
  const point = (to: any): Pt => {
    let p: Pt = to?.zone ? (() => { const z = resolveZone(to.zone as ZoneId, "LEFT", doc.pitch); return toPt(z.anchors[0].x, z.anchors[0].y, doc.pitch); })() : { u: Number(to?.u), v: Number(to?.v) };
    if (!Number.isFinite(p.u) || !Number.isFinite(p.v)) throw new Error("Punto no válido.");
    const c = { u: r4(Math.min(1, Math.max(0, p.u))), v: r4(Math.min(1, Math.max(0, p.v))) };
    if (c.u !== r4(p.u) || c.v !== r4(p.v)) extra.push({ rule_id: "BOARD-01", class: "GEOMETRY", severity: "error", message: "El punto estaba fuera del campo: se ha ajustado a la línea." });
    p = c;
    return p;
  };

  switch (cmd.op) {
    case "board.add_step": {
      const n = Math.max(0, ...doc.steps.map((s) => Number(s.id.slice(1)) || 0)) + 1;
      const s: BoardStep = { id: `s${n}`, moves: [] };
      const at = cmd.after ? doc.steps.findIndex((x) => x.id === cmd.after) + 1 : doc.steps.length;
      doc.steps.splice(at <= 0 ? doc.steps.length : at, 0, s);
      break;
    }
    case "board.remove_step": doc.steps = doc.steps.filter((s) => s.id !== cmd.step); break;
    case "board.move": {
      const s = step(cmd.step), a = actor(cmd.actor);
      s.moves = s.moves.filter((m) => m.actor !== a);
      s.moves.push({ actor: a, to: point(cmd.to), kind: cmd.kind ?? "RUN", origin });
      break;
    }
    case "board.pass": {
      const s = step(cmd.step);
      s.pass = { from: actor(cmd.from), to: typeof cmd.to === "string" ? actor(cmd.to) : point(cmd.to), kind: cmd.kind ?? "GROUND", origin };
      break;
    }
    case "board.press": {
      const s = step(cmd.step), a = actor(cmd.actor), t = actor(cmd.target);
      s.press = [...(s.press ?? []).filter((p) => p.actor !== a), { actor: a, target: t }];
      break;
    }
    case "board.note": step(cmd.step).note = { title: String(cmd.title ?? ""), implies: String(cmd.implies ?? ""), origin: origin === "EXPLICIT" ? "MANUAL" : origin }; break;
    case "board.set_formation": {
      const own = cmd.team === "OPP" ? doc.own.formation : cmd.formation, opp = cmd.team === "OPP" ? cmd.formation : doc.opp.formation;
      slotsOf(cmd.formation);
      const placed = placeTeams(own, opp, doc.pitch);
      if (cmd.team === "OPP") { doc.opp.formation = opp; doc.start.opp = placed.opp; }
      else { doc.own.formation = own; doc.start.own = placed.own; doc.start.ball = placed.ball; doc.own.labels = Object.fromEntries(slotsOf(own).map((s) => [s.slot, ABBR[slotInfo(s.slot).pos] ?? s.slot])); }
      const valid = new Set([...Object.keys(doc.start.own).map((k) => `own:${k}`), ...Object.keys(doc.start.opp).map((k) => `opp:${k}`)]);
      for (const s of doc.steps) {
        s.moves = s.moves.filter((m) => valid.has(m.actor));
        s.press = s.press?.filter((p) => valid.has(p.actor) && valid.has(p.target));
        if (s.pass && (!valid.has(s.pass.from) || (typeof s.pass.to === "string" && !valid.has(s.pass.to)))) delete s.pass;
      }
      break;
    }
    case "board.mark_step": {
      const st = step(cmd.step);
      if (cmd.key !== undefined) st.key = (cmd.key as string[]).map(String);
      if (cmd.trig !== undefined) { if (cmd.trig) st.trig = true; else delete st.trig; }
      break;
    }
    case "board.set_labels": doc.own.labels = { ...doc.own.labels, ...(cmd.labels ?? {}) }; break;
    case "board.rename": doc.title = String(cmd.title ?? doc.title); break;
    default: throw new Error(`Operación de pizarra no soportada: ${cmd.op}`);
  }
  doc.diagnostics = [...extra, ...validateBoard(doc)];
  const changed = JSON.stringify({ ...doc, diagnostics: [] }) !== JSON.stringify({ ...input, diagnostics: [] });
  return { doc: changed ? doc : input, diagnostics: doc.diagnostics, changed };
}
