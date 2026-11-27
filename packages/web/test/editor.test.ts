import { describe, expect, it } from "vitest";
import { canonicalHash, createBoard } from "@fcs/engine";
import { editorReducer, initEditor } from "../src/studio/lib/editor";

const board = () => initEditor("BOARD", createBoard({ own: "F_433", opp: "F_442" }), []);

describe("Estado del editor", () => {
  it("aplicar y deshacer vuelve al documento inicial", () => {
    const s0 = board();
    const s1 = editorReducer(s0, { type: "apply", cmds: [{ op: "board.add_step" }], origin: "MANUAL" });
    expect((s1.doc as any).steps).toHaveLength(1);
    expect(s1.canUndo).toBe(true);
    const s2 = editorReducer(s1, { type: "undo" });
    expect(canonicalHash(s2.doc)).toBe(canonicalHash(s0.doc));
    expect(editorReducer(s2, { type: "redo" }).doc).toEqual(s1.doc);
  });

  it("un cambio del asistente con 3 comandos se deshace de una vez", () => {
    const s0 = board();
    const s1 = editorReducer(s0, { type: "apply", origin: "ASSISTANT", cmds: [
      { op: "board.add_step" }, { op: "board.move", step: "s1", actor: "own:RB", to: { u: 0.45, v: 0.95 }, kind: "RUN" },
      { op: "board.pass", step: "s1", from: "own:CB_R", to: "own:RB", kind: "GROUND" },
    ] });
    expect(s1.lastOrigin).toBe("ASSISTANT");
    expect(canonicalHash(editorReducer(s1, { type: "undo" }).doc)).toBe(canonicalHash(s0.doc));
  });

  it("comandos que no validan no cambian el documento y dejan un aviso", () => {
    const s0 = board();
    const s1 = editorReducer(s0, { type: "apply", cmds: [{ op: "board.fly" }], origin: "MANUAL" });
    expect(s1.doc).toBe(s0.doc);
    expect(s1.error).toMatch(/board\.fly/);
    const s2 = editorReducer(s0, { type: "apply", cmds: [{ op: "board.move", step: "s9", actor: "own:RB", to: { u: 0.5, v: 0.5 } }], origin: "MANUAL" });
    expect(s2.doc).toBe(s0.doc);
    expect(s2.error).toMatch(/Paso desconocido/);
  });

  it("un balón parado se crea y se edita con comandos de jugada", () => {
    const roster = [{ id: "p1", n: 7, name: "Ana", pos: "RW", foot: "LEFT" as const, status: "AVAILABLE" as const }];
    let s = initEditor("SETPIECE", null, roster);
    s = editorReducer(s, { type: "apply", cmds: [{ op: "play.create", type: "FK_WIDE_ATT", side: "LEFT", depth_m: 20, distance_m: 6 }], origin: "MANUAL" });
    expect((s.doc as any).type).toBe("FK_WIDE_ATT");
    const t = editorReducer(s, { type: "apply", cmds: [{ op: "play.set_delivery", swing: "OUTSWING" }], origin: "MANUAL" });
    expect((t.doc as any).delivery.swing).toBe("OUTSWING");
  });
});
