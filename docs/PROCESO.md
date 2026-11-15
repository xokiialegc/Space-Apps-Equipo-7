# Bitácora de desarrollo — AEON-01

## Etapa 1 · Menú principal y prototipo de vuelo (14-11-2026)

### Pedido
Juego visual 2D en primera persona, hecho con HTML + Tailwind CSS + JavaScript, que corra en un
sitio web. Nombre: **AEON-01**, un viaje espacial a Marte. Empieza por el menú principal:
estilo tecnológico azul eléctrico / blanco / negro, fondo de espacio con estrellas, galaxia y la
Tierra abajo; título centrado con subtítulo *SPACE SIMULATOR*; versión `v1.0.0`; cinco botones
(Nueva partida, Continuar, Ajustes, Personalizar, Créditos) más Salir; transbordador blanco al
centro-derecha; lema *EXPLORE · DISCOVER · GO FURTHER*; formato 16:9.

### Qué se construyó
1. **Escenario 16:9** de 1600×900 px que se escala con `transform: scale()` para conservar la
   composición en cualquier pantalla.
2. **Fondo generado por código** (`<canvas>`): 900 estrellas fijas, 140 que titilan, galaxia
   espiral, curvatura de la Tierra con atmósfera, continentes, nubes y destello solar. Se pinta
   una sola vez en un lienzo oculto y cada cuadro solo se redibujan las estrellas animadas.
3. **Transbordador en SVG**: fuselaje, panza térmica, cabina, bodega de carga, deriva, alas,
   toberas con llama animada, bandera y emblema de misión. La franja de color y el nombre se
   cambian desde *Personalizar*.
4. **Botones neón** con esquinas recortadas (`clip-path`), iconos SVG y sonido (WebAudio).
5. **Paneles**: Ajustes (volumen de música y efectos, animaciones, pantalla completa, borrar
   partida), Personalizar (color y nombre de la nave), Créditos, confirmación de Salir.
6. **Prototipo de vuelo en primera persona**: vista desde la cabina, estrellas en perspectiva,
   Marte creciendo al acercarse, indicadores de distancia / velocidad / combustible y tres
   finales (órbita lograda, sobrevuelo por exceso de velocidad, a la deriva sin combustible).
7. **Guardado automático** cada 3 s en `localStorage`; *Continuar* retoma la misión.

### Decisiones
- **Tailwind por CDN** (`cdn.tailwindcss.com`): cero instalación, ideal para hackatón. Para
  producción convendría compilar el CSS.
- **Sin imágenes externas**: todo el arte es canvas/SVG, así el juego es un sitio estático ligero.
- **Emblema propio en lugar del logotipo de la NASA**: el logotipo oficial es una marca con
  normas de uso; se dibujó un emblema original de misión en su lugar.
- **Salir**: los navegadores no dejan que una página se cierre sola, así que se muestra una
  pantalla de «sesión finalizada» con opción de volver.
- **Física del prototipo**: el combustible solo se gasta al cambiar de velocidad, lo que
  introduce la primera decisión de ingeniería del reto (cuánto acelerar vs. cuánto reservar
  para frenar).

### Pruebas
Probado en Chrome sin interfaz a 1600×900: menú, panel Personalizar, inicio de partida,
aceleración, llegada a Marte y pantalla de fin de misión, sin errores de JavaScript.

### Pendiente / ideas para la etapa 2
- Fase de **diseño de misión** antes del despegue (carga útil, presupuesto, energía, masa),
  que es el núcleo del reto.
- Eventos durante el viaje (tormentas solares, averías, comunicaciones).
- Nombres reales del equipo en Créditos.

## Etapa 2 · Briefing, telemetría y Fase 1: despegue (14-11-2026)

### Pedido
Al pulsar *Nueva partida*: mensaje del **Instructor Jefe — Control de Misión**, **Manual rápido
de telemetría** (delta-v/combustible, masa total, escudo térmico, soporte vital, potencia
eléctrica) y **Fase 1 — Preparación y despegue**: verificación de capacidad de carga y
presupuesto, autorización, cuenta atrás y despegue visto desde la cabina, con un control para
encender los impulsores y un medidor de combustible en tiempo real que exija control para
escapar de la atmósfera.

