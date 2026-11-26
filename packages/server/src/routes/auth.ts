import type { FastifyInstance } from "fastify";
import { requireUser, SESSION_COOKIE } from "../app";
import { many, one } from "../db";
import { hashPassword, HttpError, newToken, sha256, uuidv7, verifyPassword } from "../util";

const SESSION_DAYS = 30;

export async function authRoutes(app: FastifyInstance) {
  const db = app.opts.db;
  const setSession = async (userId: string, reply: any) => {
    const token = newToken();
    await db.query("INSERT INTO user_session(id, user_id, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)", [sha256(token), userId, String(SESSION_DAYS)]);
    reply.setCookie(SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", secure: !!app.opts.secureCookies, maxAge: SESSION_DAYS * 86400 });
  };

  app.post<{ Body: { email: string; password: string; display_name: string } }>("/auth/register", {
    schema: { body: { type: "object", required: ["email", "password", "display_name"], properties: {
      email: { type: "string", format: "email", maxLength: 200 }, password: { type: "string", minLength: 8, maxLength: 200 }, display_name: { type: "string", minLength: 1, maxLength: 100 } } } },
  }, async (req, reply) => {
    const email = req.body.email.trim().toLowerCase();
    if (await one(db, "SELECT 1 FROM app_user WHERE email = $1", [email])) throw new HttpError(409, "EMAIL_TAKEN", "Ya existe una cuenta con ese email.");
    const id = uuidv7();
    await db.query("INSERT INTO app_user(id, email, display_name, password_hash) VALUES ($1,$2,$3,$4)", [id, email, req.body.display_name.trim(), await hashPassword(req.body.password)]);
    await setSession(id, reply);
    return reply.status(201).send({ id, email, display_name: req.body.display_name.trim() });
  });

  app.post<{ Body: { email: string; password: string } }>("/auth/login", {
    schema: { body: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } } },
  }, async (req, reply) => {
    const u = await one<{ id: string; email: string; display_name: string; password_hash: string }>(db,
      "SELECT id, email, display_name, password_hash FROM app_user WHERE email = $1 AND deleted_at IS NULL", [req.body.email.trim().toLowerCase()]);
    if (!u || !(await verifyPassword(req.body.password, u.password_hash))) throw new HttpError(401, "BAD_CREDENTIALS", "Email o contraseña incorrectos.");
    await setSession(u.id, reply);
    return { id: u.id, email: u.email, display_name: u.display_name };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.query("DELETE FROM user_session WHERE id = $1", [sha256(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/me", async (req) => {
    const u = requireUser(req);
    const teams = await many(db,
      `SELECT t.id, t.name, t.category, s.label AS season, m.role FROM team_membership m
       JOIN team t ON t.id = m.team_id JOIN season s ON s.id = t.season_id
       WHERE m.user_id = $1 AND m.revoked_at IS NULL AND t.deleted_at IS NULL ORDER BY t.created_at`, [u.id]);
    return { ...u, teams };
  });
}
