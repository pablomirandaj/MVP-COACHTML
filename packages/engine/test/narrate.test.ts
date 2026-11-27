import { describe, expect, it } from "vitest";
import { canonicalHash, computeScene, DEFAULT_PITCH, narratePlay, narrateScene, playTracks, sceneTracks, type SceneSpec } from "@fcs/engine";
import { cornerDoc, roster } from "./fixtures";

const press: SceneSpec = {
  type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_433" },
  params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
  keyframes: [
    { t: 0, ball: { holder: "GK" } },
    { t: 1.5, ball: { holder: "CB_R" } },
    { t: 3, ball: { holder: "RB" }, event: "TRIGGER" },
  ],
};

describe("Explicación por pasos", () => {
  it("en un córner narra el bloqueo y el golpeo", () => {
    const doc = cornerDoc();
    const steps = narratePlay(doc, roster());
    const block = steps.find((s) => s.title.includes("bloquea"));
    expect(block?.source).toBe("RULE:NARR-BLOCK");
    const kick = steps.find((s) => s.source === "RULE:NARR-DELIVERY");
    expect(kick?.t).toBe(0);
    for (const s of steps) expect(s.implies.length).toBeGreaterThan(10);
    expect(steps.map((s) => s.t)).toEqual([...steps.map((s) => s.t)].sort((a, b) => a - b));
  });

  it("en la presión, el disparador dice quién presiona y quién cubre", () => {
    const scene = computeScene(press, DEFAULT_PITCH);
    const steps = narrateScene(scene);
    expect(steps).toHaveLength(3);
    const trig = steps[2];
    expect(trig.title).toContain("presiona");
    const coverSlot = Object.entries(scene.frames[2].roles).find(([, r]) => r === "COVER")![0];
    expect(trig.implies).toContain(scene.own_labels[coverSlot]);
  });

  it("una nota manual sustituye a la generada", () => {
    const spec: SceneSpec = { ...press, keyframes: press.keyframes.map((k, i) => (i === 1 ? { ...k, note: "Saltamos cuando el central toca hacia fuera" } : k)) };
    const steps = narrateScene(computeScene(spec, DEFAULT_PITCH));
    expect(steps[1].title).toBe("Saltamos cuando el central toca hacia fuera");
    expect(steps[1].source).toBe("MANUAL");
  });

  it("la frase de lo que implica también se puede escribir a mano", () => {
    const spec: SceneSpec = { ...press, keyframes: press.keyframes.map((k, i) => (i === 2 ? { ...k, note: "¡Ahora!", implies: "Saltan los tres a la vez." } : k)) };
    const steps = narrateScene(computeScene(spec, DEFAULT_PITCH));
    expect(steps[2]).toMatchObject({ title: "¡Ahora!", implies: "Saltan los tres a la vez.", source: "MANUAL" });
  });

  it("es determinista y las pistas llevan los pasos", () => {
    const scene = computeScene(press, DEFAULT_PITCH);
    expect(canonicalHash(narrateScene(scene))).toBe(canonicalHash(narrateScene(scene)));
    expect(sceneTracks(scene).steps).toHaveLength(3);
    expect(playTracks(cornerDoc(), roster()).steps.length).toBeGreaterThan(2);
  });
});
