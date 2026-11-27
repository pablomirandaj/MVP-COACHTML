// Prueba de extremo a extremo de la página de Claude (dist-artifact/pizarra.html) con window.claude simulado:
// db en memoria, sample con herramientas y un guion fijo, y downloads que captura el archivo.
// Uso: pnpm studio:artifact && CHROMIUM_PATH=/ruta/chrome pnpm e2e:studio [carpeta_capturas]
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const page = readFileSync(`${root}dist-artifact/pizarra.html`, "utf8");
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;

// Se ejecuta en la página antes del script de la app.
function installClaude() {
  const store = new Map();
  const snap = (p) => ({ id: p.split("/").pop(), exists: store.has(p), data: () => store.get(p), metadata: { fromCache: false, hasPendingWrites: false } });
  const ref = (p) => ({ id: p.split("/").pop(), path: p, get: async () => snap(p), set: async (d) => { store.set(p, JSON.parse(JSON.stringify(d))); },
    update: async (d) => { store.set(p, { ...store.get(p), ...d }); }, delete: async () => { store.delete(p); }, acquire: async () => ({ acquired: true }), onSnapshot: () => () => {} });
  const db = { doc: ref, collection: (c) => ({ path: c, doc: (id) => ref(`${c}/${id}`),
    get: async () => { const docs = [...store.keys()].filter((k) => k.startsWith(c + "/") && k.split("/").length === 2).sort().map(snap); return { docs, size: docs.length, empty: !docs.length }; } }) };
  window.__saved = [];
  window.__samples = 0;
  const sample = async (turns, opts) => {
    window.__samples++;
    const last = turns[turns.length - 1].content;
    const apply = opts.tools.find((t) => t.name === "apply_commands");
    const steps = (last.match(/^\d+\. s\d+:/gm) || []).length;
    await apply.execute({ commands: [{ op: "board.add_step" }, { op: "board.move", step: `s${steps + 1}`, actor: "own:ST", to: { u: 0.5, v: 0.5 }, kind: "RUN" },
      { op: "board.note", step: `s${steps + 1}`, title: "El 9 baja a recibir", implies: "Arrastra a su central y abre espacio a la espalda." }] }, { signal: new AbortController().signal });
    opts.onText?.({ text: "He añadido un paso: el 9 baja a recibir.", delta: "" });
    return { text: "He añadido un paso: el 9 baja a recibir.", truncated: false };
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 8 } });
  sample.json = async () => ({ tool: null, reply: "ok" });
  const downloads = { save: async (r) => { window.__saved.push({ filename: r.filename, data: String(r.data) }); return { status: "saved" }; } };
  const caps = { db, sample, downloads, user: { id: async () => "u_e2e" } };
  window.claude = { use: async (n) => caps[n] ?? null };
}

const ROSTER = `1 Juan Pérez POR
2 Martín López LD
3 Luis Gil LI zurdo
4 Diego Sanz DFC
5 Mateo Ruiz DFC
6 Víctor Moya MCD
8 Marcos Martínez MC
10 Mario Alonso MCO
7 Pablo Miranda ED
11 Anwar Zahid EI zurdo
9 Raúl Somavilla DC zurdo
12 Ignacio Sainz DC
13 Alejandro Ruiz MC
14 Francisco Sánchez ED
15 Jorge Medina DFC
16 Pedro Blanco LD`;

