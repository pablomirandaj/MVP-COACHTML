# Reproductor «como la J5» y vocabulario de entrenador — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app produzca y muestre jugadas como el HTML de la J5 (paso a paso, solo las flechas del paso actual, ficha de la jugada, carpeta del partido con pestañas) y que el asistente entienda el vocabulario del entrenador.

**Architecture:** El motor compila cualquier pieza a una secuencia por pasos (`fcs.seq/1`). Un único reproductor autocontenido de `@fcs/render` la pinta en la app y en el HTML exportado. El vocabulario vive en `@fcs/engine/football` y alimenta el contexto y las herramientas de `@fcs/assistant`.

**Tech Stack:** TypeScript, Vitest, React 19, Vite, Fastify/PostgreSQL, playwright-core.

**Spec:** `docs/superpowers/specs/2026-11-27-reproductor-y-vocabulario-design.md`

## Global Constraints

- **Determinismo:** motor y vocabulario sin E/S, sin `Math.random` ni `Date.now`.
- **Reproductor:** `createPlayer` no puede referenciar nada fuera de su cuerpo; funciona con `createPlayer.toString()`.
- **Colores de la J5:** negro `#070B08`, carbón `#0F1712`, verde `#0E7A32`, verde claro `#35D45F`, oro `#D9A526`, hueso `#E8F1EA`, gris `#8FA396`, rojo `#D6263B`.
- **Fuentes:** Oswald y luego Inter.
- **Flechas del paso actual:** opacidad 0,95. Pasos anteriores: 0,16. «Flechas» desactivado: ninguna.
- **Transición entre pasos:** 0,62 s; 1,05 s a 0,6×.
- **Velocidades:** 1×, 0,6× y 1,6×.
- **Numeración española por puesto:** GK 1, RB 2, LB 3, CB 4 y 5, DM 6, CM 8 (el otro interior 10), AM 10, RW 7, LW 11, ST 9.
- **Textos:** en español de España; sin dependencias nuevas.

## Review Focus

1. **«el 6» cuando el dorsal 6 juega en otro puesto:** el asistente pregunta en vez de elegir. → Task 1.
2. **Secuencia de una pizarra sin pasos o de un paso sin movimientos:** el reproductor muestra la colocación sin fallar. → Task 4 y 5.
3. **Exportar una carpeta con una pieza borrada o vacía:** se omite con aviso. → Task 8.
4. **Pantalla de 390 px con el reproductor y la ficha:** sin desplazamiento horizontal. → Task 5 y 9.
5. **Cambiar de sistema con una pieza cuyos actores ya no existen:** la secuencia ignora los actores ausentes. → Task 4.

---

### Task 1: Vocabulario de entrenador (`football/vocab.ts`) y banco de frases

**Files:** create `packages/engine/src/football/vocab.ts`, `docs/engine/tests/coach-phrases.yaml`, `packages/engine/test/vocab.test.ts`; modify `docs/engine/lexicon/es-ES.yaml` («el cinco» → CB), `packages/engine/src/index.ts`.

**Interfaces:**
- Produces:
  - `ROLE_NUMBER_ES: Record<string, number[]>`
  - `slotAliases(formation: string): Record<string, string[]>` (ranura → nombres)
  - `resolvePlayerRef(text: string, ctx: { formation: string; labels?: Record<string,string>; roster?: Player[] }): { slots: string[]; via: "position"|"shirt"|"name"|"none"; ambiguous: boolean }`
  - `whoIsWho(formation: string, labels: Record<string,string>, roster: Player[]): string`
  - `CONCEPTS: { term: string[]; meaning: string; command: string }[]`

- [ ] **Step 1: Tests**
  - 4‑3‑3: «pivote», «el que juega de 6» y «mediocentro defensivo» → `["DM"]`; «los interiores» → `["CM_L","CM_R"]`; «el 9» sin dorsal 9 → `["ST"]` por puesto; «el extremo izquierdo» → `["LW"]`.
  - 4‑2‑3‑1: «el doble pivote» → `["DM_L","DM_R"]`; «el 10» → `["AM"]`.
  - Con labels `{DM:"6"}`: «el 6» → `DM`, `via: "shirt"`, sin ambigüedad.
  - Con labels `{CM_L:"6"}`: «el 6» → `ambiguous: true` y slots `["CM_L","DM"]`.
  - Por nombre: «Raúl» con un jugador así → su ranura.
  - `whoIsWho` contiene «DM = pivote · 6».
  - Cada frase de `coach-phrases.yaml` (≥ 50) resuelve a las ranuras esperadas.
