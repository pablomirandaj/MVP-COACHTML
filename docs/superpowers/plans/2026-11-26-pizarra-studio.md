# Pizarra Studio — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el motor (falta lateral, saque de banda, balón parado defensivo, salida de balón, ataque a espacios, pizarra libre y explicación por pasos) y construir la interfaz Pizarra Studio. La misma interfaz funciona como página de Claude y como parte de la web con servidor.

**Architecture:** El motor sigue siendo TypeScript puro y determinista. El bucle del asistente pasa a un paquete isomórfico, `@fcs/assistant`. La interfaz (`packages/web/src/studio`) solo habla con cuatro puertos (`TeamPort`, `StorePort`, `AiPort`, `ExportPort`), que tienen dos implementaciones: `hosts/artifact.ts` (`claude.use`) y `hosts/server.ts` (`/api`). Un script junta la compilación de Vite en un único HTML para publicarlo como página.

**Tech Stack:** TypeScript 5.7, Vitest 2, React 19, Vite 8, Fastify 5, PostgreSQL 16, ajv 2020, playwright-core (pruebas E2E).

**Spec:** `docs/superpowers/specs/2026-11-26-pizarra-studio-design.md`

## Global Constraints

- **Determinismo:** el motor y `@fcs/assistant` no hacen E/S ni usan `Math.random` ni `Date.now`. Misma entrada → mismo `canonicalHash`.
- **Coordenadas:** normalizadas `u, v` en el marco de ataque propio. Se calcula en metros y se guarda redondeado con `r4`. El campo por defecto es `DEFAULT_PITCH` (105 × 68).
- **Diagnósticos:** cada uno con `rule_id`. Las reglas nuevas se declaran en `docs/engine/rules/constraints.yaml` y se compilan con `pnpm catalog`.
- **Procedencia:** obligatoria en cada campo decidido: `EXPLICIT | MANUAL | ASSISTANT | RULE:<id>`.
- **Comandos IR:** todos validan contra `docs/engine/command-ir.schema.json`. Tipos de jugada existentes que se usan: `CORNER_ATT`, `CORNER_DEF`, `FK_WIDE_ATT`, `FK_WIDE_DEF`, `THROW_IN_ATT`.
- **Textos:** de cara al usuario, en español de España. Abreviaturas de posición en español (POR, LD, DFC…).
- **Colores:** Periso `#1f9d55` (verde) con borde y dorsal `#0b0f0c` (negro). Rival por defecto `#d64545`, editable.
- **Página de Claude:** un único HTML ≤ 16 MB, sin `fetch` externo, sin `<a download>`, sin `alert/confirm/prompt`. Capacidades declaradas: `{sample:{}, db:{rules:[{path:"studio",read:"view",write:"interact"}]}, downloads:true, user:{}}`.
- **HTML exportado:** autónomo, ≤ 300 KB por jugada, funciona sin conexión.
- **Sin dependencias nuevas** salvo `@fcs/assistant` (paquete del propio monorepo).

## Review Focus

1. **Plantilla con huecos** (sin dorsal, sin posición, menos de 11 jugadores): los planificadores y la interfaz siguen funcionando, con fichas sin número y aviso `ROSTER-*`. Nunca se lanza una excepción. → pruebas en Task 3, 5 y 12.
2. **El asistente devuelve comandos que no validan** (op desconocida, jugador inexistente): el borrador no cambia, el error vuelve al modelo y la interfaz muestra el aviso. → Task 10 y 13.
3. **`claude.use("sample")` es `null`, se deniega el permiso o no hay herramientas** (`tools_unavailable`): el chat se oculta o pasa al plan B por JSON, y la edición manual sigue disponible. → Task 11.
4. **Conflicto de guardado** (dos miembros del cuerpo técnico guardan la misma jugada): `StorePort.save` rechaza con `conflict` y la interfaz recarga sin perder el borrador local. → Task 11.
5. **Pantalla estrecha (≤ 400 px) y HTML exportado abierto en el móvil:** sin desplazamiento horizontal, campo en vertical y pasos legibles. → Task 2 y 14.

---

### Task 1: Explicación por pasos (`narrate.ts`) y `steps` en `Tracks`

