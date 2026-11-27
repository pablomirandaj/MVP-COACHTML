// Balón parado: córner y falta lateral a favor y en contra, y saque de banda. El motor coloca y asigna; el
// entrenador ajusta arrastrando, eligiendo jugadores o pidiéndoselo al asistente.
import { useState } from "react";
import { ZONES, type Command, type PlayDoc, type SetPieceType, type ZoneId } from "@fcs/engine";
import { ChatPanel } from "../components/ChatPanel";
import { Diagnostics, EditorBar } from "../components/EditorBar";
import { currentStep, PitchBoard, useTimeline } from "../components/PitchBoard";
import { StepList } from "../components/StepList";
import { useDraftState, useStudio } from "../lib/context";
import { playerName, posEs, teamShort } from "../lib/format";
import { useStudioEditor } from "../lib/useEditor";
import type { StudioItem } from "../ports";

export const SP_LABEL: Record<SetPieceType, string> = {
  CORNER_ATT: "Córner a favor", CORNER_DEF: "Córner en contra", FK_WIDE_ATT: "Falta lateral a favor", FK_WIDE_DEF: "Falta lateral en contra", THROW_IN_ATT: "Saque de banda",
};
const ROLE_ES: Record<string, string> = {
  TAKER: "Lanzador", PRIMARY_TARGET: "Rematador principal", SECONDARY_TARGET: "Rematador", BLOCKER: "Bloqueo", DECOY: "Arrastre", REBOUND: "Rechace",
  REST_DEFENDER: "Vigilancia", GK_SCREEN: "Sobre el portero", SHORT_RECEIVER: "Apoyo corto", ZONAL_DEFENDER: "En zona", MAN_MARKER: "Al hombre",
  COUNTER_OUTLET: "Salida a la contra", EDGE_GUARD: "Frontal", POST_GUARD: "Corto", COVER: "Cobertura", WALL: "Barrera", GOALKEEPER: "Portero",
};
const TARGETS: ZoneId[] = ["Z_NEAR_POST", "Z_FAR_POST", "Z_GA_CENTER", "Z_PEN_SPOT"];

interface Form { type: SetPieceType; side: "LEFT" | "RIGHT"; depth: number; distance: number; variant: "LONG" | "SHORT"; scheme: "MIXED" | "ZONAL" | "MAN" }
const createCmd = (f: Form): Command => {
  const base: Command = { op: "play.create", type: f.type, side: f.side };
  if (f.type.startsWith("FK_")) return { ...base, depth_m: f.depth, distance_m: f.distance };
  if (f.type === "THROW_IN_ATT") return { ...base, variant: f.variant, distance_m: f.distance };
  if (f.type === "CORNER_DEF") return { ...base, scheme: f.scheme };
  return base;
};

export function SetPieces() {
  const { open, opponent } = useStudio();
  const init = open?.kind === "SETPIECE" ? open : undefined;
  const key = `setpiece:${init?.nonce ?? 0}`;
  return <SetPieceEditor key={key} draftKey={key} item={init?.item} startType={(init?.preset?.type as SetPieceType | undefined) ?? "CORNER_ATT"} opponent={(init?.preset?.opponent as string | undefined) ?? opponent} />;
}

