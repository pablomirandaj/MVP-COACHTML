// Anfitrión "página de Claude": datos compartidos con db, el asistente con sample (lo paga quien lo usa) y la
// exportación con downloads. Todo lo demás (motor, explicación, HTML) se ejecuta en el navegador.
import { DEFAULT_RULES } from "../lib/rules";
import { ASK_COACH, contextSummary, execTool, SYSTEM_PROMPT, type Workspace } from "@fcs/assistant";
import type { Player } from "@fcs/engine";
import { slug, StoreError, type AiPort, type AiTurnRequest, type ExportPort, type Host, type ItemMeta, type StorePort, type StudioItem, type TeamPort } from "../ports";
import { seedRoster, SNAPSHOT, TEAM } from "./common";

type Use = (name: string) => Promise<any>;
const use: Use = (name) => (globalThis as any).window?.claude?.use?.(name) ?? Promise.resolve(null);
export const ITEMS = "studio_items", ROSTER_DOC = "studio/roster", SETTINGS_DOC = "studio/settings";
const tabId = `tab_${Math.random().toString(36).slice(2, 10)}`;

function teamPort(db: any): TeamPort {
  return {
    team: () => TEAM,
    async roster() {
      if (!db) return seedRoster();
      const s = await db.doc(ROSTER_DOC).get();
      const players = s.exists ? (s.data()?.players as Player[] | undefined) : undefined;
      return players?.length ? players.map((p) => ({ ...p })) : seedRoster();
    },
    async saveRoster(players) { if (db) await db.doc(ROSTER_DOC).set({ players, updated_at: new Date().toISOString() }); return players; },
    fixtures: () => SNAPSHOT.fixtures, standings: () => SNAPSHOT.standings, results: () => SNAPSHOT.results, scorers: () => SNAPSHOT.scorers,
  };
}

function storePort(db: any): StorePort {
  const mem = new Map<string, StudioItem>();
  let memSettings: { rules: string[] } | null = null;
  const ref = (id: string) => db.collection(ITEMS).doc(id);
  return {
    async list() {
      const items: ItemMeta[] = db ? (await db.collection(ITEMS).get()).docs.map((d: any) => d.data()) : [...mem.values()];
      return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || a.id.localeCompare(b.id));
    },
    async load(id) {
      if (!db) return mem.get(id) ?? null;
      const s = await ref(id).get();
      return s.exists ? (JSON.parse(JSON.stringify(s.data())) as StudioItem) : null;
    },
    async save(item, baseRevision) {
      const updated_at = new Date().toISOString();
      if (!db) {
        const cur = mem.get(item.id);
        if (cur && baseRevision !== undefined && cur.revision !== baseRevision) throw new StoreError("conflict", "Otra persona ha guardado esta jugada.");
        const revision = (cur?.revision ?? 0) + 1;
        mem.set(item.id, { ...item, revision, updated_at });
        return { id: item.id, revision, updated_at };
      }
      const lease = await ref(item.id).acquire({ holder: tabId, ttlMs: 4000 }).catch(() => ({ acquired: true }));
      if (!lease.acquired) throw new StoreError("conflict", "Otra persona está guardando esta jugada.");
      const cur = await ref(item.id).get();
      const curRev = cur.exists ? Number(cur.data()?.revision ?? 0) : 0;
      if (cur.exists && baseRevision !== undefined && curRev !== baseRevision) throw new StoreError("conflict", "Otra persona ha guardado esta jugada.");
      const revision = curRev + 1;
      try { await ref(item.id).set(JSON.parse(JSON.stringify({ ...item, revision, updated_at }))); }
      catch (e: any) { throw new StoreError(e?.code === "quota_exceeded" ? "quota" : "unavailable", e?.message ?? "No se ha podido guardar."); }
      return { id: item.id, revision, updated_at };
    },
    async remove(id) { if (db) await ref(id).delete(); else mem.delete(id); },
    async settings() {
      const s = db ? await db.doc(SETTINGS_DOC).get().catch(() => null) : null;
      const rules = s?.exists ? s.data()?.rules : memSettings?.rules;
      return { rules: Array.isArray(rules) ? rules.map(String) : [...DEFAULT_RULES] };
    },
    async saveSettings(st) {
      const rules = st.rules.map((r) => r.trim()).filter(Boolean).slice(0, 20);
      if (db) await db.doc(SETTINGS_DOC).set({ rules, updated_at: new Date().toISOString() }); else memSettings = { rules };
    },
  };
}

