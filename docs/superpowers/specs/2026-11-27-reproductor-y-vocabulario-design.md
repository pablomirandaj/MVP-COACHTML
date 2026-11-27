# Reproductor por pasos «como la J5» y vocabulario de entrenador — diseño

Fecha: 27/11/2026 · Estado: **aprobado** («hazlo como la otra vez»)

## 1. Para qué

El entrenador compara la app con el HTML que preparamos para la J5 contra el Canillas («Balón parado · J5 vs CD Canillas») y pide que la app sea capaz de producir eso. Sus quejas concretas:

- En el campo de la app se ven a la vez las flechas de todos los pasos: no se entiende. **Que las líneas no aparezcan** (solo las del paso actual, o ninguna).
- **Opción de dar atrás** y una app **más intuitiva**.
- El asistente **no entiende sus indicaciones**: no sabe que el pivote es el 6, el medio de la base en un 4‑3‑3.

## 2. Referencia: lo que hace el HTML de la J5

| Elemento | Detalle |
|---|---|
| Campo | Medio campo vertical (portería arriba), césped oscuro con degradado, líneas tenues |
| Jugadores | Nuestros: círculo verde con borde verde claro y número de **papel en la jugada** (1–8, `S` sacador, `F` frontal, `C` cierre en verde apagado). Rivales: círculo granate con borde rojo. Balón dorado |
| Pasos | Cada paso: **título corto** («Bloqueos», «El 5 da la vuelta») + **frase**. Los pasos clave llevan «AHORA» (dorado, parpadeando) |
| Movimiento | Los jugadores se desplazan con transición CSS (0,62 s; más lento en 0,6×) de un paso al siguiente |
| Flechas | Solo las del paso actual (aparecen con un fundido). Las de pasos anteriores, al 16 % |
| Jugadores clave | Borde dorado en los que protagonizan el paso |
| Controles | ◀ · Pausa/Reproducir · ▶ · velocidad (1×, 0,6×, 1,6×) y una barra de progreso por pasos |
| Varias jugadas | Pestañas |
| Ficha de cada jugada | Antetítulo, nombre y subtítulo; tabla **quién / qué**; tres notas: **«El hueco que atacamos»**, **«La clave»**, **«Si sale mal»** |
| Reglas fijas | Recuadro «Esto no cambia nunca» con viñetas |
| Marca | Escudo y foto del club en la cabecera; Oswald + Inter; negro `#070B08`, verde `#0E7A32`, verde claro `#35D45F`, oro `#D9A526`, rojo `#D6263B` |

## 3. Objetivos

1. **Secuencia por pasos (`fcs.seq/1`)**: una representación común, generada de forma determinista por el motor a partir de cualquier pieza (pizarra, balón parado, plan de juego), con el modelo del ejemplo: posiciones por paso, balón, desmarques, pases, bloqueos, jugadores clave, «AHORA», título y frase.
2. **Un único reproductor** (`@fcs/render`, sin dependencias) que se usa igual dentro de la app y en el HTML exportado, con el aspecto y el comportamiento de la J5, más un interruptor **«Flechas»** (sí/no).
3. **Ficha de la jugada** guardada con la pieza: subtítulo, tabla quién/qué, hueco, clave, riesgo. La rellena el motor con una propuesta, el asistente puede reescribirla y el entrenador la edita.
4. **Exportar la carpeta del partido**: varias piezas de la biblioteca en un HTML con pestañas, cabecera con escudo y foto, jornada y rival, y las reglas fijas del equipo (editables y guardadas).
5. **Editor más claro**: en la pizarra solo se dibujan las flechas del paso seleccionado; botones grandes de deshacer y rehacer junto al campo; pestaña «Ver» con el reproductor de la J5.
6. **Vocabulario de entrenador**: numeración española por puesto (2, 3, 4, 5, 6, 8, 10, 7, 11, 9), alias por sistema (pivote, interiores, mediapunta, carrileros, falso 9…), conceptos tácticos traducidos a órdenes, tabla «quién es quién» en cada mensaje, herramienta para resolver un nombre o número y un banco de frases de entrenador con su traducción como prueba.
7. **Corregir los cuatro fallos de colocación** encontrados en la presión: delanteros rivales a la espalda de nuestra línea, línea demasiado ancha, cobertura mal colocada y mediocentro rival libre.

## 4. No objetivos

