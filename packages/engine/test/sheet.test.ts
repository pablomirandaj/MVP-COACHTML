import { describe, expect, it } from "vitest";
import { computeScene, createBoard, createSetPiece, DEFAULT_PITCH, proposeSheet, sequenceOfBoard, sequenceOfPlay, sequenceOfScene } from "@fcs/engine";
import { caseById, ctx, ctxLucasRight, roster } from "./fixtures";

describe("Ficha de la jugada", () => {
  it("córner: una fila por número de papel, con el sacador y las vigilancias agrupadas", () => {
    const doc = createSetPiece(caseById("T-CRN-01").expect_ir, ctxLucasRight()).doc!;
    const seq = sequenceOfPlay(doc, roster());
    const s = proposeSheet(seq, { kind: "SETPIECE", doc });
    const who = s.table.map((r) => r[0]);
    expect(who).toContain("S");
    expect(who.some((w) => w.includes("C"))).toBe(true);
    expect(who.filter((w) => /^\d/.test(w)).length).toBeGreaterThanOrEqual(3);
    expect(s.table.find((r) => r[0] === "S")![1]).toMatch(/cerrado|abierto/);
    for (const k of ["subtitle", "hueco", "clave", "riesgo"] as const) expect(s[k].length).toBeGreaterThan(10);
  });

  it("defensa, escena y pizarra también tienen ficha", () => {
    const def = createSetPiece([{ op: "play.create", type: "CORNER_DEF", side: "LEFT", scheme: "MIXED" }], ctx()).doc!;
    expect(proposeSheet(sequenceOfPlay(def, roster()), { kind: "SETPIECE", doc: def }).clave).toMatch(/balón/);
    const sc = computeScene({ type: "BUILD_UP", own: { formation: "F_433" }, opp: { formation: "F_442" }, params: { structure: "3+1", opp_pressers: 2 }, keyframes: [{ t: 0, ball: { holder: "GK" } }] }, DEFAULT_PITCH);
    expect(proposeSheet(sequenceOfScene(sc), { kind: "SCENE", scene: sc }).hueco).toMatch(/libre/);
    const b = createBoard({ own: "F_433", opp: "F_442" });
    expect(proposeSheet(sequenceOfBoard(b), { kind: "BOARD", doc: b }).table).toEqual([]);
  });
});
