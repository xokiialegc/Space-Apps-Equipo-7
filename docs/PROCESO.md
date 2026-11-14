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
