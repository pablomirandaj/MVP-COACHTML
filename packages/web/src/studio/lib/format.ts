// Formato en español: fechas, nombres de equipos y posiciones.
import type { Player } from "@fcs/engine";
import { POS_CODE_TO_ES } from "./import";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function longDate(iso: string) {
  if (!iso) return "fecha por fijar";
  const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[t.getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}
export function shortDate(iso: string) { if (!iso) return "—"; const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}`; }
const title = (s: string) => s.toLowerCase().split(" ").map((w) => (/\./.test(w) || /^'.'$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
export const teamShort = (n: string) => title(n.replace(/\bCLUB DE FUTBOL\b/, "").replace(/^(A\.D\.|C\.D\.B\.|C\.D\.|C\.F\.|E\.D\.)\s+/, "").replace(/\s+/g, " ").trim());
export const venue = (s: string) => title(s);
export const posEs = (code: string) => POS_CODE_TO_ES[code] ?? (code ? code : "—");
export const playerName = (p: Player) => `${p.name}${p.surname ? " " + p.surname.split(" ")[0] : ""}`;
export const playerLabel = (p: Player) => (p.n != null ? String(p.n) : p.name.slice(0, 2).toUpperCase());
