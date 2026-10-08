# 20 — Generador de charlas y presentaciones

## 1. Experiencia objetivo

Jornada → **Preparar charla** → guion propuesto en 1 s → reordenar/activar secciones → vista previa → exportar o compartir. Objetivo: charla completa en ≤ 3 minutos si la jornada ya tiene once, análisis y jugadas.

## 2. Principio de contenido

| Tipo de contenido | Origen | Tratamiento |
|---|---|---|
| Datos (once, sistema, rival, fecha, jugadas) | Base de datos | Se **representan** (diagramas, tablas) — sin prosa generada |
| Ítems de análisis del rival | Análisis revisado | Texto literal del ítem |
| Mensajes del entrenador | Texto escrito o dictado | Literal, con limpieza mínima; marcado `COACH_TEXT`/`COACH_VOICE` |
| Títulos de sección | Plantilla | Fijos y editables ("Plan de juego", "Lo que debemos aprovechar"…) |

El generador **no redacta recomendaciones**. Si una sección no tiene contenido, se desactiva (no se rellena).

## 3. Estructura por defecto y fuentes

| # | Diapositiva | Fuente | Se activa si |
|---|---|---|---|
| 1 | Rival y contexto | `match` (rival, fecha, lugar, competición, jornada), escudos, último resultado contra el rival | siempre |
| 2 | Nuestra alineación | Once oficial (diagrama editable) + suplentes convocados | hay once |
| 3 | Plan de juego | Sistema, `match.objectives`, ítems `COACH_RECOMMENDATION` | hay contenido |
| 4 | Análisis del rival | Ítems `SYSTEM`, `OFFENSIVE_ORG`, `DEFENSIVE_ORG`, `PRESSING`, `TRANSITIONS`, `KEY_PLAYERS` (máx. 6 por diapositiva; si hay más, se divide) | hay análisis |
| 5 | Aspectos a aprovechar | Ítems `WEAKNESS` | hay ítems |
| 6 | Aspectos a evitar | Ítems `STRENGTH` | hay ítems |
| 7 | Balón parado ofensivo | Jugadas `*_ATT` vinculadas a la jornada (una diapositiva por fase o por jugada) | hay jugadas |
| 8 | Balón parado defensivo | Jugadas `*_DEF` vinculadas + ítems `SET_PIECES_ATT` del rival | hay contenido |
| 9 | Instrucciones clave | Mensajes del entrenador; instrucciones individuales (solo en la versión para el jugador destinatario) | hay contenido |
| 10 | Mensaje final | Texto del entrenador | hay texto |

El guion se guarda en `match_presentation.outline` (lista ordenada de secciones con ítems referenciados por id).

## 4. Ordenación por voz (9.3)

Locución: *"En la charla quiero empezar hablando de la presión alta. Después quiero recordarles que su lateral derecho sube mucho. También quiero enseñar los dos córners que trabajamos el jueves y terminar con el once inicial."*

| Cláusula | Interpretación | IR |
|---|---|---|
| "empezar hablando de la presión alta" | Tema → ítems con etiqueta `PRESSING`. Si existen en el análisis: nueva sección 1 "Presión alta" con esos ítems. Si no existen: sección con el título y **sin contenido**, marcada "añade contenido" | `talk.order` + `talk.include {topic: PRESSING}` |
| "recordarles que su lateral derecho sube mucho" | No hay ítem igual en el análisis → **nota del entrenador** con el texto literal "Su lateral derecho sube mucho" (`COACH_VOICE`), en sección 2 | `talk.note {section: 2, text_span}` |
| "enseñar los dos córners que trabajamos el jueves" | Consulta: jugadas `CORNER_ATT` del equipo creadas o modificadas el jueves de la semana en curso (fecha resuelta respecto a la jornada). Si devuelve 2 → se incluyen; si ≠ 2 → pregunta con la lista | `talk.include {resource: plays, filter}` |
| "terminar con el once inicial" | Sección "Nuestra alineación" al final | `talk.order` |

Secciones no mencionadas: se mantienen activas en su orden por defecto **entre** las mencionadas al principio y al final, y la revisión lo indica ("He mantenido Análisis del rival y Balón parado defensivo; ¿quieres quitarlas?"). Nunca se crean afirmaciones nuevas: el texto de "su lateral derecho sube mucho" es del entrenador y aparece atribuido como tal.

## 5. Exportación

| Formato | Implementación | Editable | Notas |
|---|---|---|---|
| **PPTX** | PptxGenJS en el worker; *slide master* por plantilla (colores y escudo del club) | Textos, tablas y **diagramas como formas nativas** (campo = formas; jugadores = elipses con texto; flechas = conectores) | Jugadas: una diapositiva por fase (PREP/GOLPEO/LLEGADA); notas del orador con la descripción textual de la jugada |
| **PDF** | Playwright imprime la ruta `/print/presentations/{id}` (mismo HTML que la vista previa) | No | A4 horizontal / 16:9 |
| **Imágenes** | PNG por diapositiva (1920×1080) | No | Para mensajería |
| **Documento imprimible** | PDF A4 vertical, 2 diapositivas por página + notas | No | |
| **Enlace compartido** | Vista web de solo lectura (21: requiere sesión en equipos de fútbol base) | No | Animaciones reproducibles en la vista web |
| GIF/MP4 de jugadas | V1.5 (15 §13) | — | |

**Reproducibilidad**: `input_hash = sha256(outline canónico + versiones de jugadas + revisión de once + plantilla + versión del exportador)`. Misma entrada → mismo archivo (fechas de metadatos del PPTX fijadas a la fecha de la versión), servido desde caché.

**Calidad visual**: rejilla de 12 columnas a 16:9, tipografía Inter/Barlow Condensed (licencia OFL), tamaño mínimo 20 pt, máx. 6 viñetas por diapositiva (división automática), pruebas de regresión visual de las 10 diapositivas tipo (22).

## 6. Plantillas

- V1: "Estándar" (clara) y "Vestuario" (oscura, alto contraste para proyector).
- V1.5: plantillas del club con colores, escudo y tipografías propias; plantillas profesionales adicionales.

## 7. Versiones para jugadores

Al compartir, se puede publicar:

- **Charla de equipo**: sin instrucciones individuales ni análisis completo (solo secciones marcadas como compartibles).
- **Instrucciones individuales**: cada jugador ve solo la suya en su panel.