const lastRound = (text: string) => text.trim().split(/\n\s*\n/).filter(Boolean).pop()?.trim() ?? "";

function aiPort(sample: any): AiPort {
  const turns = (req: AiTurnRequest, extra = "") => [
    { role: "user" as const, content: `${SYSTEM_PROMPT}\n\nTrabajas dentro de la página del entrenador; las herramientas aplican los cambios al momento.` },
    { role: "assistant" as const, content: "Entendido." },
    ...req.history,
    { role: "user" as const, content: `${contextSummary(req.ws)}\n\nEntrenador: ${req.message}${extra}` },
  ];
  /** Plan B sin herramientas: pedir un JSON con la herramienta y validarlo en local; un reintento con los errores. */
  async function viaJson(req: AiTurnRequest) {
    const names = [...req.ws.tools().map((t) => t.name), "ask_coach"];
    const ask = `\n\nResponde SOLO con JSON: {"tool": uno de ${JSON.stringify(names)} o null, "input": {...}, "reply": "1–3 frases para el entrenador"}.`;
    let error = "";
    for (let i = 0; i < 2; i++) {
      const out = await sample.json(turns(req, ask + error), { cache: false, signal: req.signal });
      if (!out?.tool) return { reply: String(out?.reply ?? "Hecho."), clarification: null };
      const r = await execTool(req.ws, String(out.tool), out.input);
      if (r.stop) return { reply: String(out.reply ?? ""), clarification: r.stop };
      if (!r.is_error) return { reply: String(out.reply ?? "Hecho."), clarification: null };
      error = `\n\nTu respuesta anterior falló: ${r.content}. Corrígela.`;
    }
    return { reply: "No he podido aplicar el cambio; prueba a decirlo de otra forma.", clarification: null };
  }
  return {
    available: async () => !!sample,
    async turn(req) {
      if (!sample) throw new Error("El asistente no está disponible en esta página.");
      const limits = await sample.limits?.().catch(() => null);
      if (!limits?.tools) return viaJson(req);
      let clarification: { question: string; options: string[] } | null = null;
      const tools = [...req.ws.tools(), ASK_COACH].map((t) => ({
        name: t.name, description: t.description, inputSchema: t.input_schema,
        execute: async (input: unknown) => {
          const r = await execTool(req.ws as Workspace, t.name, input);
          if (r.stop) clarification = r.stop;
          if (r.is_error) throw new Error(r.content);
          return r.content;
        },
      }));
      try {
        const res = await sample(turns(req), { tools, cache: false, signal: req.signal, onText: req.onText ? ({ text }: { text: string }) => req.onText!(lastRound(text)) : undefined });
        return { reply: lastRound(res.text) || "Hecho.", clarification };
      } catch (e: any) {
        if (e?.code === "tools_unavailable") return viaJson(req);
        throw e;
      }
    },
  };
}

function exportPort(downloads: any): ExportPort {
  return {
    async saveHtml(filename, html) {
      if (!downloads) throw new Error("Esta vista no permite descargar archivos.");
      await downloads.save({ filename: `${slug(filename.replace(/\.html$/, ""))}.html`, data: html });
    },
  };
}

export async function createArtifactHost(): Promise<Host> {
  const [db, sample, downloads] = await Promise.all([use("db"), use("sample"), use("downloads")]);
  return { mode: "artifact", team: teamPort(db), store: storePort(db), ai: aiPort(sample), exporter: exportPort(downloads) };
}
