import { describe, expect, it } from "vitest";
import { createBoard, createSetPiece, DEFAULT_PITCH, type Player } from "@fcs/engine";
import { boardWorkspace, contextSummary, sceneWorkspace, setPieceWorkspace, SYSTEM_PROMPT } from "@fcs/assistant";

const roster: Player[] = Array.from({ length: 25 }, (_, i) => ({ id: `pl_${i + 1}`, n: i + 1, name: `Jugador${i + 1}`, surname: `Apellido${i + 1}`, pos: i === 0 ? "GK" : "CM", foot: "RIGHT", status: "AVAILABLE" }));

describe("El asistente entiende al entrenador", () => {
  it("la pizarra lleva la tabla quién es quién y cabe en 4 KB", () => {
    const ws = boardWorkspace({ doc: createBoard({ own: "F_433", opp: "F_442" }), roster }, () => {});
    const c = contextSummary(ws);
    expect(c).toContain("pivote");
    expect(c).toContain("own:DM");
    expect(new TextEncoder().encode(c).length).toBeLessThanOrEqual(4096);
  });

  it("resolve_player traduce el pivote al actor de la pizarra", async () => {
    const ws = boardWorkspace({ doc: createBoard({ own: "F_433", opp: "F_442" }), roster }, () => {});
    const r = JSON.parse((await ws.exec("resolve_player", { text: "el pivote" })).content);
    expect(r.actors).toEqual(["own:DM"]);
    expect(r.ambiguous).toBe(false);
  });

  it("si dorsal y puesto no coinciden, avisa de que hay que preguntar", async () => {
    const b = createBoard({ own: "F_433", opp: "F_442" });
    const doc = { ...b, own: { ...b.own, labels: { ...b.own.labels, CM_L: "6", DM: "4" } } };
    const ws = boardWorkspace({ doc, roster }, () => {});
    const r = JSON.parse((await ws.exec("resolve_player", { text: "el 6" })).content);
    expect(r.ambiguous).toBe(true);
    expect(r.note).toMatch(/pregunta al entrenador/);
  });

  it("en escenas y balón parado también existe resolve_player", async () => {
    const sc = sceneWorkspace({ spec: { type: "BUILD_UP", own: { formation: "F_4231" }, opp: { formation: "F_442" }, params: {}, keyframes: [{ t: 0, ball: { holder: "GK" } }] }, roster }, () => {});
    expect(JSON.parse((await sc.exec("resolve_player", { text: "el doble pivote" })).content).slots).toEqual(["DM_L", "DM_R"]);
    expect(contextSummary(sc)).toContain("mediapunta");
    const doc = createSetPiece([{ op: "play.create", type: "CORNER_ATT", side: "LEFT" }], { pitch: DEFAULT_PITCH, roster }).doc;
    const sp = setPieceWorkspace({ doc, type: "CORNER_ATT", roster }, () => {});
    const taker = doc!.actors.find((a) => a.role === "TAKER")!;
    const label = taker.label;
    expect(JSON.parse((await sp.exec("resolve_player", { text: `el ${label}` })).content).actors).toContain(taker.id);
  });

  it("el prompt sabe fútbol", () => {
    expect(SYSTEM_PROMPT).toContain("salida lavolpiana");
    expect(SYSTEM_PROMPT).toContain("board.press");
    expect(SYSTEM_PROMPT).toMatch(/pivote.*6/);
  });
});
