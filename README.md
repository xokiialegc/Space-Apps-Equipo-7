# AEON-01 · Space Simulator

Juego 2D sobre un viaje espacial de la Tierra a Marte: cabina en primera persona para pilotar
y nave en corte lateral para recorrerla a pie.
Proyecto del **Equipo 7** para el hackatón Space Apps (reto: *Juego de diseño de misiones espaciales*).

- **Tecnología:** HTML, Tailwind CSS (CDN) y JavaScript puro. Sin compilación ni dependencias que instalar.
- **Formato:** escenario 16:9 (1600×900) que se escala a cualquier ventana.

## Cómo jugar

Abre `index.html` en un navegador (o publica la carpeta en GitHub Pages / cualquier hosting estático).

| Pantalla | Controles |
|---|---|
| Menú | Ratón o táctil |
| Hangar de lanzamiento (Personalizar) | `←` / `→`, flechas en pantalla o clic para cambiar de cohete · ratón o táctil para color y calcomanías · `Esc` o «Menú Principal» para volver |
| Briefing | Ratón o táctil |
| Despegue (Fase 1) | Mantener `Espacio` (o `W` / `↑` / pantalla IMPULSORES) para encender los impulsores · `Esc` abortar |
| Interior de la nave | `E` levantarse del asiento del piloto o sentarse · `A` / `D` o `←` / `→` caminar libremente (la cámara sigue al cadete) · `E` o `Espacio` junto a un panel, cuando aparece el indicador: abrir su consola, atender un evento o, manteniéndola, reparar · `Esc` cerrar consola / menú |
| Descenso en Marte | `A` / `D` ángulo de entrada · `P` paracaídas · mantener `Espacio` retropropulsores |
| Cámara exterior (despegue, órbita, viaje y descenso) | `C` o el botón «C · Cámara exterior» (arriba, en el centro) alterna entre la vista de dentro y la toma exterior de la nave. En el despegue y el descenso los mandos siguen funcionando; en el interior de la nave hay que volver dentro con `C` para caminar y reparar |

## Flujo del juego

1. **Menú principal** — *Personalizar* abre el hangar de lanzamiento: un carrusel para elegir
   cohete (Centella, X o Apollo 11, cada uno con su capacidad de carga y su coste), color
   principal en tiempo real, hasta tres calcomanías sobre el fuselaje y nombre de la nave.
2. **Nueva partida** — briefing del Instructor Jefe y Manual rápido de telemetría.
3. **Fase 1 · Lanzamiento** — en la cabina: verificar carga y presupuesto, cuenta atrás y despegue
   hasta 7,8 km/s por encima de 100 km.
4. **3.2 · Segmento espacial** — el cadete se levanta del asiento del piloto y recorre a pie la
   nave, un mapa lateral continuo de seis salas unidas por puertas, de proa a popa: Puente,
   Soporte vital, Laboratorio, Hangar, Energía y Propulsión. En la consola de cada sala configura
   nave principal, soporte vital, instrumentos, lander y escudo térmico, energía y tanques; de
   vuelta en el asiento, verifica el diseño e inicia el viaje.
5. **Fase 2 · Viaje interplanetario** — 210 días comprimidos: vigilar oxígeno, energía, delta-v,
   escudo, comunicaciones e instrumentos. Cada avería enciende las luces de alarma de su módulo y
   se repara allí mismo, junto al panel; el panel de alertas lleva andando hasta el módulo
   afectado. Tres eventos críticos de Control de Misión con decisión A/B. Al llegar a Marte hay
   que volver al puesto del piloto.
   **Tripulación:** dos compañeros, Vera Kalani (ingeniera de vuelo) e Iker Solano (técnico de
   sistemas), recorren la nave por su cuenta. Cuando salta una alarma, el que está más cerca la
   detecta, avisa por radio, camina hasta el módulo y la repara. Los eventos críticos siguen
   siendo decisión del cadete.
6. **Fase 3 · Descenso en Marte** — de vuelta en la cabina: entrada atmosférica, paracaídas,
   retropropulsores y aterrizaje.
7. **Reporte final** — evaluación de los cuatro segmentos, eficiencia, calificación y cierre.

## Estructura

