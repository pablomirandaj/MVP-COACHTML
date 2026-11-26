// Genera ejemplos HTML autónomos en examples/html a partir del motor (jugada del escenario 2 y escenas de fases).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { computeScene, createCorner, DEFAULT_PITCH, playTracks, sceneTracks, type SceneSpec, type Player } from "@fcs/engine";
import { renderTracksHtml } from "@fcs/render";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${root}examples/html`;
mkdirSync(out, { recursive: true });
const suite = parse(readFileSync(`${root}docs/engine/tests/command-tests.yaml`, "utf8"));
const roster: Player[] = suite.fixtures.roster;
const lineup = ["pl_1", "pl_5", "pl_4", "pl_7", "pl_2", "pl_10", "pl_6", "pl_8", "pl_11", "pl_9", "pl_17"];
const OWN_433: Record<string, string> = { GK: "1", CB_L: "5", CB_R: "4", LB: "7", RB: "2", CM_L: "10", DM: "6", CM_R: "8", LW: "11", ST: "9", RW: "17" };

const write = (name: string, html: string) => { writeFileSync(`${out}/${name}`, html); console.log(`examples/html/${name}`); };
const report = (label: string, diags: { rule_id: string; severity: string; message: string }[]) =>
  console.log(`  ${label}: ${diags.length ? diags.map((d) => `${d.rule_id}(${d.severity})`).join(", ") : "sin avisos"}`);

// 1. Córner del escenario 2 (Lucas con la ficha corregida a diestro).
const r2 = JSON.parse(JSON.stringify(roster)) as Player[];
r2.find((p) => p.id === "pl_7")!.foot = "RIGHT";
const corner = createCorner(suite.cases.find((c: any) => c.id === "T-CRN-01").expect_ir, { pitch: DEFAULT_PITCH, roster: r2, lineupPlayerIds: lineup }).doc!;
const ct = playTracks(corner, r2, "Córner izquierda · cerrado al 2º palo · bloqueo");
ct.subtitle = "Lucas (7) saca cerrado. Diego (4) bloquea al marcador de Mateo (5), que ataca el segundo palo. Marcos (10) y Pedro (17), en discontinuo, son propuestas del sistema.";
write("corner-izquierda-cerrado.html", renderTracksHtml(ct));
report("córner", corner.diagnostics.filter((d) => d.severity !== "info"));

const scenes: { file: string; spec: SceneSpec; subtitle: string }[] = [
  {
    file: "presion-alta-433.html",
    subtitle: "Cómo presionamos su salida: esperamos a que el central conduzca hacia su lateral derecho y ahí saltamos.",
    spec: {
      type: "PRESS_OWN", title: "Nuestra presión alta (4-3-3 contra su 4-3-3)",
      own: { formation: "F_433", labels: OWN_433 }, opp: { formation: "F_433" },
      params: {
        block_height: "HIGH",
        jumps: [{ who: "LW", to: "RB" }, { who: "ST", to: "CB_R", curve: "SCREEN_GK" }, { who: "CM_L", to: "CM_R" }],
      },
      keyframes: [
        { t: 0, ball: { holder: "GK" }, note: "Balón en su portero: bloque alto y compacto, sin saltar todavía." },
        { t: 1.5, ball: { holder: "CB_R" }, note: "Su central recibe: basculamos hacia su lado y tapamos el pase interior." },
        { t: 3, ball: { holder: "RB" }, event: "TRIGGER", note: "¡Pase al lateral! Hugo (11) salta al lateral, Álvaro (9) presiona al central tapando el pase al portero y Marcos (10) sale a su interior. Las coberturas cierran detrás." },
      ],
    },
  },
  {
    file: "presion-rival-433.html",
    subtitle: "Cómo nos presiona el rival según el análisis: espera el pase a nuestro lateral izquierdo para saltar.",
    spec: {
      type: "PRESS_OPP", title: "Presión del rival sobre nuestra salida",
      own: { formation: "F_433", labels: OWN_433 }, opp: { formation: "F_433" },
      params: { block_height: "HIGH", jumps: [{ who: "RW", to: "LB" }, { who: "ST", to: "CB_L", curve: "SCREEN_GK" }, { who: "CM_R", to: "CM_L" }] },
      keyframes: [
        { t: 0, ball: { holder: "GK" }, note: "Sacamos desde Pablo (1): ellos esperan arriba." },
        { t: 1.5, ball: { holder: "CB_L" }, note: "Mateo (5) recibe: su extremo derecho se prepara." },
        { t: 3, ball: { holder: "LB" }, event: "TRIGGER", note: "Pase a Lucas (7): saltan su extremo, su 9 y su interior. Debemos tener preparada la salida por dentro o el cambio de orientación." },
      ],
    },
  },
  {
    file: "repliegue-bloque-bajo-442.html",
    subtitle: "Repliegue en 4-4-2 bajo: el bloque bascula con el balón de banda a banda.",
    spec: {
      type: "RETREAT", title: "Repliegue y bloque bajo (4-4-2)",
      own: { formation: "F_442" }, opp: { formation: "F_433" },
      params: { block_height: "LOW" },
      keyframes: [
        { t: 0, ball: { holder: "CM_L" }, note: "Balón en su interior: bloque bajo y juntos, líneas a menos de 15 m." },
        { t: 2, ball: { holder: "LW" }, note: "Balón en su banda izquierda: basculamos todos hacia ese lado." },
        { t: 4, ball: { holder: "RW" }, note: "Cambio de orientación: basculamos al otro lado sin romper la línea." },
      ],
    },
  },
  {
    file: "vigilancias-3.html",
    subtitle: "Mientras atacamos, tres jugadores vigilan a sus dos delanteros que se quedan arriba (2 + 1).",
    spec: {
      type: "REST_DEFENSE", title: "Vigilancias en ataque (contra 2 delanteros arriba)",
      own: { formation: "F_433", labels: OWN_433 }, opp: { formation: "F_433" },
      params: { opp_staying: ["ST", "LW"] },
      keyframes: [
        { t: 0, ball: { holder: "RW" }, note: "Atacamos por la derecha: los dos centrales vigilan a sus delanteros y el pivote queda libre por delante." },
        { t: 2, ball: { holder: "LW" }, note: "El balón cambia de lado: las vigilancias se ajustan sin dejar de estar por detrás de sus delanteros." },
      ],
    },
  },
];

for (const s of scenes) {
  const scene = computeScene(s.spec, DEFAULT_PITCH);
  const tr = sceneTracks(scene);
  tr.subtitle = s.subtitle;
  write(s.file, renderTracksHtml(tr));
  report(s.file, scene.diagnostics);
}
