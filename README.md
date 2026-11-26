# Football Coach Studio — Blueprint de producto

> **26/11/2026 — MVP: sénior, sin voz, con asistente conversacional y escenas de fases exportables a HTML.** Ver [23 §0](docs/23_MVP_SCOPE.md), [31](docs/31_CONVERSATIONAL_ASSISTANT.md), [32](docs/32_GAME_PHASES_MODULE.md) y ADR‑016/017/018 en [29](docs/29_ARCHITECTURE_DECISIONS.md).

Paquete de investigación, arquitectura, diseño y especificación de **Football Coach Studio (FCS)**: plataforma de planificación táctica para entrenadores de fútbol 11 (amateur, semiprofesional y formativo) cuyo flujo principal es:

> **Hablar → Revisar → Visualizar → Ajustar → Guardar → Compartir**

Principio rector: **el motor táctico es determinista y no depende de IA generativa**. La voz solo se usa para *transcribir*; la *interpretación* la hace un parser gramatical sobre un vocabulario controlado y la *ejecución* un motor de reglas con coordenadas normalizadas.

## Estado del proyecto

| Elemento | Estado |
|---|---|
| Investigación de mercado y tecnológica | Realizada (con limitaciones declaradas en 02/03) |
| Especificación funcional, arquitectura, datos, API | **Diseñado** |
| Motor táctico (ontología, gramática, IR, reglas, tests) | **Diseñado** (especificaciones máquina en `docs/engine`) |
| Esquemas y contratos | **Verificados con herramientas**: JSON Schema (IR y PlayDoc) válidos, la jugada de ejemplo y los 35 comandos IR de los tests validan; `openapi.yaml` válido; `schema.sql` carga en PostgreSQL 16 |
| Mockups visuales | **Prototipado** (HTML estático, `docs/mockups/index.html`, anima la jugada de ejemplo) |
| Motor (`packages/engine`): alineaciones, córner ofensivo, edición incremental, deshacer/rehacer, fases de juego | **Implementado y verificado** (37 pruebas) |
| Exportador HTML autónomo (`packages/render`), con vista vertical en móvil | **Implementado**; ejemplos en `examples/html/` comprobados en Chromium |
| Servidor (`packages/server`): API Fastify, login, PostgreSQL, charla en PDF | **Implementado y verificado** (9 pruebas de integración con PostgreSQL real) |
| Asistente conversacional (pieza intercambiable de modelo) | **Implementado**; probado con un modelo simulado. **Pendiente**: prueba con la API real (requiere clave) |
| Aplicación web (`packages/web`) | **Implementada**; prueba de extremo a extremo con Chromium en verde |
| Voz, compartir con jugadores, recuperación de contraseña | **Pendiente** |

## Cómo ejecutarlo

Requiere Node 22, pnpm 10 y PostgreSQL 16 (el script crea uno local).

```bash
pnpm install
pnpm db:dev                     # PostgreSQL local en 127.0.0.1:55432 (bases fcs, fcs_test, fcs_e2e)
pnpm web:build                  # compila la web (packages/web/dist)
pnpm server                     # API + web en http://127.0.0.1:8787 (aplica migraciones al arrancar)
```

