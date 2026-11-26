import { useEffect, useMemo, useState } from "react";
import { FORMATIONS, type Clarification, type Command, type Diagnostic, type LineupDoc, type Pt, type Tracks } from "@fcs/engine";
import { get, post, type PlayerDto } from "../lib/api";
import { FOOT, POSITIONS, slotLabel, STATUS } from "../lib/labels";
import { Pitch } from "../components/Pitch";
import { Chat } from "../components/Chat";
import { ClarificationCard, Diagnostics, ErrorBox, Section, useAction } from "../components/ui";

interface LineupView { id: string; revision: number; state: string; doc: LineupDoc; positions: Record<string, Pt>; diagnostics: Diagnostic[] }

function lineupTracks(l: LineupView, players: PlayerDto[]): Tracks {
  const slots = Object.keys(l.positions);
  return {
    title: "Alineación", view: "FULL", pitch: { length_m: 105, width_m: 68 }, t0: 0, t1: 0, fps: 1,
    actors: slots.map((s) => {
      const p = players.find((x) => x.id === l.doc.slots[s]);
      return { id: s, team: "OWN", label: p ? String(p.shirt_number ?? "·") : "", title: `${slotLabel(s)}: ${p ? `${p.nickname || p.first_name} ${p.last_name}` : "vacía"}`,
        proposal: !p || String(l.doc.slot_provenance[s] ?? "").startsWith("RULE:") };
    }),
    frames: [[...slots.flatMap((s) => [l.positions[s].u, l.positions[s].v]), -1, -1, 0]],
    paths: [], markers: [], notes: [], legend: [],
  };
}

export function LineupEditor({ matchId, teamId }: { matchId: string; teamId: string }) {
  const [lineup, setLineup] = useState<LineupView | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [clar, setClar] = useState<Clarification | null>(null);
  const [formation, setFormation] = useState("F_433");
  const a = useAction();
  const load = async () => {
    const [l, p] = await Promise.all([get<{ lineup: LineupView | null }>(`/matches/${matchId}/lineup`), get<PlayerDto[]>(`/teams/${teamId}/players`)]);
    setLineup(l.lineup); setPlayers(p);
  };
  useEffect(() => { load(); }, [matchId]);
  const send = (commands: Command[]) => a.run(async () => {
    const r = await post<{ applied: boolean; clarifications: Clarification[]; lineup: LineupView | null }>(`/matches/${matchId}/lineup/commands`, { commands, revision: lineup?.revision });
    setLineup(r.lineup); setClar(r.clarifications[0] ?? null);
  });
  const tracks = useMemo(() => (lineup ? lineupTracks(lineup, players) : null), [lineup, players]);
  const used = new Set(Object.values(lineup?.doc.slots ?? {}).filter(Boolean));
  const pos = slot?.split("_")[0];
  const candidates = [...players].sort((x, y) =>
    Number(y.primary_position === pos) - Number(x.primary_position === pos) || Number(y.secondary_positions.includes(pos!)) - Number(x.secondary_positions.includes(pos!)) || (x.shirt_number ?? 99) - (y.shirt_number ?? 99));

  if (lineup === undefined) return <Section title="Alineación"><p className="muted">Cargando…</p></Section>;
  return (
    <Section title="Alineación" actions={lineup && <>
      <select value={lineup.doc.formation} onChange={(e) => send([{ op: "lineup.set_formation", formation: e.target.value }])} aria-label="Sistema">
        {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
      </select>
      <button onClick={() => a.run(async () => { const r = await post<{ lineup: LineupView }>(`/matches/${matchId}/lineup/confirm`); setLineup(r.lineup); })}
        disabled={lineup.state === "PUBLISHED"}>{lineup.state === "PUBLISHED" ? "Once confirmado ✔" : "Confirmar once"}</button>
    </>}>
      {!lineup && (
        <div className="row">
          <select value={formation} onChange={(e) => setFormation(e.target.value)} aria-label="Sistema">
            {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
          <button className="primary" onClick={() => send([{ op: "lineup.set_formation", formation }])}>Empezar el once</button>
        </div>
      )}
      {lineup && tracks && (
        <div className="editor stacked">
          <div className="stage">
            <Pitch tracks={tracks} t={0} hideBall showPaths={false} selected={slot} onSelect={setSlot} canDrag={() => true}
              onDragEnd={(id, dx, dy) => send([{ op: "lineup.shift_slot", slot: id, du_m: dx, dv_m: dy }])} />
            <p className="muted small">Toca una posición para elegir jugador. Arrastra para ajustar su altura o anchura.</p>
          </div>
          <aside className="side">
            {clar && <ClarificationCard c={clar} onChoose={(i) => send(clar.options[i].commands)} onDismiss={() => setClar(null)} />}
            {slot ? (
              <div className="stack">
                <b>{slotLabel(slot)}</b>
                {lineup.doc.slots[slot] && <button onClick={() => { send([{ op: "lineup.clear_slot", player: lineup.doc.slots[slot] }]); setSlot(null); }}>Dejar vacía</button>}
                <ul className="list compact">
                  {candidates.map((p) => (
                    <li key={p.id}><button className="rowbtn" disabled={lineup.doc.slots[slot] === p.id} onClick={() => { send([{ op: "lineup.assign", player: p.id, slot }]); setSlot(null); }}>
                      <span className="dorsal">{p.shirt_number ?? "–"}</span>
                      <span>{p.nickname || p.first_name} {p.last_name}<br /><span className="muted small">{POSITIONS[p.primary_position]} · {FOOT[p.dominant_foot]}{used.has(p.id) ? " · en el once" : ""}{p.status !== "AVAILABLE" ? ` · ${STATUS[p.status]}` : ""}</span></span>
                    </button></li>
                  ))}
                </ul>
              </div>
            ) : <Diagnostics items={lineup.diagnostics} />}
            <ErrorBox error={a.error} />
            <h3>Asistente</h3>
            <Chat targetType="LINEUP" targetId={matchId} placeholder="Ej.: adelanta un poco los extremos" onChanged={load}
              examples={["Junta más las líneas", "Cambia al portero por el suplente"]} />
          </aside>
        </div>
      )}
    </Section>
  );
}
