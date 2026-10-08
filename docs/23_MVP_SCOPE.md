# 23 — Alcance del MVP

## 1. ¿Es realizable la V1 "imprescindible" del encargo?

La V1 propuesta incluye 14 bloques. Estimación (25/26) con un equipo de 3 desarrolladores full‑stack + diseño y QA a tiempo parcial:

| Bloque | Esfuerzo (semanas‑persona) |
|---|---|
| Base técnica (monorepo, auth, BD, CI, PWA) | 6 |
| Equipo y jugadores, fichas y posiciones | 4 |
| Editor de alineaciones + formaciones | 5 |
| Editor ABP (córners) + animación | 8 |
| Editor ABP resto de acciones | 6 |
| Motor determinista (catálogo, reglas, asignación, scheduler) | 9 |
| Voz: grabación, STT, NLU, revisión, aclaraciones | 9 |
| Calendario y jornadas (CSV, XLSX, ICS, aplazados) | 4 |
| Rivales + análisis por voz | 5 |
| Charla + PDF | 4 |
| PPTX editable | 4 |
| Compartir + roles + menores | 6 |
| QA, rendimiento, accesibilidad, seguridad | 8 |
| **Total** | **≈ 78 semanas‑persona** |

La cifra incluye diseño, QA y ~25 % de contingencia; el desarrollo puro desglosado en 25 suma ≈ 273 días‑persona (piloto 183 + V1 90). Con ~3,5 FTE efectivos → **≈ 26 semanas**. Es demasiado para validar la hipótesis principal (¿los entrenadores preparan partidos hablando?) antes de invertir. **Conclusión: se define un Piloto más acotado** que conserva la esencia (voz → once y córner → jornada → charla → jugadores).

## 2. Piloto (12 semanas) — "Matchday Pack"

| Incluido | Excluido (pasa a V1) |
|---|---|
| Equipo, plantilla, ficha completa, disponibilidad | Importar plantilla CSV |
| Alineaciones: 6 formaciones, manual + voz, alternativas, cargar por rival | Formaciones personalizadas |
| ABP: **córner ofensivo y defensivo**, editor + voz + animación | Faltas, saques de banda, saque de centro, editor libre |
| Motor: catálogo de córners, 27 operaciones, ~180 patrones | Resto de operaciones |
| Voz: STT con keyterms, revisión, aclaraciones, texto | Ordenar charla por voz |
| Calendario manual + CSV, aplazado, BYE | XLSX, ICS, varias competiciones con vistas |
| Rivales: análisis extractivo por voz, ficha, histórico básico | Pestañas cambios/hipótesis completas |
| Charla: guion de 10 secciones, **PDF** | **PPTX**, imágenes, enlace |
| Compartir: invitar jugadores, publicar once/convocatoria/jugadas/charla, panel del jugador, tutores para < 14 | Permisos finos, extractos, instrucciones individuales |

**Usuarios**: 10 entrenadores (≥ 3 de fútbol base), 1 club colaborador, ~150 jugadores.

**Condiciones de éxito**: 00 §6 (≥ 85 % comandos sin edición; ≤ 10 min por jornada desde la tercera; 0 cambios silenciosos) + ≥ 6 de 10 entrenadores activos en la semana 8.

## 3. V1 (piloto + 14 semanas)

Todo lo excluido del piloto + correcciones del aprendizaje del piloto + endurecimiento (pentest, rendimiento, accesibilidad) + planes de pago.

## 4. V1.5 (+ 12 semanas)

Animaciones avanzadas (cadenas de pases, trayectorias manuales Catmull‑Rom), GIF/MP4, mayor cobertura de comandos (~60 operaciones), comparación de versiones de jugadas, comparación histórica de análisis, plantillas profesionales y del club, permisos avanzados, streaming STT.

## 5. V2

Análisis estadístico, integraciones (vídeo, federaciones si hay acuerdo, calendarios externos con API), biblioteca táctica avanzada (CP‑SAT para sugerencias defensivas), análisis de vídeo, colaboración en tiempo real, fútbol 7/8/sala, personalización avanzada por club, otros idiomas.

## 6. Criterios de aceptación del piloto (resumen)

| Área | Criterio |
|---|---|
| Alineación | US‑201..206 en verde; T‑LU‑01..12 en verde |
| Córner | US‑301..307; T‑CRN‑01..08 y T‑EDT‑01..14 en verde |
| Voz | Corpus ≥ 85 % exact match; latencia ≤ 3,5 s p95 |
| Calendario | US‑501..504 |
| Rival | US‑601..602; T‑ANA‑01..02 |
| Charla | US‑701; PDF reproducible |
| Compartir | US‑801..804; suite de autorización 100 % |
| Calidad | NFR‑01, 03, 04, 05, 20, 22, 24, 42 cumplidos |

## 7. Estado de cada funcionalidad (a fecha de este documento)

| Funcionalidad | Diseñada | Prototipada | Implementada | Verificada |
|---|---|---|---|---|
| Ontología, zonas, roles, movimientos | ✔ | — | — | Esquemas YAML/JSON válidos |
| IR y PlayDoc | ✔ | — | — | Validación JSON Schema de ejemplo y 35 IR |
| Gramática FCSG y lexicón | ✔ | — | — | — |
| Reglas del motor | ✔ | — | — | — |
| Modelo de datos | ✔ | — | — | DDL cargado en PostgreSQL 16 |
| API | ✔ | — | — | OpenAPI validado |
| Pantallas | ✔ | Mockups estáticos | — | — |
| Pruebas | ✔ (39 casos) | — | — | — |
