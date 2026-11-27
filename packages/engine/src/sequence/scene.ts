// Escena de fase de juego → secuencia: un paso por fotograma clave. Saltos, coberturas, marcas y desmarques como
// carreras; el balón entre poseedores como pase; el disparador como «AHORA».
import { narrateScene } from "../narrate";
import type { PhaseScene as SceneDoc } from "../phases/types";
import type { Pt } from "../types";
import { cleanFrame, pt, type Line, type SeqActor, type SeqFrame, type Sequence } from "./types";

const ACTIVE = new Set(["PRESSER", "COVER", "MARK", "RUNNER", "FREE_MAN"]);

export function sequenceOfScene(scene: SceneDoc): Sequence {
  const L = scene.pitch.length_m, W = scene.pitch.width_m;
  const m = (p: Pt) => pt(p.u * L, p.v * W);
  const f0 = scene.frames[0];
  const ownIds = Object.keys(f0.own).map((k) => `own:${k}`), oppIds = Object.keys(f0.opp).map((k) => `opp:${k}`);
  const ids = [...ownIds, ...oppIds], idSet = new Set(ids);
  const actors: SeqActor[] = [
    ...Object.keys(f0.own).map((k) => ({ id: `own:${k}`, team: "OWN" as const, label: scene.own_labels[k] ?? k })),
    ...Object.keys(f0.opp).map((k) => ({ id: `opp:${k}`, team: "OPP" as const, label: scene.opp_labels[k] ?? "" })),
  ];
  const posOf = (f: SceneDoc["frames"][number], id: string) => (id.startsWith("own:") ? f.own[id.slice(4)] : f.opp[id.slice(4)]);
  const start = Object.fromEntries(ids.map((id) => [id, m(posOf(f0, id))]));
  const narr = narrateScene(scene);
  const frames: SeqFrame[] = scene.frames.map((f, i) => {
    const prev = scene.frames[Math.max(0, i - 1)];
    const pos: Record<string, [number, number]> = {};
    const runs: Line[] = [];
    for (const id of ids) {
      const a = m(posOf(prev, id)), b = m(posOf(f, id));
      if (i > 0 && (a[0] !== b[0] || a[1] !== b[1])) pos[id] = b;
    }
    const key: string[] = [];
    for (const [k, role] of Object.entries(f.roles).sort(([x], [y]) => x.localeCompare(y))) {
      if (!ACTIVE.has(role)) continue;
      const id = k.startsWith("opp:") ? k : `own:${k}`;
      key.push(id);
      if (i > 0 && role !== "FREE_MAN") { const a = m(posOf(prev, id)), b = m(posOf(f, id)); if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1) runs.push([...a, ...b] as Line); }
    }
    const pb = m(prev.ball), cb = m(f.ball);
    const passes: Line[] = i > 0 && Math.hypot(pb[0] - cb[0], pb[1] - cb[1]) > 2 ? [[...pb, ...cb] as Line] : [];
    return cleanFrame({ beat: narr[i]?.title ?? `Paso ${i + 1}`, txt: narr[i]?.implies ?? "", trig: f.event === "TRIGGER", key, pos, ball: cb, runs, passes }, idSet);
  });
  return { schema: "fcs.seq/1", title: scene.title, view: "FULL", pitch: scene.pitch, actors, start, ball: m(f0.ball), frames };
}
