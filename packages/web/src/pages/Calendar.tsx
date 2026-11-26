import { useEffect, useState } from "react";
import { get, post, type MatchDto } from "../lib/api";
import { fmtDate } from "../lib/labels";
import { ErrorBox, Section, useAction } from "../components/ui";

export function Calendar({ teamId }: { teamId: string }) {
  const [matches, setMatches] = useState<MatchDto[] | null>(null);
  const [mode, setMode] = useState<"none" | "add" | "csv">("none");
  const [form, setForm] = useState({ opponent: "", matchday: "", date: "", time: "12:00", is_home: "true", venue: "" });
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<any[] | null>(null);
  const a = useAction();
  const load = () => get<MatchDto[]>(`/teams/${teamId}/matches`).then(setMatches);
  useEffect(() => { load(); }, [teamId]);

  const add = () => a.run(async () => {
    const kickoff = form.date ? new Date(`${form.date}T${form.time || "12:00"}:00`).toISOString() : undefined;
    await post(`/teams/${teamId}/matches`, { opponent: form.opponent, matchday: form.matchday ? Number(form.matchday) : undefined, kickoff_at: kickoff,
      is_home: form.is_home === "true", venue: form.venue || undefined });
    setMode("none"); setForm({ ...form, opponent: "", matchday: "" }); await load();
  });

  return (
    <>
      <Section title="Calendario" actions={<>
        <button onClick={() => setMode(mode === "add" ? "none" : "add")}>＋ Partido</button>
        <button onClick={() => { setMode(mode === "csv" ? "none" : "csv"); setPreview(null); }}>Importar CSV</button>
      </>}>
        {mode === "add" && (
          <form className="stack sub" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <div className="grid2">
              <label>Rival<input aria-label="Rival" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required /></label>
              <label>Jornada<input aria-label="Jornada" type="number" min={1} value={form.matchday} onChange={(e) => setForm({ ...form, matchday: e.target.value })} /></label>
              <label>Fecha<input aria-label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label>Hora<input aria-label="Hora" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
              <label>Dónde<select aria-label="Dónde" value={form.is_home} onChange={(e) => setForm({ ...form, is_home: e.target.value })}><option value="true">En casa</option><option value="false">Fuera</option></select></label>
              <label>Campo<input aria-label="Campo" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
            </div>
            <ErrorBox error={a.error} />
            <button className="primary" disabled={a.busy}>Añadir</button>
          </form>
        )}
        {mode === "csv" && (
          <div className="stack sub">
            <p className="muted small">Columnas reconocidas: Jornada, Fecha, Hora, Local, Visitante, Campo. Separador «;» o «,».</p>
            <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
            <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Jornada;Fecha;Hora;Local;Visitante;Campo\n1;04/10/2026;11:30;Tu equipo;UD Rival;Municipal"} />
            <ErrorBox error={a.error} />
            <div className="row">
              <button onClick={() => a.run(async () => setPreview((await post<{ rows: any[] }>(`/teams/${teamId}/calendar/import`, { csv })).rows))} disabled={!csv || a.busy}>Previsualizar</button>
              {preview && <button className="primary" disabled={a.busy} onClick={() => a.run(async () => { await post(`/teams/${teamId}/calendar/import`, { csv, commit: true }); setMode("none"); setPreview(null); setCsv(""); await load(); })}>Importar {preview.filter((r) => r.bye || (r.opponent && r.kickoff_at)).length} jornadas</button>}
            </div>
            {preview && (
              <table className="table"><thead><tr><th>Fila</th><th>J</th><th>Rival</th><th>Fecha</th><th>Incidencias</th></tr></thead>
                <tbody>{preview.map((r) => <tr key={r.row}><td>{r.row}</td><td>{r.matchday ?? "–"}</td><td>{r.bye ? "Descansa" : `${r.opponent ?? "?"} ${r.is_home ? "(casa)" : r.is_home === false ? "(fuera)" : ""}`}</td>
                  <td>{fmtDate(r.kickoff_at)}</td><td className="small">{r.issues.join(" ")}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
        {matches && matches.length === 0 && mode === "none" && <p className="muted">Importa tu calendario o añade el próximo partido.</p>}
        <ul className="list">
          {matches?.map((m) => (
            <li key={m.id}>
              {m.status === "BYE" ? <span className="rowbtn muted">J{m.matchday ?? "–"} · Descansa</span> : (
                <a className="rowbtn" href={`#/match/${m.id}`}>
                  <span className="dorsal">J{m.matchday ?? "–"}</span>
                  <span><b>{m.is_home === false ? `${m.opponent} – nosotros` : `vs ${m.opponent}`}</b><br /><span className="muted small">{fmtDate(m.kickoff_at)}{m.venue ? ` · ${m.venue}` : ""}{m.status === "POSTPONED" ? " · aplazado" : ""}</span></span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
