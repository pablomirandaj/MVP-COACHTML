// Piezas compartidas por los dos anfitriones: datos del instantáneo de la RFFM y exportación HTML.
import type { Player } from "@fcs/engine";
import data from "../data/periso-2026-11-26.json";
import type { Fixture, Result, Scorer, Standing, TeamInfo } from "../ports";

export const SNAPSHOT = data as unknown as {
  snapshot_at: string; source: string; team: Omit<TeamInfo, "snapshot_at" | "source">;
  standings: Standing[]; fixtures: Fixture[]; results: Result[]; scorers: Scorer[];
};
export const TEAM: TeamInfo = { ...SNAPSHOT.team, snapshot_at: SNAPSHOT.snapshot_at, source: SNAPSHOT.source };

/** Plantilla inicial: los goleadores del equipo en la RFFM, sin dorsal ni posición (los completa el entrenador). */
export function seedRoster(): Player[] {
  return SNAPSHOT.scorers.filter((s) => s.equipo === TEAM.name).map((s, i) => {
    const [name, ...rest] = s.jugador.split(" ");
    return { id: `pl_rffm_${i + 1}`, name, surname: rest.join(" "), pos: "", foot: "RIGHT", status: "AVAILABLE", tags: ["rffm"] } as Player;
  });
}