### Qué se construyó
1. **Pantalla de briefing** (`js/mission.js`) con tres pasos: bienvenida, manual de telemetría
   (cinco fichas con explicación, consejo del instructor y alerta) y verificación de lanzamiento.
2. **Configuración de misión en Personalizar**: tres vehículos de lanzamiento (capacidad y
   coste distintos) y cuatro módulos opcionales (masa y coste). Presupuesto: 3 500 M$.
3. **Verificación**: `[Verificar capacidad de carga]` y `[Comprobar presupuesto]` calculan con la
   configuración elegida. `[Autorizar lanzamiento]` solo se activa si ambas pasan; si no, aparece
   la alerta y un botón para reconfigurar la nave.
4. **Despegue en primera persona** (`js/launch.js`): la simulación arranca en la cabina con la
   cuenta atrás T-10. Cielo que pasa de azul a negro, nubes que quedan atrás, estelas, vibración,
   resplandor por rozamiento y la curvatura de la Tierra al ganar altura. Instrumentos: altitud,
   velocidad, presión dinámica, integridad y combustible.
5. **Enlace con el segmento espacial**: tras la inserción orbital se pasa al crucero a Marte.

### Decisiones
- **Los «cuatro segmentos»** venían sin enumerar en el texto; se usaron los de la arquitectura
  clásica de una misión: lanzamiento, espacial, terrestre y usuario. Se cambian en `pageIntro()`.
- **Vehículos, módulos, masas y costes son ficticios** y están en la cabecera de `js/mission.js`
  para ajustarlos fácilmente.
- **Modelo de despegue**: densidad `e^(-h/12)`, presión dinámica `rho·v²`; por encima del límite
  la estructura acumula daño, así que a fondo todo el rato se rompe la nave; demasiado tímido,
  la gravedad consume el combustible. El empuje disponible depende del margen de carga
  (masa / capacidad), de modo que la configuración elegida afecta a la dificultad.
- Los parámetros se afinaron con una simulación automática: acelerar a fondo siempre → fallo
  estructural; modulando el empuje → órbita con entre un 10 % y un 30 % de combustible.

### Pruebas
Recorrido completo en Chrome sin interfaz con un piloto automático (soltar impulso cuando la
presión dinámica supera el 85 %): briefing → verificación → cuenta atrás → órbita con 15 % de
combustible e integridad 100 % → paso al segmento espacial. Sin errores de JavaScript.

### Pendiente
- Usar de verdad en vuelo los cinco indicadores del manual (escudo, soporte vital, potencia).
- Fases siguientes: segmento espacial completo, llegada y descenso en Marte, evaluación final.

## Etapa 3 · Cabina ilustrada para la Fase 1 (14-11-2026)

### Pedido
Usar la imagen de cabina aportada por el equipo para el lanzamiento, en primera persona desde
la revisión de cargas. El texto de instrucción para revisar los recursos debe aparecer delante
del monitor; en el monitor, una ventana con el despegue y los porcentajes de combustible y
energía. Mantener el resto de mecánicas y el 2D.

### Qué se cambió
1. **Fondo**: `assets/cockpit.jpg` cubre el escenario de 1600×900 (escalado ×1,61, recorte
   lateral de 24 px).
2. **Verificación en la cabina**: la verificación de carga y presupuesto y la confirmación de
   Control de Misión salen del briefing y aparecen como **holograma** sobre el parabrisas,
   delante del tablero. El briefing queda en dos pasos (bienvenida y telemetría).
3. **Monitores del tablero** (superpuestos exactamente sobre las pantallas de la ilustración):
   - Central: **cámara exterior** del despegue (torre, cohete, nubes, cielo que oscurece, curvatura
     terrestre, llama y plasma) con **combustible %** y **energía %**.
   - Izquierdo: altitud y velocidad. Derecho: presión dinámica e integridad.
   - Placa superior: reloj de misión (T-10 … T+). Pantalla lateral derecha: botón **IMPULSORES**
     (bloqueado → listo → encendidos).
