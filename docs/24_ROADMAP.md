# 24 — Roadmap

Semana 0 = inicio de construcción tras autorización.

```mermaid
gantt
  title Football Coach Studio — roadmap (semana 0 = 2026-11-02, supuesto)
  dateFormat YYYY-MM-DD
  axisFormat %d/%m
  section Fase 0
  Descubrimiento y validación                            :f0, 2026-11-02, 21d
  section Piloto (12 semanas de construcción)
  S1-2 Base técnica, plantilla, motor núcleo             :p1, after f0, 28d
  S3 Alineaciones y NLU de alineación                    :p2, after p1, 14d
  S4-5 Córners: motor, editor, animación, voz            :p3, after p2, 28d
  S6 Calendario, rival, charla PDF, compartir, endurecer :p4, after p3, 14d
  Piloto con 10 entrenadores                             :p6, after p4, 56d
  section V1
  Faltas, banda, saque de centro, editor libre           :v1, 2027-03-08, 42d
  PPTX, charla por voz, imágenes, enlace                 :v2, 2027-03-22, 28d
  Roles completos, extractos, instrucciones individuales :v3, 2027-04-19, 21d
  XLSX/ICS, competiciones, histórico completo            :v4, 2027-04-19, 21d
  Pagos, pentest, rendimiento, accesibilidad             :v5, 2027-05-10, 21d
  Lanzamiento V1                                         :milestone, 2027-05-31, 0d
  section V1.5
  Animación avanzada, GIF/MP4, ~60 operaciones           :v15, 2027-05-31, 84d
```

## Hitos

| Hito | Semana | Criterio de salida |
|---|---|---|
| H0 Validación | 3 | 15 entrevistas; 10 pilotos comprometidos; 100 locuciones iniciales; asesor contratado |
| H1 Motor núcleo | 7 | T‑DET y T‑LU dorados en verde; render de alineación |
| H2 Córner por voz | 13 | Escenarios 1–3 E2E en verde |
| H3 Piloto listo | 15 | Escenarios 1–5 (PDF) en verde; seguridad básica; condiciones de 23 §6 |
| H4 Decisión post‑piloto | 23 | Métricas de 00 §6 → Go/ajustar/parar |
| H5 V1 | 30 | 23 §3 completo; pentest sin altas; NFR cumplidos |
| H6 V1.5 | 42 | 23 §4 |

## Dependencias críticas

1. Catálogo de córners validado por el asesor antes del sprint 4.
2. Contrato y DPA del proveedor STT antes del sprint 3.
3. Corpus inicial (≥ 100 locuciones) antes del sprint 3 para dirigir la gramática.
4. Club colaborador para consentimientos de menores antes del piloto.
