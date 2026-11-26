import { useEffect, useState } from "react";
import { download, get, put } from "../lib/api";
import { ErrorBox, Section, useAction } from "../components/ui";

interface Entry { key: string; title: string; enabled: boolean; text?: string }
const TEXT_HINT: Record<string, string> = {
  context: "Opcional: una frase de contexto", plan: "Plan de juego con tus palabras", instructions: "Instrucciones clave", final: "Tu mensaje final",
  lineup: "Comentario sobre el once (opcional)", opponent: "Comentario (opcional)", exploit: "Comentario (opcional)", avoid: "Comentario (opcional)",
};

export function Talk({ matchId }: { matchId: string }) {
  const [outline, setOutline] = useState<Entry[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [available, setAvailable] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const a = useAction();
  useEffect(() => { get(`/matches/${matchId}/presentation`).then((r) => { setOutline(r.outline); setRevision(r.revision); setAvailable(r.available); }); }, [matchId]);
  const set = (o: Entry[]) => { setOutline(o); setDirty(true); };
  const move = (i: number, d: number) => { const o = [...outline!]; const [x] = o.splice(i, 1); o.splice(i + d, 0, x); set(o); };
  const save = () => a.run(async () => { const r = await put(`/matches/${matchId}/presentation`, { outline, revision }); setRevision(r.revision); setDirty(false); setPreviewKey((k) => k + 1); });
  if (!outline) return <main className="page"><p className="muted">Cargando…</p></main>;
  return (
    <main className="page wide">
      <a className="back" href={`#/match/${matchId}`}>← Jornada</a>
      <header className="row between wrap">
        <h1>Charla prepartido</h1>
        <div className="row">
          <button className="primary" onClick={save} disabled={!dirty || a.busy}>Guardar guion</button>
          <button onClick={() => a.run(async () => { if (dirty) await save(); await download(`/matches/${matchId}/presentation.pdf`, "charla.pdf"); })} disabled={a.busy}>Descargar PDF</button>
        </div>
      </header>
      <ErrorBox error={a.error} />
      <div className="editor">
        <div className="stage">
          <Section title="Vista previa">
            <iframe key={previewKey} className="preview" title="Vista previa de la charla" src={`/api/matches/${matchId}/presentation.html`} />
            <p className="muted small">La charla usa tus datos tal cual: once, observaciones del rival, jugadas y escenas de esta jornada. No se redacta nada por ti.</p>
          </Section>
        </div>
        <aside className="side">
          <Section title="Secciones">
            {available && <p className="muted small">Disponible: {available.lineup ? "once ✔" : "sin once"} · {available.plays} jugadas · {available.scenes} escenas · {available.analysis_items} notas del rival</p>}
            <ol className="outline">
              {outline.map((e, i) => (
                <li key={e.key} className={e.enabled ? "" : "off"}>
                  <div className="row">
                    <input type="checkbox" checked={e.enabled} aria-label={`Incluir ${e.title}`} onChange={(ev) => set(outline.map((x, j) => (j === i ? { ...x, enabled: ev.target.checked } : x)))} />
                    <input className="grow" value={e.title} aria-label="Título" onChange={(ev) => set(outline.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
                    <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button aria-label="Bajar" disabled={i === outline.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </div>
                  {e.enabled && TEXT_HINT[e.key] && <textarea rows={2} placeholder={TEXT_HINT[e.key]} value={e.text ?? ""} aria-label={`Texto de ${e.title}`}
                    onChange={(ev) => set(outline.map((x, j) => (j === i ? { ...x, text: ev.target.value || undefined } : x)))} />}
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </main>
  );
}
