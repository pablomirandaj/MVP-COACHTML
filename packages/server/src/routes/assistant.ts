// Ruta del asistente conversacional (docs/31). Cada turno: mensaje → bucle con el modelo → cambios validados por
// el motor → se guardan como una versión nueva (origen ASSISTANT) que el entrenador puede deshacer.
import { applyLineupCommand, emptyLineup, type Command, type EngineContext, type LineupDoc, type PlayDoc, type SceneSpec } from "@fcs/engine";
import type { FastifyInstance } from "fastify";
import { requireStaff, requireUser, teamOf } from "../app";
import type { LlmMessage } from "../assistant/adapter";
import { commandErrors, commandsTool, runTurn, type ToolOutcome, type Workspace } from "../assistant/run";
import { many, one, tx, type Tx } from "../db";
import { applyEdits, currentDoc, insertVersion, logCommands, planPlay, PLAY_CREATE_OPS, PLAY_EDIT_OPS } from "../plays";
import { formationId, loadPrimaryLineup, teamContext } from "../repo";
import { HttpError, uuidv7 } from "../util";
import { buildScene } from "./scenes";

const LINEUP_OPS = new Set(["lineup.set_formation", "lineup.assign", "lineup.assign_group", "lineup.substitute", "lineup.swap", "lineup.shift_group", "lineup.shift_slot", "lineup.compact", "lineup.clear_slot"]);

const rosterText = (ctx: EngineContext) => ctx.roster
  .map((p) => `- ${p.id} · ${p.n ?? "-"} ${p.name}${p.surname ? " " + p.surname : ""} · ${p.pos}${p.secondary?.length ? "/" + p.secondary.join("/") : ""} · ${p.foot === "RIGHT" ? "diestro" : p.foot === "LEFT" ? "zurdo" : "ambidiestro"}${p.height ? ` · ${p.height} cm` : ""}${p.tags?.length ? ` · ${p.tags.join(", ")}` : ""}${p.status !== "AVAILABLE" ? ` · ${p.status}` : ""}`)
  .join("\n");

function playSummary(doc: PlayDoc, ctx: EngineContext): string {
  const name = (pid?: string | null) => { const p = ctx.roster.find((x) => x.id === pid); return p ? `${p.name} (${p.n ?? "-"})` : "—"; };
  const m = (u: number, v: number) => `x=${(u * doc.pitch.length_m).toFixed(1)} y=${(v * doc.pitch.width_m).toFixed(1)}`;
  const own = doc.actors.filter((a) => a.team === "OWN").map((a) => {
    const mv = doc.movements.find((x) => x.actor === a.id);
    const prop = String(a.provenance.role ?? "").startsWith("RULE:") ? " [propuesta]" : "";
    return `- ${a.id} ${a.role}${prop} · ${name(a.player_id)} · zona ${a.action_zone ?? "-"} · inicio ${m(a.start.u, a.start.v)}${mv ? ` · ${mv.type} ${mv.t_start}s→${mv.t_end}s` : ""}`;
  }).join("\n");
  const d = doc.delivery;
  return `Córner ${doc.side === "LEFT" ? "izquierda" : "derecha"} · golpeo ${d.swing} ${d.trajectory} al ${d.target_zone} · llegada ${d.arrival_t}s\nPropios:\n${own}\nRivales: ${doc.actors.filter((a) => a.team === "OPP").length} (defensa por defecto)\nRestricciones: ${doc.constraints.map((c) => `${c.actor} ${c.rule}`).join(", ") || "ninguna"}\nAvisos: ${doc.diagnostics.filter((x) => x.severity !== "info").map((x) => `${x.rule_id}: ${x.message}`).join(" | ") || "ninguno"}`;
}

function lineupSummary(doc: LineupDoc, ctx: EngineContext): string {
  const name = (pid: string | null) => { const p = ctx.roster.find((x) => x.id === pid); return p ? `${p.name} (${p.n ?? "-"}) ${p.id}` : "vacía"; };
  return `Formación ${doc.formation}\n${Object.entries(doc.slots).map(([s, p]) => `- ${s}: ${name(p)}`).join("\n")}`;
}

const clarText = (c: { question: string; options: { label: string; commands: Command[] }[] }) =>
  `El motor necesita una aclaración y NO ha aplicado nada: "${c.question}". Opciones (comandos exactos para cada una):\n` +
  c.options.map((o, i) => `${i + 1}. ${o.label}: ${JSON.stringify(o.commands)}`).join("\n") +
  `\nSi el mensaje del entrenador ya decide la opción, envía esos comandos; si no, usa ask_coach.`;

