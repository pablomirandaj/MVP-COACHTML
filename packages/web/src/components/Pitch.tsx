// Campo interactivo en SVG (docs/09, ADR-008). Dibuja un fotograma de unas pistas del motor; en móvil en vertical
// gira el campo (ataque hacia arriba). El arrastre se convierte a metros con la matriz inversa del grupo del campo,
// así funciona igual en horizontal y en vertical.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Tracks } from "@fcs/engine";

const C = { g1: "#3a7d45", g2: "#357240", pl: "#f2f5f0", own: "#1e5bd8", opp: "#6b7280", press: "#ffd54a", cover: "#7fdcff", sel: "#ffd54a" };

export function useVertical(): boolean {
  const q = () => window.innerWidth < window.innerHeight && window.innerWidth < 760;
  const [v, setV] = useState(q);
  useEffect(() => { const on = () => setV(q()); addEventListener("resize", on); return () => removeEventListener("resize", on); }, []);
  return v;
}

export interface PitchProps {
  tracks: Tracks;
  t: number;
  hideBall?: boolean;
  showPaths?: boolean;
  selected?: string | null;
  canDrag?: (actorId: string) => boolean;
  onSelect?: (actorId: string | null) => void;
  /** Desplazamiento en metros del marco de ataque (dx hacia la portería rival, dy hacia la derecha). */
  onDragEnd?: (actorId: string, dx_m: number, dy_m: number) => void;
  /** Toque en el césped (fuera de un jugador), en coordenadas normalizadas del marco de ataque. */
  onPitchClick?: (pt: { u: number; v: number }) => void;
  /** Colores: fichas propias (relleno y borde) y rivales. Por defecto, los de la app. */
  ownColor?: string; ownInk?: string; oppColor?: string;
  /** Jugadores resaltados (p. ej. el que tiene el balón o el pasador elegido). */
  highlight?: string[];
}

