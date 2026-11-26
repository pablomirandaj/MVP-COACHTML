import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalHash, createCorner, type Command } from "@fcs/engine";
import { caseById, cornerDoc, ctx, ctxLucasRight, examplePath } from "./fixtures";

describe("Córner ofensivo — creación", () => {
  it("T-CRN-01 detecta la contradicción entre la orden y la ficha (Lucas zurdo)", () => {
    const r = createCorner(caseById("T-CRN-01").expect_ir, ctx());
    expect(r.clarifications).toHaveLength(1);
    const c = r.clarifications[0];
    expect(c.code).toBe("AMB-CONFLICT-FACT");
    expect(c.options.map((o) => o.label)).toEqual(caseById("T-CRN-01").expect_clarifications[0].options);
    expect(c.options[0].commands).toEqual([{ op: "player.update", player: "pl_7", dominant_foot: "RIGHT" }]);
  });

  it("T-CRN-02 tras actualizar la ficha produce exactamente la jugada de ejemplo", () => {
    const doc = cornerDoc();
    const example = JSON.parse(readFileSync(examplePath, "utf8"));
    expect(canonicalHash(doc)).toBe(canonicalHash(example));
    const own = doc.actors.filter((a) => a.team === "OWN");
    expect(own).toHaveLength(10);
    expect(own.find((a) => a.role === "BLOCKER")?.player_id).toBe("pl_4");
    expect(own.find((a) => a.role === "PRIMARY_TARGET")?.player_id).toBe("pl_5");
    expect(doc.delivery.target_zone).toBe("Z_FAR_POST");
    expect(doc.delivery.provenance.target_zone).toBe("RULE:BALL-TGT-01");
    expect(own.filter((a) => a.provenance.role.startsWith("RULE:")).map((a) => a.id)).toEqual(["a5", "a6"]);
    expect(doc.diagnostics.filter((d) => d.severity === "error" || d.severity === "warning")).toEqual([]);
    const m2 = doc.movements.find((m) => m.id === "m2")!, m3 = doc.movements.find((m) => m.id === "m3")!;
    expect(m2.t_end).toBeLessThanOrEqual(m3.t_start - 0.3 + 1e-9);
  });

  it("T-CRN-03 simetría: el mismo córner desde la derecha es el reflejo exacto", () => {
    const left = cornerDoc();
    const cmds: Command[] = caseById("T-CRN-01").expect_ir
      .filter((c: Command) => c.op !== "assert")
      .map((c: Command) => (c.op === "play.create" ? { ...c, side: "RIGHT" } : c));
    const right = createCorner(cmds, ctx()).doc!; // Lucas zurdo desde la derecha: cerrado natural
    expect(right.diagnostics.filter((d) => d.severity === "warning")).toEqual([]);
    for (const a of left.actors) {
      const b = right.actors.find((x) => x.id === a.id)!;
      expect(b.player_id ?? null).toBe(a.player_id ?? null);
      expect(b.start.u).toBeCloseTo(a.start.u, 4);
      expect(b.start.v).toBeCloseTo(1 - a.start.v, 3);
    }
  });

  it("T-CRN-04 golpeo cerrado pedido a un zurdo desde la izquierda: aviso técnico", () => {
    const r = createCorner([
      { op: "play.create", type: "CORNER_ATT", side: "LEFT" },
      { op: "play.set_taker", player: "pl_7" },
      { op: "play.set_delivery", swing: "INSWING" },
    ], ctx());
    expect(r.diagnostics.find((d) => d.rule_id === "TECH-SWING-01")?.severity).toBe("warning");
  });

  it("T-CRN-05 instrucción mínima: jugada completa, todo propuesto", () => {
    const r = createCorner([{ op: "play.create", type: "CORNER_ATT", side: "LEFT" }], ctx());
    const own = r.doc!.actors.filter((a) => a.team === "OWN");
    expect(own).toHaveLength(10);
    expect(own.every((a) => a.provenance.role.startsWith("RULE:"))).toBe(true);
    expect(r.clarifications).toEqual([]);
  });

  it("T-CRN-06 sin lado: pregunta y no crea la jugada", () => {
    const r = createCorner([{ op: "play.create", type: "CORNER_ATT" }], ctx());
    expect(r.doc).toBeNull();
    expect(r.clarifications[0].question).toBe("¿Desde qué lado?");
    expect(r.clarifications[0].options.map((o) => o.label)).toEqual(["Izquierda", "Derecha"]);
  });

  it("T-CRN-07 exceso de jugadores: error GEO-02", () => {
    const r = createCorner([
      { op: "play.create", type: "CORNER_ATT", side: "LEFT" },
      { op: "play.add_roles", count: 5, zone: "Z_FAR_POST" },
      { op: "play.add_roles", count: 4, zone: "Z_NEAR_POST" },
      { op: "play.add_roles", count: 2, role: "REST_DEFENDER" },
    ], ctx());
    expect(r.doc).toBeNull();
    expect(r.diagnostics[0]).toMatchObject({ rule_id: "GEO-02", severity: "error" });
    expect(r.clarifications[0].question).toContain("12 jugadores de campo");
  });

  it("T-CRN-08 saque en corto", () => {
    const r = createCorner(caseById("T-CRN-08").expect_ir, ctx());
    const doc = r.doc!;
    expect(doc.delivery).toMatchObject({ trajectory: "SHORT", target_zone: "Z_SHORT" });
    expect(doc.actors.find((a) => a.role === "SHORT_RECEIVER")?.player_id).toBe("pl_10");
  });

  it("asignación: con la ficha corregida, los roles caen en los jugadores más idóneos", () => {
    const doc = createCorner(caseById("T-CRN-01").expect_ir, ctxLucasRight()).doc!;
    const byRole = (r: string) => doc.actors.filter((a) => a.role === r).map((a) => a.player_id);
    expect(byRole("REBOUND")).toEqual(["pl_6", "pl_8"]);
    expect(byRole("REST_DEFENDER")).toEqual(["pl_2", "pl_11"]);
  });
});
