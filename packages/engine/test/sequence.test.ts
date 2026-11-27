import { describe, expect, it } from "vitest";
import {
  applyBoardCommand, canonicalHash, computeScene, createBoard, createSetPiece, DEFAULT_PITCH,
  sequenceOfBoard, sequenceOfPlay, sequenceOfScene, sequenceStates, type BoardDoc, type Command, type SceneSpec,
} from "@fcs/engine";
import { ctx, ctxLucasRight, caseById, roster } from "./fixtures";

const run = (doc: BoardDoc, cmds: Command[]) => cmds.reduce((d, c) => applyBoardCommand(d, c).doc, doc);
const corner = () => createSetPiece(caseById("T-CRN-01").expect_ir, ctxLucasRight()).doc!;

describe("Secuencia por pasos (fcs.seq/1)", () => {
  it("córner: colocados, bloqueos, desmarques, golpeo (AHORA) y remate, con números de papel", () => {
    const s = sequenceOfPlay(corner(), roster(), { labels: "ROLE" });
    expect(s.schema).toBe("fcs.seq/1");
    expect(s.view).toBe("HALF");
    const beats = s.frames.map((f) => f.beat);
    expect(beats[0]).toBe("Colocados");
    expect(beats).toEqual(expect.arrayContaining(["Bloqueos", "Golpeo", "Remate"]));
    expect(s.frames.find((f) => f.beat === "Bloqueos")!.blocks!.length).toBeGreaterThan(0);
    expect(s.frames.find((f) => f.beat === "Golpeo")!.trig).toBe(true);
    const own = s.actors.filter((a) => a.team === "OWN");
    expect(own.find((a) => a.kind === "taker")?.label).toBe("S");
    expect(own.filter((a) => a.kind === "back").every((a) => a.label === "C")).toBe(true);
    expect(own.some((a) => a.label === "1")).toBe(true);
    for (const f of s.frames) expect(f.txt.length).toBeGreaterThan(5);
  });

  it("con dorsales, las etiquetas son los dorsales", () => {
    const s = sequenceOfPlay(corner(), roster(), { labels: "DORSAL" });
    expect(s.actors.filter((a) => a.team === "OWN").map((a) => a.label)).toContain("4");
  });

  it("saque corto: tres pases", () => {
    const d = createSetPiece([{ op: "play.create", type: "THROW_IN_ATT", side: "RIGHT", variant: "SHORT", distance_m: 32 }], ctx()).doc!;
    const s = sequenceOfPlay(d, roster());
    expect(s.frames.flatMap((f) => f.passes ?? [])).toHaveLength(3);
  });

  it("escena de presión: el disparador es AHORA y los presionadores son clave y corren", () => {
    const spec: SceneSpec = { type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_442" },
      params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
      keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 1.5, ball: { holder: "CB_R" } }, { t: 3, ball: { holder: "RB" }, event: "TRIGGER" }] };
    const s = sequenceOfScene(computeScene(spec, DEFAULT_PITCH));
    expect(s.view).toBe("FULL");
    const trig = s.frames.find((f) => f.trig)!;
    expect(trig.key).toEqual(expect.arrayContaining(["own:LW", "own:ST"]));
    expect(trig.runs!.length).toBeGreaterThanOrEqual(2);
  });

  it("pizarra: un pase con nota y un paso marcado como AHORA", () => {
    const b = run(createBoard({ own: "F_433", opp: "F_442" }), [
      { op: "board.add_step" }, { op: "board.pass", step: "s1", from: "own:GK", to: "own:CB_L", kind: "GROUND" },
      { op: "board.note", step: "s1", title: "Salimos por el 5", implies: "Atrae a su punta." },
      { op: "board.mark_step", step: "s1", trig: true, key: ["own:CB_L", "own:XX"] },
    ]);
    const s = sequenceOfBoard(b);
    expect(s.frames).toHaveLength(2);
    expect(s.frames[1]).toMatchObject({ beat: "Salimos por el 5", txt: "Atrae a su punta.", trig: true, key: ["own:CB_L"] });
    const [x1, y1] = s.frames[1].passes![0];
    expect([x1, y1]).toEqual(s.start["own:GK"].map((v) => Math.round(v * 100) / 100));
  });

  it("pizarra: sin dorsal, cada uno lleva su número de puesto (el pivote es el 6); con dorsal, el dorsal", () => {
    const b = run(createBoard({ own: "F_433", opp: "F_442" }), [{ op: "board.set_labels", labels: { ST: "19" } }]);
    const lab = Object.fromEntries(sequenceOfBoard(b).actors.filter((a) => a.team === "OWN").map((a) => [a.id, a.label]));
    expect(lab).toMatchObject({ "own:GK": "1", "own:RB": "2", "own:LB": "3", "own:CB_R": "4", "own:CB_L": "5", "own:DM": "6", "own:CM_R": "8", "own:CM_L": "10", "own:RW": "7", "own:LW": "11", "own:ST": "19" });
  });

  it("pizarra vacía: solo la colocación, sin flechas", () => {
    const s = sequenceOfBoard(createBoard({ own: "F_433", opp: "F_442" }));
    expect(s.frames).toHaveLength(1);
    expect(s.frames[0].beat).toBe("Colocados");
    expect(s.frames[0].runs ?? []).toEqual([]);
    expect(sequenceStates(s)).toHaveLength(1);
  });

  it("es determinista y los estados acumulan los cambios", () => {
    const b = run(createBoard({ own: "F_433", opp: "F_442" }), [{ op: "board.add_step" }, { op: "board.move", step: "s1", actor: "own:ST", to: { u: 0.5, v: 0.5 }, kind: "RUN" }]);
    expect(canonicalHash(sequenceOfBoard(b))).toBe(canonicalHash(sequenceOfBoard(b)));
    const st = sequenceStates(sequenceOfBoard(b));
    expect(st[1].pos["own:ST"]).toEqual([52.5, 34]);
    expect(st[1].pos["own:GK"]).toEqual(st[0].pos["own:GK"]);
  });
});
