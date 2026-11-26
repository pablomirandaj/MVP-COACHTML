import { describe, expect, it } from "vitest";
import { canonicalHash, computeScene, DEFAULT_PITCH, findSpaces, narrateScene, SPACE_LABEL, type SceneSpec } from "@fcs/engine";

const spec = (target?: "BEHIND_FULLBACK" | "BETWEEN_LINES", side?: "LEFT" | "RIGHT"): SceneSpec => ({
  type: "ATTACK_SPACE", own: { formation: "F_433" }, opp: { formation: "F_442" },
  params: { block_height: "MID", ...(target ? { target } : {}), ...(side ? { target_side: side } : {}) },
  keyframes: [{ t: 0, ball: { holder: "CB_L" } }, { t: 1.5, ball: { holder: "CM_L" } }, { t: 3, ball: { holder: "CM_L" }, event: "TRIGGER" }],
});

describe("Ataque a espacios (ATTACK_SPACE)", () => {
  it("encuentra espacio entre líneas frente a un 4-4-2 en bloque medio", () => {
    const s = computeScene(spec(), DEFAULT_PITCH);
    const spaces = findSpaces(s.frames[0].opp, DEFAULT_PITCH);
    const between = spaces.find((x) => x.kind === "BETWEEN_LINES");
    expect(between?.area_m2).toBeGreaterThan(0);
    for (let i = 1; i < spaces.length; i++) expect(spaces[i - 1].area_m2).toBeGreaterThanOrEqual(spaces[i].area_m2);
  });

  it("con objetivo a la espalda del lateral derecho, termina con un atacante en el espacio y el balón hacia él", () => {
    const s = computeScene(spec("BEHIND_FULLBACK", "RIGHT"), DEFAULT_PITCH);
    expect(s.target_space?.kind).toBe("BEHIND_FULLBACK");
    expect(s.target_space?.side).toBe("RIGHT");
    const last = s.frames[s.frames.length - 1];
    const runner = Object.entries(last.roles).find(([, r]) => r === "RUNNER")![0];
    const p = last.own[runner], r = s.target_space!.rect;
    expect(p.u).toBeGreaterThanOrEqual(r.u[0]); expect(p.u).toBeLessThanOrEqual(r.u[1]);
    expect(p.v).toBeGreaterThanOrEqual(r.v[0]); expect(p.v).toBeLessThanOrEqual(r.v[1]);
    expect(Math.hypot((last.ball.u - p.u) * 105, (last.ball.v - p.v) * 68)).toBeLessThan(1.5);
  });

  it("es determinista", () => {
    expect(canonicalHash(computeScene(spec(), DEFAULT_PITCH))).toBe(canonicalHash(computeScene(spec(), DEFAULT_PITCH)));
  });

  it("cada paso nombra el espacio objetivo", () => {
    const s = computeScene(spec("BETWEEN_LINES"), DEFAULT_PITCH);
    for (const st of narrateScene(s)) expect(st.implies).toContain(SPACE_LABEL.BETWEEN_LINES);
  });
});
