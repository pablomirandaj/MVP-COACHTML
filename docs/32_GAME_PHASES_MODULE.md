# 32 — Escenas de fases de juego y exportación HTML

> Nuevo módulo del MVP (26/11/2026): representar y animar **cómo presionamos**, **cómo presiona el rival**, **repliegue / bloque bajo** y **vigilancias**, y exportar cada escena como **un archivo HTML autónomo** que se abre en cualquier móvil y se puede enviar a los jugadores. Igual que en el balón parado, las posiciones las calcula un motor determinista; el asistente (31) solo cambia parámetros.

## 1. Tipos de escena

| Código | Escena | Qué muestra |
|---|---|---|
| `PRESS_OWN` | Nuestra presión | Bloque, altura, quién salta a quién, coberturas, disparadores |
| `PRESS_OPP` | Presión del rival (nuestra salida) | Su bloque y sus saltos según el análisis del rival; nuestras salidas previstas |
| `RETREAT` | Repliegue / bloque medio‑bajo | Líneas, basculación según el lado del balón, distancias |
| `REST_DEFENSE` | Vigilancias | Quién se queda cuando atacamos y contra qué atacantes rivales |
| `CUSTOM_PHASE` | Libre | Fotogramas clave colocados a mano |

## 2. Modelo de escena

Una escena es una **secuencia de estados del balón** (fotogramas clave) con dos equipos en formación. Para cada estado, el motor calcula las posiciones de los 22 jugadores a partir de parámetros. No se dibuja cada fotograma a mano.

```jsonc
{
  "schema": "fcs.scene/1",
  "type": "PRESS_OWN",
  "own":  { "formation": "F_433", "lineup_id": "…" },
  "opp":  { "formation": "F_433", "source_analysis_id": "…" },
  "params": {
    "block_height": "HIGH",           // HIGH | MID | LOW → altura de la línea defensiva
    "compactness_m": 30,              // distancia de la línea defensiva a la delantera
    "lateral_shift": 0.55,            // basculación hacia el lado del balón (0–1)
    "press_triggers": ["PASS_TO_FULLBACK", "BACK_PASS", "BAD_TOUCH"],
    "jumps": [ { "who": "LW", "to": "OPP_RB" }, { "who": "ST", "to": "OPP_CB_R", "curve": "SCREEN_GK" } ]
  },
  "keyframes": [
    { "t": 0.0, "ball": { "holder": "OPP_GK" } },
    { "t": 1.5, "ball": { "holder": "OPP_CB_R" } },
    { "t": 3.0, "ball": { "holder": "OPP_RB" }, "event": "TRIGGER" }
  ],
  "provenance": { "params": "EXPLICIT", "jumps": "ASSISTANT" }
}
```

## 3. Reglas de cálculo (deterministas)

Para cada fotograma, partiendo de las coordenadas base de la formación (`rules/formations.yaml`):

| Paso | Regla | Fórmula / criterio |
|---|---|---|
| 1 | Altura del bloque | Línea defensiva alineada en `x` = 46 m (HIGH), 36 m (MID), 22 m (LOW) desde la propia línea de gol; el resto de líneas se reparte en `compactness_m` (por defecto 32, 30 y 25 m) |
| 2 | Basculación | `y_jugador += lateral_shift · (y_balón − 34) · peso_línea` (delanteros 0,4, medios 0,6, defensas 0,5); se acota a 2 m de la banda |
| 3 | Compactación hacia el balón | Las líneas se acercan un 10 % al balón en `x` cuando este está en la mitad propia del rival |
| 4 | Saltos de presión | En un fotograma con `TRIGGER`, cada `jump` coloca a su jugador a 1,5 m del rival objetivo, del lado que cierra el pase interior (sombra de cobertura) |
| 5 | Coberturas | El compañero más cercano de la línea siguiente ocupa el espacio que deja quien salta (algoritmo húngaro sobre distancias, como en 15 §7) |
| 6 | Vigilancias | `REST_DEFENSE`: los atacantes rivales que se quedan arriba vienen del análisis o de la plantilla. Se colocan `n_rivales + 1` vigilantes (recomendación configurable), cada uno goal‑side a 2–3 m de su referencia y uno libre como corrector |
| 7 | Rival | Se usa la formación del análisis por fase (19: "4‑3‑3 que defiende en 4‑4‑2"); si no hay análisis, la plantilla genérica de esa formación |

