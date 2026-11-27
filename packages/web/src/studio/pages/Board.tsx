// Pizarra libre: se diseña una jugada paso a paso arrastrando fichas o pidiéndoselo al asistente.
import { useEffect, useMemo, useState } from "react";
import { createBoard, FORMATIONS, STEP_ACTION_S, STEP_PAUSE_S, type BoardDoc, type Command } from "@fcs/engine";
import { ChatPanel } from "../components/ChatPanel";
import { Diagnostics, EditorBar } from "../components/EditorBar";
import { currentStep, PitchBoard, useTimeline } from "../components/PitchBoard";
import { StepList } from "../components/StepList";
import { useStudio } from "../lib/context";
import { playerLabel, playerName, posEs, teamShort } from "../lib/format";
import { useStudioEditor } from "../lib/useEditor";
import type { StudioItem } from "../ports";

type Tool = "select" | "move" | "dribble" | "pass" | "press";
const TOOLS: { t: Tool; label: string; hint: string }[] = [
  { t: "move", label: "Mover", hint: "Arrastra un jugador hasta donde debe llegar en este paso." },
  { t: "pass", label: "Pase", hint: "Toca al pasador y después al receptor, o un punto del césped para un pase al espacio." },
  { t: "dribble", label: "Conducción", hint: "Arrastra al jugador con balón hasta donde conduce." },
  { t: "press", label: "Presión", hint: "Toca a uno de los nuestros y después al rival que presiona." },
  { t: "select", label: "Dorsales", hint: "Toca a uno de los nuestros para ponerle el dorsal de un jugador de la plantilla." },
];
const DUR = STEP_PAUSE_S + STEP_ACTION_S;

export function Board() {
  const { open, opponent } = useStudio();
  const init = open?.kind === "BOARD" ? open : undefined;
  const key = `board:${init?.nonce ?? 0}`;
  return <BoardEditor key={key} draftKey={key} item={init?.item} opponent={(init?.preset?.opponent as string | undefined) ?? opponent} />;
}

