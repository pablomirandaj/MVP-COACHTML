// Pizarra → secuencia: «Colocados» y un paso por paso de la pizarra.
import { states } from "../board/state";
import { narrateBoard } from "../board/tracks";
import type { BoardDoc } from "../board/types";
import { slotInfo } from "../lineup";
import type { Pt } from "../types";
import { cleanFrame, pt, type Line, type SeqActor, type SeqFrame, type Sequence } from "./types";

const ABBR: Record<string, string> = { GK: "POR", RB: "LD", LB: "LI", RWB: "CAD", LWB: "CAI", CB: "DFC", DM: "MCD", CM: "MC", RM: "MD", LM: "MI", AM: "MCO", RW: "ED", LW: "EI", ST: "DC", SS: "SD" };

export function sequenceOfBoard(doc: BoardDoc): Sequence {
  const L = doc.pitch.length_m, W = doc.pitch.width_m;
  const m = (p: Pt) => pt(p.u * L, p.v * W);
  const st = states(doc);
  const ids = [...Object.keys(doc.start.own).map((k) => `own:${k}`), ...Object.keys(doc.start.opp).map((k) => `opp:${k}`)];
  const actors: SeqActor[] = ids.map((id) => {
    const slot = id.slice(4);
    return id.startsWith("own:")
      ? { id, team: "OWN", label: doc.own.labels[slot] ?? ABBR[slotInfo(slot).pos] ?? slot }
      : { id, team: "OPP", label: ABBR[slotInfo(slot).pos] ?? "" };
  });
  const start = Object.fromEntries(ids.map((id) => [id, m(st[0].pos[id])]));
  const narr = narrateBoard(doc);
  const idSet = new Set(ids);
  const frames: SeqFrame[] = [{ beat: "Colocados", txt: doc.steps.length ? "Así empezamos. Pulsa ▶ para ver la jugada paso a paso." : "Colocación inicial. Añade pasos en la pizarra para construir la jugada." }];
  doc.steps.forEach((s, i) => {
    const a = st[i], b = st[i + 1];
    const pos: Record<string, [number, number]> = {};
    for (const id of ids) if (a.pos[id].u !== b.pos[id].u || a.pos[id].v !== b.pos[id].v) pos[id] = m(b.pos[id]);
    const runs: Line[] = [...s.moves.map((mv) => [...m(a.pos[mv.actor]), ...m(mv.to)] as Line),
      ...(s.press ?? []).map((p) => [...m(a.pos[p.actor]), ...m(b.pos[p.actor])] as Line)];
    const passes: Line[] = [];
    if (s.pass) {
      const from = b.pos[s.pass.from] ?? a.ball;
      const to = typeof s.pass.to === "string" ? b.pos[s.pass.to] : s.pass.to;
      if (to) passes.push([...m(from), ...m(to)] as Line);
    }
    const auto = [...s.moves.map((x) => x.actor), ...(s.press ?? []).map((p) => p.actor), ...(s.pass ? [s.pass.from, ...(typeof s.pass.to === "string" ? [s.pass.to] : [])] : [])];
    frames.push(cleanFrame({
      beat: narr[i]?.title ?? `Paso ${i + 1}`, txt: narr[i]?.implies ?? "", trig: s.trig, key: s.key ?? auto,
      pos, ball: m(b.ball), runs, passes,
    }, idSet));
  });
  return { schema: "fcs.seq/1", title: doc.title, view: "FULL", pitch: doc.pitch, actors, start, ball: m(st[0].ball), frames };
}
