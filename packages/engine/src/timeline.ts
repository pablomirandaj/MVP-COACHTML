// Compilación a pistas muestreadas (docs/15 §13.2). El reproductor (app o HTML exportado) solo interpola
// entre muestras: toda la lógica de movimiento vive aquí, en una única implementación determinista.
import { TIMELINE } from "./catalog/index";
import { controlPoint, quad, toM, toN } from "./geometry";
import type { PhaseScene } from "./phases/types";
import { ballCurve } from "./setpiece/derive";
import type { Movement, Player, PlayDoc, Pt } from "./types";
import { r4 } from "./util/num";
import { narratePlay, narrateScene, type Step } from "./narrate";

export interface TrackActor { id: string; team: "OWN" | "OPP"; label: string; title: string; proposal: boolean; role?: string }
export interface TrackPath { kind: "run" | "ball" | "screen" | "press" | "cover"; pts: [number, number][]; proposal: boolean; from?: number; to?: number }
export interface Tracks {
  title: string; subtitle?: string; view: "HALF_ATT" | "FULL"; pitch: { length_m: number; width_m: number };
  t0: number; t1: number; fps: number;
  actors: TrackActor[];
  /** Por muestra: [u,v] de cada actor en orden y al final [u,v,h] del balón (h = altura relativa 0–1). */
  frames: number[][];
  paths: TrackPath[];
  markers: { t: number; label: string }[];
  notes: { t: number; text: string }[];
  /** Explicación por pasos (title = qué pasa, implies = qué implica), ordenada por t. */
  steps: Step[];
  legend: string[];
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const FPS = 20;
const ROLE_ES: Record<string, string> = {
  TAKER: "lanzador", BLOCKER: "bloqueo", PRIMARY_TARGET: "rematador principal", SECONDARY_TARGET: "rematador secundario",
  DECOY: "arrastre", REBOUND: "rechace", REST_DEFENDER: "vigilancia", SHORT_RECEIVER: "receptor del corto", GK_SCREEN: "molestar al portero",
  GOALKEEPER: "portero", ZONAL_DEFENDER: "defensor en zona", MAN_MARKER: "marcador", COUNTER_OUTLET: "salida a la contra", COVER: "cobertura",
};

function movementAt(doc: PlayDoc, m: Movement, t: number): Pt {
  if (m.path.length < 2) return m.path[0];
  const a = toM(m.path[0], doc.pitch), b = toM(m.path[m.path.length - 1], doc.pitch);
  const s = t <= m.t_start ? 0 : t >= m.t_end ? 1 : ease((t - m.t_start) / (m.t_end - m.t_start || 1));
  const p = m.shape === "CURVED_IN" ? quad(a, controlPoint(a, b, 0.15, -1), b, s) : { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
  return toN(p, doc.pitch);
}

export function playTracks(doc: PlayDoc, roster: Player[], title = "Jugada"): Tracks {
  const passes = doc.passes ?? [];
  const lastBall = passes.length ? passes[passes.length - 1].t_end : doc.delivery.arrival_t;
  const t0 = TIMELINE.prep_start_s, t1 = Math.round((lastBall + TIMELINE.end_after_arrival_s) * 100) / 100;
  const name = (pid?: string | null) => roster.find((p) => p.id === pid);
  const actors: TrackActor[] = doc.actors.map((a) => {
    const p = name(a.player_id);
    return {
      id: a.id, team: a.team, label: a.team === "OWN" ? a.label : "", role: a.role,
      title: a.team === "OWN" ? `${p ? `${p.name} (${p.n ?? "-"})` : a.label} — ${ROLE_ES[a.role] ?? a.role}` : `Rival — ${ROLE_ES[a.role] ?? a.role}`,
      proposal: a.team === "OWN" && String(a.provenance.role ?? "").startsWith("RULE:"),
    };
  });
  const curve = ballCurve(doc);
  const posAt = (id: string, t: number): Pt => {
    const a = doc.actors.find((x) => x.id === id)!;
    const m = doc.movements.find((x) => x.actor === id);
    return m ? movementAt(doc, m, t) : a.start;
  };
  /** Balón tras la entrega: con el poseedor o viajando en un pase. */
  const ballAfter = (t: number): Pt => {
    let holderPt: Pt = doc.delivery.target_point;
    for (const ps of passes) {
      if (t < ps.t_start) return holderPt;
      if (t <= ps.t_end) {
        const a = posAt(ps.from, ps.t_start), b = toN(endOfActor(ps.to), doc.pitch);
        const s = (t - ps.t_start) / Math.max(1e-6, ps.t_end - ps.t_start);
        return { u: a.u + (b.u - a.u) * s, v: a.v + (b.v - a.v) * s };
      }
      holderPt = posAt(ps.to, t);
    }
    return holderPt;
  };
  const endOfActor = (id: string) => toM((doc.movements.find((x) => x.actor === id)?.path.slice(-1)[0]) ?? doc.actors.find((x) => x.id === id)!.start, doc.pitch);
  const frames: number[][] = [];
  const n = Math.round((t1 - t0) * FPS);
  for (let i = 0; i <= n; i++) {
    const t = t0 + i / FPS;
    const row: number[] = [];
    for (const a of doc.actors) {
      const m = doc.movements.find((x) => x.actor === a.id);
      const p = m ? movementAt(doc, m, t) : a.start;
      row.push(r4(p.u), r4(p.v));
    }
    const arr = doc.delivery.arrival_t;
    const s = t <= 0 ? 0 : t >= arr ? 1 : t / arr;
    const b = passes.length && t > arr ? ballAfter(t) : toN(quad(curve.p0, curve.c, curve.p1, s), doc.pitch);
    row.push(r4(b.u), r4(b.v), r4(t > 0 && t < arr && doc.delivery.trajectory !== "LOW" && doc.delivery.trajectory !== "SHORT" ? Math.sin(Math.PI * s) : 0));
    frames.push(row);
  }
  const paths: TrackPath[] = [];
  for (const m of doc.movements) {
    const a = doc.actors.find((x) => x.id === m.actor)!;
    if (a.team !== "OWN" || m.path.length < 2) continue;
    const A = toM(m.path[0], doc.pitch), B = toM(m.path[m.path.length - 1], doc.pitch);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const p = m.shape === "CURVED_IN" ? quad(A, controlPoint(A, B, 0.15, -1), B, i / 12) : { x: A.x + (B.x - A.x) * (i / 12), y: A.y + (B.y - A.y) * (i / 12) };
      const q = toN(p, doc.pitch); pts.push([q.u, q.v]);
    }
    paths.push({ kind: m.type === "SCREEN" ? "screen" : "run", pts, proposal: String(m.provenance.type ?? "").startsWith("RULE:") });
  }
  const bpts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) { const q = toN(quad(curve.p0, curve.c, curve.p1, i / 24), doc.pitch); bpts.push([q.u, q.v]); }
  paths.push({ kind: "ball", pts: bpts, proposal: String(doc.delivery.provenance.target_zone ?? "").startsWith("RULE:") });
  for (const ps of passes) {
    const a = posAt(ps.from, ps.t_start), b = toN(endOfActor(ps.to), doc.pitch);
    paths.push({ kind: "ball", pts: [[a.u, a.v], [b.u, b.v]], proposal: String(ps.origin).startsWith("RULE:"), from: ps.t_start });
  }
  return {
    title, view: "HALF_ATT", pitch: doc.pitch, t0, t1, fps: FPS, actors, frames, paths,
    markers: [{ t: t0, label: "Preparación" }, { t: 0, label: "Golpeo" }, { t: doc.delivery.arrival_t, label: "Llegada" }],
    notes: doc.notes.map((n) => ({ t: t0, text: n.text })),
    steps: narratePlay(doc, roster).map((x) => ({ ...x, t: Math.max(t0, x.t) })),
    legend: ["● propio", "■ rival", "── indicado por el entrenador", "- - - propuesta del sistema", "┃ bloqueo"],
  };
}

