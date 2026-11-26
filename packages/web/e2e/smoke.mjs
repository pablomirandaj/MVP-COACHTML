// Prueba extremo a extremo con un navegador real (Chromium) contra el servidor con la web compilada.
// Uso: BASE_URL=http://127.0.0.1:8788 CHROMIUM_PATH=/ruta/chrome node packages/web/e2e/smoke.mjs [carpeta_capturas]
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { parse } from "yaml";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8788";
const OUT = process.argv[2] ?? "e2e-shots";
mkdirSync(OUT, { recursive: true });
const suite = parse(readFileSync(new URL("../../../docs/engine/tests/command-tests.yaml", import.meta.url), "utf8"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("401")) errors.push(`console: ${m.text()}`); });
const step = (s) => console.log(`✓ ${s}`);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const api = async (method, url, data) => {
  const r = await page.request.fetch(`${BASE}/api${url}`, { method, data });
  if (!r.ok()) throw new Error(`${method} ${url} → ${r.status()} ${await r.text()}`);
  return r.status() === 204 ? null : r.json();
};

try {
  // 1. Registro
  await page.goto(BASE);
  await page.getByRole("button", { name: "¿No tienes cuenta? Crear una" }).click();
  await page.getByLabel("Tu nombre").fill("Javi");
  await page.getByLabel("Email").fill(`javi+${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByText("Hola, Javi").waitFor();
  step("registro");

  // 2. Equipo
  await page.getByLabel("Nombre").fill("CD Ejemplo");
  await page.getByRole("button", { name: "Crear equipo" }).click();
  await page.getByRole("heading", { name: /Plantilla/ }).waitFor();
  const teamId = page.url().split("/team/")[1].split("/")[0];
  step("equipo creado");

  // 3. Plantilla: un jugador por formulario y el resto del fixture por API
  await page.getByRole("button", { name: "＋ Jugador" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Pablo");
  await page.getByLabel("Apellidos").fill("Ruiz");
  await page.getByLabel("Dorsal").fill("1");
  await page.getByLabel("Posición").selectOption("GK");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Pablo Ruiz").waitFor();
  const ids = {};
  for (const p of suite.fixtures.roster.filter((x) => x.id !== "pl_1")) {
    const r = await api("POST", `/teams/${teamId}/players`, { first_name: p.name, last_name: p.surname, shirt_number: p.n, primary_position: p.pos,
      secondary_positions: p.secondary ?? [], dominant_foot: p.foot, height_cm: p.height ?? null, status: p.status,
      attributes: Object.fromEntries((p.tags ?? []).map((k) => [k, 3])), setpiece_roles: p.setpiece ?? [] });
    ids[p.id] = r.id;
  }
  ids.pl_1 = (await api("GET", `/teams/${teamId}/players`)).find((p) => p.shirt_number === 1).id;
  await page.reload();
  await page.getByRole("heading", { name: "Plantilla (15)" }).waitFor();
  await shot("01-plantilla");
  step("plantilla de 15 jugadores");

  // 4. Calendario: partido por formulario
  await page.getByRole("link", { name: "Jornadas" }).click();
  await page.getByRole("button", { name: "＋ Partido" }).click();
  await page.getByLabel("Rival").fill("UD Rival");
  await page.getByLabel("Jornada").fill("5");
  await page.getByLabel("Fecha").fill("2026-12-06");
  await page.getByRole("button", { name: "Añadir" }).click();
  await page.getByRole("link", { name: /vs UD Rival/ }).click();
  await page.getByRole("heading", { name: "Nosotros – UD Rival" }).waitFor();
  const matchId = page.url().split("/match/")[1];
  step("partido creado");

  // 5. Alineación: crear, portero tocando el campo, resto por comandos
  await page.getByRole("button", { name: "Empezar el once" }).click();
  await page.getByRole("button", { name: "POR: vacía" }).click();
  await page.getByRole("button", { name: /Pablo Ruiz/ }).click();
  await page.getByRole("button", { name: /^POR: Pablo Ruiz/ }).waitFor();
  const map = (x) => JSON.parse(JSON.stringify(x).replace(/"pl_\d+"/g, (m) => JSON.stringify(ids[m.slice(1, -1)])));
  const cmds = map(suite.cases.find((c) => c.id === "T-LU-01").expect_ir.filter((c) => c.op.startsWith("lineup.assign_group")))
    .map((c) => ({ ...c, players: c.players.map((p) => p ?? ids.pl_9).map((p) => (p === "?" ? ids.pl_9 : p)) }));
  await api("POST", `/matches/${matchId}/lineup/commands`, { commands: cmds });
  await page.reload();
  await page.getByRole("button", { name: "Confirmar once" }).click();
  await page.getByRole("button", { name: "Once confirmado ✔" }).waitFor();
  await shot("02-jornada-once");
  step("once confirmado");

  // 6. Córner paso a paso
  await page.getByRole("button", { name: "＋ Córner" }).click();
  await page.getByLabel("Lanzador").selectOption({ label: "Lucas (7)" });
  await page.getByLabel("Lado").selectOption("RIGHT");
  await page.getByLabel("Bloqueo (sin contacto) para liberar al rematador principal").check();
  await page.getByRole("button", { name: "Crear córner" }).click();
  await page.waitForURL(/#\/play\//);
  await page.getByText("Versión 1.").waitFor();
  await shot("03-editor-corner");
  step("córner creado");

  // 7. Arrastrar un jugador y deshacer
  const actor = page.getByRole("button", { name: /^Sergio \(6\)/ });
  const box = await actor.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.getByText("Versión 2.").waitFor();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByText("Versión 3.").waitFor();
  await page.getByRole("button", { name: "Rehacer" }).waitFor();
  step("arrastrar, deshacer");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Más cerrado", exact: true }).click();
  await page.getByText("Versión 4.").waitFor();
  await page.getByRole("button", { name: "Golpeo", exact: true }).click();
  await shot("04-editor-tras-cambios");
  step("ajustar golpeo");

  // 8. Escena de presión
  await page.goto(`${BASE}/#/match/${matchId}/new-scene`);
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.waitForURL(/#\/scene\//);
  await page.getByRole("button", { name: "¡Presión!" }).click();
  await shot("05-escena-presion");
  step("escena de presión");

  // 9. Charla con PDF
  await page.goto(`${BASE}/#/match/${matchId}/talk`);
  await page.getByLabel("Incluir Mensaje final").check();
  await page.getByLabel("Texto de Mensaje final").fill("¡A por ellos!");
  await page.getByRole("button", { name: "Guardar guion" }).click();
  await page.getByRole("button", { name: "Guardar guion" }).isDisabled();
  const frame = page.frameLocator("iframe.preview");
  await frame.getByText("¡A por ellos!").waitFor();
  await shot("06-charla");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar PDF" }).click()]);
  const pdfPath = `${OUT}/charla.pdf`;
  await dl.saveAs(pdfPath);
  const head = readFileSync(pdfPath).subarray(0, 4).toString();
  if (head !== "%PDF") throw new Error("La descarga no es un PDF");
  step(`charla en PDF (${readFileSync(pdfPath).length} bytes)`);

  // 10. Móvil: campo en vertical
  const playUrl = (await api("GET", `/teams/${teamId}/plays`))[0].id;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/play/${playUrl}`);
  await page.getByText("Versión 4.").waitFor();
  await shot("07-movil-corner");
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 390) throw new Error(`Scroll horizontal en móvil: ${sw}px`);
  step("móvil sin scroll horizontal");

  if (errors.length) throw new Error(`Errores en el navegador:\n${errors.join("\n")}`);
  console.log("E2E OK");
} catch (e) {
  await shot("zz-fallo").catch(() => {});
  console.error("E2E FALLÓ:", e.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