- Leer la plantilla de fuentes externas.
- Editar a mano la ficha de la jugada en el HTML exportado: es de solo lectura.
- Que el asistente coloque jugadores fuera del motor.

## 5. Diseño

### 5.1 `fcs.seq/1` (motor, `packages/engine/src/sequence/`)

```ts
interface SeqActor { id: string; team: "OWN" | "OPP"; label: string; kind?: "back" | "edge" | "taker" }
interface SeqFrame {
  beat: string; txt: string; trig?: boolean; key?: string[];
  pos?: Record<string, [number, number]>;   // cambios respecto al paso anterior, en metros del marco de ataque
  ball?: [number, number];
  runs?: Line[]; passes?: Line[]; blocks?: Line[];   // Line = [x1,y1,x2,y2] | [x1,y1,cx,cy,x2,y2]
}
interface Sequence { schema: "fcs.seq/1"; title: string; view: "HALF" | "FULL"; pitch: Pitch;
  actors: SeqActor[]; start: Record<string, [number, number]>; ball: [number, number]; frames: SeqFrame[] }
```

- `sequenceOfPlay(doc, roster, { labels: "ROLE" | "DORSAL" })`: colocación → bloqueos → golpeo (`trig`) → desmarques → llegada o remate (`trig`); pases encadenados del saque corto; en defensa, colocación → golpeo → marcas → contra. Números de papel: los rematadores y bloqueadores 1…n por orden de actor, `S` el lanzador, `F` la frontal o el rechace, `C` las vigilancias.
- `sequenceOfScene(scene)`: un paso por fotograma clave; presionadores y coberturas en `key`; los saltos como desmarques y los pases entre poseedores; `trig` en el disparador.
- `sequenceOfBoard(board)`: un paso por paso de la pizarra; `beat` y `txt` de la nota o de la explicación automática; `key` = quien mueve, pasa o presiona, o la lista `key` del paso; `trig` del paso.
- `view: "HALF"` para el balón parado (portería rival arriba); `"FULL"` para pizarra y planes (vertical en el móvil, horizontal en el escritorio).

### 5.2 Reproductor (`packages/render/src/player/`)

- `createPlayer(root, seq, opts)`: JavaScript del navegador **autocontenido**, sin importaciones ni referencias externas. El HTML exportado lo incrusta con `createPlayer.toString()`, y la app lo monta en un `ref` de React: es una sola implementación.
- Dibuja el campo (medio o entero, vertical u horizontal) y coloca a cada jugador con `transform` y transición CSS.
- Muestra las flechas del paso actual, con las anteriores al 16 %. Con «Flechas» desactivado no se dibuja ninguna.
- Opciones: `autoplay`, `speed`, `arrows`, `onFrame`. Métodos: `go(i)`, `next()`, `prev()`, `play()`, `pause()`, `setArrows(b)` y `destroy()`.
- Estilos con prefijo `fcsp-` para no chocar con la app.
- `renderDossierHtml(dossier)`: cabecera (escudo, club, categoría, jornada y rival, título), pestañas, reproductor, estado («AHORA»), controles, barra de pasos, leyenda, ficha de cada jugada, reglas fijas y pie. Un único archivo, sin conexión salvo las fuentes de Google (con fuentes de reserva); escudo y foto en base64. Con una sola jugada no se muestran pestañas.

### 5.3 Ficha de la jugada

- `StudioItem.sheet?: { subtitle: string; table: [string, string][]; hueco: string; clave: string; riesgo: string }`.
- `proposeSheet(seq)` (motor) genera una propuesta a partir de la secuencia: una fila por número con su tarea y frases por tipo de jugada. El asistente puede reescribirla con una herramienta nueva, `set_sheet`, y el entrenador la edita en un panel.
- La pizarra añade a `BoardStep` los campos `key?: string[]` y `trig?: boolean`, y la orden `board.mark_step {step, key?, trig?}`.

### 5.4 Interfaz

- **Pizarra:** pestañas «Editar» y «Ver». En «Editar», `Pitch` dibuja solo las flechas del paso seleccionado y una barra fija bajo el campo con ↶, ↷, ◀ y ▶. En «Ver», el reproductor (`PlayerView`), con el interruptor «Flechas».
- **Balón parado y Planes:** la vista principal pasa a ser el reproductor; la edición directa (arrastrar) queda en la pestaña «Editar».
- **Biblioteca:** modo «Seleccionar» y botón **«Exportar carpeta del partido»**, que abre un diálogo con título, jornada, rival, reglas fijas y el orden de las jugadas. Las reglas se guardan en `studio/settings` (página de Claude) o en `team_studio_settings` (servidor).
- **Exportar HTML de una pieza:** usa el nuevo formato (`renderDossierHtml` con una jugada). El formato anterior por pistas se mantiene para la charla en PDF.

