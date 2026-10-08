# 22 — Estrategia de pruebas

## 1. Pirámide

| Nivel | Herramienta | Alcance | Cuándo |
|---|---|---|---|
| Unitarias | Vitest | Funciones del motor, NLU, geometría, validadores, servicios | Cada commit |
| **Dorados del motor** | Vitest + snapshots por hash canónico | `engine/tests/command-tests.yaml` (39 casos) | Cada commit |
| **Propiedades** | fast-check | Determinismo, localidad, reversibilidad, simetría | Cada commit (1.000 casos) / nocturno (100.000) |
| **Corpus NLU** | Runner propio | 500 locuciones reales etiquetadas (piloto) | Cada commit en `nlu`/`lexicon`/`grammar` |
| Integración API | Vitest + Testcontainers (PostgreSQL 16) | Endpoints, transacciones, RLS | Cada PR |
| Autorización | Suite generada desde OpenAPI | Matriz rol × endpoint × equipo ajeno | Cada PR |
| E2E | Playwright (Chromium, WebKit, móvil emulado) | Flujos de los 5 escenarios | Cada PR (humo) / nocturno (completo) |
| Regresión visual | Playwright screenshots | Campo, jugadas tipo, 10 diapositivas tipo | Cada PR en `render`/`export` |
| Accesibilidad | axe‑core en E2E + revisión manual | Pantallas P01–P16 | Cada PR / por versión |
| Rendimiento | Playwright + CPU throttling, Lighthouse CI | NFR‑04/05/06 | Nocturno |
| Exportación | Validación OOXML + apertura manual en PowerPoint/Keynote/LibreOffice | NFR‑60 | Por versión |
| Seguridad | SAST (Semgrep), dependencias (npm audit/Renovate), DAST (ZAP) | — | Cada PR / semanal |
| Usabilidad | Sesiones moderadas (n ≥ 8) | Tareas clave | Hitos |

## 2. Pruebas del motor determinista

### 2.1 Casos dorados

Fichero: `docs/engine/tests/command-tests.yaml`. Estructura de cada caso: `input` (texto) o `action` (manual) → `expect_ir` → `expect_clarifications` → `expect_doc`/`assertions`/`expect_diagnostics`. Cobertura:

| Grupo | Casos | Qué verifican |
|---|---|---|
| T‑LU‑01..12 | 12 | Alineación por voz, sustitución, ambigüedad de operación, intensidades, compactación, cargar/guardar, disponibilidad, duplicados, nombres inexistentes, fonética, formación sin extremos |
| T‑CRN‑01..08 | 8 | Córner completo del enunciado, conflicto de ficha, simetría, conflicto técnico, mínima instrucción, falta de lado, exceso de jugadores, saque corto |
| T‑EDT‑01..14 | 14 | Edición incremental (las 6 órdenes del enunciado), restricciones explícitas, deshacer, riesgo de bloqueo ilegal, distancia reglamentaria, polisemia, fuera de cobertura, pronombre sin antecedente |
| T‑DET‑01..03 | 3 | Determinismo, reversibilidad, localidad |
| T‑ANA‑01..02 | 2 | Extracción del análisis y contradicción |
| **Total** | **39** | ≥ 30 exigidos por el encargo |

**Estado: diseñados, no ejecutados** (no existe código). Se ha verificado que los 35 comandos IR esperados son válidos contra `command-ir.schema.json` y que la jugada de ejemplo cumple `play.schema.json`.

### 2.2 Propiedades

| Propiedad | Enunciado |
|---|---|
| Determinismo | `hash(apply(d, c))` constante entre ejecuciones y motores JS |
| Reversibilidad | `apply(apply(d, c).inverse) == d` |
| Localidad | `diff(d, d') ⊆ touchSet ∪ dependents` |
| Simetría | `mirror_v(create(side=LEFT, p)) == create(side=RIGHT, p)` si los pies se reflejan |
| Validez | `create` con parámetros válidos no produce diagnósticos `error` |
| Idempotencia | Aplicar dos veces `set_delivery` igual no cambia el documento ni el historial |
| Monotonía de magnitudes | "mucho" ≥ "bastante" ≥ "un poco" en desplazamiento |