function BoardEditor({ item, opponent, draftKey }: { item?: StudioItem; opponent?: string; draftKey: string }) {
  const { roster, next } = useStudio();
  const fresh = useMemo(() => createBoard({ own: "F_433", opp: "F_442", title: "Nueva jugada" }), []);
  const ed = useStudioEditor("BOARD", { item, doc: fresh, title: opponent ? `Jugada contra ${teamShort(opponent)}` : "Nueva jugada", opponent, match: next?.jornada }, draftKey);
  const doc = ed.s.doc as BoardDoc;
  const tracks = ed.tracks!;
  const tl = useTimeline(tracks);
  const [tool, setTool] = useState<Tool>("move");
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [si, setSi] = useState(Math.max(0, doc.steps.length - 1));
  const stepId = doc.steps[si]?.id;
  const showStep = (i: number) => { setSi(i); tl.setT(i * DUR + STEP_PAUSE_S - 0.001); };
  useEffect(() => { if (doc.steps.length && si >= doc.steps.length) showStep(doc.steps.length - 1); }, [doc.steps.length]);

  const apply = (cmds: Command[]) => ed.dispatch({ type: "apply", cmds, origin: "MANUAL" });
  /** Asegura que hay un paso donde escribir; devuelve su id y los comandos para crearlo. */
  const target = (): { id: string; pre: Command[] } => {
    if (stepId) return { id: stepId, pre: [] };
    const n = Math.max(0, ...doc.steps.map((s) => Number(s.id.slice(1)) || 0)) + 1;
    return { id: `s${n}`, pre: [{ op: "board.add_step" }] };
  };
  const posOf = (id: string) => {
    const k = tracks.actors.findIndex((a) => a.id === id);
    const f = tracks.frames[Math.max(0, Math.min(tracks.frames.length - 1, Math.round((tl.t - tracks.t0) * tracks.fps)))];
    return { u: f[2 * k], v: f[2 * k + 1] };
  };
  const onDragEnd = (id: string, dx: number, dy: number) => {
    const p = posOf(id), { id: step, pre } = target();
    apply([...pre, { op: "board.move", step, actor: id, to: { u: +(p.u + dx / doc.pitch.length_m).toFixed(4), v: +(p.v + dy / doc.pitch.width_m).toFixed(4) }, kind: tool === "dribble" ? "DRIBBLE" : "RUN" }]);
    if (!stepId) setSi(doc.steps.length);
  };
  const onSelect = (id: string | null) => {
    setSelected(id);
    if (!id) { setPending(null); return; }
    if (tool === "pass" || tool === "press") {
      if (!pending) { if (id.startsWith("own:")) setPending(id); return; }
      const { id: step, pre } = target();
      if (tool === "pass" && id !== pending) apply([...pre, { op: "board.pass", step, from: pending, to: id, kind: "GROUND" }]);
      if (tool === "press" && id.startsWith("opp:")) apply([...pre, { op: "board.press", step, actor: pending, target: id }]);
      setPending(null); if (!stepId) setSi(doc.steps.length);
    }
  };
  const onPitchClick = (pt: { u: number; v: number }) => {
    if (tool === "pass" && pending) { const { id: step, pre } = target(); apply([...pre, { op: "board.pass", step, from: pending, to: pt, kind: "GROUND" }]); setPending(null); }
    else setSelected(null);
  };
  const steps = tracks.steps;
  const ci = currentStep(tracks, tl.t);
  const selSlot = selected?.startsWith("own:") ? selected.slice(4) : null;

  return (
    <div className="st-stack" style={{ gap: 14 }}>
      <EditorBar ed={ed} />
      <div className="st-editor">
        <div className="st-stage">
          <div className="st-toolbar" role="toolbar" aria-label="Herramientas">
            {TOOLS.map((x) => <button key={x.t} className="st-btn sm st-tool" aria-pressed={tool === x.t} onClick={() => { setTool(x.t); setPending(null); }}>{x.label}</button>)}
            <span style={{ flex: 1 }} />
            <label className="st-small st-muted">Nosotros <select aria-label="Nuestro sistema" value={doc.own.formation} onChange={(e) => apply([{ op: "board.set_formation", team: "OWN", formation: e.target.value }])}>{Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
            <label className="st-small st-muted">Rival <select aria-label="Sistema del rival" value={doc.opp.formation} onChange={(e) => apply([{ op: "board.set_formation", team: "OPP", formation: e.target.value }])}>{Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
          </div>
          <p className="st-small st-muted" style={{ margin: 0 }}>{pending ? `Elegido ${pending.startsWith("own:") ? doc.own.labels[pending.slice(4)] : pending}: ${tool === "pass" ? "toca al receptor o un punto del césped." : "toca al rival."}` : TOOLS.find((x) => x.t === tool)!.hint}</p>
          <PitchBoard tracks={tracks} tl={tl} selected={selected} highlight={pending ? [pending] : []}
            canDrag={(id) => (tool === "move" || tool === "dribble") && (tool === "move" || id.startsWith("own:"))}
            onDragEnd={onDragEnd} onSelect={onSelect} onPitchClick={onPitchClick} />
          <div className="st-stepbar" role="tablist" aria-label="Pasos de la jugada">
            {doc.steps.map((s, i) => <button key={s.id} role="tab" aria-selected={i === si} className="st-chip" aria-pressed={i === si} onClick={() => showStep(i)}>Paso {i + 1}</button>)}
            <button className="st-chip" onClick={() => { apply([{ op: "board.add_step", ...(stepId ? { after: stepId } : {}) }]); setTimeout(() => showStep(si + (doc.steps.length ? 1 : 0)), 0); }}>+ Paso</button>
            {stepId && <button className="st-chip" onClick={() => apply([{ op: "board.remove_step", step: stepId }])}>Quitar paso {si + 1}</button>}
          </div>
        </div>
        <aside className="st-side st-stack">
          {tool === "select" && selSlot && (
            <div className="st-card st-stack" style={{ gap: 8 }}>
              <h2>{doc.own.labels[selSlot]} ({posEs(selSlot.split("_")[0])})</h2>
              <select aria-label="Jugador de la plantilla" defaultValue="" onChange={(e) => { const p = roster.find((x) => x.id === e.target.value); if (p) apply([{ op: "board.set_labels", labels: { [selSlot]: playerLabel(p) } }]); }}>
                <option value="">Elegir jugador…</option>
                {roster.map((p) => <option key={p.id} value={p.id}>{p.n ?? "–"} · {playerName(p)} · {posEs(p.pos)}</option>)}
              </select>
            </div>
          )}
          <div className="st-card st-stack">
            <h3>Pasos</h3>
            <StepList steps={steps} current={ci} onGo={showStep} onEdit={(i, title, implies) => apply([{ op: "board.note", step: doc.steps[i].id, title, implies }])} />
          </div>
          <div className="st-card st-stack"><h3>Avisos del motor</h3><Diagnostics items={doc.diagnostics} /></div>
          <div className="st-card st-stack">
            <h3>Asistente</h3>
            <ChatPanel ask={ed.ask} onUndo={() => ed.dispatch({ type: "undo" })} canUndo={ed.s.canUndo}
              examples={["Sacamos por el lateral derecho y el extremo ataca la espalda", "Añade un paso: el 6 baja entre centrales", "Explica cada paso con frases cortas"]} />
          </div>
        </aside>
      </div>
    </div>
  );
}
