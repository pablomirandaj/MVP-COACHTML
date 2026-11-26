// Genera el validador de comandos IR como código JavaScript independiente (sin eval en tiempo de ejecución),
// para que funcione también en páginas con CSP estricta (página de Claude).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const schema = JSON.parse(readFileSync(`${root}docs/engine/command-ir.schema.json`, "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: false, code: { source: true, esm: true } });
ajv.addSchema(schema);
ajv.addSchema({ $id: "fcs:command", $ref: `${schema.$id}#/$defs/command` });
const code = (standaloneCode as unknown as { default?: typeof standaloneCode }).default ?? standaloneCode;
// El código independiente aún hace require() del contador de caracteres Unicode: se sustituye por una función en línea.
const UCS2 = "((s) => { let n = 0, i = 0; while (i < s.length) { n++; const c = s.charCodeAt(i++); if (c >= 0xd800 && c <= 0xdbff && i < s.length) { const d = s.charCodeAt(i); if ((d & 0xfc00) === 0xdc00) i++; } } return n; })";
const body = code(ajv, { validateCommand: "fcs:command" }).replace(/require\("ajv\/dist\/runtime\/ucs2length"\)\.default/g, UCS2);
if (/require\(/.test(body)) throw new Error("El validador generado aún usa require()");
const out = `// Generado por packages/assistant/scripts/build-validator.ts a partir de docs/engine/command-ir.schema.json. No editar.\n${body}`;
writeFileSync(fileURLToPath(new URL("../src/generated/command-validator.js", import.meta.url)), out);
console.log("packages/assistant/src/generated/command-validator.js");
