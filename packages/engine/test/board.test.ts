import { describe, expect, it } from "vitest";
import { applyBoardCommand, boardTracks, canonicalHash, createBoard, record, startHistory, undo, type BoardDoc, type Command } from "@fcs/engine";
import { roster } from "./fixtures";

const run = (doc: BoardDoc, cmds: Command[]) => cmds.reduce((d, c) => applyBoardCommand(d, c).doc, doc);
const base = () => createBoard({ own: "F_433", opp: "F_442", title: "Salida por fuera" });

describe("Pizarra libre (fcs.board/1)", () => {
  it("coloca a los 22 jugadores y el balón", () => {
    const b = base();
    expect(Object.keys(b.start.own)).toHaveLength(11);
    expect(Object.keys(b.start.opp)).toHaveLength(11);
    expect(b.start.ball.u).toBeGreaterThan(0);
    expect(b.schema).toBe("fcs.board/1");
  });

  it("añadir un paso, mover y pasar, y deshacerlo todo vuelve al estado inicial", () => {
    const b0 = base();
    let h = startHistory(b0);
    const cmds: Command[] = [
      { op: "board.add_step" },
      { op: "board.move", step: "s1", actor: "own:RB", to: { u: 0.45, v: 0.95 }, kind: "RUN" },
      { op: "board.pass", step: "s1", from: "own:CB_R", to: "own:RB", kind: "GROUND" },
    ];
    for (const c of cmds) h = record(h, [c], applyBoardCommand(h.doc, c).doc);
    expect(h.doc.steps).toHaveLength(1);
    expect(h.doc.steps[0].pass?.to).toBe("own:RB");
    for (let i = 0; i < cmds.length; i++) h = undo(h);
    expect(canonicalHash(h.doc)).toBe(canonicalHash(b0));
  });

  it("un pase que cruza a un rival avisa del riesgo de pérdida (BOARD-03)", () => {
    const b = base();
    const r = applyBoardCommand(run(b, [{ op: "board.add_step" }]), { op: "board.pass", step: "s1", from: "own:CB_L", to: "own:ST", kind: "GROUND" });
    expect(r.diagnostics.find((d) => d.rule_id === "BOARD-03")?.severity).toBe("warning");
  });

  it("un punto fuera del campo se ajusta al límite y avisa (BOARD-01)", () => {
    const r = applyBoardCommand(run(base(), [{ op: "board.add_step" }]), { op: "board.move", step: "s1", actor: "own:LW", to: { u: 0.7, v: -0.3 }, kind: "RUN" });
    const mv = r.doc.steps[0].moves[0];
    expect(mv.to.v).toBeGreaterThanOrEqual(0);
    expect(r.diagnostics.find((d) => d.rule_id === "BOARD-01")?.severity).toBe("error");
  });

  it("las pistas tienen un paso narrado por paso de la pizarra", () => {
    const d = run(base(), [
      { op: "board.add_step" }, { op: "board.pass", step: "s1", from: "own:GK", to: "own:CB_L", kind: "GROUND" },
      { op: "board.add_step" }, { op: "board.move", step: "s2", actor: "own:CM_L", to: { u: 0.3, v: 0.3 }, kind: "RUN" },
      { op: "board.note", step: "s2", title: "El 8 se ofrece entre líneas", implies: "Atrae al mediocentro rival." },
    ]);
    const t = boardTracks(d, roster());
    expect(t.steps).toHaveLength(2);
    expect(t.steps[0].source).toBe("RULE:NARR-BOARD");
    expect(t.steps[0].title).toBe("El POR pasa al DFC");
    expect(t.actors.find((a) => a.id === "opp:CB_L")?.label).toBe("DFC");
    expect(t.steps[1]).toMatchObject({ title: "El 8 se ofrece entre líneas", source: "MANUAL" });
    expect(t.actors).toHaveLength(22);
  });

  it("es determinista", () => {
    const cmds: Command[] = [{ op: "board.add_step" }, { op: "board.press", step: "s1", actor: "own:ST", target: "opp:CB_L" }];
    expect(canonicalHash(run(base(), cmds))).toBe(canonicalHash(run(base(), cmds)));
  });
});
