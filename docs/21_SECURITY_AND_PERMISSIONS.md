# 21 — Seguridad, permisos y protección de datos

## 1. Roles

| Rol | Ámbito | Descripción |
|---|---|---|
| `CLUB_ADMIN` | Club | Gestiona equipos, temporadas, staff, consentimientos y plantillas del club. No ve análisis de rivales de un equipo salvo que se le conceda |
| `HEAD_COACH` | Equipo | Crea y edita todo el contenido del equipo; publica y comparte; gestiona permisos del staff |
| `ASSISTANT_COACH` | Equipo | Colabora: edita según permisos (por defecto: alineaciones, jugadas y análisis en borrador; no publica) |
| `ANALYST` | Equipo | Crea y edita análisis de rivales; lectura del resto |
| `PLAYER` | Equipo | Ve solo lo publicado y dirigido a él |
| `GUARDIAN` | Jugador | Tutor de un menor: ve lo que vería el jugador, gestiona consentimientos |

## 2. Matriz de permisos por defecto

Leyenda: **C** crear · **R** leer · **U** editar · **P** publicar/compartir · **—** sin acceso.

| Recurso | CLUB_ADMIN | HEAD_COACH | ASSISTANT | ANALYST | PLAYER | GUARDIAN |
|---|---|---|---|---|---|---|
| Equipo, temporada | CRUP | RU | R | R | R (nombre, escudo) | R |
| Plantilla (fichas completas) | R | CRU | RU | R | — (solo su propia ficha básica) | — (solo la del menor) |
| Notas del entrenador sobre jugadores | — | CRU | R | — | — | — |
| Calendario | R | CRU | RU | R | R (partidos) | R |
| Convocatoria | — | CRUP | RU | R | R si publicada | R si publicada |
| Alineación | — | CRUP | CRU | R | R si publicada y compartida | ídem |
| Jugadas | — | CRUP | CRU | R | R si compartida | ídem |
| Análisis de rival | — | CRU | CRU | CRU | — (solo extractos compartidos) | — |
| Charla | — | CRUP | CRU | R | R si compartida | ídem |
| Instrucciones individuales | — | CRUP | CRU | — | R (solo las suyas) | ídem |
| Grabaciones de voz | — | propias | propias | propias | — | — |
| Permisos y miembros | CRU (club) | CRU (equipo, salvo admin) | — | — | — | — |

Permisos finos (`permission`) amplían o restringen por elemento: p. ej. dar `PUBLISH` a un segundo entrenador concreto, o `VIEW` sobre un análisis al coordinador del club.

## 3. Estados borrador/publicado

- Todo recurso nace en `DRAFT`, visible solo para el staff con permiso.
- `PUBLISHED` fija una **versión** concreta: los jugadores ven esa versión aunque el staff siga editando (aviso "Hay cambios sin publicar").
- Revocar una compartición la oculta inmediatamente del panel del jugador.
- Las exportaciones descargadas no pueden revocarse (se advierte antes de compartir archivos).

## 4. Evaluación de acceso (orden)

1. Usuario autenticado y miembro activo del equipo (no revocado).
2. Rol permite la acción sobre el tipo de recurso (§2).
3. `permission` específica (concesión explícita) puede ampliar; denegación explícita no existe en el MVP (se modela no concediendo).
4. Para `PLAYER`/`GUARDIAN`: existe `shared_resource` no revocado, dirigido a su equipo (`TEAM_PLAYERS`) o a su jugador (`PLAYERS_LIST`), y el recurso está `PUBLISHED`.
5. RLS en PostgreSQL repite la condición de pertenencia al equipo (defensa en profundidad).

## 5. Menores de edad

Marco: RGPD + LOPDGDD (art. 7: menores de 14 años requieren consentimiento de quien ejerza la patria potestad o tutela; véase [AEPD](https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales)).

| Medida | Detalle |
|---|---|
| Equipos de fútbol base | `team.is_youth = true` activa las restricciones de esta tabla |
| Cuenta de jugador < 14 | No se crea cuenta propia: acceso vía `GUARDIAN`, que da el consentimiento (`consent.granted_as = GUARDIAN`) |
| 14–17 | Cuenta propia con consentimiento propio; el club puede exigir además el del tutor (configurable) |
| Fotografías | Desactivadas por defecto en equipos de base; solo con consentimiento `PHOTO` |
| Datos mínimos | Nombre, dorsal, posiciones, pie; altura opcional; año de nacimiento (no fecha) |
| Enlaces públicos | **Prohibidos** en equipos de base (`PUBLIC_LINK` rechazado con `MINOR_CONSENT_REQUIRED`) |
| Notas del entrenador | Advertencia de redacción: evitar datos de salud o valoraciones personales; las lesiones se registran como estado ("lesionado"), sin diagnóstico |
| Consentimientos del club | Opción `CLUB_ON_BEHALF` con referencia al documento que el club ya recoge en la inscripción |

## 6. Papel de las partes (RGPD)

| Plan | Responsable del tratamiento | FCS |
|---|---|---|
| Club | El club | Encargado del tratamiento (contrato de encargo en las condiciones del servicio) |
| Entrenador individual | El entrenador (o su club si actúa por cuenta de este; se le pide indicarlo) | Encargado |
| Datos de la cuenta y facturación | FCS | Responsable |

Subencargados: proveedor de BD/Storage/Auth (UE), proveedor STT, email, monitorización. Lista pública y notificación de cambios. Evaluación de impacto (EIPD) recomendada antes del lanzamiento por tratar datos de menores a escala y voz.

## 7. Derechos de los interesados

Acceso, rectificación, supresión, limitación, portabilidad (exportación JSON de los datos del jugador) y oposición, canalizados a través del responsable (club/entrenador) con herramientas en la configuración del equipo: "Exportar datos del jugador", "Eliminar jugador" (anonimiza en históricos de alineaciones).

## 8. Controles técnicos

| Amenaza | Control |
|---|---|
| Acceso entre equipos (IDOR) | Guard por recurso + RLS + tests de autorización automáticos por endpoint (22 §6) |
| Robo de sesión | JWT 1 h, refresh rotatorio, revocación al quitar miembro |
| Enlaces compartidos filtrados | Token aleatorio de 256 bits almacenado como hash, caducidad, revocable, no disponible en base |
| Fuga de audio | Storage privado, URLs firmadas 5 min, cifrado en reposo, purga a 30 días |
| Inyección | ORM parametrizado; validación Zod/JSON Schema en todas las entradas; el IR se valida antes de tocar el motor |
| XSS | React escapa por defecto; textos del entrenador renderizados como texto; CSP estricta |
| Archivos subidos (CSV/XLSX/imágenes) | Límite de tamaño, tipo MIME verificado, parseo en worker aislado, sin macros |
| Abuso de STT (coste) | Cuotas por plan y límites por minuto |
| Registros con datos personales | Logs sin texto libre de usuarios ni nombres; *scrubbing* en Sentry |
| Proveedor STT | DPA, sin retención para entrenamiento cuando el proveedor lo ofrezca, región UE cuando exista |

## 9. Auditoría

Se auditan (`audit_log`): publicaciones, comparticiones y revocaciones, cambios de permisos y miembros, consentimientos, cambios de ficha de jugador (incluidos los originados por voz), exportaciones descargadas y accesos de soporte.
