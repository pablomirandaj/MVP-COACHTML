// Genera packages/engine/src/catalog/generated.ts a partir de docs/engine/rules/*.yaml.
// Los YAML son la fuente de verdad del catálogo (docs/15 §5); el motor no lee ficheros en tiempo de ejecución,
// así funciona igual en el navegador y en el servidor.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const rules = (f: string) => parse(readFileSync(`${root}docs/engine/rules/${f}`, "utf8"));

const zones = rules("zones.yaml");
const roles = rules("roles.yaml");
const movements = rules("movements.yaml");
const templates = rules("templates.yaml");
const formations = rules("formations.yaml");
const constraints = rules("constraints.yaml");

const out = `// AUTO-GENERADO por packages/engine/scripts/build-catalog.ts — no editar a mano.
// Fuente: docs/engine/rules/*.yaml

export const CATALOG_VERSION = ${JSON.stringify(zones.catalog_version)};
export const ZONES_YAML = ${JSON.stringify(zones, null, 2)} as const;
export const ROLES_YAML = ${JSON.stringify(roles, null, 2)} as const;
export const MOVEMENTS_YAML = ${JSON.stringify(movements, null, 2)} as const;
export const TEMPLATES_YAML = ${JSON.stringify(templates, null, 2)} as const;
export const FORMATIONS_YAML = ${JSON.stringify(formations, null, 2)} as const;
export const CONSTRAINTS_YAML = ${JSON.stringify(constraints, null, 2)} as const;
`;
writeFileSync(`${root}packages/engine/src/catalog/generated.ts`, out);
console.log("catalog generated");
