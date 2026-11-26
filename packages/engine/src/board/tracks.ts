// Pistas de la pizarra: 0,5 s de pausa al empezar cada paso y 1,2 s de acción. El pase sale cuando el pasador
// termina su movimiento y llega con el receptor.
import type { Step } from "../narrate";
import type { TrackActor, TrackPath, Tracks } from "../timeline";
import type { Player, Pt } from "../types";
import { states } from "./state";
import type { BoardDoc, BoardState } from "./types";

export const STEP_PAUSE_S = 0.5, STEP_ACTION_S = 1.2;
const FPS = 20;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const label = (doc: BoardDoc, id: string) => (id.startsWith("own:") ? doc.own.labels[id.slice(4)] ?? id.slice(4) : id.slice(4));

/** Explicación automática de cada paso de la pizarra (se respeta la nota del entrenador o del asistente). */
export function narrateBoard(doc: BoardDoc): Step[] {
  const dur = STEP_PAUSE_S + STEP_ACTION_S;
  return doc.steps.map((s, i) => {
    const t = i * dur;
    const own = (id: string) => `el ${label(doc, id)}`;
    const riv = (id: string) => `su ${label(doc, id)}`;
    const who = (id: string) => (id.startsWith("own:") ? own(id) : riv(id));
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
    let title: string, implies: string;
    if (s.pass && typeof s.pass.to === "string") {
      const ran = s.moves.some((m) => m.actor === (s.pass!.to as string));
      title = `${cap(who(s.pass.from))} pasa a ${who(s.pass.to)}`;
      implies = ran ? "Pase al desmarque: el compañero recibe en carrera, por delante de su marca." : "Pase al pie: asegura la posesión y obliga al rival a moverse.";
    } else if (s.pass) {
      title = `${cap(who(s.pass.from))} pasa al espacio`;
      implies = "El balón va donde va a estar el compañero, no donde está ahora.";
    } else if (s.moves.some((m) => m.kind === "DRIBBLE")) {
      const d = s.moves.find((m) => m.kind === "DRIBBLE")!;
      title = `${cap(who(d.actor))} conduce`;
      implies = "Conducir hacia un rival lo fija y libera a un compañero.";
    } else if (s.press?.length) {
      title = s.press.map((p) => `${cap(who(p.actor))} presiona a ${who(p.target)}`).join(" y ");
      implies = "Cerramos el pase interior y le orientamos hacia la banda.";
    } else if (s.moves.length) {
      title = `Movimientos sin balón: ${s.moves.map((m) => label(doc, m.actor)).join(", ")}`;
      implies = "Ocupamos espacios para dar líneas de pase y arrastrar marcas.";
    } else {
      title = `Paso ${i + 1}`;
      implies = "Paso sin movimientos todavía: añade un movimiento o un pase.";
    }
    if (s.note && s.note.title) return { t, title: s.note.title, implies: s.note.implies || implies, source: s.note.origin };
    return { t, title, implies, source: "RULE:NARR-BOARD" };
  });
}

export function boardTracks(doc: BoardDoc, roster: Player[] = []): Tracks {
  void roster;
  const st = states(doc);
  const ids = [...Object.keys(doc.start.own).map((k) => `own:${k}`), ...Object.keys(doc.start.opp).map((k) => `opp:${k}`)];
  const actors: TrackActor[] = ids.map((id) => ({
    id, team: id.startsWith("own:") ? "OWN" : "OPP", label: label(doc, id),
    title: id.startsWith("own:") ? `Nuestro ${label(doc, id)}` : `Rival ${label(doc, id)}`, proposal: false,
  }));
  const dur = STEP_PAUSE_S + STEP_ACTION_S;
  const t1 = Math.max(1, doc.steps.length) * dur + 0.6;
  const frames: number[][] = [];
  const lerp = (a: Pt, b: Pt, s: number): Pt => ({ u: a.u + (b.u - a.u) * s, v: a.v + (b.v - a.v) * s });
  const frameAt = (t: number) => {
    const i = Math.min(doc.steps.length - 1, Math.floor(t / dur));
    if (i < 0 || !doc.steps.length) return { pos: st[0].pos, ball: st[0].ball };
    const step = doc.steps[i], a: BoardState = st[i], b: BoardState = st[i + 1];
    const local = Math.max(0, Math.min(1, (t - i * dur - STEP_PAUSE_S) / STEP_ACTION_S));
    const passerMoves = step.pass && step.moves.some((m) => m.actor === step.pass!.from);
    const passStart = step.pass ? (passerMoves ? 0.55 : 0.15) : 1;
    const pos: Record<string, Pt> = {};
    for (const id of ids) {
      const isPasser = step.pass?.from === id;
      const s = isPasser && passerMoves ? Math.min(1, local / passStart) : local;
      pos[id] = lerp(a.pos[id], b.pos[id], ease(s));
    }
    let ball: Pt;
    if (step.pass && local >= passStart) {
      const from = pos[step.pass.from] ? lerp(a.pos[step.pass.from], b.pos[step.pass.from], passerMoves ? 1 : ease(passStart)) : a.ball;
      const to = typeof step.pass.to === "string" ? b.pos[step.pass.to] : step.pass.to;
      ball = lerp(from, to, (local - passStart) / (1 - passStart));
    } else if (step.pass) ball = pos[step.pass.from] ?? a.ball;
    else if (a.holder && pos[a.holder]) ball = pos[a.holder];
    else ball = lerp(a.ball, b.ball, ease(local));
    return { pos, ball };
  };
  const n = Math.round(t1 * FPS);
  for (let k = 0; k <= n; k++) {
    const f = frameAt(k / FPS);
    const row: number[] = [];
    for (const id of ids) row.push(r4(f.pos[id].u), r4(f.pos[id].v));
    row.push(r4(f.ball.u), r4(f.ball.v), 0);
    frames.push(row);
  }
  const paths: TrackPath[] = [];
  doc.steps.forEach((s, i) => {
    const from = i * dur + STEP_PAUSE_S, a = st[i], b = st[i + 1];
    for (const m of s.moves) paths.push({ kind: m.kind === "DRIBBLE" ? "run" : "run", pts: [[a.pos[m.actor].u, a.pos[m.actor].v], [m.to.u, m.to.v]], proposal: m.origin !== "EXPLICIT" && m.origin !== "MANUAL", from });
    for (const p of s.press ?? []) paths.push({ kind: "press", pts: [[a.pos[p.actor].u, a.pos[p.actor].v], [b.pos[p.actor].u, b.pos[p.actor].v]], proposal: false, from });
    if (s.pass) {
      const p0 = b.pos[s.pass.from] ?? a.ball, p1 = typeof s.pass.to === "string" ? b.pos[s.pass.to] : s.pass.to;
      paths.push({ kind: "ball", pts: [[p0.u, p0.v], [p1.u, p1.v]], proposal: s.pass.origin !== "EXPLICIT" && s.pass.origin !== "MANUAL", from });
    }
  });
  const steps = narrateBoard(doc);
  return {
    title: doc.title, view: "FULL", pitch: doc.pitch, t0: 0, t1: Math.round(t1 * 100) / 100, fps: FPS, actors, frames, paths,
    markers: doc.steps.map((s, i) => ({ t: i * dur, label: `Paso ${i + 1}` })), notes: [], steps,
    legend: ["● nuestro equipo", "■ rival", "── carrera", "- - - pase", "➜ presión"],
  };
}
