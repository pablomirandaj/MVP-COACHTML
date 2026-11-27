import { describe, expect, it } from "vitest";
import type { Player } from "@fcs/engine";
import { mergeRoster, parseRosterText } from "../src/studio/lib/import";

describe("Importar plantilla desde texto o CSV", () => {
  it("entiende «dorsal nombre apellidos posición [pie]»", () => {
    const r = parseRosterText("1 Juan Pérez POR\n9 Raúl Somavilla DC zurdo");
    expect(r.errors).toEqual([]);
    expect(r.players.map((p) => [p.n, p.name, p.surname, p.pos, p.foot])).toEqual([
      [1, "Juan", "Pérez", "GK", "RIGHT"], [9, "Raúl", "Somavilla", "ST", "LEFT"],
    ]);
  });

  it("una línea sin posición va a errores con su número", () => {
    const r = parseRosterText("1 Juan Pérez POR\n7 Pedro Blanco\n\n10 Mario Alonso MCO");
    expect(r.players).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^Línea 2/);
  });

  it("acepta CSV con cabecera (coma o punto y coma) y altura", () => {
    const r = parseRosterText("dorsal;nombre;apellidos;posicion;pie;altura\n4;Diego;Sanz;DFC;diestro;188\n3;Luis;Gil;LI;zurdo;");
    expect(r.errors).toEqual([]);
    expect(r.players[0]).toMatchObject({ n: 4, name: "Diego", surname: "Sanz", pos: "CB", foot: "RIGHT", height: 188 });
    expect(r.players[1]).toMatchObject({ pos: "LB", foot: "LEFT" });
    expect(r.players[1].height).toBeUndefined();
  });

  it("al fusionar conserva el id del jugador que ya existía (mismo nombre)", () => {
    const existing: Player[] = [{ id: "pl_rffm_1", name: "Raúl", surname: "Somavilla Torres", pos: "", foot: "RIGHT", status: "AVAILABLE" }];
    const merged = mergeRoster(existing, parseRosterText("9 Raúl Somavilla Torres DC zurdo\n1 Juan Pérez POR").players);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: "pl_rffm_1", n: 9, pos: "ST", foot: "LEFT" });
  });
});
