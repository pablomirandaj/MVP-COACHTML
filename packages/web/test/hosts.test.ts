import { beforeEach, describe, expect, it } from "vitest";
import { createBoard } from "@fcs/engine";
import { boardWorkspace } from "@fcs/assistant";
import { createArtifactHost } from "../src/studio/hosts/artifact";
import type { StudioItem } from "../src/studio/ports";

// ---- window.claude simulado: db en memoria, sample guionizado, downloads que captura ----
type Doc = Record<string, unknown>;
function fakeClaude(opts: { sample?: any } = {}) {
  const store = new Map<string, Doc>();
  const saved: { filename: string; data: unknown }[] = [];
  const snap = (path: string) => ({ id: path.split("/").pop()!, exists: store.has(path), data: () => store.get(path), metadata: { fromCache: false, hasPendingWrites: false } });
  const docRef = (path: string) => ({
    id: path.split("/").pop()!, path,
    get: async () => snap(path),
    set: async (d: Doc) => { store.set(path, JSON.parse(JSON.stringify(d))); },
    update: async (d: Doc) => { store.set(path, { ...store.get(path), ...d }); },
    delete: async () => { store.delete(path); },
    acquire: async () => ({ acquired: true, version: 1 }),
    onSnapshot: () => () => {},
  });
  const db = {
    doc: docRef,
    collection: (path: string) => ({
      path, doc: (id: string) => docRef(`${path}/${id}`),
      get: async () => { const docs = [...store.keys()].filter((k) => k.startsWith(path + "/") && k.split("/").length === path.split("/").length + 1).sort().map(snap); return { docs, size: docs.length, empty: !docs.length }; },
      orderBy() { return this; }, limit() { return this; }, where() { return this; },
    }),
  };
  const downloads = { save: async (r: { filename: string; data: unknown }) => { saved.push(r); return { status: "saved" }; } };
  const caps: Record<string, unknown> = { db, downloads, user: { id: async () => "u_test" }, ...(opts.sample !== undefined ? { sample: opts.sample } : {}) };
  (globalThis as any).window = { claude: { use: async (n: string) => caps[n] ?? null } };
  return { store, saved };
}

describe("Anfitrión de la página de Claude", () => {
  beforeEach(() => { delete (globalThis as any).window; });

  it("sin plantilla guardada arranca con los 12 goleadores, sin dorsal", async () => {
    fakeClaude();
    const host = await createArtifactHost();
    const roster = await host.team.roster();
    expect(roster).toHaveLength(12);
    expect(roster.every((p) => p.n === undefined)).toBe(true);
    expect(host.team.team().short).toBe("Periso CF");
    expect(host.team.fixtures()).toHaveLength(34);
  });

  it("guardar con una revisión antigua da conflicto", async () => {
    fakeClaude();
    const host = await createArtifactHost();
    const item: StudioItem = { id: "b1", kind: "BOARD", title: "Salida", doc: createBoard({ own: "F_433", opp: "F_442" }), revision: 0, updated_at: "", history: [] };
    const s1 = await host.store.save(item, 0);
    expect(s1.revision).toBe(1);
    await host.store.save({ ...item, revision: 1 }, 1);
    await expect(host.store.save({ ...item }, 1)).rejects.toMatchObject({ code: "conflict" });
    expect((await host.store.list()).map((x) => x.id)).toEqual(["b1"]);
  });

  it("sin herramientas usa el plan B por JSON y aplica los comandos válidos", async () => {
    const sample: any = async () => { throw Object.assign(new Error("no tools"), { code: "tools_unavailable" }); };
    sample.limits = async () => ({ maxPromptBytes: 262144 });
    sample.json = async () => ({ tool: "apply_commands", input: { commands: [{ op: "board.add_step" }] }, reply: "Paso añadido." });
    fakeClaude({ sample });
    const host = await createArtifactHost();
    let doc = createBoard({ own: "F_433", opp: "F_442" });
    const ws = boardWorkspace({ doc, roster: [] }, (d) => { doc = d; });
    const r = await host.ai.turn({ ws, history: [], message: "Añade un paso" });
    expect(r.reply).toBe("Paso añadido.");
    expect(doc.steps).toHaveLength(1);
  });

  it("si la página no puede preguntar a Claude, el chat no está disponible", async () => {
    fakeClaude({ sample: null });
    const host = await createArtifactHost();
    expect(await host.ai.available()).toBe(false);
  });

  it("exportar la carpeta la entrega a downloads con extensión .html y el formato de la J5", async () => {
    const f = fakeClaude();
    const host = await createArtifactHost();
    const { buildDossier, DEFAULT_RULES } = await import("../src/studio/lib/dossier");
    const item: StudioItem = { id: "b1", kind: "BOARD", title: "Salida / por fuera", doc: createBoard({ own: "F_433", opp: "F_442" }), revision: 1, updated_at: "", history: [] };
    const { html, skipped } = buildDossier([item], { team: host.team.team(), roster: [], rules: DEFAULT_RULES, title: "Salida por fuera", opponent: "Sporting Hortaleza" });
    expect(skipped).toBe(0);
    await host.exporter.saveHtml("Salida / por fuera", html);
    expect(f.saved[0].filename).toMatch(/\.html$/);
    for (const t of ["Sporting Hortaleza", "Esto no cambia nunca", "data:image/png"]) expect(String(f.saved[0].data)).toContain(t);
  });

  it("las reglas fijas: 5 por defecto y se guardan", async () => {
    fakeClaude();
    const host = await createArtifactHost();
    expect((await host.store.settings()).rules).toHaveLength(5);
    await host.store.saveSettings({ rules: ["Uno", "Dos"] });
    const again = await createArtifactHost();
    expect((await again.store.settings()).rules).toEqual(["Uno", "Dos"]);
  });

  it("la carpeta del partido con 2 piezas lleva 2 pestañas; una borrada se omite y se avisa", async () => {
    const f = fakeClaude();
    const host = await createArtifactHost();
    const { exportFolder, DEFAULT_RULES } = await import("../src/studio/lib/dossier");
    const mk = (id: string, title: string): StudioItem => ({ id, kind: "BOARD", title, revision: 0, updated_at: "", history: [],
      doc: { ...createBoard({ own: "F_433", opp: "F_442" }), steps: [{ id: "s1", moves: [], pass: { from: "own:GK", to: "own:CB_L", kind: "GROUND", origin: "EXPLICIT" } }] } as any });
    await host.store.save(mk("b1", "Salida corta"));
    await host.store.save(mk("b2", "Salida larga"));
    const r = await exportFolder(host, ["b2", "b1", "borrada"], { roster: [], rules: DEFAULT_RULES, title: "Jornada 12", match: "Jornada 12", opponent: "Canillas" });
    expect(r.skipped).toBe(1);
    const html = String(f.saved[0].data);
    expect(html.match(/class="fcsd-tab/g)).toHaveLength(2);
    expect(html.indexOf("Salida larga")).toBeLessThan(html.indexOf("Salida corta"));
    expect(f.saved[0].filename).toMatch(/\.html$/);
  });
});