4. **Hologramas** en el parabrisas para la cuenta atrás y los avisos.
5. **Energía**: nuevo indicador; baja con la aviónica y más con los motores encendidos (menos si
   se llevan paneles solares extra). En esta fase es informativo, no provoca fallos.

### Sin cambios
Física del despegue (empuje, combustible, presión dinámica, gravedad), condiciones de éxito y
fallo, y paso al segmento espacial.

### Pruebas
Recorrido completo en Chrome sin interfaz con piloto automático: verificación → confirmación →
cuenta atrás → órbita (combustible 15 %, energía 88 %, integridad 100 %) → segmento espacial.
Se comprobó que el holograma de verificación cabe sin barra de desplazamiento.

## Etapa 4 · Vista exterior animada por las ventanas (14-11-2026)

### Pedido
Cambiar lo que se ve fuera de las ventanas: cielo al principio y, al salir a órbita, el espacio.
Añadir animaciones.

### Qué se hizo
1. **Cristales transparentes**: a partir de la imagen de cabina se generó una máscara de las
   ventanas (detección de las zonas oscuras del espacio pintado, recortada al contorno del
   tablero) y se exportó como `assets/cockpit.webp` con canal alfa. Los hologramas pintados en
   el parabrisas original se eliminaron para que el cristal quede limpio.
2. **Lienzo detrás de la cabina** (`js/sky.js`), dibujado en cada cuadro según la altitud y la
   velocidad del despegue:
   - Cielo azul diurno que se oscurece hasta el negro del espacio (de 0 a ~75 km).
   - Torre de lanzamiento en la ventana izquierda con baliza parpadeante; cae al despegar.
   - Vapor durante la cuenta atrás y humo al encender los motores.
   - Nubes de cúmulos que derivan con el viento, se acercan y pasan hacia abajo al atravesarlas.
   - Estelas de condensación en el cristal según la densidad del aire y la velocidad.
   - Resplandor naranja de plasma cuando la presión dinámica es alta; reflejo de los motores.
   - Inclinación progresiva del horizonte (giro de gravedad).
   - Estrellas que aparecen y titilan, Sol con rayos y destellos de lente.
   - La Tierra asomando por abajo con su atmósfera, nubes y continentes que se desplazan.
3. La vibración de la cabina mueve también la vista exterior.

### Sin cambios
Física, controles, monitores y condiciones de éxito y fallo de la Fase 1.

### Pruebas
Recorrido completo con piloto automático, con capturas en plataforma, atravesando nubes,
cielo oscureciéndose y en órbita con la Tierra visible. Sin errores de JavaScript.

## Etapa 5 · Segmento espacial, viaje, descenso y evaluación final (14-11-2026)

### Pedido
Secciones 3.2 a 7 del guion: configuración de la nave interplanetaria, Fase 2 con tres eventos
críticos, Fase 3 de descenso en Marte, reporte final, resultados A-D y mensaje final. Con estas
condiciones: interior de la nave en primera persona y 2D, cada recurso en una parte distinta de
la nave, panel de alertas para ir directo a reponer lo que esté crítico, el jugador se mueve por
la nave, sin fases de solo texto (los textos van encima de la vista) y, en el descenso, de
nuevo piloto en la misma cabina con los datos en los monitores y control manual.

### Qué se construyó
1. **Interior de la nave** (`js/ship.js`): seis salas dibujadas en perspectiva con canvas, cada
   una con su equipo animado y su color: Puente (nave principal, navegación, comunicaciones),
   Soporte vital (oxígeno), Sala de energía (potencia), Propulsión (delta-v), Hangar (lander y
   escudo térmico) y Laboratorio (instrumentos). Se recorre con A/D, las puertas o el minimapa.
