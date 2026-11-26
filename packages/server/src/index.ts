// Arranque del servidor. Variables: DATABASE_URL, PORT, COOKIE_SECURE, CHROMIUM_PATH, WEB_DIST,
// ASSISTANT_PROVIDER (anthropic|none), ASSISTANT_MODEL, ASSISTANT_EFFORT. La clave de Anthropic se lee de ANTHROPIC_API_KEY.
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { AnthropicAdapter } from "./assistant/anthropic";
import { createPool } from "./db";
import { migrate } from "./migrate";

const env = process.env;
const db = createPool(env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/fcs");
await migrate(db, (m) => console.log(m));
const llm = env.ASSISTANT_PROVIDER === "none" ? null : new AnthropicAdapter(env.ASSISTANT_MODEL ?? "claude-opus-5-5", (env.ASSISTANT_EFFORT as any) ?? "medium");
const app = await buildApp({
  db, llm, logger: true, secureCookies: env.COOKIE_SECURE === "1", chromiumPath: env.CHROMIUM_PATH,
  webDist: env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
});
await app.listen({ port: Number(env.PORT ?? 8787), host: env.HOST ?? "127.0.0.1" });
