# 19 — Análisis de rivales

## 1. Principios

1. **Extractivo, no generativo**: cada ítem del informe es un fragmento literal de lo que dijo o escribió el entrenador (con limpieza mínima: muletillas y repeticiones), clasificado y etiquetado. El sistema no redacta frases nuevas sobre el rival.
2. **Trazabilidad**: cada ítem guarda fuente (`source_kind`, `source_detail`), fecha observada, autor, transcripción y posición exacta (`span`) en ella.
3. **Fase del juego explícita**: la formación nominal y la estructura por fase son datos distintos.
4. **Hipótesis ≠ observación**: el estado de evidencia es un campo, no una inferencia.

## 2. Categorías

| Código | Categoría | Disparadores léxicos (extracto) | Etiquetas extraídas |
|---|---|---|---|
| `SYSTEM` | Sistema de juego | formación (`F_*`), "juegan con", "suelen jugar", "línea de 4/5", "tres centrales" | `nominal`, `phase`, `shape` |
| `OFFENSIVE_ORG` | Organización ofensiva | "salen", "construyen", "juego directo", "balón largo", "por dentro" | `phase: ORG_ATT`, `side`, `style` |
| `DEFENSIVE_ORG` | Organización defensiva | "defienden", "bloque", "repliegue", "línea alta/baja" | `phase: ORG_DEF`, `height` |
| `PRESSING` | Presión | "presionan", "presión alta", "aprietan", "por fuera/por dentro" | `intensity`, `zone` |
| `TRANSITIONS` | Transiciones | "contra", "contraataque", "al perder", "al recuperar", "repliegan rápido" | `direction` |
| `STRENGTH` | Puntos fuertes | "son muy buenos en", "lo mejor que tienen", "peligrosos" | — |
| `WEAKNESS` | Puntos débiles | "deja espacio", "sufren", "les cuesta", "lentos", "a la espalda" | `player_role`, `space` |
| `SET_PIECES_ATT` | ABP ofensivo del rival | "en los córners meten", "sus faltas", "el que saca" | `players_in_box`, `target_zone`, `taker` |
| `SET_PIECES_DEF` | ABP defensivo del rival | "defienden los córners en zona/al hombre" | `scheme` |
| `KEY_PLAYERS` | Jugadores relevantes | "el número N", "el 9", "su delantero", nombre propio | `shirt`, `position`, `movement` |
| `COACH_RECOMMENDATION` | Recomendación del entrenador | "tenemos que", "hay que", "debemos", "intentar", "vamos a" + 1ª persona plural | `phase`, `side` (en nuestro marco) |
| `OTHER` | Otros | — | — |

Una cláusula puede generar varios ítems (p. ej. "En los córners meten cinco jugadores al remate y el número 9 ataca el primer palo" → `SET_PIECES_ATT` + `KEY_PLAYERS`).

## 3. Pipeline

1. Transcripción (16 §2) → texto revisable.
2. Normalización y segmentación en cláusulas (16 §4, pasos 1–3), conservando offsets.
3. Clasificador por reglas: cada categoría tiene patrones FCSG y palabras clave ponderadas; puntuación determinista; categoría con mayor puntuación ≥ umbral; empate → la de mayor prioridad (`COACH_RECOMMENDATION` > `KEY_PLAYERS` > `SET_PIECES_*` > `WEAKNESS` > `STRENGTH` > resto) y la segunda como sugerencia.
4. Extractores de etiquetas (formación, fase, lado, dorsal, zona, número de jugadores).
5. Detector de conflictos (§4).
6. **Revisión**: tarjetas por categoría; el entrenador puede mover un ítem de categoría, editar el texto (queda marcado "editado"), marcar como hipótesis, borrar. Nada se guarda sin pulsar "Guardar análisis".

### 3.1 Resultado del ejemplo 8.1 (caso T‑ANA‑01)

| # | Categoría | Texto (literal) | Etiquetas |
|---|---|---|---|
| 1 | Sistema | "suele jugar 4‑3‑3" | nominal = 4‑3‑3 |
| 2 | Sistema | "cuando defiende pasa a 4‑4‑2" | fase = defensa, estructura = 4‑4‑2 |
| 3 | Presión | "Presiona mucho por fuera" | intensidad alta, zona = bandas |
| 4 | Puntos débiles | "Su lateral izquierdo deja espacio a la espalda" | rol = LI, espacio = espalda |
| 5 | ABP ofensivo | "En los córners meten cinco jugadores al remate" | jugadores en área = 5 |
| 6 | Jugadores relevantes | "el número 9 ataca el primer palo" | dorsal 9, movimiento = primer palo |
| 7 | Recomendación del entrenador | "Tenemos que intentar salir por nuestra derecha" | fase = ataque, lado = derecha (nuestro) |

Relación detectada (informativa, no generada como texto): el ítem 4 (lateral izquierdo **rival**) y el 7 (salir por **nuestra derecha**) son coherentes, porque el lateral izquierdo rival defiende nuestra banda derecha. Se muestra como enlace "relacionado con" entre ítems.

## 4. Contradicciones

| Código | Condición | Ejemplo | Acción |
|---|---|---|---|
| `ANA-CONFLICT-SYSTEM` | Dos estructuras distintas para la **misma fase** (o ambas sin fase) en el mismo análisis | "Juegan con línea de cuatro" + "atrás ponen tres centrales y dos carrileros" | Marcar ambos ítems para revisión |
| `ANA-CONFLICT-HISTORY` | Ítem nuevo contradice un ítem previo del histórico (misma categoría/etiqueta, valor distinto) | Histórico: "presión baja"; hoy: "presión alta" | Proponer `supersedes` ("Cambio detectado") o mantener ambos con fechas |
| `ANA-CONFLICT-SHIRT` | Mismo dorsal con posiciones incompatibles | "el 9 juega de lateral" | Revisión |

**No es contradicción**: nominal 4‑3‑3 + "cuando defiende 4‑4‑2" (fases distintas). Regla: el conflicto se evalúa por par (`phase`, `category`).

## 5. Histórico del rival

La ficha del rival (pertenece al club) agrupa por categoría todos los ítems de todos los análisis, con:

| Vista | Contenido |
|---|---|
| **Próximo partido** | Ítems del análisis vinculado a la jornada actual |
| **Observado en el pasado** | Ítems de análisis anteriores, con fecha y fuente; atenuados si tienen > 12 meses |
| **Cambios detectados** | Pares `supersedes` (antes → ahora) |
| **Hipótesis pendientes** | `evidence = HYPOTHESIS`; tras el partido, el entrenador las marca CONFIRMED/REFUTED en "Observaciones posteriores" |
| **Enfrentamientos** | Partidos jugados, resultados, once y jugadas usadas, notas post‑partido |

Al crear el análisis de una nueva jornada contra un rival conocido, se ofrece "Partir del último análisis": copia los ítems como `HYPOTHESIS` con referencia al original, para confirmar o descartar.

## 6. Privacidad del análisis

- Por defecto solo visible para el cuerpo técnico (21).
- Compartir con jugadores = crear un **extracto** (`OPPONENT_EXTRACT`) seleccionando ítems concretos; el análisis completo nunca se comparte.
- Los ítems sobre jugadores rivales identificables por nombre se muestran solo al staff; en extractos se sustituye por dorsal/posición.

## 7. Entrada sin voz

Formulario por categorías con los mismos campos; y pegado de texto (p. ej. notas del segundo entrenador), que pasa por el mismo extractor.
