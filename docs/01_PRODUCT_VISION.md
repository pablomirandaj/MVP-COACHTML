# 01 — Visión de producto

## 1. Problema

El entrenador de fútbol 11 amateur, semiprofesional o de fútbol base prepara cada semana un partido con herramientas dispersas:

- La plantilla y la disponibilidad en grupos de mensajería o apps de gestión (Spond, SportEasy, TeamSnap).
- La pizarra en papel, en una app de dibujo táctico o en PowerPoint.
- Las notas del rival en libretas, audios de WhatsApp o en la memoria.
- La charla en folios o en una presentación hecha a mano la noche anterior.

Consecuencias observables: 1–3 horas semanales de trabajo administrativo, información del rival que se pierde de una temporada a otra, jugadas a balón parado mal comunicadas, y charlas improvisadas.

## 2. Usuario objetivo

| Persona | Contexto | Necesidad principal | Restricción |
|---|---|---|---|
| **Javi, primer entrenador regional/preferente** (35–55 años) | Trabaja por la mañana, entrena 3 tardes, partido en fin de semana | Preparar el partido rápido desde el móvil | Poco tiempo, poca paciencia con software complejo |
| **Laura, coordinadora de fútbol base** | Club con 12 equipos, muchos menores | Que los entrenadores compartan contenido de forma segura | Protección de datos de menores |
| **Andrés, segundo entrenador / analista** | Ve vídeos del rival, toma notas | Registrar observaciones y que no se pierdan | Que el primero vea y apruebe |
| **Hugo, jugador (17–30 años)** | Mira el móvil antes del partido | Saber si está convocado, su rol y las jugadas | Solo quiere lo suyo, claro |

## 3. Propuesta de valor

> **"Dilo como se lo dirías a tu segundo. Football Coach Studio lo dibuja, lo guarda y se lo enseña a tu equipo."**

Tres pilares:

1. **Voz fiable, no mágica.** Dictado → interpretación revisable → representación. El sistema nunca inventa: lo que no se dijo aparece como *propuesta* diferenciada.
2. **La jornada como unidad de trabajo.** Cada partido tiene su espacio: convocatoria, once, jugadas, rival, charla. Todo se recupera la temporada siguiente contra el mismo rival.
3. **De la pizarra a la charla en un clic.** Lo preparado durante la semana genera la presentación prepartido exportable y compartible.

## 4. Posicionamiento

| Eje | Pizarras (TacticalPad, SSP) | Vídeo (Hudl, KlipDraw, Coach Paint) | Gestión (Spond, SportEasy) | **FCS** |
|---|---|---|---|---|
| Dibujo y animación táctica | Sí | Sobre vídeo | No | Sí (2D, orientado a balón parado) |
| Flujo por jornada y rival | Parcial/no | Parcial | Calendario sin táctica | **Sí, núcleo** |
| Entrada por voz con comandos | No encontrado | No encontrado | No | **Sí, núcleo** |
| Charla prepartido generada | Exporta documentos | No es su foco | No | **Sí** |
| Precio orientativo | 20–75 USD/año | 400–1.600 USD/equipo/año (Hudl) | Gratis–bajo | 60–90 €/año entrenador |

FCS no compite en análisis de vídeo (V2 como integración) ni en gestión económica del club.

## 5. Principios de producto

1. **Determinismo**: misma entrada + misma versión de motor + mismos datos = mismo resultado.
2. **Nada silencioso**: toda modificación es visible, atribuible y deshacible.
3. **Explicabilidad**: cada colocación o advertencia muestra la regla que la produjo ("Regla CRN‑POS‑03: vigilancia a ≥ 30 m de portería rival").
4. **El entrenador manda**: decisión expresa > preferencia del equipo > regla por defecto.
5. **Móvil primero, editor en tableta**: el móvil sirve para dictar, revisar y compartir; el editor fino brilla en tableta/ordenador.
6. **Privado por defecto**: análisis de rivales y borradores nunca se comparten sin acción explícita.

## 6. Métricas norte (North Star e indicadores)

- **North Star**: *jornadas preparadas por semana* (jornada con once + ≥1 jugada o análisis + charla generada).
- Activación: % de nuevos entrenadores que crean once por voz en la primera sesión (objetivo ≥ 50 %).
- Precisión de voz: % de comandos aplicados sin corrección manual (objetivo piloto ≥ 85 %).
- Retención: % de entrenadores activos en la semana 8 (objetivo ≥ 40 %).
- Tiempo de preparación de jornada (objetivo ≤ 10 min desde la tercera jornada).

## 7. Modelo de negocio (hipótesis a validar en el piloto)

| Plan | Precio | Límite |
|---|---|---|
| Gratis | 0 € | 1 equipo, 3 jugadas guardadas, 20 min de voz/mes, exportación PDF con marca de agua |
| Entrenador | 7,99 €/mes o 69 €/año | 2 equipos, ilimitado, 300 min voz/mes, PPTX, compartir con jugadores |
| Club | 4 €/equipo/mes (mín. 5 equipos) | Administración, permisos, plantillas de marca del club, consentimientos de menores |

## 8. Fuera de alcance explícito

Análisis de vídeo, estadísticas avanzadas, pagos y cuotas, fichajes, rendimiento físico/GPS, fútbol 7/futsal (V2), cualquier funcionalidad que genere contenido táctico mediante modelos generativos.
