import { useEffect, useMemo, useState } from "react";
import { playTracks, type Clarification, type Command, type PlayDoc } from "@fcs/engine";
import { download, get, patch, post, type PlayerDto } from "../lib/api";
import { ROLES, ZONES } from "../lib/labels";
import { playerName, toEnginePlayer } from "../lib/players";
import { Pitch, TimelineControls, useTimeline } from "../components/Pitch";
import { Chat } from "../components/Chat";
import { ClarificationCard, Diagnostics, ErrorBox, useAction } from "../components/ui";

interface PlayView { id: string; name: string; team_id: string; match_id: string | null; current_version: number; document: PlayDoc; can_undo: boolean; can_redo: boolean }
const MOVES = ["ATTACK_NEAR_POST", "ATTACK_FAR_POST", "ATTACK_PEN_SPOT", "ATTACK_GA_CENTER", "DECOY_RUN", "LATE_ARRIVAL", "HOLD"];
const MOVE_LABEL: Record<string, string> = { ATTACK_NEAR_POST: "Ataca el primer palo", ATTACK_FAR_POST: "Ataca el segundo palo", ATTACK_PEN_SPOT: "Ataca el punto de penalti",
  ATTACK_GA_CENTER: "Ataca el centro del área pequeña", DECOY_RUN: "Arrastre", LATE_ARRIVAL: "Llega desde atrás", HOLD: "Se queda", SCREEN: "Bloqueo", FOLLOW: "Sigue a su marca" };

