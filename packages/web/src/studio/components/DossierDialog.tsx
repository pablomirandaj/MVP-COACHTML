// Diálogo «Carpeta del partido»: título, jornada, rival, reglas fijas (una por línea) y orden de las jugadas.
import { useState } from "react";
import type { ItemMeta } from "../ports";

export interface FolderRequest { ids: string[]; title: string; match?: string; opponent?: string; rules: string[] }

export function DossierDialog({ items, defaults, rules, busy, onExport, onClose }: {
  items: ItemMeta[]; defaults: { title: string; match?: number; opponent?: string }; rules: string[]; busy?: boolean;
  onExport: (r: FolderRequest) => void; onClose: () => void;
}) {
  const [order, setOrder] = useState(items);
  const [title, setTitle] = useState(defaults.title);
  const [match, setMatch] = useState(defaults.match ? String(defaults.match) : "");
  const [opponent, setOpponent] = useState(defaults.opponent ?? "");
  const [text, setText] = useState(rules.join("\n"));
  const move = (i: number, d: -1 | 1) => { const n = [...order]; [n[i], n[i + d]] = [n[i + d], n[i]]; setOrder(n); };
  const submit = () => onExport({ ids: order.map((x) => x.id), title: title.trim() || "Carpeta del partido", match: match ? `Jornada ${match}` : undefined,
    opponent: opponent.trim() || undefined, rules: text.split("\n").map((r) => r.trim()).filter(Boolean) });
  return (
    <div className="st-card st-stack" role="dialog" aria-label="Carpeta del partido">
      <h2>Carpeta del partido</h2>
      <p className="st-small st-muted" style={{ margin: 0 }}>Un solo HTML con una pestaña por jugada, su ficha y el recuadro «Esto no cambia nunca». Se abre en el móvil sin conexión.</p>
      <div className="st-row" style={{ alignItems: "flex-end" }}>
        <label className="st-field" style={{ flex: "2 1 220px" }}>Título<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="st-field" style={{ flex: "0 1 110px" }}>Jornada<input inputMode="numeric" value={match} onChange={(e) => setMatch(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
        <label className="st-field" style={{ flex: "1 1 180px" }}>Rival<input value={opponent} onChange={(e) => setOpponent(e.target.value)} /></label>
      </div>
      <div className="st-stack" style={{ gap: 6 }}>
        <b className="st-small">Orden de las jugadas</b>
        <ol className="st-order">
          {order.map((it, i) => (
            <li key={it.id}>
              <span style={{ flex: 1, overflowWrap: "anywhere" }}>{it.title}</span>
              <button className="st-btn sm ghost" aria-label={`Subir ${it.title}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="st-btn sm ghost" aria-label={`Bajar ${it.title}`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </li>
          ))}
        </ol>
      </div>
      <label className="st-field">Esto no cambia nunca (una regla por línea; se guardan para el equipo)
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="st-row">
        <button className="st-btn primary" disabled={busy || !order.length} onClick={submit}>{busy ? "Exportando…" : `Exportar carpeta (${order.length})`}</button>
        <button className="st-btn" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
