import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeScene, DEFAULT_PITCH, sceneTracks, type SceneSpec } from "@fcs/engine";
import { renderTracksHtml } from "@fcs/render";

const spec: SceneSpec = {
  type: "PRESS_OWN", own: { formation: "F_433" }, opp: { formation: "F_433" },
  params: { block_height: "HIGH", jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }] },
  keyframes: [{ t: 0, ball: { holder: "GK" } }, { t: 1.5, ball: { holder: "CB_R" } }, { t: 3, ball: { holder: "RB" }, event: "TRIGGER" }],
};
const tracks = sceneTracks(computeScene(spec, DEFAULT_PITCH), "Presión alta");
const html = renderTracksHtml(tracks, { teamColor: "#1f9d55", teamInk: "#0b0f0c", meta: { team: "Periso CF", match: "Jornada 12", opponent: "Sporting Hortaleza" } });
const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

describe("Reproductor HTML por pasos", () => {
  it("lista cada paso con su explicación y la cabecera del partido", () => {
    expect(html).toContain("Paso 1 de 3");
    for (const s of tracks.steps) expect(html).toContain(s.title.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
    expect(html).toContain("Sporting Hortaleza");
  });

  it("es autónomo y ligero", () => {
    expect(Buffer.byteLength(html)).toBeLessThan(300_000);
    expect(html).not.toMatch(/src="http|href="http|@import/);
  });

  it.skipIf(!existsSync(CHROME))("en un móvil no se desborda y avanza de paso", async () => {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: CHROME });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(html);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.click("#next");
      expect(await page.getAttribute("#steps li:nth-child(2)", "aria-current")).toBe("step");
    } finally { await browser.close(); }
  }, 30_000);
});
