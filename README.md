# Programa de Simulación Orbital

Simulador educativo de una expedición tripulada a Marte. El cadete diseña la misión, la lanza, resuelve anomalías durante el viaje, ejecuta el descenso y recibe una evaluación de los cuatro segmentos de una misión espacial: **lanzamiento, espacial, terrestre y de usuario**.

## Cómo jugar

No requiere instalación ni compilación: abre `index.html` en un navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
```

## Flujo de la misión

1. **Inicio y manual de telemetría** — delta-v, masa, escudo térmico, soporte vital y potencia.
2. **Hangar de diseño** — lanzador, nave, lander, escudo, instrumentos y propelente, con telemetría y alertas en vivo.
3. **Lanzamiento** — verificación de capacidad y presupuesto, cuenta atrás e inserción orbital.
4. **Viaje interplanetario** — tres eventos críticos (comunicaciones, tormenta solar, trayectoria).
5. **Entrada, descenso y aterrizaje** — escudo, frenado, retropropulsores y contacto.
6. **Reporte final** — telemetría, evaluación por segmento y calificación.

Resultados posibles: graduación (A), fallo de lanzamiento (B), pérdida de capacidad operativa (C), descenso no completado (D) y aterrizaje sin objetivo científico cumplido.

## Gráficos

Todo se dibuja en 2D sobre canvas, sin imágenes externas (`js/graficos.js`):

- **Nave, exterior e interior.** La nave se construye a partir del diseño: cambia de tamaño con la nave, el propelente, el lander y el escudo elegidos. La vista interior muestra en corte los tanques, las baterías, la bodega de instrumentos, los depósitos de oxígeno y la tripulación, con niveles que reflejan la telemetría real.
- **Consolas por módulo.** Durante el viaje, cada módulo se puede seleccionar para abrir su consola. Las anomalías aparecen sobre el módulo afectado y se resuelven desde su consola.
- **Escenas.** Despegue, entrada con plasma, paracaídas, retropropulsión, superficie de Marte con los instrumentos desplegados y una escena para cada tipo de fallo.

## Modelo

`js/sim.js` contiene todas las reglas, sin dependencias del navegador:

- El delta-v se calcula con la ecuación del cohete (`Δv = vₑ · ln(m₀/m_f)`), así que cada tonelada extra cuesta maniobra.
- Misión nominal: 3,6 km/s de salida + 0,3 de corrección + 0,7 de descenso.
- La carga térmica de entrada crece con la masa de llegada y con una trayectoria sin corregir.
- La potencia sobrante tras los sistemas esenciales (7 kW) decide qué instrumentos funcionan en Marte.
- Las decisiones erróneas tienen coste real: delta-v, potencia, soporte vital o instrumentos dañados.

Los valores de componentes y constantes están al principio del archivo para ajustar la dificultad.

## Estructura

```
index.html        Página única
css/styles.css    Estilos
js/sim.js         Modelo de misión
js/graficos.js    Escenas 2D en canvas
js/app.js         Pantallas e interacción
tests/            Pruebas del modelo
```

## Pruebas

```bash
node --test tests/sim.test.js
```
