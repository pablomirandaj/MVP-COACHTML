import { describe, expect, it } from "vitest";
import { applyPlayCommand, ballCurve, canonicalHash, createFreeKickWide, playTracks, toM, type Command } from "@fcs/engine";
import { ctx, roster } from "./fixtures";

const FK: Command[] = [{ op: "play.create", type: "FK_WIDE_ATT", side: "RIGHT", depth_m: 18, distance_m: 6 }];
const plan = () => {
  const r = createFreeKickWide(FK, ctx());
  if (!r.doc) throw new Error("sin documento");
  return r.doc;
};

describe("Falta lateral a favor (FK_WIDE_ATT)", () => {
  it("es determinista", () => {
    expect(canonicalHash(plan())).toBe(canonicalHash(plan()));
  });

  it("desde la derecha a 18 m de la línea de fondo no tiene errores y coloca el balón donde se pidió", () => {
    const doc = plan();
    expect(doc.type).toBe("FK_WIDE_ATT");
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const b = toM(doc.delivery.ball_start, doc.pitch);
    expect(b.x).toBeCloseTo(105 - 18, 1);
    expect(b.y).toBeCloseTo(68 - 6, 1);
  });

  it("en el golpeo nadie propio está en fuera de juego", () => {
    const doc = plan();
    expect(doc.offside_x).toBeDefined();
    const xOff = doc.offside_x! * doc.pitch.length_m;
    const tr = playTracks(doc, roster());
    const f = tr.frames[Math.round((0 - tr.t0) * tr.fps)];
    doc.actors.forEach((a, k) => {
      if (a.team !== "OWN" || a.role === "TAKER") return;
      expect(f[2 * k] * doc.pitch.length_m).toBeLessThanOrEqual(xOff + 1e-6);
    });
    expect(doc.diagnostics.find((d) => d.rule_id === "LAW-OFF-01")).toBeUndefined();
  });

  it("la barrera rival está a 9,15 m del balón", () => {
    const doc = plan();
    const b = toM(doc.delivery.ball_start, doc.pitch);
    const wall = doc.actors.filter((a) => a.role === "WALL");
    expect(wall).toHaveLength(2);
    for (const w of wall) expect(Math.hypot(toM(w.start, doc.pitch).x - b.x, toM(w.start, doc.pitch).y - b.y)).toBeCloseTo(9.15, 1);
    expect(doc.diagnostics.find((d) => d.rule_id === "LAW-FK-01")).toBeUndefined();
  });

  it("cambiar a centro abierto cambia la curva del balón", () => {
    const doc = plan();
    const before = ballCurve(doc).c;
    const r = applyPlayCommand(doc, { op: "play.set_delivery", swing: doc.delivery.swing === "INSWING" ? "OUTSWING" : "INSWING" }, ctx());
    expect(r.changed).toBe(true);
    expect(ballCurve(r.doc).c).not.toEqual(before);
  });

  it("con solo 5 jugadores disponibles hace la jugada que puede y avisa", () => {
    const five = roster().filter((p) => p.pos !== "GK").slice(0, 5);
    const r = createFreeKickWide(FK, { ...ctx(), roster: five, lineupPlayerIds: five.map((p) => p.id) });
    expect(r.doc).not.toBeNull();
    expect(r.doc!.diagnostics.find((d) => d.rule_id === "ROSTER-01")).toBeDefined();
  });
});
