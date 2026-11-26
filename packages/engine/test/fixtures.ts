import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { createCorner, DEFAULT_PITCH, type EngineContext, type Player, type PlayDoc } from "@fcs/engine";

const root = fileURLToPath(new URL("../../../", import.meta.url));
export const suite = parse(readFileSync(`${root}docs/engine/tests/command-tests.yaml`, "utf8"));
export const caseById = (id: string) => {
  const c = suite.cases.find((x: any) => x.id === id);
  if (!c) throw new Error(`Caso no encontrado: ${id}`);
  return c;
};
export const examplePath = `${root}docs/engine/examples/corner-left-inswing-screen.play.json`;

export const roster = (): Player[] => JSON.parse(JSON.stringify(suite.fixtures.roster));

/** Once del caso T-LU-01 (tras elegir Álvaro Castro). */
export const LINEUP_IDS = ["pl_1", "pl_5", "pl_4", "pl_7", "pl_2", "pl_10", "pl_6", "pl_8", "pl_11", "pl_9", "pl_17"];

export function ctx(overrides: Partial<EngineContext> = {}): EngineContext {
  return { pitch: DEFAULT_PITCH, roster: roster(), lineupPlayerIds: LINEUP_IDS, ...overrides };
}

/** Contexto del escenario 2 tras aceptar "Actualizar ficha: Lucas es diestro". */
export function ctxLucasRight(): EngineContext {
  const c = ctx();
  c.roster.find((p) => p.id === "pl_7")!.foot = "RIGHT";
  return c;
}

export function cornerDoc(): PlayDoc {
  const r = createCorner(caseById("T-CRN-01").expect_ir, ctxLucasRight());
  if (!r.doc) throw new Error("no doc");
  return r.doc;
}
