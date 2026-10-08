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

## ADR‑006 — STT tras adaptador; Deepgram por defecto, Whisper autohospedado opcional
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

## Revisión de contradicciones entre decisiones (iteración 7)

| Posible contradicción | Resolución |
|---|---|
| "Servidor autoritativo" vs "edición offline" | El cliente aplica en local; el servidor reaplica el IR al sincronizar; conflictos por revisión |
| "Sin IA generativa" vs STT con modelos neuronales | El STT solo transcribe; su salida es texto editable y nunca ejecuta nada sin pasar por la gramática determinista |
| "Exportar animaciones a PPTX" vs viabilidad | Secuencia de diapositivas por fase (V1), vídeo/GIF (V1.5) |
| "Jugadas reproducibles" vs "motor que evoluciona" | Documentos con coordenadas resueltas + versión de motor; migraciones explícitas |
| "Privado por defecto" vs "compartir análisis" | Extractos seleccionados, nunca el análisis completo |
