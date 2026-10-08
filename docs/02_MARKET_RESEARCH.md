# 02 — Investigación de mercado, táctica y tecnológica

> Fecha de la investigación: octubre de 2026. Las cifras de terceros se marcan como tales. Donde una fuente no pudo consultarse directamente, se indica.

## 1. Mercado

### 1.1 Segmento inicial: España, fútbol 11 no profesional

- La RFEF publica memorias anuales de licencias por federación territorial y categoría ([Licencias 2023/24](https://rfef.es/sites/default/files/2024-11/LICENCIAS_2324.pdf), [2022/23](https://rfef.es/sites/default/files/2024-11/LICENCIAS_2223.pdf)). Como referencia, en 2011/12 la RFEF registraba 854.239 federados entre futbolistas y técnicos (incluye fútbol sala). Fragmentos de la memoria 2023/24 muestran, solo para Andalucía, más de 22.000 licencias aficionadas y más de 24.000 cadetes. *No se pudo descargar el PDF desde el entorno de investigación (bloqueo de red), por lo que el total nacional debe confirmarse.*
- Hipótesis de dimensionamiento (a validar con la memoria RFEF): del orden de **decenas de miles de equipos de fútbol 11** federados, cada uno con 1–3 técnicos.

| Nivel | Estimación | Método |
|---|---|---|
| TAM (España, entrenadores fútbol 11 federado) | 60.000–90.000 técnicos | equipos × 1,5–2 técnicos (hipótesis) |
| SAM (con smartphone y disposición a pagar herramienta táctica) | 15–25 % del TAM | encuestas del piloto |
| SOM año 2 | 2.000–4.000 entrenadores de pago | conversión 3–5 % sobre usuarios gratuitos |

Expansión natural: Latinoamérica hispanohablante (mismo léxico con variantes), después Portugal/Italia (requiere nuevo lexicón; arquitectura preparada en 16).

### 1.2 Disposición a pagar (referencias verificadas)

| Producto | Precio publicado | Fuente |
|---|---|---|
| TacticalPad (iOS) | 24,99 USD/año (ficha App Store; otras fichas 19,99) | [App Store](https://apps.apple.com/app/id512949303) |
| Sport Session Planner | 75 USD/año individual; clubes por presupuesto | [SSP registro](https://www.sportsessionplanner.com/register.mpl?a=step1) |
| KlipDraw | Basic 65 £, Animate 130 £, Motion 350 £ al año + IVA (revendedor) | [AnalysisPro](https://www.analysispro.com/klipdraw) |
| Hudl (club, EE. UU./Canadá) | Bronze 400, Silver 1.000, Gold 1.600 USD/equipo/año | [Hudl pricing](https://www.hudl.com/pricing/club/soccer) |
| SportEasy | Gratis + compras integradas 7,99–11,99 € | [mundobytes](https://mundobytes.com/apps-utiles-para-los-entrenadores-de-futbol/) (tercero) |

Conclusión: el entrenador amateur paga **20–90 €/año** por herramientas individuales; los clubes pagan por equipo cuando hay valor de coordinación.

## 2. Investigación táctica: fuentes de conocimiento

Objetivo: extraer conocimiento convertible en **reglas** del motor, distinguiendo *reglas del juego* (obligatorias) de *recomendaciones tácticas* (configurables).

### 2.1 Catálogo de fuentes

| # | Fuente | Tipo | Qué aporta al motor | Uso legal |
|---|---|---|---|---|
| F1 | IFAB, *Laws of the Game* 2026/27 (reproducido por The FA: [Regla 17](https://www.thefa.com/football-rules-governance/lawsandrules/laws/football-11-11/law-17---the-corner-kick), [Regla 15](https://www.thefa.com/football-rules-governance/lawsandrules/laws/football-11-11/law-15---the-throw-in), [Regla 12](https://www.thefa.com/football-rules-governance/laws/football-11-11/law-12---fouls-and-misconduct)) | Reglamento | Restricciones **duras**: 9,15 m en córner y faltas, 2 m en saque de banda, sin fuera de juego directo de córner/banda, doble toque, 1 m de la barrera (≥3 defensores) | Hechos normativos: se codifican como reglas propias citando el artículo; no se reproduce el texto |
| F2 | Reglamento General y Reglas de Juego RFEF ([reglamentos](https://rfef.es/es/federacion/normativas-y-circulares/reglamentos)) | Reglamento nacional | Número de jugadores, cambios por categoría, dimensiones mínimas de campo | Ídem |
| F3 | Convención de Entrenadores UEFA y planes de estudio de licencias UEFA C/B/A (escuelas territoriales) | Formación | Vocabulario y fases del juego (organización ofensiva/defensiva, transiciones, ABP) | Estructura conceptual; los materiales concretos tienen derechos: se usan como referencia, no se copian |
| F4 | Bibliografía metodológica: periodización táctica (Frade; Tamarit, *¿Qué es la periodización táctica?*), modelo de juego y principios (Bangsbo & Peitersen, *Soccer Systems & Strategies*), Wade, *The FA Guide to Training and Coaching* | Libros | Principios ofensivos/defensivos (amplitud, profundidad, apoyo, cobertura, basculación, temporización) → zonas y relaciones de la ontología | Ideas no protegibles; sin copiar texto |
| F5 | Literatura científica de ABP: Casal et al. (2015) análisis de córners en el Mundial; Pulling, Robins & Rixon (2013) "Defending corner kicks"; Sainz de Baranda & López‑Riquelme (2012) | Artículos | Distribuciones de zonas de destino (primer/segundo palo, punto de penalti), defensa zonal/individual/mixta | Datos agregados citables |
| F6 | Terminología de entrenadores españoles: prensa técnica (revistas *Training Fútbol*, *Fútbol Táctico*), jornadas de técnicos, **corpus del piloto** | Léxico | Sinónimos ("cerrado", "pierna cambiada", "pantalla", "arrastre", "vigilancia") → lexicón `es-ES.yaml` | Términos de uso común; corpus con consentimiento |
| F7 | Análisis de rivales: plantillas de informe de escuelas de entrenadores; estructura por momentos del juego | Formación | Taxonomía de categorías del análisis (19) | Estructura conceptual |
| F8 | Charlas prepartido: guías de comunicación del entrenador (p. ej. capítulos de comunicación en manuales UEFA B) | Formación | Estructura sugerida de presentación (20) | Ídem |

### 2.2 Clasificación del conocimiento extraído

| Clase | Ejemplo | Severidad en el motor | Configurable |
|---|---|---|---|
| `LAW` | Rivales a ≥ 9,15 m del cuadrante en córner (Regla 17) | Error si se viola en t=0 | No |
| `GEOMETRY` | Jugador dentro del terreno; ≤ 11 por equipo | Error | No |
| `TECHNIQUE` | Diestro desde la izquierda ⇒ efecto hacia portería (cerrado) | Advertencia si se contradice | No (sí excepción por jugador) |
| `TACTICAL_DEFAULT` | Dejar 2 jugadores de vigilancia en córner ofensivo | Propuesta | Sí (por equipo) |
| `STYLE` | Preferencia del club: defensa de córner mixta | Propuesta | Sí (por club) |

Regla de oro: **una recomendación táctica nunca se presenta como obligación del reglamento**. La UI etiqueta cada mensaje: "Reglamento", "Técnica", "Recomendación", "Preferencia del equipo".

## 3. Investigación tecnológica (resumen; decisiones en 11 y 29)

| Ámbito | Opciones evaluadas | Resultado |
|---|---|---|
| STT | OpenAI (whisper‑1 / gpt‑4o‑mini‑transcribe ~0,003–0,006 USD/min según terceros), Deepgram Nova‑3 (~0,0043–0,0052 USD/min según terceros; *keyterm prompting* hasta 100 términos), faster‑whisper autohospedado, Web Speech API | Adaptador; por defecto Deepgram Nova‑3 multilingüe por *keyterms* (nombres de plantilla); faster‑whisper como opción de privacidad. Precios a confirmar con proveedor |
| Interpretación | Rasa Open Source (Apache 2.0; CALM no es open source), spaCy (EntityRuler/Matcher), Duckling, gramáticas PEG (Ohm, Chevrotain), Nearley | Gramática propia FCSG compilada a matchers en TypeScript; spaCy/Rasa descartados como dependencia de ejecución (ver 16 §3) |
| Render 2D | SVG, Canvas (Konva), WebGL (PixiJS) | SVG: ≤ 30 actores, accesible, exporta a PDF/PPTX vectorial sin rasterizar |
| PPTX | PptxGenJS (formas, tablas, masters, Node y navegador) | Elegido |
| Rasa/spaCy: licencias | Rasa Open Source Apache 2.0; CALM requiere licencia Pro/Developer | Evitar dependencia |

## 4. Privacidad y normativa

- RGPD + LOPDGDD. **Art. 7 LOPDGDD**: menores de 14 años necesitan consentimiento de quien ejerce la patria potestad ([AEPD FAQ](https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales)). Implicaciones en 21.
- Voz: el audio es dato personal; si se usara para identificar a la persona sería biométrico. FCS **no** hace identificación por voz; el audio se borra a los 30 días por defecto.
- Proveedores STT: requieren contrato de encargado (DPA) y, si procesan fuera del EEE, garantías de transferencia.

## 5. Limitaciones de esta investigación

- No se pudo acceder a tacticalpad.com ni a rfef.es desde el entorno; se usaron fichas de tiendas y fuentes secundarias.
- Los precios de STT proceden de agregadores; deben confirmarse en las páginas oficiales antes de contratar.
- No se encontró evidencia de control por voz en ninguna herramienta táctica consultada; eso **no prueba** que no exista. Se recomienda una revisión manual de las 10 apps principales en tienda antes del lanzamiento (tarea BK‑000 del backlog).
