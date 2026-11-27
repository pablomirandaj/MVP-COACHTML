import type React from "react";
// Selector «Ver» (reproductor de la J5) / «Editar» (campo arrastrable).
export function ViewTabs({ view, onChange }: { view: "edit" | "view"; onChange: (v: "edit" | "view") => void }) {
  return (
    <div className="st-viewtabs" role="tablist" aria-label="Modo">
      <button role="tab" aria-selected={view === "view"} onClick={() => onChange("view")}>Ver</button>
      <button role="tab" aria-selected={view === "edit"} onClick={() => onChange("edit")}>Editar</button>
    </div>
  );
}

/** Barra bajo el campo en «Editar»: deshacer/rehacer con texto, no solo icono. */
export function UndoBar({ canUndo, canRedo, onUndo, onRedo, children }: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; children?: React.ReactNode }) {
  return (
    <div className="st-editbar" aria-label="Deshacer y moverse por los pasos">
      <button className="st-btn" onClick={onUndo} disabled={!canUndo}>↶ Deshacer</button>
      <button className="st-btn" onClick={onRedo} disabled={!canRedo}>↷ Rehacer</button>
      {children}
    </div>
  );
}

/** Selector de números en «Ver»: papel en la jugada (1..n, S, C…) o dorsal real. */
export function LabelsToggle({ value, onChange }: { value: "ROLE" | "DORSAL"; onChange: (v: "ROLE" | "DORSAL") => void }) {
  return (
    <label className="st-small st-muted">Números{" "}
      <select aria-label="Números de los jugadores" value={value} onChange={(e) => onChange(e.target.value as "ROLE" | "DORSAL")}>
        <option value="ROLE">Papel en la jugada</option><option value="DORSAL">Dorsal</option>
      </select></label>
  );
}
