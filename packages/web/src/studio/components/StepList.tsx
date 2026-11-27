// Lista de pasos con su explicación; el actual resaltado. Editable si se pasa onEdit.
import { useState } from "react";
import type { Step } from "@fcs/engine";

const SRC = (s: string) => (s === "MANUAL" ? "Entrenador" : s === "ASSISTANT" ? "Asistente" : "Motor");

export function StepList({ steps, current, onGo, onEdit, trig, onTrig }: { steps: Step[]; current: number; onGo: (i: number) => void; onEdit?: (i: number, title: string, implies: string) => void; trig?: boolean[]; onTrig?: (i: number, v: boolean) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [title, setTitle] = useState(""), [implies, setImplies] = useState("");
  if (!steps.length) return <p className="st-small st-muted">Aún no hay pasos.</p>;
  return (
    <ol className="st-steps" aria-label="Pasos">
      {steps.map((s, i) => (
        <li key={i} aria-current={i === current ? "step" : undefined}>
          {editing === i ? (
            <div className="st-stack" style={{ gap: 6 }}>
              <input aria-label="Qué pasa" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
              <textarea aria-label="Qué implica" value={implies} onChange={(e) => setImplies(e.target.value)} maxLength={280} style={{ minHeight: 64 }} />
              <div className="st-row"><button className="st-btn sm primary" onClick={() => { onEdit!(i, title, implies); setEditing(null); }}>Guardar frase</button><button className="st-btn sm" onClick={() => setEditing(null)}>Cancelar</button></div>
            </div>
          ) : (
            <div className="st-row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
              <button className="st-btn ghost sm" style={{ padding: 0, minHeight: 0, textAlign: "left", flex: 1, display: "block" }} onClick={() => onGo(i)}>
                <span className="src">Paso {i + 1} · {SRC(s.source)}</span><b>{s.title}</b><p>{s.implies}</p>
              </button>
              {onEdit && <button className="st-btn ghost sm" aria-label={`Editar la frase del paso ${i + 1}`} onClick={() => { setEditing(i); setTitle(s.title); setImplies(s.implies); }}>✎</button>}
            </div>
          )}
          {onTrig && editing !== i && (
            <label className="st-small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: "var(--st-muted)" }}>
              <input type="checkbox" checked={!!trig?.[i]} onChange={(e) => onTrig(i, e.target.checked)} /> AHORA (paso clave)
            </label>
          )}
        </li>
      ))}
    </ol>
  );
}
