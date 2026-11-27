// Barra común de los editores: título, deshacer/rehacer, guardar y exportar.
import type { useStudioEditor } from "../lib/useEditor";

export function EditorBar({ ed }: { ed: ReturnType<typeof useStudioEditor> }) {
  return (
    <div className="st-stack" style={{ gap: 8 }}>
      <div className="st-row" style={{ justifyContent: "space-between" }}>
        <input id="item-title" aria-label="Título" value={ed.title} onChange={(e) => ed.setTitle(e.target.value)} style={{ fontFamily: "var(--st-display)", fontWeight: 700, fontSize: 20, flex: "1 1 220px", border: "1px solid transparent", background: "transparent" }} />
        <div className="st-row">
          <button className="st-btn sm" onClick={() => ed.dispatch({ type: "undo" })} disabled={!ed.s.canUndo} aria-label="Deshacer">↶</button>
          <button className="st-btn sm" onClick={() => ed.dispatch({ type: "redo" })} disabled={!ed.s.canRedo} aria-label="Rehacer">↷</button>
          <button className="st-btn sm" onClick={ed.exportHtml} disabled={!ed.tracks}>Exportar HTML</button>
          <button className="st-btn sm primary" onClick={() => ed.save()} disabled={!ed.s.doc || ed.saveState === "saving"}>{ed.saveState === "saving" ? "Guardando…" : ed.dirty || ed.meta.revision === 0 ? "Guardar" : "Guardado"}</button>
        </div>
      </div>
      {ed.saveState === "conflict" && <div className="st-error" role="alert">Otra persona ha guardado esta jugada mientras la editabas. Tu versión sigue aquí.
        <div className="st-row" style={{ marginTop: 8 }}><button className="st-btn sm" onClick={() => ed.save(true)}>Guardar la mía como copia</button><button className="st-btn sm" onClick={ed.reloadTheirs}>Cargar la suya</button></div></div>}
      {ed.saveState === "error" && <div className="st-error" role="alert">No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.</div>}
      {ed.s.error && <div className="st-error" role="alert">{ed.s.error} <button className="st-btn ghost sm" onClick={() => ed.dispatch({ type: "dismiss" })}>Cerrar</button></div>}
    </div>
  );
}

export function Diagnostics({ items }: { items: { rule_id: string; severity: string; message: string }[] }) {
  const shown = items.filter((d) => d.severity !== "info");
  if (!shown.length) return <p className="st-small st-muted">Sin avisos del motor.</p>;
  return <ul className="st-diags">{shown.map((d, i) => <li key={i} className={d.severity}>{d.message}</li>)}</ul>;
}
