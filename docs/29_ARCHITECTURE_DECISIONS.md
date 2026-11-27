# 29 — Decisiones de arquitectura (ADR)

Formato breve: contexto · decisión · alternativas · consecuencias. Estado: **Propuesta** (todas) hasta el inicio de construcción.

## ADR‑001 — Motor táctico determinista sin IA generativa
- **Contexto**: requisito fundamental del encargo; reproducibilidad, explicabilidad, coste y privacidad.
- **Decisión**: plantillas declarativas + reglas tipadas + algoritmos específicos (húngaro, planificador temporal) en TypeScript puro (15 §2).
- **Alternativas**: LLM (descartado por principio), Drools/CLIPS/json‑rules‑engine (no aporta geometría), CP‑SAT (opaco, pesado; V2 para sugerencias), Prolog (mantenibilidad).
- **Consecuencias**: cobertura limitada al catálogo; coste de autoría de plantillas; total control y pruebas exhaustivas.

## ADR‑002 — Interpretación por gramática de marcos propia (FCSG)
- **Contexto**: transformar español hablado de dominio a IR sin modelos estadísticos.
- **Decisión**: normalización + gazetteers + marcos con huecos tipados y orden flexible, compilados a TS (16 §3–5).
- **Alternativas**: Rasa NLU (estadístico, Python, reentrenamientos no deterministas), spaCy Matcher (Python, no en navegador), PEG puro (frágil con habla natural).
- **Consecuencias**: funciona igual en cliente y servidor y sin conexión; requiere corpus y mantenimiento de reglas; ampliación incremental medible.

## ADR‑003 — Motor y NLU isomórficos (cliente + servidor)
- **Decisión**: los paquetes `engine` y `nlu` se ejecutan en el navegador (edición instantánea, offline) y en la API (validación autoritativa con la misma versión).
- **Consecuencias**: control de versiones estricto (`X-Engine-Version`); el servidor no confía en el documento del cliente: reaplica el IR.

## ADR‑004 — TypeScript de extremo a extremo; NestJS para la API
- **Alternativas**: FastAPI (Python), Supabase solo cliente.
- **Motivo**: un lenguaje, reutilización del motor, ecosistema de exportación (PptxGenJS, Playwright). Python solo en el worker opcional de Whisper.

## ADR‑005 — PostgreSQL gestionado en la UE (Supabase) con RLS como segunda barrera
- **Motivo**: relacional + JSONB, Auth y Storage incluidos, coste bajo, PostgreSQL estándar (salida fácil). La API aplica permisos; RLS limita el daño de un fallo.
- **Consecuencias**: dependencia moderada de Supabase Auth/Storage, aislada tras interfaces.

## ADR‑006 — STT tras adaptador; Deepgram por defecto, Whisper autohospedado opcional *(en suspenso por ADR‑016)*
- **Motivo**: *keyterm prompting* con nombres de la plantilla; precio por minuto bajo; alternativa de privacidad total.
- **Consecuencias**: dos integraciones que mantener; suite de campo para comparar WER periódicamente; precios a confirmar con el proveedor.

## ADR‑007 — Coordenadas normalizadas en marco de ataque; cálculo en metros
- **Motivo**: independencia de pantalla y orientación; consistencia métrica de órdenes ("un metro"); lateralidad del lenguaje del entrenador.
- **Consecuencias**: transformaciones de vista en el renderer; zonas definidas una vez (lado izquierdo) y reflejadas.

## ADR‑008 — SVG para el campo y la animación
- **Alternativas**: Konva (plan B), PixiJS (descartado).
- **Motivo**: ≤ 30 actores, accesibilidad, exportación vectorial a PDF/PPTX, mismo renderer en exportador.

## ADR‑009 — Versiones inmutables de jugadas con coordenadas resueltas + log de comandos
- **Motivo**: las jugadas antiguas no cambian al actualizar el motor; deshacer/rehacer y auditoría exactos.
- **Consecuencias**: almacenamiento mayor (≈ 8 KB/versión), irrelevante a la escala prevista.

## ADR‑010 — Lo no dicho se marca como propuesta (provenance obligatoria)
- **Motivo**: principio "no inventar"; confianza del entrenador.
- **Consecuencias**: cada campo relevante lleva `provenance`; la UI lo representa (discontinuo).

## ADR‑011 — Análisis de rivales y charlas extractivos
- **Motivo**: el sistema no debe añadir observaciones ni recomendaciones no expresadas.
- **Consecuencias**: el texto de los informes es el del entrenador; la "inteligencia" está en clasificar, etiquetar, ordenar y detectar conflictos.

