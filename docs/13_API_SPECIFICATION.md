# 13 — Especificación de la API

> Contrato máquina: [`api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1). **Verificado** con `openapi-spec-validator`. Este documento recoge las convenciones y decisiones que el YAML no expresa.

## 1. Convenciones

| Aspecto | Decisión |
|---|---|
| Estilo | REST orientado a recursos, JSON, prefijo `/v1` |
| Autenticación | `Authorization: Bearer <JWT Supabase>`; la API verifica firma (JWKS), `exp` y `aud` |
| Autorización | Guard por ruta: rol en el equipo + ACL por elemento (21) |
| Identificadores | UUID v7 |
| Errores | RFC 9457 `application/problem+json` con `code` estable (`STALE_REVISION`, `ENGINE_VERSION_MISMATCH`, `VALIDATION_ERROR`, `FORBIDDEN_RESOURCE`, `MINOR_CONSENT_REQUIRED`, `QUOTA_EXCEEDED`) y `diagnostics` del motor cuando aplica |
| Concurrencia | `ETag` = revisión; `If-Match` obligatorio en `PUT/PATCH` de alineaciones, jugadores y presentaciones → `412` si no coincide |
| Idempotencia | `Idempotency-Key` en `POST /commands`, `/exports`, `/shares` (24 h) |
| Paginación | Cursor (`?cursor=&limit=`), máx. 100 |
| Fechas | ISO 8601 con zona; el calendario se muestra en la zona del equipo (`Europe/Madrid` por defecto) |
| Versionado de API | Ruta `/v1`; cambios incompatibles → `/v2` con 6 meses de convivencia |
| Límites | 60 req/min por usuario general; 20 transcripciones/min; cuotas de minutos de voz por plan |

## 2. Recursos y operaciones principales

| Área | Endpoints | Notas |
|---|---|---|
| Identidad | `GET /me` | Equipos y roles |
| Equipos | `POST /teams`, `GET/PATCH /teams/{id}` | `preferences` = preferencias del motor |
| Plantilla | `GET/POST /teams/{id}/players`, `GET/PATCH/DELETE /players/{id}` | Borrado lógico |
| Calendario | `POST /teams/{id}/calendar/import` → previsualización → `…/commit`; `GET /teams/{id}/matches`; `PATCH /matches/{id}`; `GET /teams/{id}/calendar.ics` | Importación en dos fases (sin escrituras hasta confirmar) |
| Jornada | `GET /matches/{id}/workspace`, `PUT /matches/{id}/squad` | Agregado para una sola carga de pantalla |
| Alineaciones | `GET/POST /teams/{id}/lineups`, `GET/PUT /lineups/{id}` | `PUT` para edición manual |
| Jugadas | `GET/POST /teams/{id}/plays`, `GET/DELETE /plays/{id}`, versiones y variantes | El documento llega calculado; el servidor revalida |
| Comandos | `POST /commands`, `POST /commands/{id}/undo` | Punto único de aplicación de IR |
| Voz | `POST /voice/recordings`, `POST …/transcribe`, `GET/PATCH /transcriptions/{id}` | Subida directa a storage con URL firmada |
| Rivales | `GET /opponents`, `GET /opponents/{id}/history`, `POST /opponents/{id}/analyses`, `PUT /analyses/{id}/items` | |
| Charla | `POST/PUT /matches/{id}/presentation`, `POST /presentations/{id}/exports`, `GET /exports/{id}` | Exportación asíncrona con caché por `input_hash` |
| Compartir | `POST /teams/{id}/shares`, `DELETE /shares/{id}`, `GET /me/feed` | |
| Administración | `GET/POST /teams/{id}/members`, `PUT /teams/{id}/permissions`, `POST /players/{id}/consents` | |

## 3. `POST /commands` en detalle

Petición:

```json
{
  "target_type": "TACTICAL_PLAY",
  "target_id": "0192f0c4-…",
  "base_version": 4,
  "transcription_id": "0192f0c5-…",
  "ir": { "ir_version": "1.0", "utterance_id": "utt_…", "source": "VOICE", "context": { "screen": "PLAY_EDITOR", "team_id": "…" }, "reference_frame": "ATTACKING_TEAM", "commands": [ … ] }
}
```

Procesamiento (en una transacción):

1. Validar `ir` contra `command-ir.schema.json`.
2. Comprobar `X-Engine-Version` == versión del servidor (mayor y menor) → si no, `409 ENGINE_VERSION_MISMATCH`.
3. Autorizar: `EDIT` sobre el recurso.
4. Cargar documento en `base_version`; si la actual es mayor → `409 STALE_REVISION` con la versión actual (el cliente puede reaplicar el IR sobre ella).
5. `engine.apply` → si hay diagnósticos `error` → `422` (salvo que el destino sea un borrador y el IR proceda de un guardado explícito como borrador).
6. Persistir versión nueva + `parsed_command` (IR, parche, inverso) + `audit_log`.
7. Responder con `new_version`, `document_hash` y diagnósticos.

`undo` aplica `inverse_patch` del comando (o de todos los comandos de la misma `utterance_id`) y crea una versión nueva (el historial nunca se reescribe).

## 4. Transcripción asíncrona

`POST /voice/recordings/{id}/transcribe` responde `202`. El cliente consulta `GET /transcriptions/{id}` con `Accept: text/event-stream` (SSE) o sondeo cada 500 ms (máx. 30 s). Estados: `QUEUED → RUNNING → DONE | FAILED`. Fallo de STT → el cliente ofrece reintentar o escribir el texto.

## 5. Webhooks y API pública

No en el MVP. V2: webhooks de "partido actualizado" y API para integraciones con plataformas de vídeo (24).