### 5.5 Vocabulario (`packages/engine/src/football/`)

- `vocab.ts` (datos versionados en `docs/engine/lexicon/es-ES.yaml`, corregidos: «el cinco» deja de ser el pivote):
  - `ROLE_NUMBER_ES`: `GK 1, RB 2, LB 3, CB 4 y 5, DM 6, CM 8 (y 10 si hay dos interiores), AM 10, RW 7, LW 11, ST 9`.
  - Alias de puesto por formación: en el 4‑3‑3, «pivote» y «el 6» son `DM`, y «los interiores», «el 8» y «el 10» son `CM_L` y `CM_R`. En el 4‑2‑3‑1, «los pivotes» o «el doble pivote» son `DM_L` y `DM_R`, y «el mediapunta» o «el 10» es `AM`. En el 3‑5‑2, «los carrileros» son `LWB` y `RWB`.
- `resolvePlayerRef(text, { formation, labels, roster })` devuelve `{ slots, via: "position" | "shirt" | "name", ambiguous }`. Regla de ambigüedad: con «de N» o «el que juega de N» se busca el puesto; con un nombre, el nombre; con «el N» se busca el dorsal si existe y el puesto si no; si dorsal y puesto apuntan a ranuras distintas, `ambiguous: true`.
- `whoIsWho(formation, labels, roster)`: tabla «ranura = nombres de entrenador · número · jugador». Va en el contexto de la pizarra y de las escenas.
- Herramienta `resolve_player {text}` en los espacios de trabajo.
- Prompt: rol de entrenador UEFA en español de España, glosario táctico (saltar, bascular, fijar, temporizar, tercer hombre, salida lavolpiana, lateral por dentro, atacar la espalda, cambio de orientación, vigilancias, bloque alto/medio/bajo, primer y segundo palo, bloqueo, arrastre) con la orden del motor que corresponde a cada término y seis ejemplos completos.
- Banco de pruebas `docs/engine/tests/coach-phrases.yaml`: unas 60 frases con la ranura o el concepto esperado; se prueba `resolvePlayerRef` y la traducción de conceptos (parte determinista).

### 5.6 Colocación (motor de escenas)

- **SHAPE-03:** en presión y repliegue, nuestra línea defensiva nunca queda por delante de sus delanteros más adelantados; queda 2 m por detrás del último rival y los delanteros rivales se colocan por delante de nuestra línea.
- **SHAPE-04:** con el balón en banda, la anchura de nuestro bloque (de lateral a lateral) es ≤ 38 m.
- **PRESS-02:** la cobertura se coloca en la línea de pase interior entre el poseedor y su receptor más cercano por dentro, no a medio camino del saltador.
- **PRESS-03:** si un mediocentro rival queda sin nadie a menos de 8 m, el mediocentro propio más cercano lo vigila (rol `MARK`).

## 6. Pruebas

- **Motor:** secuencias deterministas para cada tipo; el ejemplo de la J5 reproducido como secuencia de prueba; SHAPE‑03/04 y PRESS‑02/03 con las posiciones medidas; `resolvePlayerRef` con el banco de frases.
- **Reproductor:** en Chromium, al pulsar ▶ cambia el título del paso y las flechas antiguas tienen opacidad ≤ 0,2; con «Flechas» desactivado hay 0 flechas; a 390 px no hay desplazamiento horizontal.
- **E2E de la página:** «Ver» en la pizarra, exportar la carpeta con dos jugadas (el HTML contiene las dos pestañas, «Esto no cambia nunca» y el escudo) y deshacer con el botón junto al campo.

## 7. Decisiones tomadas por Claude

1. Los números de papel en la jugada (1…n) se usan por defecto en balón parado, como en la J5; en pizarra y planes, los dorsales. Se puede cambiar en «Ver».
2. Las reglas fijas por defecto son las cinco del ejemplo de la J5.
3. El escudo y la foto se toman del ejemplo de la J5 (`packages/web/src/studio/data/brand/`).
