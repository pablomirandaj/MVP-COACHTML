// Edición incremental de jugadas (docs/15 §11): cada comando cambia solo lo que nombra y lo que depende de ello.
import { MIN_SPACING_M, MOVEMENTS } from "../catalog/index";
import { dist, placeInZone, resolveZone, toM, toN } from "../geometry";
import type { Actor, Clarification, Command, Diagnostic, EngineContext, M, MovementType, PlayDoc } from "../types";
import { clamp, r2, r4 } from "../util/num";
import { endZoneOf, ROLE_ES } from "./common";
import { derive } from "./derive";
import { validatePlay } from "./validate";

export interface EditResult { doc: PlayDoc; clarifications: Clarification[]; diagnostics: Diagnostic[]; changed: boolean }

const clone = (d: PlayDoc): PlayDoc => JSON.parse(JSON.stringify(d));

/** Resuelve un selector de actores (docs/16 §6.2). */
export function selectActors(doc: PlayDoc, sel: any): Actor[] {
  const team = sel.team ?? "OWN";
  return doc.actors.filter((a) => {
    if (a.team !== team) return false;
    if (sel.actor && a.id !== sel.actor) return false;
    if (sel.player && a.player_id !== sel.player) return false;
    if (sel.role && a.role !== sel.role) return false;
    if (sel.zone && a.action_zone !== sel.zone) return false;
    if (sel.group && (a.group !== sel.group)) return false;
    return true;
  });
}

