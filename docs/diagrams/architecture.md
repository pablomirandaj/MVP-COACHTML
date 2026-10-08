# Diagramas de arquitectura

Fuente: [11_SYSTEM_ARCHITECTURE.md](../11_SYSTEM_ARCHITECTURE.md).

## Componentes

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

## Secuencia de voz

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