Validaciones nuevas (se suman a `rules/constraints.yaml`):

| Id | Clase | Regla |
|---|---|---|
| SHAPE‑01 | TACTICAL | Distancia entre líneas de 6 a 20 m; bloque total ≤ 40 m (aviso) |
| SHAPE‑02 | TACTICAL | Línea defensiva alineada en ±2 m (aviso: rompe el fuera de juego) |
| PRESS‑01 | TACTICAL | Quien salta es el más cercano entre los elegibles (información si no lo es) |
| PRESS‑02 | TACTICAL | Tras un salto queda una línea de pase interior sin cubrir (aviso) |
| REST‑01 | TACTICAL | Vigilantes < atacantes rivales arriba + 1 (aviso configurable) |

Todo son **recomendaciones**, no reglas del reglamento. La interfaz las etiqueta así (14, 15).

## 4. Edición

- **Manual**: arrastrar jugadores en un fotograma crea un ajuste (`override`) solo para ese fotograma, marcado `MANUAL`; los parámetros se cambian con controles deslizantes (altura, compactación, basculación).
- **Asistente (31)**: "Presionamos más arriba", "que el 9 tape al pivote al saltar", "bloque bajo cuando estemos por delante en el marcador". Se traduce a cambios de `params`, `jumps` o fotogramas.
- **Plantillas**: presión alta 4‑3‑3 contra salida de 4, bloque medio 4‑4‑2, repliegue 5‑3‑2, vigilancia 2+1 y 3+2. Las valida el asesor táctico, como en balón parado.

## 5. Exportación HTML autónoma

- **Un único archivo `.html`**: SVG y JavaScript en línea, sin dependencias externas ni conexión, de unos 60 KB. Incluye el campo, la animación por fotogramas (reproducir, pausa, velocidad, paso a paso), leyenda, notas del entrenador y escudos (opcional).
- **Mismo renderer** que la aplicación (`@fcs/render`): lo que se ve en la app es lo que reciben los jugadores. El prototipo de este enfoque es `docs/mockups/index.html`, que ya anima una jugada real desde su JSON.
- **Reproducible**: el mismo documento y la misma versión del exportador generan un archivo idéntico (`input_hash`, 20 §5).
- **Privacidad**: el HTML solo incluye nombre corto y dorsal, nunca notas privadas. Al compartir se avisa de que, una vez enviado, el archivo no se puede revocar.
- También se puede exportar a PDF (un fotograma por página) e incluir la escena en la charla (20).

## 6. Esfuerzo estimado (se suma al MVP de la opción A)

| Tarea | Días‑persona |
|---|---|
| Motor de formas (pasos 1–7) y reglas SHAPE/PRESS/REST | 10 |
| Editor de escenas: fotogramas, controles deslizantes, *overrides* | 8 |
| Exportador HTML autónomo | 4 |
| 4 plantillas iniciales y pruebas doradas | 3 |
| **Total** | **25** |

## Salida de balón (`BUILD_UP`, Pizarra Studio)

Parámetros: `structure` (`2+1`, `3+1`, `FB_INSIDE`), `opp_pressers` (1–3) y `progress_to`.

| Estructura | Colocación |
|---|---|
| `3+1` | El pivote baja entre los centrales, que se abren a 12 m del eje; los laterales suben a la altura original del pivote; un interior hace de "+1" a 13 m por delante. |
| `2+1` | Centrales abiertos a la anchura del área (±20,16 m) y pivote 11 m por delante, entre ellos. |
| `FB_INSIDE` | El lateral del lado débil cierra al carril interior a la altura del pivote. |

El rival se coloca en bloque alto; sus `opp_pressers` jugadores más adelantados presionan (a 2,5 m) a los de nuestra estructura, asignados con el algoritmo húngaro por distancia. **Hombre libre**: el jugador de la estructura sin rival a menos de 5 m, el más cercano al balón (`FREE_MAN`). Si no hay ninguno en toda la secuencia: `BUILD-01` (aviso).
