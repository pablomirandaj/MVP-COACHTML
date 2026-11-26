// Anfitrión "servidor propio": la misma interfaz contra la API Fastify (docs/13). El asistente se ejecuta en el
// servidor con el mismo bucle y los mismos espacios de trabajo (@fcs/assistant); la clave nunca llega al navegador.
import type { Player } from "@fcs/engine";
import { api, get, post } from "../../lib/api";
import { slug, StoreError, type AiPort, type ExportPort, type Host, type ItemMeta, type StorePort, type StudioItem, type TeamPort } from "../ports";
import { exportDocument, SNAPSHOT, TEAM } from "./common";

const POS_FROM_API = (p: any): Player => ({
  id: p.id, n: p.shirt_number ?? undefined, name: p.nickname || p.first_name, surname: p.last_name, pos: p.primary_position,
  secondary: p.secondary_positions, foot: p.dominant_foot, height: p.height_cm ?? undefined, setpiece: p.setpiece_roles,
  status: p.status === "AVAILABLE" ? "AVAILABLE" : p.status, tags: Object.keys(p.attributes ?? {}),
} as Player);

export function createServerHost(teamId: string): Host {
  const team: TeamPort = {
    team: () => TEAM,
    roster: async () => (await get<any[]>(`/teams/${teamId}/players`)).map(POS_FROM_API),
    async saveRoster(players) {
      for (const p of players) {
        const body = { first_name: p.name, last_name: p.surname ?? "", shirt_number: p.n ?? null, primary_position: p.pos || "CM", dominant_foot: p.foot, height_cm: p.height ?? null };
        if (p.id.startsWith("pl_")) await post(`/teams/${teamId}/players`, body); else await api("PATCH", `/players/${p.id}`, body);
      }
    },
    fixtures: () => SNAPSHOT.fixtures, standings: () => SNAPSHOT.standings, results: () => SNAPSHOT.results, scorers: () => SNAPSHOT.scorers,
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
    async exportHtml(tracks, meta) {
      const blob = new Blob([exportDocument(tracks, meta)], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${slug(meta.title)}.html`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
  };
  return { mode: "server", team, store, ai, exporter };
}