- [ ] **Step 2: Run** `pnpm vitest run packages/engine/test/vocab.test.ts`, expect FAIL.
- [ ] **Step 3: Implement.** Normaliza: minúsculas, sin tildes, «nº» y «número» → número.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): vocabulario de entrenador y numeración española`.

### Task 2: El asistente entiende al entrenador

**Files:** modify `packages/assistant/src/prompt.ts`, `packages/assistant/src/workspaces.ts`; test `packages/assistant/test/vocab.test.ts`.

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - herramienta `resolve_player {text}` en los tres espacios de trabajo, con resultado JSON `{slots, actors, via, ambiguous}`;
  - el contexto de pizarra y escenas incluye `whoIsWho`;
  - el prompt incluye el glosario `CONCEPTS` y 6 ejemplos.

- [ ] **Step 1: Tests**
  - El contexto de la pizarra contiene «pivote».
  - `resolve_player({text:"el pivote"})` devuelve los actores `["own:DM"]`.
  - Si hay ambigüedad, el resultado incluye `ambiguous: true` y el texto «pregunta al entrenador».
  - El prompt contiene «salida lavolpiana» y «board.press».
  - El contexto sigue ocupando ≤ 4 KB con 25 jugadores.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`.
- [ ] **Step 5: Commit** `feat(assistant): vocabulario de entrenador en contexto y herramientas`.

### Task 3: Colocación con criterio (SHAPE‑03/04, PRESS‑02/03)

**Files:** modify `packages/engine/src/phases/scene.ts`, `docs/engine/rules/constraints.yaml`, `docs/32_GAME_PHASES_MODULE.md`; test `packages/engine/test/shape.test.ts`.

- [ ] **Step 1: Tests.** Escena de presión alta 4‑3‑3 contra 4‑4‑2 (la de `phases.test`), disparador en su lateral derecho:
  - ningún delantero rival tiene `x` menor que el de nuestro defensa más retrasado menos 0,5 m;
  - la anchura LB–RB es ≤ 38 m;
  - cada `COVER` está a ≤ 3 m del segmento entre el poseedor y su compañero de dentro más cercano;
  - ningún mediocentro rival tiene a un propio a más de 8 m (rol `MARK`, si hace falta);
  - las pruebas existentes de `phases.test` siguen pasando.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** en `computeScene` tras calcular el bloque.
- [ ] **Step 4: Run** `pnpm test`.
- [ ] **Step 5: Commit** `fix(engine): colocación con criterio en presión y repliegue`.

### Task 4: Secuencia por pasos `fcs.seq/1`

**Files:** create `packages/engine/src/sequence/{types,play,scene,board,index}.ts`; modify `board/types.ts` y `board/apply.ts` (`key`, `trig` y la orden `board.mark_step`), `command-ir.schema.json`, `index.ts`; test `packages/engine/test/sequence.test.ts`.

**Interfaces:**
- Produces:
  - tipos `Sequence`, `SeqFrame`, `SeqActor`, `Line` (los de §5.1 del diseño);
  - `sequenceOfPlay(doc: PlayDoc, roster: Player[], opts?: { labels?: "ROLE"|"DORSAL" }): Sequence`;
  - `sequenceOfScene(scene: SceneDoc): Sequence`;
  - `sequenceOfBoard(doc: BoardDoc): Sequence`;
  - `sequenceStates(seq): { own; ball }[]` (estado acumulado por paso).
- Coordenadas en metros. Con `view: "HALF"`, la portería rival está en `x = L`.

