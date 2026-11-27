import { afterEach, describe, expect, it } from "vitest";
import { createServerHost } from "../src/studio/hosts/server";

// fetch simulado: equipo, partidos y jugadores de un servidor con otro equipo (no el Periso).
function fakeApi() {
  const players: any[] = [{ id: "11111111-1111-1111-1111-111111111111", first_name: "Ana", last_name: "Gil", shirt_number: 1, primary_position: "GK", secondary_positions: [], dominant_foot: "RIGHT", status: "AVAILABLE", attributes: {}, setpiece_roles: [] }];
  const calls: string[] = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const method = init.method ?? "GET", path = url.replace(/^\/api/, "");
    calls.push(`${method} ${path}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (path === "/teams/t1") return json({ id: "t1", name: "CD Ejemplo", category: "Senior", season_label: "2026/27" });
    if (path === "/teams/t1/matches") return json([{ id: "m1", matchday: 3, kickoff_at: "2026-12-06T10:30:00.000Z", is_home: false, opponent: "UD Rival", venue: "Norte", status: "SCHEDULED" }]);
    if (path === "/teams/t1/players" && method === "GET") return json(players);
    if (path === "/teams/t1/players" && method === "POST") { const b = JSON.parse(init.body); const p = { ...b, id: `2222222${players.length}-2222-2222-2222-222222222222`, secondary_positions: [], status: "AVAILABLE", attributes: {}, setpiece_roles: [] }; players.push(p); return json(p, 201); }
    if (path.startsWith("/players/") && method === "PATCH") return json({});
    return json({ code: "NOT_FOUND" }, 404);
  };
  return { calls, players };
}

describe("Anfitrión servidor", () => {
  afterEach(() => { delete (globalThis as any).fetch; });

  it("usa el equipo y el calendario del servidor, no el instantáneo del Periso", async () => {
    fakeApi();
    const host = createServerHost("t1");
    await host.team.load?.();
    expect(host.team.team().name).toBe("CD Ejemplo");
    expect(host.team.fixtures()).toEqual([expect.objectContaining({ jornada: 3, rival: "UD Rival", condicion: "Fuera", fecha: "2026-12-06", hora: "11:30" })]);
    expect(host.team.standings()).toEqual([]);
  });

  it("guardar la plantilla dos veces no duplica jugadores", async () => {
    const api = fakeApi();
    const host = createServerHost("t1");
    const roster = await host.team.roster();
    const withNew = [...roster, { id: "pl_9_raul_1", n: 9, name: "Raúl", surname: "Somavilla", pos: "ST", foot: "LEFT" as const, status: "AVAILABLE" as const }];
    const saved = await host.team.saveRoster(withNew);
    expect(saved.every((p) => !p.id.startsWith("pl_"))).toBe(true);
    await host.team.saveRoster(saved);
    expect(api.players).toHaveLength(2);
    expect(api.calls.filter((c) => c === "POST /teams/t1/players")).toHaveLength(1);
  });
});
