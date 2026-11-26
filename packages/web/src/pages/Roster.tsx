import { useEffect, useState } from "react";
import { del, get, patch, post, type PlayerDto } from "../lib/api";
import { ATTRIBUTES, FOOT, POSITIONS, SETPIECE_ROLES, STATUS } from "../lib/labels";
import { ErrorBox, Section, useAction } from "../components/ui";

const EMPTY: Partial<PlayerDto> = { first_name: "", last_name: "", shirt_number: null, primary_position: "CM", secondary_positions: [], dominant_foot: "RIGHT",
  height_cm: null, attributes: {}, setpiece_roles: [], status: "AVAILABLE", coach_notes: "" };

export function Roster({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<PlayerDto[] | null>(null);
  const [edit, setEdit] = useState<Partial<PlayerDto> | null>(null);
  const a = useAction();
  const load = () => get<PlayerDto[]>(`/teams/${teamId}/players`).then(setPlayers);
  useEffect(() => { load(); }, [teamId]);
  const save = () => a.run(async () => {
    const body = { ...edit } as any;
    delete body.id; delete body.status_note;
    if (!body.shirt_number) body.shirt_number = null;
    if (!body.height_cm) body.height_cm = null;
    if (edit!.id) await patch(`/players/${edit!.id}`, body); else await post(`/teams/${teamId}/players`, body);
    setEdit(null); await load();
  });
  if (!players) return <p className="muted">Cargando…</p>;
  return (
    <>
      <Section title={`Plantilla (${players.length})`} actions={<button className="primary" onClick={() => setEdit({ ...EMPTY })}>＋ Jugador</button>}>
        {players.length === 0 && <p className="muted">Añade a tus jugadores: el motor usa su posición, pie, altura y características para proponer roles.</p>}
        <ul className="list">
          {players.map((p) => (
            <li key={p.id}>
              <button className="rowbtn" onClick={() => setEdit({ ...p })}>
                <span className="dorsal">{p.shirt_number ?? "–"}</span>
                <span><b>{p.nickname || p.first_name} {p.last_name}</b><br /><span className="muted small">{POSITIONS[p.primary_position]} · {FOOT[p.dominant_foot]}{p.status !== "AVAILABLE" ? ` · ${STATUS[p.status]}` : ""}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      {edit && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Ficha de jugador">
          <form className="card stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h2>{edit.id ? "Editar jugador" : "Nuevo jugador"}</h2>
            <div className="grid2">
              <label>Nombre<input aria-label="Nombre" value={edit.first_name ?? ""} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} required /></label>
              <label>Apellidos<input aria-label="Apellidos" value={edit.last_name ?? ""} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} /></label>
              <label>Dorsal<input aria-label="Dorsal" type="number" min={1} max={99} value={edit.shirt_number ?? ""} onChange={(e) => setEdit({ ...edit, shirt_number: e.target.value ? Number(e.target.value) : null })} /></label>
              <label>Altura (cm)<input aria-label="Altura (cm)" type="number" min={120} max={220} value={edit.height_cm ?? ""} onChange={(e) => setEdit({ ...edit, height_cm: e.target.value ? Number(e.target.value) : null })} /></label>
              <label>Posición<select aria-label="Posición" value={edit.primary_position} onChange={(e) => setEdit({ ...edit, primary_position: e.target.value })}>
                {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Pie<select aria-label="Pie" value={edit.dominant_foot} onChange={(e) => setEdit({ ...edit, dominant_foot: e.target.value as any })}>
                {Object.entries(FOOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Estado<select aria-label="Estado" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Posiciones secundarias<select aria-label="Posiciones secundarias" multiple value={edit.secondary_positions} size={3}
                onChange={(e) => setEdit({ ...edit, secondary_positions: Array.from(e.target.selectedOptions, (o) => o.value).slice(0, 3) })}>
                {Object.entries(POSITIONS).filter(([k]) => k !== edit.primary_position).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <fieldset><legend>Características (0–5)</legend>
              <div className="grid2">{Object.entries(ATTRIBUTES).map(([k, v]) => (
                <label key={k} className="inline">{v}<input type="range" min={0} max={5} value={edit.attributes?.[k] ?? 0}
                  onChange={(e) => setEdit({ ...edit, attributes: { ...edit.attributes, [k]: Number(e.target.value) } })} /> <span>{edit.attributes?.[k] ?? 0}</span></label>
              ))}</div>
            </fieldset>
            <fieldset><legend>Balón parado</legend>
              {Object.entries(SETPIECE_ROLES).map(([k, v]) => (
                <label key={k} className="check"><input type="checkbox" checked={edit.setpiece_roles?.includes(k) ?? false}
                  onChange={(e) => setEdit({ ...edit, setpiece_roles: e.target.checked ? [...(edit.setpiece_roles ?? []), k] : (edit.setpiece_roles ?? []).filter((x) => x !== k) })} />{v}</label>
              ))}
            </fieldset>
            <label>Notas del entrenador (privadas)<textarea aria-label="Notas del entrenador (privadas)" value={edit.coach_notes ?? ""} onChange={(e) => setEdit({ ...edit, coach_notes: e.target.value })} rows={2} /></label>
            <ErrorBox error={a.error} />
            <div className="row end">
              {edit.id && <button type="button" className="danger" onClick={() => a.run(async () => { if (confirm("¿Dar de baja a este jugador?")) { await del(`/players/${edit.id}`); setEdit(null); await load(); } })}>Dar de baja</button>}
              <button type="button" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="primary" disabled={a.busy}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
