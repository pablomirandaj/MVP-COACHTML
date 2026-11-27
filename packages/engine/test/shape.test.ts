import { describe, expect, it } from "vitest";
import { computeScene, DEFAULT_PITCH, narrateScene, slotInfo, type SceneSpec } from "@fcs/engine";

const press: SceneSpec = {
  type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_442" },
  params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
  keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 1.5, ball: { holder: "CB_R" } }, { t: 3, ball: { holder: "RB" }, event: "TRIGGER" }],
};
const M = (p: { u: number; v: number }) => ({ x: p.u * 105, y: p.v * 68 });
const D = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const segDist = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const l = (b.x - a.x) ** 2 + (b.y - a.y) ** 2, t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l || 1)));
  return D(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
};

describe("Colocación con criterio", () => {
  const s = computeScene(press, DEFAULT_PITCH);

  it("SHAPE-03: ningún delantero rival queda a la espalda de nuestra línea", () => {
    for (const f of s.frames) {
      const last = Math.min(...["LB", "CB_L", "CB_R", "RB"].map((k) => M(f.own[k]).x));
      for (const k of ["ST_L", "ST_R"]) expect(M(f.opp[k]).x).toBeGreaterThanOrEqual(last - 0.5);
    }
  });

  it("SHAPE-04: la línea defensiva mide 38 m o menos de lateral a lateral", () => {
    for (const f of s.frames) expect(Math.abs(M(f.own.LB).y - M(f.own.RB).y)).toBeLessThanOrEqual(38 + 1e-6);
  });

  it("PRESS-02: la cobertura tapa el pase interior del rival presionado", () => {
    const f = s.frames[2];
    const covers = Object.entries(f.roles).filter(([, r]) => r === "COVER").map(([k]) => k);
    expect(covers.length).toBeGreaterThan(0);
    const t = M(f.opp.RB);
    const inside = Object.entries(f.opp).filter(([k]) => slotInfo(k).pos !== "GK" && k !== "RB")
      .map(([, p]) => M(p)).filter((p) => Math.abs(p.y - 34) < Math.abs(t.y - 34)).sort((a, b) => D(a, t) - D(b, t))[0];
    expect(covers.some((c) => segDist(M(f.own[c]), t, inside) <= 3)).toBe(true);
  });

  it("la explicación dice quién vigila al mediocentro rival", () => {
    const steps = narrateScene(s);
    const marked = s.frames.findIndex((f) => Object.values(f.roles).includes("MARK"));
    expect(marked).toBeGreaterThanOrEqual(0);
    expect(steps[marked].implies).toMatch(/vigila a su/);
  });

  it("PRESS-03: ningún mediocentro rival queda sin nadie a menos de 8 m", () => {
    for (const f of s.frames) for (const k of ["CM_L", "CM_R"]) {
      const o = M(f.opp[k]);
      expect(Math.min(...Object.values(f.own).map((p) => D(M(p), o)))).toBeLessThanOrEqual(8);
    }
  });
});
