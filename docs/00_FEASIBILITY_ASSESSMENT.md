# 00 — Evaluación de viabilidad

> Iteración 1. Este documento responde primero a la pregunta "¿se puede construir?" antes de especificar nada. Sus conclusiones condicionan el resto del paquete.

## 1. Pregunta central

¿Puede un entrenador describir verbalmente una alineación o una jugada a balón parado y obtener una representación correcta, editable y reproducible **sin IA generativa** en la cadena de interpretación y ejecución?

**Respuesta: sí, con una condición explícita.** Es viable si el producto acepta que:

1. La comprensión se limita a un **lenguaje controlado** del dominio (≈40 operaciones, ≈300 patrones de superficie en el MVP), no a "cualquier frase en español".
2. Toda interpretación pasa por una **pantalla de revisión** antes de modificar datos cuando hay ambigüedad, y siempre es deshacible.
3. Las jugadas se construyen a partir de **plantillas parametrizables + reglas por defecto**, no se "imaginan". Lo que el entrenador no dice lo completa una regla configurable y se marca visualmente como *propuesta*.

Bajo esas condiciones el problema deja de ser de "comprensión del lenguaje" y pasa a ser de **ingeniería de gramáticas, ontología y restricciones espaciales**, que es un problema resuelto y verificable.

## 2. Descomposición técnica y viabilidad por capa

| Capa | Técnica elegida | Madurez | Viabilidad | Riesgo principal |
|---|---|---|---|---|
| 1. Captura | MediaRecorder (navegador), Opus/WebM, máx. 120 s | Alta | Alta | Safari iOS: formato `audio/mp4`; se acepta ambos |
| 2. Transcripción | STT gestionado con *keyterm prompting* (nombres de la plantilla) tras adaptador; alternativa autohospedada faster‑whisper | Alta | Alta | Nombres propios poco frecuentes; ruido de campo |
| 3. Interpretación | Pipeline determinista: normalización → gazetteer (plantilla, términos) → gramática de marcos (DSL FCSG) → *slot filling* → IR JSON | Media (diseño propio) | Alta en dominio acotado | Cobertura lingüística; coloquialismos |
| 4. Validación | Motor de restricciones en TypeScript (reglas con id, categoría, severidad) | Alta | Alta | Diseño correcto de severidades |
| 5. Ejecución | Funciones puras sobre documento de jugada; asignación de roles por algoritmo húngaro | Alta | Alta | Calidad táctica de las plantillas por defecto |
| 6. Representación | SVG + motor de línea temporal propio | Alta | Alta | Rendimiento en móviles gama baja (acotado: ≤ 23 actores) |
| 7. Persistencia | PostgreSQL, versiones inmutables JSONB + log de comandos | Alta | Alta | — |

Conclusión: **ninguna capa requiere investigación abierta**; la incertidumbre está en la *cobertura lingüística* (capa 3) y en la *calidad táctica de los valores por defecto* (capa 5). Ambas son incrementales y medibles.

## 3. Lo que NO es viable (y no se promete)

- Entender instrucciones arbitrarias fuera del vocabulario. El sistema dirá "no he entendido *X*" y ofrecerá la formulación soportada más cercana.
- Garantizar la legalidad arbitral de un bloqueo: la Regla 12 sanciona *impedir el avance de un adversario* y la valoración es del árbitro. El motor solo modela un **bloqueo posicional** con restricciones (llegar antes, permanecer estático, sin contacto) y advierte del riesgo.
- Simulación física o predicción de resultados. Los patrones no garantizan nada; se representan como intención táctica.
- Importar automáticamente calendarios federativos: no se ha encontrado una API pública documentada de las federaciones territoriales (ver 02). Se ofrece CSV/Excel/ICS y alta manual.

## 4. Riesgos principales (resumen; detalle en 28)

| Id | Riesgo | Prob. | Impacto | Mitigación clave |
|---|---|---|---|---|
| R01 | Cobertura de comandos insuficiente → frustración | Alta | Alto | Lenguaje controlado + sugerencias + edición manual siempre disponible + corpus de pilotos |
| R02 | Errores de transcripción en nombres | Media | Alto | *Keyterms* con la plantilla, emparejamiento fonético, confirmación de nombres dudosos |
| R03 | Valores por defecto tácticamente pobres | Media | Alto | Biblioteca validada por asesor UEFA‑B/A; propuestas marcadas y editables |
| R04 | Alcance V1 demasiado amplio | Alta | Alto | Piloto acotado de 12 semanas (23) |
| R05 | Datos de menores | Alta (fútbol base) | Alto | Consentimiento parental < 14 años (LOPDGDD art. 7), minimización, sin enlaces públicos con datos de menores |
| R06 | Competencia añade voz o IA generativa | Media | Medio | Diferenciación por determinismo, fiabilidad y flujo jornada→charla |
| R07 | Exportación PPTX editable con calidad profesional | Media | Medio | PptxGenJS con formas nativas; pruebas visuales |

## 5. Viabilidad económica (detalle en 26)

- Coste variable dominante: transcripción. Con tarifas de mercado publicadas por terceros de ~0,003–0,006 USD/min, un entrenador que dicte 30 min/mes cuesta < 0,20 USD/mes en STT.
- Infraestructura MVP: 150–400 €/mes hasta ~2.000 entrenadores activos.
- Desarrollo: piloto ≈ 12 semanas con 3,5 FTE; V1 completa ≈ 26–30 semanas acumuladas.
- Referencias de precio del mercado: herramientas de pizarra 20–75 USD/año (TacticalPad, Sport Session Planner), plataformas de vídeo 400–1.600 USD/equipo/año (Hudl). FCS se sitúa en el tramo de pizarra+gestión (≈ 60–90 €/año por entrenador).

## 6. Decisión

**Go**, con tres condiciones de salida del piloto (medidas en 22 y 23):

1. ≥ 85 % de las órdenes del corpus piloto producen el IR esperado sin edición (o con una sola aclaración).
2. Un entrenador prepara alineación + 2 córners + notas de rival + charla PDF en ≤ 20 min la primera vez y ≤ 10 min a partir de la tercera jornada.
3. 0 cambios silenciosos: cada modificación aplicada corresponde a un comando confirmado o inequívoco (verificado por auditoría del log de comandos).

## 7. Revisión de contradicciones del enunciado

Se detectaron y resolvieron estas tensiones del encargo:

| Tensión | Resolución |
|---|---|
| El ejemplo 4.1 define a Lucas (dorsal 7) como **zurdo**; el ejemplo 6.3 dice "Lucas, que es diestro". | El motor **no sobrescribe la ficha**: detecta el conflicto y pregunta (ver escenario 2 en 08). Es el caso de prueba T‑CRN‑04. |
| "Bloqueo legal" vs. Regla 12 (impedir el avance sin contacto = tiro libre indirecto). | Se modela "bloqueo posicional" con advertencia de riesgo arbitral; no se afirma legalidad. |
| V1 "imprescindible" incluye 14 bloques funcionales. | No cabe en un primer ciclo con un equipo pequeño. Se define un **Piloto** (23) y V1 completa después. |
| Exportar animaciones a PPTX. | PPTX no reproduce animaciones de trayectoria de forma fiable al generarse programáticamente; V1 exporta **secuencia de diapositivas por fase**; vídeo/GIF en V1.5. |
| Importación desde "fuente pública autorizada". | Sin API pública verificada; se deja como integración V2 sujeta a acuerdo con la federación correspondiente. |
