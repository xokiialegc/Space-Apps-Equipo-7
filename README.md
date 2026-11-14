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
| Segmento espacial | `W` / `↑` acelerar · `S` / `↓` frenar · `Esc` guardar y volver al menú |

## Flujo del juego

1. **Menú principal** — en *Personalizar* se elige el vehículo de lanzamiento y los módulos de carga.
2. **Nueva partida** — briefing del Instructor Jefe y Manual rápido de telemetría.
3. **Fase 1 · Segmento de lanzamiento** — verificar capacidad de carga y presupuesto, autorizar,
   cuenta atrás y despegue en primera persona: hay que alcanzar 7,8 km/s por encima de 100 km
   sin romper la nave (presión dinámica) ni quedarse sin combustible.
4. **Segmento espacial (prototipo)** — crucero hasta Marte; solo se gasta combustible al
   cambiar de velocidad, así que hay que reservar para frenar al llegar.

## Estructura

```
index.html      Menú principal, cabina de vuelo y paneles
assets/cockpit.jpg  Imagen de la cabina (Fase 1)
css/style.css   Estilos propios (neón, título metálico, indicadores)
js/menu.js      Fondo espacial, botones, ajustes, personalización, guardado
js/mission.js   Configuración de misión, briefing, telemetría y verificación de lanzamiento
js/launch.js    Fase 1 en la cabina: verificación (holograma), cuenta atrás y despegue
js/game.js      Segmento espacial: crucero a Marte (prototipo)
docs/PROCESO.md Bitácora del proceso de desarrollo
```

El progreso y los ajustes se guardan en `localStorage` del navegador.
