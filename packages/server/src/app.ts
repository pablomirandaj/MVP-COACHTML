import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { existsSync } from "node:fs";
import type { LlmAdapter } from "./assistant/adapter";
import { one, type Db, type Tx } from "./db";
import { HttpError, sha256 } from "./util";
import { authRoutes } from "./routes/auth";
import { teamRoutes } from "./routes/teams";
import { playerRoutes } from "./routes/players";
import { matchRoutes } from "./routes/matches";
import { lineupRoutes } from "./routes/lineups";
import { playRoutes } from "./routes/plays";
import { sceneRoutes } from "./routes/scenes";
import { presentationRoutes } from "./routes/presentation";
import { assistantRoutes } from "./routes/assistant";

export interface AppOptions {
  db: Db;
  secureCookies?: boolean;
  /** Ruta al ejecutable de Chromium para generar PDF (docs/20 §5). */
  chromiumPath?: string;
  /** Adaptador del asistente (31); si falta, el asistente responde 503. */
  llm?: LlmAdapter | null;
  /** Carpeta con la web compilada (packages/web/dist) para servirla en producción. */
  webDist?: string;
  logger?: boolean;
}

export interface SessionUser { id: string; email: string; display_name: string }

declare module "fastify" {
  interface FastifyRequest { user: SessionUser | null }
  interface FastifyInstance { opts: AppOptions }
}

export const SESSION_COOKIE = "fcs_session";
const STAFF = ["HEAD_COACH", "ASSISTANT_COACH", "ANALYST", "CLUB_ADMIN"];

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ? { level: "info" } : false, bodyLimit: 2 * 1024 * 1024 });
  app.decorate("opts", opts);
  await app.register(cookie);
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const u = await one<SessionUser>(opts.db,
      `SELECT u.id, u.email, u.display_name FROM user_session s JOIN app_user u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > now() AND u.deleted_at IS NULL`, [sha256(token)]);
    req.user = u;
  });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).type("application/problem+json").send({ status: err.status, code: err.code, title: err.message, ...err.extra });
    }
    if (err.validation) return reply.status(422).type("application/problem+json").send({ status: 422, code: "VALIDATION_ERROR", title: err.message });
    app.log.error(err);
    return reply.status(500).type("application/problem+json").send({ status: 500, code: "INTERNAL", title: "Error interno" });
  });

  await app.register(async (api) => {
    await authRoutes(api);
    await teamRoutes(api);
    await playerRoutes(api);
    await matchRoutes(api);
    await lineupRoutes(api);
    await playRoutes(api);
    await sceneRoutes(api);
    await presentationRoutes(api);
    await assistantRoutes(api);
  }, { prefix: "/api" });

  if (opts.webDist && existsSync(opts.webDist)) {
    await app.register(fastifyStatic, { root: opts.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ status: 404, code: "NOT_FOUND", title: "No encontrado" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  return req.user;
}

/** Comprueba que el usuario pertenece al cuerpo técnico del equipo (docs/21 §2). */
export async function requireStaff(c: Tx | Db, userId: string, teamId: string): Promise<string> {
  const m = await one<{ role: string }>(c,
    `SELECT role FROM team_membership WHERE team_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role = ANY($3) LIMIT 1`,
    [teamId, userId, STAFF]);
  if (!m) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
  return m.role;
}

/** Resuelve el equipo de un recurso y comprueba permisos en una sola llamada. */
export async function teamOf(c: Tx | Db, userId: string, table: string, id: string): Promise<string> {
  if (!/^[a-z_]+$/.test(table)) throw new Error("tabla inválida");
  const r = await one<{ team_id: string }>(c, `SELECT team_id FROM ${table} WHERE id = $1`, [id]);
  if (!r) throw new HttpError(404, "NOT_FOUND", "No encontrado.");
  await requireStaff(c, userId, r.team_id);
  return r.team_id;
}

export const noContent = (reply: FastifyReply) => reply.status(204).send();
