// Campo con los colores del club, controles de reproducción y avance por pasos.
import type { Tracks } from "@fcs/engine";
import { Pitch, useTimeline, type PitchProps } from "../../components/Pitch";
import { useStudio } from "../lib/context";

export type Timeline = ReturnType<typeof useTimeline>;
export { useTimeline };

export function currentStep(tracks: Tracks, t: number) {
  let k = -1; tracks.steps.forEach((s, i) => { if (s.t <= t + 1e-6) k = i; });
  return Math.max(0, k);
}

export function PitchBoard({ tracks, tl, ...rest }: { tracks: Tracks; tl: Timeline } & Omit<PitchProps, "tracks" | "t">) {
  const { host } = useStudio();
  const c = host.team.team().colors;
  const steps = tracks.steps;
  const ci = currentStep(tracks, tl.t);
  const go = (d: number) => { const k = Math.min(steps.length - 1, Math.max(0, ci + d)); if (steps[k]) tl.setT(steps[k].t); };
  return (
    <div className="st-stage">
      <div className="st-pitchwrap"><Pitch tracks={tracks} t={tl.t} ownColor={c.primary} ownInk={c.ink} oppColor="#d64545" {...rest} /></div>
      <div className="st-play">
        <button className="st-btn sm" onClick={() => go(-1)} aria-label="Paso anterior" disabled={!steps.length}>◀</button>
        <button className="st-btn sm primary" onClick={tl.toggle} aria-label={tl.playing ? "Pausar" : "Reproducir"}>{tl.playing ? "❚❚" : "▶"}</button>
        <button className="st-btn sm" onClick={() => go(1)} aria-label="Paso siguiente" disabled={!steps.length}>▶▶</button>
        <select value={tl.speed} onChange={(e) => tl.setSpeed(Number(e.target.value))} aria-label="Velocidad"><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option></select>
        <input type="range" min={tracks.t0} max={tracks.t1} step={0.01} value={tl.t} onChange={(e) => tl.setT(Number(e.target.value))} aria-label="Tiempo" />
      </div>
      {steps[ci] && <div className="st-hint" aria-live="polite"><b>Paso {ci + 1} de {steps.length} — {steps[ci].title}</b><br /><span className="st-muted">{steps[ci].implies}</span></div>}
    </div>
  );
}
