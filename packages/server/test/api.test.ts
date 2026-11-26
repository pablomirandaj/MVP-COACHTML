// Pruebas de integración de la API contra PostgreSQL real.
// Requiere TEST_DATABASE_URL (se borra y recrea el esquema public). Sin ella, la suite se omite.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildApp } from "../src/app";
import { ScriptedAdapter, type LlmResponse } from "../src/assistant/adapter";
import { createPool, type Db } from "../src/db";
import { migrate } from "../src/migrate";

const URL_ = process.env.TEST_DATABASE_URL;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const suite = parse(readFileSync(`${root}docs/engine/tests/command-tests.yaml`, "utf8"));

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
const llm = new ScriptedAdapter([]);

async function call(method: string, url: string, cookie?: string, body?: unknown) {
  const r = await app.inject({ method: method as any, url, headers: cookie ? { cookie } : {}, ...(body !== undefined ? { payload: body as any } : {}) });
  return { status: r.statusCode, body: r.headers["content-type"]?.toString().includes("json") ? r.json() : r.body, headers: r.headers, raw: r.rawPayload };
}
async function register(email: string) {
  const r = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "contraseña-segura", display_name: email.split("@")[0] } });
  expect(r.statusCode).toBe(201);
  const set = r.headers["set-cookie"];
  return String(Array.isArray(set) ? set[0] : set).split(";")[0];
}

