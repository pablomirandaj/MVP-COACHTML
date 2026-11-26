# Pizarra Studio — diseño

Fecha: 26/11/2026 · Estado: **aprobado** (26/11/2026)

## 1. Para qué

El entrenador del Periso CF 'A' (Primera Autonómica Aficionado, Grupo 1, RFFM) quiere preparar cada partido en una sola herramienta:

- diseñar jugadas en una **pizarra** iterando en lenguaje natural con el asistente;
- tener **todo el balón parado** (córners y faltas laterales a favor y en contra, saques de banda);
- preparar **planes de juego**: cómo presionar al rival, cómo atacar sus espacios, cómo salir con balón, cómo replegar;
- **enviar** cada jugada como un HTML que el jugador abre en el móvil y que, en cada paso de la animación, dice qué movimiento ocurre y qué implica.

Todo con los datos reales del equipo (calendario, rival, clasificación, goleadores, plantilla).

Primero se usará como página publicada en Claude, para afinarla sin servidor. Pero es un producto que se quiere vender: **el mismo código debe funcionar en la aplicación web con servidor** cuando se contrate, sin reescribir nada. Conectarlo debe ser cambiar el "anfitrión", no la aplicación.

## 2. Objetivos, no objetivos, antiobjetivos

**Objetivos**
1. Una interfaz nueva, cuidada y táctil, con: inicio del partido, pizarra libre, balón parado, planes de juego, biblioteca y plantilla.
2. Motor ampliado: falta lateral (a favor y en contra), córner en contra, saque de banda, salida de balón, ataque a espacios y pizarra libre por pasos. Cada paso lleva su explicación.
3. Asistente que propone órdenes del motor (nunca coordenadas sueltas); el motor valida y aplica; el entrenador acepta o deshace.
4. Exportación HTML autónoma por pasos, con nombres y dorsales, vista vertical en móvil y sin conexión.
5. Una sola base de código con dos anfitriones: **página de Claude** y **servidor propio**.

**No objetivos (en esta entrega)**
- Voz, vídeo, PPTX, pagos, multiclub, apps nativas.
- Leer fichas de equipo o de jugador de la RFFM (su `robots.txt` lo prohíbe): la plantilla la introduce el entrenador.
- Desplegar el servidor (se deja listo para enganchar).

**Antiobjetivos** (fracaso aunque "funcione")
- Que el asistente dibuje posiciones inventadas o que la misma petición dé jugadas distintas.
- Que haya dos aplicaciones distintas (una para Claude y otra para el servidor) que se separen con el tiempo.
- Que el HTML enviado a un jugador dependa de internet o de una cuenta.
- Una interfaz de formulario plana: tiene que apetecer usarla en el campo, con el móvil.

## 3. Restricciones

- **Motor determinista** (ADR‑001, 017, 018): las posiciones salen de reglas. El asistente solo emite comandos IR validados con `docs/engine/command-ir.schema.json`.
- **Página de Claude**: todo el código y los estilos van dentro de un único HTML (≤ 16 MB). No hay `fetch` a otros dominios ni descargas con `<a download>`. Las capacidades disponibles son `sample` (preguntar a Claude, lo paga quien la usa), `db` (datos compartidos), `downloads` (descargar el HTML) y `user`.
- **Servidor**: Fastify + PostgreSQL ya existentes (ADR‑019/020); el asistente del servidor usa `LlmAdapter` (Anthropic por defecto).
- Datos de la RFFM: solo páginas públicas permitidas (calendario, clasificación, goleadores).

## 4. Enfoques considerados

| Enfoque | Qué supone | Veredicto |
|---|---|---|
| **A. Motor empaquetado + puertos** | La interfaz depende de cuatro interfaces (IA, almacenamiento, exportación, datos del equipo). Hay dos implementaciones: página de Claude y servidor. El motor y el bucle del asistente son los mismos en ambos. | **Elegido** |
| B. Que Claude genere las posiciones o el HTML | Rápido de hacer, pero no es reproducible, no se puede validar y contradice ADR‑017/018. | Descartado |
| C. Página de Claude aparte, con un motor simplificado | Dos productos que mantener; lo afinado en Claude no sirve para vender. | Descartado por el entrenador ("no es escalable ni vendible") |

