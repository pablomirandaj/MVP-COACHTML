import { describe, expect, it } from "vitest";
import { applyPlayCommand, canonicalHash, diff, record, startHistory, touchedPaths, undo, redo, type PlayDoc } from "@fcs/engine";
import { cornerDoc, ctxLucasRight } from "./fixtures";

const C = ctxLucasRight();
const actor = (d: PlayDoc, id: string) => d.actors.find((a) => a.id === id)!;
const mov = (d: PlayDoc, id: string) => d.movements.find((m) => m.id === id)!;
/** Ids de actores y movimientos cuyo contenido cambia entre dos documentos. */
function touched(a: PlayDoc, b: PlayDoc): string[] {
  const out: string[] = [];
  for (const x of a.actors) if (JSON.stringify(x) !== JSON.stringify(actor(b, x.id))) out.push(x.id);
  for (const m of a.movements) if (JSON.stringify(m) !== JSON.stringify(mov(b, m.id))) out.push(m.id);
  return out.sort();
}

describe("Córner — edición incremental", () => {
  it("T-EDT-01 mover a los dos del segundo palo 1 m a la izquierda solo toca a esos dos y lo que depende de ellos", () => {
    const d0 = cornerDoc();
    const r = applyPlayCommand(d0, { op: "play.move_actor", target: { zone: "Z_FAR_POST", expect_count: 2 }, dx_m: 0, dy_m: -1 }, C);
    expect(r.changed).toBe(true);
    expect(actor(r.doc, "a2").start.v).toBe(+(actor(d0, "a2").start.v - 1 / 68).toFixed(4));
    expect(actor(r.doc, "a3").start.v).toBe(+(actor(d0, "a3").start.v - 1 / 68).toFixed(4));
    // a2/a3 y sus carreras; mo8 es el marcador que sigue a a3 (dependiente de m3).
    expect(touched(d0, r.doc)).toEqual(["a2", "a3", "m2", "m3", "mo8"]);
    expect(r.doc.delivery).toEqual(d0.delivery);
  });

  it("T-EDT-02/03 «retrasa al del rechace»: pregunta y luego retrasa a los dos 3 m", () => {
    const d0 = cornerDoc();
    const r = applyPlayCommand(d0, { op: "play.move_actor", target: { role: "REBOUND", expect_count: 1 }, dx_m: -3 }, C);
    expect(r.changed).toBe(false);
    expect(r.clarifications[0].options.map((o) => o.label)).toEqual([
      "Al de la izquierda (6, Sergio)", "Al de la derecha (8, Adrián)", "A los dos",
    ]);
    const r2 = applyPlayCommand(d0, r.clarifications[0].options[2].commands[0], C);
    expect(actor(r2.doc, "a7").start.u).toBe(0.7952);
    expect(actor(r2.doc, "a8").start.u).toBe(0.7952);
    expect(touched(d0, r2.doc)).toEqual(["a7", "a8", "m7", "m8"]);
  });

  it("T-EDT-04 el 5 ataca el primer palo: avisa de que nadie ataca el destino del balón", () => {
    const r = applyPlayCommand(cornerDoc(), { op: "play.set_movement", target: { player: "pl_5" }, movement: "ATTACK_NEAR_POST" }, C);
    expect(r.diagnostics.find((d) => d.rule_id === "TAC-CRN-TGT-01")?.severity).toBe("warning");
  });

  it("T-EDT-05 el bloqueo empieza 0,5 s antes y el resto no cambia", () => {
    const d0 = cornerDoc();
    const r = applyPlayCommand(d0, { op: "play.shift_timing", target: { role: "BLOCKER" }, delta_s: -0.5 }, C);
    expect(mov(r.doc, "m2").t_start).toBeCloseTo(mov(d0, "m2").t_start - 0.5, 2);
    expect(mov(r.doc, "m2").t_end).toBeCloseTo(mov(d0, "m2").t_end - 0.5, 2);
    expect(touched(d0, r.doc)).toEqual(["m2"]);
  });

  it("T-EDT-06 «más cerrado»: el destino se acerca 1,5 m a la portería y el rematador lo sigue", () => {
    const d0 = cornerDoc();
    const r = applyPlayCommand(d0, { op: "play.adjust_delivery", closer_to_goal_m: 1.5, curve_delta: 0.04 }, C);
    expect(r.doc.delivery.curve).toBe(0.22);
    expect(r.doc.delivery.target_point.u).toBe(0.981);
    const m3 = mov(r.doc, "m3");
    expect(m3.path[1]).toEqual(r.doc.delivery.target_point);
    expect(Math.abs(m3.t_end - r.doc.delivery.arrival_t)).toBeLessThanOrEqual(0.15);
  });

  it("T-EDT-07/08 los de atrás no se incorporan; pedirlo después pide confirmación", () => {
    const r = applyPlayCommand(cornerDoc(), { op: "play.constraint", target: { role: "REST_DEFENDER", expect_count: 2 }, rule: "NO_JOIN_ATTACK" }, C);
    expect(r.doc.constraints.filter((c) => c.origin === "EXPLICIT").map((c) => c.actor)).toEqual(["a9", "a10"]);
    const r2 = applyPlayCommand(r.doc, { op: "play.set_movement", target: { player: "pl_2" }, movement: "LATE_ARRIVAL" }, C);
    expect(r2.changed).toBe(false);
    expect(r2.clarifications[0].code).toBe("AMB-CONFLICT-RULE");
  });

  it("T-EDT-09 deshacer devuelve exactamente el documento anterior (y rehacer lo repite)", () => {
    const d0 = cornerDoc();
    let h = startHistory(d0);
    const cmd = { op: "play.move_actor", target: { zone: "Z_FAR_POST", expect_count: 2 }, dy_m: -1 };
    const r = applyPlayCommand(h.doc, cmd, C);
    h = record(h, [cmd], r.doc);
    const after = canonicalHash(h.doc);
    h = undo(h);
    expect(canonicalHash(h.doc)).toBe(canonicalHash(d0));
    h = redo(h);
    expect(canonicalHash(h.doc)).toBe(after);
  });

  it("T-EDT-10 si el bloqueo llega tarde, avisa de secuencia y de riesgo arbitral", () => {
    const r = applyPlayCommand(cornerDoc(), { op: "play.shift_timing", target: { role: "BLOCKER" }, delta_s: 1.0 }, C);
    const ids = r.diagnostics.map((d) => d.rule_id);
    expect(ids).toContain("SEQ-SCREEN-01");
    expect(ids).toContain("LAW-IMP-01");
  });

  it("T-EDT-11 rival a menos de 9,15 m del área de esquina", () => {
    const d0 = cornerDoc();
    const o7 = actor(d0, "o7");
    const r = applyPlayCommand(d0, { op: "play.move_actor", target: { actor: "o7", team: "OPP" }, dx_m: 100 - o7.start.u * 105, dy_m: 4 - o7.start.v * 68 }, C);
    expect(r.diagnostics.find((d) => d.rule_id === "LAW-CRN-02")).toBeTruthy();
  });

  it("T-EDT-12 una orden que no cambia nada no crea entrada en el historial", () => {
    const d0 = cornerDoc();
    const r = applyPlayCommand(d0, { op: "play.set_delivery", swing: "INSWING" }, C);
    expect(r.changed).toBe(false);
    const h = record(startHistory(d0), [], r.doc);
    expect(h.past).toHaveLength(0);
  });
});

