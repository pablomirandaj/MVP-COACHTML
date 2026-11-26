// Espacios de trabajo en memoria para la pizarra, el balón parado y las escenas. Los usa la página de Claude
// (todo en el navegador) y pueden usarse en el servidor antes de guardar. Resultados cortos (≤ 1 KB) para el modelo.
import {
  applyBoardCommand, applyPlayCommand, computeScene, createSetPiece, DEFAULT_PITCH,
  type BoardDoc, type Command, type Diagnostic, type EngineContext, type Player, type PlayDoc, type SceneSpec,
} from "@fcs/engine";
import type { LlmToolDef } from "./adapter";
import { commandErrors } from "./validate";
import { commandsTool, type ToolOutcome, type Workspace } from "./loop";

const MAX_RESULT = 1024, MAX_CONTEXT = 4096;
const POS_ES: Record<string, string> = { GK: "POR", RB: "LD", LB: "LI", CB: "DFC", DM: "MCD", CM: "MC", AM: "MCO", RM: "MD", LM: "MI", RW: "ED", LW: "EI", ST: "DC", RWB: "CAD", LWB: "CAI", SS: "SD" };
const FOOT_ES = { RIGHT: "diestro", LEFT: "zurdo", BOTH: "ambidiestro" } as const;

const byteClip = (s: string, n: number) => {
  let out = s;
  while (new TextEncoder().encode(out).length > n) out = out.slice(0, Math.floor(out.length * 0.9));
  return out === s ? s : out + "…";
};
export const rosterLines = (roster: Player[]) => roster.map((p) =>
  `${p.id}·${p.n ?? "-"} ${p.name}${p.surname ? " " + p.surname : ""}·${POS_ES[p.pos] ?? p.pos}·${FOOT_ES[p.foot] ?? ""}${p.status !== "AVAILABLE" ? "·" + p.status : ""}`).join("\n");
const diagLine = (d: { rule_id: string; message: string; severity: string }[]) =>
  d.filter((x) => x.severity !== "info").slice(0, 6).map((x) => ({ rule_id: x.rule_id, message: x.message }));
const result = (o: Record<string, unknown>, is_error = false): ToolOutcome => {
  let content = JSON.stringify(o);
  if (new TextEncoder().encode(content).length > MAX_RESULT) content = byteClip(content, MAX_RESULT);
  return { content, ...(is_error ? { is_error: true } : {}) };
};

export function contextSummary(ws: Workspace): string { return byteClip(ws.context(), MAX_CONTEXT); }

// ---- Pizarra ------------------------------------------------------------------------------
export function boardWorkspace(state: { doc: BoardDoc; roster: Player[]; opponent?: string }, onChange: (doc: BoardDoc) => void): Workspace {
  return {
    kind: "BOARD",
    context() {
      const d = state.doc;
      const steps = d.steps.map((s, i) => `${i + 1}. ${s.id}: ${[
        ...s.moves.map((m) => `${m.actor}→(${m.to.u},${m.to.v}) ${m.kind}`),
        ...(s.pass ? [`pase ${s.pass.from}→${typeof s.pass.to === "string" ? s.pass.to : `(${s.pass.to.u},${s.pass.to.v})`}`] : []),
        ...(s.press ?? []).map((p) => `presión ${p.actor}→${p.target}`),
        ...(s.note ? [`nota "${s.note.title}"`] : []),
      ].join("; ") || "vacío"}`).join("\n");
      return [
        `PIZARRA "${d.title}" · nosotros ${d.own.formation} · rival ${d.opp.formation}${state.opponent ? ` (${state.opponent})` : ""}`,
        `Etiquetas propias: ${Object.entries(d.own.labels).map(([k, v]) => `${k}=${v}`).join(" ")}`,
        `Ranuras rivales: ${Object.keys(d.start.opp).join(" ")}`,
        `Pasos:\n${steps || "(ninguno)"}`,
        `Avisos: ${diagLine(d.diagnostics).map((x) => `${x.rule_id} ${x.message}`).join(" | ") || "ninguno"}`,
        `Plantilla:\n${rosterLines(state.roster)}`,
      ].join("\n");
    },
    tools: (): LlmToolDef[] => [commandsTool("apply_commands", "Aplica comandos board.* a la pizarra (add_step, move, pass, press, note, set_formation, set_labels, rename, remove_step).")],
    async exec(name, input) {
      if (name !== "apply_commands") return result({ error: `Herramienta desconocida: ${name}` }, true);
      const cmds = input?.commands as Command[];
      const err = commandErrors(cmds);
      if (err) return result({ error: err }, true);
      if (cmds.some((c) => !String(c.op).startsWith("board."))) return result({ error: "En la pizarra solo se aceptan comandos board.*" }, true);
      let doc = state.doc;
      try { for (const c of cmds) doc = applyBoardCommand(doc, c, "ASSISTANT").doc; }
      catch (e) { return result({ error: (e as Error).message, applied: 0 }, true); }
      state.doc = doc; onChange(doc);
      return result({ applied: cmds.length, steps: doc.steps.map((s) => s.id), diagnostics: diagLine(doc.diagnostics) });
    },
  };
}

// ---- Balón parado ------------------------------------------------------------------------
const EDIT_OPS = new Set(["play.move_actor", "play.shift_timing", "play.adjust_delivery", "play.set_delivery", "play.set_movement", "play.constraint", "play.assign_player", "play.set_taker", "play.remove_actor", "play.mark"]);
const CREATE_OPS = new Set(["play.create", "play.set_taker", "play.set_delivery", "play.add_roles", "play.set_role", "play.relation", "play.constraint", "assert"]);

