import { describe, expect, it } from "vitest";
import { applyPlayCommand, canonicalHash, createDefensiveSetPiece, playTracks, type Command } from "@fcs/engine";
import { ctx, roster } from "./fixtures";

const CRN = (scheme: string): Command[] => [{ op: "play.create", type: "CORNER_DEF", side: "LEFT", scheme }];
const FK: Command[] = [{ op: "play.create", type: "FK_WIDE_DEF", side: "RIGHT", depth_m: 20, distance_m: 6 }];
const plan = (c: Command[], cx = ctx()) => { const r = createDefensiveSetPiece(c, cx); if (!r.doc) throw new Error("sin documento"); return r.doc; };

describe("Balón parado en contra (CORNER_DEF, FK_WIDE_DEF)", () => {
  it("es determinista", () => {
    expect(canonicalHash(plan(CRN("MIXED")))).toBe(canonicalHash(plan(CRN("MIXED"))));
    expect(canonicalHash(plan(FK))).toBe(canonicalHash(plan(FK)));
  });

  it("en mixta hay 3 en zona y el resto de defensores del área al hombre, sin rematadores libres", () => {
    const doc = plan(CRN("MIXED"));
    const own = doc.actors.filter((a) => a.team === "OWN");
    expect(own.filter((a) => a.role === "ZONAL_DEFENDER")).toHaveLength(3);
    const markers = own.filter((a) => a.role === "MAN_MARKER");
    expect(markers.length).toBeGreaterThanOrEqual(4);
    for (const m of markers) expect(doc.relations.some((r) => r.type === "MARKS" && r.a === m.id)).toBe(true);
    expect(own.some((a) => a.role === "GOALKEEPER")).toBe(true);
    expect(own.some((a) => a.role === "COUNTER_OUTLET")).toBe(true);
    expect(doc.diagnostics.find((d) => d.rule_id === "TACTICAL-DEF-01")).toBeUndefined();
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("en zonal el primer palo está cubierto", () => {
    const doc = plan(CRN("ZONAL"));
    expect(doc.actors.filter((a) => a.team === "OWN" && a.role === "MAN_MARKER")).toHaveLength(0);
    expect(doc.diagnostics.find((d) => d.rule_id === "TACTICAL-DEF-02")).toBeUndefined();
  });

  it("en la falta lateral en contra ponemos barrera de 2 y nadie lo deja en línea de gol", () => {
    const doc = plan(FK);
    expect(doc.actors.filter((a) => a.team === "OWN" && a.role === "WALL")).toHaveLength(2);
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("play.mark cambia una marca y su procedencia pasa a EXPLICIT", () => {
    const doc = plan(CRN("MIXED"));
    const rival = doc.actors.filter((a) => a.team === "OPP" && a.role !== "TAKER" && doc.relations.some((r) => r.type === "MARKS" && r.b === a.id))[0];
    const zonal = doc.actors.find((a) => a.team === "OWN" && a.role === "ZONAL_DEFENDER" && a.player_id)!;
    const r = applyPlayCommand(doc, { op: "play.mark", player: zonal.player_id, opponent: rival.id }, ctx());
    expect(r.changed).toBe(true);
    const me = r.doc.actors.find((a) => a.id === zonal.id)!;
    expect(me.role).toBe("MAN_MARKER");
    expect(me.provenance.role).toBe("EXPLICIT");
    expect(r.doc.relations.filter((x) => x.type === "MARKS" && x.b === rival.id).map((x) => x.a)).toEqual([zonal.id]);
  });

  it("la explicación habla de marcas y de la salida a la contra, no de atacar", () => {
    const steps = playTracks(plan(CRN("MIXED")), roster()).steps;
    expect(steps.map((x) => x.source)).toEqual(expect.arrayContaining(["RULE:NARR-SETUP", "RULE:NARR-DELIVERY", "RULE:NARR-MARK", "RULE:NARR-COUNTER"]));
    expect(steps.some((x) => x.source === "RULE:NARR-RUN")).toBe(false);
    expect(steps[0].title).toContain("mixta");
  });

  it("con 5 jugadores avisa de rematadores sin marca en lugar de fallar", () => {
    const five = roster().slice(0, 5);
    const doc = plan(CRN("MIXED"), { ...ctx(), roster: five, lineupPlayerIds: five.map((p) => p.id) });
    expect(doc.diagnostics.find((d) => d.rule_id === "TACTICAL-DEF-01")?.severity).toBe("warning");
    expect(playTracks(doc, five).steps.length).toBeGreaterThan(1);
  });
});
