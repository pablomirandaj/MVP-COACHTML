// Migraciones SQL en orden. 0001 es docs/db/schema.sql (referencia del modelo de datos, docs/12).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "./db";

const root = fileURLToPath(new URL("../../../", import.meta.url));

export function migrationFiles(): { name: string; sql: string }[] {
  const dir = `${root}packages/server/migrations`;
  return [
    { name: "0001_schema", sql: readFileSync(`${root}docs/db/schema.sql`, "utf8") },
    ...readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => ({ name: f.replace(/\.sql$/, ""), sql: readFileSync(`${dir}/${f}`, "utf8") })),
  ];
}

export async function migrate(db: Db, log: (m: string) => void = () => {}): Promise<string[]> {
  await db.query("CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await db.query("SELECT name FROM schema_migration")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const m of migrationFiles()) {
    if (done.has(m.name)) continue;
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query(m.sql);
      await c.query("INSERT INTO schema_migration(name) VALUES ($1)", [m.name]);
      await c.query("COMMIT");
      applied.push(m.name);
      log(`migración aplicada: ${m.name}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw new Error(`Fallo en la migración ${m.name}: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }
  return applied;
}