export function PlayEditor({ playId }: { playId: string }) {
  const [play, setPlay] = useState<PlayView | null>(null);
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [clar, setClar] = useState<Clarification | null>(null);
  const a = useAction();
  const load = async () => {
    const p = await get<PlayView>(`/plays/${playId}`);
    setPlay(p);
    setPlayers(await get<PlayerDto[]>(`/teams/${p.team_id}/players`));
  };
  useEffect(() => { load(); }, [playId]);
  const roster = useMemo(() => players.map(toEnginePlayer), [players]);
  const tracks = useMemo(() => (play ? playTracks(play.document, roster, play.name) : null), [play, roster]);
  const tl = useTimeline(tracks);

  const send = (commands: Command[]) => a.run(async () => {
    const r = await post<{ applied: boolean; clarifications: Clarification[]; play: PlayView }>(`/plays/${playId}/commands`, { commands, base_version: play!.current_version });
    setPlay(r.play); setClar(r.clarifications[0] ?? null);
  });
  const history = (dir: "undo" | "redo") => a.run(async () => { setPlay(await post<PlayView>(`/plays/${playId}/${dir}`)); setClar(null); });

  if (!play || !tracks) return <main className="page"><p className="muted">Cargando…</p></main>;
  const doc = play.document;
  const actor = doc.actors.find((x) => x.id === sel);
  const mov = actor && doc.movements.find((m) => m.actor === actor.id);
  const constrained = actor && doc.constraints.some((c) => c.actor === actor.id && c.rule === "NO_JOIN_ATTACK");
  const d = doc.delivery;

  return (
    <main className="page wide">
      <a className="back" href={play.match_id ? `#/match/${play.match_id}` : `#/team/${play.team_id}/plays`}>← Volver</a>
      <header className="row between wrap">
        <h1 className="grow"><input className="title-input" defaultValue={play.name} aria-label="Nombre de la jugada"
          onBlur={(e) => e.target.value.trim() && e.target.value !== play.name && a.run(async () => setPlay(await patch(`/plays/${playId}`, { name: e.target.value })))} /></h1>
        <div className="row">
          <button onClick={() => history("undo")} disabled={!play.can_undo || a.busy} aria-label="Deshacer">↶ Deshacer</button>
          <button onClick={() => history("redo")} disabled={!play.can_redo || a.busy} aria-label="Rehacer">↷ Rehacer</button>
          <button onClick={() => a.run(() => download(`/plays/${playId}/export.html`, "jugada.html"))}>Exportar HTML</button>
        </div>
      </header>
      <div className="editor">
        <div className="stage">
          <Pitch tracks={tracks} t={tl.t} selected={sel} onSelect={setSel} canDrag={() => tl.t <= tracks.t0 + 1e-6}
            onDragEnd={(id, dx, dy) => send([{ op: "play.move_actor", target: id.startsWith("o") ? { actor: id, team: "OPP" } : { actor: id }, dx_m: dx, dy_m: dy }])} />
          <TimelineControls tracks={tracks} tl={tl} />
          <p className="muted small">Arrastra a un jugador en la posición inicial (Preparación) para moverlo. Trazo discontinuo = propuesta del sistema. Versión {play.current_version}.</p>
        </div>
        <aside className="side">
          {clar && <ClarificationCard c={clar} onChoose={(i) => send(clar.options[i].commands)} onDismiss={() => setClar(null)} />}
          <ErrorBox error={a.error} />
          {actor ? (
            <div className="stack panel">
              <div className="row between"><b>{actor.team === "OWN" ? `${ROLES[actor.role] ?? actor.role}` : "Rival"}</b><button className="link" onClick={() => setSel(null)}>Cerrar</button></div>
              {actor.team === "OWN" && <>
                <label>Jugador<select aria-label="Jugador" value={actor.player_id ?? ""} onChange={(e) => send([{ op: "play.assign_player", target: { actor: actor.id }, player: e.target.value }])}>
                  {players.map((p) => <option key={p.id} value={p.id}>{playerName(p)}</option>)}</select></label>
                {actor.role !== "TAKER" && mov && mov.type !== "SCREEN" && (
                  <label>Movimiento<select aria-label="Movimiento" value={mov.type} onChange={(e) => send([{ op: "play.set_movement", target: { actor: actor.id }, movement: e.target.value }])}>
                    {MOVES.map((m) => <option key={m} value={m}>{MOVE_LABEL[m]}</option>)}</select></label>
                )}
                {mov?.anchor && <div className="row">Salida: <button onClick={() => send([{ op: "play.shift_timing", target: { actor: actor.id }, delta_s: -0.25 }])}>−0,25 s</button>
                  <button onClick={() => send([{ op: "play.shift_timing", target: { actor: actor.id }, delta_s: 0.25 }])}>+0,25 s</button></div>}
                {actor.role !== "TAKER" && <label className="check"><input type="checkbox" checked={!!constrained}
                  onChange={(e) => send([{ op: "play.constraint", target: { actor: actor.id }, rule: e.target.checked ? "NO_JOIN_ATTACK" : "NONE" }])} />No se incorpora al remate</label>}
                {String(actor.provenance.role ?? "").startsWith("RULE:") && <p className="muted small">Propuesta del sistema: no lo indicaste tú.</p>}
              </>}
            </div>
          ) : (
            <div className="stack panel">
              <b>Golpeo</b>
              <div className="grid2">
                <label>Efecto<select aria-label="Efecto" value={d.swing} onChange={(e) => send([{ op: "play.set_delivery", swing: e.target.value }])}><option value="INSWING">Cerrado</option><option value="OUTSWING">Abierto</option></select></label>
                <label>Trayectoria<select aria-label="Trayectoria" value={d.trajectory} onChange={(e) => send([{ op: "play.set_delivery", trajectory: e.target.value }])}><option value="DRIVEN">Tenso</option><option value="LOFTED">Bombeado</option></select></label>
              </div>
              <label>Destino<select aria-label="Destino" value={d.target_zone} onChange={(e) => send([{ op: "play.set_delivery", target_zone: e.target.value }])}>
                {["Z_NEAR_POST", "Z_FAR_POST", "Z_GA_CENTER", "Z_PEN_SPOT"].map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}</select></label>
              <div className="row"><button onClick={() => send([{ op: "play.adjust_delivery", closer_to_goal_m: 1.5, curve_delta: 0.04 }])}>Más cerrado</button>
                <button onClick={() => send([{ op: "play.adjust_delivery", closer_to_goal_m: -1.5, curve_delta: -0.04 }])}>Más abierto</button></div>
              <p className="muted small">Toca un jugador para cambiar su rol, movimiento o tiempos.</p>
            </div>
          )}
          <h3>Avisos</h3>
          <Diagnostics items={doc.diagnostics} />
          <h3>Asistente</h3>
          <Chat targetType="PLAY" targetId={playId} placeholder="Ej.: mueve a los dos del segundo palo un metro a la izquierda" onChanged={load}
            examples={["El bloqueo tiene que empezar antes", "Que saque más cerrado", "Los dos de atrás no se incorporan al remate"]} />
        </aside>
      </div>
    </main>
  );
}
