import { useEffect, useState } from "react";
import type { Player } from "@fcs/engine";
import { RosterSheet } from "../components/RosterSheet";
import { useStudio } from "../lib/context";

export function Roster() {
  const { host, roster, setRoster } = useStudio();
  const [draft, setDraft] = useState<Player[]>(roster);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => setDraft(roster), [roster]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(roster);
  const fromRffm = draft.some((p) => p.tags?.includes("rffm"));
  const save = async () => {
    setState("saving");
    try { await host.team.saveRoster(draft); setRoster(draft); setState("saved"); }
    catch { setState("error"); }
  };
  return (
    <div className="st-stack" style={{ gap: 16 }}>
      <div className="st-row" style={{ justifyContent: "space-between" }}>
        <div><h1>Plantilla</h1><p className="st-muted st-small" style={{ margin: "4px 0 0" }}>{draft.length} jugadores · los dorsales y posiciones se usan en todas las jugadas</p></div>
        <div className="st-row">
          {state === "saved" && !dirty && <span className="st-small" role="status">Plantilla guardada</span>}
          {state === "error" && <span className="st-small" role="alert" style={{ color: "var(--st-bad)" }}>No se ha podido guardar. Inténtalo de nuevo.</span>}
          <button className="st-btn primary" disabled={!dirty || state === "saving"} onClick={save}>{state === "saving" ? "Guardando…" : "Guardar plantilla"}</button>
        </div>
      </div>
      {fromRffm && <div className="st-banner">Estos son los goleadores que publica la RFFM. Pega la plantilla completa con «Importar» o completa dorsales y posiciones a mano.</div>}
      <div className="st-card"><RosterSheet players={draft} onChange={(p) => { setDraft(p); setState("idle"); }} /></div>
    </div>
  );
}