```
index.html      Menú principal, cabina de vuelo y paneles
assets/cockpit.webp Imagen de la cabina con los cristales transparentes (Fase 1)
css/style.css   Estilos propios (neón, título metálico, indicadores)
js/menu.js      Fondo espacial, botones, ajustes, guardado
js/datos.js     Constantes físicas verificadas con fuentes oficiales (una sola definición por dato)
js/mission.js   Configuración de misión, briefing, telemetría y verificación de lanzamiento
js/rockets.js   Cohetes en 2D dibujados por código, color principal y calcomanías
js/custom.js    Hangar de lanzamiento: pantalla de personalización del cohete
js/sky.js       Vista animada por las ventanas: cielo → espacio
js/launch.js    Fase 1 en la cabina: verificación (holograma), cuenta atrás y despegue
js/avatars.js   Tripulación y retratos (avatares) del cadete y de los NPC
js/ship.js      Interior de la nave en mapa lateral (casco con tuberías, cables y paneles): movimiento libre, configuración (3.2), viaje (Fase 2) y tripulación con IA de reparación
js/edl.js       Fase 3: descenso en Marte, reporte final y resultados
js/exterior.js  Cámara exterior (tecla C): toma de cuerpo completo de la nave según la telemetría de cada fase
js/fx.js        Sensación de juego: vibración y zoom de cámara, viñeta de alarma, líneas de estrés y sonido sintetizado
docs/PROCESO.md Bitácora del proceso de desarrollo
docs/AUDITORIA_NASA.md Auditoría de los datos del juego frente a NASA y ESA, con fuentes
```

El progreso y los ajustes se guardan en `localStorage` del navegador.

En el interior también se puede jugar con ratón o pantalla táctil: los botones `◀ A` y `D ▶` se
mantienen pulsados para caminar, el indicador de acción hace de tecla `E`, y el minimapa y el
panel de alertas llevan al cadete andando hasta el puesto elegido.

## Rigor científico

Los datos físicos del simulador están auditados contra fuentes oficiales (issue #6): gravedad,
atmósfera, línea de Kármán, velocidad orbital, delta-v de inyección a Marte, ecuación del cohete
de Tsiolkovski con un impulso específico real, capacidad del Saturno V y la secuencia de entrada,
descenso y aterrizaje de la misión Perseverance. El informe completo, con la tabla comparativa,
las correcciones y las simplificaciones que se mantienen, está en
[`docs/AUDITORIA_NASA.md`](docs/AUDITORIA_NASA.md).

Los tiempos están comprimidos (un despegue dura unos 40 segundos) y los costes y las masas de
los módulos son ficticios.

## Avatares

Cada personaje tiene un retrato que aparece en la barra de tripulación (arriba a la izquierda,
con lo que está haciendo cada uno), en los diálogos, en los mensajes de radio y como icono
flotante sobre cada tripulante. Los retratos se dibujan por código. Para usar imágenes propias,
guárdalas en `assets/avatars/` y escribe su ruta en `FILES`, al principio de `js/avatars.js`.

## Sonido y efectos

Todo el sonido se sintetiza en el navegador con Web Audio, sin archivos de audio: rugido de los
motores (ruido marrón filtrado según el empuje y la densidad del aire), plasma de la entrada en
Marte, detonación metálica al separar etapas, alarma intermitente con los recursos en estado
crítico, chispas eléctricas de los paneles averiados, soldadura al reparar y pitidos de interfaz.
El audio arranca con el primer clic o tecla. El botón del altavoz (arriba a la derecha) silencia
o activa todo el sonido y la elección se guarda.

La cámara vibra con el empuje en la atmósfera densa, tiembla con fuerza en Max-Q (con líneas de
estrés en los bordes), da un golpe seco con zoom al separar una etapa y una sacudida con destello
rojo en los bordes ante impactos y averías. Si el sistema tiene activado «reducir movimiento», la
vibración se reduce.

## Música

Cada escena tiene su canción: una para el menú, el briefing, el despegue y el viaje, otra para el
descenso a Marte y otra solo para el hangar de personalización. El volumen se ajusta en
**Ajustes → Música** y el botón del altavoz lo silencia todo. Las canciones tienen derechos de
autor y no están en el repositorio: ver `assets/music/LEEME.md` para añadirlas a tu copia.

## Panel de partida

Desde que empieza la partida hay un panel arriba a la derecha con **PAUSA** (también con Esc) y
**MENÚ** (vuelve al menú principal; la partida guardada sigue en «Continuar»).

