# 04 — Documento de requisitos de producto (PRD)

## 1. Objetivo del producto

Reducir el tiempo de preparación semanal de un partido a ≤ 10 minutos y mejorar la comunicación táctica con los jugadores, con una herramienta que el entrenador maneja hablando y que nunca inventa contenido.

## 2. Alcance por versión

Resumen; criterios detallados en 23.

| Módulo | Piloto (12 sem.) | V1 | V1.5 | V2 |
|---|---|---|---|---|
| M1 Equipo y plantilla | ✔ | ✔ + importación CSV de plantilla | Atributos personalizados del club | Multi‑modalidad (F7/F8) |
| M2 Alineaciones | ✔ manual + voz, 6 formaciones | 10 formaciones + personalizadas | Comparar alineaciones | Estadísticas de uso |
| M3 Balón parado | Córner ofensivo y defensivo | Faltas, banda, saque de centro, editor libre | Animaciones avanzadas, GIF/MP4, cadenas de pases | Biblioteca táctica avanzada |
| Motor de comandos | 27 operaciones | ≈ 40 operaciones | Mayor cobertura | Otros idiomas |
| M4 Calendario | Manual + CSV | XLSX, ICS (import y suscripción), aplazados, varias competiciones | — | Integración federativa si hay acuerdo |
| M5 Rivales | Notas por voz extractivas + ficha | Histórico, hipótesis, conflictos | Comparación histórica | Integración vídeo |
| M6 Charla | PDF | PPTX editable, imágenes, enlace, ordenación por voz | Plantillas profesionales/club | — |
| M7 Compartir | Jugadores ven once + jugadas publicadas | Roles completos, extractos, instrucciones individuales, tutores | Permisos avanzados | Colaboración en tiempo real |

## 3. Requisitos funcionales (identificadores)

Prioridad MoSCoW referida a **V1**. `P` = incluido en el piloto.

### M1 Equipo y plantilla
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑101 | Crear uno o varios equipos (nombre, escudo, categoría, temporada, competición) | M | ✔ |
| FR‑102 | Ficha de jugador con todos los campos de 4.1 del encargo | M | ✔ |
| FR‑103 | Posición principal única + secundarias ordenadas | M | ✔ |
| FR‑104 | Características (etiquetas 0–5) y roles de balón parado | M | ✔ |
| FR‑105 | Disponibilidad (disponible, lesionado, sancionado, duda, no disponible) con nota | M | ✔ |
| FR‑106 | Cuerpo técnico con títulos | M | ✔ |
| FR‑107 | Importar plantilla desde CSV | S | — |
| FR‑108 | Sistemas preferidos del equipo | S | ✔ |

### M2 Alineaciones
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑201 | Seleccionar formación predefinida y distribuir posiciones automáticamente | M | ✔ |
| FR‑202 | Asignar por arrastrar, selección, manual y voz | M | ✔ |
| FR‑203 | Detectar duplicados, ranuras vacías, no disponibles (LINEUP‑01..06) | M | ✔ |
| FR‑204 | Comandos de modificación (sustituir, intercambiar, adelantar grupo, juntar líneas) | M | ✔ |
| FR‑205 | Guardar alternativas con etiqueta y cargar alineaciones previas por rival | M | ✔ |
| FR‑206 | Vincular a partido; un once oficial por partido | M | ✔ |
| FR‑207 | Formaciones personalizadas | S | — |

### M3 Balón parado
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑301 | Editor visual con coordenadas normalizadas (todas las acciones de 6.1) | M | córner |
| FR‑302 | Crear jugada por voz con roles, movimientos, balón y secuencia (pasos 1–15) | M | ✔ |
| FR‑303 | Edición conversacional incremental con historial, deshacer y rehacer | M | ✔ |
| FR‑304 | Distinción visual explícito/propuesta | M | ✔ |
| FR‑305 | Validación de reglas (LAW/GEO/TECH/TAC/SEQ) con explicación | M | ✔ |
| FR‑306 | Reproducción animada con control de velocidad y fases | M | ✔ |
| FR‑307 | Variantes y versiones | M | ✔ (versiones) |
| FR‑308 | Biblioteca con filtros | M | ✔ |
| FR‑309 | Exportar jugada (PNG, secuencia de diapositivas) | M | PNG |
| FR‑310 | Rivales en la jugada (plantilla defensiva) | M | ✔ |
| FR‑311 | Tipos de acción restantes (faltas, banda, saque de centro, libre) | M | — |