describe("Determinismo", () => {
  it("T-DET-01 el mismo comando produce el mismo hash en 50 ejecuciones", () => {
    const h = canonicalHash(cornerDoc());
    for (let i = 0; i < 50; i++) expect(canonicalHash(cornerDoc())).toBe(h);
  });

  it("T-DET-02 reversibilidad en 200 secuencias pseudoaleatorias de ediciones", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const ops = [
      () => ({ op: "play.move_actor", target: { actor: `a${2 + Math.floor(rnd() * 9)}` }, dx_m: Math.round((rnd() * 4 - 2) * 10) / 10, dy_m: Math.round((rnd() * 4 - 2) * 10) / 10 }),
      () => ({ op: "play.shift_timing", target: { role: "BLOCKER" }, delta_s: Math.round((rnd() - 0.5) * 10) / 10 }),
      () => ({ op: "play.adjust_delivery", closer_to_goal_m: Math.round(rnd() * 20) / 10 }),
    ];
    const base = cornerDoc();
    const baseHash = canonicalHash(base);
    for (let k = 0; k < 200; k++) {
      let h = startHistory(base);
      for (let s = 0; s < 3; s++) {
        const cmd = ops[Math.floor(rnd() * ops.length)]();
        const r = applyPlayCommand(h.doc, cmd, C);
        h = record(h, [cmd], r.doc);
      }
      while (h.past.length) h = undo(h);
      expect(canonicalHash(h.doc)).toBe(baseHash);
    }
  });

  it("T-DET-03 localidad: mover a un jugador estático solo toca su actor y su movimiento", () => {
    const d0 = cornerDoc();
    for (const id of ["a7", "a8", "a9", "a10"]) {
      const r = applyPlayCommand(d0, { op: "play.move_actor", target: { actor: id }, dx_m: 1 }, C);
      const paths = touchedPaths(diff(d0, r.doc), 2).filter((p) => !p.startsWith("/diagnostics"));
      const ai = d0.actors.findIndex((a) => a.id === id), mi = d0.movements.findIndex((m) => m.actor === id);
      expect(paths).toEqual([`/actors/${ai}`, `/movements/${mi}`].sort());
    }
  });
});