2. **3.2 Configuración**: en cada sala se elige el nivel de su componente. Indicadores de masa,
   presupuesto, delta-v, oxígeno, potencia, escudo e instrumentos siempre visibles. En el Puente,
   *Verificar y confirmar diseño* muestra el consejo de configuración como lista de comprobación
   y la confirmación de Control de Misión con los valores reales → `[INICIAR VIAJE A MARTE]`.
3. **Fase 2 · Viaje**: 210 días en 150 s. El oxígeno, la energía y la señal bajan con el tiempo;
   hay una fuga de propelente, impactos de micrometeoritos en el escudo y un fallo de instrumento.
   Cada cosa se repone en su sala manteniendo E (regenerar oxígeno gasta energía; reparar escudo
   e instrumentos gasta repuestos). El **panel de alertas** lista lo crítico y cada alerta lleva
   andando hasta la sala. Los tres **eventos críticos** aparecen como diálogo sobre la vista al
   llegar a la sala indicada; la decisión incorrecta penaliza y la anomalía sigue activa.
4. **Fase 3 · Descenso** (`js/edl.js`), en la misma cabina: paso 1 mantener el ángulo de entrada
   en el corredor para cuidar el escudo; paso 2 abrir el paracaídas en la ventana de altitud;
   pasos 3-4 retropropulsores hasta tocar suelo a menos de 4 m/s. Monitores con altitud,
   velocidad, temperatura, escudo, combustible y energía; por las ventanas, plasma, cielo
   marciano, superficie y polvo.
5. **Reporte final y cierres**: resumen de telemetría, evaluación de los cuatro segmentos,
   eficiencia y calificación; Resultado A (graduación), B (lanzamiento), C (viaje), D (descenso),
   y mensaje final con `[VOLVER AL INICIO]`. Todos como paneles sobre la vista del jugador.

### Decisiones
- **Configuración unificada**: los módulos que antes estaban en Personalizar se sustituyen por
  los componentes del guion, que se eligen a bordo. Personalizar conserva el lanzador. La
  verificación de la Fase 1 usa la misma configuración (por defecto, una equilibrada que cumple).
- **Valores inventados** (masas, costes, kW, delta-v, días) en la cabecera de `js/mission.js`.
- **Presupuesto de delta-v**: 3,6 km/s para salir de la órbita, 0,3 por corrección y el resto
  es el propelente del descenso.
- **Eventos**: la opción correcta es siempre la A, como en el guion.
- **Resultado no previsto en el guion**: si se aterriza pero con menos del 50 % de objetivos
  científicos o de eficiencia, se muestra «Misión parcial» sin graduación.
- Se eliminó el prototipo de crucero de la etapa 1 (`js/game.js`), sustituido por todo lo anterior.
- **Continuar** retoma desde el inicio de la fase alcanzada (configuración, viaje o descenso).

### Pruebas
Partida completa automatizada en Chrome sin interfaz: configuración → viaje (tres eventos
resueltos, alertas atendidas) → descenso → reporte (calificación «Notable») → graduación →
mensaje final → menú. Sin errores de JavaScript. La dificultad con jugadores reales no está
afinada: los ritmos de consumo son una primera estimación.

## Etapa 6 · Mejora de diseño del interior de la nave (14-11-2026)