## 5. Arquitectura

```
packages/
  engine/      + setpiece/{freekick,throwin,defend}.ts, phases/{buildup,spaces}.ts, board/*, narrate.ts
  assistant/   NUEVO, isomórfico: herramientas, contexto, validación IR (ajv), runTurn, prompt
  render/      html.ts v0.2: reproductor por pasos con explicación
  server/      usa @fcs/assistant; rutas nuevas para tableros (board) y planes
  web/
    src/studio/          NUEVA interfaz (React)
      ports.ts           AiPort, StorePort, ExportPort, TeamPort
      hosts/server.ts    implementación con /api
      hosts/artifact.ts  implementación con claude.use("sample"|"db"|"downloads"|"user") y datos embebidos
    src/main.tsx         app actual + ruta #/studio (servidor)
    src/artifact-main.tsx  entrada de la página de Claude
    scripts/build-artifact.mjs  junta JS y CSS en un solo HTML → dist-artifact/pizarra.html
```

### 5.1 Puertos

```ts
interface TeamPort   { team(): TeamInfo; roster(): Promise<Player[]>; saveRoster(p: Player[]): Promise<void>;
                       fixtures(): Fixture[]; standings(): Standing[]; scorers(): Scorer[] }
interface StorePort  { list(): Promise<ItemMeta[]>; load(id): Promise<StudioItem>; save(item, baseRevision?): Promise<Saved>; remove(id) }
interface AiPort     { available(): Promise<boolean>; turn(ws: Workspace, history: Msg[], text: string, onText?): Promise<TurnResult> }
interface ExportPort { exportHtml(tracks: Tracks, meta): Promise<void> }
```

- **Página de Claude.**
  - `AiPort` llama a `sample` con `tools` cuyo `execute` es `ws.exec` en el navegador; el bucle de herramientas lo hace el propio `sample`.
  - `StorePort` usa `db`: `studio/items/{id}` compartido entre el cuerpo técnico, que lee y escribe con nivel *interact*.
  - `ExportPort` usa `downloads.save`.
  - `TeamPort` lee el instantáneo de la RFFM embebido y la plantilla en `db` (`studio/roster`).
- **Servidor.**
  - `AiPort` hace `POST /api/assistant/turn`; el servidor ejecuta el mismo `runTurn` de `@fcs/assistant` con `AnthropicAdapter`.
  - `StorePort` usa las rutas de jugadas, escenas y tableros. `ExportPort` usa `GET .../export.html`. `TeamPort` usa `/teams/:id/players` y `/matches`.
- `sample` no admite instrucciones de sistema: el prompt y el contexto van en el mensaje. Admite pocas rondas de herramientas por llamada, así que las respuestas de las herramientas deben ser cortas: el resumen del cambio y los avisos, no el documento entero.
- Si `sample.limits()` no ofrece herramientas, se usa un plan B: `sample.json` pide la lista de comandos; el motor la valida en local; si falla, se repite una vez con los errores.
- Si `sample` no está disponible (permiso denegado), la pizarra funciona entera a mano y el chat se oculta.

### 5.2 Asistente compartido (`@fcs/assistant`)

- Se mueve aquí desde `server/src/assistant`: `runTurn`, `ASK_COACH`, `commandsTool`, la validación IR y el prompt. El esquema IR se importa como JSON, sin `fs`, para que funcione en el navegador.
- `Workspace` por tipo de pieza: `BOARD`, `SETPIECE`, `SCENE`, `LINEUP`. Cada uno da su contexto (estado, plantilla, rival) y sus herramientas (`apply_commands`, `create_setpiece`, `update_scene`, `ask_coach`).
- Cada turno aceptado se guarda como versión nueva con procedencia `ASSISTANT`. Deshacer funciona igual que hoy.