export function applyPlayCommand(input: PlayDoc, cmd: Command, ctx: EngineContext): EditResult {
  const doc = clone(input);
  const pitch = doc.pitch;
  const clar: Clarification[] = [];
  const name = (a: Actor) => { const p = ctx.roster.find((x) => x.id === a.player_id); return p ? `${p.n ?? ""}, ${p.name}`.replace(/^, /, "") : a.label; };
  const finish = (): EditResult => {
    const next = derive(doc);
    next.diagnostics = validatePlay(next, ctx);
    const changed = JSON.stringify({ ...next, diagnostics: [] }) !== JSON.stringify({ ...input, diagnostics: [] });
    return changed ? { doc: next, clarifications: [], diagnostics: next.diagnostics, changed } : { doc: input, clarifications: [], diagnostics: input.diagnostics, changed: false };
  };
  const ask = (c: Clarification): EditResult => ({ doc: input, clarifications: [c], diagnostics: input.diagnostics, changed: false });

  /** Aplica el selector y, si el número no es el esperado, pregunta (AMB-TARGET-MULTI / AMB-MISSING-REQUIRED). */
  const targets = (sel: any): Actor[] | EditResult => {
    if (!sel) return ask({ id: "clar_target", code: "AMB-MISSING-REQUIRED", question: "¿A quién?", options: [{ label: "Cancelar", commands: [] }] });
    const found = selectActors(doc, sel);
    const expect = sel.expect_count ?? (sel.player || sel.actor ? 1 : undefined);
    if (found.length === 0) return ask({ id: "clar_none", code: "AMB-TARGET-MULTI", question: "No encuentro a ningún jugador con esa descripción en la jugada.", options: [{ label: "Cancelar", commands: [] }] });
    if (expect !== undefined && found.length !== expect) {
      const sorted = [...found].sort((a, b) => a.start.v - b.start.v || a.start.u - b.start.u);
      const pos = (i: number) => (sorted.length === 2 ? (i === 0 ? "Al de la izquierda" : "Al de la derecha") : `A ${name(sorted[i])}`);
      const what = sel.role ? ROLE_ES[sel.role] ?? sel.role : "esa zona";
      return ask({
        id: "clar_multi", code: "AMB-TARGET-MULTI",
        question: `Hay ${found.length} jugadores en ${what}. ¿A ${expect === 1 ? "cuál" : "cuáles"}?`,
        options: [
          ...sorted.map((a, i) => ({ label: `${pos(i)} (${name(a)})`, commands: [{ ...cmd, target: { actor: a.id } }] })),
          { label: sorted.length === 2 ? "A los dos" : "A todos", commands: [{ ...cmd, target: { ...sel, expect_count: undefined } }] },
        ],
      });
    }
    return found;
  };
  const movOf = (id: string) => doc.movements.find((m) => m.actor === id);

  switch (cmd.op) {
    case "play.move_actor": {
      const t = targets(cmd.target); if (!Array.isArray(t)) return t;
      for (const a of t) {
        const m = toM(a.start, pitch);
        let p: M;
        if (cmd.to_zone) p = placeInZone(resolveZone(cmd.to_zone, doc.side, pitch), doc.actors.filter((x) => x.team === "OWN" && x.id !== a.id).map((x) => toM(x.start, pitch)), MIN_SPACING_M);
        else p = { x: m.x + (cmd.dx_m ?? 0), y: m.y + (cmd.dy_m ?? 0) };
        const actor = doc.actors.find((x) => x.id === a.id)!;
        const delta = { x: p.x - m.x, y: p.y - m.y };
        actor.start = toN(p, pitch);
        actor.provenance.start = "EXPLICIT";
        const mv = movOf(a.id);
        if (mv) {
          if (mv.type === "HOLD" || cmd.move_path === "WHOLE_PATH") mv.path = mv.path.map((q) => { const qm = toM(q, pitch); return toN({ x: qm.x + delta.x, y: qm.y + delta.y }, pitch); });
          else mv.path[0] = actor.start;
        }
      }
      return finish();
    }
    case "play.shift_timing": {
      const t = targets(cmd.target); if (!Array.isArray(t)) return t;
      for (const a of t) {
        const mv = movOf(a.id);
        if (!mv?.anchor) continue;
        mv.anchor.offset_s = r2(mv.anchor.offset_s + cmd.delta_s);
        mv.provenance.timing = "EXPLICIT";
      }
      return finish();
    }
    case "play.adjust_delivery": {
      const d = doc.delivery;
      const tp = toM(d.target_point, pitch);
      const old = { ...tp };
      if (cmd.closer_to_goal_m) tp.x = clamp(tp.x + cmd.closer_to_goal_m, pitch.length_m - 20, pitch.length_m - 0.5);
      if (cmd.further_m) tp.y = clamp(tp.y + (doc.side === "LEFT" ? 1 : -1) * cmd.further_m, 1, pitch.width_m - 1);
      if (cmd.curve_delta) d.curve = r4(clamp(d.curve + cmd.curve_delta, 0.05, 0.35));
      d.target_point = toN(tp, pitch);
      d.provenance.target_point = "EXPLICIT";
      // El rematador que ataca el destino del balón lo sigue.
      for (const a of doc.actors) {
        const mv = movOf(a.id);
        if (a.role !== "PRIMARY_TARGET" || !mv || mv.path.length < 2) continue;
        if (dist(toM(mv.path[mv.path.length - 1], pitch), old) < 0.01) mv.path[mv.path.length - 1] = d.target_point;
      }
      return finish();
    }
    case "play.set_delivery": {
      const d = doc.delivery;
      if (cmd.swing) { d.swing = cmd.swing; d.provenance.swing = "EXPLICIT"; }
      if (cmd.trajectory) { d.trajectory = cmd.trajectory; d.provenance.trajectory = "EXPLICIT"; }
      if (cmd.technique) { d.technique = cmd.technique; d.provenance.technique = "EXPLICIT"; }
      if (cmd.target_zone && cmd.target_zone !== d.target_zone) {
        d.target_zone = cmd.target_zone; d.target_point = toN(resolveZone(cmd.target_zone, doc.side, pitch).anchors[0], pitch);
        d.provenance.target_zone = "EXPLICIT";
      }
      return finish();
    }
    case "play.set_movement": {
      const t = targets(cmd.target); if (!Array.isArray(t)) return t;
      const type: MovementType = cmd.movement;
      for (const a of t) {
        const blocked = doc.constraints.find((c) => c.actor === a.id && c.rule === "NO_JOIN_ATTACK");
        if (blocked && type !== "HOLD") {
          return ask({ id: "clar_constraint", code: "AMB-CONFLICT-RULE", question: `Indicaste que ${name(a)} no debe incorporarse al remate.`, options: [
            { label: `Quitar la restricción a ${name(a)} y aplicar`, commands: [{ op: "play.constraint", target: { actor: a.id }, rule: "NONE" }, cmd] },
            { label: "Cancelar", commands: [] },
          ] });
        }
        const mv = movOf(a.id);
        if (!mv) continue;
        const zone = endZoneOf(type);
        const others = doc.movements.filter((m) => m !== mv && m.path.length > 1).map((m) => toM(m.path[m.path.length - 1], pitch));
        const start = a.start;
        mv.type = type;
        mv.provenance = { type: "EXPLICIT" };
        if (type === "HOLD") { mv.path = [start]; delete mv.anchor; delete mv.shape; }
        else {
          const end = zone ? placeInZone(resolveZone(zone, doc.side, pitch), others, MIN_SPACING_M) : toM(start, pitch);
          mv.path = [start, toN(end, pitch)];
          mv.shape = MOVEMENTS[type].shape === "CURVED_IN" ? "CURVED_IN" : "STRAIGHT";
          const an = MOVEMENTS[type].anchor;
          if (an) mv.anchor = { kind: an.kind as any, event: an.event as any, offset_s: an.offset_s };
          if (zone) doc.actors.find((x) => x.id === a.id)!.action_zone = zone;
        }
      }
      return finish();
    }
    case "play.constraint": {
      const t = targets(cmd.target); if (!Array.isArray(t)) return t;
      for (const a of t) {
        doc.constraints = doc.constraints.filter((c) => c.actor !== a.id);
        if (cmd.rule === "NONE") continue;
        doc.constraints.push({ actor: a.id, rule: cmd.rule, origin: "EXPLICIT" });
        const mv = movOf(a.id);
        if (mv && (cmd.rule === "NO_JOIN_ATTACK" || cmd.rule === "STAY") && mv.type !== "HOLD") { mv.type = "HOLD"; mv.path = [a.start]; delete mv.anchor; delete mv.shape; }
      }
      doc.constraints.sort((a, b) => a.actor.localeCompare(b.actor, "en", { numeric: true }));
      return finish();
    }
    case "play.assign_player": {
      const t = targets({ ...cmd.target, expect_count: 1 }); if (!Array.isArray(t)) return t;
      const already = doc.actors.find((a) => a.player_id === cmd.player && a.id !== t[0].id);
      const p = ctx.roster.find((x) => x.id === cmd.player)!;
      if (already) { already.player_id = t[0].player_id ?? null; already.label = t[0].label; }
      const a = doc.actors.find((x) => x.id === t[0].id)!;
      a.player_id = cmd.player; a.label = p.n ? String(p.n) : a.label; a.provenance.player_id = "EXPLICIT";
      return finish();
    }
    case "play.set_taker": {
      const taker = doc.actors.find((a) => a.id === doc.delivery.taker_actor)!;
      return applyPlayCommand(input, { op: "play.assign_player", target: { actor: taker.id }, player: cmd.player }, ctx);
    }
    case "play.remove_actor": {
      const t = targets(cmd.target); if (!Array.isArray(t)) return t;
      const ids = new Set(t.map((a) => a.id));
      doc.actors = doc.actors.filter((a) => !ids.has(a.id));
      doc.movements = doc.movements.filter((m) => !ids.has(m.actor));
      doc.relations = doc.relations.filter((r) => ![r.blocker, r.beneficiary, r.a, r.b].some((x) => x && ids.has(x)));
      doc.constraints = doc.constraints.filter((c) => !ids.has(c.actor));
      return finish();
    }
    default:
      throw new Error(`Operación de jugada no soportada: ${cmd.op}`);
  }
}
