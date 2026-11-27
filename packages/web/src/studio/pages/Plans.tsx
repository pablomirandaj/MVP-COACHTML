// Planes de juego: salida de balón, presión, ataque a espacios, repliegue y vigilancias, calculados por el motor.
import { FORMATIONS, type SceneSpec, type SpaceKind } from "@fcs/engine";
import { ChatPanel } from "../components/ChatPanel";
import { Diagnostics, EditorBar } from "../components/EditorBar";
import { currentStep, PitchBoard, useTimeline } from "../components/PitchBoard";
import { StepList } from "../components/StepList";
import { PlayerView } from "../components/PlayerView";
import { SheetEditor } from "../components/SheetEditor";
import { LabelsToggle, UndoBar, ViewTabs } from "../components/ViewTabs";
import { useDraftState, useStudio } from "../lib/context";
import { teamShort } from "../lib/format";
import { planOf, PLANS, presetScene, withFormations, type PlanId } from "../lib/scenes";
import { useStudioEditor } from "../lib/useEditor";
import type { StudioItem } from "../ports";
import { computeScene, DEFAULT_PITCH } from "@fcs/engine";

const SPACES: { k: SpaceKind; label: string }[] = [{ k: "BETWEEN_LINES", label: "Entre líneas" }, { k: "BEHIND_FULLBACK", label: "Espalda del lateral" }, { k: "HALF_SPACE", label: "Carril interior" }, { k: "WEAK_SIDE", label: "Lado débil" }];
const typeToPlan = (t?: string): PlanId | undefined => (t === "PRESS_OWN" ? "PRESS_HIGH" : (PLANS.find((p) => p.id === t)?.id));

export function Plans() {
  const { open, opponent } = useStudio();
  const init = open?.kind === "SCENE" ? open : undefined;
  const start = init?.item ? planOf(init.item.doc as SceneSpec) : typeToPlan(init?.preset?.type as string | undefined);
  const [plan, setPlan] = useDraftState<PlanId | null>(`plans:${init?.nonce ?? 0}`, start ?? null);
  const opp = (init?.preset?.opponent as string | undefined) ?? opponent;
  if (!plan) return (
    <div className="st-stack" style={{ gap: 14 }}>
      <div><h1>Planes de juego</h1><p className="st-muted" style={{ margin: "4px 0 0" }}>{opp ? `Contra ${teamShort(opp)}. ` : ""}Elige una fase: el motor coloca a los 22 y explica cada paso.</p></div>
      <div className="st-actions">{PLANS.map((p) => <button key={p.id} className="st-action" onClick={() => setPlan(p.id)}><b>{p.label}</b><span>{p.desc}</span></button>)}</div>
    </div>
  );
  return <PlanEditor key={`${plan}-${init?.nonce ?? 0}`} draftKey={`plan:${plan}:${init?.nonce ?? 0}`} plan={plan} item={init?.item && planOf(init.item.doc as SceneSpec) === plan ? init.item : undefined} opponent={opp} onBack={() => setPlan(null)} />;
}