**Files:**
- Create: `packages/engine/src/narrate.ts`
- Modify: `packages/engine/src/timeline.ts` (añadir `steps` a `Tracks`, que rellenan `playTracks` y `sceneTracks`)
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/narrate.test.ts`

**Interfaces:**
- Produces:
  - `interface Step { t: number; title: string; implies: string; source: Origin }`
  - `narratePlay(doc: PlayDoc, roster: Player[]): Step[]`
  - `narrateScene(doc: SceneDoc): Step[]`
  - `Tracks.steps: Step[]`, ordenados por `t`. El campo `notes` se conserva por compatibilidad.
- Regla de plantillas: una entrada por tipo de evento (`DELIVERY`, `BLOCK`, `RUN`, `JUMP`, `COVER`, `PASS`, `TRIGGER`, `REST`). El `title` nombra al jugador con su dorsal y su apellido, o la posición si no hay jugador. El `implies` es una frase sobre la consecuencia (quién queda libre, qué zona se cierra o se ocupa). Si el documento trae `note` manual o del asistente, prevalece (`source` = su procedencia).

- [ ] **Step 1: Write the failing tests**
  - `narratePlay(cornerDoc)`: incluye un paso `title` que contiene `"bloquea"` con `source` `RULE:NARR-BLOCK` y un paso de golpeo en `t` = momento del `KICK`. Todas las `implies` tienen longitud > 10.
  - `narrateScene(pressScene)` (escena `press` de `phases.test.ts`): el fotograma `TRIGGER` produce un paso cuyo `title` contiene `"presiona"` y cuyo `implies` nombra al jugador con rol `COVER`.
  - Una nota manual en un fotograma sustituye a la generada (`source: "MANUAL"`).
  - Es determinista: dos llamadas dan el mismo `canonicalHash`.
- [ ] **Step 2: Run** `pnpm vitest run packages/engine/test/narrate.test.ts`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `narrate.ts` and wire `steps` into `playTracks` and `sceneTracks`. Las reglas `NARR-*` se declaran en `constraints.yaml` con severidad `info`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS, todas las pruebas, también las 37 existentes.
- [ ] **Step 5: Commit** `feat(engine): explicación por pasos en jugadas y escenas`

### Task 2: Reproductor HTML por pasos (render v0.2)

**Files:**
- Modify: `packages/render/src/html.ts` (`EXPORTER_VERSION = "0.2.0"`)
- Modify: `packages/render/scripts/export-examples.ts` (regenera `examples/html/*.html`)
- Test: `packages/render/test/html.test.ts`

**Interfaces:**
- Consumes: `Tracks.steps` (Task 1).
- Produces: `renderTracksHtml(tracks: Tracks, opts?: { teamColor?: string; teamInk?: string; oppColor?: string; meta?: { team?: string; match?: string; opponent?: string } }): string`.

**Comportamiento:**
- Lista de pasos `"Paso n de N — title"` con `implies` debajo; el paso en curso lleva `aria-current="step"`.
- Botones `◀` / `▶` para ir al paso anterior o siguiente.
- Casilla "Pausar en cada paso", marcada por defecto.
- Velocidad 0,5×, 1× o 2×.
- Cabecera con `meta`.
- En pantallas de 600 px o menos, el campo va en vertical (ya existe) y la lista de pasos debajo.

- [ ] **Step 1: Write the failing tests**
  - El HTML de una escena contiene `Paso 1 de` y el texto de cada `steps[i].title`.
  - Contiene `opts.meta.opponent`.
  - Ocupa menos de 300 000 bytes.
  - No hace referencias externas: sin `src="http`, `href="http` ni `@import`.
  - Abierto en Chromium (`playwright-core`, `executablePath` de `CHROMIUM_PATH`) a 390 × 844: `document.documentElement.scrollWidth <= 390`, y tras pulsar `▶` el paso 2 tiene `aria-current`. Si `CHROMIUM_PATH` no existe, la prueba se omite.
- [ ] **Step 2: Run** `pnpm vitest run packages/render`. Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm vitest run packages/render && pnpm examples`. Expected: PASS; 5 ejemplos regenerados.
- [ ] **Step 5: Commit** `feat(render): reproductor por pasos con explicación`

### Task 3: Falta lateral a favor (`FK_WIDE_ATT`)

**Files:**
- Create: `packages/engine/src/setpiece/freekick.ts`
- Modify: `docs/engine/rules/templates.yaml` (plantilla `FK_WIDE_ATT_STANDARD`)
- Modify: `docs/engine/rules/zones.yaml` (si faltan zonas de lanzamiento lateral)
- Modify: `docs/engine/rules/constraints.yaml`
- Modify: `docs/engine/command-ir.schema.json` (`play.create`: añadir `distance_m` (8–40) y `depth_m` (0–30, distancia a la línea de fondo))
- Test: `packages/engine/test/freekick.test.ts`

**Interfaces:**
- Consumes: `createCorner` internals from `setpiece/plan.ts`: role assignment, `suitability`, `derive`, `validatePlay`. Extract what is shared into `setpiece/common.ts`; no copy-paste.
- Produces: `createFreeKickWide(cmds: Command[], ctx: EngineContext): PlanResult`, with `doc.type === "FK_WIDE_ATT"`.

**Valores de la plantilla:**
- Barrera rival de 2 jugadores a 9,15 m en la línea balón–primer palo.
- Línea de fuera de juego del rival: la del último defensor, de 6 a 12 m por delante del balón según `depth_m`.
- Nuestros rematadores salen desde esa línea.
- Roles: `TAKER`, 2 `PRIMARY_TARGET`, `SECONDARY_TARGET`, `DECOY`, `REBOUND`, 2 `REST_DEFENDER`.

**Reglas nuevas:**
- `LAW-FK-01`: barrera a ≥ 9,15 m (error).
- `LAW-OFF-01`: ningún atacante por delante de la línea de fuera de juego en el `KICK` (error).
- `TACTICAL-FK-01`: el centro cerrado lo lanza un pie hábil del lado contrario (aviso, como en el córner).

- [ ] **Step 1: Write the failing tests**
  - Es determinista (hash igual en dos llamadas).
  - Con `side: "RIGHT", depth_m: 18` no hay diagnósticos de nivel error.
  - En el instante del golpeo ningún actor propio supera la línea de fuera de juego: `x <= xOff` en metros.
  - Barrera a 9,15 m ± 0,05.
  - `play.set_delivery {swing:"OUTSWING"}` se aplica con `applyPlayCommand` y cambia la curva del balón.
  - Con plantilla de 5 jugadores, devuelve `doc` con los roles cubiertos que se pueda y el diagnóstico `ROSTER-01`.
- [ ] **Step 2: Run** `pnpm vitest run packages/engine/test/freekick.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (`pnpm catalog` tras editar el YAML).
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): falta lateral a favor`

### Task 4: Saque de banda (`THROW_IN_ATT`)

**Files:**
- Create: `packages/engine/src/setpiece/throwin.ts`
- Modify: `templates.yaml` (`THR_ATT_LONG`, `THR_ATT_SHORT`), `constraints.yaml`, `command-ir.schema.json` (`play.create.variant: "LONG" | "SHORT"`; `distance_m` reutilizado = distancia a la línea de fondo)
- Test: `packages/engine/test/throwin.test.ts`

**Interfaces:**
- Produces: `createThrowIn(cmds: Command[], ctx: EngineContext): PlanResult`.

**Variantes:**
- `LONG`: balón al primer palo, peinada al segundo, con bloqueo.
- `SHORT`: tercer hombre. Apoyo corto, devolución al lanzador y pase al tercero que ataca la espalda del lateral.

**Regla:** `LAW-THR-01`: el lanzador está fuera del campo, sobre la línea de banda (`v` ≤ 0 o ≥ 1 en ±0,01).

- [ ] **Step 1: Write the failing tests:** es determinista; en `LONG` el balón llega al primer palo y hay un `BLOCKER`; en `SHORT` hay tres pases encadenados, cada uno con su paso narrado; se cumple `LAW-THR-01`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): saque de banda corto y largo`

### Task 5: Balón parado defensivo (`CORNER_DEF`, `FK_WIDE_DEF`)

**Files:**
- Create: `packages/engine/src/setpiece/defend.ts`
- Modify: `templates.yaml` (`CRN_DEF_ZONAL`, `CRN_DEF_MIXED`, `CRN_DEF_MAN`, `FK_DEF_STANDARD`), `constraints.yaml`, `command-ir.schema.json` (`play.create.scheme: "ZONAL" | "MAN" | "MIXED"`; nueva op `play.mark {player, opponent}`)
- Test: `packages/engine/test/defend.test.ts`

**Interfaces:**
- Produces: `createDefensiveSetPiece(cmds: Command[], ctx: EngineContext): PlanResult`.

**Contenido:**
- Atacantes rivales colocados por plantilla.
- Nuestras marcas asignadas con `lexOptimalAssignment`: coste = diferencia de altura (si no hay altura, 0) + distancia a la zona. Las zonas fijas son primer palo, centro del área pequeña y punto de penalti.
- Un jugador en `COUNTER_OUTLET`.

**Reglas nuevas:**
- `TACTICAL-DEF-01`: cada rematador rival tiene marca o zona (aviso).
- `TACTICAL-DEF-02`: en zonal, el primer palo está cubierto (aviso).

- [ ] **Step 1: Write the failing tests**
  - Es determinista.
  - En `MIXED`, 3 zonales y el resto al hombre.
  - Sin `TACTICAL-DEF-01` cuando hay suficientes jugadores.
  - `play.mark` cambia una marca y marca su procedencia como `EXPLICIT`.
  - Con 7 jugadores aparece `TACTICAL-DEF-01` como aviso, no como excepción.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): córner y falta lateral en contra`

### Task 6: Despachador `createSetPiece`

**Files:**
- Create: `packages/engine/src/setpiece/index.ts`
- Modify: `packages/engine/src/index.ts`, `packages/server/src/plays.ts` (usar `createSetPiece` en lugar de `createCorner`)
- Test: `packages/engine/test/setpiece.test.ts`

**Interfaces:**
- Produces:
  - `createSetPiece(cmds: Command[], ctx: EngineContext): PlanResult`, que decide por `play.create.type`.
  - `SETPIECE_TYPES: readonly ["CORNER_ATT","CORNER_DEF","FK_WIDE_ATT","FK_WIDE_DEF","THROW_IN_ATT"]`.
- Un tipo no soportado devuelve `doc: null` y el diagnóstico `UNSUPPORTED-01`, sin lanzar excepción.

- [ ] **Step 1: Write the failing tests:** cada tipo de `SETPIECE_TYPES` produce `doc.type` igual al pedido; `FK_CENTRAL_ATT` da `UNSUPPORTED-01`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test && pnpm test:api` (requiere `pnpm db:dev`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): despachador de balón parado`

### Task 7: Salida de balón (`BUILD_UP`)

**Files:**
- Create: `packages/engine/src/phases/buildup.ts` (lo llama `computeScene`)
- Modify: `packages/engine/src/phases/scene.ts` (`SceneType` añade `BUILD_UP` y `ATTACK_SPACE`), `packages/engine/src/phases/types.ts`, `docs/engine/rules/constraints.yaml`, `docs/32_GAME_PHASES_MODULE.md` (sección nueva)
- Test: `packages/engine/test/buildup.test.ts`

**Interfaces:**
- Produces: `SceneSpec.params` añade:
  - `structure?: "2+1" | "3+1" | "FB_INSIDE"`;
  - `opp_pressers?: 1 | 2 | 3`;
  - `progress_to?: "DM" | "FB" | "CM" | "WINGER"`.
  - `SceneFrame.roles` admite `FREE_MAN` y `SUPPORT`.

**Reglas de colocación:**
- `3+1`: el MCD baja entre los centrales, que se abren a 12 m del eje; los laterales suben a la línea del MCD original.
- `2+1`: los centrales se abren a la anchura del área; el MCD queda a 10–12 m por delante, entre ellos.
- `FB_INSIDE`: el lateral del lado débil cierra al carril interior.
- **Hombre libre:** el jugador propio en la primera línea de pase sin rival a menos de 5 m. Si no hay ninguno, el diagnóstico es `BUILD-01` (aviso: "la presión iguala la salida").

- [ ] **Step 1: Write the failing tests**
  - Es determinista.
  - `3+1` contra `opp_pressers: 2`: en el primer fotograma hay 3 jugadores propios en la línea de salida, a ≤ 3 m en `x` entre ellos, y un `FREE_MAN`.
  - `2+1` contra 3 presionadores: aparece `BUILD-01`.
  - Los pasos narrados nombran al hombre libre.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): escena de salida de balón`

### Task 8: Ataque a espacios (`ATTACK_SPACE`)

**Files:**
- Create: `packages/engine/src/phases/spaces.ts`
- Modify: `scene.ts`, `constraints.yaml`, `docs/32_GAME_PHASES_MODULE.md`
- Test: `packages/engine/test/spaces.test.ts`

**Interfaces:**
- Produces:
  - `findSpaces(opp: Record<string, Pt>, pitch: Pitch): Space[]`, con `Space = { kind: "BETWEEN_LINES" | "BEHIND_FULLBACK" | "WEAK_SIDE" | "HALF_SPACE"; side: Side | "CENTER"; center: Pt; area_m2: number }`, ordenados por `area_m2` descendente y, en empate, por `kind`.
  - `SceneSpec.params.target?: Space["kind"]` y `target_side?: Side`. Si faltan, se usa el primer espacio de `findSpaces`.

**Cómo se calculan los huecos:**
- Las líneas rivales se agrupan por `x` (clúster de 1 dimensión con umbral de 6 m).
- `BETWEEN_LINES` es el rectángulo entre la línea media y la defensiva, en el carril sin rival a menos de 8 m.
- `BEHIND_FULLBACK` es la zona entre la línea defensiva y la portería, en la banda del lateral más adelantado.
- `WEAK_SIDE` es la banda contraria al balón, si la basculación deja más de 25 m libres.

- [ ] **Step 1: Write the failing tests**
  - `findSpaces` sobre un 4‑4‑2 en bloque medio devuelve `BETWEEN_LINES` con `area_m2 > 0`.
  - La escena con `target: "BEHIND_FULLBACK", target_side: "RIGHT"` termina con un atacante propio dentro de ese espacio y el balón dirigido a él.
  - Es determinista.
  - Cada paso tiene un `implies` que nombra el espacio.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): escena de ataque a espacios`

### Task 9: Pizarra libre (`fcs.board/1`)

**Files:**
- Create: `packages/engine/src/board/types.ts`, `board/apply.ts`, `board/validate.ts`, `board/tracks.ts`
- Modify: `command-ir.schema.json` (ops `board.*`), `packages/engine/src/index.ts`, `constraints.yaml`
- Test: `packages/engine/test/board.test.ts`

**Interfaces:**
- Produces:
  - `BoardDoc = { schema: "fcs.board/1"; title: string; pitch: Pitch; own: { formation: string; labels: Record<string,string> }; opp: { formation: string }; start: { own: Record<string,Pt>; opp: Record<string,Pt>; ball: Pt }; steps: BoardStep[]; diagnostics: Diagnostic[] }`
  - `BoardStep = { id: string; moves: { actor: string; to: Pt; kind: "RUN"|"DRIBBLE"|"MOVE"; origin: Origin }[]; pass?: { from: string; to: string | Pt; kind: "GROUND"|"AIR"; origin: Origin }; press?: { actor: string; target: string }[]; note?: { title: string; implies: string; origin: Origin } }`
  - Actor ids: `"own:<slot>"` / `"opp:<slot>"`.
  - `createBoard(spec: { own: string; opp: string; title?: string }, pitch?: Pitch): BoardDoc`, que coloca a todos con las formaciones (bloque medio de `computeScene`).
  - `applyBoardCommand(doc: BoardDoc, cmd: Command): { doc: BoardDoc; diagnostics: Diagnostic[] }`, con las ops `board.add_step`, `board.remove_step {step}`, `board.move {step, actor, to: Pt | {zone}, kind}`, `board.pass {step, from, to, kind}`, `board.press {step, actor, target}`, `board.note {step, title, implies}` y `board.set_formation {team, formation}`.
  - `boardTracks(doc: BoardDoc, roster: Player[]): Tracks`: 1,2 s por paso; un pase sale cuando termina el movimiento del pasador.

**Reglas:**
- `BOARD-01`: fuera del campo (error, el punto se ajusta al límite).
- `BOARD-02`: dos jugadores a menos de 1 m (aviso).
- `BOARD-03`: pase de más de 45 m o con un rival a menos de 1,5 m de la línea de pase (aviso, "riesgo de pérdida").
- `BOARD-04`: el receptor de un pase al espacio está en fuera de juego al salir el pase (aviso).

- [ ] **Step 1: Write the failing tests**
  - `createBoard` coloca 22 jugadores.
  - Aplicar `add_step`, `move` y `pass` y luego deshacer con `history` vuelve al hash inicial.
  - Un pase que cruza a un rival da `BOARD-03`.
  - Un punto fuera del campo queda ajustado y da `BOARD-01`.
  - `boardTracks` da `steps.length` igual al número de pasos, con narración automática cuando no hay `note`.
  - Es determinista.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): pizarra libre por pasos`

### Task 10: Paquete `@fcs/assistant` (isomórfico)

**Files:**
- Create: `packages/assistant/package.json`, `src/index.ts`, `src/loop.ts` (sale de `server/src/assistant/run.ts`), `src/prompt.ts` (sale de `server/src/assistant/prompt.ts`), `src/validate.ts` (ajv, con el esquema importado como JSON), `src/workspaces.ts`
- Modify: `packages/server/src/assistant/run.ts` (reexporta desde `@fcs/assistant`), `packages/server/src/routes/assistant.ts`, `tsconfig.json`, `vitest.config.ts`, `pnpm-workspace.yaml`
- Test: `packages/assistant/test/workspaces.test.ts`

**Interfaces:**
- Produces:
  - `runTurn(adapter, ws, history, message, maxIterations?)` y `LlmAdapter`, `LlmMessage`, `Workspace` (las mismas firmas de hoy).
  - `commandErrors(commands: unknown): string | null`.
  - `boardWorkspace(state: { doc: BoardDoc; roster: Player[] }, onChange: (doc: BoardDoc) => void): Workspace`
  - `setPieceWorkspace(state: { doc: PlayDoc | null; type: string; roster: Player[]; opponent?: string }, onChange: (doc: PlayDoc) => void): Workspace`
  - `sceneWorkspace(state: { spec: SceneSpec; roster: Player[] }, onChange: (spec: SceneSpec) => void): Workspace`
  - `contextSummary(ws: Workspace): string`: contexto en ≤ 4 KB, con estado, plantilla (dorsal, posición, pie) y rival.
- El resultado de cada herramienta es corto: `{ applied, diagnostics: [{rule_id, message}] }`, a lo sumo 1 KB.

- [ ] **Step 1: Write the failing tests**
  - `boardWorkspace().exec("apply_commands", {commands:[{op:"board.add_step"}, …]})` llama a `onChange` con `steps.length === 1`.
  - Un comando con `op: "board.fly"` devuelve `is_error: true` y no llama a `onChange`.
  - El resultado ocupa ≤ 1024 bytes.
  - El contexto ocupa ≤ 4096 bytes con una plantilla de 25 jugadores.
- [ ] **Step 2: Run** `pnpm vitest run packages/assistant`. Expected: FAIL.
- [ ] **Step 3: Implement**; mover sin cambiar el comportamiento.
- [ ] **Step 4: Run** `pnpm test && pnpm test:api && pnpm typecheck`. Expected: PASS, incluidas las 9 pruebas de API.
- [ ] **Step 5: Commit** `refactor: asistente isomórfico en @fcs/assistant`

### Task 11: Puertos y anfitriones

**Files:**
- Create: `packages/web/src/studio/ports.ts`, `studio/hosts/artifact.ts`, `studio/hosts/server.ts`, `studio/data/periso-2026-11-26.json` (los 4 conjuntos de datos del panel del Periso juntos: `{standings, fixtures, results, scorers, snapshot_at}`)
- Test: `packages/web/test/hosts.test.ts` (Vitest, con `window.claude` simulado)

**Interfaces:**
- Produces:
  - `type StudioItem = { id: string; kind: "BOARD"|"SETPIECE"|"SCENE"; title: string; match?: number; doc: BoardDoc | PlayDoc | SceneSpec; revision: number; updated_at: string; history: Command[][] }`
  - `TeamPort`, `StorePort`, `AiPort` y `ExportPort` con las firmas del diseño §5.1. `StorePort.save` rechaza con `Error` de `code: "conflict"` si `revision` no coincide.
  - `createArtifactHost(): Promise<Host>` y `createServerHost(teamId: string): Host`, con `Host = { team: TeamPort; store: StorePort; ai: AiPort; exporter: ExportPort; mode: "artifact"|"server" }`.

**Anfitrión de la página de Claude:**
- `db` en `studio/items/{id}` y `studio/roster`. La plantilla inicial (12 goleadores sin dorsal) solo se usa si `studio/roster` no existe, y no se escribe hasta que el entrenador guarda.
- `AiPort.turn`:
  - usa `sample` con `tools` si `limits().tools`;
  - si no, el plan B con `sample.json`, validando y reintentando una vez;
  - si `use("sample")` es `null`, `available()` devuelve `false`.
- `ExportPort` usa `downloads.save({filename: "<título>.html", data})`.

- [ ] **Step 1: Write the failing tests** (simulación de `claude.use`)
  - Sin `studio/roster`, `roster()` devuelve 12 jugadores con `shirt_number: null`.
  - `save` con una `revision` antigua rechaza con `code === "conflict"`.
  - Con `sample` que da `tools_unavailable`, `turn` usa `sample.json` y aplica los comandos válidos.
  - Con `use("sample") === null`, `available()` es `false`.
  - `exportHtml` llama a `downloads.save` con un nombre que termina en `.html`.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/test/hosts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): puertos y anfitriones Claude/servidor`

### Task 12: Interfaz, parte 1: armazón, tema, inicio y plantilla

**Files:**
- Create: `packages/web/src/studio/Studio.tsx`, `studio/theme.css`, `studio/components/{Shell,PitchBoard,StepBar,RosterSheet}.tsx`, `studio/pages/{Home,Roster}.tsx`, `studio/lib/import.ts`
- Modify: `packages/web/src/components/Pitch.tsx` (colores por props: `ownColor`, `ownInk`, `oppColor`; sin cambiar el comportamiento por defecto)
- Test: `packages/web/test/import.test.ts`

**Interfaces:**
- Consumes: `Host` (Task 11), `Pitch` y `useTimeline` existentes.
- Produces:
  - `<Studio host={Host} />`, con rutas `#home`, `#board`, `#setpieces`, `#plans`, `#library` y `#roster`. Solo nombres simples: el hash de la página de Claude no admite `/`.
  - `parseRosterText(text: string): { players: Player[]; errors: string[] }`. Acepta líneas `dorsal nombre apellidos posición [pie]` y CSV con cabecera `dorsal,nombre,apellidos,posicion,pie,altura`. Las posiciones se escriben en español (POR, LD, DFC, LI, MCD, MC, MCO, ED, EI, DC).

**Aspecto:**
- Fondo oscuro verdoso `#0e1511`, superficies `#16201a`, acento verde `#1f9d55`, texto `#e8efe9`, tema claro equivalente.
- Campo con franjas `#2f7d3e` / `#2a7038`.
- Tipografía Inter y Space Grotesk, cargadas de Google Fonts y con fuentes de reserva.
- Navegación inferior en el móvil y lateral en el escritorio.

**Inicio:**
- Próximo partido con los datos del `TeamPort` (rival, posición, puntos en casa, racha, máximo goleador, últimos 5).
- Botones "Preparar balón parado" y "Plan contra <rival>", que abren las secciones con el rival preseleccionado.

- [ ] **Step 1: Write the failing tests:** `parseRosterText("1 Juan Pérez POR\n9 Raúl Somavilla DC zurdo")` da 2 jugadores con `primary_position` `GK` y `ST` y `dominant_foot: "LEFT"`; una línea sin posición va a `errors` con su número de línea; el CSV con cabecera se interpreta igual.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the tested `import.ts`, then the components.
- [ ] **Step 4: Run** `pnpm vitest run packages/web && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): armazón, inicio y plantilla`

### Task 13: Interfaz, parte 2: pizarra, balón parado, planes, chat, biblioteca y exportación

**Files:**
- Create: `studio/pages/{Board,SetPieces,Plans,Library}.tsx`, `studio/components/{ChatPanel,StepList,Inspector,Thumb}.tsx`, `studio/lib/editor.ts`
- Test: `packages/web/test/editor.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 6, 7, 8, 9, 10 y 11.
- Produces:
  - `useStudioEditor(item: StudioItem, host: Host)` → `{ doc, tracks, diagnostics, apply(cmds, origin), undo, redo, canUndo, canRedo, save, exportHtml }`. Deshacer y rehacer usan `history.ts`. `apply` con origen `ASSISTANT` se registra como un único paso que se puede deshacer.
  - `editorReducer(state, action)`: función pura, probada.

**Pantallas:**
- **Pizarra:** arrastrar una ficha genera `board.move`. "Pase" genera `board.pass` tocando al pasador y después al receptor o a un punto. La línea de pasos (`StepBar`) permite añadir, borrar e ir a un paso. El panel lateral tiene la lista de pasos (con `title` e `implies` editables, que generan `board.note`), los avisos y el chat.
- **Balón parado:** pestañas por tipo de `SETPIECE_TYPES`; asistente con lado, distancia, variante y esquema; editor de jugada; chat.
- **Planes:** tarjetas Salida de balón, Presión alta, Presión media, Ataque a espacios, Repliegue y Vigilancias. Parámetros (estructura, presionadores, espacio objetivo y lado, sistemas propio y rival), animación, pasos y chat.
- **Biblioteca:** cuadrícula de `StudioItem` con miniatura (`tracksFrameSvg`), filtros por tipo y jornada, y acciones de abrir, duplicar, exportar HTML y borrar (confirmación dentro de la página, sin `confirm()`).
- **Chat (`ChatPanel`):** muestra la respuesta en vivo (`onText`), las preguntas con opciones como botones y un botón "Deshacer lo del asistente". Se oculta si `host.ai.available()` es `false`.

- [ ] **Step 1: Write the failing tests** for `editorReducer`
  - `apply` → `undo` vuelve al documento inicial (mismo hash).
  - Un `apply` del asistente con 3 comandos se deshace de una vez.
  - Si los comandos no validan, el documento no cambia y se añade un diagnóstico.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the reducer, then the pages.
- [ ] **Step 4: Run** `pnpm vitest run packages/web && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): pizarra, balón parado, planes, biblioteca y chat`

### Task 14: Compilación de la página de Claude y prueba E2E

**Files:**
- Create: `packages/web/src/artifact-main.tsx`, `packages/web/artifact.html`, `packages/web/scripts/build-artifact.mjs`, `packages/web/e2e/studio-artifact.mjs`
- Modify: `packages/web/package.json` (script `build:artifact`), `package.json` (raíz: `studio:artifact`, `e2e:studio`)

**Interfaces:**
- Produces: `dist-artifact/pizarra.html`, un único archivo con un `<title>Pizarra Periso</title>` y el JS y CSS en línea.
- `build-artifact.mjs` ejecuta `vite build --mode artifact` (entrada `artifact.html`) y sustituye cada `<script src>` y `<link rel=stylesheet>` por su contenido. Falla con código de salida ≠ 0 si queda alguna referencia a un archivo o el resultado supera los 16 MB.

**Prueba E2E:** con `window.claude` simulado (db en memoria, `sample` con herramientas que ejecuta un guion fijo y `downloads` que captura).
- **Inicio:** muestra "Sporting Hortaleza".
- **Plantilla:** pegar 16 jugadores e importarlos.
- **Pizarra:** 2 pasos con movimiento y pase. El chat "haz que el 9 baje a recibir" aplica `board.move`. Deshacer.
- **Balón parado:** falta lateral derecha, cambiar a centro abierto.
- **Planes:** salida de balón 3+1 contra 2 presionadores.
- **Exportación:** se captura un HTML con "Paso 1 de".
- **A 390 px:** sin desplazamiento horizontal en ninguna sección.

- [ ] **Step 1: Write** `e2e/studio-artifact.mjs` with the flow above.
- [ ] **Step 2: Run** `pnpm studio:artifact && CHROMIUM_PATH=… pnpm e2e:studio`. Expected: FAIL until the build exists, then PASS.
- [ ] **Step 3: Fix** whatever the E2E finds.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm e2e:studio`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): página de Claude en un solo archivo y prueba E2E`

### Task 15: Enganche con el servidor

**Files:**
- Create: `packages/server/migrations/0003_studio.sql` (tabla `studio_item`: `id uuid`, `team_id`, `kind`, `title`, `match_id null`, `doc jsonb`, `history jsonb`, `revision int`, `updated_at`), `packages/server/src/routes/studio.ts`, `scripts/seed-periso.ts`
- Modify: `packages/server/src/app.ts`, `packages/server/src/routes/assistant.ts` (`POST /assistant/turn` con `{kind, state, history, message}` que usa los *workspaces* de `@fcs/assistant`), `packages/web/src/App.tsx` (ruta `#/studio/<teamId>` → `<Studio host={createServerHost(teamId)} />`), `docs/api/openapi.yaml`
- Test: `packages/server/test/studio.test.ts`

**Interfaces:**
- **Rutas:** `GET|POST /teams/:id/studio/items`, `GET|PUT|DELETE /studio/items/:id` (`PUT` con `revision`; si no coincide, 409 `conflict`), `GET /studio/items/:id/export.html`.
- Permisos con `requireStaff`.
- **Semilla:** `scripts/seed-periso.ts --team <id>` crea los partidos del Periso y los 12 goleadores desde `periso-2026-11-26.json`.

- [ ] **Step 1: Write the failing tests**
  - Crear, leer y actualizar.
  - `PUT` con una revisión antigua da 409.
  - La exportación devuelve `text/html` con "Paso 1 de".
  - Un usuario sin rol de cuerpo técnico recibe 403.
  - `POST /assistant/turn` con `ScriptedAdapter` y `kind: "BOARD"` devuelve el documento modificado.
- [ ] **Step 2: Run** `pnpm test:api`. Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `pnpm test && pnpm test:api && pnpm web:build && pnpm e2e` (la E2E actual sigue en verde). Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): Pizarra Studio en el servidor`

### Task 16: Publicación y documentación

**Files:**
- Modify: `README.md` (estado y cómo compilar la página), `docs/29_ARCHITECTURE_DECISIONS.md` (ADR‑021: puertos y anfitriones; ADR‑022: `sample` en la página de Claude), `docs/31_CONVERSATIONAL_ASSISTANT.md` (§ anfitriones)

- [ ] **Step 1:** Publicar `dist-artifact/pizarra.html` con la herramienta Artifact y las capacidades de Global Constraints, con `icon: "board"`.
- [ ] **Step 2:** Una lectura de comprobación con `ArtifactData list` de `studio` (la colección que escribe la página) y la misma con `as_level: "view"`, que no debe poder escribir.
- [ ] **Step 3:** Actualizar la documentación.
- [ ] **Step 4: Commit and push** `docs: Pizarra Studio publicada; ADR-021/022`
