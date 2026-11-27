// Planes de juego predefinidos: especificaciones de escena listas para editar, válidas para cualquier sistema.
import { FORMATIONS, type Jump, type SceneSpec, type SceneType } from "@fcs/engine";

export type PlanId = "BUILD_UP" | "PRESS_HIGH" | "PRESS_MID" | "ATTACK_SPACE" | "RETREAT" | "REST_DEFENSE" | "PRESS_OPP";
export const PLANS: { id: PlanId; type: SceneType; label: string; desc: string }[] = [
  { id: "BUILD_UP", type: "BUILD_UP", label: "Salida de balón", desc: "Cómo salimos desde el portero contra su presión" },
  { id: "PRESS_HIGH", type: "PRESS_OWN", label: "Presión alta", desc: "Cuándo saltamos y quién cubre" },
  { id: "PRESS_MID", type: "PRESS_OWN", label: "Presión media", desc: "Bloque medio que salta en su pase interior" },
  { id: "ATTACK_SPACE", type: "ATTACK_SPACE", label: "Atacar espacios", desc: "Entre líneas, a la espalda del lateral o al lado débil" },
  { id: "RETREAT", type: "RETREAT", label: "Repliegue", desc: "Bloque bajo, basculación y lado del balón" },
  { id: "REST_DEFENSE", type: "REST_DEFENSE", label: "Vigilancias", desc: "Quién se queda cuando atacamos" },
  { id: "PRESS_OPP", type: "PRESS_OPP", label: "Su presión", desc: "Cómo nos presionan y dónde está la salida" },
];
export const planOf = (spec: SceneSpec): PlanId => spec.type === "PRESS_OWN" ? (spec.params.block_height === "MID" ? "PRESS_MID" : "PRESS_HIGH") : (spec.type as PlanId);

const slots = (f: string) => new Set(FORMATIONS[f]?.slots.map((s) => s.slot) ?? []);
const pick = (f: string, ...cands: string[]) => { const s = slots(f); return cands.find((c) => s.has(c)) ?? [...s][1]; };
const jumps = (own: string, opp: string, list: [string[], string[], ("SCREEN_GK" | undefined)?][]): Jump[] =>
  list.map(([w, t, curve]) => ({ who: pick(own, ...w), to: pick(opp, ...t), ...(curve ? { curve } : {}) })).filter((j, i, a) => j.who && j.to && a.findIndex((x) => x.who === j.who) === i);

export function presetScene(id: PlanId, own = "F_433", opp = "F_442"): SceneSpec {
  const kf = (holders: string[], trigger = -1) => holders.map((h, i) => ({ t: i * 1.5, ball: { holder: h }, ...(i === trigger ? { event: "TRIGGER" as const } : {}) }));
  switch (id) {
    case "BUILD_UP": return { type: "BUILD_UP", own: { formation: own }, opp: { formation: opp }, params: { structure: "3+1", opp_pressers: 2 },
      keyframes: kf(["GK", pick(own, "CB_L", "CB"), pick(own, "DM", "CM_L", "CM")]) };
    case "PRESS_HIGH": return { type: "PRESS_OWN", own: { formation: own }, opp: { formation: opp }, params: { block_height: "HIGH",
      jumps: jumps(own, opp, [[["LW", "LM", "ST_L"], ["RB", "RWB"]], [["ST", "ST_L", "SS"], ["CB_R", "CB"], "SCREEN_GK"], [["CM_L", "AM", "CM"], ["CM_R", "DM", "CM"]]]) },
      keyframes: kf(["GK", pick(opp, "CB_R", "CB"), pick(opp, "RB", "RWB")], 2) };
    case "PRESS_MID": return { type: "PRESS_OWN", own: { formation: own }, opp: { formation: opp }, params: { block_height: "MID",
      jumps: jumps(own, opp, [[["CM_L", "CM", "DM"], ["CM_R", "CM", "DM"]], [["ST", "ST_L"], ["CB_R", "CB"]]]) },
      keyframes: kf([pick(opp, "CB_L", "CB"), pick(opp, "CB_R", "CB"), pick(opp, "CM_R", "DM", "CM")], 2) };
    case "ATTACK_SPACE": return { type: "ATTACK_SPACE", own: { formation: own }, opp: { formation: opp }, params: { block_height: "MID", target: "BETWEEN_LINES" },
      keyframes: kf([pick(own, "CB_L", "CB"), pick(own, "CM_L", "CM", "DM"), pick(own, "CM_L", "CM", "DM")], 2) };
    case "RETREAT": return { type: "RETREAT", own: { formation: own }, opp: { formation: opp }, params: { block_height: "LOW" },
      keyframes: kf([pick(opp, "CM_L", "CM", "DM"), pick(opp, "LM", "LW", "LB"), pick(opp, "LB", "LWB")]) };
    case "REST_DEFENSE": return { type: "REST_DEFENSE", own: { formation: own }, opp: { formation: opp }, params: {},
      keyframes: kf([pick(own, "CM_R", "CM"), pick(own, "RW", "RM"), pick(own, "ST", "ST_R")]) };
    case "PRESS_OPP": return { type: "PRESS_OPP", own: { formation: own }, opp: { formation: opp }, params: { block_height: "HIGH",
      jumps: jumps(opp, own, [[["ST_R", "ST"], ["CB_L", "CB"]], [["RM", "RW"], ["LB", "LWB"]]]) },
      keyframes: kf(["GK", pick(own, "CB_L", "CB"), pick(own, "LB", "LWB")], 2) };
  }
}

/** Cambia el sistema propio o rival conservando el tipo de plan y sus parámetros principales. */
export function withFormations(spec: SceneSpec, own: string, opp: string): SceneSpec {
  const base = presetScene(planOf(spec), own, opp);
  const { jumps: _j, ...keep } = spec.params;
  return { ...base, title: spec.title, params: { ...base.params, ...keep, ...(base.params.jumps ? { jumps: base.params.jumps } : {}) } };
}
