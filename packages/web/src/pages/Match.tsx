import { useEffect, useState } from "react";
import { get, patch, put, type MatchDto } from "../lib/api";
import { ANALYSIS_CATEGORIES, fmtDate, SCENE_TYPES } from "../lib/labels";
import { go } from "../lib/router";
import { ErrorBox, Section, useAction } from "../components/ui";
import { LineupEditor } from "./Lineup";

export function Match({ matchId }: { matchId: string }) {
  const [m, setM] = useState<MatchDto | null>(null);
  const [plays, setPlays] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const load = async () => {
    const match = await get<MatchDto>(`/matches/${matchId}`);
    setM(match);
    const [p, s] = await Promise.all([get(`/teams/${match.team_id}/plays?match_id=${matchId}`), get(`/teams/${match.team_id}/scenes?match_id=${matchId}`)]);
    setPlays(p); setScenes(s);
  };
  useEffect(() => { load(); }, [matchId]);
  if (!m) return <main className="page"><p className="muted">Cargando…</p></main>;
  return (
    <main className="page">
      <a href={`#/team/${m.team_id}/calendar`} className="back">← Calendario</a>
      <header className="matchhead">
        <p className="muted">{m.matchday ? `Jornada ${m.matchday}` : "Partido"}{m.competition ? ` · ${m.competition}` : ""}</p>
        <h1>{m.is_home === false ? `${m.opponent} – nosotros` : `Nosotros – ${m.opponent}`}</h1>
        <p className="muted">{fmtDate(m.kickoff_at)}{m.venue ? ` · ${m.venue}` : ""}</p>
        <a className="button primary" href={`#/match/${matchId}/talk`}>Preparar charla</a>
      </header>

      <LineupEditor matchId={matchId} teamId={m.team_id} />

      <Section title="Balón parado" actions={<button className="primary" onClick={() => go(`/match/${matchId}/new-corner`)}>＋ Córner</button>}>
        {plays.length === 0 && <p className="muted">Crea un córner con el asistente o paso a paso.</p>}
        <ul className="list">{plays.map((p) => <li key={p.id}><a className="rowbtn" href={`#/play/${p.id}`}><span className="dorsal">⚑</span><span><b>{p.name}</b><br /><span className="muted small">versión {p.current_version}</span></span></a></li>)}</ul>
      </Section>

      <Section title="Fases de juego" actions={<button className="primary" onClick={() => go(`/match/${matchId}/new-scene`)}>＋ Escena</button>}>
        {scenes.length === 0 && <p className="muted">Cómo presionamos, cómo presiona el rival, repliegue y vigilancias.</p>}
        <ul className="list">{scenes.map((s) => <li key={s.id}><a className="rowbtn" href={`#/scene/${s.id}`}><span className="dorsal">◧</span><span><b>{s.name}</b><br /><span className="muted small">{SCENE_TYPES[s.type]}</span></span></a></li>)}</ul>
      </Section>

      <Analysis matchId={matchId} />
      <Notes m={m} onSaved={setM} />
    </main>
  );
}

function Analysis({ matchId }: { matchId: string }) {
  const [items, setItems] = useState<{ category: string; text: string; evidence?: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const a = useAction();
  useEffect(() => { get(`/matches/${matchId}/analysis`).then((r) => setItems(r)); }, [matchId]);
  const set = (next: typeof items) => { setItems(next); setDirty(true); };
  return (
    <Section title="Rival" actions={dirty && <button className="primary" disabled={a.busy} onClick={() => a.run(async () => {
      setItems(await put(`/matches/${matchId}/analysis`, { items: items.filter((i) => i.text.trim()) })); setDirty(false);
    })}>Guardar</button>}>
      <p className="muted small">Tus observaciones tal cual. Se usan en la charla sin reescribirlas.</p>
      {items.map((it, i) => (
        <div key={i} className="row analysis">
          <select value={it.category} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} aria-label="Categoría">
            {Object.entries(ANALYSIS_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={it.text} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label="Observación" />
          <label className="check small"><input type="checkbox" checked={it.evidence === "HYPOTHESIS"} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, evidence: e.target.checked ? "HYPOTHESIS" : "OBSERVED" } : x)))} />por confirmar</label>
          <button aria-label="Quitar" onClick={() => set(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button onClick={() => set([...items, { category: "OTHER", text: "" }])}>＋ Observación</button>
      <ErrorBox error={a.error} />
    </Section>
  );
}

function Notes({ m, onSaved }: { m: MatchDto; onSaved: (m: MatchDto) => void }) {
  const [objectives, setObjectives] = useState(m.objectives ?? "");
  const [training, setTraining] = useState(m.training_notes ?? "");
  const a = useAction();
  const dirty = objectives !== (m.objectives ?? "") || training !== (m.training_notes ?? "");
  return (
    <Section title="Objetivos y notas" actions={dirty && <button className="primary" disabled={a.busy} onClick={() => a.run(async () => onSaved(await patch(`/matches/${m.id}`, { objectives, training_notes: training })))}>Guardar</button>}>
      <label>Objetivos del partido (aparecen en la charla)<textarea aria-label="Objetivos del partido (aparecen en la charla)" rows={3} value={objectives} onChange={(e) => setObjectives(e.target.value)} /></label>
      <label>Notas de entrenamiento<textarea aria-label="Notas de entrenamiento" rows={2} value={training} onChange={(e) => setTraining(e.target.value)} /></label>
      <ErrorBox error={a.error} />
    </Section>
  );
}

