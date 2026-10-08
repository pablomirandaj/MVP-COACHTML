# 30 — Resumen ejecutivo

## Qué es

**Football Coach Studio** es una aplicación para entrenadores de fútbol 11 amateur, semiprofesional y de base que convierte lo que el entrenador **dice** en alineaciones, jugadas a balón parado animadas, informes de rivales y charlas prepartido listas para compartir con el equipo. Flujo: **Hablar → Revisar → Visualizar → Ajustar → Guardar → Compartir**.

## Por qué puede ganar

- Ninguna de las herramientas revisadas (TacticalPad, Sport Session Planner, Hudl, KlipDraw, Coach Paint, Metrica, apps de gestión) reúne a la vez voz, motor determinista, la jornada como unidad de trabajo y charla generada (03). La que más se acerca a "describir y dibujar", FootballGPT, usa IA generativa y no garantiza resultados reproducibles.
- Precio objetivo de 69 €/año por entrenador o 4 €/equipo/mes para clubes, en la franja de las pizarras (20–75 USD/año) y muy por debajo del vídeo (400–1.600 USD/equipo/año).

## La respuesta a la pregunta central

> ¿Cómo puede un entrenador describir una jugada y que la app la represente, modifique y reproduzca sin IA generativa?

1. **El STT solo transcribe**. El texto es editable y no ejecuta nada por sí mismo.
2. **Una gramática de marcos (FCSG)** sobre un **lexicón del vocabulario de los entrenadores** convierte el texto en **comandos JSON tipados (IR)**. En el piloto son 27 operaciones con ~180 formas de decirlas; en V1, ~40 operaciones.
3. **Un motor de reglas en TypeScript** aplica esos comandos sobre una **ontología cerrada**: 11 zonas, 17 roles, 13 movimientos y 6 golpeos. Tiene plantillas paramétricas, asignación óptima de jugadores (algoritmo húngaro), temporización relativa al golpeo y 35 reglas de validación separadas en reglamento, técnica y recomendación.
4. **Lo que el entrenador no dice lo completa una regla**, y se dibuja como *propuesta* (trazo discontinuo). Si algo es ambiguo, la app pregunta y enseña cada opción sobre el campo. Nunca hay cambios silenciosos.
5. **Cada comando es local, deshacible y determinista**: la misma orden sobre la misma jugada da siempre el mismo resultado, y se puede comprobar por hash.

La completitud se mide por las **jugadas que el motor puede representar**, no por las frases que entiende. La cobertura lingüística crece después con un corpus real de entrenadores, sin tocar el motor.

## Alcance y plan

| Fase | Duración | Contenido |
|---|---|---|
| Validación | 3 semanas | 15 entrevistas, 100 locuciones reales, asesor táctico, selección de STT |
| **Piloto** | 12 semanas + 8 de uso | Plantilla, once por voz, **córners** por voz con animación, calendario CSV, rival por voz, charla PDF, compartir con jugadores (incluidos menores vía tutores) |
| V1 | +15 semanas | Resto de balón parado, PPTX editable, permisos completos, XLSX/ICS, pagos, pentest |
| V1.5 / V2 | — | Animación avanzada y vídeo, más comandos, plantillas de club / estadística, integraciones, otras modalidades e idiomas |

**Criterios para seguir tras el piloto**:

- ≥ 85 % de las órdenes se aplican sin corrección.
- Una jornada se prepara en ≤ 10 minutos a partir de la tercera.
- 0 cambios silenciosos.
- ≥ 6 de los 10 entrenadores siguen activos en la semana 8.
- Al menos 3 clubes firman una carta de intención.

## Coste

- **Construcción hasta V1**: ≈ 203.000 € (≈ 30 semanas, 3 desarrolladores + diseño y QA a tiempo parcial, con un 15 % de contingencia). La variante con 2 desarrolladores cuesta ≈ 140.000 € y lleva ≈ 42 semanas.
- **Operación**: ≈ 0,26 € por entrenador activo al mes con 2.000 activos, transcripción incluida.
- **Punto de equilibrio**: ≈ 3.400 entrenadores de pago. Por eso el canal de **clubes** es prioritario.

## Principales riesgos

| Riesgo | Mitigación |
|---|---|
| Cobertura de comandos | Corpus desde el día 1; sugerencias; edición manual completa |
| Alcance | Piloto acotado con recortes ya definidos |
| Monetización | Plan Club y club colaborador en el piloto |
| Menores | Tutores, minimización, sin enlaces públicos, EIPD |

## Estado

| Elemento | Estado |
|---|---|
| Diseño completo (31 documentos) | Hecho |
| Esquemas JSON de IR y jugada, OpenAPI y DDL | Validados con herramientas |
| Mockups | Prototipo estático |
| Código | No iniciado; requiere autorización |
| Casos de prueba (39) | Diseñados, no ejecutados |

## Decisión que se solicita

Autorizar la **Fase 0 (3 semanas, ≈ 16.000 €)**. Su resultado (entrevistas, corpus inicial, elección de STT y validación del catálogo de córners) condiciona el Go del piloto.