export function setPieceWorkspace(state: { doc: PlayDoc | null; type: string; roster: Player[]; opponent?: string; lineupPlayerIds?: string[] }, onChange: (doc: PlayDoc) => void): Workspace {
  const ctx = (): EngineContext => ({ pitch: DEFAULT_PITCH, roster: state.roster, ...(state.lineupPlayerIds ? { lineupPlayerIds: state.lineupPlayerIds } : {}) });
  const summary = (d: PlayDoc) => {
    const name = (pid?: string | null) => { const p = state.roster.find((x) => x.id === pid); return p ? `${p.n ?? "-"} ${p.name}` : "—"; };
    return `${d.type} · lado ${d.side} · golpeo ${d.delivery.swing} ${d.delivery.trajectory} a ${d.delivery.target_zone}\n` +
      d.actors.filter((a) => a.team === "OWN").map((a) => `${a.id} ${a.role} ${name(a.player_id)}${a.action_zone ? " " + a.action_zone : ""}`).join("\n") +
      `\nRivales: ${d.actors.filter((a) => a.team === "OPP").map((a) => `${a.id}(${a.label})`).join(" ")}`;
  };
  const clar = (c: { question: string; options: { label: string; commands: Command[] }[] }) => ({ clarification: c.question, options: c.options.map((o) => ({ label: o.label, commands: o.commands })) });
  return {
    kind: "SETPIECE",
    context: () => [
      `BALÓN PARADO ${state.type}${state.opponent ? ` contra ${state.opponent}` : ""}`,
      state.doc ? summary(state.doc) : "Aún no creado: usa create_setpiece con play.create {type, side, …}.",
      `Avisos: ${state.doc ? diagLine(state.doc.diagnostics).map((x) => `${x.rule_id} ${x.message}`).join(" | ") || "ninguno" : "—"}`,
      `Plantilla:\n${rosterLines(state.roster)}`,
    ].join("\n"),
    tools: () => [
      commandsTool("create_setpiece", "Crea o rehace la jugada: play.create {type, side, depth_m?, distance_m?, variant?, scheme?} y comandos de creación."),
      commandsTool("apply_commands", "Edita la jugada actual con comandos play.* de edición (incluido play.mark en defensa)."),
    ],
    async exec(name, input) {
      const cmds = input?.commands as Command[];
      const err = commandErrors(cmds);
      if (err) return result({ error: err }, true);
      if (name === "create_setpiece") {
        if (cmds.some((c) => !CREATE_OPS.has(c.op))) return result({ error: "Operación no válida para crear: usa play.create y comandos de creación." }, true);
        const r = createSetPiece(cmds, ctx());
        if (r.clarifications.length) return result(clar(r.clarifications[0]));
        if (!r.doc) return result({ error: r.diagnostics.map((d) => d.message).join(" ") }, true);
        state.doc = r.doc; state.type = r.doc.type; onChange(r.doc);
        return result({ created: r.doc.type, diagnostics: diagLine(r.doc.diagnostics) });
      }
      if (name === "apply_commands") {
        if (!state.doc) return result({ error: "No hay jugada: créala antes con create_setpiece." }, true);
        if (cmds.some((c) => !EDIT_OPS.has(c.op))) return result({ error: "Operación no válida para editar una jugada." }, true);
        let doc = state.doc;
        for (const c of cmds) {
          const r = applyPlayCommand(doc, c, ctx());
          if (r.clarifications.length) { if (doc !== state.doc) { state.doc = doc; onChange(doc); } return result(clar(r.clarifications[0])); }
          doc = r.doc;
        }
        state.doc = doc; onChange(doc);
        return result({ applied: cmds.length, diagnostics: diagLine(doc.diagnostics as Diagnostic[]) });
      }
      return result({ error: `Herramienta desconocida: ${name}` }, true);
    },
  };
}

// ---- Escenas de fases de juego -------------------------------------------------------------
const SCENE_TOOL: LlmToolDef = {
  name: "update_scene",
  description: "Sustituye la especificación completa de la escena (type, own, opp, params, keyframes). El motor recalcula las posiciones.",
  input_schema: { type: "object", additionalProperties: false, required: ["spec"], properties: { spec: { type: "object", required: ["type", "own", "opp", "params", "keyframes"] } } },
};

export function sceneWorkspace(state: { spec: SceneSpec; roster: Player[]; opponent?: string }, onChange: (spec: SceneSpec) => void): Workspace {
  return {
    kind: "SCENE",
    context: () => [`ESCENA${state.opponent ? ` contra ${state.opponent}` : ""} (especificación actual):`, JSON.stringify(state.spec), `Plantilla:\n${rosterLines(state.roster)}`].join("\n"),
    tools: () => [SCENE_TOOL],
    async exec(name, input) {
      if (name !== "update_scene") return result({ error: `Herramienta desconocida: ${name}` }, true);
      const spec = input?.spec as SceneSpec;
      try {
        const doc = computeScene(spec, DEFAULT_PITCH);
        state.spec = spec; onChange(spec);
        return result({ frames: doc.frames.length, diagnostics: diagLine(doc.diagnostics), ...(doc.target_space ? { space: doc.target_space.kind } : {}) });
      } catch (e) { return result({ error: (e as Error).message }, true); }
    },
  };
}
