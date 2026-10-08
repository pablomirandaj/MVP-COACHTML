# 11 — Arquitectura de sistema

## 1. Decisión principal

**Monolito modular en TypeScript** con un motor táctico isomórfico (navegador + servidor), PostgreSQL gestionado en la UE y un *worker* para tareas pesadas (transcripción, exportaciones). Justificación completa y alternativas en 29 (ADRs).

```mermaid
flowchart TB
  subgraph Client["Cliente — PWA Next.js (móvil, tableta, escritorio)"]
    UI[UI React + Tailwind]
    PITCH[Renderer SVG<br/>@fcs/render]
    REC[VoiceRecorder<br/>MediaRecorder + VAD]
    NLU_C[@fcs/nlu]
    ENG_C[@fcs/engine]
    IDB[(IndexedDB<br/>caché offline)]
    UI --> PITCH
    UI --> REC
    UI --> NLU_C --> ENG_C --> PITCH
    UI <--> IDB
  end

  subgraph Cloud["Nube UE"]
    CDN[CDN / hosting web]
    subgraph API["API — NestJS (Node 22)"]
      AUTHG[Guard JWT + RBAC/ACL]
      MOD_T[Teams & Roster]
      MOD_C[Calendar]
      MOD_L[Lineups]
      MOD_P[Plays]
      MOD_V[Voice]
      MOD_A[Opponent analysis]
      MOD_PR[Presentations]
      MOD_S[Sharing]
      ENG_S[@fcs/engine<br/>validación autoritativa]
      NLU_S[@fcs/nlu]
    end
    subgraph Worker["Worker — mismo código, cola pg-boss"]
      J_STT[Job transcripción]
      J_EXP[Job exportación<br/>PptxGenJS + Playwright PDF/PNG]
      J_PURGE[Jobs purga/retención]
    end
    PG[(PostgreSQL 16<br/>Supabase EU)]
    ST[(Object storage<br/>Supabase Storage EU)]
    AUTH[Supabase Auth]
  end

  STT[Proveedor STT<br/>adaptador: Deepgram / Whisper propio]
  MAIL[Email transaccional]

  Client -- HTTPS JSON --> API
  Client -- assets --> CDN
  Client -- login --> AUTH
  REC -- subida firmada --> ST
  API --> PG
  API --> ST
  API -- encola --> PG
  Worker -- consume --> PG
  J_STT --> STT
  J_EXP --> ST
  API --> MAIL
```

Fichero del diagrama: `diagrams/architecture.md`.

## 2. Componentes

| Componente | Tecnología | Responsabilidad | Escala |
|---|---|---|---|
| Web (PWA) | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI | UI, editor, ejecución optimista del motor, caché offline | Estático + SSR ligero en CDN |
| `@fcs/domain` | TypeScript + Zod | Tipos y validadores compartidos (IR, PlayDoc, DTOs) | Librería |
| `@fcs/catalog` | YAML → TS en *build* | Zonas, roles, movimientos, plantillas, reglas | Librería |
| `@fcs/engine` | TypeScript puro, sin dependencias de E/S | Reducer, planner, assigner, placer, scheduler, validator, timeline | Librería isomórfica |
| `@fcs/nlu` | TypeScript puro | Normalización, gazetteers, FCSG, IR | Librería isomórfica |
| `@fcs/render` | React + SVG; función pura `frame(t)` | Campo, actores, flechas, animación | Librería (web y exportador) |
| API | NestJS 11 (adaptador Fastify), Drizzle ORM | REST, autorización, persistencia, orquestación | Contenedor stateless, 2+ réplicas |
| Worker | Node 22 + pg-boss + Playwright Chromium | STT, PPTX/PDF/PNG, purgas | Contenedor, escala por cola |
| BD | PostgreSQL 16 gestionado (Supabase, región UE) | Datos, cola de trabajos (pg-boss), RLS | Vertical hasta ~10 k usuarios activos |
| Storage | Supabase Storage (S3 compatible), UE | Audio, fotos, escudos, exportaciones | — |
| Auth | Supabase Auth (email + enlace mágico, Google, Apple) | Identidad; JWT verificado por la API | — |
| STT | Adaptador (Deepgram Nova‑3 por defecto; faster‑whisper autohospedado opcional) | Transcripción | Externo |

## 3. Flujo de voz (secuencia)

```mermaid
sequenceDiagram
  actor C as Entrenador
  participant W as PWA
  participant ST as Storage
  participant A as API
  participant Q as Cola (pg-boss)
  participant K as Worker
  participant S as STT
  C->>W: mantiene pulsado y habla
  W->>W: VAD recorta silencios, Opus/AAC
  W->>A: POST /voice/recordings (metadatos)
  A-->>W: URL firmada de subida
  W->>ST: PUT audio
  W->>A: POST /voice/recordings/{id}/transcribe
  A->>Q: job transcribe(id, keyterms de la plantilla)
  K->>S: audio + keyterms + idioma es
  S-->>K: texto + segmentos + confianza
  K->>A: guarda transcription
  A-->>W: transcripción (SSE / long-poll)
  W->>W: @fcs/nlu → IR; @fcs/engine → propuesta + diagnósticos
  W-->>C: Revisión: texto resaltado + cambios + preguntas
  C->>W: confirma / aclara / ajusta
  W->>A: POST /commands (IR + versión base)
  A->>A: re-ejecuta NLU? NO: valida IR con @fcs/engine (autoritativo)
  A-->>W: versión nueva + diagnósticos
```

Detalle clave: el servidor **no reinterpreta el texto**; valida y aplica el IR confirmado por el usuario con la misma versión del motor. Si las versiones de motor difieren (cliente desactualizado), la API responde `409 ENGINE_VERSION_MISMATCH` y el cliente se actualiza.