## ADR‑012 — Exportación: PptxGenJS (formas nativas) + PDF desde HTML con Playwright
- **Motivo**: editabilidad en PowerPoint; fidelidad PDF = vista previa; reproducibilidad por `input_hash`.

## ADR‑013 — Cola de trabajos en PostgreSQL (pg‑boss)
- **Motivo**: evitar Redis en el MVP; transaccionalidad con los datos.
- **Revisión**: si la cola supera ~50 jobs/s sostenidos.

## ADR‑014 — PWA en lugar de apps nativas en el MVP
- **Motivo**: un código; actualizaciones instantáneas (crítico por la sincronía de `engine_version`); micrófono y offline disponibles en navegadores modernos.
- **Riesgo**: limitaciones de iOS (push y almacenamiento); revisión para V2 (empaquetado con Capacitor si hiciera falta).

## ADR‑015 — Piloto acotado antes de V1
- **Motivo**: 23 §1 — la V1 completa supera las 26 semanas; validar la hipótesis de voz con córners y alineaciones primero.

## ADR‑016 — Aplazar la voz; MVP con edición manual y asistente (26/11/2026)
- **Contexto**: decisión de producto de lanzar antes y sin coste ni riesgo de STT.
- **Decisión**: se aplazan grabación, transcripción y análisis por audio. La creación de jugadas usa un asistente de formulario que emite comandos IR (`command-ir.schema.json`, `source: MANUAL`) y la edición es directa sobre el campo. Queda en suspenso ADR‑006. ADR‑002/003 (gramática) quedan supeditados a la opción B de 23 §0.
- **Consecuencias**: el diferencial inicial pasa a ser el motor (propuestas explicables, reglas, animación) y el flujo jornada → charla. El riesgo R01 (cobertura de voz) desaparece del MVP y R02/R11 dejan de aplicar. La voz se reincorpora como otra fuente del mismo IR.

## ADR‑017 — Asistente conversacional con Claude que emite comandos IR (26/11/2026)
- **Contexto**: el entrenador quiere iterar en lenguaje natural "como con Claude"; la voz está aplazada.
- **Decisión**: capa de chat en el servidor que llama a la API de Anthropic con herramientas cuyo esquema es `command-ir.schema.json`. El modelo solo propone comandos; el motor determinista los valida y aplica sobre un borrador, y el entrenador acepta o deshace. Se guarda el IR de cada turno.
- **Alternativas**: gramática FCSG escrita (opción B; queda como futura alternativa sin coste ni conexión), LLM que genere coordenadas o HTML directamente (descartado: no reproducible, puede inventar, no se puede validar).
- **Consecuencias**: coste variable por turno (31 §5), dependencia de red para el chat, un nuevo subencargado de tratamiento. El editor manual sigue siendo completo, así que el LLM no es requisito para ejecutar jugadas.

## ADR‑018 — Escenas de fases de juego calculadas por parámetros y exportadas como HTML autónomo (26/11/2026)
- **Decisión**: las fases dinámicas (presión, repliegue, vigilancias) se modelan como fotogramas de estado del balón y parámetros de bloque, con posiciones calculadas por reglas (32 §3); se exportan como un único HTML con el mismo renderer.
- **Alternativa descartada**: que un LLM genere el HTML de cada escena (sin garantías de coherencia ni del mismo resultado).

## ADR‑019 — MVP: Fastify y SPA con Vite en lugar de NestJS y Next.js (26/11/2026)
- **Contexto**: al construir, NestJS exige metadatos de decoradores (`emitDecoratorMetadata`) que el compilador rápido usado en desarrollo y pruebas (esbuild/tsx) no genera. Next.js añade renderizado en servidor que el MVP no necesita: el motor se ejecuta en el navegador.
- **Decisión**: API en **Fastify 5** (esquemas JSON en cada ruta, mismo TypeScript y el mismo motor que el cliente) y web como **SPA de React con Vite** servida por el propio servidor. Sustituye la elección de ADR‑004 en cuanto a framework (el resto se mantiene: TypeScript de extremo a extremo, motor isomórfico).
- **Consecuencias**: menos código y un solo proceso en producción. Si más adelante hace falta SEO o renderizado en servidor, se puede migrar la web a Next.js sin tocar la API.

## ADR‑020 — MVP: login propio con email y contraseña (26/11/2026)
- **Contexto**: Supabase Auth (ADR‑005) obliga a depender de un servicio externo también en desarrollo y pruebas.
- **Decisión**: contraseñas con scrypt, sesión opaca en cookie `httpOnly` (`SameSite=Lax`, `Secure` en producción) y tabla `user_session` con el hash del token. PostgreSQL puede seguir siendo el de Supabase.
- **Pendiente antes de abrir al público**: recuperación de contraseña por email, límite de intentos de login y verificación del email.