const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch({ executablePath: CHROME });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(installClaude);
  // Se sirve desde una URL ficticia para que el script de inicio (window.claude simulado) se ejecute antes que la app.
  await p.route("https://pizarra.test/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: "text/css", body: "" }));
  await p.goto("https://pizarra.test/", { waitUntil: "load" });
  if (!(await p.evaluate(() => typeof window.claude?.use === "function"))) fail("window.claude simulado no está instalado");
  const shot = async (n) => { if (shots) await p.screenshot({ path: `${shots}/${n}.png`, fullPage: false }); };

  // 1. Inicio con el próximo rival.
  await p.getByRole("heading", { name: /Sporting Hortaleza/ }).waitFor({ timeout: 15000 });
  await shot("01-inicio");

  // 2. Plantilla: importar 16 y guardar.
  await p.getByRole("link", { name: "Plantilla" }).click();
  await p.getByRole("button", { name: "Importar desde texto o CSV" }).click();
  await p.locator("#roster-import").fill(ROSTER);
  await p.getByRole("button", { name: /^Importar \d+/ }).click();
  await p.getByRole("button", { name: "Guardar plantilla" }).click();
  await p.getByRole("status").filter({ hasText: "Plantilla guardada" }).waitFor();
  const rows = await p.locator(".st-roster li").count();
  if (rows < 16) fail(`Plantilla con ${rows} filas`);
  await shot("02-plantilla");

  // 3. Pizarra: un movimiento, un pase, otro paso; el asistente añade un paso; deshacer.
  await p.getByRole("link", { name: "Pizarra" }).click();
  const actor = (id) => p.locator(`[data-actor="${id}"]`);
  const drag = async (id, dx, dy) => {
    const b = await actor(id).boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx / 2, y + dy / 2); await p.mouse.move(x + dx, y + dy); await p.mouse.up();
  };
  await drag("own:RB", 120, 10);
  await p.getByRole("button", { name: "Pase", exact: true }).click();
  await actor("own:CB_R").click(); await actor("own:RB").click();
  await p.getByRole("button", { name: "+ Paso" }).click();
  await p.getByRole("button", { name: "Mover", exact: true }).click();
  await drag("own:LW", 90, -20);
  const stepTabs = () => p.getByRole("tab", { name: /^Paso \d+$/ }).count();
  if ((await stepTabs()) !== 2) fail(`Se esperaban 2 pasos, hay ${await stepTabs()}`);
  if (!(await p.locator(".st-steps").innerText()).includes("pasa a")) fail("El paso del pase no está narrado");
  await p.locator("#chat-input").fill("haz que el 9 baje a recibir");
  await p.getByRole("button", { name: "Enviar" }).click();
  await p.getByText("He añadido un paso: el 9 baja a recibir.").waitFor();
  if ((await stepTabs()) !== 3) fail("El asistente no añadió el paso");
  if (!(await p.locator(".st-steps").innerText()).includes("El 9 baja a recibir")) fail("La nota del asistente no aparece");
  await shot("03-pizarra");
  await p.getByRole("button", { name: "Deshacer lo último" }).click();
  if ((await stepTabs()) !== 2) fail("Deshacer no quitó el paso del asistente");
  // Cambiar de sección y volver no pierde lo que no se ha guardado.
  await p.getByRole("link", { name: "Inicio" }).click();
  await p.getByRole("link", { name: "Pizarra" }).click();
  if ((await stepTabs()) !== 2) fail(`Al volver a la pizarra se perdieron los pasos (${await stepTabs()})`);
  await p.getByRole("button", { name: "Guardar", exact: true }).click();
  await p.getByRole("button", { name: "Guardado" }).waitFor();

  // 4. Balón parado: falta lateral derecha y centro abierto.
  await p.getByRole("link", { name: "Balón parado" }).click();
  await p.getByRole("tab", { name: "Falta lateral a favor" }).click();
  await p.getByLabel("Lado").selectOption("RIGHT");
  await p.getByRole("button", { name: "Crear la jugada" }).click();
  await p.getByRole("button", { name: "Abierto", exact: true }).click();
  if ((await p.getByRole("button", { name: "Abierto", exact: true }).getAttribute("aria-pressed")) !== "true") fail("El centro no cambió a abierto");
  await shot("04-falta");

  await p.getByRole("link", { name: "Inicio" }).click();
  await p.getByRole("link", { name: "Balón parado" }).click();
  if ((await p.getByRole("button", { name: "Abierto", exact: true }).getAttribute("aria-pressed")) !== "true") fail("Al volver al balón parado se perdió la jugada");

  // 5. Planes: salida de balón 3+1 contra 2.
  await p.getByRole("link", { name: "Planes" }).click();
  await p.getByRole("button", { name: /Salida de balón/ }).click();
  await p.getByLabel("Rivales que presionan").selectOption("2");
  const stepsText = await p.locator(".st-steps").innerText();
  if (!/hombre libre/i.test(stepsText)) fail("La salida de balón no nombra al hombre libre");
  await shot("05-salida");

  // 6. Exportación HTML.
  await p.getByRole("button", { name: "Exportar HTML" }).click();
  await p.waitForFunction(() => window.__saved.length > 0);
  const saved = await p.evaluate(() => window.__saved[0]);
  if (!saved.filename.endsWith(".html") || !saved.data.includes("Paso 1 de")) fail("El HTML exportado no tiene los pasos");

  // 7. Biblioteca con la pizarra guardada.
  await p.getByRole("link", { name: "Biblioteca" }).click();
  await p.locator(".st-item").first().waitFor();

  // 8. Móvil: sin desplazamiento horizontal en ninguna sección.
  await p.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Inicio", "Pizarra", "Balón parado", "Planes", "Biblioteca", "Plantilla"]) {
    await p.getByRole("link", { name }).click();
    await p.waitForTimeout(150);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) {
      const wide = await p.evaluate(() => [...document.querySelectorAll(".st-app *")].filter((e) => e.getBoundingClientRect().right > 391 && !e.parentElement?.closest(".st-stepbar,.st-scroll,.st-msgs")).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`));
      fail(`${name}: desplazamiento horizontal (${w}px): ${wide.join(", ")}`);
    }
    await shot(`m-${name.replace(/\s/g, "-").toLowerCase()}`);
  }
  if (errors.length) fail(`Errores en la página: ${errors.join(" | ")}`);
  console.log("E2E Pizarra Studio: OK");
} finally {
  await browser.close();
}
