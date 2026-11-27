import { describe, expect, it } from "vitest";
import { canonicalHash, createThrowIn, playTracks, toM, type Command } from "@fcs/engine";
import { ctx, roster } from "./fixtures";

const LONG: Command[] = [{ op: "play.create", type: "THROW_IN_ATT", side: "LEFT", variant: "LONG", distance_m: 18 }];
const SHORT: Command[] = [{ op: "play.create", type: "THROW_IN_ATT", side: "RIGHT", variant: "SHORT", distance_m: 32 }];
const plan = (c: Command[]) => { const r = createThrowIn(c, ctx()); if (!r.doc) throw new Error("sin documento"); return r.doc; };

describe("Saque de banda (THROW_IN_ATT)", () => {
  it("es determinista en las dos variantes", () => {
    expect(canonicalHash(plan(LONG))).toBe(canonicalHash(plan(LONG)));
    expect(canonicalHash(plan(SHORT))).toBe(canonicalHash(plan(SHORT)));
  });

  it("el saque largo va al primer palo con un bloqueo", () => {
    const doc = plan(LONG);
    expect(doc.type).toBe("THROW_IN_ATT");
    expect(doc.delivery.target_zone).toBe("Z_NEAR_POST");
    expect(doc.actors.some((a) => a.team === "OWN" && a.role === "BLOCKER")).toBe(true);
    expect(doc.relations.some((r) => r.type === "SCREENS")).toBe(true);
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("el lanzador está sobre la línea de banda o fuera (LAW-THR-01)", () => {
    for (const doc of [plan(LONG), plan(SHORT)]) {
      const t = doc.actors.find((a) => a.id === doc.delivery.taker_actor)!;
      expect(t.start.v <= 0.01 || t.start.v >= 0.99).toBe(true);
      expect(doc.diagnostics.find((d) => d.rule_id === "LAW-THR-01")).toBeUndefined();
    }
  });

  it("el saque corto encadena tres pases (tercer hombre) y narra cada uno", () => {
    const doc = plan(SHORT);
    expect(doc.passes).toHaveLength(2);
    const tr = playTracks(doc, roster());
    const passSteps = tr.steps.filter((s) => s.source === "RULE:NARR-PASS" || s.source === "RULE:NARR-DELIVERY");
    expect(passSteps).toHaveLength(3);
    for (const st of passSteps) expect(st.title).not.toMatch(/\ba el\b/);
    // El balón termina en el tercer hombre, por delante del punto de saque.
    const last = tr.frames[tr.frames.length - 1];
    const b = { x: last[last.length - 3] * 105, y: last[last.length - 2] * 68 };
    const third = doc.actors.find((a) => a.id === doc.passes![1].to)!;
    const k = doc.actors.indexOf(third);
    expect(Math.hypot(b.x - last[2 * k] * 105, b.y - last[2 * k + 1] * 68)).toBeLessThan(1.5);
    expect(b.x).toBeGreaterThan(toM(doc.delivery.ball_start, doc.pitch).x);
  });
});
