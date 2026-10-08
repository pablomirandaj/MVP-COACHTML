# 05 — Especificaciones funcionales

> Comportamiento observable por módulo. Las reglas internas del motor están en 15/16/18; aquí se especifica lo que el usuario ve, los datos que intervienen y los casos límite. Se evita repetir el detalle ya especificado en los documentos de módulo.

## 1. M1 — Equipo y plantilla

### 1.1 Crear equipo
- Campos obligatorios: nombre, categoría, temporada. Opcionales: escudo (PNG/JPG/SVG ≤ 2 MB, recorte cuadrado), competición, dimensiones del campo (por defecto 105×68; aviso si fuera de rango reglamentario).
- Al crear el primer equipo se crea el club implícito (plan individual) — renombrable.
- Asistente de 3 pasos: equipo → plantilla (manual, CSV o "más tarde") → calendario.

### 1.2 Ficha de jugador
- Campos y validaciones: nombre (obligatorio), apellidos, apodo, dorsal (1–99, único en el equipo), foto (solo con consentimiento en equipos de base), posición principal (obligatoria), secundarias (máx. 3, ordenadas), pie (diestro/zurdo/ambidiestro), altura (120–220 cm), características (etiquetas con nivel 0–5: juego aéreo, velocidad, físico, disparo lejano, técnica, definición, especialista ABP), roles de balón parado, estado de disponibilidad con nota, observaciones del entrenador (privadas).
- Cada cambio queda auditado. Si el cambio procede de una aclaración de voz, la auditoría lo indica.
- Al guardar se recalcula la clave fonética usada por el NLU.

### 1.3 Lista de plantilla
- Agrupada por línea (POR, DEF, MED, DEL), con filtros por estado y búsqueda difusa.
- Acciones masivas: cambiar estado, convocar.

## 2. M2 — Alineaciones

Ver 18. Puntos funcionales adicionales:
- Banda inferior con suplentes/convocados; arrastrar entre campo y banda.
- Indicadores por ranura: punto rojo (no disponible), triángulo (fuera de posición), número de dorsal y apellido corto.
- Botón "Proponer once" (todo propuesta, discontinuo).
- "Confirmar once" exige LINEUP‑01..03 sin errores.

## 3. M3 — Balón parado

Ver 17 (editor) y 15 (motor). Requisitos funcionales clave:
- Crear desde: voz, plantilla ("Nuevo córner ofensivo → Estándar"), duplicado o en blanco.
- Toda jugada tiene nombre (por defecto generado: "Córner izq. · cerrado · 2º palo"), tipo, lado y estado.
- Guardado automático de borrador cada 30 s con cambios; "Guardar versión" crea versión inmutable.

## 4. Voz y comandos

### 4.1 Grabadora
- Botón flotante presente en jornada, alineación, editor de jugadas, análisis de rival y charla.
- Mantener pulsado para grabar (o tocar para iniciar/parar en modo accesible); vibración al iniciar; nivel de audio; límite 120 s con cuenta atrás desde 10 s.
- Al soltar: estado "Transcribiendo…" con cancelación.
- Sin permiso de micrófono: explicación + entrada de texto.

### 4.2 Revisión de instrucciones interpretadas
- Muestra: transcripción con fragmentos coloreados por comando; lista de cambios en lenguaje natural canónico ("Asignar a Pablo como portero"); avisos; preguntas pendientes (una a la vez).
- Acciones: Aplicar todo · Editar texto y reinterpretar · Descartar · desmarcar cambios individuales.
- Cambios `FUZZY` en amarillo con "¿Es Mateo Gil?" (sí/no).
- Lo no entendido aparece tachado en gris con "No he entendido esto" y sugerencias.

## 5. M4 — Calendario

- Vista lista (por defecto en móvil) y mes (tableta/escritorio); filtro por competición.
- Importación CSV/XLSX: 1) subir; 2) mapear columnas (detección automática por cabeceras comunes: "Jornada", "Fecha", "Hora", "Local", "Visitante", "Campo"); 3) previsualizar filas con incidencias (fecha inválida, equipo propio no encontrado en local/visitante, rival nuevo, posible duplicado de rival por similitud); 4) confirmar.
- El equipo propio se identifica en cada fila por coincidencia con su nombre (configurable alias).
- Estados de partido: programado, aplazado (conserva fecha original y pide nueva o "pendiente"), jugado (resultado), cancelado, jornada sin partido (BYE).
- Cambio de fecha: si ya hay charla exportada, se marca para regenerar.

### 5.1 Espacio de trabajo de la jornada
Encabezado (rival, fecha, lugar, competición) + checklist de preparación: Convocatoria · Once · Sistema · Estrategias (jugadas) · Análisis del rival · Notas de entrenamiento · Objetivos · Charla · Compartido. Cada elemento abre su editor; el estado se calcula (no es manual).

## 6. M5 — Análisis de rivales

Ver 19. Funcionalmente: desde la jornada, "Analizar rival" → dictar o escribir → revisión por tarjetas → guardar. La ficha del rival es accesible desde la jornada y desde la lista de rivales.

## 7. M6 — Charla

Ver 20. Funcionalmente: guion con secciones (activar/desactivar, arrastrar para reordenar, editar títulos, añadir mensaje), vista previa diapositiva a diapositiva, exportación con progreso y caché.

## 8. M7 — Compartir

- "Compartir" en cada recurso abre: destinatarios (todo el equipo / jugadores concretos / staff), mensaje opcional, notificación por email/push, caducidad opcional.
- Requisito previo: recurso publicado (si es borrador, el diálogo ofrece "Publicar y compartir").
- Panel del jugador: próxima jornada (convocado sí/no, hora de citación), once publicado, sus instrucciones, jugadas en las que participa (destacando su rol), charla compartida; histórico de jornadas.

## 9. Notificaciones (MVP)

| Evento | Destinatario | Canal |
|---|---|---|
| Convocatoria publicada | Jugadores (tutores en base) | Email + push PWA |
| Contenido compartido | Destinatarios | Push PWA |
| Exportación lista | Autor | En app |
| Cambio de fecha de partido | Staff + jugadores convocados | Email |

## 10. Casos límite transversales

| Caso | Comportamiento |
|---|---|
| Jugador dado de baja con jugadas y alineaciones | Se mantiene en históricos (anonimizable); no seleccionable para futuras |
| Dos entrenadores editan la misma alineación | Bloqueo optimista: el segundo recibe conflicto con opción de ver diferencias y reaplicar sus comandos |
| Cambio de dimensiones del campo del equipo | Las jugadas existentes conservan las suyas; las nuevas usan las nuevas |
| Temporada nueva | "Copiar plantilla a la nueva temporada" (selección de jugadores) y rivales conservados (pertenecen al club) |