### Pedido
[Issue #2 — «Mejora de diseño de la nave»](https://github.com/xokiialegc/Space-Apps-Equipo-7/issues/2):
rediseñar el interior de la nave en 2D manteniendo exactamente la composición, la perspectiva y
los elementos ya colocados; añadir detalles estructurales limpios, tuberías metálicas
industriales, bandejas y mazos de cables ordenados por paredes y techo, y paneles técnicos
sutiles; arte 2D plano o semiplano con iluminación ambiental técnica y limpia, sin alterar los
objetos principales.

### Qué se construyó
Una capa de detalle (`detailLayer` en `js/ship.js`) que se dibuja sobre el casco de las seis
salas y por debajo de las puertas y del equipo de cada sala:
- **Techo**: dos bandejas portacables con mazos de seis cables y bridas, dos conductos metálicos
  con abrazaderas, dos tubos finos y juntas de panel.
- **Paredes laterales**: tubería gruesa con bridas en las costillas, tubería fina con
  abrazaderas y un mazo de cables sobre las puertas; a cada lado de la puerta, paneles técnicos
  con rejilla, testigo de estado y registro de mantenimiento, y un conducto bajo junto al suelo.
- **Mamparo del fondo**: las tuberías y el mazo de cables de las paredes continúan de lado a
  lado; juntas de panel y un zócalo de seis paneles técnicos.
- **Suelo**: placas del pasillo y guías de luz junto a las paredes.
- **Iluminación**: baño ambiental frío desde el techo y regletas en las aristas del techo.

### Decisiones
- El issue no adjunta imagen: se tomó como «imagen base» el interior que ya dibuja el juego. No
  se movió ni se cambió ninguna sala, puerta, luz de techo, equipo, consola ni indicador.
- El metal es gris azulado neutro; el color propio de cada sala solo aparece en un cable, los
  testigos y las guías del suelo, para que las salas sigan distinguiéndose.
- La capa es estática: se pinta una vez por sala en un lienzo aparte y luego se reutiliza, así
  que no cuesta rendimiento.

### Pruebas
Las seis salas renderizadas en Chrome sin interfaz, sin errores de JavaScript del juego.

## Etapa 7 · Hangar de lanzamiento: personalización del cohete (15-11-2026)

### Pedido
Que el botón «Personalizar» abra una pantalla propia en lugar del panel sobre el menú: fondo 2D
con una plataforma de lanzamiento y el cohete elegido en el centro, título «AEON-01», carrusel de
cohetes bajo el título, panel para cambiar el color principal en tiempo real y aplicar
calcomanías sobre el fuselaje, y un botón «Menú Principal» que vuelva al inicio. Como referencia
de distribución se adjuntó una captura del menú de un juego de carreras, y como naves, tres
imágenes para pasar a 2D.

### Qué se construyó
1. **Cohetes en 2D** (`js/rockets.js`): tres cohetes dibujados por código, sin imágenes, con
   volumen por degradado. **Apollo 11** (Saturno V: tres etapas, bandas negras, módulos de
   servicio y de mando, torre de escape), **X** (nave de acero con cuatro aletas) y **Centella**
   (avión espacial de ala delta, diseño propio).
2. **Hangar de lanzamiento** (`js/custom.js`, pantalla `#screen-custom`): atardecer en el
   complejo de lanzamiento con torre de servicio, brazos que llegan al fuselaje, focos, vapor de
   los depósitos y luces de plataforma. Título y botón «Menú Principal» arriba; debajo, el
   carrusel con miniatura, nombre, capacidad y coste de cada cohete.
3. **Color principal**: librea original, ocho colores y un selector libre. Se aplica al instante
   al cohete de la plataforma y a su miniatura, y también a la franja de la nave del menú y del
   traje del cadete.
4. **Calcomanías**: seis diseños propios (Emblema AEON, Equipo 7, Destino Marte, Estrella,
   Galones, Rayo) y «Tu imagen», que carga un archivo del jugador reducido a 160 px. Hasta tres a
   la vez, en posiciones fijas del fuselaje; la cuarta sustituye a la más antigua.
5. **Cámara exterior del despegue** (`js/launch.js`): muestra el cohete elegido con su color.

### Decisiones
- **El cohete es el vehículo de lanzamiento.** El panel anterior tenía tres lanzadores (ARES-M,
  ARES-H, TITAN-X) que fijaban capacidad y coste. Para no tener dos selectores de cohete, cada
  cohete del carrusel ocupa uno: Centella 70 t / 900 M$, Apollo 11 100 t / 1 400 M$ y X 130 t /
  2 100 M$. Las cifras y los identificadores internos no cambian, así que las partidas guardadas
  siguen valiendo.
- **Primera nave.** La imagen era un X-wing de Star Wars, un diseño con derechos de autor; no se
  dibujó. Su casilla la ocupa Centella, un diseño original.
- **Logotipo de la NASA.** No se incluyó como calcomanía: las condiciones de Space Apps prohíben
  usar la insignia y otros identificadores de la NASA sin permiso expreso por escrito
  (https://www.spaceappschallenge.org/navigator-terms-conditions/).
- **Referencia de menú.** Se tomó solo la distribución (título, botón de menú, tira de casillas,
  vehículo sobre plataforma); la tipografía, los colores y los paneles son los de AEON-01.
- **Tamaños.** Los cohetes no están a escala entre sí: se dibujan para que los tres se vean bien
  en la plataforma.

### Pruebas
Automatizadas en Chrome sin interfaz: abrir desde «Personalizar», carrusel con flechas en
pantalla, teclado y clic, cambio de color medido en los píxeles del cohete, selector libre,
calcomanías (aplicar, quitar, límite de tres), carga de una imagen propia, nombre, vuelta al menú
con el botón y con Esc, conservación al recargar y cohete elegido en la verificación y la cámara
del despegue. Sin errores de JavaScript. No se probó en un móvil físico.

## Etapa 8 · Movimiento libre por el interior de la nave (14-11-2026, integrada el 15-11-2026)

### Pedido
Issue #1: que el personaje se mueva de forma libre y fluida entre habitaciones, sin saltos de
cámara. Mapa continuo en vista lateral con salas conectadas por puertas, control directo con A/D
o las flechas al levantarse del asiento del piloto (E), cámara que sigue al personaje e
interacción por proximidad (E o Espacio cuando aparece el indicador), sin romper el vuelo ni las
fases que ya funcionaban.

### Qué se construyó
1. **Mapa lateral continuo** (`js/ship.js`): la nave en corte, de proa a popa, 6 300 px de
   mundo. Morro con parabrisas, tablero y asiento del piloto; seis salas con sus mamparos y
   puertas correderas que se abren al acercarse; popa con el bloque de motores, encendidos
   durante el viaje. El equipo de cada sala es el mismo dibujo de la etapa 5, ahora sobre la
   pared del fondo. Orden nuevo, de izquierda a derecha: Puente, Soporte vital, Laboratorio,
   Hangar, Energía y Propulsión.
2. **Cadete**: astronauta dibujado por código con animación de caminar, espera, trabajo y
   sentado. Se empieza sentado a los mandos; `E` lo levanta. Velocidad de 470 px/s con arranque
   y frenada suaves.
3. **Cámara**: sigue al cadete con suavizado y un pequeño adelanto en el sentido de la marcha; se
   desplaza para dejar sitio cuando hay una consola abierta.
4. **Interacción por proximidad**: siete puestos (asiento del piloto y una consola por sala). A
   menos de 125 px aparece el indicador con la acción disponible. En la configuración, `E` abre
   la consola del componente y alejarse la cierra. En el viaje, hay que mantener `E` junto al
   panel averiado, y los eventos críticos se atienden en su puesto: comunicaciones en la consola
   del puente, tormenta solar en la sala de energía y desviación de trayectoria en el asiento
   del piloto. Al llegar a Marte hay que volver al asiento para pilotar el descenso.
5. **Alarmas en el mapa**: cada módulo tiene su baliza y sus luces; con una avería activa la
   sala entera parpadea en rojo y se ve desde las salas vecinas. Sobre cada consola flota su
   lectura en tiempo real.
6. **Alertas y minimapa**: el minimapa es proporcional a la nave y marca la posición del cadete;
   pulsarlo, o pulsar una alerta, lo lleva andando hasta el puesto. Cualquier tecla de
   movimiento cancela ese paseo.

### Integración con la etapa 6 (issue #2)
La etapa 6 añadió tuberías, cables y paneles a las salas en primera persona, que este cambio
sustituye por el mapa lateral. Para no perder ese trabajo, el detalle se llevó a la vista nueva
con los mismos materiales y colores (`detailLayer` en `js/ship.js`):
- **Pared del fondo de cada sala**: tubería gruesa con bridas, tubería fina con abrazaderas y
  bandeja portacables con su mazo, de mamparo a mamparo; paneles técnicos con rejilla, testigo y
  registro de mantenimiento junto a las puertas; zócalo de paneles técnicos; guía de luz junto
  al suelo y baño de luz ambiental fría.
- **Techo del casco**: bandeja de cables y conducto metálico con bridas a lo largo de la nave.

Lo que no se pudo conservar es la condición del issue #2 de mantener la composición y la
perspectiva: el issue #1 pide justo cambiarlas. La capa de las paredes laterales y del suelo en
perspectiva no tiene equivalente en una vista en corte. Es una decisión de equipo: si se
prefiere la vista en primera persona, basta con no fusionar este cambio.

### Decisiones
- **Base**: el issue describe un único `index.html`; se trabajó sobre AEON-01 y se mantuvo la
  estructura de archivos, por decisión del equipo.
- **Una sola cubierta**: no hay escaleras ni gravedad cero; el issue lo dejaba como opcional.
- **Eventos críticos con tecla**: ya no se abren solos al entrar en la sala.
- **Fuga de propelente**: pierde 0,013 km/s por segundo en lugar de 0,022, porque ahora hay que
  cruzar la nave andando para sellarla (hasta unos 12 s de proa a popa).
- **Sin cambios** en el menú, el briefing, el despegue, el descenso y el reporte final, ni en el
  resto de consumos y reglas del viaje.

### Pruebas
Automatizadas en Chrome sin interfaz, manejando el juego solo con teclado, ratón y lo que se ve
en pantalla: configuración completa (levantarse, cruzar la nave, abrir consolas, diseño rechazado
y corregido, confirmar), viaje completo a velocidad real y acelerada (alertas, reparaciones, los
tres eventos, una respuesta incorrecta y su reintento, vuelta al asiento y paso al descenso),
fallo por recursos agotados, botones táctiles, Esc y Continuar. Sin errores de JavaScript. El
despegue y el descenso no se volvieron a jugar enteros: su código no se tocó. No se probó con
jugadores reales ni en un móvil físico.

## Etapa 9 · Tripulación: NPC con IA de reparación y avatares (15-11-2026)

### Pedido
Issue #5: añadir avatares para el personaje principal y para los NPC (en la interfaz de estado,
en los diálogos o como iconos flotantes) y de uno a dos NPC tripulantes que caminen libremente
por el mapa lateral; cuando un recurso o componente entre en alerta o avería, el NPC más cercano
debe detectarlo, caminar hasta allí y simular la reparación. Nombres ficticios para los NPC.

### Qué se construyó
1. **Avatares** (`js/avatars.js`): retrato del cadete, de **Vera Kalani** (ingeniera de vuelo,
   traje naranja) y de **Iker Solano** (técnico de sistemas, traje verde agua), dibujados por
   código en un lienzo. El del cadete usa el color de acento de los ajustes.
2. **Dónde se ven**: barra de tripulación con retrato, cargo y estado de cada uno; tarjetas de
   presentación en los diálogos de la configuración y del viaje; retrato del cadete junto a
   «Decisión del cadete» en los eventos críticos; mensajes de radio de los NPC; etiqueta
   flotante con retrato y nombre sobre cada NPC, y un punto de su color en el minimapa.
3. **NPC** (`js/ship.js`): dos astronautas con el mismo dibujo animado del cadete y su propio
   color. Pasean por toda la nave (eligen un punto, caminan, esperan) y las puertas se abren a
   su paso. Están en la configuración y en el viaje.
4. **IA de reparación** (solo en el viaje): cada avería del panel de alertas (oxígeno, energía,
   comunicaciones, fuga de propelente, escudo, instrumento) tiene su tarea. El NPC libre más
   cercano la detecta (signo «!» y aviso por radio), camina hasta el panel y trabaja hasta
   dejarla resuelta; después vuelve a pasear. Solo va un NPC por avería.

### Decisiones
- Los NPC reaccionan cuando salta la alarma, no antes; caminan más despacio que el cadete y
  reparan a algo más de la mitad de su ritmo. Así ayudan sin quitarle el trabajo al jugador.
- Reponen oxígeno, energía y señal hasta un nivel seguro (60-75 %), no hasta el máximo.
- Gastan los mismos repuestos que el cadete para el escudo y los instrumentos.
- No atienden los eventos críticos de Control de Misión: esa decisión es del cadete. Con el
  evento de comunicaciones activo, tampoco reapuntan la antena.
- La imagen de avatares enlazada en el issue no se pudo descargar desde el entorno de trabajo,
  así que los retratos se dibujaron por código. `FILES`, en `js/avatars.js`, permite sustituir
  cada retrato por un archivo de imagen sin tocar nada más.

### Pruebas
Prueba automática en Chrome: configuración (los NPC pasean y aparecen en la barra y el minimapa),
un viaje entero sin tocar las averías (los NPC sellaron la fuga, recalibraron el instrumento,
repusieron oxígeno y repararon el escudo) y otro atendiendo solo los tres eventos críticos, que
llegó a Marte. Sin errores de JavaScript. El despegue y el descenso no se tocaron ni se
volvieron a jugar. No se probó con jugadores reales ni en un móvil.


## Etapa 10 · Auditoría de datos frente a NASA y ESA (15-11-2026)

### Pedido
Issue #6: revisar el código completo como lo haría un auditor técnico de la NASA, comparar cada
constante y fórmula con datos oficiales, entregar una tabla comparativa y corregir lo que un
jurado pudiera cuestionar.

### Qué se construyó
1. **Informe** (`docs/AUDITORIA_NASA.md`): 27 datos comparados con sus fuentes. 9 exactos,
   9 aproximados, 8 corregidos y un grupo de valores ficticios.
2. **Constantes en un solo sitio** (`js/datos.js`): el resto del código las lee de `AEON.REAL`.
3. **Correcciones**: altura de escala de la atmósfera (12 → 8,5 km), gravedad derivada de g₀,
   capacidad del Saturno V (100 → 118 t), delta-v calculado con la ecuación de Tsiolkovski y un
   impulso específico de 450 s, temperatura del escudo (1 700 → 1 300 °C), ventana del
   paracaídas centrada en 11 km y dos textos (distancia recorrida y llegada a Marte).

### Decisiones
- Al corregir la atmósfera hubo que bajar `Q_LIMIT` de 0,8 a 0,6: sin ese ajuste, subir a fondo
  dejaba de romper la nave y se perdía la mecánica de modular el empuje.
- El delta-v dependía solo del tanque. Ahora depende también de la masa de la nave. Para que la
  masa cuadre con la ecuación del cohete, el propelente se carga en la estación orbital y el
  lanzador sube la nave en seco. Las cargas se eligieron para que la nave por defecto conserve
  los valores de antes.
- No se tocaron el fin del paracaídas (70 m/s a 1,2 km) ni la tolerancia de contacto (4 m/s):
  con los valores reales, una nave con tanques S no podría aterrizar. Quedan declarados como
  aproximaciones.
- Los costes y las masas de los módulos se dejan como ficticios y así se indica.

### Pruebas
Las 34 992 combinaciones de diseño calculadas en Node (5 065 viables). Partida automática en
Chrome: despegue a fondo (falla) y modulado (órbita en 39 s), consola de Propulsión, descenso
completo con paracaídas a 11 km y reporte final. Sin errores de
JavaScript propios. El viaje interplanetario no se volvió a jugar entero. La prueba se hizo sin
conexión, con un sustituto mínimo de Tailwind, así que el aspecto final no se verificó con la
hoja de estilos real. No se probó con jugadores reales ni en un móvil.

### Cambio posterior
A petición del equipo se retiró del menú el botón «Datos reales» y su tabla. Las correcciones
y las constantes de `js/datos.js` se mantienen; la comparación queda en `docs/AUDITORIA_NASA.md`.
