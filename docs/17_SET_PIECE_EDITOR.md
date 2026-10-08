# 17 — Editor de balón parado

> Funcionalidad diferenciadora. El motor que hay debajo se describe en 15; la voz en 16. Aquí: qué ve y hace el entrenador.

## 1. Objetivos de diseño

1. Crear un córner completo **por voz en < 60 s** o a mano en < 3 min.
2. Toda modificación por voz tiene equivalente manual (y viceversa).
3. Distinguir siempre a simple vista **lo que dijo el entrenador** (trazo sólido) de **lo que propuso el sistema** (trazo discontinuo + etiqueta "propuesta").
4. Reproducción clara, no realista.

## 2. Anatomía de la pantalla

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Córner izq. cerrado · v4 (borrador)         [↶] [↷]  [Guardar ▾]   │
├──────────────────────────────────────────────────────────────┬───────┤
│                                                              │ ROLES │
│        ┌───────── medio campo ofensivo (SVG) ─────────┐      │ 7 Lan │
│        │   ○ rivales (gris)   ● propios (color equipo)│      │ 4 Blo │
│        │   ─── trazo explícito   - - - propuesta      │      │ 5 Rem │
│        │   ⟶ carrera   ⇢ balón   ▮ bloqueo            │      │ 9 1ºP │
│        └──────────────────────────────────────────────┘      │ …     │
│                                                              │ AVISOS│
│                                                              │ ⚠ 1   │
├──────────────────────────────────────────────────────────────┴───────┤
│ ▶  ◀◀ ▶▶  0.5×  ├──●─────────────┤  PREP | GOLPEO | LLEGADA | FIN    │
├──────────────────────────────────────────────────────────────────────┤
│ [ 🎙 Mantén pulsado para hablar ]   [⌨ Escribir orden]   [＋ Añadir]  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Móvil (vertical)**: campo arriba (vista vertical, ataque hacia arriba → la izquierda del entrenador es la izquierda de la pantalla), línea temporal y botón de voz abajo; roles y avisos en una hoja deslizante.
- **Tableta/escritorio**: campo horizontal, panel lateral fijo con roles, propiedades del elemento seleccionado y avisos.

## 3. Interacciones manuales

| Acción | Gesto (táctil) | Ratón/teclado | Comando IR equivalente |
|---|---|---|---|
| Seleccionar actor | Toque | Clic | — |
| Mover posición inicial | Arrastrar | Arrastrar / flechas (0,5 m; Mayús 2 m) | `play.move_actor` (`source: MANUAL`) |
| Dibujar carrera | Mantener sobre actor + arrastrar | Alt + arrastrar | `play.set_movement` (tipo inferido por zona destino o elegido en menú) |
| Cambiar rol | Menú del actor | Menú contextual | `play.set_role` |
| Asignar jugador | Arrastrar desde la plantilla al actor | Igual | `play.assign_player` |
| Destino del balón | Arrastrar el punto de destino | Igual | `play.set_delivery {target_zone}` |
| Efecto/trayectoria | Selector en el panel del balón | Igual | `play.set_delivery` |
| Tiempo de un movimiento | Arrastrar el bloque en la línea temporal | Igual | `play.shift_timing` |
| Añadir rival | Botón ＋ → rival | Igual | `play.add_opponents` / actor manual |
| Nota | Botón 💬 sobre el campo | Igual | nota anclada |
| Deshacer/rehacer | Botones | Ctrl+Z / Ctrl+Mayús+Z | `undo`/`redo` |

Imán: al soltar un actor cerca de un ancla de zona (≤ 1,5 m) se ajusta a ella; manteniendo pulsado se desactiva.

## 4. Edición conversacional

Ejemplos del enunciado y su comportamiento (detalle de IR en 16 §10 y tests T‑EDT‑*):

| Orden | Resultado visible |
|---|---|
| "Mueve a los dos del segundo palo un metro hacia la izquierda" | Los dos actores se desplazan 1 m con animación de 300 ms; un *toast* "2 jugadores movidos 1 m ← · Deshacer" |
| "Retrasa al jugador del rechace" | Pregunta: "Hay dos en el rechace…" con los dos actores parpadeando y tres botones |
| "Haz que el número 5 ataque el primer palo" | Nueva carrera del 5; aviso TAC‑CRN‑TGT‑01 con acción rápida "Llevar el balón al primer palo" |
| "El bloqueo tiene que empezar antes" | El bloque del bloqueo se desplaza 0,5 s a la izquierda en la línea temporal |
| "Que Lucas saque más cerrado" | El punto de destino avanza 1,5 m hacia la portería y la curva se acentúa |
| "Los dos jugadores de atrás no deben incorporarse al remate" | Candado en los dos actores de vigilancia; cualquier intento posterior de moverlos al área genera error SEQ‑CONSTR‑01 |

