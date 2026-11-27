// Ficha de la jugada (como la J5): quién hace qué, el hueco que atacamos, la clave y si sale mal. Editable.
import type { Sheet } from "@fcs/engine";

export function SheetEditor({ sheet, proposed, onChange }: { sheet?: Sheet; proposed: Sheet | null; onChange: (s: Sheet | undefined) => void }) {
  const s = sheet ?? proposed;
  if (!s) return null;
  const set = (patch: Partial<Sheet>) => onChange({ ...s, ...patch });
  const row = (i: number, k: 0 | 1, v: string) => set({ table: s.table.map((r, j) => (j === i ? (k === 0 ? [v, r[1]] : [r[0], v]) : r)) as [string, string][] });
  return (
    <div className="st-stack" style={{ gap: 10 }}>
      {!sheet && <p className="st-small st-muted" style={{ margin: 0 }}>Propuesta del motor. Edita lo que quieras: se guarda con la jugada.</p>}
      <label className="st-field">Subtítulo<input id="sheet-subtitle" value={s.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></label>
      <div className="st-stack" style={{ gap: 6 }}>
        <span className="st-small st-muted" style={{ fontWeight: 600 }}>Quién hace qué</span>
        {s.table.map((r, i) => (
          <div key={i} className="st-row" style={{ flexWrap: "nowrap" }}>
            <input aria-label={`Quién, fila ${i + 1}`} value={r[0]} onChange={(e) => row(i, 0, e.target.value)} style={{ width: 70, flex: "0 0 70px" }} />
            <input aria-label={`Qué, fila ${i + 1}`} value={r[1]} onChange={(e) => row(i, 1, e.target.value)} style={{ flex: 1 }} />
            <button className="st-btn ghost sm" aria-label={`Quitar fila ${i + 1}`} onClick={() => set({ table: s.table.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="st-btn sm" style={{ alignSelf: "flex-start" }} onClick={() => set({ table: [...s.table, ["", ""]] })}>Añadir fila</button>
      </div>
      <label className="st-field">El hueco que atacamos<textarea value={s.hueco} onChange={(e) => set({ hueco: e.target.value })} style={{ minHeight: 60 }} /></label>
      <label className="st-field">La clave<textarea value={s.clave} onChange={(e) => set({ clave: e.target.value })} style={{ minHeight: 60 }} /></label>
      <label className="st-field">Si sale mal<textarea value={s.riesgo} onChange={(e) => set({ riesgo: e.target.value })} style={{ minHeight: 60 }} /></label>
      {sheet && <button className="st-btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange(undefined)}>Volver a la propuesta del motor</button>}
    </div>
  );
}
