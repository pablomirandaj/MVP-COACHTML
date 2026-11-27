// Inicio: el próximo partido con los datos del rival y accesos directos para prepararlo.
import { useEffect, useMemo, useState } from "react";
import { useStudio } from "../lib/context";
import { longDate, shortDate, teamShort, venue } from "../lib/format";
import type { ItemMeta } from "../ports";

const KIND_ES = { BOARD: "Pizarra", SETPIECE: "Balón parado", SCENE: "Plan de juego" } as const;

export function Home() {
  const { host, go, next, roster } = useStudio();
  const team = host.team.team();
  const standings = host.team.standings();
  const us = standings.find((s) => s.equipo === team.name);
  const leader = standings.find((s) => s.posicion === 1);
  const rival = next ? standings.find((s) => s.equipo === next.rival) : undefined;
  const rivalTop = next ? host.team.scorers().filter((s) => s.equipo === next.rival).sort((a, b) => b.goles - a.goles)[0] : undefined;
  const rivalLast = useMemo(() => !next ? [] : host.team.results()
    .filter((r) => r.goles_local !== null && (r.local === next.rival || r.visitante === next.rival))
    .sort((a, b) => b.jornada - a.jornada).slice(0, 5)
    .map((r) => { const home = r.local === next.rival; const gf = home ? r.goles_local! : r.goles_visitante!, gc = home ? r.goles_visitante! : r.goles_local!;
      return { j: r.jornada, vs: home ? r.visitante : r.local, home, gf, gc, res: gf > gc ? "G" : gf === gc ? "E" : "P" }; }), [host, next]);
  const ourLast = host.team.fixtures().filter((f) => f.resultado).sort((a, b) => a.jornada - b.jornada).slice(-5);
  const [recent, setRecent] = useState<ItemMeta[]>([]);
  useEffect(() => { host.store.list().then((l) => setRecent(l.slice(0, 4))).catch(() => setRecent([])); }, [host]);
  const missing = roster.filter((p) => p.n == null || !p.pos).length;
  const opponent = next ? teamShort(next.rival) : "el rival";

  return (
    <div className="st-stack" style={{ gap: 18 }}>
      <section className="st-hero" aria-labelledby="hero-h">
        <div className="eyebrow">{team.competition} · {team.season}</div>
        <h1 id="hero-h">{team.short}</h1>
        {us && <p style={{ margin: 0, opacity: .9 }}>{us.posicion}.º con {us.puntos} puntos tras {us.jugados} jornadas{leader && leader.equipo !== team.name ? `, a ${leader.puntos - us.puntos} del líder` : ", líder"}.</p>}
        {us && <div className="facts">
          <div><b className="st-num">{us.posicion}.º</b><span>posición</span></div>
          <div><b className="st-num">{us.puntos}</b><span>puntos</span></div>
          <div><b className="st-num">{us.ganados}-{us.empatados}-{us.perdidos}</b><span>G-E-P</span></div>
          <div><b className="st-num">{us.goles_favor}:{us.goles_contra}</b><span>goles</span></div>
          <div><span style={{ display: "flex", gap: 3 }}>{ourLast.map((f) => <span key={f.jornada} className="st-res" data-r={f.resultado}>{f.resultado}</span>)}</span><span>últimos 5</span></div>
        </div>}
      </section>

      {missing > 0 && <div className="st-banner">Faltan dorsales o posiciones en {missing} jugador{missing > 1 ? "es" : ""}. La RFFM solo publica a los goleadores: <button className="st-btn sm" onClick={() => go("roster")}>Completar la plantilla</button></div>}

      <div className="st-grid">
        {next && <section className="st-card st-ticket" aria-labelledby="next-h">
          <div className="meta">Jornada {next.jornada} · {longDate(next.fecha)}{next.hora ? ` · ${next.hora}` : ""} · {next.condicion === "Casa" ? "en casa" : "fuera"}</div>
          <h2 id="next-h" className="vs">{next.condicion === "Casa" ? `${team.short} – ${opponent}` : `${opponent} – ${team.short}`}</h2>
          <div className="st-small st-muted">{venue(next.campo)}</div>
          {rival && <dl className="st-kv">
            <div><dt>Posición</dt><dd>{rival.posicion}.º · {rival.puntos} pts</dd></div>
            <div><dt>{next.condicion === "Fuera" ? "Puntos en su campo" : "Puntos fuera"}</dt><dd>{next.condicion === "Fuera" ? rival.puntos_casa : rival.puntos_fuera}</dd></div>
            <div><dt>Goles</dt><dd>{rival.goles_favor} a favor · {rival.goles_contra} en contra</dd></div>
            <div><dt>Máximo goleador</dt><dd>{rivalTop ? `${rivalTop.jugador} (${rivalTop.goles})` : "—"}</dd></div>
          </dl>}
          {rivalLast.length > 0 && <div>
            <h3 style={{ marginBottom: 6 }}>Sus últimos partidos</h3>
            <div className="st-stack" style={{ gap: 4 }}>
              {rivalLast.map((r) => <div key={r.j} className="st-row st-small" style={{ gap: 8 }}><span className="st-res" data-r={r.res}>{r.res}</span><span className="st-num">{r.gf}–{r.gc}</span><span className="st-muted">{r.home ? "vs" : "en"} {teamShort(r.vs)} · J{r.j}</span></div>)}
            </div>
          </div>}
        </section>}

        <section className="st-stack" aria-labelledby="prep-h">
          <h3 id="prep-h">Preparar el partido</h3>
          <div className="st-actions">
            <button className="st-action" onClick={() => go("setpieces", { kind: "SETPIECE", preset: { type: "CORNER_DEF", opponent: next?.rival } })}><b>Balón parado contra {opponent}</b><span>Córners y faltas a favor y en contra</span></button>
            <button className="st-action" onClick={() => go("plans", { kind: "SCENE", preset: { type: "PRESS_OWN", opponent: next?.rival } })}><b>Cómo presionarles</b><span>Presión alta o media y saltos</span></button>
            <button className="st-action" onClick={() => go("plans", { kind: "SCENE", preset: { type: "BUILD_UP", opponent: next?.rival } })}><b>Salida de balón</b><span>2+1, 3+1 o lateral por dentro</span></button>
            <button className="st-action" onClick={() => go("plans", { kind: "SCENE", preset: { type: "ATTACK_SPACE", opponent: next?.rival } })}><b>Dónde atacarles</b><span>Espacios entre líneas y a la espalda</span></button>
            <button className="st-action" onClick={() => go("board", { kind: "BOARD", preset: { opponent: next?.rival } })}><b>Pizarra libre</b><span>Diseña una jugada paso a paso</span></button>
          </div>
          {recent.length > 0 && <>
            <h3 style={{ marginTop: 6 }}>Últimas jugadas</h3>
            <ul className="st-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
              {recent.map((it) => <li key={it.id}><button className="st-btn" style={{ width: "100%", justifyContent: "space-between" }} onClick={async () => { const item = await host.store.load(it.id); if (item) go(item.kind === "BOARD" ? "board" : item.kind === "SETPIECE" ? "setpieces" : "plans", { kind: item.kind, item }); }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span><span className="st-tag">{KIND_ES[it.kind]} · {shortDate(String(it.updated_at).slice(0, 10))}</span></button></li>)}
            </ul>
          </>}
        </section>
      </div>
      <p className="st-small st-muted">Fuente: {team.source} · {longDate(team.snapshot_at)}.</p>
    </div>
  );
}
