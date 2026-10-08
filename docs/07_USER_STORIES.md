# 07 — Historias de usuario

Formato: **US‑xxx** · Como *rol*, quiero *acción*, para *beneficio*. Criterios de aceptación (CA) verificables. `[P]` = piloto. Puntos de historia (PH) en escala Fibonacci para el backlog (25).

## Épica E1 — Equipo y plantilla

**US‑101 [P]** Como entrenador, quiero crear mi equipo en menos de 2 minutos, para empezar a usar la app el mismo día. *(3 PH)*
- CA1: Con nombre, categoría y temporada se crea el equipo y llego a su panel.
- CA2: Puedo subir escudo; si no, se muestra un escudo genérico con iniciales.
- CA3: Si indico dimensiones fuera de 90–120 × 45–90 m, no se guarda y se explica el rango.

**US‑102 [P]** Como entrenador, quiero dar de alta jugadores con su posición, pie y características, para que la app los coloque y asigne bien. *(5 PH)*
- CA1: Nombre y posición principal son obligatorios; el resto opcional.
- CA2: El dorsal no puede repetirse en el equipo (mensaje en el campo).
- CA3: Puedo marcar roles de balón parado (lanzador de córners izquierda/derecha, rematador, bloqueador).

**US‑103 [P]** Como entrenador, quiero marcar a un jugador como lesionado o sancionado, para que la app me avise si lo alineo. *(2 PH)*
- CA1: El estado aparece en la lista y en el campo (punto rojo).
- CA2: Alinearlo genera aviso LINEUP‑04, no lo impide.

**US‑104** Como entrenador, quiero importar la plantilla desde un CSV, para no teclear 25 jugadores. *(5 PH)*
- CA1: Previsualización con errores por fila antes de importar; nada se crea hasta confirmar.

**US‑105 [P]** Como entrenador, quiero añadir a mi cuerpo técnico con su función, para que colaboren. *(3 PH)*

## Épica E2 — Alineaciones

**US‑201 [P]** Como entrenador, quiero elegir un sistema y ver las posiciones colocadas, para asignar jugadores encima. *(3 PH)*
- CA1: Al elegir 4‑3‑3 aparecen 11 ranuras en las coordenadas del catálogo.
- CA2: Cambiar de sistema conserva a los jugadores en ranuras equivalentes por línea y lado; los que no encajan pasan al banquillo con aviso.

**US‑202 [P]** Como entrenador, quiero dictar el once completo, para hacerlo en segundos desde el móvil. *(8 PH)*
```gherkin
Escenario: once completo por voz con homónimo
  Dado un 4-3-3 vacío vinculado al partido del domingo
  Y dos jugadores llamados "Álvaro" en la plantilla
  Cuando digo "Para el domingo vamos a jugar 4-3-3. En portería Pablo, centrales Mateo y Diego, laterales Lucas y Martín. En el medio Sergio, Adrián y Marcos. Arriba Hugo, Álvaro y Pedro."
  Entonces veo 10 jugadores colocados en borrador
  Y una pregunta "¿Qué Álvaro?" con Álvaro Castro (9) preseleccionado
  Cuando elijo Álvaro Castro
  Entonces la alineación tiene 11 jugadores y ningún error
  Y Lucas aparece como lateral izquierdo con el aviso "fuera de posición"
```

**US‑203 [P]** Como entrenador, quiero arrastrar jugadores entre el campo y el banquillo, para ajustar a mano. *(5 PH)*

**US‑204 [P]** Como entrenador, quiero decir "cambia a Lucas por Mateo" y que la app no haga nada raro si ambos son titulares. *(3 PH)*
- CA1: Si ambos están en el once, aparece la pregunta de intercambio y la alineación no cambia hasta responder.

**US‑205 [P]** Como entrenador, quiero adelantar los extremos o juntar líneas por voz, para expresar la altura del bloque. *(5 PH)*
- CA1: "un poco" = 3 m y se muestra el valor en la revisión; puedo cambiarlo antes de aplicar.

**US‑206 [P]** Como entrenador, quiero guardar alternativas y recuperar la alineación que usé contra un rival, para no rehacer trabajo. *(5 PH)*

## Épica E3 — Balón parado

**US‑301 [P]** Como entrenador, quiero describir un córner hablando y verlo dibujado con roles y movimientos, para prepararlo en un minuto. *(13 PH)*
```gherkin
Escenario: córner del enunciado con conflicto de pierna
  Dado el once del domingo y Lucas registrado como zurdo
  Cuando dicto el córner del ejemplo 6.3
  Entonces se me pregunta por la pierna de Lucas con 4 opciones
  Cuando elijo "Actualizar ficha: Lucas es diestro"
  Entonces veo 10 jugadores propios y 11 rivales
  Y el balón sale cerrado hacia el segundo palo
  Y el 9 y el 17 aparecen con trazo discontinuo marcado "propuesta"
  Y no hay avisos de reglamento
  Y la ficha de Lucas muestra "diestro" con registro de auditoría
```

**US‑302 [P]** Como entrenador, quiero corregir la jugada con órdenes cortas sin rehacerla, para afinar detalles. *(8 PH)*
- CA1: Solo cambian los elementos afectados (verificado por T‑EDT‑01).
- CA2: Cada orden se deshace con un toque.

**US‑303 [P]** Como entrenador, quiero reproducir la jugada a cámara lenta y por fases, para explicarla. *(5 PH)*

