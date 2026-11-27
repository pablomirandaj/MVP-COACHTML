import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CONCEPTS, resolvePlayerRef, slotAliases, whoIsWho, type Player } from "@fcs/engine";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const bank = parse(readFileSync(`${root}docs/engine/tests/coach-phrases.yaml`, "utf8")).phrases as { text: string; formation: string; labels?: Record<string, string>; expect: string[]; ambiguous?: boolean }[];

describe("Vocabulario de entrenador", () => {
  it("el banco tiene al menos 50 frases", () => expect(bank.length).toBeGreaterThanOrEqual(50));

  it.each(bank.map((p) => [p.text, p] as const))("«%s»", (_t, p) => {
    const r = resolvePlayerRef(p.text, { formation: p.formation, labels: p.labels });
    expect([...r.slots].sort()).toEqual([...p.expect].sort());
    expect(r.ambiguous).toBe(!!p.ambiguous);
  });

  it("dorsal frente a puesto: el orden pone primero el dorsal y dice por qué vía", () => {
    expect(resolvePlayerRef("el 6", { formation: "F_433", labels: { DM: "6" } })).toMatchObject({ slots: ["DM"], via: "shirt", ambiguous: false });
    expect(resolvePlayerRef("el 6", { formation: "F_433", labels: { CM_L: "6" } })).toMatchObject({ slots: ["CM_L", "DM"], ambiguous: true });
    expect(resolvePlayerRef("el 9", { formation: "F_433" })).toMatchObject({ slots: ["ST"], via: "position" });
  });

  it("por nombre de la plantilla", () => {
    const roster: Player[] = [{ id: "p9", n: 9, name: "Raúl", surname: "Somavilla", pos: "ST", foot: "LEFT", status: "AVAILABLE" }];
    expect(resolvePlayerRef("que Raúl caiga a banda", { formation: "F_433", labels: { ST: "9" }, roster })).toMatchObject({ slots: ["ST"], via: "name" });
    expect(resolvePlayerRef("que nadie se mueva", { formation: "F_433" })).toMatchObject({ slots: [], via: "none" });
  });

  it("alias por sistema y tabla quién es quién", () => {
    expect(slotAliases("F_433").DM).toContain("pivote");
    expect(slotAliases("F_4231").AM).toContain("mediapunta");
    const t = whoIsWho("F_433", { DM: "6" }, [{ id: "p6", n: 6, name: "Víctor", surname: "Moya", pos: "DM", foot: "RIGHT", status: "AVAILABLE" }]);
    expect(t).toMatch(/DM = pivote.*· 6/);
    expect(t).toContain("Víctor Moya");
  });

  it("los conceptos tácticos tienen su orden del motor", () => {
    const lav = CONCEPTS.find((c) => c.term.includes("salida lavolpiana"));
    expect(lav?.command).toContain("3+1");
    expect(CONCEPTS.find((c) => c.term.includes("saltar"))?.command).toContain("board.press");
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(15);
  });
});