export function sceneTracks(scene: PhaseScene, title?: string): Tracks {
  const keys = scene.frames;
  const ownSlots = Object.keys(keys[0].own), oppSlots = Object.keys(keys[0].opp);
  const actors: TrackActor[] = [
    ...ownSlots.map((s) => ({ id: s, team: "OWN" as const, label: scene.own_labels[s] ?? s, title: `Nuestro ${scene.own_labels[s] ?? s}`, proposal: false })),
    ...oppSlots.map((s) => ({ id: `opp:${s}`, team: "OPP" as const, label: scene.opp_labels[s] ?? s, title: `Rival ${scene.opp_labels[s] ?? s}`, proposal: false })),
  ];
  const HOLD = 0.6; // segundos de pausa en cada fotograma clave
  const t0 = 0;
  const segs: { from: number; to: number; a: number; b: number }[] = [];
  let t = 0;
  for (let i = 0; i < keys.length; i++) {
    segs.push({ from: t, to: t + HOLD, a: i, b: i }); t += HOLD;
    if (i < keys.length - 1) { const d = Math.max(0.6, keys[i + 1].t - keys[i].t); segs.push({ from: t, to: t + d, a: i, b: i + 1 }); t += d; }
  }
  const t1 = t;
  const frames: number[][] = [];
  const n = Math.round((t1 - t0) * FPS);
  const lerp = (p: Pt, q: Pt, s: number): [number, number] => [r4(p.u + (q.u - p.u) * s), r4(p.v + (q.v - p.v) * s)];
  for (let i = 0; i <= n; i++) {
    const tt = t0 + i / FPS;
    const sg = segs.find((x) => tt <= x.to + 1e-9) ?? segs[segs.length - 1];
    const s = sg.a === sg.b ? 0 : ease(Math.min(1, (tt - sg.from) / (sg.to - sg.from)));
    const A = keys[sg.a], B = keys[sg.b];
    const row: number[] = [];
    for (const k of ownSlots) row.push(...lerp(A.own[k], B.own[k], s));
    for (const k of oppSlots) row.push(...lerp(A.opp[k], B.opp[k], s));
    row.push(...lerp(A.ball, B.ball, s), 0);
    frames.push(row);
  }
  const paths: TrackPath[] = [];
  keys.forEach((k, i) => {
    if (i === 0) return;
    const prev = keys[i - 1];
    const from = segs.find((x) => x.a === i - 1 && x.b === i)?.from ?? 0;
    for (const [slot, role] of Object.entries(k.roles)) {
      const isOpp = slot.startsWith("opp:");
      const id = isOpp ? slot.slice(4) : slot;
      const p = isOpp ? prev.opp[id] : prev.own[id], q = isOpp ? k.opp[id] : k.own[id];
      if (!p || !q) continue;
      const kind = role === "PRESSER" ? "press" : role === "COVER" ? "cover" : null;
      if (kind) paths.push({ kind, pts: [[p.u, p.v], [q.u, q.v]], proposal: false, from });
    }
  });
  const markers = keys.map((k, i) => ({ t: segs.find((x) => x.a === i && x.b === i)!.from, label: k.event === "TRIGGER" ? "¡Presión!" : `Paso ${i + 1}` }));
  const notes = keys.filter((k) => k.note).map((k) => ({ t: segs.find((x) => x.a === keys.indexOf(k) && x.b === keys.indexOf(k))!.from, text: k.note! }));
  const steps = narrateScene(scene).map((x, i) => ({ ...x, t: segs.find((sg) => sg.a === i && sg.b === i)!.from }));
  return {
    title: title ?? scene.title, view: "FULL", pitch: scene.pitch, t0, t1, fps: FPS, actors, frames, paths, markers, notes, steps,
    legend: ["● nuestro equipo", "■ rival", "➜ salto de presión", "⇢ cobertura"],
  };
}
