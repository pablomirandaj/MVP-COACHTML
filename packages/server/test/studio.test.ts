// Pizarra Studio en el servidor: guardar con revisiones, exportar HTML y turno del asistente.
// Requiere TEST_DATABASE_URL (borra y recrea el esquema public); las suites de servidor se ejecutan en serie.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, type BoardDoc } from "@fcs/engine";
import { buildApp } from "../src/app";
import { ScriptedAdapter } from "../src/assistant/adapter";
import { createPool, type Db } from "../src/db";
import { migrate } from "../src/migrate";

const URL_ = process.env.TEST_DATABASE_URL;
let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
const llm = new ScriptedAdapter([]);

async function call(method: string, url: string, cookie?: string, body?: unknown) {
  const r = await app.inject({ method: method as any, url, headers: cookie ? { cookie } : {}, ...(body !== undefined ? { payload: body as any } : {}) });
  return { status: r.statusCode, body: r.headers["content-type"]?.toString().includes("json") ? r.json() : r.body, headers: r.headers };
}
async function register(email: string) {
  const r = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "contraseña-segura", display_name: email.split("@")[0] } });
  const set = r.headers["set-cookie"];
  return String(Array.isArray(set) ? set[0] : set).split(";")[0];
}

describe.skipIf(!URL_)("Pizarra Studio en el servidor", () => {
  let coach = "", other = "", teamId = "";
  const board = (): BoardDoc => {
    const b = createBoard({ own: "F_433", opp: "F_442", title: "Salida" });
    return { ...b, steps: [{ id: "s1", moves: [], pass: { from: "own:GK", to: "own:CB_L", kind: "GROUND", origin: "EXPLICIT" } }] };
  };

  beforeAll(async () => {
    db = createPool(URL_!);
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(db);
    app = await buildApp({ db, llm });
    coach = await register("studio@example.com");
    other = await register("ajeno@example.com");
    teamId = (await call("POST", "/api/teams", coach, { name: "Periso CF", category: "Senior", season_label: "2026/27" })).body.id;
  });
  afterAll(async () => { await app?.close(); await db?.end(); });

  it("crear, leer, actualizar y conflicto de revisión", async () => {
    const item = { id: "board_t1", kind: "BOARD", title: "Salida por fuera", doc: board(), history: [], opponent: "A.D. SPORTING HORTALEZA 'A'", match: 12 };
    const c = await call("POST", `/api/teams/${teamId}/studio/items`, coach, item);
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ id: "board_t1", revision: 1 });
    const list = await call("GET", `/api/teams/${teamId}/studio/items`, coach);
    expect(list.body.map((x: any) => x.id)).toEqual(["board_t1"]);
    expect((await call("GET", "/api/studio/items/board_t1", coach)).body).toMatchObject({ title: "Salida por fuera", match: 12, revision: 1 });
    const u = await call("PUT", "/api/studio/items/board_t1", coach, { ...item, title: "Salida por fuera (v2)", revision: 1 });
    expect(u.status).toBe(200);
    expect(u.body.revision).toBe(2);
    const stale = await call("PUT", "/api/studio/items/board_t1", coach, { ...item, revision: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("conflict");
  });

  it("exporta la pieza como HTML por pasos", async () => {
    const r = await call("GET", "/api/studio/items/board_t1/export.html", coach);
    expect(r.status).toBe(200);
    expect(String(r.headers["content-type"])).toContain("text/html");
    expect(String(r.body)).toContain("Paso 1 de");
  });

  it("quien no es del cuerpo técnico no ve nada", async () => {
    expect((await call("GET", "/api/studio/items/board_t1", other)).status).toBe(404);
    expect((await call("GET", `/api/teams/${teamId}/studio/items`, other)).status).toBe(404);
    expect((await call("DELETE", "/api/studio/items/board_t1", other)).status).toBe(404);
  });

  it("el asistente modifica la pizarra con el mismo bucle que la página", async () => {
    expect((await call("GET", "/api/studio/assistant", coach)).body).toEqual({ available: true });
    llm.requests.length = 0;
    (llm as any).script.push(
      () => ({ blocks: [{ type: "tool_use", id: "t1", name: "apply_commands", input: { commands: [{ op: "board.add_step" }, { op: "board.move", step: "s2", actor: "own:ST", to: { u: 0.5, v: 0.5 }, kind: "RUN" }] } }], stop: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }),
      () => ({ blocks: [{ type: "text", text: "El 9 baja a recibir." }], stop: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }),
    );
    const r = await call("POST", `/api/teams/${teamId}/studio/assistant`, coach, { kind: "BOARD", state: board(), history: [], message: "Que el 9 baje a recibir" });
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe("El 9 baja a recibir.");
    expect(r.body.state.steps).toHaveLength(2);
    expect(JSON.stringify(llm.requests[0].messages[0].content[0])).toContain("PIZARRA");
  });

  it("borrar", async () => {
    expect((await call("DELETE", "/api/studio/items/board_t1", coach)).status).toBe(204);
    expect((await call("GET", "/api/studio/items/board_t1", coach)).status).toBe(404);
  });
});
