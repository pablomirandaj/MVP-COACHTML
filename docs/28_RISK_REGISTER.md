# 28 — Registro de riesgos

Probabilidad (P) e impacto (I) de 1 a 5; exposición = P × I. Estado inicial: todos abiertos.

| Id | Riesgo | Categoría | P | I | Exp. | Mitigación | Indicador | Responsable |
|---|---|---|---|---|---|---|---|---|
| R01 | Cobertura de comandos insuficiente: los entrenadores hablan de formas no previstas | Producto/técnico | 4 | 5 | **20** | Lenguaje controlado + sugerencias; corpus desde la Fase 0; edición manual completa; cola semanal de no entendidas | % exact match del corpus; % fuera de cobertura | Tech lead |
| R02 | STT confunde nombres propios | Técnico | 3 | 4 | 12 | Keyterms de la plantilla; emparejamiento fonético; confirmación FUZZY; apodos | WER de nombres en suite de campo | Tech lead |
| R03 | Valores por defecto tácticamente pobres → desconfianza | Producto | 3 | 4 | 12 | Asesor UEFA B/A; plantillas revisadas; propuestas visibles y editables; preferencias del equipo | Ediciones tras crear por voz; encuestas | Producto |
| R04 | Alcance excesivo; el piloto se retrasa | Gestión | 4 | 4 | **16** | Piloto acotado (23); recortes predefinidos (BK‑065/072); sprints con demo | Burn‑up vs plan | Producto |
| R05 | Incumplimiento en datos de menores | Legal | 2 | 5 | 10 | 21 §5; EIPD; acuerdos con clubes; revisión legal | Auditoría de consentimientos | Producto + legal |
| R06 | Competidor añade voz / IA generativa | Mercado | 3 | 3 | 9 | Diferenciar por fiabilidad, flujo de jornada y charla; foco en clubes | Monitorización trimestral | Producto |
| R07 | PPTX generado no profesional o no editable en todas las suites | Técnico | 3 | 3 | 9 | Formas nativas; pruebas en 3 suites; plantillas diseñadas | Valoración ≥ 4/5 | Tech lead |
| R08 | Rendimiento del editor SVG en móviles de gama baja | Técnico | 2 | 3 | 6 | Presupuesto de nodos; memoización; plan B Konva | fps en benchmark | Tech lead |
| R09 | Dependencia del proveedor STT (precio, disponibilidad, condiciones) | Proveedor | 3 | 3 | 9 | Adaptador con 2 implementaciones; texto como alternativa | Coste/min; incidencias | Tech lead |
| R10 | Uso en campo sin conexión | Técnico | 3 | 3 | 9 | PWA offline; voz en cola; texto local | Errores de sincronización | Tech lead |
| R11 | Ruido ambiental (viento, voces) degrada STT | Técnico | 4 | 3 | 12 | VAD; consejo de uso; repetición rápida; texto | Tasa de reintentos | UX |
| R12 | Ambigüedad del término "bloqueo legal" genera expectativas falsas | Legal/producto | 3 | 2 | 6 | Mensajería clara ("lo decide el árbitro"); LAW‑IMP‑01 | Feedback | Producto |
| R13 | Regionalismos y variantes del español | Producto | 3 | 3 | 9 | Lexicón por locale; corpus de varias comunidades | % fuera de cobertura por región | Tech lead |
| R14 | Monetización individual insuficiente (punto de equilibrio alto) | Negocio | 4 | 4 | **16** | Canal clubes/escuelas; plan Club; pilotos con un club colaborador | Conversión; clubes firmados | Producto |
| R15 | Errores en el motor que cambian jugadas guardadas | Técnico | 2 | 5 | 10 | Versiones inmutables con coordenadas resueltas; migraciones probadas | Diferencias de hash en regresión | Tech lead |
| R16 | Fuga de análisis privado a jugadores | Seguridad | 2 | 4 | 8 | Doble capa (guard + RLS); suite de autorización; extractos | Tests 100 % | Tech lead |
| R17 | Equipo pequeño con conocimiento concentrado en el motor | Organización | 3 | 4 | 12 | Documentación (este paquete), pares en el motor, ADRs | Bus factor | Producto |
| R18 | El reconocimiento de la federación/clubes requiere integraciones no disponibles | Negocio | 3 | 2 | 6 | CSV/ICS; acuerdos V2 | — | Producto |

## Riesgos prioritarios (exposición ≥ 15)

1. **R01 Cobertura**: es el riesgo existencial del producto. La Fase 0 recoge 100 locuciones reales antes de escribir la gramática y el piloto tiene criterio cuantitativo de salida.
2. **R04 Alcance**: piloto de 12 semanas con recortes definidos.
3. **R14 Monetización**: validar disposición a pagar de clubes durante el piloto (carta de intención de al menos 3 clubes como criterio de Go para V1).
