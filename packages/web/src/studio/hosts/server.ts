// Anfitrión "servidor propio": la misma interfaz contra la API Fastify (docs/13). El asistente se ejecuta en el
// servidor con el mismo bucle y los mismos espacios de trabajo (@fcs/assistant); la clave nunca llega al navegador.
import type { Player } from "@fcs/engine";
import { api, get, post } from "../../lib/api";
import { slug, StoreError, type AiPort, type ExportPort, type Host, type ItemMeta, type StorePort, type StudioItem, type TeamPort } from "../ports";
import type { Fixture, TeamInfo } from "../ports";
import { TEAM } from "./common";

const MADRID = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Fecha (AAAA-MM-DD) y hora (HH:MM) de Madrid a partir de un instante UTC. */
function madrid(iso: string | null): { fecha: string; hora: string } {
  if (!iso) return { fecha: "", hora: "" };
  const parts = Object.fromEntries(MADRID.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
}

const POS_FROM_API = (p: any): Player => ({
  id: p.id, n: p.shirt_number ?? undefined, name: p.nickname || p.first_name, surname: p.last_name, pos: p.primary_position,
  secondary: p.secondary_positions, foot: p.dominant_foot, height: p.height_cm ?? undefined, setpiece: p.setpiece_roles,
  status: p.status === "AVAILABLE" ? "AVAILABLE" : p.status, tags: Object.keys(p.attributes ?? {}),
} as Player);

export function createServerHost(teamId: string): Host {
  // El equipo y su calendario salen de la API; clasificación, resultados del grupo y goleadores aún no están en el servidor.
  let info: TeamInfo = { ...TEAM, name: "", short: "Equipo", competition: "", source: "este servidor" };
  let fixtures: Fixture[] = [];
  const team: TeamPort = {
    async load() {
      const [t, matches] = await Promise.all([get<any>(`/teams/${teamId}`), get<any[]>(`/teams/${teamId}/matches`)]);
      info = { ...info, name: t.name, short: t.name, competition: t.category ?? "", season: t.season_label ?? "", snapshot_at: new Date().toISOString().slice(0, 10) };
      fixtures = matches.filter((m) => m.status !== "BYE" && m.opponent).map((m) => ({
        jornada: m.matchday ?? 0, ...madrid(m.kickoff_at), condicion: m.is_home ? "Casa" : "Fuera", rival: m.opponent,
        goles_favor: null, goles_contra: null, resultado: m.status === "PLAYED" ? "E" : "", campo: m.venue ?? "",
      } as Fixture)).sort((a, b) => a.jornada - b.jornada);
    },
    team: () => info,
    roster: async () => (await get<any[]>(`/teams/${teamId}/players`)).map(POS_FROM_API),
    async saveRoster(players) {
      for (const p of players) {
        const body = { first_name: p.name, last_name: p.surname ?? "", shirt_number: p.n ?? null, primary_position: p.pos || "CM", dominant_foot: p.foot, height_cm: p.height ?? null };
        if (p.id.startsWith("pl_")) await post(`/teams/${teamId}/players`, body); else await api("PATCH", `/players/${p.id}`, body);
      }
      return (await get<any[]>(`/teams/${teamId}/players`)).map(POS_FROM_API);
    },
    fixtures: () => fixtures, standings: () => [], results: () => [], scorers: () => [],
  };
  const store: StorePort = {
    list: () => get<ItemMeta[]>(`/teams/${teamId}/studio/items`),
    load: (id) => get<StudioItem>(`/studio/items/${id}`).catch(() => null),
    async save(item, baseRevision) {
      try {
        return baseRevision ? await api("PUT", `/studio/items/${item.id}`, { ...item, revision: baseRevision }) : await post(`/teams/${teamId}/studio/items`, item);
      } catch (e: any) { if (e?.status === 409) throw new StoreError("conflict", "Otra persona ha guardado esta jugada."); throw e; }
    },
    remove: async (id) => { await api("DELETE", `/studio/items/${id}`); },
  };
  const ai: AiPort = {
    available: async () => (await get<{ available: boolean }>("/studio/assistant").catch(() => ({ available: false }))).available,
    async turn(req) {
      if (!req.subject) throw new Error("Falta el estado de la pieza para el servidor.");
      const r = await post<{ reply: string; clarification: any; state: unknown }>(`/teams/${teamId}/studio/assistant`, {
        kind: req.subject.kind, state: req.subject.state(), context: req.subject.context ?? {}, history: req.history, message: req.message,
      });
      req.subject.apply(r.state);
      return { reply: r.reply, clarification: r.clarification ?? null };
    },
  };
  const exporter: ExportPort = {
    async saveHtml(filename, html) {
      const blob = new Blob([html], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${slug(filename.replace(/\.html$/, ""))}.html`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
  };
  return { mode: "server", team, store, ai, exporter };
}
