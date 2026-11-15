# Auditoría técnica de AEON-01: datos del juego frente a NASA, ESA y otras fuentes oficiales

Responde al [issue #6](https://github.com/xokiialegc/Space-Apps-Equipo-7/issues/6). Fecha: 15-11-2026.

## Resumen

Se revisó todo el código del simulador (`index.html`, `css/` y los diez archivos de `js/`) y se
compararon con fuentes oficiales los 27 datos físicos o técnicos que contiene.

| Veredicto | Cuántos | Qué significa |
|---|---|---|
| Exacto | 9 | Coincide con el valor oficial (desviación ≤ 1,5 %). |
| Aproximado | 9 | Simplificación aceptable para un juego en tiempo real; se explica en la sección 4. |
| Corregido | 8 | Era incorrecto o indefendible ante un jurado. Ya está corregido en el código. |
| Ficticio | 1 grupo | Costes, masas de módulos y cohetes inventados: no existe valor oficial. |

Las ocho correcciones están aplicadas en esta rama.

Aviso sobre el issue: pedía auditar «densidad atmosférica por capas», «empuje» e «impulso
específico». El juego no tenía capas atmosféricas (usa una sola exponencial), ni empuje en
newtons, ni impulso específico. La atmósfera de una capa se mantiene como aproximación; el
impulso específico se ha añadido porque hacía falta para que el delta-v fuera físicamente correcto.

## 1. Método

- Todas las constantes físicas se han movido a un único archivo, `js/datos.js` (`AEON.REAL`).
  El resto del código las lee de ahí, así que cada número tiene una sola definición y una fuente.
- Desviación = (valor del juego − valor oficial) / valor oficial.
- «Cumple» = un jurado puede comprobar el dato en la fuente citada y coincide, o la simplificación
  está declarada.

## 2. Tabla comparativa: código frente a realidad

### Despegue (Tierra) — `js/launch.js`

| Parámetro | Antes en el código | Ahora en el código | Valor oficial | Desviación | Veredicto |
|---|---|---|---|---|---|
| Gravedad | `GRAV = 0.08` km/s², sin origen | `G0/1000 × 8` = 0,0785 km/s² de juego | g₀ = 9,80665 m/s² (NASA, exacto por definición) | 0 % | Corregido |
| Altura de escala de la atmósfera | 12 km | 8,5 km | 8,5 km (NASA Earth Fact Sheet) | antes +41 %, ahora 0 % | Corregido |
| Densidad del aire | `e^(−h/12)` | `e^(−h/8,5)` | atmósfera real por capas | — | Aproximado |
| Línea de Kármán | 100 km | 100 km | 100 km (FAI); NASA y la USAF usan 80 km | 0 % | Exacto |
| Velocidad orbital en órbita baja | 7,8 km/s | 7,8 km/s | 7,73 km/s a 300 km (con el GM de NASA) | +1 % | Exacto |
| Gravedad efectiva en ascenso | `g·(1 − v²/v_orb²)` | igual | g − v²/r | — | Aproximado |
| Presión dinámica | `ρ·v²` | igual | q = ½·ρ·v² | — | Aproximado |
| Duración del ascenso | ≈ 40 s | ≈ 40 s | varios minutos | — | Aproximado |
| Saturno V: carga a órbita baja | 100 t | 118 t | 118 t (NASA) | antes −15 %, ahora 0 % | Corregido |
| Saturno V: tres etapas, julio de 1969 | correcto | igual | correcto | 0 % | Exacto |

### Viaje interplanetario — `js/mission.js`, `js/ship.js`

| Parámetro | Antes en el código | Ahora en el código | Valor oficial | Desviación | Veredicto |
|---|---|---|---|---|---|
| Δv de inyección a Marte | 3,6 km/s | 3,6 km/s | ≈ 3,6 km/s desde órbita baja | 0 % | Exacto |
| Velocidad tras la inyección | 7,8 + 3,6 = 11,4 km/s | igual | escape de la Tierra: 11,186 km/s (NASA) | — | Exacto (coherente) |
| Δv de la nave | fijo por tanque: 4,5 / 6,0 / 7,5 km/s | `Isp·g₀·ln(m₀/m_f)` | ecuación de Tsiolkovski | — | Corregido |
| Impulso específico | no existía | 450 s | 449,7–465,5 s (motor RL10, vacío) | 0 % | Exacto |
| Duración del viaje | 210 días | 210 días | 203 días (Perseverance) | +3 % | Aproximado |
| Distancia recorrida | «millones de kilómetros» | «más de 470 millones de kilómetros» | 472 millones de km (Perseverance) | 0 % | Corregido |
| Llegada a Marte | «Órbita de Marte: alcanzada» | «Aproximación a Marte: completada» | entrada directa, sin inserción orbital | — | Corregido |

### Descenso en Marte — `js/edl.js`

| Parámetro | Antes en el código | Ahora en el código | Valor oficial | Desviación | Veredicto |
|---|---|---|---|---|---|
| Gravedad de Marte | 3,71 m/s² | 3,71 m/s² | 3,73 media, 3,69 ecuador (NASA); 3,71 (ESA) | −0,5 % | Exacto |
| Altitud de entrada | 125 km | 125 km | ≈ 130 km (Perseverance) | −4 % | Aproximado |
| Velocidad de entrada | 5,5 km/s | 5,5 km/s | 19 500 km/h = 5,42 km/s (Perseverance) | +1,5 % | Exacto |
| Temperatura máxima del escudo | 1 700 °C en el monitor; «1.600 °C» en el manual | 1 300 °C en ambos | ≈ 1 300 °C (Perseverance) | antes +31 %, ahora 0 % | Corregido |
| Paracaídas: altitud de apertura | ventana 9,2–7,4 km | ventana 11,9–10,1 km | ≈ 11 km (Perseverance) | antes −25 %, ahora 0 % | Corregido |
| Paracaídas: velocidad de apertura | ≈ 420 m/s | ≈ 420 m/s | 1 512 km/h = 420 m/s | 0 % | Exacto |
| Fin de la fase de paracaídas | 70 m/s a 1,2 km | igual | 320 km/h = 89 m/s, a 2,1 km | −21 % | Aproximado |
| Velocidad de contacto | < 4 m/s | igual | 2,7 km/h = 0,75 m/s (grúa aérea) | — | Aproximado |
| Duración del descenso | ≈ 1 min | igual | ≈ 7 min | — | Aproximado |

### Diseño de la misión

| Parámetro | Valor | Veredicto |
|---|---|---|
| Costes en M$, masas de cada módulo, cohetes Centella y X, potencias en kW, días de soporte vital | propios del juego | Ficticio: sirven para equilibrar el juego y no se presentan como datos reales |

## 3. Correcciones aplicadas

### 3.1 Altura de escala de la atmósfera y gravedad — `js/launch.js`

Antes:

```js
const V_ORBIT = 7.8, H_SPACE = 100;
const GRAV = 0.08, DRAG = 0.04, Q_LIMIT = 0.8, STRESS_RATE = 25;
const rho = Math.exp(-st.h / 12);
```

Ahora:

```js
const R = A.REAL;
const V_ORBIT = R.V_LEO, H_SPACE = R.KARMAN, H_SCALE = R.EARTH_SCALE_H;   // 7,8 km/s · 100 km · 8,5 km
const GRAV = R.G0 / 1000 * R.LAUNCH_TIME_SCALE;                           // 9,80665 m/s² × 8
const DRAG = 0.04, Q_LIMIT = 0.6, STRESS_RATE = 25;
const rho = Math.exp(-st.h / H_SCALE);
```

- Con 12 km el aire del juego tardaba un 41 % más de altura en enrarecerse que el real.
- `0.08` no tenía origen. Ahora es g₀ multiplicada por la escala de tiempo del despegue: un
  segundo de juego equivale a unos ocho reales, y por eso las aceleraciones van multiplicadas
  por ocho. El valor resultante (0,0785) cambia un 2 %.
- `Q_LIMIT` no es un dato físico: es el límite estructural en unidades del juego. Se bajó de 0,8
  a 0,6 para que, con la atmósfera corregida, subir a fondo siga rompiendo la nave. Sin ese
  ajuste la lección de «modular el empuje» desaparecía.
- `js/sky.js` usaba el mismo 12 para las estelas de aire y también lee ya `EARTH_SCALE_H`.

### 3.2 Delta-v con la ecuación de Tsiolkovski — `js/mission.js`

Antes, cada tanque daba un delta-v fijo, pesara lo que pesara la nave:

```js
prop: [{ n: 'Tanques S', mass: 14, cost: 240, dv: 4.5 }, { n: 'Tanques M', mass: 20, cost: 300, dv: 6.0 }, { n: 'Tanques L', mass: 27, cost: 380, dv: 7.5 }],
// ...
dv: pick.prop.dv, dvOk: pick.prop.dv >= DV_NEEDED,
```

Era el error más cuestionable: con 20 t de tanques en una nave de 94 t es imposible obtener
6 km/s con un motor químico (la ecuación del cohete da cerca de 1 km/s).

Ahora:

```js
// mass = tanques vacíos (lo que sube el lanzador); fuel = propelente que se carga en la estación orbital.
prop: [{ n: 'Tanques S', mass: 14, cost: 240, fuel: 160 }, { n: 'Tanques M', mass: 20, cost: 300, fuel: 270 }, { n: 'Tanques L', mass: 27, cost: 380, fuel: 450 }],
// ...
const dv = Math.round(A.REAL.rocketDv(mass, pick.prop.fuel) * 100) / 100;      // Δv = Isp·g₀·ln(m₀/m_f)
```

y en `js/datos.js`:

```js
REAL.VE = REAL.ISP * REAL.G0 / 1000;                              // 450 s × 9,80665 = 4,413 km/s
REAL.rocketDv = (dry, prop) => REAL.VE * Math.log((dry + prop) / dry);
```

- La masa que sube el lanzador es la masa seca. El propelente se carga en la estación orbital
  de la que parte la misión según el briefing, así que no cuenta para la capacidad del cohete.
- Las cargas de propelente se eligieron para que la nave por defecto (94 t) conserve los valores
  de antes: 4,57 / 5,97 / 7,49 km/s. Lo nuevo es que una nave más pesada obtiene menos con los
  mismos tanques (de 3,80 a 8,44 km/s según el diseño), que es lo que ocurre en la realidad.
- La consola de Propulsión muestra impulso específico, masa seca, propelente y delta-v
  resultante; el manual de telemetría explica la fórmula.

### 3.3 Capacidad del Saturno V — `js/mission.js`

```js
// antes
{ id: 'ares-h', name: 'APOLLO 11', cap: 100, cost: 1400 },
// ahora
{ id: 'ares-h', name: 'APOLLO 11', cap: A.REAL.SATURN_V_LEO, cost: 1400 },   // 118 t a órbita baja (NASA)
```

El cohete se llama «Apollo 11 · Saturno V · 1969» y su ficha cita la misión real, así que su
capacidad debe ser la real. El cohete X sigue siendo el de mayor carga (130 t).

### 3.4 Temperatura del escudo térmico — `js/edl.js`, `js/mission.js`

```js
// antes: pico de 1.700 °C
$('#l-q').textContent = Math.round(20 + e.heat * 1680 - (e.stage > 1 ? 70 : 0));
// ahora: pico de 1.300 °C
$('#l-q').textContent = Math.round(20 + e.heat * (R.PEAK_HEAT_C - 20) - (e.stage > 1 ? 70 : 0));
```

El manual de telemetría decía «pueden superar los 1.600 °C»; ahora dice «unos 1.300 °C en la
superficie del escudo (dato de la misión Perseverance de la NASA, 2021)».

### 3.5 Apertura del paracaídas — `js/edl.js`

```js
// antes: empieza a 11 km, ventana 9,2–7,4 km, apertura forzada a 5,5 km
E.chute = E.h > 9.2 ? 'rip' : E.h >= 7.4 ? 'ok' : 'late';
// ahora: empieza a 13,7 km, ventana 11,9–10,1 km (centrada en 11 km), apertura forzada a 8,2 km
const CH_TOP = R.CHUTE_H + 2.7, CH_HI = R.CHUTE_H + 0.9, CH_LO = R.CHUTE_H - 0.9, CH_END = R.CHUTE_H - 2.8;
E.chute = E.h > CH_HI ? 'rip' : E.h >= CH_LO ? 'ok' : 'late';
```

La ventana mide lo mismo y dura lo mismo que antes: la dificultad no cambia. Al pasar por 11 km
la velocidad del juego es de 423 m/s, frente a los 420 m/s reales.

### 3.6 Textos

- `js/ship.js`: «Hemos recorrido millones de kilómetros» → «más de 470 millones de kilómetros».
- `js/ship.js`: «Órbita de Marte: ALCANZADA» → «Aproximación a Marte: COMPLETADA». La nave entra
  directamente en la atmósfera a 5,5 km/s, igual que Perseverance; no gasta los ~2 km/s que
  costaría frenar para entrar en órbita.

## 4. Aproximaciones que se mantienen

Ninguna es un error; son simplificaciones que conviene decir en voz alta si el jurado pregunta.

- **Tiempo comprimido.** El ascenso dura unos 40 s, el viaje 150 s y el descenso cerca de un
  minuto. Las velocidades y altitudes mostradas son reales; los tiempos no.
- **Atmósfera de una sola capa.** `ρ = e^(−h/H)` con H constante. Es el modelo isotermo
  habitual; la atmósfera real cambia de temperatura por capas.
- **Ascenso en una dimensión.** No hay giro de gravedad: la velocidad «vertical» hace también de
  velocidad orbital. El término `g·(1 − v²/v_orb²)` reproduce que el peso aparente se anula al
  alcanzar la velocidad orbital.
- **Presión dinámica sin el ½ y en porcentaje.** Solo importa la proporción respecto al límite.
- **Empuje.** Es una aceleración constante de juego (0,285–0,375 km/s² de juego), no un empuje
  en newtons. El consumo es un 2,3 % del combustible por segundo de encendido.
- **Fin del paracaídas a 70 m/s y 1,2 km.** Perseverance soltó el paracaídas a unos 89 m/s y
  2,1 km. Se dejó así porque con los valores reales una nave con tanques S no tendría propelente
  para el frenado final.
- **Contacto a menos de 4 m/s.** Es la tolerancia del juego. Perseverance tocó suelo a 0,75 m/s
  colgado de una grúa aérea.
- **Viaje de 210 días.** Entre los 203 de Perseverance y los 259 de una transferencia de Hohmann
  ideal.

## 5. Fuentes

1. NASA NSSDCA, *Earth Fact Sheet* — https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
   (g₀, altura de escala 8,5 km, velocidad de escape 11,186 km/s, GM).
2. NASA NSSDCA, *Mars Fact Sheet* — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
   (gravedad 3,73 y 3,69 m/s², escape 5,03 km/s).
3. NASA-JPL, *Mars 2020 Perseverance Landing Press Kit* —
   https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission
   (entrada a 19 500 km/h; paracaídas a 11 km y 1 512 km/h, 240 s después de la entrada).
4. NASA-JPL, *Touchdown! NASA's Mars Perseverance Rover Safely Lands on Red Planet* —
   https://www.jpl.nasa.gov/news/touchdown-nasas-mars-perseverance-rover-safely-lands-on-red-planet/
   (203 días, 472 millones de km).
5. NASA, *10 Things: Rockets We Love — Saturn V* —
   https://solarsystem.nasa.gov/news/382/10-things-rockets-we-love-saturn-v (118 000 kg a órbita terrestre).
6. ESA, *Mars* — https://sci.esa.int/web/solar-system/-/35650-mars (gravedad 3,71 m/s²).
7. National Geographic, *Where is the edge of space?* —
   https://www.nationalgeographic.com/science/2018/12/where-is-the-edge-of-space-and-what-is-the-karman-line
   (100 km según la FAI; 80 km para NASA y la USAF).
8. L3Harris (Aerojet Rocketdyne), *RL10 Engine* — https://www.l3harris.com/all-capabilities/rl10-engine
   (impulso específico de 449,7 a 465,5 s).
9. Space.com, *Mars rover Perseverance landing: step-by-step guide* —
   https://www.space.com/mars-rover-perseverance-landing-step-by-step-guide
   (pico de 1 300 °C; 320 km/h con paracaídas; separación a 2,1 km).
10. Phys.org / AFP, *'7 minutes of terror'* —
    https://phys.org/news/2021-02-minutes-terror-perserverance-rover-nail-biting.pdf (entrada a unos 130 km).

Datos sin fuente oficial directa: el Δv de 3,6 km/s para la inyección a Marte y la duración de
259 días de la transferencia de Hohmann salen de la fórmula estándar de la transferencia y
coinciden en las fuentes divulgativas consultadas, pero no se localizó una página de NASA que los
cite tal cual. En ventanas de lanzamiento reales la inyección cuesta algo más (la Mars Society de Canadá
calcula 4,26 km/s para la de 2024: https://www.marssociety.ca/2021/01/22/rocket-physics-how-to-go-to-mars/).
La velocidad orbital a 300 km está calculada con el GM terrestre de la fuente 1.

## 6. Pruebas

- Comprobación de sintaxis de los diez archivos de `js/`.
- Las 34 992 combinaciones de cohete y nave: 5 065 son viables; delta-v entre 3,80 y 8,44 km/s.
- Partida automática en Chrome (sin conexión, con un sustituto mínimo de Tailwind):
  - Despegue a fondo: fallo estructural a 10 km. Despegue modulando: órbita en 39 s con 20 % de
    combustible. Mismo comportamiento que antes de la corrección.
  - Consola de Propulsión: muestra 450 s, masa seca, propelente y delta-v; al cambiar de tanque
    el delta-v se recalcula.
  - Descenso: paracaídas abierto a 11 km y 423 m/s, temperatura máxima 1 300 °C, aterrizaje y
    reporte final.
- No se volvió a jugar entero el viaje interplanetario (su lógica no cambia; solo el delta-v
  inicial). No se probó con jugadores reales ni en un móvil.
