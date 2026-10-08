# 25 — Backlog técnico priorizado

Prioridad: P0 (bloqueante del piloto) · P1 (piloto) · P2 (V1) · P3 (V1.5+). Estimación en días‑persona (dp). Dependencias por id.

## Fase 0 — Validación

| Id | Tarea | Prio | dp | Dep. |
|---|---|---|---|---|
| BK‑000 | Verificación manual de competidores en dispositivo (03 §6) | P0 | 2 | — |
| BK‑001 | 15 entrevistas a entrenadores; protocolo y síntesis | P0 | 6 | — |
| BK‑002 | Recogida de 100 locuciones iniciales (consentimiento, guion de 30 situaciones) | P0 | 4 | BK‑001 |
| BK‑003 | Contratación asesor táctico UEFA B/A; revisión del catálogo de córners | P0 | 3 | — |
| BK‑004 | Selección STT: prueba con 50 audios de campo (WER de nombres) Deepgram vs Whisper; DPA | P0 | 4 | BK‑002 |
| BK‑005 | EIPD preliminar (menores + voz) | P0 | 3 | — |

## Piloto

### Plataforma
| Id | Tarea | Prio | dp | Dep. |
|---|---|---|---|---|
| BK‑010 | Monorepo pnpm + Turborepo, lint (incl. reglas de pureza), Vitest, CI | P0 | 3 | — |
| BK‑011 | Supabase (UE): proyecto, Auth, Storage, entornos dev/staging/prod | P0 | 2 | — |
| BK‑012 | Migración 0001 desde `db/schema.sql` con Drizzle; RLS base | P0 | 3 | BK‑011 |
| BK‑013 | API NestJS: módulos, guard JWT, RBAC, problem+json, OpenAPI generado y contrastado con `api/openapi.yaml` | P0 | 5 | BK‑012 |
| BK‑014 | Worker pg-boss; job de purga de audio | P0 | 2 | BK‑012 |
| BK‑015 | PWA Next.js: shell, navegación, tema, i18n, IndexedDB | P0 | 5 | BK‑010 |
| BK‑016 | Observabilidad: logs, Sentry con scrubbing, métricas | P1 | 2 | BK‑013 |

### Dominio y motor
| Id | Tarea | Prio | dp | Dep. |
|---|---|---|---|---|
| BK‑020 | `@fcs/domain`: tipos y Zod desde los JSON Schema | P0 | 3 | BK‑010 |
| BK‑021 | `@fcs/catalog`: compilador YAML → TS con validación | P0 | 3 | BK‑020 |
| BK‑022 | Geometría: marcos, metros↔normalizado, espejo, redondeo, hash canónico | P0 | 3 | BK‑020 |
| BK‑023 | Reducer + historial (parches RFC 6902, inversos, transacciones) | P0 | 5 | BK‑022 |
| BK‑024 | Motor de alineaciones (formaciones, POSITION_FIT, ajustes, LINEUP‑*) | P0 | 5 | BK‑023 |
| BK‑025 | Planner de plantillas (CRN_ATT_STANDARD, OPP_CORNER_DEF_MIXED, CRN_DEF_*) | P0 | 5 | BK‑021 |
| BK‑026 | Assigner (húngaro + desempate lexicográfico) | P0 | 3 | BK‑025 |
| BK‑027 | Placer (anclas, separación, rejilla) | P0 | 3 | BK‑025 |
| BK‑028 | Scheduler (grafo temporal, sincronización balón, bloqueo) | P0 | 5 | BK‑027 |
| BK‑029 | Validator: 35 reglas de `constraints.yaml` + explainer | P0 | 6 | BK‑028 |
| BK‑030 | Timeline compiler (Bézier del balón, FOLLOW) | P0 | 3 | BK‑028 |
| BK‑031 | Runner de dorados + propiedades (fast-check) | P0 | 3 | BK‑023 |

### NLU y voz
| Id | Tarea | Prio | dp | Dep. |
|---|---|---|---|---|
| BK‑040 | Normalizador es‑ES (clíticos, números, formaciones, muletillas) | P0 | 3 | BK‑020 |
| BK‑041 | Gazetteer dinámico de plantilla + clave fonética + Jaro‑Winkler | P0 | 3 | BK‑040 |
| BK‑042 | Compilador FCSG (Chevrotain para el DSL) → matchers | P0 | 6 | BK‑040 |
| BK‑043 | Marcos de alineación (12) | P0 | 4 | BK‑042 |
| BK‑044 | Marcos de jugada (15) + selectores + anáforas de grupo | P0 | 6 | BK‑042 |
| BK‑045 | Gestor de aclaraciones con previsualización | P0 | 4 | BK‑029 |
| BK‑046 | Runner de corpus y métricas | P0 | 2 | BK‑043 |
| BK‑047 | Grabadora (MediaRecorder, VAD, formatos iOS) | P0 | 3 | BK‑015 |
| BK‑048 | SttAdapter + Deepgram + Fixture; keyterms | P0 | 3 | BK‑014 |
| BK‑049 | Pantalla de revisión (P11) | P0 | 5 | BK‑045 |