Variables del servidor: `DATABASE_URL`, `PORT`, `COOKIE_SECURE=1` (producción), `CHROMIUM_PATH` (para la charla en PDF),
`ANTHROPIC_API_KEY` y `ASSISTANT_MODEL` (por defecto `claude-opus-5-5`) para el asistente; `ASSISTANT_PROVIDER=none` lo desactiva.
En desarrollo de la web: `pnpm server` y, en otra terminal, `pnpm web:dev` (http://localhost:5173, con proxy a la API).

Pruebas:

```bash
pnpm test        # motor + API (la API necesita TEST_DATABASE_URL; si no está, esa parte se omite)
pnpm test:api    # solo API contra postgres://postgres@127.0.0.1:55432/fcs_test
pnpm typecheck
# E2E: con el servidor sirviendo la web compilada en BASE_URL
BASE_URL=http://127.0.0.1:8787 CHROMIUM_PATH=/ruta/a/chrome pnpm e2e
pnpm examples    # regenera examples/html/*.html desde el motor
```

Ejemplos generados (abrir en cualquier navegador, sin conexión):

- `examples/html/corner-izquierda-cerrado.html` — córner del escenario 2.
- `examples/html/presion-alta-433.html` — nuestra presión alta.
- `examples/html/presion-rival-433.html` — presión del rival sobre nuestra salida.
- `examples/html/repliegue-bloque-bajo-442.html` — repliegue y basculación.
- `examples/html/vigilancias-3.html` — vigilancias 2 + 1 en ataque.

## Índice

Lectura recomendada: `00` → `30` → `23` → `15` → `16`.

| # | Documento | Contenido |
|---|---|---|
| 00 | [Viabilidad](docs/00_FEASIBILITY_ASSESSMENT.md) | Evaluación de viabilidad y riesgos principales |
| 01 | [Visión de producto](docs/01_PRODUCT_VISION.md) | Problema, propuesta de valor, posicionamiento |
| 02 | [Investigación de mercado](docs/02_MARKET_RESEARCH.md) | Segmentos, tamaño, fuentes tácticas y tecnológicas |
| 03 | [Competencia](docs/03_COMPETITOR_ANALYSIS.md) | Matriz verificada de funcionalidades y precios |
| 04 | [PRD](docs/04_PRODUCT_REQUIREMENTS_PRD.md) | Requisitos de producto priorizados |
| 05 | [Especificación funcional](docs/05_FUNCTIONAL_SPECIFICATIONS.md) | Comportamiento por módulo |
| 06 | [Requisitos no funcionales](docs/06_NON_FUNCTIONAL_REQUIREMENTS.md) | Rendimiento, privacidad, calidad, métricas |
| 07 | [Historias de usuario](docs/07_USER_STORIES.md) | Historias con criterios de aceptación |
| 08 | [Flujos de usuario](docs/08_USER_FLOWS.md) | Flujos y 5 escenarios extremo a extremo |
| 09 | [UX/UI](docs/09_UX_UI_DESIGN.md) | 16 pantallas, wireframes, sistema visual |
| 10 | [Arquitectura de información](docs/10_INFORMATION_ARCHITECTURE.md) | Navegación y taxonomía |
| 11 | [Arquitectura de sistema](docs/11_SYSTEM_ARCHITECTURE.md) | Componentes, despliegue, decisiones |
| 12 | [Base de datos](docs/12_DATABASE_DESIGN.md) | Modelo, ERD, SQL (`docs/db/schema.sql`) |
| 13 | [API](docs/13_API_SPECIFICATION.md) | REST + OpenAPI (`docs/api/openapi.yaml`) |
| 14 | [Modelo de dominio](docs/14_FOOTBALL_DOMAIN_MODEL.md) | Ontología futbolística, coordenadas, zonas |
| 15 | [Motor de reglas](docs/15_TACTICAL_RULES_ENGINE.md) | **Núcleo**: DSL, restricciones, asignación, animación |
| 16 | [Motor de voz y comandos](docs/16_VOICE_COMMAND_ENGINE.md) | **Núcleo**: STT, gramática, IR, ambigüedad |
| 17 | [Editor de balón parado](docs/17_SET_PIECE_EDITOR.md) | Editor visual y conversacional |
| 18 | [Motor de alineaciones](docs/18_LINEUP_ENGINE.md) | Formaciones, asignación, ajustes |
| 19 | [Análisis de rivales](docs/19_OPPONENT_ANALYSIS.md) | Extracción, histórico, trazabilidad |
| 20 | [Generador de presentaciones](docs/20_PRESENTATION_GENERATOR.md) | Charla, PPTX/PDF |
| 21 | [Seguridad y permisos](docs/21_SECURITY_AND_PERMISSIONS.md) | RBAC, ACL, menores, RGPD |
| 22 | [Estrategia de pruebas](docs/22_TESTING_STRATEGY.md) | Plan de pruebas y 39 casos deterministas |
| 23 | [Alcance MVP](docs/23_MVP_SCOPE.md) | Piloto, V1, V1.5, V2 |
| 24 | [Roadmap](docs/24_ROADMAP.md) | Hitos |
| 25 | [Backlog](docs/25_BACKLOG.md) | Backlog técnico priorizado |
| 26 | [Costes](docs/26_COST_ESTIMATION.md) | Desarrollo, operación, precios |
| 27 | [Despliegue](docs/27_DEPLOYMENT_GUIDE.md) | Infraestructura y entornos |
| 28 | [Riesgos](docs/28_RISK_REGISTER.md) | Registro de riesgos |
| 29 | [ADRs](docs/29_ARCHITECTURE_DECISIONS.md) | Decisiones de arquitectura |
| 30 | [Resumen ejecutivo](docs/30_EXECUTIVE_SUMMARY.md) | Síntesis para decisión |
| 31 | [Asistente conversacional](docs/31_CONVERSATIONAL_ASSISTANT.md) | Chat con Claude que emite comandos validados por el motor; costes |
| 32 | [Fases de juego](docs/32_GAME_PHASES_MODULE.md) | Presión, repliegue, vigilancias; exportación HTML |

## Artefactos técnicos

```
docs/
├── api/openapi.yaml                    OpenAPI 3.1 inicial
├── db/schema.sql                       DDL PostgreSQL 16 del MVP
├── diagrams/                           Arquitectura, ERD y flujos (Mermaid)
├── engine/
│   ├── command-ir.schema.json          Contrato JSON de comandos (IR)
│   ├── play.schema.json                Documento de jugada versionado
│   ├── grammar/commands.fcsg           Gramática de comandos (DSL FCSG)
│   ├── lexicon/es-ES.yaml              Diccionario de términos y sinónimos
│   ├── rules/*.yaml                    Biblioteca inicial de reglas, zonas, roles, movimientos
│   ├── examples/*.json                 Jugadas de ejemplo
│   └── tests/command-tests.yaml        39 casos de prueba deterministas
└── mockups/index.html                  Mockups visuales de pantallas clave
```