export function Pitch({ tracks, t, hideBall, showPaths = true, selected, canDrag, onSelect, onDragEnd, onPitchClick, ownColor, ownInk, oppColor, highlight }: PitchProps) {
  const vertical = useVertical();
  const L = tracks.pitch.length_m, W = tracks.pitch.width_m;
  const x0 = tracks.view === "HALF_ATT" ? L / 2 - 2 : -3, x1 = L + 3;
  const vb = vertical ? [-3, L - x1, W + 6, x1 - x0] : [x0, -3, x1 - x0, W + 6];
  const K = vertical ? 1.45 : 1;
  const rootRef = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null);
  const i = Math.max(0, Math.min(tracks.frames.length - 1, Math.round((t - tracks.t0) * tracks.fps)));
  const f = tracks.frames[i] ?? [];

  const toPitch = (e: RPointerEvent) => {
    const g = rootRef.current!;
    const m = g.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const down = (id: string) => (e: RPointerEvent) => {
    onSelect?.(id);
    if (!canDrag?.(id)) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toPitch(e);
    setDrag({ id, sx: p.x, sy: p.y, x: p.x, y: p.y });
  };
  const move = (e: RPointerEvent) => { if (drag) { const p = toPitch(e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const up = () => {
    if (!drag) return;
    const dx = Math.round((drag.x - drag.sx) * 10) / 10, dy = Math.round((drag.y - drag.sy) * 10) / 10;
    setDrag(null);
    if (Math.hypot(dx, dy) >= 0.3) onDragEnd?.(drag.id, dx, dy);
  };

  const s = { fill: "none", stroke: C.pl, strokeWidth: 0.3 };
  return (
    <svg className="pitch" viewBox={vb.join(" ")} role="img" aria-label={tracks.title} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
      onClick={(e) => {
        const el = e.target as Element;
        if (el.closest("[data-actor]")) return;
        if (onPitchClick && rootRef.current) { const p = toPitch(e as unknown as RPointerEvent); onPitchClick({ u: Math.round((p.x / L) * 10000) / 10000, v: Math.round((p.y / W) * 10000) / 10000 }); return; }
        onSelect?.(null);
      }}>
      <defs>
        <clipPath id="vb"><rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} /></clipPath>
        {[["ah", "#fff"], ["ahp", C.press], ["ahc", C.cover]].map(([id, c]) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
        ))}
      </defs>
      <g clipPath="url(#vb)">
        <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={C.g2} />
        <g ref={rootRef} transform={vertical ? `matrix(0,-1,1,0,0,${L})` : undefined}>
          {Array.from({ length: 6 }, (_, k) => <rect key={k} x={(2 * k * L) / 12} y={0} width={L / 12} height={W} fill={C.g1} />)}
          <path d={`M0 0H${L}V${W}H0Z`} {...s} /><path d={`M${L / 2} 0V${W}`} {...s} /><circle cx={L / 2} cy={W / 2} r={9.15} {...s} />
          {[0, 1].map((g) => { const gx = g ? L : 0, d = g ? -1 : 1; return (
            <g key={g}>
              <path d={`M${gx} ${W / 2 - 20.16}h${16.5 * d}v40.32h${-16.5 * d}`} {...s} />
              <path d={`M${gx} ${W / 2 - 9.16}h${5.5 * d}v18.32h${-5.5 * d}`} {...s} />
              <rect x={g ? L : -1.6} y={W / 2 - 3.66} width={1.6} height={7.32} {...s} />
            </g>); })}
          {showPaths && tracks.paths.map((p, k) => {
            if (p.from !== undefined && t < p.from - 1e-6) return null;
            const d = "M" + p.pts.map((q) => `${(q[0] * L).toFixed(2)} ${(q[1] * W).toFixed(2)}`).join(" L");
            if (p.kind === "ball") return <path key={k} d={d} stroke="#fff" strokeWidth={0.2} fill="none" strokeDasharray="0.5 0.6" opacity={0.85} />;
            if (p.kind === "press") return <path key={k} d={d} stroke={C.press} strokeWidth={0.45} fill="none" markerEnd="url(#ahp)" />;
            if (p.kind === "cover") return <path key={k} d={d} stroke={C.cover} strokeWidth={0.35} fill="none" strokeDasharray="1 0.7" markerEnd="url(#ahc)" />;
            return <path key={k} d={d} stroke="#fff" strokeWidth={0.3} fill="none" strokeDasharray={p.proposal ? "1.2 0.8" : undefined} markerEnd={p.kind === "run" ? "url(#ah)" : undefined} />;
          })}
          {tracks.actors.map((a, k) => {
            let x = (f[2 * k] ?? 0) * L, y = (f[2 * k + 1] ?? 0) * W;
            if (drag?.id === a.id) { x += drag.x - drag.sx; y += drag.y - drag.sy; }
            const draggable = !!canDrag?.(a.id);
            return (
              <g key={a.id} data-actor={a.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${K})`} onPointerDown={down(a.id)}
                style={{ cursor: draggable ? "grab" : "pointer", touchAction: "none" }} role="button" aria-label={a.title} tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(a.id); }}>
                <title>{a.title + (a.proposal ? " (propuesta)" : "")}</title>
                {a.team === "OWN"
                  ? <circle r={1.3} fill={ownColor ?? C.own} stroke={selected === a.id || highlight?.includes(a.id) ? C.sel : ownInk ?? "#fff"} strokeWidth={selected === a.id || highlight?.includes(a.id) ? 0.5 : ownInk ? 0.35 : 0.25} strokeDasharray={a.proposal ? "0.6 0.4" : undefined} />
                  : <rect x={-1.05} y={-1.05} width={2.1} height={2.1} rx={0.35} fill={oppColor ?? C.opp} stroke={selected === a.id || highlight?.includes(a.id) ? C.sel : "#e5e7eb"} strokeWidth={selected === a.id || highlight?.includes(a.id) ? 0.4 : 0.15} opacity={0.92} />}
                {a.label && <g transform={vertical ? "rotate(90)" : undefined}>
                  <text textAnchor="middle" dominantBaseline="central" fontSize={a.team === "OWN" ? (a.label.length > 2 ? 0.95 : 1.25) : 0.8} fontWeight={a.team === "OWN" ? 700 : 400} fill="#fff">{a.label}</text>
                </g>}
              </g>
            );
          })}
          {!hideBall && f.length >= 3 && <circle cx={f[f.length - 3] * L} cy={f[f.length - 2] * W} r={(0.55 + 0.35 * f[f.length - 1]) * K} fill="#fff" stroke="#111" strokeWidth={0.15} />}
        </g>
      </g>
    </svg>
  );
}

/** Reproducción de unas pistas: tiempo actual, play/pausa, velocidad. */
export function useTimeline(tracks: Tracks | null, startAt?: "start" | "end") {
  const [t, setT] = useState(tracks ? (startAt === "end" ? tracks.t1 : tracks.t0) : 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const raf = useRef(0);
  const ready = useRef(false);
  useEffect(() => {
    if (!tracks) return;
    // La primera vez que hay pistas se empieza en la preparación (o al final, si se pide); después se respeta el tiempo actual.
    if (!ready.current) { ready.current = true; setT(startAt === "end" ? tracks.t1 : tracks.t0); return; }
    setT((cur) => Math.min(Math.max(cur, tracks.t0), tracks.t1));
  }, [tracks]);
  useEffect(() => {
    if (!playing || !tracks) return;
    let last = performance.now();
    const loop = (ts: number) => {
      setT((cur) => {
        const n = cur + ((ts - last) / 1000) * speed;
        if (n >= tracks.t1) { setPlaying(false); return tracks.t1; }
        return n;
      });
      last = ts;
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, tracks]);
  const toggle = () => { if (!tracks) return; if (!playing && t >= tracks.t1 - 1e-3) setT(tracks.t0); setPlaying(!playing); };
  return { t, setT: (v: number) => { setPlaying(false); setT(v); }, playing, toggle, speed, setSpeed };
}

export function TimelineControls({ tracks, tl }: { tracks: Tracks; tl: ReturnType<typeof useTimeline> }) {
  return (
    <div className="timeline">
      <div className="row">
        <button className="primary" onClick={tl.toggle} aria-label={tl.playing ? "Pausar" : "Reproducir"}>{tl.playing ? "❚❚" : "▶"}</button>
        <select value={tl.speed} onChange={(e) => tl.setSpeed(Number(e.target.value))} aria-label="Velocidad">
          <option value={0.25}>0,25×</option><option value={0.5}>0,5×</option><option value={1}>1×</option>
        </select>
        <input type="range" min={tracks.t0} max={tracks.t1} step={0.01} value={tl.t} onChange={(e) => tl.setT(Number(e.target.value))} aria-label="Tiempo" />
      </div>
      <div className="row wrap">
        {tracks.markers.map((m) => <button key={m.label} className="chip" onClick={() => tl.setT(m.t)}>{m.label}</button>)}
      </div>
    </div>
  );
}