## 4. Modo sin conexión

| Funcionalidad | Sin conexión |
|---|---|
| Consultar plantilla, alineaciones, jugadas y presentaciones descargadas | ✔ (IndexedDB) |
| Editar alineación/jugada manualmente o por **texto** | ✔ (motor y NLU locales); se sincroniza con bloqueo optimista |
| Dictar por voz | Se graba y se encola; se transcribe al recuperar conexión |
| Exportar PPTX/PDF | ✘ (servidor) — PNG de una jugada sí (render local) |
| Compartir | ✘ |

Conflictos: si `revision` cambió en el servidor, se muestran ambas versiones y el usuario elige; los comandos locales pendientes pueden reaplicarse sobre la versión remota (son IR, no parches de texto).

## 5. Comparativa de alternativas

### 5.1 Backend

| Criterio | **NestJS (Node/TS)** | FastAPI (Python) | Supabase "solo cliente" (RLS + Edge Functions) |
|---|---|---|---|
| Reutilizar el motor TS en servidor | ✔ nativo | ✘ (reimplementar o ejecutar Node aparte) | ~ (Edge Functions Deno) |
| Coste de equipo (un solo lenguaje) | ✔ | ✘ | ✔ |
| Estructura para monolito modular | ✔ módulos, DI, guards | ✔ | ✘ lógica dispersa |
| Ecosistema exportación (PptxGenJS, Playwright) | ✔ | ~ (python‑pptx) | ~ |
| Validación autoritativa compleja | ✔ | ✔ | ✘ |
| Rendimiento suficiente | ✔ | ✔ | ✔ |
| **Veredicto** | **Elegido** | Solo para el worker opcional de Whisper autohospedado | Descartado: la lógica de negocio no cabe en RLS |

### 5.2 Base de datos

| Criterio | **PostgreSQL gestionado (Supabase UE)** | Neon / RDS | MongoDB |
|---|---|---|---|
| Relacional + JSONB | ✔ | ✔ | ~ |
| Auth + Storage incluidos | ✔ | ✘ (añadir piezas) | ✘ |
| Coste inicial | Bajo (plan Pro ≈ 25 USD/mes) | Bajo/medio | Medio |
| Lock‑in | Bajo: es PostgreSQL estándar; Auth y Storage sustituibles (S3, Keycloak/Auth.js) | Bajo | Medio |
| **Veredicto** | **Elegido** | Plan B directo (misma BD) | Descartado |

### 5.3 Render

SVG elegido (15 §13.1). Konva queda como plan B si algún dispositivo de gama baja no alcanza 30 fps en el editor (medido en pruebas de rendimiento, 22 §7).

### 5.4 Exportación

| Formato | Herramienta | Motivo |
|---|---|---|
| PPTX | **PptxGenJS** en el worker | Formas, texto y tablas nativas → editables; masters para plantillas; mantenido y con licencia MIT |
| PDF | Playwright (Chromium) imprime la vista HTML de la presentación | Fidelidad idéntica a la vista previa; un solo diseño |
| PNG | Playwright captura del SVG | Mismo renderer |
| GIF/MP4 (V1.5) | Frames de `frame(t)` en Playwright + ffmpeg | Reutiliza el renderer |

## 6. Seguridad (resumen; detalle en 21)

- TLS en todo; JWT de Supabase verificado en la API (JWKS); sesiones cortas (1 h) con refresh.
- Autorización en dos capas: **guard de la API** (rol + ACL por elemento) y **RLS** en PostgreSQL con `SET LOCAL app.user_id` por transacción.
- URLs firmadas de corta duración (5 min) para audio y exportaciones.
- Secretos en el gestor de la plataforma; ninguna clave en el cliente salvo la *anon key* de Auth.

## 7. Observabilidad

- Logs estructurados (pino) sin datos personales; correlación por `request_id`.
- Métricas: latencia STT, tasa de aclaraciones, % fuera de cobertura, errores del motor, duración de exportaciones.
- Errores: Sentry (cliente y servidor) con *scrubbing* de PII.
- Trazas OpenTelemetry → proveedor gestionado (plan gratuito al inicio).

## 8. Escalabilidad

| Umbral | Acción |
|---|---|
| ~2.000 entrenadores activos | Arquitectura base (1 BD pequeña, 2 réplicas API, 1 worker) |
| ~10.000 | Réplica de lectura; worker de exportación separado; CDN para exportaciones |
| ~50.000 | Separar el módulo de voz en servicio propio; particionar `parsed_command` y `audit_log`; evaluar STT autohospedado por coste |

El motor se ejecuta mayoritariamente en el cliente: el coste de servidor crece con las *escrituras*, no con la edición interactiva.

## 9. Estructura del repositorio (propuesta)

```
fcs/
├── apps/
│   ├── web/            Next.js PWA
│   ├── api/            NestJS
│   └── worker/         pg-boss jobs (STT, export, purge)
├── packages/
│   ├── domain/         tipos + Zod (IR, PlayDoc, DTOs)
│   ├── catalog/        YAML de docs/engine/rules → TS
│   ├── engine/         motor táctico
│   ├── nlu/            FCSG + lexicón
│   ├── render/         SVG + frame(t)
│   └── export/         PPTX/PDF builders
├── corpus/             locuciones de evaluación (YAML)
└── infra/              IaC, docker, migraciones
```

Herramientas: pnpm workspaces + Turborepo; Vitest; Playwright; ESLint (regla que prohíbe E/S y `Math.random` en `engine`/`nlu`).
