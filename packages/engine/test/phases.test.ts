import { describe, expect, it } from "vitest";
import { canonicalHash, computeScene, DEFAULT_PITCH, sceneTracks, type SceneSpec } from "@fcs/engine";
import { renderTracksHtml } from "@fcs/render";

const press: SceneSpec = {
  type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_433" },
  params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
  keyframes: [
    { t: 0, ball: { holder: "GK" } },
    { t: 1.5, ball: { holder: "CB_R" } },
    { t: 3, ball: { holder: "RB" }, event: "TRIGGER" },
  ],
};
const m = (p: { u: number; v: number }) => ({ x: p.u * 105, y: p.v * 68 });
const d = (a: { u: number; v: number }, b: { u: number; v: number }) => Math.hypot(m(a).x - m(b).x, m(a).y - m(b).y);

describe("Escenas de fases de juego", () => {
  it("es determinista", () => {
    expect(canonicalHash(computeScene(press, DEFAULT_PITCH))).toBe(canonicalHash(computeScene(press, DEFAULT_PITCH)));
  });

  it("antes del disparador no salta nadie y la línea defensiva está alineada (SHAPE-02)", () => {
    const s = computeScene(press, DEFAULT_PITCH);
    expect(s.frames[0].roles).toEqual({});
    const def = ["LB", "CB_L", "CB_R", "RB"].map((k) => m(s.frames[0].own[k]).x);
    expect(Math.max(...def) - Math.min(...def)).toBeLessThanOrEqual(2);
    expect(s.diagnostics.find((x) => x.rule_id === "SHAPE-02")).toBeUndefined();
  });

  it("en el disparador el extremo presiona al lateral a 1,5 m y el 9 tapa el pase al portero", () => {
    const f = computeScene(press, DEFAULT_PITCH).frames[2];
    expect(f.roles.LW).toBe("PRESSER");
    expect(d(f.own.LW, f.opp.RB)).toBeCloseTo(1.5, 1);
    // El 9 queda en la línea central–portero, a 2 m del central.
    expect(d(f.own.ST, f.opp.CB_R)).toBeCloseTo(2, 1);
    expect(d(f.own.ST, f.opp.GK) + d(f.own.ST, f.opp.CB_R)).toBeCloseTo(d(f.opp.CB_R, f.opp.GK), 1);
    expect(Object.values(f.roles)).toContain("COVER");
  });

  it("el bloque bascula hacia el lado del balón", () => {
    const s = computeScene({ ...press, type: "RETREAT", params: { block_height: "LOW" }, keyframes: [
      { t: 0, ball: { holder: "LW" } }, { t: 2, ball: { holder: "RW" } },
    ] }, DEFAULT_PITCH);
    const meanY = (f: (typeof s.frames)[0]) => Object.values(f.own).reduce((a, p) => a + p.v, 0) / 11;
    // Su extremo izquierdo ataca por nuestra derecha (y alta) y su derecho por nuestra izquierda.
    expect(meanY(s.frames[0])).toBeGreaterThan(meanY(s.frames[1]));
  });

  it("presión rival: es nuestra presión vista desde el rival, reflejada", () => {
    const opp = computeScene({ ...press, type: "PRESS_OPP" }, DEFAULT_PITCH);
    const own = computeScene(press, DEFAULT_PITCH);
    const a = opp.frames[2].opp.LW, b = own.frames[2].own.LW;
    expect(a.u).toBeCloseTo(1 - b.u, 3);
    expect(a.v).toBeCloseTo(1 - b.v, 3);
  });

  it("vigilancias: rivales arriba + 1, cada vigilante por detrás de su referencia", () => {
    const s = computeScene({ type: "REST_DEFENSE", own: { formation: "F_433" }, opp: { formation: "F_433" },
      params: { opp_staying: ["ST", "LW"] }, keyframes: [{ t: 0, ball: { holder: "RW" } }] }, DEFAULT_PITCH);
    const roles = s.frames[0].roles;
    expect(Object.values(roles).filter((r) => r.startsWith("REST")).length).toBe(3);
    for (const [slot, role] of Object.entries(roles)) {
      if (role !== "REST_MARKER") continue;
      const mine = m(s.frames[0].own[slot]);
      expect(Math.min(m(s.frames[0].opp.ST).x, m(s.frames[0].opp.LW).x)).toBeGreaterThan(mine.x);
    }
    const fewer = computeScene({ type: "REST_DEFENSE", own: { formation: "F_433" }, opp: { formation: "F_433" },
      params: { opp_staying: ["ST", "LW"], rest_count: 2 }, keyframes: [{ t: 0, ball: { holder: "RW" } }] }, DEFAULT_PITCH);
    expect(fewer.diagnostics.find((x) => x.rule_id === "REST-01")?.severity).toBe("warning");
  });

  it("el HTML exportado es autónomo y reproducible", () => {
    const html = renderTracksHtml(sceneTracks(computeScene(press, DEFAULT_PITCH)));
    expect(html).toBe(renderTracksHtml(sceneTracks(computeScene(press, DEFAULT_PITCH))));
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\/(?!www\.w3\.org)/);
  });
});
