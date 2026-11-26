import { useEffect, useMemo, useState } from "react";
import { computeScene, DEFAULT_PITCH, FORMATIONS, sceneTracks, type SceneSpec } from "@fcs/engine";
import { download, get, post, put, type MatchDto } from "../lib/api";
import { SCENE_TYPES, slotLabel } from "../lib/labels";
import { go } from "../lib/router";
import { Pitch, TimelineControls, useTimeline } from "../components/Pitch";
import { Chat } from "../components/Chat";
import { Diagnostics, ErrorBox, useAction } from "../components/ui";

const TEMPLATES: Record<string, SceneSpec> = {
  PRESS_OWN: { type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_433" }, params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
    keyframes: [{ t: 0, ball: { holder: "GK" }, note: "Balón en su portero: bloque alto, sin saltar." }, { t: 1.5, ball: { holder: "CB_R" }, note: "Su central recibe: basculamos y tapamos el pase interior." },
      { t: 3, ball: { holder: "RB" }, event: "TRIGGER", note: "¡Pase al lateral! Saltamos." }] },
  PRESS_OPP: { type: "PRESS_OPP", own: { formation: "F_433" }, opp: { formation: "F_433" }, params: { block_height: "HIGH", jumps: [{ who: "RW", to: "LB" }, { who: "ST", to: "CB_L", curve: "SCREEN_GK" }] },
    keyframes: [{ t: 0, ball: { holder: "GK" }, note: "Sacamos desde el portero." }, { t: 1.5, ball: { holder: "CB_L" } }, { t: 3, ball: { holder: "LB" }, event: "TRIGGER", note: "Pase al lateral: saltan." }] },
  RETREAT: { type: "RETREAT", own: { formation: "F_442" }, opp: { formation: "F_433" }, params: { block_height: "LOW" },
    keyframes: [{ t: 0, ball: { holder: "CM_L" }, note: "Bloque bajo y juntos." }, { t: 2, ball: { holder: "LW" }, note: "Basculamos al lado del balón." }, { t: 4, ball: { holder: "RW" }, note: "Cambio de orientación: basculamos al otro lado." }] },
  REST_DEFENSE: { type: "REST_DEFENSE", own: { formation: "F_433" }, opp: { formation: "F_433" }, params: { opp_staying: ["ST", "LW"] },
    keyframes: [{ t: 0, ball: { holder: "RW" }, note: "Atacamos por la derecha: vigilancias por detrás de sus delanteros." }, { t: 2, ball: { holder: "LW" } }] },
};
const slotsOf = (f: string) => FORMATIONS[f]?.slots.map((s) => s.slot) ?? [];

