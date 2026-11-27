// Ficha editable de la plantilla: dorsal, nombre, posición, pierna y altura. Importar pegando texto o CSV.
import { useState } from "react";
import type { Foot, Player } from "@fcs/engine";
import { mergeRoster, parseRosterText, POS_CODE_TO_ES } from "../lib/import";

const FOOT_ES: Record<Foot, string> = { RIGHT: "Diestro", LEFT: "Zurdo", BOTH: "Ambas" };

export function RosterSheet({ players, onChange }: { players: Player[]; onChange: (p: Player[]) => void }) {
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseRosterText(text) : null;
  const set = (i: number, patch: Partial<Player>) => onChange(players.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const sorted = players.map((p, i) => ({ p, i })).sort((a, b) => (a.p.n ?? 99) - (b.p.n ?? 99) || a.p.name.localeCompare(b.p.name));
  return (
    <div className="st-stack">
      <div className="st-row">
        <button className="st-btn" onClick={() => setImporting(true)}>Importar desde texto o CSV</button>
        <button className="st-btn" onClick={() => onChange([...players, { id: `pl_new_${players.length + 1}_${Date.now() % 100000}`, name: "Nuevo", surname: "", pos: "", foot: "RIGHT", status: "AVAILABLE" }])}>Añadir jugador</button>
      </div>
      <ul className="st-roster" aria-label="Jugadores">
        {sorted.map(({ p, i }) => (
          <li key={p.id}>
            <input aria-label={`Dorsal de ${p.name}`} inputMode="numeric" value={p.n ?? ""} placeholder="—" onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); set(i, { n: v ? Number(v) : undefined }); }} />
            <input aria-label={`Nombre de ${p.name}`} value={`${p.name}${p.surname ? " " + p.surname : ""}`} onChange={(e) => { const [n, ...r] = e.target.value.split(" "); set(i, { name: n, surname: r.join(" ") }); }} />
            <div className="wide">
              <select aria-label={`Posición de ${p.name}`} value={p.pos} onChange={(e) => set(i, { pos: e.target.value })}>
                <option value="">Posición</option>
                {Object.entries(POS_CODE_TO_ES).map(([c, es]) => <option key={c} value={c}>{es}</option>)}
              </select>
              <select aria-label={`Pierna de ${p.name}`} value={p.foot} onChange={(e) => set(i, { foot: e.target.value as Foot })}>
                {Object.entries(FOOT_ES).map(([c, es]) => <option key={c} value={c}>{es}</option>)}
              </select>
              <input aria-label={`Altura de ${p.name} en cm`} inputMode="numeric" placeholder="cm" value={p.height ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); set(i, { height: v ? Number(v) : undefined }); }} />
            </div>
            <button className="st-btn ghost sm" aria-label={`Quitar a ${p.name}`} onClick={() => onChange(players.filter((_, k) => k !== i))}>✕</button>
          </li>
        ))}
      </ul>
      {importing && (
        <div className="st-modal" role="dialog" aria-modal="true" aria-labelledby="imp-h" onClick={(e) => { if (e.target === e.currentTarget) setImporting(false); }}>
          <div className="st-card st-stack">
            <h2 id="imp-h">Importar plantilla</h2>
            <p className="st-small st-muted">Una línea por jugador: <b>dorsal nombre apellidos posición pierna</b>, por ejemplo «9 Raúl Somavilla DC zurdo». También vale un CSV con cabecera <code>dorsal,nombre,apellidos,posicion,pie,altura</code>. Los jugadores que ya están se actualizan por el nombre.</p>
            <textarea id="roster-import" aria-label="Texto de la plantilla" value={text} onChange={(e) => setText(e.target.value)} placeholder={"1 Juan Pérez POR\n4 Diego Sanz DFC\n9 Raúl Somavilla DC zurdo"} />
            {parsed && <p className="st-small">{parsed.players.length} jugador{parsed.players.length === 1 ? "" : "es"} reconocido{parsed.players.length === 1 ? "" : "s"}.</p>}
            {parsed?.errors.length ? <div className="st-error"><ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul></div> : null}
            <div className="st-row" style={{ justifyContent: "flex-end" }}>
              <button className="st-btn" onClick={() => setImporting(false)}>Cancelar</button>
              <button className="st-btn primary" disabled={!parsed?.players.length} onClick={() => { onChange(mergeRoster(players, parsed!.players)); setImporting(false); setText(""); }}>Importar {parsed?.players.length ?? 0}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
