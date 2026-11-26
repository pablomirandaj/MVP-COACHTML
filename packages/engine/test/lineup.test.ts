import { describe, expect, it } from "vitest";
import { applyLineupCommand, emptyLineup, lineupPositions, type Command, type LineupDoc } from "@fcs/engine";
import { caseById, ctx } from "./fixtures";

function applyAll(doc: LineupDoc, cmds: Command[]) {
  let d = doc;
  const c = ctx();
  let last;
  for (const cmd of cmds) {
    if (cmd.op === "lineup.link_match") continue; // vinculación con el partido: la resuelve la API
    last = applyLineupCommand(d, cmd, c);
    d = last.doc;
  }
  return { doc: d, last: last! };
}

function lineupT01(): LineupDoc {
  const cmds = caseById("T-LU-01").expect_ir.map((c: Command) =>
    c.players ? { ...c, players: c.players.map((p: string) => (p === "?" ? "pl_9" : p)) } : c);
  return applyAll(emptyLineup("F_433"), cmds).doc;
}

describe("Motor de alineaciones", () => {
  it("T-LU-01 once completo por grupos con ajuste de posición", () => {
    const doc = lineupT01();
    expect(doc.slots).toEqual(caseById("T-LU-01").expect_doc_after_option_0.slots);
    const diags = applyLineupCommand(doc, { op: "lineup.clear_slot", player: "pl_x_none" }, ctx()).diagnostics;
    expect(diags.map((d) => d.rule_id)).toContain("LINEUP-05");
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    expect(doc.slot_provenance.GK).toBe("EXPLICIT");
    expect(doc.slot_provenance.CB_L).toBe("RULE:LU-POSITION-FIT");
  });

  it("T-LU-02 sustitución simple", () => {
    const r = applyLineupCommand(lineupT01(), { op: "lineup.substitute", out: "pl_7", in: "pl_16" }, ctx());
    expect(r.doc.slots.LB).toBe("pl_16");
    expect(Object.values(r.doc.slots)).not.toContain("pl_7");
  });

  it("T-LU-03 «Cambia a Lucas por Mateo» con ambos titulares pregunta y no cambia nada", () => {
    const before = lineupT01();
    const r = applyLineupCommand(before, { op: "lineup.substitute", out: "pl_7", in: "pl_5" }, ctx());
    expect(r.changed).toBe(false);
    expect(r.doc).toBe(before);
    expect(r.clarifications[0].code).toBe("AMB-OP");
    expect(r.clarifications[0].options.map((o) => o.label)).toEqual(["Intercambiar posiciones de Lucas y Mateo", "Cancelar"]);
  });

  it("T-LU-04 adelantar un poco los extremos (3 m)", () => {
    const r = applyLineupCommand(lineupT01(), { op: "lineup.shift_group", group: "WINGERS", du_m: 3 }, ctx());
    const pos = lineupPositions(r.doc, ctx());
    expect(pos.LW.u).toBe(0.6486);
    expect(pos.RW.u).toBe(0.6486);
    const before = lineupPositions(lineupT01(), ctx());
    for (const s of ["GK", "LB", "CB_L", "CB_R", "RB", "CM_L", "DM", "CM_R", "ST"]) expect(pos[s]).toEqual(before[s]);
  });

  it("T-LU-05 juntar líneas reduce un 15 % la distancia y no mueve al portero", () => {
    const before = lineupT01();
    const r = applyLineupCommand(before, { op: "lineup.compact", axis: "U", factor: 0.85 }, ctx());
    const a = lineupPositions(before, ctx()), b = lineupPositions(r.doc, ctx());
    expect(b.GK).toEqual(a.GK);
    const spread = (p: typeof a) => (p.ST.u - p.CB_L.u) * 105;
    expect(spread(b)).toBeCloseTo(spread(a) * 0.85, 1);
  });

  it("T-LU-08 jugador lesionado: se aplica con aviso", () => {
    const r = applyLineupCommand(emptyLineup("F_433"), { op: "lineup.assign", player: "pl_15", slot: "CB_L" }, ctx());
    expect(r.doc.slots.CB_L).toBe("pl_15");
    expect(r.diagnostics.find((d) => d.rule_id === "LINEUP-04")?.severity).toBe("warning");
  });

  it("T-LU-09 jugador ya alineado en otra posición: pregunta con tres opciones", () => {
    const r = applyLineupCommand(lineupT01(), { op: "lineup.assign", player: "pl_4", slot: "RB" }, ctx());
    expect(r.changed).toBe(false);
    expect(r.clarifications[0].question).toContain("Diego (4) ya juega de central");
    expect(r.clarifications[0].options).toHaveLength(3);
    const forced = applyLineupCommand(lineupT01(), r.clarifications[0].options[0].commands[0], ctx());
    expect(forced.doc.slots.RB).toBe("pl_4");
    expect(forced.doc.slots.CB_R).toBeNull();
  });

  it("T-LU-12 «los extremos» en 4-4-2 ofrece los medios de banda", () => {
    const r = applyLineupCommand(emptyLineup("F_442"), { op: "lineup.shift_group", group: "WINGERS", du_m: 3 }, ctx());
    expect(r.clarifications[0].question).toBe("En este sistema no hay extremos.");
    const opt = r.clarifications[0].options[0];
    expect(opt.commands.map((c) => c.slot)).toEqual(["LM", "RM"]);
  });
});