- [ ] **Step 1: Tests**
  - **Córner:** los pasos «Colocados», «Bloqueos», «Golpeo» (con `trig`) y «Remate»; hay `blocks` en el paso de bloqueos; los números de papel son `S` para el lanzador, `C` para las vigilancias y 1..n para el resto.
  - **Saque corto:** 3 pases en total.
  - **Escena de presión:** el disparador lleva `trig`, y los presionadores están en `key` y en `runs`.
  - **Pizarra con un pase y una nota:** `beat` es la nota, y `passes` sale del pasador y llega al receptor.
  - **Pizarra vacía:** un paso «Colocados» sin flechas.
  - **Paso de la pizarra con `trig`** mediante `board.mark_step`.
  - **Determinismo:** el hash de dos ejecuciones coincide.
  - **Actor inexistente:** un `key` con un actor que no existe se ignora.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(engine): secuencia por pasos fcs.seq/1`.

### Task 5: Reproductor único (`@fcs/render/player`)

**Files:** create `packages/render/src/player/{player.ts,styles.ts}`; test `packages/render/test/player.test.ts`.

**Interfaces:**
- Produces:
  - `createPlayer(root: HTMLElement, seq: Sequence, opts?: { autoplay?: boolean; speed?: number; arrows?: boolean; vertical?: boolean | "auto"; onFrame?: (i: number) => void })`, que devuelve `{ go(i), next(), prev(), play(), pause(), setArrows(b), setSpeed(s), destroy(), frame(): number }`;
  - `PLAYER_CSS: string` (clases `fcsp-*`);
  - `playerPageHtml(seq, opts)`, una página mínima para la prueba.

- [ ] **Step 1: Tests en Chromium**, con la página mínima a 390 × 844 y la secuencia de un córner:
  - al llamar a `next()`, el título del paso cambia;
  - tras dos pasos, todas las `.fcsp-ln.old` tienen opacidad ≤ 0,2;
  - con `setArrows(false)` hay 0 `.fcsp-ln` visibles;
  - `scrollWidth` ≤ 390;
  - `createPlayer.toString()` evaluado en una página vacía funciona, lo que prueba que es autocontenido.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Un SVG con `viewBox` en metros. Para HALF, la portería rival arriba (gira el marco). Los actores son `<g>` con `transform` y una transición CSS de 0,62 s; las líneas se redibujan en cada paso.
- [ ] **Step 4: Run** `pnpm vitest run packages/render`.
- [ ] **Step 5: Commit** `feat(render): reproductor por pasos de la J5`.

### Task 6: Ficha de la jugada y carpeta del partido (`renderDossierHtml`)

**Files:** create `packages/engine/src/sequence/sheet.ts` (`proposeSheet`), `packages/render/src/dossier.ts`; modify `@fcs/assistant` workspaces (herramienta `set_sheet`); test `packages/render/test/dossier.test.ts` y `packages/engine/test/sheet.test.ts`.

**Interfaces:**
- Produces:
  - `type Sheet = { subtitle: string; table: [string, string][]; hueco: string; clave: string; riesgo: string }`;
  - `proposeSheet(seq: Sequence, kind: string): Sheet`;
  - `renderDossierHtml(d: { club: string; category: string; match?: string; opponent?: string; title: string; kicker?: string; crest?: string; hero?: string; rules: string[]; plays: { label: string; eyebrow: string; seq: Sequence; sheet: Sheet }[] }): string`;
  - la herramienta `set_sheet {sheet}` en los espacios de trabajo, que llama a `onSheet(sheet)`.

- [ ] **Step 1: Tests**
  - `proposeSheet` de un córner tiene una fila por número de papel y la fila «S».
  - El HTML con dos jugadas contiene 2 pestañas, «Esto no cambia nunca», «El hueco que atacamos» y el escudo `data:image/png`; ocupa menos de 400 KB y no tiene `src="http`.
  - Con una sola jugada no hay pestañas.
  - Una jugada con 0 pasos se omite.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** La cabecera, la ficha y las reglas siguen el ejemplo de la J5; el reproductor se incrusta con `createPlayer.toString()`.
- [ ] **Step 4: Run** `pnpm test`.
- [ ] **Step 5: Commit** `feat: ficha de la jugada y carpeta del partido`.

