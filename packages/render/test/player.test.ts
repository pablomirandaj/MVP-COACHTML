import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSetPiece, DEFAULT_PITCH, sequenceOfPlay, type Player } from "@fcs/engine";
import { createPlayer, playerPageHtml, playerSource, wrapSource } from "@fcs/render";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const roster: Player[] = Array.from({ length: 11 }, (_, i) => ({ id: `p${i + 1}`, n: i + 1, name: `J${i + 1}`, pos: i === 0 ? "GK" : i < 5 ? "CB" : "CM", foot: "RIGHT", status: "AVAILABLE" }));
const seq = sequenceOfPlay(createSetPiece([{ op: "play.create", type: "CORNER_ATT", side: "LEFT" }], { pitch: DEFAULT_PITCH, roster }).doc!, roster);

describe("Reproductor por pasos (J5)", () => {
  it("es autocontenido: su código no usa nada de fuera", () => {
    const src = createPlayer.toString();
    expect(src).not.toMatch(/\bimport\b|\brequire\(|__vite|_\$|\bexports\b/);
  });

  it("el código que se incrusta funciona aunque el compilador añada ayudantes de nombres (tsx/esbuild)", () => {
    const compiled = 'function f(a) { function g() { return a * 2; } __name(g, "g"); return g(); }';
    expect((new Function(`return ${wrapSource(compiled)}`)() as (a: number) => number)(21)).toBe(42);
    expect(playerSource()).toContain("var __name");
  });

  it.skipIf(!existsSync(CHROME))("en un móvil avanza, atenúa las flechas viejas, las oculta y no se desborda", async () => {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: CHROME });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(playerPageHtml(seq, { autoplay: false }));
      const beat = () => page.locator(".fcsp-beat-t").textContent();
      expect(await beat()).toBe("Colocados");
      await page.evaluate(() => (window as any).player.next());
      expect(await beat()).not.toBe("Colocados");
      await page.evaluate(() => { (window as any).player.next(); (window as any).player.next(); });
      await page.waitForTimeout(450);
      const old = await page.$$eval(".fcsp-ln.old", (els) => els.map((e) => Number(getComputedStyle(e).opacity)));
      expect(old.length).toBeGreaterThan(0);
      for (const o of old) expect(o).toBeLessThanOrEqual(0.2);
      await page.click(".fcsp-arrows");
      expect(await page.$$eval(".fcsp-ln", (els) => els.length)).toBe(0);
      await page.click(".fcsp-prev");
      expect(await page.locator(".fcsp-dots i.on").count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      expect(await page.locator(".fcsp-pl").count()).toBe(seq.actors.filter((a) => a.team === "OWN").length);
    } finally { await browser.close(); }
  }, 30_000);
});
