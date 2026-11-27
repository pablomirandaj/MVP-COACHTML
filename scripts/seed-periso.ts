// Carga el instantáneo del Periso (RFFM, 26/11/2026) en un servidor propio a través de la API:
// crea el equipo (si no se indica uno), sus 34 partidos y los 12 goleadores como jugadores.
// Uso: BASE_URL=http://127.0.0.1:8787 FCS_EMAIL=... FCS_PASSWORD=... npx tsx scripts/seed-periso.ts [--team <id>]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const data = JSON.parse(readFileSync(`${root}packages/web/src/studio/data/periso-2026-11-26.json`, "utf8"));
const base = (process.env.BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const email = process.env.FCS_EMAIL, password = process.env.FCS_PASSWORD;
if (!email || !password) { console.error("Faltan FCS_EMAIL y FCS_PASSWORD."); process.exit(1); }
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };

let cookie = "";
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
  const out = r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(out)}`);
  return out;
}

const NAME = "Periso CF";
await api("POST", "/auth/login", { email, password });
let teamId = arg("--team");
if (!teamId) teamId = (await api("POST", "/teams", { name: NAME, category: "Senior", season_label: data.team.season })).id;

// Calendario: CSV con el nombre del equipo tal como lo conoce el servidor; el resto de equipos con su nombre de la RFFM.
const team = await api("GET", `/teams/${teamId}`);
const date = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const rows = data.fixtures.map((f: any) => {
  const [home, away] = f.condicion === "Casa" ? [team.name, f.rival] : [f.rival, team.name];
  return [f.jornada, date(f.fecha), f.hora, home, away, f.campo].join(";");
});
const csv = ["Jornada;Fecha;Hora;Local;Visitante;Campo", ...rows].join("\n");
const imported = await api("POST", `/teams/${teamId}/calendar/import`, { csv, commit: true, aliases: [data.team.name] });
console.log(`Partidos: ${imported.created} creados, ${imported.skipped} ya existían.`);

// Jugadores: los goleadores de la RFFM, sin dorsal ni posición (se completan en la Plantilla).
const existing = await api("GET", `/teams/${teamId}/players`);
let created = 0;
for (const s of data.scorers.filter((x: any) => x.equipo === data.team.name)) {
  const [first, ...rest] = s.jugador.split(" ");
  if (existing.some((p: any) => p.first_name === first && p.last_name === rest.join(" "))) continue;
  await api("POST", `/teams/${teamId}/players`, { first_name: first, last_name: rest.join(" "), primary_position: "CM", coach_notes: "Importado de la RFFM (goleadores): completa dorsal y posición." });
  created++;
}
console.log(`Jugadores: ${created} creados. Equipo: ${teamId}. Pizarra Studio: ${base}/#/studio/${teamId}/home`);
