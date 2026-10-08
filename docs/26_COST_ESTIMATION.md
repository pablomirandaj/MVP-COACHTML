# 26 — Estimación económica

> Supuestos en euros, España, octubre de 2026. Costes de personal = coste empresa (salario bruto × ≈ 1,32). Precios de terceros a confirmar con cada proveedor; los de STT proceden de fuentes secundarias (02 §3).

## 1. Equipo

| Perfil | Dedicación | Coste empresa mensual |
|---|---|---|
| Tech lead full‑stack (motor/NLU) | 1,0 | 6.500 € |
| Desarrollador/a full‑stack | 2 × 1,0 | 2 × 5.000 € |
| Diseño UX/UI | 0,5 | 2.300 € |
| QA | 0,5 | 2.000 € |
| Producto (fundador/a, imputado) | 0,3 | 1.800 € |
| Asesor táctico UEFA B/A | 4 h/semana × 40 €/h | 700 € |
| **Total mensual** | | **≈ 23.300 €** |

## 2. Coste de construcción

| Fase | Duración | Personal | Otros | Total |
|---|---|---|---|---|
| Fase 0 (validación) | 3 semanas | 12.000 € (equipo reducido) | Incentivos entrevistas 1.000 €; EIPD/legal inicial 3.000 € | 16.000 € |
| Piloto (construcción) | 12 semanas | 64.500 € | Infra/herramientas 1.500 € | 66.000 € |
| Piloto (operación, en paralelo con V1) | 8 semanas | (incluido en V1) | Soporte a pilotos, STT ≈ 50 € | 50 € |
| V1 | ≈ 15 semanas | 81.500 € | Pentest 7.000 €; legal (condiciones, DPA, privacidad) 3.000 €; diseño de marca 3.000 € | 94.500 € |
| Contingencia 15 % | | | | 26.500 € |
| **Total hasta V1** | **≈ 30 semanas** | | | **≈ 203.000 €** |

Alternativa reducida (2 desarrolladores, sin QA dedicado): ≈ 140.000 € y ≈ 42 semanas; mayor riesgo de calidad en el motor (más pruebas recaen en desarrollo).

## 3. Coste operativo mensual

| Concepto | 500 activos | 2.000 activos | 10.000 activos |
|---|---|---|---|
| PostgreSQL + Auth + Storage (Supabase Pro + cómputo) | 25 € | 70 € | 350 € |
| API (2–4 contenedores) | 30 € | 50 € | 200 € |
| Worker (Chromium, exportaciones) | 25 € | 45 € | 180 € |
| Web (CDN/hosting) | 0–20 € | 20 € | 50 € |
| Email transaccional | 15 € | 15 € | 60 € |
| Monitorización (Sentry, métricas) | 25 € | 30 € | 120 € |
| **Infraestructura** | **≈ 140 €** | **≈ 230 €** | **≈ 960 €** |
| STT (30 min/entrenador/mes × ≈ 0,005 USD/min) | 70 € | 280 € | 1.400 € |
| **Total** | **≈ 210 €** | **≈ 510 €** | **≈ 2.360 €** |
| Por entrenador activo | 0,42 € | 0,26 € | 0,24 € |

A partir de ~10.000 activos conviene evaluar Whisper autohospedado: una GPU dedicada (≈ 300–400 €/mes) procesa holgadamente 300.000 min/mes, frente a ≈ 1.400 € de STT gestionado.

## 4. Ingresos y punto de equilibrio (hipótesis)

| Plan | Precio | Neto tras comisiones de pago (~3 %) |
|---|---|---|
| Entrenador anual | 69 €/año | ≈ 5,6 €/mes |
| Entrenador mensual | 7,99 €/mes | ≈ 7,75 €/mes |
| Club | 4 €/equipo/mes | ≈ 3,9 €/equipo/mes |

- Margen bruto por entrenador de pago: ≈ 5,6 € − 0,30 € ≈ **95 %**.
- Coste fijo tras V1 (equipo de mantenimiento y evolución de 3 personas + infra + herramientas): ≈ 19.000 €/mes.
- **Punto de equilibrio**: ≈ 3.400 entrenadores de pago (o mezcla equivalente de clubes), es decir, ~85.000 registrados con un 4 % de conversión, o una estrategia de clubes (p. ej. 150 clubes × 15 equipos).
- Implicación: el canal **club/federación territorial/escuela de entrenadores** es clave para la viabilidad; el canal individual solo no basta en España a corto plazo.

## 5. Sensibilidades

| Variable | Variación | Efecto |
|---|---|---|
| Minutos de voz por entrenador | ×3 (90 min/mes) | +0,40 €/activo/mes; sigue por debajo del 10 % del precio |
| Precio STT | ×2 | +0,14 €/activo/mes |
| Duración del piloto | +4 semanas | +23.000 € |
| Retraso de cobertura NLU | Piloto falla el criterio del 85 % | Una iteración adicional de 4–6 semanas antes de V1 |
