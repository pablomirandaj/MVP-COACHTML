// Construye el HTML de la carpeta del partido (formato de la J5) a partir de piezas de la biblioteca.
import { renderDossierHtml, type DossierPlay } from "@fcs/render";
import type { Player } from "@fcs/engine";
import { CREST, HERO } from "../data/brand";
import type { Host, StudioItem, TeamInfo } from "../ports";
import { sequenceOf, sheetOf } from "./editor";

export { DEFAULT_RULES } from "./rules";
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

/** Exporta la carpeta del partido: carga las piezas en el orden dado, omite las que ya no existen o no tienen pasos. */
export async function exportFolder(host: Host, ids: string[], o: Omit<DossierOptions, "team">): Promise<{ skipped: number; included: number }> {
  const loaded = await Promise.all(ids.map((id) => host.store.load(id).catch(() => null)));
  const items = loaded.filter((x): x is StudioItem => !!x);
  const { html, skipped } = buildDossier(items, { ...o, team: host.team.team() });
  const included = items.length - skipped;
  if (!included) throw new Error("Ninguna de las piezas elegidas tiene pasos que exportar.");
  await host.exporter.saveHtml(o.title, html);
  return { skipped: skipped + (ids.length - items.length), included };
}