describe.skipIf(!URL_)("API (integración con PostgreSQL)", () => {
  let coach = "", other = "", teamId = "", matchId = "", playId = "";
  const ids: Record<string, string> = {};
  const mapIds = (x: any): any => JSON.parse(JSON.stringify(x).replace(/"pl_\d+"/g, (m) => JSON.stringify(ids[m.slice(1, -1)] ?? m.slice(1, -1))));

  beforeAll(async () => {
    db = createPool(URL_!);
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(db);
    app = await buildApp({ db, llm, chromiumPath: process.env.CHROMIUM_PATH });
    coach = await register("javi@example.com");
    other = await register("otro@example.com");
  });
  afterAll(async () => { await app?.close(); await db?.end(); });

  it("autenticación: me, credenciales erróneas, email duplicado, sin sesión", async () => {
    expect((await call("GET", "/api/me", coach)).body.email).toBe("javi@example.com");
    expect((await call("POST", "/api/auth/login", undefined, { email: "javi@example.com", password: "mala" })).status).toBe(401);
    expect((await call("POST", "/api/auth/register", undefined, { email: "javi@example.com", password: "contraseña-segura", display_name: "x" })).status).toBe(409);
    expect((await call("GET", "/api/me")).status).toBe(401);
  });

  it("equipo, plantilla del fixture y dorsal duplicado", async () => {
    const t = await call("POST", "/api/teams", coach, { name: "CD Ejemplo", category: "Senior", season_label: "2026/27" });
    expect(t.status).toBe(201);
    teamId = t.body.id;
    for (const p of suite.fixtures.roster) {
      const r = await call("POST", `/api/teams/${teamId}/players`, coach, {
        first_name: p.name, last_name: p.surname, shirt_number: p.n, primary_position: p.pos, secondary_positions: p.secondary ?? [],
        dominant_foot: p.foot, height_cm: p.height ?? null, status: p.status,
        attributes: Object.fromEntries((p.tags ?? []).map((k: string) => [k, 3])), setpiece_roles: p.setpiece ?? [],
      });
      expect(r.status).toBe(201);
      ids[p.id] = r.body.id;
    }
    expect((await call("GET", `/api/teams/${teamId}/players`, coach)).body).toHaveLength(15);
    const dup = await call("POST", `/api/teams/${teamId}/players`, coach, { first_name: "X", primary_position: "CM", shirt_number: 7 });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("SHIRT_TAKEN");
  });

  it("aislamiento entre equipos: otro usuario recibe 404", async () => {
    expect((await call("GET", `/api/teams/${teamId}`, other)).status).toBe(404);
    expect((await call("GET", `/api/teams/${teamId}/players`, other)).status).toBe(404);
  });

  it("calendario: importación CSV en dos fases", async () => {
    const csv = "Jornada;Fecha;Hora;Local;Visitante;Campo\n1;04/10/2026;11:30;CD Ejemplo;UD Rival;Municipal\n2;11/10/2026;17:00;Atlético Norte;CD Ejemplo;Norte\n3;18/10/2026;;Descansa;CD Ejemplo;\n";
    const pre = await call("POST", `/api/teams/${teamId}/calendar/import`, coach, { csv });
    expect(pre.status).toBe(200);
    expect(pre.body.rows.map((r: any) => [r.matchday, r.opponent, r.is_home, r.bye])).toEqual([[1, "UD Rival", true, false], [2, "Atlético Norte", false, false], [3, null, null, true]]);
    expect(pre.body.rows[0].kickoff_at).toBe("2026-10-04T09:30:00.000Z"); // 11:30 en Madrid (CEST)
    const com = await call("POST", `/api/teams/${teamId}/calendar/import`, coach, { csv, commit: true });
    expect(com.body).toEqual({ created: 3, skipped: 0 });
    const matches = (await call("GET", `/api/teams/${teamId}/matches`, coach)).body;
    expect(matches).toHaveLength(3);
    matchId = matches[0].id;
    expect(matches[2].status).toBe("BYE");
  });

  it("alineación por comandos (T-LU-01) y confirmación", async () => {
    const cmds = mapIds(suite.cases.find((c: any) => c.id === "T-LU-01").expect_ir.filter((c: any) => c.op !== "lineup.link_match"))
      .map((c: any) => (c.players ? { ...c, players: c.players.map((p: string) => (p === "?" ? ids.pl_9 : p)) } : c));
    const r = await call("POST", `/api/matches/${matchId}/lineup/commands`, coach, { commands: cmds });
    expect(r.status).toBe(200);
    expect(r.body.applied).toBe(true);
    const expected = mapIds(suite.cases.find((c: any) => c.id === "T-LU-01").expect_doc_after_option_0.slots);
    expect(r.body.lineup.doc.slots).toEqual(expected);
    const amb = await call("POST", `/api/matches/${matchId}/lineup/commands`, coach, { commands: [{ op: "lineup.substitute", out: ids.pl_7, in: ids.pl_5 }] });
    expect(amb.body.applied).toBe(false);
    expect(amb.body.clarifications[0].code).toBe("AMB-OP");
    const conf = await call("POST", `/api/matches/${matchId}/lineup/confirm`, coach);
    expect(conf.body.lineup.state).toBe("PUBLISHED");
  });

  it("córner: aclaración de ficha, creación, edición, deshacer y rehacer de varios niveles", async () => {
    const commands = mapIds(suite.cases.find((c: any) => c.id === "T-CRN-01").expect_ir);
    const first = await call("POST", `/api/teams/${teamId}/plays`, coach, { commands, match_id: matchId });
    expect(first.body.created).toBe(false);
    expect(first.body.clarifications[0].code).toBe("AMB-CONFLICT-FACT");
    expect((await call("PATCH", `/api/players/${ids.pl_7}`, coach, { dominant_foot: "RIGHT", via: "CLARIFICATION" })).status).toBe(200);
    const created = await call("POST", `/api/teams/${teamId}/plays`, coach, { commands, match_id: matchId });
    expect(created.status).toBe(201);
    playId = created.body.play.id;
    const v1 = created.body.play;
    expect(v1.current_version).toBe(1);
    expect(v1.document.actors.filter((a: any) => a.team === "OWN")).toHaveLength(10);
    expect(v1.document.actors.find((a: any) => a.role === "BLOCKER").player_id).toBe(ids.pl_4);
    expect(v1.can_undo).toBe(false);

    const e1 = await call("POST", `/api/plays/${playId}/commands`, coach, { base_version: 1, commands: [{ op: "play.move_actor", target: { zone: "Z_FAR_POST", expect_count: 2 }, dy_m: -1 }] });
    expect(e1.body.applied).toBe(true);
    const e2 = await call("POST", `/api/plays/${playId}/commands`, coach, { base_version: 2, commands: [{ op: "play.shift_timing", target: { role: "BLOCKER" }, delta_s: -0.5 }] });
    expect(e2.body.play.current_version).toBe(3);
    const stale = await call("POST", `/api/plays/${playId}/commands`, coach, { base_version: 2, commands: [{ op: "play.shift_timing", target: { role: "BLOCKER" }, delta_s: -0.5 }] });
    expect(stale.status).toBe(409);
    const clar = await call("POST", `/api/plays/${playId}/commands`, coach, { base_version: 3, commands: [{ op: "play.move_actor", target: { role: "REBOUND", expect_count: 1 }, dx_m: -3 }] });
    expect(clar.body.applied).toBe(false);
    expect(clar.body.clarifications[0].options).toHaveLength(3);

    const hash = async (v: number) => (await db.query("SELECT document_hash FROM tactical_play_version WHERE play_id = $1 AND version = $2", [playId, v])).rows[0].document_hash;
    const u1 = await call("POST", `/api/plays/${playId}/undo`, coach);
    expect(u1.body.current_version).toBe(4);
    expect(await hash(4)).toBe(await hash(2));
    const u2 = await call("POST", `/api/plays/${playId}/undo`, coach);
    expect(await hash(u2.body.current_version)).toBe(await hash(1));
    expect(u2.body.can_undo).toBe(false);
    expect((await call("POST", `/api/plays/${playId}/undo`, coach)).status).toBe(409);
    const r1 = await call("POST", `/api/plays/${playId}/redo`, coach);
    expect(await hash(r1.body.current_version)).toBe(await hash(2));
    const r2 = await call("POST", `/api/plays/${playId}/redo`, coach);
    expect(await hash(r2.body.current_version)).toBe(await hash(3));
    expect(r2.body.can_redo).toBe(false);

    const html = await call("GET", `/api/plays/${playId}/export.html`, coach);
    expect(html.status).toBe(200);
    expect(String(html.body)).toContain("<svg id=\"pitch\"");
    expect((await call("GET", `/api/plays/${playId}`, other)).status).toBe(404);
  });

  it("escenas de fases: crear con dorsales del once, validar referencias y exportar", async () => {
    const spec = { type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_433" }, params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }] },
      keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 2, ball: { holder: "RB" }, event: "TRIGGER", note: "¡Salta Hugo!" }] };
    const r = await call("POST", `/api/teams/${teamId}/scenes`, coach, { name: "Presión alta", match_id: matchId, spec });
    expect(r.status).toBe(201);
    expect(r.body.document.own_labels.LW).toBe("11"); // Hugo, del once del partido
    const bad = await call("POST", `/api/teams/${teamId}/scenes`, coach, { name: "Mal", spec: { ...spec, params: { jumps: [{ who: "XX", to: "RB" }] } } });
    expect(bad.status).toBe(422);
    const html = await call("GET", `/api/scenes/${r.body.id}/export.html`, coach);
    expect(String(html.body)).toContain("¡Salta Hugo!");
  });

  it("charla: guion por defecto, edición y PDF", async () => {
    await call("PUT", `/api/matches/${matchId}/analysis`, coach, { items: [
      { category: "PRESSING", text: "Presiona mucho por fuera" }, { category: "WEAKNESS", text: "Su lateral izquierdo deja espacio a la espalda" },
    ] });
    const g = await call("GET", `/api/matches/${matchId}/presentation`, coach);
    const enabled = g.body.outline.filter((e: any) => e.enabled).map((e: any) => e.key);
    expect(enabled).toEqual(["context", "lineup", "opponent", "exploit", "setpieces", "phases"]);
    const outline = g.body.outline.map((e: any) => (e.key === "final" ? { ...e, enabled: true, text: "¡A por ellos!" } : e));
    expect((await call("PUT", `/api/matches/${matchId}/presentation`, coach, { outline, revision: 0 })).body.revision).toBe(1);
    expect((await call("PUT", `/api/matches/${matchId}/presentation`, coach, { outline, revision: 0 })).status).toBe(409);
    const html = String((await call("GET", `/api/matches/${matchId}/presentation.html`, coach)).body);
    for (const s of ["UD Rival", "Nuestra alineación", "Presiona mucho por fuera", "Lo que debemos aprovechar", "¡A por ellos!", "Presión alta"]) expect(html).toContain(s);
    expect(html).not.toContain("Lo que debemos evitar"); // sin contenido: desactivada
    if (process.env.CHROMIUM_PATH) {
      const pdf = await call("GET", `/api/matches/${matchId}/presentation.pdf`, coach);
      expect(pdf.status).toBe(200);
      expect(pdf.raw.subarray(0, 4).toString()).toBe("%PDF");
    }
  });

  it("asistente: crea un córner, corrige un comando inválido, edita y pregunta cuando hay ambigüedad", async () => {
    const tool = (name: string, input: unknown, id = name): LlmResponse => ({ blocks: [{ type: "tool_use", id, name, input }], stop: "tool_use", usage: { input_tokens: 100, output_tokens: 20 } });
    const say = (text: string): LlmResponse => ({ blocks: [{ type: "text", text }], stop: "end_turn", usage: { input_tokens: 100, output_tokens: 10 } });
    const createCmds = [{ op: "play.create", type: "CORNER_ATT", side: "RIGHT" }, { op: "play.set_taker", player: ids.pl_7 }];
    llm["script"].push(
      () => tool("create_corner", { commands: [{ op: "play.create", type: "CORNER_ATT", side: "ARRIBA" }] }, "t1"), // inválido: el esquema lo rechaza
      (req) => { const last = req.messages[req.messages.length - 1].content[0] as any; expect(last.is_error).toBe(true); return tool("create_corner", { commands: createCmds }, "t2"); },
      () => say("He creado un córner desde la derecha con Lucas de lanzador."),
    );
    const t1 = await call("POST", "/api/assistant/turns", coach, { target_type: "NEW_PLAY", target_id: teamId, match_id: matchId, message: "Córner desde la derecha, lo saca Lucas" });
    expect(t1.status).toBe(200);
    expect(t1.body.changed).toBe(true);
    expect(t1.body.target.type).toBe("PLAY");
    const newPlay = t1.body.target.id;
    // El contexto llevaba la plantilla real y el prompt de sistema es estable (cacheable).
    expect(JSON.stringify(llm.requests[0].messages)).toContain(ids.pl_7);
    expect(llm.requests[0].system).toBe(llm.requests[1].system);

    llm["script"].push(
      () => tool("apply_commands", { commands: [{ op: "play.shift_timing", target: { role: "DECOY" }, delta_s: -0.5 }] }),
      () => say("Hecho."),
    );
    const before = (await call("GET", `/api/plays/${newPlay}`, coach)).body.current_version;
    const t2 = await call("POST", "/api/assistant/turns", coach, { target_type: "PLAY", target_id: newPlay, message: "Que el arrastre empiece antes" });
    expect(t2.body.changed).toBe(true);
    const after = (await call("GET", `/api/plays/${newPlay}`, coach)).body;
    expect(after.current_version).toBe(before + 1);
    expect(after.can_undo).toBe(true); // el entrenador puede deshacer lo que hizo el asistente

    llm["script"].push(() => tool("ask_coach", { question: "¿Qué jugador del rechace?", options: ["Sergio (6)", "Adrián (8)"] }));
    const t3 = await call("POST", "/api/assistant/turns", coach, { target_type: "PLAY", target_id: newPlay, message: "Retrasa al del rechace" });
    expect(t3.body.changed).toBe(false);
    expect(t3.body.clarification).toEqual({ question: "¿Qué jugador del rechace?", options: ["Sergio (6)", "Adrián (8)"] });

    expect((await call("POST", "/api/assistant/turns", other, { target_type: "PLAY", target_id: newPlay, message: "hola" })).status).toBe(404);
  });
});