Panel de revisión (antes de aplicar, si la preferencia "revisar siempre" está activa o hay FUZZY): lista de cambios con verbo + objeto + magnitud, cada uno con casilla.

## 5. Tipos de acción y plantillas

| Tipo | Piloto | Plantillas iniciales | Vista |
|---|---|---|---|
| Córner ofensivo | ✔ | `CRN_ATT_STANDARD`, `CRN_ATT_SHORT`, `CRN_ATT_NEAR_FLICK` | Medio campo ofensivo |
| Córner defensivo | ✔ | `CRN_DEF_ZONAL`, `CRN_DEF_MAN`, `CRN_DEF_MIXED` | Medio campo defensivo |
| Falta lateral | V1 | `FKW_ATT_STANDARD`, `FKW_DEF_LINE` | Ofensivo/defensivo |
| Falta frontal | V1 | `FKC_ATT_DIRECT`, `FKC_ATT_DUMMY`, `FKC_DEF_WALL` (barrera por distancia y ángulo) | Ídem |
| Falta indirecta | V1 | `FKI_ATT_TOUCH_SHOT` | Ídem |
| Saque de banda | V1 | `TI_ATT_SHORT`, `TI_ATT_LONG_BOX` | Banda |
| Saque de centro | V1 | `KO_STANDARD`, `KO_LONG` | Campo completo |
| Otra situación | V1 | Editor libre sin plantilla | Campo completo |

Cada plantilla nueva requiere: YAML de plantilla, reglas LAW específicas (ya catalogadas en 15 §10), 5 casos de prueba dorados y validación del asesor táctico.

Estado: `engine/rules/templates.yaml` define ya `CRN_ATT_STANDARD`, `CRN_DEF_MIXED` y la defensa rival por defecto `OPP_CORNER_DEF_MIXED`. El resto de plantillas de esta tabla se escribe dentro de BK‑025 (piloto) y BK‑100 (V1).

## 6. Biblioteca de jugadas

- Filtros: tipo, lado, jugador participante, etiqueta, estado (borrador/publicada), jornada en la que se usó.
- Miniatura SVG generada del estado en `t = KICK`.
- Acciones: duplicar, crear variante, comparar dos versiones (superposición con transparencia), vincular a jornada, compartir, exportar PNG/PDF (y GIF/MP4 en V1.5).
- Plantillas del club (V1.5): una jugada se puede promocionar a plantilla reutilizable del club.

## 7. Animación y exportación

- Reproductor descrito en 15 §13: 0,25×/0,5×/1×, fases, bucle, scrub.
- Exportación V1: **secuencia de diapositivas por fase** (PREP, GOLPEO, LLEGADA) con flechas — editable en PowerPoint.
- V1.5: GIF (≤ 6 s, 12 fps, 960 px) y MP4 (H.264, 30 fps) para compartir por mensajería.

## 8. Estados vacíos y errores

| Situación | Comportamiento |
|---|---|
| Sin plantilla de jugadores | La jugada se crea con etiquetas de rol (R1, B1…); banner "Vincula tu plantilla para asignar jugadores" |
| Plantilla con < 10 jugadores disponibles | Roles sin asignar en gris; aviso AVAIL |
| Orden no entendida | Texto con la parte no entendida subrayada + "¿Querías decir…?" con hasta 3 formulaciones soportadas |
| Error de validación `error` | Botón Guardar ofrece "Guardar como borrador" |
| Pérdida de conexión | Edición local continúa; icono de sincronización pendiente |

## 9. Accesibilidad

- Cada actor es un elemento con `role="img"` y `aria-label` ("Diego, 4, bloqueador, zona de segundo palo").
- Navegación por teclado entre actores (Tab) y movimiento con flechas.
- Descripción textual completa de la jugada (generada del documento, sin redacción libre) accesible con un botón "Leer jugada".
- Colores con contraste AA y, además del color, forma: propios círculo, rivales cuadrado; propuesta = discontinuo.
- `prefers-reduced-motion`: reproducción por fases.
