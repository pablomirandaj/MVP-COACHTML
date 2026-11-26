// Despachador de balón parado (Pizarra Studio §6.1): elige el planificador por play.create.type.
import type { Command, EngineContext } from "../types";
import { createDefensiveSetPiece } from "./defend";
import { createFreeKickWide } from "./freekick";
import { createCorner, type PlanResult } from "./plan";
import { createThrowIn } from "./throwin";

export const SETPIECE_TYPES = ["CORNER_ATT", "CORNER_DEF", "FK_WIDE_ATT", "FK_WIDE_DEF", "THROW_IN_ATT"] as const;
export type SetPieceType = (typeof SETPIECE_TYPES)[number];

const PLANNERS: Record<SetPieceType, (cmds: Command[], ctx: EngineContext) => PlanResult> = {
  CORNER_ATT: createCorner, CORNER_DEF: createDefensiveSetPiece, FK_WIDE_ATT: createFreeKickWide,
  FK_WIDE_DEF: createDefensiveSetPiece, THROW_IN_ATT: createThrowIn,
};

export function createSetPiece(cmds: Command[], ctx: EngineContext): PlanResult {
  const type = cmds.find((c) => c.op === "play.create")?.type as string | undefined;
  const planner = type ? PLANNERS[type as SetPieceType] : undefined;
  if (!planner) {
    const message = type ? `Este tipo de balón parado aún no está disponible: ${type}.` : "Falta play.create con el tipo de jugada.";
    return { doc: null, clarifications: [], diagnostics: [{ rule_id: "UNSUPPORTED-01", class: "SEQUENCE", severity: "error", message }] };
  }
  return planner(cmds, ctx);
}
