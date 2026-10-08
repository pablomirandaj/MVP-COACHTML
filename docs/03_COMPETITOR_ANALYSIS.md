# 03 — Análisis de competencia

## 1. Método

- Fuentes: fichas oficiales de tiendas, páginas de precios del fabricante o revendedor, y agregadores (marcados).
- Leyenda de la matriz: **✔** verificado en fuente · **✘** la fuente describe el producto y no lo incluye · **?** no verificado (no encontrado ni descartado) · **~** parcial.
- Regla aplicada: *no se afirma que un competidor carece de una función sin evidencia*. Donde no hay evidencia se marca **?**.

## 2. Competidores analizados

| Producto | Categoría | Plataforma | Precio publicado | Fuente |
|---|---|---|---|---|
| **TacticalPad** | Pizarra táctica + animación 2D/3D | iOS, Android, escritorio | 24,99 USD/año (App Store, ficha "Coach's Whiteboard"); 19,99 en otra ficha | [App Store](https://apps.apple.com/app/id512949303), [ficha baloncesto](https://apps.apple.com/app/id538807945) |
| **Coach Paint (Tracab/ChyronHego)** | Telestración sobre vídeo, Pro y Lite | Escritorio | Bajo presupuesto; Lite mensual/anual online | [Chyron](https://chyron.com/products/uncategorized/coach-paint), [SVG Europe](https://www.svgeurope.org/blog/news-roundup/tracab-launches-coach-paint-lite/) |
| **KlipDraw** | Telestración sobre vídeo | Windows (Mac según AlternativeTo) | 65 / 130 / 350 £ año + IVA | [AnalysisPro](https://www.analysispro.com/klipdraw) |
| **Sport Session Planner** | Planificación de sesiones, 3D y animación | Web | 75 USD/año individual; club por presupuesto | [SSP](https://www.sportsessionplanner.com/register.mpl?a=step1) |
| **Hudl** | Vídeo, análisis, estadísticas | Web, apps | 400–1.600 USD/equipo/año (EE. UU./Canadá) | [Hudl](https://www.hudl.com/pricing/club/soccer) |
| **Metrica Sports (PlayBase/Nexus)** | Vídeo + telestración + tracking | Escritorio/web | Sin precio oficial encontrado; terceros 8–200 USD/mes | [SoftwareSuggest](https://www.softwaresuggest.com/metrica-sports) (tercero) |
| **FootballGPT** | Planificador de sesiones con IA generativa y diagramas animados | Web | Pro 2,99 USD/semana (página propia); 1 mensaje gratis/día | [footballgpt.co](https://footballgpt.co/features/plan-to-animation) |
| **Spond / TeamSnap / SportEasy** | Gestión de equipo, convocatorias, disponibilidad | Apps | Spond gratis (comisión en pagos); TeamSnap gratis–9,99 USD/mes; SportEasy compras 7,99–11,99 € | [Spond](https://www.spond.com/en-us/news-and-blog/soccer-team-management-app/), [Capterra](https://www.capterra.com/p/123208/TeamSnap/pricing/) |
| **Pizarras gratuitas** (Renderfoot, Fútbol Táctica Pizarra, Tactics Board) | Dibujo de formaciones | Web/apps | Gratis | [Renderfoot](https://www.renderfoot.com/es/tactical-board) |

## 3. Matriz de capacidades

| Capacidad | TacticalPad | Coach Paint | KlipDraw | SSP | Hudl | FootballGPT | Spond/TeamSnap | **FCS (diseño)** |
|---|---|---|---|---|---|---|---|---|
| Dibujar jugadas | ✔ | ✔ (sobre vídeo) | ✔ (sobre vídeo) | ✔ | ~ (telestración) | ✔ | ✘ | ✔ |
| Animar movimientos | ✔ (2D/3D) | ✔ | ✔ (Animate/Motion) | ✔ | ? | ✔ | ✘ | ✔ 2D |
| Gestionar plantilla | ✔ (nombre, dorsal, posición, alineación) | ✘ | ✘ | ? | ✔ | ? | ✔ | ✔ (ficha completa, pierna, roles ABP) |
| Planificar partidos (jornadas) | ? | ✘ | ✘ | ? | ✔ (calendario) | ✘ | ✔ (eventos) | ✔ (espacio por jornada) |
| Analizar rivales | ? | ~ (vídeo) | ~ (vídeo) | ? | ✔ (vídeo/estadística) | ✘ | ✘ | ✔ (fichas estructuradas e histórico) |
| Exportar presentaciones | ✔ (documento con imágenes y notas, vídeo) | ✔ (salidas broadcast) | ✔ (vídeo) | ✔ (PDF) | ? | ? | ✘ | ✔ (PPTX editable, PDF, imágenes) |
| Compartir | ✔ (Drive, Dropbox, OneDrive) | ? | ? | ✔ | ✔ | ? | ✔ | ✔ (por elemento, con roles) |
| Control de permisos por rol | ? | ? | ? | ~ (clubes) | ✔ | ? | ✔ | ✔ |
| Comandos de voz | ? (no encontrado) | ? (no encontrado) | ? (no encontrado) | ? (no encontrado) | ? (no encontrado) | ✘ (texto/chat) | ✘ | ✔ |
| Generación por lenguaje natural | ✘ | ✘ | ✘ | ? | ? | ✔ (**IA generativa**) | ✘ | ✔ (**gramática determinista**) |
| Seguimiento automático en vídeo | ✘ | ✔ (Pro) | ✔ (Motion) | ✘ | ✔ | ✘ | ✘ | ✘ (fuera de alcance) |

## 4. Observaciones por competidor

- **TacticalPad**: el competidor más cercano en pizarra. Fuerte en animación, 3D, multideporte y biblioteca de sesiones. La sincronización en la nube se apoya en repositorios del usuario (Drive/Dropbox/OneDrive), no en un espacio compartido de equipo con roles (no se encontró evidencia de lo contrario). **Hueco**: flujo por jornada/rival y entrada por voz.
- **Coach Paint / KlipDraw / Metrica**: herramientas de vídeo. Otro trabajo y otro precio. No son sustitutos para el entrenador amateur sin vídeo, pero sí lo son en semiprofesional. FCS no compite en vídeo; V2 contempla importar capturas o enlaces.
- **Sport Session Planner**: centrado en sesiones de entrenamiento con 3D. Adquirido por The Coaches' Voice ([nota](https://learning.coachesvoice.com/cv/coaches-voice-acquires-sport-session-planner/)), lo que le da contenido y audiencia. **Hueco**: preparación de partido y rival.
- **Hudl**: estándar en vídeo/estadística; precio fuera del alcance del amateur y oferta de club limitada a EE. UU./Canadá en la página consultada.
- **FootballGPT**: valida la demanda de "describir → diagrama animado", pero con IA generativa: resultados no garantizados ni reproducibles. Es el **contraste** que FCS debe comunicar: *mismo comando, mismo resultado, y nada inventado*.
- **Gestión (Spond, TeamSnap, SportEasy)**: resuelven disponibilidad y comunicación. FCS integrará disponibilidad básica y no competirá en pagos/cuotas.

## 5. Implicaciones para FCS

1. **Diferenciación defendible**: voz + determinismo + jornada como unidad + charla generada. Ninguno de los productos revisados reúne las cuatro.
2. **Paridad mínima obligatoria**: dibujar, animar, plantilla, exportar e invitar. Sin esto, la voz no compensa.
3. **No competir** en vídeo ni en 3D en V1.
4. **Riesgo**: un incumbente puede añadir voz. Respuesta: la ventaja está en la ontología, la gramática, el corpus de entrenadores y la integración del flujo semanal, no en la transcripción (que es una mercancía).
5. **Precio**: entre las pizarras (20–75 USD/año) y por debajo de vídeo; plan Club por equipo como en Hudl/SSP.

## 6. Pendientes de verificación manual (BK‑000)

Probar en dispositivo, antes del lanzamiento: TacticalPad, SSP, Tactics Board, Bcoach, Fútbol Táctica Pizarra, SportEasy y FootballGPT, comprobando específicamente voz, permisos por rol y exportación PPTX editable. Actualizar la matriz con fecha.