**US‑304 [P]** Como entrenador, quiero distinguir lo que dije de lo que propuso la app, para no dar por buena una decisión que no tomé. *(3 PH)*

**US‑305 [P]** Como entrenador, quiero saber por qué la app me avisa, para decidir si lo ignoro. *(3 PH)*
- CA1: Cada aviso indica si es Reglamento, Técnica, Recomendación o Preferencia del equipo, con la regla citada.

**US‑306 [P]** Como entrenador, quiero mover jugadores y dibujar carreras con el dedo, para editar sin hablar. *(8 PH)*

**US‑307 [P]** Como entrenador, quiero una biblioteca de jugadas filtrable, para reutilizarlas. *(5 PH)*

**US‑308** Como entrenador, quiero crear variantes de una jugada, para tener la B y la C. *(3 PH)*

**US‑309** Como entrenador, quiero diseñar faltas, saques de banda y saque de centro. *(13 PH)*

**US‑310** Como entrenador, quiero exportar una jugada como secuencia de diapositivas. *(5 PH)*

## Épica E4 — Voz

**US‑401 [P]** Como entrenador, quiero corregir el texto transcrito antes de aplicarlo, para arreglar un nombre mal entendido. *(3 PH)*

**US‑402 [P]** Como entrenador, quiero escribir órdenes cuando no puedo hablar (vestuario, transporte). *(2 PH)*

**US‑403 [P]** Como entrenador, quiero que la app me diga qué no entendió y cómo decirlo, para aprender el lenguaje sin manual. *(5 PH)*

**US‑404 [P]** Como entrenador, quiero responder a las aclaraciones también hablando ("la primera", "a los dos"). *(3 PH)*

## Épica E5 — Calendario y jornada

**US‑501 [P]** Como entrenador, quiero importar el calendario desde un CSV, para tener todas las jornadas creadas. *(8 PH)*
- CA1: Detecta columnas habituales; me deja corregir el mapeo.
- CA2: Señala rivales que se parecen a rivales existentes ("Sporting B" vs "Sporting Club B").

**US‑502 [P]** Como entrenador, quiero un espacio por jornada con todo lo del partido y un checklist, para saber qué me falta. *(5 PH)*

**US‑503 [P]** Como entrenador, quiero aplazar un partido conservando su preparación. *(3 PH)*

**US‑504 [P]** Como entrenador, quiero anotar observaciones después del partido y confirmar o refutar hipótesis sobre el rival. *(3 PH)*

## Épica E6 — Rivales

**US‑601 [P]** Como entrenador, quiero dictar lo que sé del rival y obtener un informe ordenado, sin que la app añada nada. *(8 PH)*
- CA1: Cada ítem muestra el fragmento literal y su posición en la grabación.
- CA2: El ejemplo 8.1 produce los 7 ítems de 19 §3.1 y ninguna contradicción.

**US‑602 [P]** Como entrenador, quiero ver lo que anoté de este rival la temporada pasada, separado de lo nuevo. *(5 PH)*

**US‑603** Como analista, quiero marcar observaciones como hipótesis y que se arrastren al próximo enfrentamiento. *(3 PH)*

## Épica E7 — Charla

**US‑701 [P]** Como entrenador, quiero generar la charla desde la jornada con un toque y exportarla en PDF. *(8 PH)*

**US‑702** Como entrenador, quiero PowerPoint editable con la alineación como formas, para retocarla. *(8 PH)*

**US‑703** Como entrenador, quiero ordenar la charla dictándola. *(5 PH)*
- CA1: El ejemplo 9.3 produce el orden Presión alta → Nota "su lateral derecho sube mucho" → 2 córners del jueves → (secciones mantenidas) → Once.
- CA2: Si no hay exactamente dos córners del jueves, se me pregunta.

## Épica E8 — Compartir y permisos

**US‑801 [P]** Como entrenador, quiero invitar a mis jugadores con un enlace de invitación por email. *(5 PH)*

**US‑802 [P]** Como jugador, quiero ver si estoy convocado, el once y las jugadas en las que participo con mi rol destacado. *(5 PH)*

**US‑803 [P]** Como entrenador, quiero que mis análisis y borradores nunca los vean los jugadores salvo que comparta un extracto. *(3 PH)*
- CA1: Test de acceso: un jugador recibe 404 en cualquier análisis.

**US‑804 [P]** Como coordinadora de base, quiero que los menores de 14 accedan a través de sus tutores, para cumplir la ley. *(8 PH)*

**US‑805** Como entrenador, quiero dar permiso de publicación a mi segundo, para que comparta las jugadas cuando yo no puedo. *(3 PH)*

**US‑806** Como entrenador, quiero mandar instrucciones individuales que solo vea cada jugador. *(5 PH)*

## Resumen

| Épica | Historias | Piloto | PH totales | PH piloto |
|---|---|---|---|---|
| E1 | 5 | 4 | 18 | 13 |
| E2 | 6 | 6 | 29 | 29 |
| E3 | 10 | 7 | 66 | 45 |
| E4 | 4 | 4 | 13 | 13 |
| E5 | 4 | 4 | 19 | 19 |
| E6 | 3 | 2 | 16 | 13 |
| E7 | 3 | 1 | 21 | 8 |
| E8 | 6 | 4 | 29 | 21 |
| **Total** | **41** | **32** | **211** | **161** |
