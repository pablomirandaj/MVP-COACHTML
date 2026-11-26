import { useState, type ReactNode } from "react";
import type { Clarification, Diagnostic } from "@fcs/engine";
import { ruleClass, severityIcon } from "../lib/labels";

export function Diagnostics({ items }: { items: Diagnostic[] }) {
  const shown = items.filter((d) => d.severity !== "info" || d.rule_id === "BALL-TGT-01");
  if (!shown.length) return <p className="muted small">Sin avisos.</p>;
  return (
    <ul className="diags">
      {shown.map((d, i) => <li key={i} className={`diag ${d.severity}`}><span aria-hidden>{severityIcon(d.severity)}</span> <b>{ruleClass(d.class)}</b> · {d.message}</li>)}
    </ul>
  );
}

/** Pregunta del motor con opciones; cada opción lleva sus comandos exactos (docs/16 §7). */
export function ClarificationCard({ c, onChoose, onDismiss }: { c: Clarification; onChoose: (i: number) => void; onDismiss: () => void }) {
  return (
    <div className="clar" role="group" aria-label={c.question}>
      <b>{c.question}</b>
      <div className="row wrap">
        {c.options.map((o, i) => <button key={i} onClick={() => (o.commands.length ? onChoose(i) : onDismiss())}>{o.label}</button>)}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-h"><h2>{title}</h2>{actions && <div className="row">{actions}</div>}</header>
      {children}
    </section>
  );
}

/** Ejecuta una acción asíncrona mostrando estado ocupado y el error en español. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); }
    catch (e) { setError((e as Error).message); return undefined; }
    finally { setBusy(false); }
  };
  return { busy, error, setError, run };
}
