import { describe, expect, it } from "vitest";
import { createSetPiece, SETPIECE_TYPES } from "@fcs/engine";
import { ctx, ctxLucasRight } from "./fixtures";

describe("Despachador de balón parado", () => {
  it.each([...SETPIECE_TYPES])("%s produce un documento de ese tipo", (type) => {
    const r = createSetPiece([{ op: "play.create", type, side: "LEFT" }], ctxLucasRight());
    expect(r.doc?.type).toBe(type);
  });

  it("un tipo aún no soportado devuelve UNSUPPORTED-01 sin lanzar", () => {
    const r = createSetPiece([{ op: "play.create", type: "FK_CENTRAL_ATT", side: "LEFT" }], ctx());
    expect(r.doc).toBeNull();
    expect(r.diagnostics[0].rule_id).toBe("UNSUPPORTED-01");
  });

  it("sin play.create devuelve UNSUPPORTED-01", () => {
    expect(createSetPiece([], ctx()).diagnostics[0].rule_id).toBe("UNSUPPORTED-01");
  });
});
