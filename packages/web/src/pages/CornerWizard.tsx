// Asistente de creación por formulario (ADR-016): genera los mismos comandos IR que el chat o la voz.
import { useEffect, useState } from "react";
import type { Clarification, Command } from "@fcs/engine";
import { get, patch, post, type MatchDto, type PlayerDto } from "../lib/api";
import { ROLES, ZONES } from "../lib/labels";
import { playerName } from "../lib/players";
import { go } from "../lib/router";
import { Chat } from "../components/Chat";
import { ClarificationCard, ErrorBox, Section, useAction } from "../components/ui";

interface RoleRow { count: number; role: string; zone: string }
const ROLE_OPTIONS = ["SECONDARY_TARGET", "DECOY", "REBOUND", "REST_DEFENDER", "GK_SCREEN", "SHORT_RECEIVER"];

export function CornerWizard({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchDto | null>(null);
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [side, setSide] = useState("LEFT");
  const [taker, setTaker] = useState("");
  const [swing, setSwing] = useState("");
  const [trajectory, setTrajectory] = useState("");
  const [target, setTarget] = useState("");
  const [screen, setScreen] = useState(false);
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [extra, setExtra] = useState<Command[]>([]);
  const [clar, setClar] = useState<Clarification | null>(null);
  const a = useAction();
  useEffect(() => { get<MatchDto>(`/matches/${matchId}`).then(async (m) => { setMatch(m); setPlayers(await get(`/teams/${m.team_id}/players`)); }); }, [matchId]);

  const commands = (): Command[] => {
    const c: Command[] = [{ op: "play.create", type: "CORNER_ATT", side }];
    if (taker) c.push({ op: "play.set_taker", player: taker });
    if (swing || trajectory || target) c.push({ op: "play.set_delivery", ...(swing && { swing }), ...(trajectory && { trajectory }), ...(target && { target_zone: target }) });
    if (screen) {
      const zone = target || "Z_FAR_POST";
      c.push({ op: "play.add_roles", count: 2, zone, group_id: "g1" },
        { op: "play.set_role", target: { group: "g1", index: 0 }, role: "BLOCKER", strict_legal: true },
        { op: "play.set_role", target: { group: "g1", index: 1 }, role: "PRIMARY_TARGET" },
        { op: "play.relation", type: "SCREENS", blocker: { group: "g1", index: 0 }, defender: { marker_of: { group: "g1", index: 1 } }, beneficiary: { group: "g1", index: 1 } });
    }
    for (const r of rows) c.push({ op: "play.add_roles", count: r.count, role: r.role, ...(r.zone && { zone: r.zone }) });
    return [...c, ...extra];
  };
  const create = (cmds = commands()) => a.run(async () => {
    const r = await post<{ created: boolean; clarifications: Clarification[]; play?: { id: string } }>(`/teams/${match!.team_id}/plays`, { commands: cmds, match_id: matchId });
    if (r.created) go(`/play/${r.play!.id}`); else setClar(r.clarifications[0] ?? null);
  });
  // Opciones de una aclaración: actualizar la ficha (con auditoría) o añadir el comando propuesto y volver a crear.
  const choose = (i: number) => a.run(async () => {
    const cmds = clar!.options[i].commands;
    const upd = cmds.find((c) => c.op === "player.update");
    if (upd) { await patch(`/players/${upd.player}`, { dominant_foot: upd.dominant_foot, via: "CLARIFICATION" }); setClar(null); await create(); return; }
    setExtra([...extra, ...cmds]); setClar(null); await create([...commands(), ...cmds]);
  });

  if (!match) return <main className="page"><p className="muted">Cargando…</p></main>;
  return (
    <main className="page">
      <a className="back" href={`#/match/${matchId}`}>← Jornada</a>
      <h1>Nuevo córner ofensivo</h1>
      <Section title="Cuéntaselo al asistente">
        <Chat targetType="NEW_PLAY" targetId={match.team_id} matchId={matchId} placeholder="Ej.: córner desde la izquierda, lo saca Lucas cerrado al segundo palo…"
          onChanged={(t) => t.type === "PLAY" && go(`/play/${t.id}`)} examples={["Córner desde la derecha, lo saca Lucas cerrado, dos al segundo palo y dos atrás"]} />
      </Section>
      <Section title="O paso a paso">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <div className="grid2">
            <label>Lado<select aria-label="Lado" value={side} onChange={(e) => setSide(e.target.value)}><option value="LEFT">Izquierda</option><option value="RIGHT">Derecha</option></select></label>
            <label>Lanzador<select aria-label="Lanzador" value={taker} onChange={(e) => setTaker(e.target.value)}><option value="">Que lo proponga el sistema</option>
              {players.filter((p) => p.primary_position !== "GK").map((p) => <option key={p.id} value={p.id}>{playerName(p)}</option>)}</select></label>
            <label>Efecto<select aria-label="Efecto" value={swing} onChange={(e) => setSwing(e.target.value)}><option value="">El natural del lanzador</option><option value="INSWING">Cerrado</option><option value="OUTSWING">Abierto</option></select></label>
            <label>Trayectoria<select aria-label="Trayectoria" value={trajectory} onChange={(e) => setTrajectory(e.target.value)}><option value="">Por defecto (tenso)</option><option value="DRIVEN">Tenso</option><option value="LOFTED">Bombeado</option></select></label>
            <label>Destino<select aria-label="Destino" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Donde ataque el rematador principal</option>
              {["Z_NEAR_POST", "Z_FAR_POST", "Z_GA_CENTER", "Z_PEN_SPOT"].map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}</select></label>
          </div>
          <label className="check"><input type="checkbox" checked={screen} onChange={(e) => setScreen(e.target.checked)} />Bloqueo (sin contacto) para liberar al rematador principal</label>
          <fieldset><legend>Más roles (opcional; el resto lo propone el sistema)</legend>
            {rows.map((r, i) => (
              <div key={i} className="row">
                <input type="number" min={1} max={4} value={r.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} aria-label="Cuántos" style={{ width: 64 }} />
                <select value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} aria-label="Rol">
                  {ROLE_OPTIONS.map((k) => <option key={k} value={k}>{ROLES[k]}</option>)}</select>
                {r.role === "SECONDARY_TARGET" && <select value={r.zone} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, zone: e.target.value } : x)))} aria-label="Zona">
                  <option value="">Zona por defecto</option>{["Z_NEAR_POST", "Z_FAR_POST", "Z_GA_CENTER", "Z_PEN_SPOT"].map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}</select>}
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setRows([...rows, { count: 1, role: "REST_DEFENDER", zone: "" }])}>＋ Rol</button>
          </fieldset>
          {clar && <ClarificationCard c={clar} onChoose={choose} onDismiss={() => setClar(null)} />}
          <ErrorBox error={a.error} />
          <button className="primary" disabled={a.busy}>Crear córner</button>
        </form>
      </Section>
    </main>
  );
}
