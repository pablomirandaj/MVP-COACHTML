// Compila la página de Claude y la junta en un solo archivo: dist-artifact/pizarra.html.
// El contenido NO lleva doctype/html/head/body: la plataforma lo envuelve al publicar (contrato de la página).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
execFileSync("npx", ["vite", "build", "--mode", "artifact"], { cwd: root, stdio: "inherit" });
const dist = `${root}dist-artifact`;
const files = readdirSync(dist, { recursive: true }).map(String);
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(`${dist}/${f}`, "utf8")).join("\n");
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(`${dist}/${f}`, "utf8")).join("\n");
if (!js) throw new Error("No hay JavaScript compilado");
const safe = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");
const page = `<title>Pizarra Periso</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>body{margin:0;background:var(--st-bg,#0b110d)}#boot{font:15px system-ui,sans-serif;color:#92a698;padding:40px 16px;text-align:center}${safe(css)}</style>
<div id="root"><p id="boot">Cargando la pizarra…</p></div>
<script>${safe(js)}</script>
`;
const bytes = Buffer.byteLength(page);
if (bytes > 16 * 1024 * 1024) throw new Error(`La página ocupa ${bytes} bytes (máximo 16 MB)`);
if (/<script[^>]+src=|<link[^>]+href="(?!https:\/\/fonts\.)/i.test(page)) throw new Error("Quedan referencias a archivos externos");
writeFileSync(`${dist}/pizarra.html`, page);
console.log(`dist-artifact/pizarra.html · ${(bytes / 1024).toFixed(0)} KB`);
