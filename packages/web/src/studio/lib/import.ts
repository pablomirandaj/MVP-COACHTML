// Importar la plantilla pegando texto ("9 Raúl Somavilla DC zurdo") o un CSV con cabecera
// (dorsal,nombre,apellidos,posicion,pie,altura; coma o punto y coma). Posiciones en español.
import type { Foot, Player } from "@fcs/engine";

export const POS_ES_TO_CODE: Record<string, string> = {
  POR: "GK", PT: "GK", LD: "RB", DFC: "CB", CT: "CB", LI: "LB", CAD: "RWB", CAI: "LWB", MCD: "DM", MC: "CM", MCO: "AM",
  MD: "RM", MI: "LM", ED: "RW", EI: "LW", DC: "ST", SD: "SS",
};
export const POS_CODE_TO_ES: Record<string, string> = { GK: "POR", RB: "LD", CB: "DFC", LB: "LI", RWB: "CAD", LWB: "CAI", DM: "MCD", CM: "MC", AM: "MCO", RM: "MD", LM: "MI", RW: "ED", LW: "EI", ST: "DC", SS: "SD" };
const FOOT: Record<string, Foot> = { diestro: "RIGHT", derecho: "RIGHT", d: "RIGHT", zurdo: "LEFT", izquierdo: "LEFT", z: "LEFT", i: "LEFT", ambidiestro: "BOTH", ambas: "BOTH", ambos: "BOTH" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const posOf = (t: string) => POS_ES_TO_CODE[t.toUpperCase()] ?? (Object.values(POS_ES_TO_CODE).includes(t.toUpperCase()) ? t.toUpperCase() : undefined);
const footOf = (t: string) => FOOT[norm(t)];

let seq = 0;
const newId = (n: number | undefined, name: string) => `pl_${n ?? "x"}_${norm(name).replace(/[^a-z0-9]+/g, "")}_${++seq}`;

export function parseRosterText(text: string): { players: Player[]; errors: string[] } {
  const lines = text.replace(/\r/g, "").split("\n");
  const players: Player[] = [], errors: string[] = [];
  const header = lines.find((l) => l.trim())?.toLowerCase() ?? "";
  const sep = header.includes(";") ? ";" : ",";
  const isCsv = /dorsal/.test(header) && /nombre/.test(header) && header.includes(sep);
  if (isCsv) {
    const cols = header.split(sep).map((c) => norm(c));
    const idx = (k: string) => cols.findIndex((c) => c.startsWith(k));
    const [iN, iName, iSur, iPos, iFoot, iH] = ["dorsal", "nombre", "apellido", "posic", "pie", "altura"].map(idx);
    lines.forEach((raw, li) => {
      if (li === lines.indexOf(lines.find((l) => l.trim())!) || !raw.trim()) return;
      const c = raw.split(sep).map((x) => x.trim());
      const pos = iPos >= 0 ? posOf(c[iPos] ?? "") : undefined;
      if (!pos) { errors.push(`Línea ${li + 1}: falta la posición o no se reconoce (${c[iPos] ?? ""}).`); return; }
      const n = Number(c[iN]); const h = Number(c[iH]);
      players.push({ id: newId(Number.isFinite(n) ? n : undefined, c[iName] ?? ""), ...(c[iN] && Number.isFinite(n) ? { n } : {}), name: c[iName] ?? "", surname: c[iSur] ?? "",
        pos, foot: (iFoot >= 0 && footOf(c[iFoot] ?? "")) || "RIGHT", ...(c[iH] && Number.isFinite(h) && h > 0 ? { height: h } : {}), status: "AVAILABLE" });
    });
    return { players, errors };
  }
  lines.forEach((raw, li) => {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    let n: number | undefined;
    if (/^\d{1,2}$/.test(tokens[0])) n = Number(tokens.shift());
    let foot: Foot | undefined = tokens.length ? footOf(tokens[tokens.length - 1]) : undefined;
    if (foot) tokens.pop();
    const pos = tokens.length ? posOf(tokens[tokens.length - 1]) : undefined;
    if (!pos) { errors.push(`Línea ${li + 1}: falta la posición (POR, LD, DFC, LI, MCD, MC, MCO, ED, EI, DC…).`); return; }
    tokens.pop();
    if (!foot && tokens.length && footOf(tokens[tokens.length - 1])) foot = footOf(tokens.pop()!);
    if (!tokens.length) { errors.push(`Línea ${li + 1}: falta el nombre.`); return; }
    const [name, ...rest] = tokens;
    players.push({ id: newId(n, name), ...(n !== undefined ? { n } : {}), name, surname: rest.join(" "), pos, foot: foot ?? "RIGHT", status: "AVAILABLE" });
  });
  return { players, errors };
}

/** Fusiona por nombre completo (sin tildes): actualiza los que ya están y añade los nuevos. */
export function mergeRoster(existing: Player[], incoming: Player[]): Player[] {
  const key = (p: Player) => norm(`${p.name} ${p.surname ?? ""}`);
  const out = existing.map((p) => ({ ...p }));
  for (const p of incoming) {
    const i = out.findIndex((x) => key(x) === key(p));
    if (i >= 0) out[i] = { ...out[i], ...p, id: out[i].id, tags: (out[i].tags ?? []).filter((t) => t !== "rffm") };
    else out.push(p);
  }
  return out;
}
