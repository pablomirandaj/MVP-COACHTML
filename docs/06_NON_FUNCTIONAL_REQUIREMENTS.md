# 06 — Requisitos no funcionales

Cada requisito tiene métrica y método de verificación (22).

| Id | Categoría | Requisito | Métrica / umbral | Verificación |
|---|---|---|---|---|
| NFR‑01 | Determinismo | Misma entrada → mismo documento | Hash canónico idéntico en 100 ejecuciones × 3 motores JS | T‑DET‑01 en CI |
| NFR‑02 | Determinismo | Jugadas antiguas se ven igual tras actualizar el motor | Render de versiones guardadas sin recalcular; snapshots visuales | Regresión visual |
| NFR‑03 | Rendimiento | Voz → propuesta visible | ≤ 3,5 s p95 (30 s de audio) | Métrica de producción |
| NFR‑04 | Rendimiento | Texto → propuesta | ≤ 150 ms p95 en móvil de gama media (Moto G‑class, 2023) | Benchmark Playwright con CPU throttling 4× |
| NFR‑05 | Rendimiento | Animación | ≥ 50 fps con 23 actores en móvil gama media | Benchmark |
| NFR‑06 | Rendimiento | Carga inicial de la PWA | LCP ≤ 2,5 s en 4G; JS inicial ≤ 250 KB gzip | Lighthouse CI |
| NFR‑07 | Rendimiento | Exportación PPTX de 10 diapositivas | ≤ 15 s p95 | Métrica del worker |
| NFR‑10 | Disponibilidad | API | 99,5 % mensual (fines de semana críticos) | Monitor externo |
| NFR‑11 | Resiliencia | Sin conexión | Consultar y editar por texto offline; sincronizar al volver | E2E con red cortada |
| NFR‑12 | Durabilidad | Copias | PITR 7 días + diarias 35 días; RPO ≤ 5 min, RTO ≤ 4 h | Simulacro trimestral |
| NFR‑20 | Privacidad | Menores | Reglas de 21 §5 aplicadas en equipos de base | Tests de autorización |
| NFR‑21 | Privacidad | Residencia de datos | BD, storage y backups en la UE | Revisión de configuración |
| NFR‑22 | Privacidad | Audio | Purga ≤ 24 h tras `purge_after` | Job monitorizado |
| NFR‑23 | Seguridad | OWASP ASVS nivel 2 en controles aplicables | 0 vulnerabilidades altas abiertas | Pentest pre‑lanzamiento + SAST/DAST |
| NFR‑24 | Seguridad | Aislamiento entre equipos | 100 % endpoints con test de acceso cruzado | Suite de autorización |
| NFR‑30 | Coste | Infraestructura | ≤ 0,15 €/entrenador activo/mes (sin STT) a 2.000 activos | Informe mensual |
| NFR‑31 | Coste | STT | ≤ 0,25 €/entrenador activo/mes | Informe mensual |
| NFR‑40 | Usabilidad | Primera alineación por voz | ≥ 80 % de usuarios nuevos lo consiguen sin ayuda en ≤ 3 min | Test de usabilidad (n ≥ 8) |
| NFR‑41 | Usabilidad | Curva de aprendizaje | SUS ≥ 75 | Cuestionario en piloto |
| NFR‑42 | Accesibilidad | WCAG 2.2 AA | 0 fallos críticos axe; teclado completo en editores | axe + revisión manual |
| NFR‑43 | Usabilidad | Objetivos táctiles | ≥ 44×44 px; actores del campo ≥ 32 px con área de toque 44 px | Revisión de diseño |
| NFR‑50 | Mantenibilidad | Cobertura | `engine`/`nlu` ≥ 90 % líneas y 100 % reglas con test; resto ≥ 70 % | CI |
| NFR‑51 | Mantenibilidad | Extensibilidad | Añadir sinónimo: solo YAML; nueva zona/plantilla: YAML + tests; sin cambios de motor | Revisión de PR |
| NFR‑52 | Mantenibilidad | Pureza del motor | Lint prohíbe E/S, `Date`, `Math.random` en `engine`/`nlu` | CI |
| NFR‑60 | Calidad exportación | PPTX abre sin reparación en PowerPoint 365, Keynote y LibreOffice | 100 % de las 10 diapositivas tipo | Prueba manual por versión + validación OOXML |
| NFR‑61 | Calidad exportación | Reproducible | Mismo `input_hash` → mismo binario | Test |
| NFR‑70 | Internacionalización | Textos de UI externalizados; lexicón por locale | 0 cadenas en código | Lint i18n |
| NFR‑71 | Compatibilidad | Navegadores | Últimas 2 versiones de Safari iOS, Chrome Android, Chrome/Edge/Firefox/Safari escritorio | E2E matriz |

## Métricas para los criterios de calidad del encargo (§19)

| # | Criterio | Métrica | Objetivo |
|---|---|---|---|
| 1 | Facilidad extrema | SUS; % tareas completadas sin ayuda | ≥ 75; ≥ 85 % |
| 2 | Rapidez | Tiempo de preparación de jornada | ≤ 10 min desde la 3ª jornada |
| 3 | Motor sin IA generativa | Dependencias de `engine`/`nlu`; llamadas de red | 0 modelos generativos; 0 llamadas |
| 4 | Reglas explicables | % diagnósticos y propuestas con `rule_id` | 100 % |
| 5 | Ambigüedades | Cambios silenciosos incorrectos en corpus y auditoría | 0 |
| 6 | Representación intuitiva | Comprensión de una jugada por jugadores (test: describir su rol tras verla) | ≥ 80 % aciertos |
| 7 | Edición manual y voz | Paridad: operaciones de voz con equivalente manual | 100 % |
| 8 | Persistencia | Pérdida de datos | 0 incidentes; RPO ≤ 5 min |
| 9 | Compartición segura | Tests de acceso cruzado | 100 % superados |
| 10 | Exportación profesional | Valoración de entrenadores de PPTX/PDF (1–5) | ≥ 4 |
| 11 | Mantenibilidad | Tiempo medio para añadir un patrón de voz | ≤ 1 h incluido test |
| 12 | Comercialización | Conversión gratuito→pago | ≥ 4 % a 90 días |
| 13 | Coste reducido | Coste total por activo | ≤ 0,40 €/mes |
| 14 | Datos personales | Incidentes; solicitudes RGPD atendidas en plazo | 0; 100 % ≤ 30 días |
| 15 | Crecer sin rehacer | Nuevas modalidades/idiomas sin cambio de motor ni IR | Verificado al añadir F7 (V2) |