### 2.3 Corpus NLU

- Recogida: dictados de los 10 entrenadores piloto con consentimiento expreso (`VOICE_CORPUS`), seudonimizados.
- Etiquetado: IR esperado revisado por dos personas; desacuerdos → regla de desempate documentada.
- Partición: 70 % desarrollo / 30 % prueba ciega (no se miran sus fallos al escribir gramática).
- Métricas y umbrales: 16 §10.3. CI falla si cualquier métrica empeora > 1 punto.

## 3. Plan de pruebas por escenario (E2E)

| Spec | Escenario | Verifica |
|---|---|---|
| `lineup-voice.spec.ts` | 1 | Audio simulado (STT *mock* con texto fijo) → revisión → aclaración → guardado → `GET /matches/{id}/workspace` muestra once |
| `corner-voice.spec.ts` | 2 | Conflicto de pie → opción 1 → documento por hash → auditoría |
| `corner-edit.spec.ts` | 3 | 8 órdenes sucesivas → historial → deshacer |
| `opponent-voice.spec.ts` | 4 | 7 ítems, conflicto histórico, hipótesis |
| `talk-share.spec.ts` | 5 | Guion → PPTX/PDF → compartir → login de jugador → ve charla y no ve análisis |
| `offline.spec.ts` | — | Edición por texto sin red y sincronización |
| `minors.spec.ts` | — | Equipo de base: enlace público bloqueado; tutor ve lo del menor |

STT en E2E: adaptador `FixtureSttAdapter` (texto predefinido por hash de audio). Pruebas reales de STT con 50 audios grabados en condiciones de campo, en una suite nocturna separada que mide WER de nombres.

## 4. Implementación de los dorados (previsto)

```ts
// packages/engine/test/golden.test.ts (diseño)
for (const c of loadYaml('docs/engine/tests/command-tests.yaml').cases) {
  test(c.id, () => {
    const ctx = buildContext(fixtures, c.ctx, c.given);
    const ir = c.input ? nlu.parse(c.input, ctx) : manualToIr(c.action, ctx);
    if (c.expect_ir) expect(normalizeIr(ir.commands)).toEqual(c.expect_ir);
    if (c.expect_clarifications) expect(pickClar(ir)).toMatchObject(c.expect_clarifications);
    const res = engine.applyAll(ctx.doc, ir, ctx);
    if (c.expect_doc_equals) expect(canonicalHash(res.doc)).toBe(hashFile(c.expect_doc_equals));
    // assertions: mini-DSL evaluado con un intérprete propio (sin eval)
  });
}
```

## 5. Pruebas de autorización

Generadas desde `openapi.yaml`: para cada operación y cada rol (incluido "miembro de otro equipo" y "anónimo"), se espera el código de la matriz de 21 §2. Cualquier endpoint nuevo sin entrada en la matriz hace fallar CI.

## 6. Pruebas de exportación

- Validación del paquete OOXML (estructura, relaciones, tipos de contenido).
- Regresión visual: PPTX → PDF con LibreOffice headless → imagen → comparación con umbral 0,5 %.
- Reproducibilidad: dos exportaciones con la misma entrada → mismo SHA‑256.
- Manual por versión: abrir en PowerPoint 365 (Win/Mac), Keynote y Google Slides; editar un nombre de la alineación.

## 7. Rendimiento

| Prueba | Umbral |
|---|---|
| `nlu.parse` frase de 40 palabras | ≤ 20 ms (Node), ≤ 50 ms (móvil gama media) |
| `engine.apply` crear córner | ≤ 20 ms |
| Animación 23 actores | ≥ 50 fps con throttling 4× |
| API `POST /commands` | ≤ 300 ms p95 |

## 8. Criterios de salida por versión

- 100 % dorados y propiedades en verde; corpus ≥ umbrales.
- 0 fallos críticos de accesibilidad; 0 vulnerabilidades altas.
- Escenarios 1–5 E2E en verde en Chromium y WebKit.
- Revisión táctica del catálogo firmada por el asesor.
- Para el piloto, además: condiciones de 00 §6.
