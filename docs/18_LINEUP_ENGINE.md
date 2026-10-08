# 18 — Motor de alineaciones

## 1. Modelo

- `Lineup` = formación + asignaciones `{slot → player}` + `slot_overrides` (desplazamientos de ranuras respecto a la formación base) + metadatos (partido, etiqueta, estado).
- Las coordenadas mostradas = coordenadas base de la formación (`rules/formations.yaml`) + overrides. Los overrides se expresan en metros y se convierten con las dimensiones del campo del equipo.

## 2. Formas de asignar

| Vía | Comportamiento |
|---|---|
| Arrastrar y soltar | Desde la lista de convocados a una ranura; si la ranura está ocupada, intercambio (con animación) |
| Selección desde plantilla | Tocar ranura → lista filtrada por idoneidad de posición (principal, secundaria, resto) |
| Manual | Formulario por líneas |
| Voz/texto | IR `lineup.*` (16 §10) |
| Autocompletar | Botón "Proponer once": algoritmo de §4 sobre los convocados disponibles, todo marcado como propuesta |

## 3. Interpretación de los comandos de ejemplo

| Orden | IR | Regla | Ambigüedad posible |
|---|---|---|---|
| "Para el domingo vamos a jugar 4‑3‑3. En portería Pablo, centrales Mateo y Diego…" | `set_formation`, `link_match`, `assign`, `assign_group`×4 | §4 ajuste por posición dentro de grupo | Homónimos (dos Álvaro) → pregunta; nº de jugadores en un grupo ≠ ranuras del grupo → pregunta |
| "Cambia a Lucas por Mateo" | `substitute` o `swap` | Tabla de decisión en `commands.fcsg` (LINEUP_SUBSTITUTE) | Si ambos titulares o ninguno → pregunta |
| "Adelanta un poco los extremos" | `shift_group {WINGERS, du_m: 3}` | Intensidad "un poco" = 3 m | Formación sin extremos → pregunta (¿medios de banda?) |
| "Junta más las líneas" | `compact {U, 0.85}` | Compactación alrededor del centroide de los jugadores de campo; el portero no se mueve; distancia mínima entre líneas 6 m (LINEUP‑06) | — |
| "Utiliza la formación que guardamos contra el Sporting B" | `load {opponent_name}` | Búsqueda: alineaciones con `match.opponent` = rival (trigram ≥ 0,6) o etiqueta que lo contenga | 0 resultados → aviso; > 1 → lista por fecha |
| "Guarda esta alineación como alternativa ofensiva" | `save {label}` | Crea una alineación nueva (no sobrescribe el once oficial), etiqueta `ofensiva` | Etiqueta existente → "¿Reemplazar o guardar como nueva?" |

Cargar una alineación de otro partido copia **formación + asignaciones de jugadores que sigan disponibles**; las ranuras con jugadores no disponibles quedan vacías y señaladas (nunca se sustituyen solas).

## 4. Asignación dentro de un grupo (POSITION_FIT)

Cuando el entrenador dice "centrales Mateo y Diego" sin precisar quién va a la izquierda, se resuelve con el algoritmo húngaro sobre las ranuras del grupo:

`score(jugador, ranura) = 100·[posición principal = ranura] + 60·[posición secundaria] + 20·[misma línea] + 10·[pie hábil coincide con el lado de la ranura]`

Empates → orden de enunciación izquierda→derecha. Las ranuras resultantes se marcan `INFERRED` y la revisión las muestra ("Mateo → central izquierdo (zurdo)"). Si el entrenador dice explícitamente "Mateo central izquierdo", es `EXPLICIT`.

## 5. Ajustes geométricos

| Operación | Fórmula (metros, marco de ataque) | Límites |
|---|---|---|
| `shift_group du_m` | `x += du` para cada ranura del grupo | Dentro del campo; no rebasar la línea siguiente (aviso) |
| `shift_group away_from_center_m` | `y += sign(y − W/2)·d` | `y ∈ [2, W − 2]` |
| `compact factor f` | `x' = cx + (x − cx)·f` para jugadores de campo, `cx` = media de `x` | `f ∈ [0.6, 1.4]`; LINEUP‑06 |
| `shift_slot toward CENTER d` | `y += −sign(y − W/2)·d` | — |

## 6. Validaciones

| Regla | Severidad |
|---|---|
| LINEUP‑01: exactamente 11 (borrador puede tener menos) | error para confirmar |
| LINEUP‑02: jugador en dos ranuras | error |
| LINEUP‑03: exactamente un portero | error |
| LINEUP‑04: jugador lesionado/sancionado/no convocado | aviso |
| LINEUP‑05: jugador fuera de sus posiciones | info |
| LINEUP‑06: líneas a < 6 m | aviso |

## 7. Vinculación con el partido

- Un partido tiene **un** once oficial (`is_primary`) y N alternativas.
- "Confirmar once" cambia el estado a `PUBLISHED` y habilita compartirlo con los jugadores.
- El once oficial alimenta la diapositiva "Nuestra alineación" de la charla y la asignación de jugadas a balón parado (los actores sin jugador se proponen desde el once).
- Al cambiar el once después de crear jugadas, las jugadas vinculadas muestran aviso "Jugador X ya no está en el once" (AVAIL‑01) sin modificar la jugada.
