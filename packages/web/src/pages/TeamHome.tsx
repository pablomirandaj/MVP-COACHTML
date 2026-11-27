import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { SCENE_TYPES } from "../lib/labels";
import { Section } from "../components/ui";
import { Calendar } from "./Calendar";
import { Roster } from "./Roster";

const TABS: [string, string][] = [["calendar", "Jornadas"], ["roster", "Plantilla"], ["plays", "Jugadas"], ["scenes", "Fases"]];

export function TeamHome({ teamId, tab }: { teamId: string; tab: string }) {
  const [team, setTeam] = useState<any>(null);
  useEffect(() => { get(`/teams/${teamId}`).then(setTeam); }, [teamId]);
  return (
    <main className="page">
      <a className="back" href="#/">← Equipos</a>
      <h1>{team?.name ?? "…"} <span className="muted small">{team && `${team.category} · ${team.season}`}</span></h1>
      <a className="button primary" style={{ margin: "8px 0" }} href={`#/studio/${teamId}/home`}>Abrir Pizarra Studio</a>
      <nav className="tabs" aria-label="Secciones del equipo">
        {TABS.map(([k, v]) => <a key={k} href={`#/team/${teamId}/${k}`} aria-current={tab === k ? "page" : undefined}>{v}</a>)}
      </nav>
      {tab === "roster" ? <Roster teamId={teamId} /> : tab === "plays" ? <Library teamId={teamId} kind="plays" /> : tab === "scenes" ? <Library teamId={teamId} kind="scenes" /> : <Calendar teamId={teamId} />}
    </main>
  );
}

function Library({ teamId, kind }: { teamId: string; kind: "plays" | "scenes" }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { get(`/teams/${teamId}/${kind}`).then(setItems); }, [teamId, kind]);
  return (
    <Section title={kind === "plays" ? "Biblioteca de jugadas" : "Escenas de fases de juego"}>
      {items?.length === 0 && <p className="muted">Se crean desde cada jornada.</p>}
      <ul className="list">
        {items?.map((x) => (
          <li key={x.id}><a className="rowbtn" href={kind === "plays" ? `#/play/${x.id}` : `#/scene/${x.id}`}>
            <span className="dorsal">{kind === "plays" ? "⚑" : "◧"}</span>
            <span><b>{x.name}</b><br /><span className="muted small">{kind === "plays" ? `versión ${x.current_version}` : SCENE_TYPES[x.type]}</span></span>
          </a></li>
        ))}
      </ul>
    </Section>
  );
}