function checkPlayers(commands: Command[], ctx: EngineContext): string | null {
  const ids = new Set(ctx.roster.map((p) => p.id));
  for (const c of commands) for (const k of ["player", "out", "in", "a", "b"]) if (c[k] && !ids.has(c[k])) return `Jugador desconocido: ${c[k]}`;
  for (const c of commands) for (const p of c.players ?? []) if (!ids.has(p)) return `Jugador desconocido: ${p}`;
  for (const c of commands) if (c.target?.player && !ids.has(c.target.player)) return `Jugador desconocido: ${c.target.player}`;
  return null;
}

export async function assistantRoutes(app: FastifyInstance) {
  const db = app.opts.db;

  app.post<{ Body: { target_type: "PLAY" | "NEW_PLAY" | "SCENE" | "LINEUP"; target_id: string; match_id?: string; message: string } }>("/assistant/turns", {
    schema: { body: { type: "object", required: ["target_type", "target_id", "message"], properties: {
      target_type: { enum: ["PLAY", "NEW_PLAY", "SCENE", "LINEUP"] }, target_id: { type: "string", format: "uuid" }, match_id: { type: "string", format: "uuid" },
      message: { type: "string", minLength: 1, maxLength: 2000 } } } },
  }, async (req) => {
    const u = requireUser(req);
    const llm = app.opts.llm;
    if (!llm) throw new HttpError(503, "ASSISTANT_UNAVAILABLE", "El asistente no está configurado en este servidor.");
    const { target_type, target_id, message } = req.body;

    // 1. Cargar el objetivo y preparar el espacio de trabajo (borrador en memoria).
    const loaded = await tx(db, u.id, async (c) => {
      if (target_type === "PLAY") {
        const teamId = await teamOf(c, u.id, "tactical_play", target_id);
        const cur = await currentDoc(c, target_id);
        return { teamId, ctx: await teamContext(c, teamId, cur.match_id), play: cur, matchId: cur.match_id };
      }
      if (target_type === "NEW_PLAY") {
        await requireStaff(c, u.id, target_id);
        return { teamId: target_id, ctx: await teamContext(c, target_id, req.body.match_id), matchId: req.body.match_id ?? null };
      }
      if (target_type === "SCENE") {
        const teamId = await teamOf(c, u.id, "phase_scene", target_id);
        const s = await one<{ spec: SceneSpec; match_id: string | null; revision: number }>(c, "SELECT spec, match_id, revision FROM phase_scene WHERE id = $1", [target_id]);
        return { teamId, ctx: await teamContext(c, teamId), scene: s!, matchId: s!.match_id };
      }
      const teamId = await teamOf(c, u.id, "match", target_id);
      const l = await loadPrimaryLineup(c, target_id);
      return { teamId, ctx: await teamContext(c, teamId), lineup: l, matchId: target_id };
    });
    const ctx = loaded.ctx;
    const history: LlmMessage[] = (await many<{ message: string; reply: string | null }>(db,
      `SELECT message, reply FROM assistant_turn WHERE user_id = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 6`,
      [u.id, target_id])).reverse()
      .flatMap((t) => [{ role: "user" as const, content: [{ type: "text" as const, text: t.message }] }, { role: "assistant" as const, content: [{ type: "text" as const, text: t.reply || "(sin respuesta)" }] }]);

    let playDoc: PlayDoc | null = (loaded as any).play?.doc ?? null;
    let created: { doc: PlayDoc; commands: Command[] } | null = null;
    const playCommands: Command[] = [];
    let lineupDoc: LineupDoc | null = (loaded as any).lineup?.doc ?? null;
    const lineupCommands: Command[] = [];
    let sceneSpec: SceneSpec | null = (loaded as any).scene?.spec ?? null;
    let sceneChanged = false;

    const ws: Workspace = {
      kind: target_type,
      context: () => {
        const parts = [`Plantilla (id · dorsal nombre · posición · pie · …):\n${rosterText(ctx)}`];
        if (target_type === "PLAY" || created) parts.push(`Jugada actual:\n${playSummary(playDoc!, ctx)}`);
        if (target_type === "NEW_PLAY") parts.push("Aún no hay jugada: créala con create_corner.");
        if (target_type === "LINEUP") parts.push(lineupDoc ? `Alineación actual:\n${lineupSummary(lineupDoc, ctx)}` : "No hay alineación todavía (empieza con lineup.set_formation).");
        if (target_type === "SCENE") parts.push(`Escena actual (especificación):\n${JSON.stringify(sceneSpec)}`);
        return parts.join("\n\n");
      },
      tools: () => {
        if (target_type === "SCENE") return [{ name: "update_scene", description: "Sustituye la especificación completa de la escena; el motor recalcula las posiciones y devuelve los avisos.",
          input_schema: { type: "object", additionalProperties: false, required: ["spec"], properties: { spec: { type: "object" } } } }];
        if (target_type === "LINEUP") return [commandsTool("apply_commands", "Aplica comandos lineup.* a la alineación del partido.")];
        const t = [commandsTool("apply_commands", "Aplica comandos play.* de edición a la jugada actual.")];
        if (target_type === "NEW_PLAY") t.unshift(commandsTool("create_corner", "Crea un córner ofensivo a partir de comandos de creación (play.create y siguientes)."));
        return t;
      },
      exec: async (name, input): Promise<ToolOutcome> => {
        if (name === "update_scene") {
          try {
            const r = await tx(db, u.id, (c) => buildScene(c, loaded.teamId, loaded.matchId, input.spec));
            sceneSpec = r.spec; sceneChanged = true;
            const warn = r.doc.diagnostics.map((d) => `${d.rule_id}: ${d.message}`).join(" | ");
            return { content: `Escena recalculada (${r.doc.frames.length} fotogramas). Avisos: ${warn || "ninguno"}` };
          } catch (e) { return { content: (e as Error).message, is_error: true }; }
        }
        const commands = input?.commands as Command[];
        const err = commandErrors(commands) ?? checkPlayers(commands ?? [], ctx);
        if (err) return { content: err, is_error: true };
        if (name === "create_corner") {
          if (created) return { content: "La jugada ya está creada; usa apply_commands para editarla.", is_error: true };
          const bad = commands.find((c) => !PLAY_CREATE_OPS.has(c.op));
          if (bad) return { content: `Operación no válida para crear: ${bad.op}`, is_error: true };
          try {
            const out = planPlay(commands, ctx);
            if (out.clarifications.length) return { content: clarText(out.clarifications[0]) };
            if (!out.doc) return { content: out.diagnostics.map((d) => d.message).join(" ") || "No se pudo crear.", is_error: true };
            created = { doc: out.doc, commands }; playDoc = out.doc;
            return { content: `Córner creado.\n${playSummary(out.doc, ctx)}` };
          } catch (e) { return { content: (e as Error).message, is_error: true }; }
        }
        if (name === "apply_commands" && target_type === "LINEUP") {
          const bad = commands.find((c) => !LINEUP_OPS.has(c.op));
          if (bad) return { content: `Operación no válida para alineaciones: ${bad.op}`, is_error: true };
          let doc = lineupDoc ?? emptyLineup(commands.find((c) => c.op === "lineup.set_formation")?.formation ?? "F_433");
          for (const cmd of commands) {
            const r = applyLineupCommand(doc, cmd, ctx);
            if (r.clarifications.length) return { content: clarText(r.clarifications[0]) };
            doc = r.doc;
          }
          lineupDoc = doc; lineupCommands.push(...commands);
          return { content: `Alineación actualizada.\n${lineupSummary(doc, ctx)}` };
        }
        if (name === "apply_commands") {
          if (!playDoc) return { content: "Primero crea la jugada con create_corner.", is_error: true };
          const bad = commands.find((c) => !PLAY_EDIT_OPS.has(c.op));
          if (bad) return { content: `Operación no válida para editar: ${bad.op}`, is_error: true };
          const out = applyEdits(playDoc, commands, ctx);
          if (out.clarifications.length) return { content: clarText(out.clarifications[0]) };
          playDoc = out.doc!;
          playCommands.push(...commands);
          return { content: `Aplicado.\n${playSummary(playDoc, ctx)}` };
        }
        return { content: `Herramienta desconocida: ${name}`, is_error: true };
      },
    };

    const result = await runTurn(llm, ws, history, message);

    // 2. Guardar lo que el motor aceptó como versión nueva y registrar el turno.
    return tx(db, u.id, async (c) => {
      let targetId = target_id;
      let changed = false;
      if (target_type === "NEW_PLAY" && created) {
        const c1 = created as { doc: PlayDoc; commands: Command[] };
        const id = uuidv7();
        const create = c1.commands.find((x) => x.op === "play.create")!;
        await c.query("INSERT INTO tactical_play(id, team_id, type, name, created_by) VALUES ($1,$2,'CORNER_ATT',$3,$4)",
          [id, loaded.teamId, `Córner ${create.side === "LEFT" ? "izquierda" : "derecha"} · asistente`, u.id]);
        if (loaded.matchId) await c.query("INSERT INTO match_play(match_id, play_id) VALUES ($1,$2)", [loaded.matchId, id]);
        await insertVersion(c, id, 1, null, c1.doc, u.id);
        await logCommands(c, loaded.teamId, id, null, 1, u.id, c1.commands, "ASSISTANT");
        if (playCommands.length) {
          await insertVersion(c, id, 2, 1, playDoc!, u.id);
          await logCommands(c, loaded.teamId, id, 1, 2, u.id, playCommands, "ASSISTANT");
        }
        targetId = id; changed = true;
      } else if (target_type === "PLAY" && playCommands.length) {
        const cur = await currentDoc(c, target_id);
        if (cur.version !== (loaded as any).play.version) throw new HttpError(409, "STALE_REVISION", "La jugada cambió mientras el asistente trabajaba; repite la petición.");
        await c.query("UPDATE parsed_command SET status = 'REJECTED' WHERE target_id = $1 AND status = 'UNDONE'", [target_id]);
        await insertVersion(c, target_id, cur.version + 1, cur.version, playDoc!, u.id);
        await logCommands(c, loaded.teamId, target_id, cur.version, cur.version + 1, u.id, playCommands, "ASSISTANT");
        changed = true;
      } else if (target_type === "SCENE" && sceneChanged) {
        const { doc } = await buildScene(c, loaded.teamId, loaded.matchId, sceneSpec!);
        const { canonicalHash, ENGINE_VERSION } = await import("@fcs/engine");
        await c.query(`UPDATE phase_scene SET spec = $2, document = $3, document_hash = $4, engine_version = $5, revision = revision + 1, updated_at = now() WHERE id = $1`,
          [target_id, JSON.stringify(sceneSpec), JSON.stringify(doc), canonicalHash(doc), ENGINE_VERSION]);
        changed = true;
      } else if (target_type === "LINEUP" && lineupCommands.length) {
        await saveLineup(c, target_id, loaded.teamId, u.id, lineupDoc!, lineupCommands);
        changed = true;
      }
      await c.query(`INSERT INTO assistant_turn(id, team_id, user_id, target_type, target_id, message, reply, commands, clarification, provider, model, input_tokens, output_tokens)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [uuidv7(), loaded.teamId, u.id, target_type === "SCENE" ? "PHASE_SCENE" : target_type === "LINEUP" ? "LINEUP" : "TACTICAL_PLAY",
          target_type === "NEW_PLAY" && !changed ? target_id : targetId, message, result.clarification ? `${result.reply}\n${result.clarification.question}`.trim() : result.reply,
          JSON.stringify(target_type === "LINEUP" ? lineupCommands : target_type === "SCENE" ? (sceneChanged ? [{ op: "scene.update" }] : []) : [...(created ? (created as any).commands : []), ...playCommands]),
          result.clarification ? JSON.stringify(result.clarification) : null, llm.provider, llm.model, result.usage.input_tokens, result.usage.output_tokens]);
      return {
        reply: result.reply, clarification: result.clarification, changed,
        target: { type: target_type === "NEW_PLAY" ? (changed ? "PLAY" : "NEW_PLAY") : target_type, id: targetId },
        usage: result.usage,
      };
    });
  });
}

async function saveLineup(c: Tx, matchId: string, teamId: string, userId: string, doc: LineupDoc, commands: Command[]) {
  const cur = await loadPrimaryLineup(c, matchId);
  const fid = await formationId(c, doc.formation);
  let id = cur?.id;
  if (!id) {
    id = uuidv7();
    await c.query("INSERT INTO lineup(id, team_id, match_id, formation_id, is_primary, slot_overrides, created_by) VALUES ($1,$2,$3,$4,true,$5,$6)", [id, teamId, matchId, fid, JSON.stringify(doc.overrides), userId]);
  } else {
    await c.query("UPDATE lineup SET formation_id = $2, slot_overrides = $3, revision = revision + 1, state = 'DRAFT', updated_at = now() WHERE id = $1", [id, fid, JSON.stringify(doc.overrides)]);
  }
  await c.query("DELETE FROM lineup_assignment WHERE lineup_id = $1", [id]);
  for (const [slot, pid] of Object.entries(doc.slots)) if (pid) await c.query("INSERT INTO lineup_assignment(lineup_id, slot, player_id, provenance) VALUES ($1,$2,$3,$4)", [id, slot, pid, doc.slot_provenance[slot] ?? "ASSISTANT"]);
  await c.query(`INSERT INTO parsed_command(id, team_id, nlu_version, ir, status, target_type, target_id, applied_by, applied_at, source) VALUES ($1,$2,'n/a',$3,'APPLIED','LINEUP',$4,$5,now(),'ASSISTANT')`,
    [uuidv7(), teamId, JSON.stringify({ commands }), id, userId]);
}
