import { describe, expect, it } from "vitest";
import { canonicalHash, computeScene, DEFAULT_PITCH, narrateScene, type SceneSpec } from "@fcs/engine";

const spec = (structure: "2+1" | "3+1" | "FB_INSIDE", pressers: 1 | 2 | 3): SceneSpec => ({
  type: "BUILD_UP", own: { formation: "F_433" }, opp: { formation: "F_442" },
  params: { structure, opp_pressers: pressers, progress_to: "DM" },
  keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 1.5, ball: { holder: "CB_L" } }, { t: 3, ball: { holder: "DM" } }],
});
const X = (p: { u: number }) => p.u * 105;

describe("Salida de balón (BUILD_UP)", () => {
  it("es determinista", () => {
    expect(canonicalHash(computeScene(spec("3+1", 2), DEFAULT_PITCH))).toBe(canonicalHash(computeScene(spec("3+1", 2), DEFAULT_PITCH)));
  });

  it("3+1 contra dos puntas: tres en la línea de salida y un hombre libre", () => {
    const s = computeScene(spec("3+1", 2), DEFAULT_PITCH);
    const f = s.frames[0];
    const line = ["CB_L", "DM", "CB_R"].map((k) => X(f.own[k]));
    expect(Math.max(...line) - Math.min(...line)).toBeLessThanOrEqual(3);
    expect(Object.values(f.roles)).toContain("FREE_MAN");
    expect(s.diagnostics.find((d) => d.rule_id === "BUILD-01")).toBeUndefined();
  });

  it("2+1 contra tres que presionan: la presión iguala la salida (BUILD-01)", () => {
    const s = computeScene(spec("2+1", 3), DEFAULT_PITCH);
    expect(s.diagnostics.find((d) => d.rule_id === "BUILD-01")?.severity).toBe("warning");
  });

  it("los pasos nombran al hombre libre", () => {
    const s = computeScene(spec("3+1", 2), DEFAULT_PITCH);
    const steps = narrateScene(s);
    const free = Object.entries(s.frames[0].roles).find(([, r]) => r === "FREE_MAN")![0];
    expect(steps[0].title).toContain(s.own_labels[free]);
  });
});
