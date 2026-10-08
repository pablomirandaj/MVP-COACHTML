# 09 — Diseño UX/UI

Mockups visuales: [`mockups/index.html`](mockups/index.html) (prototipo estático de pantallas clave). Arquitectura de navegación: 10.

## 1. Principios de experiencia

1. **Un botón grande para hablar** en toda pantalla de trabajo; el resto es secundario.
2. **El campo es la interfaz**: los datos se ven sobre el campo, no en formularios.
3. **Mostrar, no preguntar**: ante una ambigüedad se enseña la propuesta en el campo junto a la pregunta.
4. **Propuesta ≠ decisión**: trazo discontinuo y etiqueta "propuesta" en todo lo no dicho.
5. **Deshacer siempre visible** tras cualquier cambio (toast 6 s + botón permanente en editores).
6. **Lenguaje de vestuario**: "once", "convocatoria", "primer palo", "charla"; nada de "entidades" o "coordenadas".

## 2. Sistema visual

| Elemento | Decisión |
|---|---|
| Estética | Deportiva y sobria: césped desaturado, fondo oscuro opcional, acentos de color del club |
| Tipografía | **Barlow Condensed** (titulares, dorsales — legible a distancia y en proyector) + **Inter** (texto) — ambas OFL |
| Color base | Césped `#2F6B3A`/`#3A7D45` (bandas), líneas `#F2F5F0`; propio = color primario del club (por defecto `#1E5BD8`); rival = gris `#6B7280`; balón blanco con contorno |
| Semánticos | Error `#C62828`, aviso `#B26A00`, info `#1565C0`, propuesta = **trazo discontinuo 6‑4** + chip "propuesta" |
| Formas | Propios: círculo con dorsal; rivales: cuadrado redondeado; portero: borde doble |
| Flechas | Carrera: línea continua con punta; balón: discontinua fina con curva; bloqueo: barra perpendicular "▮"; arrastre: línea ondulada |
| Modo oscuro | Por defecto en editor en tableta; claro en gestión |
| Movimiento | 200–300 ms ease‑out; respeta `prefers-reduced-motion` |
| Rejilla | 4 pt; márgenes 16 px móvil, 24 px tableta |

## 3. Responsive

| Ancho | Distribución |
|---|---|
| < 600 px (móvil) | Navegación inferior (5 pestañas); campo vertical a ancho completo; paneles en hojas deslizantes |
| 600–1024 px (tableta) | Raíl lateral; campo horizontal; panel derecho plegable |
| > 1024 px | Raíl + campo + panel fijo; atajos de teclado |

## 4. Pantallas

Para cada pantalla: objetivo · componentes · acciones · navegación · vacío · errores · responsive · accesibilidad.

### P01 — Login y registro
- **Objetivo**: entrar en < 30 s.
- **Componentes**: email + enlace mágico; Google; Apple; enlace a privacidad; selector de idioma.
- **Acciones**: enviar enlace, OAuth, aceptar invitación (si viene con token).
- **Navegación**: → onboarding (nuevo) / → panel (existente) / → panel de jugador (rol jugador).
- **Vacío**: n/a. **Errores**: enlace caducado → reenviar; invitación revocada → mensaje.
- **Responsive**: una columna centrada. **A11y**: etiquetas visibles, foco inicial en email.

### P02 — Dashboard del entrenador
- **Objetivo**: saber qué hacer hoy.
- **Componentes**: tarjeta **Próxima jornada** (rival, cuenta atrás, checklist 0/8), accesos rápidos (Dictar, Once, Nuevo córner, Charla), avisos de plantilla (lesionados), últimas jugadas, selector de equipo.
- **Acciones**: abrir jornada, dictar (contexto global: la orden decide el módulo).
- **Navegación**: pestaña Inicio.
- **Vacío**: "Crea tu calendario" + "Añade jugadores" con CTA.
- **Errores**: sin conexión → banner y datos en caché.
- **Responsive**: tarjetas en una columna / dos columnas. **A11y**: checklist como lista con estados textuales.

### P03 — Gestión de plantilla
- **Objetivo**: mantener la plantilla al día.
- **Componentes**: lista agrupada por línea con foto/iniciales, dorsal, posición, pie, estado; filtros; búsqueda; botón añadir; importar CSV.
- **Acciones**: alta, edición, cambio de estado masivo, convocar.
- **Vacío**: ilustración + "Añadir jugador" / "Importar CSV".
- **Errores**: dorsal repetido; importación con filas inválidas (resumen).
- **Responsive**: lista / tabla en escritorio. **A11y**: estado con icono + texto.

