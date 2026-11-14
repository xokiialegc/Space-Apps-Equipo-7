# AEON-01 · Space Simulator

Juego 2D en primera persona sobre un viaje espacial de la Tierra a Marte.
Proyecto del **Equipo 7** para el hackatón Space Apps (reto: *Juego de diseño de misiones espaciales*).

- **Tecnología:** HTML, Tailwind CSS (CDN) y JavaScript puro. Sin compilación ni dependencias que instalar.
- **Formato:** escenario 16:9 (1600×900) que se escala a cualquier ventana.

## Cómo jugar

Abre `index.html` en un navegador (o publica la carpeta en GitHub Pages / cualquier hosting estático).

| Pantalla | Controles |
|---|---|
| Menú | Ratón o táctil |
| Briefing | Ratón o táctil |
| Despegue (Fase 1) | Mantener `Espacio` (o `W` / `↑` / pantalla IMPULSORES) para encender los impulsores · `Esc` abortar |
| Interior de la nave | `A` / `D` (o puertas y minimapa) moverse entre salas · mantener `E` para reponer el recurso de la sala · `Esc` menú |
| Descenso en Marte | `A` / `D` ángulo de entrada · `P` paracaídas · mantener `Espacio` retropropulsores |

## Flujo del juego

1. **Menú principal** — en *Personalizar* se elige el vehículo de lanzamiento, el color y el nombre.
2. **Nueva partida** — briefing del Instructor Jefe y Manual rápido de telemetría.
3. **Fase 1 · Lanzamiento** — en la cabina: verificar carga y presupuesto, cuenta atrás y despegue
   hasta 7,8 km/s por encima de 100 km.
4. **3.2 · Segmento espacial** — recorrer el interior de la nave (seis salas) y configurar nave
   principal, tanques, soporte vital, energía, lander, escudo térmico e instrumentos.
5. **Fase 2 · Viaje interplanetario** — 210 días comprimidos: vigilar oxígeno, energía, delta-v,
   escudo, comunicaciones e instrumentos, cada uno en su sala; el panel de alertas lleva directo a
   la sala afectada. Tres eventos críticos de Control de Misión con decisión A/B.
6. **Fase 3 · Descenso en Marte** — de vuelta en la cabina: entrada atmosférica, paracaídas,
   retropropulsores y aterrizaje.
7. **Reporte final** — evaluación de los cuatro segmentos, eficiencia, calificación y cierre.

## Estructura

```
index.html      Menú principal, cabina de vuelo y paneles
assets/cockpit.webp Imagen de la cabina con los cristales transparentes (Fase 1)
css/style.css   Estilos propios (neón, título metálico, indicadores)
js/menu.js      Fondo espacial, botones, ajustes, personalización, guardado
js/mission.js   Configuración de misión, briefing, telemetría y verificación de lanzamiento
js/sky.js       Vista animada por las ventanas: cielo → espacio
js/launch.js    Fase 1 en la cabina: verificación (holograma), cuenta atrás y despegue
js/ship.js      Interior de la nave (casco con tuberías, cables y paneles), configuración (3.2) y viaje (Fase 2)
js/edl.js       Fase 3: descenso en Marte, reporte final y resultados
docs/PROCESO.md Bitácora del proceso de desarrollo
```

El progreso y los ajustes se guardan en `localStorage` del navegador.