## 6. Motor: lo nuevo

### 6.1 Balón parado (`PlayDoc`, `fcs.play/1`)

`createSetPiece(kind, cmds, ctx)` generaliza `createCorner`:

| Tipo | Contenido |
|---|---|
| `CORNER` (ya existe) | Igual que hoy |
| `FREE_KICK_WIDE` | Falta lateral a favor. Posición por lado y distancia a la línea de fondo, o por zona. Centro cerrado o abierto, al primer o al segundo palo, o en corto. Roles: lanzador, bloqueos, rematadores, arrastre, rechace y vigilancias. Línea de fuera de juego del rival calculada a partir de la posición del balón. |
| `THROW_IN` | Saque de banda: largo al área (con bloqueo y peinada) o combinación corta (tercer hombre). |
| `CORNER_DEF` / `FREE_KICK_WIDE_DEF` | Defensa: zonal, al hombre o mixta. Marcas asignadas con el algoritmo húngaro según altura y rol (si falta la altura, según la posición); zonas del área por catálogo; salida a la contra. |

Reglas nuevas con identificador (`LAW-FK-*`, `TACTICAL-DEF-*`), por ejemplo: barrera a 9,15 m, nadie en fuera de juego en el momento del golpeo, cada rematador rival peligroso con marca o zona asignada.

### 6.2 Planes de juego (`SceneDoc`, `fcs.scene/1`)

| Tipo | Qué calcula |
|---|---|
| `BUILD_UP` (nuevo) | Salida de balón: estructuras 2+1, 3+1 (pivote entre centrales) o con un lateral por dentro, frente a la presión rival de 1 o 2 puntas. Secuencia de pasos portero → central → pivote o lateral → progresión, con el hombre libre calculado (superioridad +1). |
| `ATTACK_SPACE` (nuevo) | Busca los huecos del bloque rival según su sistema y la altura del bloque: entre líneas, a la espalda del lateral, en el lado débil y en los carriles interiores. Coloca la circulación y el desmarque hacia el hueco elegido. |
| `PRESS_OWN`, `PRESS_OPP`, `RETREAT`, `REST_DEFENSE` | Ya existen; se les añade la explicación por paso. |

### 6.3 Pizarra libre (`fcs.board/1`, nuevo)

- **Contenido:** 22 jugadores más el balón, colocados desde la alineación, y una lista de pasos. Cada paso tiene movimientos (jugador → punto o zona), pases, conducciones, carreras con flecha, una marca de presión y una nota.
- **Órdenes:** `board.move`, `board.pass`, `board.dribble`, `board.run`, `board.press`, `board.add_step`, `board.remove_step`, `board.note`, `board.set_formation`.
- **Validación:** jugadores dentro del campo, sin superponerse, pases de más de 45 m o que cruzan a un rival señalados como riesgo, aviso de fuera de juego en los pases al espacio.

### 6.4 Explicación por paso (`narrate.ts`)

Cada paso o fotograma lleva `{ title, implies, source }`. Se genera de forma determinista con plantillas por tipo de evento. Ejemplos:

- **Salto de presión:** "El MC salta al DFC rival" / "El MCD cierra su carril; si el pivote rival recibe, lo vigila el ED."
- **Bloqueo:** "El 4 bloquea al marcador del 9" / "El 9 llega solo al primer palo."
- **Pase a la espalda:** "El 8 filtra a la espalda del LI rival" / "Su central tiene que salir a la banda y el área queda 2 contra 2."

El entrenador puede editar la frase y el asistente puede reescribirla (procedencia `MANUAL` o `ASSISTANT`).

### 6.5 Pruebas

Por cada tipo nuevo, en el estilo de las 37 pruebas actuales:

- el mismo comando da el mismo documento (hash);
- se cumplen las reglas;
- la edición y el deshacer funcionan.

Cuatro casos nuevos por tipo como mínimo.

## 7. Exportación HTML (render v0.2)