### UI de módulos
| Id | Tarea | Prio | dp | Dep. |
|---|---|---|---|---|
| BK‑060 | Plantilla y ficha (P03, P04) | P0 | 5 | BK‑013 |
| BK‑061 | `@fcs/render`: campo SVG, actores, flechas, vistas | P0 | 5 | BK‑022 |
| BK‑062 | Editor de alineaciones (P07) | P0 | 6 | BK‑024, BK‑061 |
| BK‑063 | Editor ABP (P08) manual | P0 | 8 | BK‑061, BK‑029 |
| BK‑064 | Reproductor y línea temporal | P0 | 4 | BK‑030 |
| BK‑065 | Biblioteca de jugadas (P09) | P1 | 3 | BK‑063 |
| BK‑066 | Calendario + importación CSV (P05) | P1 | 5 | BK‑013 |
| BK‑067 | Espacio de jornada + checklist (P06) | P1 | 4 | BK‑066 |
| BK‑068 | Extractor de análisis + revisión por tarjetas + ficha de rival (P12) | P1 | 7 | BK‑042 |
| BK‑069 | Generador de guion + vista previa + PDF (P13, P14) | P1 | 7 | BK‑067 |
| BK‑070 | Invitaciones, publicar/compartir, panel del jugador (P15) | P1 | 6 | BK‑013 |
| BK‑071 | Tutores y consentimientos de menores | P1 | 4 | BK‑070 |
| BK‑072 | Configuración y permisos (P16) básico | P1 | 3 | BK‑070 |
| BK‑073 | Suite de autorización desde OpenAPI | P0 | 3 | BK‑013 |
| BK‑074 | E2E escenarios 1–5 | P1 | 5 | todos |

**Total piloto = 183 dp** (plataforma 22 + motor 47 + NLU/voz 39 + UI 75), más 22 dp de la Fase 0. Capacidad: 3 desarrolladores × 12 semanas × 5 días = 180 dp. Sin holgura: el recorte de seguridad es BK‑065 y BK‑072 (6 dp), que pasan a V1 si hace falta; diseño y QA a tiempo parcial no están en esta cuenta.

## V1

| Id | Tarea | Prio | dp |
|---|---|---|---|
| BK‑100 | Plantillas y reglas: faltas lateral/frontal/indirecta (barrera), saque de banda, saque de centro | P2 | 15 |
| BK‑101 | Editor libre (CUSTOM) + trayectorias manuales | P2 | 6 |
| BK‑102 | Exportador PPTX (masters, formas nativas, diapositivas por fase) | P2 | 10 |
| BK‑103 | Ordenación de charla por voz (talk.*) | P2 | 5 |
| BK‑104 | Imágenes, documento imprimible, enlace compartido | P2 | 4 |
| BK‑105 | Permisos finos, extractos de análisis, instrucciones individuales | P2 | 8 |
| BK‑106 | XLSX, ICS (import y suscripción), varias competiciones | P2 | 6 |
| BK‑107 | Histórico completo del rival: cambios, hipótesis, conflictos históricos | P2 | 5 |
| BK‑108 | Formaciones personalizadas e importación CSV de plantilla | P2 | 5 |
| BK‑109 | Ampliación NLU a ~40 operaciones con corpus del piloto | P2 | 10 |
| BK‑110 | Pagos (Stripe), planes y cuotas | P2 | 6 |
| BK‑111 | Pentest, rendimiento, accesibilidad, offline completo | P2 | 10 |

## V1.5+

| Id | Tarea | Prio |
|---|---|---|
| BK‑200 | Cadenas de pases y animación avanzada | P3 |
| BK‑201 | GIF/MP4 | P3 |
| BK‑202 | STT en streaming | P3 |
| BK‑203 | Plantillas de club y de presentación profesionales | P3 |
| BK‑204 | Comparación de versiones y de análisis | P3 |
| BK‑205 | CP‑SAT para sugerencias defensivas | P3 |
| BK‑206 | Lexicón pt‑PT / es‑AR / es‑MX | P3 |