### Task 7: Interfaz: «Ver» con el reproductor, flechas del paso actual y deshacer junto al campo

**Files:** create `packages/web/src/studio/components/PlayerView.tsx`, `SheetEditor.tsx`; modify `components/Pitch.tsx` (prop `pathWindow?: [number, number]`), `PitchBoard.tsx`, las páginas `Board.tsx`, `SetPieces.tsx` y `Plans.tsx`, `lib/editor.ts` (`sequenceOf(kind, doc, roster)`), `ports.ts` (`StudioItem.sheet`), `lib/useEditor.ts` (guarda `sheet`; exporta con `renderDossierHtml`); test `packages/web/test/editor.test.ts` (`sequenceOf`).

**Comportamiento:**
- **Pizarra:** en «Editar», solo las flechas del paso seleccionado; barra bajo el campo con ↶ Deshacer, ↷ Rehacer, ◀ Paso anterior y ▶ Paso siguiente, con texto y no solo icono. En «Ver», `PlayerView` con el interruptor «Flechas» y el selector «Números: papel / dorsal».
- **Balón parado y Planes:** «Ver» por defecto y «Editar» con el campo arrastrable.
- **Ficha:** el panel «Ficha de la jugada» (`SheetEditor`) se rellena con `proposeSheet` y es editable.
- **Paso clave:** casilla «AHORA (paso clave)» en la lista de pasos de la pizarra, que emite `board.mark_step`.

- [ ] **Step 1: Tests:** `sequenceOf` devuelve secuencias para los tres tipos; `editorReducer` aplica `board.mark_step`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(studio): ver como la J5, flechas del paso actual y deshacer a mano`.

### Task 8: Biblioteca: exportar la carpeta del partido y reglas fijas

**Files:** create `packages/web/src/studio/components/DossierDialog.tsx`; modify `pages/Library.tsx`, `ports.ts` (`StorePort.settings()` y `saveSettings()`), `hosts/artifact.ts` (doc `studio/settings`), `hosts/server.ts` y `packages/server` (`GET|PUT /teams/:id/studio/settings`, migración `0004_studio_settings.sql`); test `packages/web/test/hosts.test.ts` y `packages/server/test/studio.test.ts`.

**Interfaces:**
- `Settings = { rules: string[] }`. Por defecto, las 5 reglas del ejemplo de la J5.
- `ExportPort.exportDossier(d: DossierInput): Promise<void>`.

- [ ] **Step 1: Tests**
  - Las reglas por defecto son 5 y se guardan.
  - `exportDossier` con 2 piezas entrega un HTML con 2 pestañas.
  - Una pieza borrada se omite y se avisa (`skipped: 1`).
  - En el servidor, PUT y GET de las reglas; quien no es del equipo recibe 404.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Modo «Seleccionar» en la biblioteca y un diálogo con título, jornada, rival, reglas (una por línea) y orden.
- [ ] **Step 4: Run** `pnpm test && pnpm test:api && pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(studio): carpeta del partido con reglas fijas`.

### Task 9: E2E, publicación y documentación

**Files:** modify `packages/web/e2e/studio-artifact.mjs`, `README.md`, `docs/31_CONVERSATIONAL_ASSISTANT.md`, `docs/29_ARCHITECTURE_DECISIONS.md` (ADR‑023: secuencia y reproductor únicos).

- [ ] **Step 1:** Añadir a la E2E:
  - en la pizarra, «Ver» muestra el reproductor; con ▶ cambia el paso; «Flechas» lo oculta todo;
  - el botón «Deshacer» junto al campo funciona;
  - en la biblioteca, seleccionar dos piezas y exportar la carpeta da un HTML con 2 pestañas y «Esto no cambia nunca»;
  - a 390 px no hay desplazamiento horizontal.
- [ ] **Step 2: Run** `pnpm studio:artifact && pnpm e2e:studio`. Expected: OK.
- [ ] **Step 3:** Republicar en la misma dirección. Actualizar la documentación.
- [ ] **Step 4: Commit and push** `docs: reproductor de la J5 y vocabulario; ADR-023`.