- **Pantalla del jugador:** título (jugada, partido y rival), campo animado y lista de pasos "Paso 2 de 5 — El 6 baja entre centrales · Implica: …". El paso en curso se resalta.
- **Controles:** reproducir, avance paso a paso, pausa automática al empezar cada paso (activable) y velocidad.
- **Contenido:** colores del equipo, dorsal y nombre de cada jugador, leyenda de flechas y vista vertical en móvil (ya existe).
- **Formato:** un único archivo, sin conexión, ≤ 300 KB.

## 8. Interfaz

Estética de pizarra de vestuario moderna: campo con franjas de césped, fichas redondas con el dorsal, flechas a mano alzada para las carreras y discontinuas para los pases, y un panel lateral oscuro. En el móvil, el campo va en vertical y el panel se convierte en una hoja inferior.

```
┌ Periso CF ─────────────────────────────────────────────┐
│ Inicio · Pizarra · Balón parado · Planes · Biblioteca · Plantilla │
├───────────────────────────────┬────────────────────────┤
│                               │ Paso 2/5  ◀ ▶  ▶︎ 1x    │
│        campo animado          │ "El 6 baja entre…"     │
│   (arrastrar fichas, pasos)   │ Implica: …             │
│                               │ ─ Avisos del motor ─   │
│ ━━●━━━━━━|━━━━|━━━━ línea de pasos │ ─ Chat ─ "Haz que…"   │
└───────────────────────────────┴────────────────────────┘
```

- **Inicio:** próximo partido (fecha, campo, rival: posición, puntos en casa, racha, máximo goleador, últimos resultados) y "Preparar el partido", que propone el balón parado y los planes contra ese rival.
- **Pizarra:** tablero libre por pasos con chat.
- **Balón parado:** asistente de creación por tipo, editor y chat.
- **Planes:** salida de balón, presión, ataque a espacios, repliegue y vigilancias, todos con parámetros y chat.
- **Biblioteca:** tarjetas con miniatura, filtros por tipo y por partido, duplicar, exportar HTML y borrar.
- **Plantilla:** ficha con dorsal, posiciones, pierna, altura y roles de balón parado. Empieza con los 12 goleadores de la RFFM.

## 9. Datos

- **Plantilla:** el entrenador pidió leerla de BeSoccer, pero su web rechaza el acceso automático (403). Las vías posibles son la API oficial de BeSoccer con clave (`api.besoccer.com`, por confirmar si cubre la Autonómica) o la introducción manual en la página o la importación desde texto o CSV, que la página admite.
- **Página de Claude:** se embebe el instantáneo del 26/11/2026 que ya usa el panel del Periso: clasificación, 34 partidos del Periso, 306 del grupo y goleadores. La plantilla vive en `db` y empieza con los 12 goleadores, sin dorsal ni posición. La primera vez, la página pide completarla.
- **Rival:** se elige cualquiera de los 17. El sistema del rival no se conoce: por defecto 4‑4‑2, y el entrenador lo cambia.
- **Servidor:** el script `scripts/seed-periso.ts` carga el mismo instantáneo como equipo, partidos y jugadores mediante la API.

## 10. Lo que decide quien construye

- Nombres de archivos internos, división en componentes, iconos y pequeñas animaciones.
- Valores numéricos de las plantillas tácticas nuevas, siempre que cumplan las reglas y queden documentados en el catálogo YAML.
- Orden de implementación, con la condición de que cada parte quede probada antes de la siguiente.

## 11. Decisiones tomadas por Claude (a revisar por el entrenador)

1. Sistema por defecto del Periso 4‑3‑3; del rival, 4‑4‑2.
2. Los datos compartidos en la página de Claude los leen y escriben todos los que tengan el enlace con permiso de edición o de uso; en el servidor, el rol de cuerpo técnico.
3. El asistente de la página usa el nivel de modelo "default" de `sample`, que paga quien lo usa.
4. Colores del Periso: **verde y negro** (confirmado por el entrenador). Rival: rojo por defecto, editable.
