// Importación de calendario desde CSV (docs/05 §5): detección de separador y de columnas habituales.
import { madridToIso, normalizeName } from "./util";

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(field.trim()); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const HEADERS: Record<string, string[]> = {
  matchday: ["jornada", "j", "matchday", "round"],
  date: ["fecha", "dia", "date"],
  time: ["hora", "time"],
  home: ["local", "home", "equipo local"],
  away: ["visitante", "away", "equipo visitante"],
  venue: ["campo", "lugar", "estadio", "venue"],
};

export interface CalendarRow {
  row: number; matchday: number | null; kickoff_at: string | null; opponent: string | null; is_home: boolean | null; venue: string | null; bye: boolean; issues: string[];
}

export function parseCalendar(text: string, teamName: string, aliases: string[] = []): { rows: CalendarRow[]; columns: Record<string, number> } {
  const data = parseCsv(text);
  if (!data.length) return { rows: [], columns: {} };
  const header = data[0].map(normalizeName);
  const columns: Record<string, number> = {};
  for (const [k, names] of Object.entries(HEADERS)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) columns[k] = i;
  }
  const own = [teamName, ...aliases].map(normalizeName).filter(Boolean);
  const isOwn = (s: string) => { const n = normalizeName(s); return own.some((o) => n === o || n.includes(o) || o.includes(n)); };
  const rows: CalendarRow[] = [];
  data.slice(1).forEach((r, idx) => {
    const get = (k: string) => (columns[k] !== undefined ? r[columns[k]] ?? "" : "");
    const issues: string[] = [];
    const md = parseInt(get("matchday").replace(/\D+/g, ""), 10);
    const home = get("home"), away = get("away");
    let opponent: string | null = null, is_home: boolean | null = null, bye = false;
    if (/descansa|bye/i.test(`${home} ${away}`)) bye = true;
    else if (isOwn(home)) { opponent = away; is_home = true; }
    else if (isOwn(away)) { opponent = home; is_home = false; }
    else issues.push("No aparece tu equipo como local ni como visitante.");
    let kickoff: string | null = null;
    const d = get("date"), t = get("time");
    const m1 = d.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/), m2 = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = t.match(/^(\d{1,2})[:.h](\d{2})/);
    if (m1 || m2) {
      const [y, mo, da] = m2 ? [+m2[1], +m2[2], +m2[3]] : [+(m1![3].length === 2 ? `20${m1![3]}` : m1![3]), +m1![2], +m1![1]];
      kickoff = madridToIso(y, mo, da, tm ? +tm[1] : 12, tm ? +tm[2] : 0);
      if (!tm) issues.push("Sin hora: se usa las 12:00.");
    } else if (!bye) issues.push("Fecha no reconocida.");
    rows.push({ row: idx + 2, matchday: Number.isFinite(md) ? md : null, kickoff_at: kickoff, opponent: opponent || null, is_home, venue: get("venue") || null, bye, issues });
  });
  return { rows, columns };
}
