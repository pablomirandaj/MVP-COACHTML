import { describe, expect, it } from "vitest";
import { createBoard, type BoardDoc, type Player, type SceneSpec } from "@fcs/engine";
import { boardWorkspace, commandErrors, contextSummary, runTurn, sceneWorkspace, ScriptedAdapter, setPieceWorkspace } from "@fcs/assistant";

const roster: Player[] = Array.from({ length: 25 }, (_, i) => ({
  id: `pl_${i + 1}`, n: i + 1, name: `Jugador${i + 1}`, surname: `Apellido${i + 1}`, pos: i === 0 ? "GK" : ["CB", "RB", "LB", "DM", "CM", "RW", "LW", "ST"][i % 8],
  foot: i % 3 ? "RIGHT" : "LEFT", status: "AVAILABLE",
}));

describe("@fcs/assistant — workspaces", () => {
  it("la pizarra aplica comandos válidos y avisa del cambio", async () => {
    let doc: BoardDoc = createBoard({ own: "F_433", opp: "F_442" });
    const ws = boardWorkspace({ doc, roster }, (d) => { doc = d; });
    const out = await ws.exec("apply_commands", { commands: [{ op: "board.add_step" }, { op: "board.move", step: "s1", actor: "own:RB", to: { u: 0.45, v: 0.95 }, kind: "RUN" }] });
    expect(out.is_error).toBeFalsy();
    expect(doc.steps).toHaveLength(1);
    expect(Buffer.byteLength(out.content)).toBeLessThanOrEqual(1024);
  });

  it("un comando inexistente es un error y no cambia nada", async () => {
    let calls = 0;
    const ws = boardWorkspace({ doc: createBoard({ own: "F_433", opp: "F_442" }), roster }, () => { calls++; });
    const out = await ws.exec("apply_commands", { commands: [{ op: "board.fly" }] });
    expect(out.is_error).toBe(true);
    expect(calls).toBe(0);
    expect(commandErrors([{ op: "board.fly" }])).toContain("board.fly");
  });

  it("el contexto con 25 jugadores cabe en 4 KB", () => {
    const ws = boardWorkspace({ doc: createBoard({ own: "F_433", opp: "F_442" }), roster }, () => {});
    expect(Buffer.byteLength(contextSummary(ws))).toBeLessThanOrEqual(4096);
    const sp = setPieceWorkspace({ doc: null, type: "FK_WIDE_ATT", roster, opponent: "Sporting Hortaleza" }, () => {});
    expect(contextSummary(sp)).toContain("Sporting Hortaleza");
  });

  it("el balón parado se crea con create_setpiece y la escena se actualiza con update_scene", async () => {
    let created: unknown = null;
    const sp = setPieceWorkspace({ doc: null, type: "FK_WIDE_ATT", roster }, (d) => { created = d; });
    const r = await sp.exec("create_setpiece", { commands: [{ op: "play.create", type: "FK_WIDE_ATT", side: "RIGHT", depth_m: 18, distance_m: 6 }] });
    expect(r.is_error).toBeFalsy();
    expect((created as any)?.type).toBe("FK_WIDE_ATT");
    let spec: SceneSpec | null = null;
    const sc = sceneWorkspace({ spec: { type: "BUILD_UP", own: { formation: "F_433" }, opp: { formation: "F_442" }, params: {}, keyframes: [{ t: 0, ball: { holder: "GK" } }] }, roster }, (s) => { spec = s; });
    const u = await sc.exec("update_scene", { spec: { type: "BUILD_UP", own: { formation: "F_433" }, opp: { formation: "F_442" }, params: { structure: "3+1", opp_pressers: 2 }, keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 1.5, ball: { holder: "CB_L" } }] } });
    expect(u.is_error).toBeFalsy();
    expect(spec!.params.structure).toBe("3+1");
  });

  it("el bucle ejecuta herramientas hasta que el modelo responde", async () => {
    let doc: BoardDoc = createBoard({ own: "F_433", opp: "F_442" });
    const ws = boardWorkspace({ doc, roster }, (d) => { doc = d; });
    const adapter = new ScriptedAdapter([
      () => ({ blocks: [{ type: "tool_use", id: "t1", name: "apply_commands", input: { commands: [{ op: "board.add_step" }] } }], stop: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } }),
      () => ({ blocks: [{ type: "text", text: "He añadido un paso." }], stop: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } }),
    ]);
    const r = await runTurn(adapter, ws, [], "Añade un paso");
    expect(r.reply).toBe("He añadido un paso.");
    expect(doc.steps).toHaveLength(1);
  });
});