### Motor de voz y comandos
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑401 | Grabación con pulsación mantenida, ≤ 120 s, con indicador de nivel | M | ✔ |
| FR‑402 | Transcripción en español con sesgo de vocabulario de la plantilla | M | ✔ |
| FR‑403 | Texto transcrito editable y entrada escrita equivalente | M | ✔ |
| FR‑404 | Interpretación determinista a IR (cobertura 16 §10) | M | ✔ |
| FR‑405 | Pantalla de revisión con resaltado de spans y cambios | M | ✔ |
| FR‑406 | Aclaraciones con opciones previsualizadas; respuesta por toque o voz | M | ✔ |
| FR‑407 | Sugerencias ante órdenes fuera de cobertura y opción de nota | M | ✔ |

### M4 Calendario
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑501 | Alta manual de partidos y jornadas | M | ✔ |
| FR‑502 | Importación CSV con mapeo de columnas y previsualización | M | ✔ |
| FR‑503 | Importación XLSX e ICS; suscripción ICS de salida | S | — |
| FR‑504 | Aplazados, cambios de fecha, jornadas sin partido, varias competiciones | M | parcial (aplazado, BYE) |
| FR‑505 | Espacio de trabajo por jornada con checklist de preparación | M | ✔ |
| FR‑506 | Observaciones posteriores al partido | M | ✔ |

### M5 Rivales
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑601 | Ficha de rival con histórico de enfrentamientos | M | ✔ |
| FR‑602 | Análisis por voz → informe estructurado extractivo (12 categorías) | M | ✔ |
| FR‑603 | Detección de contradicciones y diferenciación nominal/fase | M | ✔ |
| FR‑604 | Histórico: pasado, próximo, cambios, hipótesis | M | parcial |
| FR‑605 | Trazabilidad de fecha, fuente y autor | M | ✔ |

### M6 Charla
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑701 | Generar guion desde la jornada con 10 secciones activables y reordenables | M | ✔ |
| FR‑702 | Ordenar/incluir por voz (9.3) | S | — |
| FR‑703 | Exportar PDF | M | ✔ |
| FR‑704 | Exportar PPTX editable | M | — |
| FR‑705 | Imágenes, documento imprimible, enlace | S | — |

### M7 Compartir
| Id | Requisito | Prio | P |
|---|---|---|---|
| FR‑801 | Invitar jugadores y staff por email | M | ✔ |
| FR‑802 | Publicar y compartir once, convocatoria, jugadas, charla | M | ✔ |
| FR‑803 | Panel del jugador | M | ✔ |
| FR‑804 | Permisos por elemento y roles completos | M | — |
| FR‑805 | Tutores y consentimientos de menores | M | ✔ (si hay equipos de base en el piloto) |

## 4. Requisitos no funcionales

Ver 06. Críticos: determinismo (NFR‑01), latencia voz→propuesta ≤ 3,5 s p95 (NFR‑03), privacidad de menores (NFR‑20), coste de STT ≤ 0,25 €/entrenador/mes (NFR‑31).

## 5. Métricas de éxito

| Métrica | Objetivo piloto | Objetivo V1 (3 meses tras lanzamiento) |
|---|---|---|
| Comandos aplicados sin corrección | ≥ 85 % | ≥ 90 % |
| Cambios silenciosos incorrectos | 0 | 0 |
| Tiempo medio de preparación de jornada | ≤ 20 min (1ª), ≤ 10 min (3ª) | ≤ 8 min |
| Entrenadores activos semana 8 | ≥ 60 % de los pilotos | ≥ 40 % |
| Charlas generadas por jornada jugada | ≥ 50 % | ≥ 60 % |
| Jugadores que abren el contenido compartido | ≥ 60 % | ≥ 70 % |
| NPS de entrenadores | ≥ 30 | ≥ 40 |

## 6. Supuestos y dependencias

- Los entrenadores aceptan una pantalla de revisión (validado en entrevistas de descubrimiento antes del piloto).
- Disponibilidad de un asesor táctico con licencia UEFA B o superior (≥ 4 h/semana).
- Proveedor STT con DPA aceptable.
- 10 entrenadores piloto comprometidos (≥ 3 de fútbol base).

## 7. Fuera de alcance

Véase 01 §8.