## ADR‑021 — Una interfaz, dos anfitriones: página de Claude y servidor propio (27/11/2026)
- **Contexto**: el entrenador quiere afinar la herramienta ya, sin servidor, pero el producto debe poder venderse y escalar ("que solo haya que engancharlo").
- **Decisión**: Pizarra Studio (`packages/web/src/studio`) solo habla con cuatro puertos (`TeamPort`, `StorePort`, `AiPort`, `ExportPort`). `hosts/artifact.ts` los implementa con las capacidades de la página de Claude (`db`, `sample`, `downloads`); `hosts/server.ts` con la API (`/api/teams/:id/studio/*`). El bucle del asistente y sus espacios de trabajo están en `@fcs/assistant`, compartido por el navegador y el servidor; la validación IR usa un validador precompilado sin `eval`.
- **Alternativas**: dos aplicaciones (descartado: se separan con el tiempo); solo servidor (retrasa el uso real hasta contratar el alojamiento).
- **Consecuencias**: el mismo código se prueba en los dos modos; conectar el servidor es cambiar el anfitrión. En la página de Claude los datos de la RFFM van embebidos (instantáneo con fecha) y la plantilla se guarda en `db`.

## ADR‑022 — El asistente en la página de Claude usa `sample` con herramientas (27/11/2026)
- **Contexto**: sin servidor no hay clave de la API; la página puede preguntar a Claude con la cuenta de quien la usa.
- **Decisión**: `AiPort` de la página llama a `sample` con las herramientas del espacio de trabajo (`apply_commands`, `create_setpiece`, `update_scene`, `ask_coach`), cuyo `execute` es el motor en el navegador. Si la vista no ofrece herramientas, plan B: `sample.json` con un único comando validado en local y un reintento.
- **Consecuencias**: el coste lo asume quien usa la página (no escala como producto: por eso ADR‑021); el modelo nunca coloca jugadores, solo emite comandos que el motor valida, igual que en el servidor (ADR‑017).

## ADR‑023 — Una secuencia y un reproductor para la app y el HTML exportado (27/11/2026)
- **Contexto**: el entrenador quiere que la app muestre las jugadas como el HTML de la J5 (pasos, «AHORA», solo las flechas del paso actual, ◀ Atrás, ficha) y que pueda producir ese HTML. Antes había un dibujo en la app y otro distinto en la exportación, con todas las flechas a la vez.
- **Decisión**: todas las piezas (pizarra, balón parado, planes) se convierten en una secuencia `fcs.seq/1` (`sequenceOfBoard`, `sequenceOfPlay`, `sequenceOfScene`) con pasos discretos (`beat`, `txt`, `trig`, `pos`, `runs`, `passes`, `blocks`). Un único reproductor autocontenido (`createPlayer`, `@fcs/render`) la pinta en la pestaña «Ver» y se incrusta tal cual (`playerSource`) en el HTML de la carpeta del partido (`renderDossierHtml`). La ficha la propone el motor (`proposeSheet`) y la edita el entrenador o el asistente (`set_sheet`); se guarda con la pieza. La carpeta se construye en el cliente para los dos anfitriones y el puerto de exportación solo guarda el HTML (`saveHtml`). Las reglas fijas se guardan con el equipo (`studio/settings` en la página; `GET|PUT /teams/:id/studio/settings`, migración 0004).
- **Alternativas**: mantener el exportador por pistas continuas (descartado: no da pasos discretos ni «AHORA»); generar la carpeta en el servidor (descartado por ahora: duplicaría el código del cliente).
- **Consecuencias**: lo que ve el entrenador en «Ver» es exactamente lo que reciben los jugadores. El HTML pesa más (escudo y foto embebidos) pero funciona sin conexión. `GET /studio/items/:id/export.html` del servidor sigue con el formato anterior hasta que se migre.

## Revisión de contradicciones entre decisiones (iteración 7)

| Posible contradicción | Resolución |
|---|---|
| "Servidor autoritativo" vs "edición offline" | El cliente aplica en local; el servidor reaplica el IR al sincronizar; conflictos por revisión |
| "Sin IA generativa" vs STT con modelos neuronales | El STT solo transcribe; su salida es texto editable y nunca ejecuta nada sin pasar por la gramática determinista |
| "Exportar animaciones a PPTX" vs viabilidad | Secuencia de diapositivas por fase (V1), vídeo/GIF (V1.5) |
| "Jugadas reproducibles" vs "motor que evoluciona" | Documentos con coordenadas resueltas + versión de motor; migraciones explícitas |
| "Privado por defecto" vs "compartir análisis" | Extractos seleccionados, nunca el análisis completo |
