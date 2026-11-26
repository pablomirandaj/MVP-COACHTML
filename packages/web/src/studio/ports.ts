// Puertos de Pizarra Studio (diseño §5.1): la interfaz solo habla con estas cuatro piezas. Hay dos anfitriones:
// la página de Claude (hosts/artifact.ts) y el servidor propio (hosts/server.ts).
import type { BoardDoc, Command, Player, PlayDoc, SceneSpec, Tracks } from "@fcs/engine";
import type { Workspace } from "@fcs/assistant";

export interface TeamInfo { name: string; short: string; competition: string; season: string; colors: { primary: string; ink: string }; home_ground?: string; snapshot_at: string; source: string }
export interface Fixture { jornada: number; fecha: string; hora: string; condicion: "Casa" | "Fuera"; rival: string; goles_favor: number | null; goles_contra: number | null; resultado: "" | "G" | "E" | "P"; campo: string }
export interface Standing { posicion: number; equipo: string; jugados: number; ganados: number; empatados: number; perdidos: number; goles_favor: number; goles_contra: number; diferencia: number; puntos: number; puntos_casa: number; puntos_fuera: number; racha: string }
export interface Result { jornada: number; fecha: string; hora: string; local: string; visitante: string; goles_local: number | null; goles_visitante: number | null; campo: string }
export interface Scorer { jugador: string; equipo: string; partidos: number; goles: number; penalti: number }

export interface TeamPort {
  team(): TeamInfo;
  roster(): Promise<Player[]>;
  saveRoster(players: Player[]): Promise<void>;
  fixtures(): Fixture[];
  standings(): Standing[];
  results(): Result[];
  scorers(): Scorer[];
}

export type StudioKind = "BOARD" | "SETPIECE" | "SCENE";
export interface StudioItem {
  id: string; kind: StudioKind; title: string; match?: number; opponent?: string;
  doc: BoardDoc | PlayDoc | SceneSpec;
  revision: number; updated_at: string;
  /** Comandos aplicados (para auditoría y para rehacer con otra versión del motor). */
  history: Command[][];
}
export type ItemMeta = Omit<StudioItem, "doc" | "history"> & { doc?: StudioItem["doc"] };
export interface Saved { id: string; revision: number; updated_at: string }
export class StoreError extends Error { constructor(public code: "conflict" | "unavailable" | "quota", message: string) { super(message); } }

export interface StorePort {
  list(): Promise<ItemMeta[]>;
  load(id: string): Promise<StudioItem | null>;
  /** Rechaza con StoreError("conflict") si `baseRevision` no coincide con la guardada. */
  save(item: StudioItem, baseRevision?: number): Promise<Saved>;
  remove(id: string): Promise<void>;
}

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface AiTurnRequest {
  ws: Workspace; history: ChatTurn[]; message: string;
  /** Lo que el servidor necesita para ejecutar el turno allí: el tipo de pieza, su estado y cómo aplicar el nuevo. */
  subject?: { kind: StudioKind; state: () => unknown; apply: (next: unknown) => void; context?: Record<string, unknown> };
  onText?: (text: string) => void; signal?: AbortSignal;
}
export interface AiTurnResult { reply: string; clarification: { question: string; options: string[] } | null }
export interface AiPort {
  available(): Promise<boolean>;
  /** Ejecuta un turno del asistente; los cambios llegan por los callbacks del espacio de trabajo. */
  turn(req: AiTurnRequest): Promise<AiTurnResult>;
}

export interface ExportMeta { title: string; opponent?: string; match?: string }
export interface ExportPort { exportHtml(tracks: Tracks, meta: ExportMeta): Promise<void> }

export interface Host { mode: "artifact" | "server"; team: TeamPort; store: StorePort; ai: AiPort; exporter: ExportPort }

export const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "jugada";