### P04 — Ficha de jugador
- **Objetivo**: describir al jugador para que el motor lo use.
- **Componentes**: cabecera (foto, dorsal, nombre), posiciones (mini‑campo para elegir principal/secundarias), pie (3 botones), altura, características (deslizadores 0–5), roles ABP (chips), estado, notas privadas (candado), historial (alineaciones y jugadas en las que aparece).
- **Acciones**: guardar, dar de baja, exportar datos (RGPD).
- **Errores**: validaciones en línea. **A11y**: el mini‑campo tiene alternativa en lista.

### P05 — Calendario
- **Objetivo**: ver y gestionar jornadas.
- **Componentes**: lista por jornada (nº, rival, fecha, L/V, estado, progreso de preparación), vista mes, filtro de competición, importar, añadir.
- **Acciones**: abrir jornada, aplazar, cambiar fecha, marcar resultado.
- **Vacío**: "Importa tu calendario (CSV, Excel o ICS)".
- **Errores**: importación con incidencias → asistente.
- **Responsive**: lista / mes. **A11y**: la vista mes tiene equivalente en lista.

### P06 — Espacio de trabajo por jornada
- **Objetivo**: preparar el partido en un solo sitio.
- **Componentes**: cabecera del partido; checklist (Convocatoria, Once, Sistema, Jugadas, Rival, Notas de entrenamiento, Objetivos, Charla, Compartido); secciones expandibles con resumen; botón de voz contextual; observaciones posteriores (tras el partido).
- **Acciones**: abrir cada editor, compartir, generar charla.
- **Vacío**: cada sección con CTA.
- **Errores**: partido aplazado → banner con nueva fecha / "pendiente".
- **Responsive**: secciones apiladas / dos columnas. **A11y**: progreso anunciado ("5 de 9 completados").

### P07 — Editor de alineaciones
- **Objetivo**: definir el once rápido.
- **Componentes**: selector de sistema; campo con ranuras; banquillo (convocados) deslizable; indicadores (no disponible, fuera de posición, inferido); botón de voz; menú (Proponer once, Guardar como…, Cargar…, Confirmar once).
- **Acciones**: arrastrar, tocar ranura → lista, voz, deshacer.
- **Vacío**: ranuras vacías numeradas con "Toca o dicta".
- **Errores**: LINEUP‑01..03 en barra inferior; "Confirmar" deshabilitado con motivo.
- **Responsive**: vertical móvil / horizontal tableta. **A11y**: cada ranura es botón con nombre ("Lateral izquierdo: Lucas Pérez, fuera de posición").

### P08 — Editor de balón parado
- Especificado en 17 §2–9 (anatomía, interacciones, estados vacíos, errores, accesibilidad).

### P09 — Biblioteca de jugadas
- **Objetivo**: encontrar y reutilizar.
- **Componentes**: rejilla de miniaturas; filtros (tipo, lado, jugador, etiqueta, estado, jornada); búsqueda; orden por uso/reciente.
- **Acciones**: abrir, duplicar, variante, vincular a jornada, compartir, exportar, archivar.
- **Vacío**: "Crea tu primer córner — dímelo" + plantillas.
- **Responsive**: 2/3/4 columnas. **A11y**: miniatura con texto alternativo generado.

### P10 — Grabadora de voz
- **Objetivo**: hablar sin fricción.
- **Componentes**: botón flotante (64 px) → al pulsar, panel inferior con forma de onda, temporizador, contexto ("Editando: Córner izq."), ejemplos de órdenes rotativos, cancelar (deslizar).
- **Acciones**: mantener/soltar; tocar para modo manos libres; escribir en su lugar.
- **Errores**: sin permiso de micrófono → instrucciones por plataforma; audio < 0,3 s → "No te he oído".
- **A11y**: modo tocar‑para‑iniciar/parar; anuncio de estado por lector.

### P11 — Revisión de instrucciones interpretadas
- **Objetivo**: confirmar sin sorpresas.
- **Componentes**: transcripción editable con fragmentos subrayados por color (uno por comando; gris tachado = no entendido); lista de cambios en lenguaje canónico con casillas; avisos; tarjeta de pregunta (una a la vez) con opciones y miniatura de previsualización; botones Aplicar · Editar texto · Descartar.
- **Acciones**: tocar un cambio → resalta en el campo; tocar un fragmento → muestra su interpretación; responder por voz.
- **Errores**: reinterpretación tras editar texto en < 150 ms.
- **Responsive**: hoja inferior al 60 % en móvil (el campo sigue visible arriba) / panel lateral.
- **A11y**: cambios como lista de casillas; preguntas como grupo de radio.

### P12 — Análisis de rival
- **Objetivo**: registrar y consultar lo que se sabe del rival.
- **Componentes**: pestañas Próximo partido · Histórico · Cambios · Hipótesis · Enfrentamientos; tarjetas por categoría con texto literal, fecha, fuente, chip de evidencia; reproducir el fragmento de audio (mientras exista).
- **Acciones**: dictar, escribir, mover tarjeta de categoría, marcar hipótesis/confirmada/refutada, crear extracto para compartir.
- **Vacío**: "Aún no hay observaciones. Cuéntame cómo juega."
- **Errores**: conflicto → tarjeta con borde ámbar y acción.
- **A11y**: categorías como encabezados.

