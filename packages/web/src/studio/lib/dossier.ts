// Construye el HTML de la carpeta del partido (formato de la J5) a partir de piezas de la biblioteca.
import { renderDossierHtml, type DossierPlay } from "@fcs/render";
import type { Player } from "@fcs/engine";
import { CREST, HERO } from "../data/brand";
import type { StudioItem, TeamInfo } from "../ports";
import { sequenceOf, sheetOf } from "./editor";

export const DEFAULT_RULES = [
  "Diez en el campo en todas las jugadas: uno en la frontal y dos cerrando atrás. El resto, a rematar.",
  "Primero se bloquea y después se entra. Nadie sale antes de que su bloqueo esté hecho.",
  "Al balón se le ataca de frente. Si llegas de espaldas o parado, no hay remate.",
  "En las faltas laterales la línea se queda fuera del área. El hueco tiene que estar libre para hacer la jugada.",
  "Cada uno sabe a quién bloquea antes de colocarse. Si dudo, pregunto en la colocación, no cuando ya ha salido el balón.",
];
const EYEBROW: Record<string, string> = {
  CORNER_ATT: "Córner a favor", CORNER_DEF: "Córner en contra", FK_WIDE_ATT: "Falta lateral a favor", FK_WIDE_DEF: "Falta lateral en contra", THROW_IN_ATT: "Saque de banda",
  BUILD_UP: "Salida de balón", PRESS_OWN: "Presión", PRESS_OPP: "Su presión", RETREAT: "Repliegue", REST_DEFENSE: "Vigilancias", ATTACK_SPACE: "Atacar espacios",
};

export interface DossierOptions { team: TeamInfo; roster: Player[]; rules: string[]; title: string; match?: string; opponent?: string; labels?: "ROLE" | "DORSAL" }

export function buildDossier(items: StudioItem[], o: DossierOptions): { html: string; skipped: number } {
  let skipped = 0;
  const counts: Record<string, number> = {};
  const plays: DossierPlay[] = [];
  for (const it of items) {
    const seq = sequenceOf(it.kind, it.doc, o.roster, o.labels ?? "ROLE", it.title);
    if (!seq || !seq.frames.length) { skipped++; continue; }
    const type = (it.doc as { type?: string }).type ?? "BOARD";
    const base = EYEBROW[type] ?? "Pizarra";
    counts[base] = (counts[base] ?? 0) + 1;
    plays.push({ label: it.title, eyebrow: `${base} · jugada ${counts[base]}`, seq, sheet: it.sheet ?? sheetOf(it.kind, it.doc, seq) });
  }
  const html = renderDossierHtml({
    club: o.team.short, category: [o.team.competition, o.team.season].filter(Boolean).join(" · "),
    match: o.match, opponent: o.opponent, title: o.title, crest: CREST, hero: HERO, rules: o.rules, plays,
  });
  return { html, skipped };
}
