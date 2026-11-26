import type { Player } from "@fcs/engine";
import type { PlayerDto } from "./api";

export const toEnginePlayer = (p: PlayerDto): Player => ({
  id: p.id, n: p.shirt_number ?? undefined, name: p.nickname || p.first_name, surname: p.last_name || undefined, pos: p.primary_position,
  secondary: p.secondary_positions, foot: p.dominant_foot, height: p.height_cm ?? undefined,
  tags: Object.entries(p.attributes).filter(([, v]) => v > 0).map(([k]) => k), setpiece: p.setpiece_roles, status: p.status as Player["status"],
});
export const playerName = (p?: PlayerDto) => (p ? `${p.nickname || p.first_name}${p.shirt_number ? ` (${p.shirt_number})` : ""}` : "—");
