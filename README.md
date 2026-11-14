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
| Vuelo | `W` / `↑` acelerar · `S` / `↓` frenar · `Esc` guardar y volver al menú |

**Objetivo del prototipo:** llegar a Marte y entrar en órbita. Solo se gasta combustible al
*cambiar* de velocidad (acelerar o frenar); hay que reservar lo suficiente para frenar al llegar.

## Estructura

```
index.html      Menú principal, cabina de vuelo y paneles
css/style.css   Estilos propios (neón, título metálico, indicadores)
js/menu.js      Fondo espacial, botones, ajustes, personalización, guardado
js/game.js      Prototipo de vuelo en primera persona
docs/PROCESO.md Bitácora del proceso de desarrollo
```

El progreso y los ajustes se guardan en `localStorage` del navegador.