export function SceneEditor({ sceneId, matchId }: { sceneId?: string; matchId?: string }) {
  const [name, setName] = useState("Presión alta");
  const [spec, setSpec] = useState<SceneSpec>(TEMPLATES.PRESS_OWN);
  const [saved, setSaved] = useState<{ id: string; revision: number; match_id: string | null; team_id: string; document: any } | null>(null);
  const [match, setMatch] = useState<MatchDto | null>(null);
  const a = useAction();
  const load = async () => {
    if (!sceneId) return;
    const s = await get(`/scenes/${sceneId}`);
    setSaved(s); setSpec(s.spec); setName(s.name);
  };
  useEffect(() => { load(); if (matchId) get<MatchDto>(`/matches/${matchId}`).then(setMatch); }, [sceneId, matchId]);

  // Vista previa instantánea con el motor en el navegador; el servidor recalcula al guardar.
  const preview = useMemo(() => { try { return { doc: computeScene(spec, DEFAULT_PITCH), error: null }; } catch (e) { return { doc: null, error: (e as Error).message }; } }, [spec]);
  const tracks = useMemo(() => (preview.doc ? sceneTracks(preview.doc, name) : null), [preview.doc, name]);
  const tl = useTimeline(tracks);
  const possessing = spec.type === "PRESS_OWN" || spec.type === "RETREAT" ? slotsOf(spec.opp.formation) : slotsOf(spec.own.formation);
  const pressing = spec.type === "PRESS_OPP" ? slotsOf(spec.opp.formation) : slotsOf(spec.own.formation);
  const targets = spec.type === "PRESS_OPP" ? slotsOf(spec.own.formation) : slotsOf(spec.opp.formation);
  const set = (patch: Partial<SceneSpec>) => setSpec({ ...spec, ...patch });
  const setParams = (p: Partial<SceneSpec["params"]>) => set({ params: { ...spec.params, ...p } });

  const save = () => a.run(async () => {
    if (saved) { const s = await put(`/scenes/${saved.id}`, { name, spec, revision: saved.revision }); setSaved(s); setSpec(s.spec); }
    else { const tid = match!.team_id; const s = await post(`/teams/${tid}/scenes`, { name, spec, match_id: matchId }); go(`/scene/${s.id}`); }
  });
  const back = saved?.match_id ? `#/match/${saved.match_id}` : matchId ? `#/match/${matchId}` : "#/";

  return (
    <main className="page wide">
      <a className="back" href={back}>← Jornada</a>
      <header className="row between wrap">
        <h1 className="grow"><input className="title-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la escena" /></h1>
        <div className="row">
          {saved && <button onClick={() => a.run(() => download(`/scenes/${saved.id}/export.html`, "escena.html"))}>Exportar HTML</button>}
          <button className="primary" onClick={save} disabled={a.busy || !!preview.error}>{saved ? "Guardar" : "Crear escena"}</button>
        </div>
      </header>
      <div className="editor">
        <div className="stage">
          {tracks ? <><Pitch tracks={tracks} t={tl.t} /><TimelineControls tracks={tracks} tl={tl} />
            <p className="note">{tracks.notes.filter((n) => n.t <= tl.t + 1e-6).pop()?.text ?? ""}</p></> : <ErrorBox error={preview.error} />}
        </div>
        <aside className="side">
          <ErrorBox error={a.error} />
          <div className="stack panel">
            <label>Tipo<select aria-label="Tipo" value={spec.type} onChange={(e) => { setSpec(TEMPLATES[e.target.value]); if (!saved) setName(SCENE_TYPES[e.target.value]); }}>
              {Object.entries(SCENE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="grid2">
              <label>Nuestro sistema<select aria-label="Nuestro sistema" value={spec.own.formation} onChange={(e) => set({ own: { ...spec.own, formation: e.target.value, labels: undefined } })}>
                {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
              <label>Sistema rival<select aria-label="Sistema rival" value={spec.opp.formation} onChange={(e) => set({ opp: { ...spec.opp, formation: e.target.value } })}>
                {Object.entries(FORMATIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
              {spec.type !== "REST_DEFENSE" && <label>Altura del bloque<select aria-label="Altura del bloque" value={spec.params.block_height ?? ""} onChange={(e) => setParams({ block_height: (e.target.value || undefined) as any })}>
                <option value="HIGH">Alto</option><option value="MID">Medio</option><option value="LOW">Bajo</option></select></label>}
              <label>Basculación<input aria-label="Basculación" type="range" min={0} max={1} step={0.05} value={spec.params.lateral_shift ?? 0.55} onChange={(e) => setParams({ lateral_shift: Number(e.target.value) })} /></label>
            </div>
          </div>
          <div className="stack panel">
            <b>Secuencia del balón</b>
            {spec.keyframes.map((k, i) => (
              <div key={i} className="stack kf">
                <div className="row">
                  <span className="muted small">Paso {i + 1}</span>
                  <select value={k.ball.holder} onChange={(e) => set({ keyframes: spec.keyframes.map((x, j) => (j === i ? { ...x, ball: { holder: e.target.value } } : x)) })} aria-label="Quién tiene el balón">
                    {possessing.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}</select>
                  {(spec.type === "PRESS_OWN" || spec.type === "PRESS_OPP") && <label className="check small"><input type="checkbox" checked={k.event === "TRIGGER"}
                    onChange={(e) => set({ keyframes: spec.keyframes.map((x, j) => (j === i ? { ...x, event: e.target.checked ? "TRIGGER" : undefined } : x)) })} />Salto de presión</label>}
                  {spec.keyframes.length > 1 && <button aria-label="Quitar paso" onClick={() => set({ keyframes: spec.keyframes.filter((_, j) => j !== i) })}>✕</button>}
                </div>
                <input value={k.note ?? ""} placeholder="Qué quieres que vean los jugadores en este paso" aria-label="Nota del paso"
                  onChange={(e) => set({ keyframes: spec.keyframes.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) })} />
              </div>
            ))}
            {spec.keyframes.length < 8 && <button onClick={() => set({ keyframes: [...spec.keyframes, { t: (spec.keyframes.at(-1)?.t ?? 0) + 1.5, ball: { holder: possessing[0] } }] })}>＋ Paso</button>}
          </div>
          {(spec.type === "PRESS_OWN" || spec.type === "PRESS_OPP") && (
            <div className="stack panel">
              <b>Saltos de presión</b>
              {(spec.params.jumps ?? []).map((j, i) => (
                <div key={i} className="row wrap">
                  <select value={j.who} onChange={(e) => setParams({ jumps: spec.params.jumps!.map((x, k) => (k === i ? { ...x, who: e.target.value } : x)) })} aria-label="Quién salta">
                    {pressing.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}</select>
                  <span>→</span>
                  <select value={j.to} onChange={(e) => setParams({ jumps: spec.params.jumps!.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)) })} aria-label="A quién">
                    {targets.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}</select>
                  <label className="check small"><input type="checkbox" checked={j.curve === "SCREEN_GK"} onChange={(e) => setParams({ jumps: spec.params.jumps!.map((x, k) => (k === i ? { ...x, curve: e.target.checked ? "SCREEN_GK" : undefined } : x)) })} />tapa el pase al portero</label>
                  <button aria-label="Quitar salto" onClick={() => setParams({ jumps: spec.params.jumps!.filter((_, k) => k !== i) })}>✕</button>
                </div>
              ))}
              <button onClick={() => setParams({ jumps: [...(spec.params.jumps ?? []), { who: pressing[0], to: targets[0] }] })}>＋ Salto</button>
            </div>
          )}
          {spec.type === "REST_DEFENSE" && (
            <div className="stack panel">
              <b>Sus delanteros que se quedan arriba</b>
              <div className="row wrap">{slotsOf(spec.opp.formation).filter((s) => s !== "GK").map((s) => (
                <label key={s} className="check small"><input type="checkbox" checked={spec.params.opp_staying?.includes(s) ?? false}
                  onChange={(e) => setParams({ opp_staying: e.target.checked ? [...(spec.params.opp_staying ?? []), s] : (spec.params.opp_staying ?? []).filter((x) => x !== s) })} />{slotLabel(s)}</label>
              ))}</div>
            </div>
          )}
          <h3>Avisos</h3>
          {preview.doc && <Diagnostics items={preview.doc.diagnostics} />}
          {saved && <>
            <h3>Asistente</h3>
            <Chat targetType="SCENE" targetId={saved.id} placeholder="Ej.: que el 9 tape el pase al portero al saltar" onChanged={load}
              examples={["Presionamos más arriba", "Que salte también el interior izquierdo a su mediocentro"]} />
          </>}
        </aside>
      </div>
    </main>
  );
}
