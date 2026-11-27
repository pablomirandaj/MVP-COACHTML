// Jugada de balón parado → secuencia «como la J5»: Colocados → Bloqueos → Desmarques → Golpeo (AHORA) → Remate;
// en el saque corto, un paso por pase; en defensa, Colocados → Golpeo (AHORA) → Despeje y contra.
import { controlPoint, toM } from "../geometry";
import { narratePlay, type Step } from "../narrate";
import { ballCurve } from "../setpiece/derive";
import type { M, Player, PlayDoc } from "../types";
import { cleanFrame, pt, type Line, type SeqActor, type SeqFrame, type Sequence } from "./types";

const P = (m: M) => pt(m.x, m.y);
const isStraight = (p0: M, c: M, p1: M) => Math.abs(c.x - (p0.x + p1.x) / 2) < 0.05 && Math.abs(c.y - (p0.y + p1.y) / 2) < 0.05;
const curveLine = (p0: M, c: M, p1: M): Line => (isStraight(p0, c, p1) ? [...P(p0), ...P(p1)] as Line : [...P(p0), ...P(c), ...P(p1)] as Line);
const join = (steps: Step[], f: (s: Step) => string) => steps.map(f).filter(Boolean).join(" ");

export function sequenceOfPlay(doc: PlayDoc, roster: Player[], opts: { labels?: "ROLE" | "DORSAL"; title?: string } = {}): Sequence {
  const pitch = doc.pitch, L = pitch.length_m, W = pitch.width_m;
  const role = (opts.labels ?? "ROLE") === "ROLE";
  const defending = doc.type.endsWith("_DEF");
  let n = 0;
  const actors: SeqActor[] = doc.actors.map((a) => {
    if (a.team === "OPP") return { id: a.id, team: "OPP", label: a.role === "GOALKEEPER" ? "P" : a.role === "TAKER" ? "S" : defending ? a.label : "" };
    const kind: SeqActor["kind"] = a.role === "TAKER" ? "taker" : a.role === "REST_DEFENDER" ? "back" : a.role === "REBOUND" || a.role === "EDGE_GUARD" ? "edge" : undefined;
    const label = !role ? a.label : a.role === "GOALKEEPER" ? "P" : kind === "taker" ? "S" : kind === "back" ? "C" : kind === "edge" ? "F" : String(++n);
    return { id: a.id, team: "OWN", label, ...(kind ? { kind } : {}) };
  });
  const ids = new Set(doc.actors.map((a) => a.id));
  const start = Object.fromEntries(doc.actors.map((a) => [a.id, P(toM(a.start, pitch))]));
  const mov = (id: string) => doc.movements.find((x) => x.actor === id);
  const endP = (id: string) => { const m = mov(id); return P(toM(m && m.path.length ? m.path[m.path.length - 1] : doc.actors.find((a) => a.id === id)!.start, pitch)); };
  const runLine = (id: string): Line | null => {
    const m = mov(id);
    if (!m || m.path.length < 2) return null;
    const a = toM(m.path[0], pitch), b = toM(m.path[m.path.length - 1], pitch);
    return m.shape === "CURVED_IN" ? [...P(a), ...P(controlPoint(a, b, 0.15, -1)), ...P(b)] as Line : [...P(a), ...P(b)] as Line;
  };
  const narr = narratePlay(doc, roster);
  const by = (src: string) => narr.filter((s) => s.source === src);
  const setup = narr[0];
  const curve = ballCurve(doc);
  const target = P(curve.p1);
  const primary = doc.actors.find((a) => a.team === "OWN" && a.role === "PRIMARY_TARGET");
  const frames: SeqFrame[] = [{ beat: "Colocados", txt: setup ? (setup.source === "MANUAL" ? setup.title : setup.implies) : "Colocación inicial." }];

  if (defending) {
    const theirRuns = doc.actors.filter((a) => a.team === "OPP" && (mov(a.id)?.path.length ?? 0) > 1);
    const markers = doc.actors.filter((a) => a.team === "OWN" && mov(a.id)?.type === "FOLLOW" && (mov(a.id)?.path.length ?? 0) > 1);
    const pos = Object.fromEntries([...theirRuns, ...markers].map((a) => [a.id, endP(a.id)]));
    const del = by("RULE:NARR-DELIVERY")[0], mark = by("RULE:NARR-MARK")[0], counter = by("RULE:NARR-COUNTER")[0];
    frames.push({ beat: "Golpeo", trig: true, txt: [del?.implies, mark?.implies].filter(Boolean).join(" "), pos, ball: target,
      runs: [...theirRuns, ...markers].map((a) => runLine(a.id)).filter(Boolean) as Line[], passes: [curveLine(curve.p0, curve.c, curve.p1)],
      key: markers.map((a) => a.id) });
    const out = doc.actors.find((a) => a.team === "OWN" && a.role === "COUNTER_OUTLET");
    if (out) frames.push({ beat: "Despeje y contra", txt: counter?.implies ?? "Despejamos fuera y salimos.", ball: start[out.id], passes: [[...target, ...start[out.id]] as Line], key: [out.id] });
    return finish();
  }

  const blocks = doc.relations.filter((r) => r.type === "SCREENS" && r.blocker && ids.has(r.blocker));
  if (blocks.length) {
    const ids2 = blocks.map((r) => r.blocker!);
    frames.push({ beat: "Bloqueos", txt: join(by("RULE:NARR-BLOCK"), (s) => `${s.title}. ${s.implies}`) || "Primero se bloquea.",
      pos: Object.fromEntries(ids2.map((id) => [id, endP(id)])), blocks: ids2.map((id) => runLine(id)).filter(Boolean) as Line[], key: ids2 });
  }
  const runners = doc.actors.filter((a) => a.team === "OWN" && a.role !== "TAKER" && !blocks.some((r) => r.blocker === a.id)
    && mov(a.id) && mov(a.id)!.type !== "HOLD" && mov(a.id)!.path.length > 1 && !(doc.passes ?? []).some((p) => p.to === a.id || p.from === a.id));
  const followers = doc.actors.filter((a) => a.team === "OPP" && mov(a.id)?.type === "FOLLOW" && (mov(a.id)?.path.length ?? 0) > 1);
  if (runners.length) {
    const order = [...runners].sort((a, b) => Number(b.id === primary?.id) - Number(a.id === primary?.id));
    frames.push({ beat: "Desmarques", txt: join(by("RULE:NARR-RUN").slice(0, 2), (s) => `${s.title}. ${s.implies}`) || "Los rematadores atacan su zona.",
      pos: Object.fromEntries([...runners, ...followers].map((a) => [a.id, endP(a.id)])), runs: order.map((a) => runLine(a.id)).filter(Boolean) as Line[], key: order.map((a) => a.id) });
  }
  const del = by("RULE:NARR-DELIVERY")[0];
  const taker = doc.delivery.taker_actor;
  frames.push({ beat: doc.type.startsWith("THROW_IN") ? "Saque" : "Golpeo", trig: true, txt: del ? `${del.title}. ${del.implies}` : "Sale el balón.",
    ball: target, passes: [curveLine(curve.p0, curve.c, curve.p1)], key: [taker, ...(primary ? [primary.id] : [])] });

  const passes = doc.passes ?? [];
  const passSteps = by("RULE:NARR-PASS");
  passes.forEach((ps, i) => {
    const recv = ps.to, last = i === passes.length - 1;
    const pos: Record<string, [number, number]> = { [recv]: endP(recv), [ps.from]: endP(ps.from) };
    for (const f of followers) pos[f.id] = endP(f.id);
    const run = runLine(recv);
    frames.push({ beat: last ? "Al tercer hombre" : i === 0 ? "Devolución" : "Pase", trig: last, txt: passSteps[i] ? `${passSteps[i].title}. ${passSteps[i].implies}` : "Pase.",
      pos, ball: endP(recv), passes: [[...endP(ps.from), ...endP(recv)] as Line], ...(run ? { runs: [run] } : {}), key: [ps.from, recv] });
  });
  if (!passes.length && primary) {
    const goal = pt(L - 0.3, Math.min(W / 2 + 3, Math.max(W / 2 - 3, target[1])));
    frames.push({ beat: "Remate", txt: "Remate de primeras, de frente al balón. Los de segunda línea, atentos al rechace.", ball: goal, passes: [[...target, ...goal] as Line], key: [primary.id] });
  }
  return finish();

  function finish(): Sequence {
    return { schema: "fcs.seq/1", title: opts.title ?? doc.type, view: "HALF", pitch, actors, start, ball: P(curve.p0), frames: frames.map((f) => cleanFrame(f, ids)) };
  }
}