function SetPieceEditor({ item, startType, opponent, draftKey }: { item?: StudioItem; startType: SetPieceType; opponent?: string; draftKey: string }) {
  const { roster, next } = useStudio();
  const [form, setForm] = useDraftState<Form>(`${draftKey}:form`, { type: (item?.doc as PlayDoc | undefined)?.type as SetPieceType ?? startType, side: "LEFT", depth: 18, distance: 8, variant: "LONG", scheme: "MIXED" });
  const ed = useStudioEditor("SETPIECE", { item, doc: null, title: `${SP_LABEL[form.type]}${opponent ? ` · ${teamShort(opponent)}` : ""}`, opponent, match: next?.jornada }, draftKey);
  const doc = ed.s.doc as PlayDoc | null;
  const tracks = ed.tracks;
  const tl = useTimeline(tracks);
  const [selected, setSelected] = useState<string | null>(null);
  const apply = (cmds: Command[]) => ed.dispatch({ type: "apply", cmds, origin: "MANUAL" });
  const create = (f = form) => { apply([createCmd(f)]); if (!item) ed.setTitle(`${SP_LABEL[f.type]}${opponent ? ` · ${teamShort(opponent)}` : ""}`); };
  const actor = doc?.actors.find((a) => a.id === selected && a.team === "OWN");
  const defending = form.type.endsWith("_DEF");

  return (
    <div className="st-stack" style={{ gap: 14 }}>
      <div className="st-row" role="tablist" aria-label="Tipo de balón parado">
        {(Object.keys(SP_LABEL) as SetPieceType[]).map((t) => <button key={t} role="tab" aria-selected={form.type === t} className="st-chip" aria-pressed={form.type === t} onClick={() => { const f = { ...form, type: t }; setForm(f); if (doc) create(f); }}>{SP_LABEL[t]}</button>)}
      </div>
      <div className="st-card st-row" style={{ alignItems: "flex-end" }}>
        <label className="st-field">Lado<select aria-label="Lado" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as Form["side"] })}><option value="LEFT">Izquierda</option><option value="RIGHT">Derecha</option></select></label>
        {form.type.startsWith("FK_") && <>
          <label className="st-field">A la línea de fondo: {form.depth} m<input type="range" aria-label="Distancia a la línea de fondo" min={5} max={35} value={form.depth} onChange={(e) => setForm({ ...form, depth: Number(e.target.value) })} /></label>
          <label className="st-field">A la banda: {form.distance} m<input type="range" aria-label="Distancia a la banda" min={2} max={25} value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} /></label>
        </>}
        {form.type === "THROW_IN_ATT" && <>
          <label className="st-field">Variante<select aria-label="Variante" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value as Form["variant"] })}><option value="LONG">Largo al primer palo</option><option value="SHORT">Corto con tercer hombre</option></select></label>
          <label className="st-field">A la línea de fondo: {form.distance} m<input type="range" aria-label="Distancia a la línea de fondo" min={10} max={45} value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} /></label>
        </>}
        {form.type === "CORNER_DEF" && <label className="st-field">Defensa<select aria-label="Tipo de defensa" value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value as Form["scheme"] })}><option value="MIXED">Mixta</option><option value="ZONAL">Zonal</option><option value="MAN">Al hombre</option></select></label>}
        <button className="st-btn primary" onClick={() => create()}>{doc ? "Rehacer con estos datos" : "Crear la jugada"}</button>
      </div>
      {!doc && <div className="st-hint">Elige el tipo y el lado y pulsa «Crear la jugada». El motor coloca a todos, asigna a tus jugadores por posición y pierna y explica cada paso. También puedes pedírselo al asistente.</div>}
      {doc && tracks && <>
        <EditorBar ed={ed} />
        <div className="st-editor">
          <PitchBoard tracks={tracks} tl={tl} selected={selected} onSelect={setSelected} canDrag={(id) => !!doc.actors.find((a) => a.id === id && a.team === "OWN")}
            onDragEnd={(id, dx, dy) => apply([{ op: "play.move_actor", target: { actor: id }, dx_m: dx, dy_m: dy }])} />
          <aside className="st-side st-stack">
            {!defending && <div className="st-card st-stack" style={{ gap: 8 }}>
              <h3>Golpeo</h3>
              <div className="st-row">
                {(["INSWING", "OUTSWING"] as const).map((s) => <button key={s} className="st-chip" aria-pressed={doc.delivery.swing === s} onClick={() => apply([{ op: "play.set_delivery", swing: s }])}>{s === "INSWING" ? "Cerrado" : "Abierto"}</button>)}
              </div>
              <label className="st-field">Destino<select aria-label="Destino del balón" value={doc.delivery.target_zone} onChange={(e) => apply([{ op: "play.set_delivery", target_zone: e.target.value }])}>{TARGETS.map((z) => <option key={z} value={z}>{ZONES[z].label}</option>)}</select></label>
            </div>}
            {actor && <div className="st-card st-stack" style={{ gap: 8 }}>
              <h2>{ROLE_ES[actor.role] ?? actor.role}</h2>
              <label className="st-field">Jugador<select aria-label="Jugador del puesto" value={actor.player_id ?? ""} onChange={(e) => apply([{ op: "play.assign_player", target: { actor: actor.id }, player: e.target.value }])}>
                <option value="" disabled>Elegir…</option>
                {roster.map((p) => <option key={p.id} value={p.id}>{p.n ?? "–"} · {playerName(p)} · {posEs(p.pos)}</option>)}
              </select></label>
              {defending && <label className="st-field">Marca a<select aria-label="Rival que marca" defaultValue="" onChange={(e) => actor.player_id && e.target.value && apply([{ op: "play.mark", player: actor.player_id, opponent: e.target.value }])}>
                <option value="">Elegir rival…</option>
                {doc.actors.filter((a) => a.team === "OPP" && (a.role === "PRIMARY_TARGET" || a.role === "SECONDARY_TARGET")).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select></label>}
              {!defending && actor.role !== "TAKER" && <button className="st-btn sm" onClick={() => apply([{ op: "play.constraint", target: { actor: actor.id }, rule: "NO_JOIN_ATTACK" }])}>Que no suba al remate</button>}
            </div>}
            <div className="st-card st-stack"><h3>Pasos</h3><StepList steps={tracks.steps} current={currentStep(tracks, tl.t)} onGo={(i) => tl.setT(tracks.steps[i].t)} /></div>
            <div className="st-card st-stack"><h3>Avisos del motor</h3><Diagnostics items={doc.diagnostics} /></div>
            <div className="st-card st-stack"><h3>Asistente</h3>
              <ChatPanel ask={ed.ask} onUndo={() => ed.dispatch({ type: "undo" })} canUndo={ed.s.canUndo}
                examples={defending ? ["Que el más alto marque a su rematador principal", "Pasa a defensa zonal"] : ["Centro abierto al segundo palo", "Que el 4 bloquee al marcador del 9"]} />
            </div>
          </aside>
        </div>
      </>}
      {ed.s.clarification && <div className="st-card st-stack"><b>{ed.s.clarification.question}</b><div className="st-row">{ed.s.clarification.options.map((o, i) => <button key={i} className="st-chip" onClick={() => o.commands.length ? apply(o.commands) : ed.dispatch({ type: "dismiss" })}>{o.label}</button>)}</div></div>}
    </div>
  );
}