### P13 — Preparación de charla
- **Objetivo**: guion en minutos.
- **Componentes**: lista de secciones (interruptor, asa de arrastre, título editable, número de elementos), panel de contenido de la sección, campo de mensaje, botón de voz, plantilla visual.
- **Acciones**: reordenar, activar, editar, dictar orden, vista previa, exportar.
- **Vacío**: secciones sin contenido aparecen desactivadas con "Añadir…".
- **A11y**: reordenar con botones subir/bajar además de arrastrar.

### P14 — Vista previa de presentación
- **Objetivo**: ver exactamente lo que se exportará/proyectará.
- **Componentes**: diapositiva 16:9, miniaturas, notas del orador, reproductor en diapositivas de jugadas, botones Exportar (PPTX, PDF, Imágenes), Compartir, Pantalla completa (modo proyector).
- **Errores**: exportación en curso/fallida con reintento.
- **Responsive**: en móvil horizontal a pantalla completa. **A11y**: navegación con flechas; texto real (no imágenes) en la vista web.

### P15 — Panel del jugador
- **Objetivo**: que el jugador sepa lo suyo en 10 s.
- **Componentes**: Próximo partido (convocado ✔/✘, citación, lugar), Mi papel (posición en el once, instrucciones individuales), Jugadas donde participo (con mi actor resaltado y reproducción), Charla, Histórico.
- **Vacío**: "Tu entrenador aún no ha compartido nada para esta jornada."
- **Errores**: recurso revocado → desaparece; enlace caducado.
- **A11y**: descripción textual de la jugada centrada en su rol ("Tú (11): te quedas de vigilancia en la izquierda").

### P16 — Configuración de equipo y permisos
- **Objetivo**: controlar quién ve y hace qué.
- **Componentes**: datos del equipo, campo (dimensiones), preferencias del motor (intensidades, lateralidad, plantillas por defecto, "revisar siempre"), miembros (invitar, rol, revocar), permisos finos, menores y consentimientos, retención de audio, exportar/eliminar datos.
- **Errores**: no se puede quitar al último entrenador principal.
- **A11y**: tablas con encabezados; confirmaciones explícitas para acciones destructivas.

## 5. Wireframes (baja fidelidad)

### Móvil — Jornada (P06)
```
┌─────────────────────────────┐
│ J5 · UD Rival      Dom 11/10│
│ 🏟 Campo Municipal · 11:30  │
│ ███████░░░  5/9 preparado   │
├─────────────────────────────┤
│ ✔ Convocatoria   16 jug.    │
│ ✔ Once           4‑3‑3      │
│ ✔ Jugadas        2 córners  │
│ ✔ Rival          7 notas    │
│ ○ Notas entreno.            │
│ ✔ Objetivos                 │
│ ○ Charla         Preparar › │
│ ○ Compartido                │
├─────────────────────────────┤
│          ( 🎙 )             │
│ Inicio Jornadas Plant. Jug. │
└─────────────────────────────┘
```

### Móvil — Revisión (P11)
```
┌─────────────────────────────┐
│  [ campo con propuesta ]    │
│                             │
├─────── hoja 60 % ───────────┤
│ "Para el domingo vamos a    │
│  jugar ▁4‑3‑3▁. En portería │
│  ▁Pablo▁, centrales ▁Mateo y│
│  Diego▁ …"                  │
│ ─────────────────────────── │
│ ☑ Sistema 4‑3‑3             │
│ ☑ Portero: Pablo (1)        │
│ ☑ Centrales: Mateo (izq.),  │
│   Diego (der.)  · inferido  │
│ …                           │
│ ? ¿Qué Álvaro?              │
│  (●) Álvaro Castro (9) DEL  │
│  ( ) Álvaro Ruiz (14) MC    │
│ [Descartar]   [Aplicar ✔]   │
└─────────────────────────────┘
```

### Tableta — Editor ABP (P08): ver 17 §2.

## 6. Microcopys clave

| Situación | Texto |
|---|---|
| Propuesta | "Propuesta — no lo has dicho tú. Toca para cambiar." |
| Fuera de cobertura | "No sé convertir «…» en una acción. Prueba: «que el 9 ataque el primer palo». ¿Lo guardo como nota?" |
| Regla de reglamento | "Reglamento (Regla 17): los rivales deben estar a 9,15 m hasta el saque." |
| Recomendación | "Recomendación (configurable): no queda nadie de vigilancia." |
| Bloqueo | "Bloqueo sin contacto y parado. La legalidad la decide el árbitro." |
