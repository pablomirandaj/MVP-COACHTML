import { describe, expect, it } from "vitest";
import { createSetPiece, DEFAULT_PITCH, proposeSheet, sequenceOfPlay, type Player } from "@fcs/engine";
import { renderDossierHtml } from "@fcs/render";

const roster: Player[] = Array.from({ length: 11 }, (_, i) => ({ id: `p${i + 1}`, n: i + 1, name: `J${i + 1}`, pos: i === 0 ? "GK" : "CM", foot: "RIGHT", status: "AVAILABLE" }));
const play = (type: string) => {
  const doc = createSetPiece([{ op: "play.create", type, side: "LEFT" }], { pitch: DEFAULT_PITCH, roster }).doc!;
  const seq = sequenceOfPlay(doc, roster);
  return { label: type, eyebrow: "Córner · jugada", seq, sheet: proposeSheet(seq, { kind: "SETPIECE", doc }) };
};
const base = { club: "Periso C.F.", category: "1ª Autonómica · Grupo 1 · 26/27", match: "Jornada 12", opponent: "A.D. Sporting Hortaleza", title: "Balón parado",
  crest: "data:image/png;base64,iVBORw0KGgo=", rules: ["Primero se bloquea y después se entra.", "Al balón se le ataca de frente."] };

describe("Carpeta del partido (HTML)", () => {
  it("dos jugadas: dos pestañas, ficha, reglas y escudo; autónomo y ligero", () => {
    const html = renderDossierHtml({ ...base, plays: [play("CORNER_ATT"), play("FK_WIDE_ATT")] });
    expect(html.match(/class="fcsd-tab"/g)).toHaveLength(2);
    for (const t of ["Esto no cambia nunca", "El hueco que atacamos", "La clave", "Si sale mal", "data:image/png", "Sporting Hortaleza", "Primero se bloquea"]) expect(html).toContain(t);
    expect(Buffer.byteLength(html)).toBeLessThan(400_000);
    expect(html).not.toMatch(/src="http/);
  });

  it("una jugada: sin pestañas; jugadas vacías se omiten", () => {
    const empty = { ...play("CORNER_ATT"), seq: { ...play("CORNER_ATT").seq, frames: [] } };
    const html = renderDossierHtml({ ...base, plays: [play("CORNER_ATT"), empty] });
    expect(html).not.toContain('class="fcsd-tab"');
  });
});