function PlanEditor({ plan, item, opponent, onBack, draftKey }: { plan: PlanId; item?: StudioItem; opponent?: string; onBack: () => void; draftKey: string }) {
  const { next } = useStudio();
  const label = PLANS.find((p) => p.id === plan)!.label;
  const ed = useStudioEditor("SCENE", { item, doc: presetScene(plan), title: `${label}${opponent ? ` · ${teamShort(opponent)}` : ""}`, opponent, match: next?.jornada }, draftKey);
  const spec = ed.s.doc as SceneSpec;
  const tracks = ed.tracks!;
  const tl = useTimeline(tracks);
  const [view, setView] = useDraftState<"edit" | "view">(`${draftKey}:view`, "view");
  const set = (next: SceneSpec) => ed.dispatch({ type: "replace", doc: next, origin: "MANUAL" });
  const p = spec.params;
  const diags = (() => { try { return computeScene(spec, DEFAULT_PITCH).diagnostics; } catch { return []; } })();
  const fSel = (team: "own" | "opp") => (
    <label className="st-field">{team === "own" ? "Nuestro sistema" : "Su sistema"}
      <select aria-label={team === "own" ? "Nuestro sistema" : "Su sistema"} value={spec[team].formation} onChange={(e) => set(withFormations(spec, team === "own" ? e.target.value : spec.own.formation, team === "opp" ? e.target.value : spec.opp.formation))}>
        {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
      </select></label>
  );
  return (
    <div className="st-stack" style={{ gap: 14 }}>
      <button className="st-btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Todos los planes</button>
      <EditorBar ed={ed} />
      <div className="st-card st-row" style={{ alignItems: "flex-end" }}>
        {fSel("own")}{fSel("opp")}
        {spec.type === "BUILD_UP" && <>
          <label className="st-field">Estructura<select aria-label="Estructura de salida" value={p.structure ?? "3+1"} onChange={(e) => set({ ...spec, params: { ...p, structure: e.target.value as any } })}><option value="3+1">3+1 (pivote entre centrales)</option><option value="2+1">2+1</option><option value="FB_INSIDE">Lateral por dentro</option></select></label>
          <label className="st-field">Nos presionan<select aria-label="Rivales que presionan" value={p.opp_pressers ?? 2} onChange={(e) => set({ ...spec, params: { ...p, opp_pressers: Number(e.target.value) as 1 | 2 | 3 } })}><option value={1}>1 jugador</option><option value={2}>2 jugadores</option><option value={3}>3 jugadores</option></select></label>
        </>}
        {spec.type === "ATTACK_SPACE" && <>
          <label className="st-field">Espacio<select aria-label="Espacio objetivo" value={p.target ?? "BETWEEN_LINES"} onChange={(e) => set({ ...spec, params: { ...p, target: e.target.value as SpaceKind } })}>{SPACES.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select></label>
          <label className="st-field">Lado<select aria-label="Lado del espacio" value={p.target_side ?? ""} onChange={(e) => set({ ...spec, params: { ...p, target_side: (e.target.value || undefined) as any } })}><option value="">El que esté libre</option><option value="LEFT">Izquierda</option><option value="RIGHT">Derecha</option></select></label>
        </>}
        {(spec.type === "PRESS_OWN" || spec.type === "RETREAT" || spec.type === "ATTACK_SPACE" || spec.type === "PRESS_OPP") &&
          <label className="st-field">{spec.type === "ATTACK_SPACE" ? "Su bloque" : "Altura del bloque"}<select aria-label="Altura del bloque" value={p.block_height ?? "HIGH"} onChange={(e) => set({ ...spec, params: { ...p, block_height: e.target.value as any } })}><option value="HIGH">Alto</option><option value="MID">Medio</option><option value="LOW">Bajo</option></select></label>}
        {spec.type === "REST_DEFENSE" && <label className="st-field">Vigilantes<select aria-label="Número de vigilantes" value={p.rest_count ?? ""} onChange={(e) => set({ ...spec, params: { ...p, rest_count: e.target.value ? Number(e.target.value) : undefined } })}><option value="">Automático (+1)</option>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
      </div>
      <div className="st-row"><ViewTabs view={view} onChange={setView} /></div>
      {view === "view" ? (
        <div className="st-editor">
          <PlayerView seq={ed.seq} />
          <aside className="st-side st-stack">
            <div className="st-card st-stack"><h3>Ficha de la jugada</h3><SheetEditor sheet={ed.sheet} proposed={ed.proposed} onChange={ed.setSheet} /></div>
            <div className="st-card st-stack"><h3>Avisos del motor</h3><Diagnostics items={diags} /></div>
          </aside>
        </div>
      ) : (
      <div className="st-editor">
        <div className="st-stage">
          <PitchBoard tracks={tracks} tl={tl} />
          <UndoBar canUndo={ed.s.canUndo} canRedo={ed.s.canRedo} onUndo={() => ed.dispatch({ type: "undo" })} onRedo={() => ed.dispatch({ type: "redo" })} />
        </div>
        <aside className="st-side st-stack">
          <div className="st-card st-stack"><h3>Pasos</h3>
            <StepList steps={tracks.steps} current={currentStep(tracks, tl.t)} onGo={(i) => tl.setT(tracks.steps[i].t)}
              onEdit={(i, title, implies) => set({ ...spec, keyframes: spec.keyframes.map((k, j) => (j === i ? { ...k, note: title, implies } : k)) })} />
          </div>
          <div className="st-card st-stack"><h3>Avisos del motor</h3><Diagnostics items={diags} /></div>
          <div className="st-card st-stack"><h3>Asistente</h3>
            <ChatPanel ask={ed.ask} onUndo={() => ed.dispatch({ type: "undo" })} canUndo={ed.s.canUndo}
              examples={spec.type === "BUILD_UP" ? ["Si presionan con 3, que el lateral se meta por dentro", "Añade un paso más: progresamos al interior"] : spec.type === "ATTACK_SPACE" ? ["Ataca la espalda de su lateral derecho", "Su bloque es bajo"] : ["Que salte también el interior", "Bloque más bajo"]} />
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
