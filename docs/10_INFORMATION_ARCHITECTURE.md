# 10 — Arquitectura de información

## 1. Mapa del sitio (staff)

```
Inicio (P02)
├── Jornadas (P05)
│   └── Jornada n (P06)
│       ├── Convocatoria
│       ├── Once → Editor de alineaciones (P07)
│       ├── Jugadas → Editor de balón parado (P08)
│       ├── Rival → Análisis de rival (P12)
│       ├── Notas de entrenamiento · Objetivos
│       ├── Charla (P13) → Vista previa (P14)
│       ├── Compartido
│       └── Observaciones posteriores
├── Plantilla (P03)
│   └── Jugador (P04)
├── Jugadas → Biblioteca (P09) → Editor (P08)
├── Rivales → Ficha de rival (P12, pestaña Histórico)
└── Más
    ├── Equipo y permisos (P16)
    ├── Preferencias (voz, lateralidad, intensidades)
    ├── Club (admin)
    └── Cuenta y privacidad
Global: Grabadora (P10) → Revisión (P11)
```

## 2. Mapa del sitio (jugador/tutor)

```
Mi equipo (P15)
├── Próximo partido
├── Mi papel
├── Jugadas
├── Charla
└── Histórico
```

## 3. Navegación principal

| Plataforma | Patrón | Elementos |
|---|---|---|
| Móvil staff | Barra inferior 5 + botón de voz flotante | Inicio · Jornadas · Plantilla · Jugadas · Más |
| Tableta/escritorio staff | Raíl lateral | Ídem + Rivales |
| Jugador | Una sola pantalla con secciones | — |

Profundidad máxima: 3 niveles desde la barra (Jornadas → Jornada → Editor).

## 4. Objetos y relaciones (modelo mental del entrenador)

| Objeto | Vive en | Se reutiliza en |
|---|---|---|
| Jugador | Plantilla | Once, jugadas, charla, panel del jugador |
| Once | Jornada | Charla, jugadas (asignación), siguientes jornadas ("cargar") |
| Jugada | Biblioteca | Jornadas (vinculada), charla |
| Rival | Club | Jornadas contra él, análisis, histórico |
| Análisis | Rival + Jornada | Charla, extractos |
| Charla | Jornada | Compartido |

## 5. Taxonomía y etiquetas

- Jugadas: tipo (14 §6), lado, etiquetas libres, estado.
- Alineaciones: etiqueta libre ("alternativa ofensiva"), rival (derivado del partido).
- Análisis: categoría (19 §2), evidencia.
- Búsqueda global (V1): jugadores, rivales, jugadas, jornadas.

## 6. Contexto de la voz

El botón de voz conserva el contexto de la pantalla: en la jornada, las órdenes de alineación, jugadas o rival se enrutan al módulo correspondiente según el marco ganador; en un editor, solo los marcos de ese editor y los globales. Una orden de otro módulo en un editor produce `AMB-CONTEXT` ("¿Ir a la alineación para cambiar a Lucas por Mateo?").
