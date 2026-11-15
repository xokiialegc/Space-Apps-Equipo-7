/* AEON-01 — Constantes físicas verificadas con fuentes oficiales (issue #6).
   Este archivo es la única fuente de las constantes físicas del simulador: js/launch.js,
   js/mission.js, js/ship.js y js/edl.js leen de AEON.REAL en lugar de escribir el número.
   Cada valor lleva su fuente en SOURCES; la comparación completa está en docs/AUDITORIA_NASA.md. */
(function () {
  'use strict';
  const A = window.AEON;

  // ---------- Constantes oficiales ----------
  const REAL = {
    // Tierra — NASA NSSDCA, Earth Fact Sheet
    G0: 9.80665,            // m/s², gravedad estándar (valor exacto por definición)
    EARTH_SCALE_H: 8.5,     // km, altura de escala de la atmósfera
    EARTH_GM: 398600,       // km³/s²
    EARTH_R: 6378,          // km, radio ecuatorial
    V_ESC_EARTH: 11.186,    // km/s, velocidad de escape desde la superficie
    KARMAN: 100,            // km, línea de Kármán (FAI). NASA y la USAF usan 80 km (50 millas)
    V_LEO: 7.8,             // km/s, velocidad orbital en órbita baja (7,73 km/s a 300 km)
    // Transferencia Tierra → Marte
    DV_TMI: 3.6,            // km/s, inyección transmarciana desde órbita baja
    CRUISE_DAYS: 210,       // días de viaje (Perseverance: 203; Hohmann ideal: 259)
    CRUISE_KM: 472e6,       // km recorridos por Perseverance
    ISP: 450,               // s, motor de hidrógeno y oxígeno líquidos en vacío (RL10: 449,7–465,5 s)
    // Marte — NASA NSSDCA, Mars Fact Sheet
    G_MARS: 3.71,           // m/s² (NASA: 3,73 media y 3,69 en el ecuador; ESA: 3,71)
    MARS_SCALE_H: 11.1,     // km
    V_ESC_MARS: 5.03,       // km/s
    // Entrada, descenso y aterrizaje — Mars 2020 / Perseverance (NASA-JPL)
    ENTRY_H: 125,           // km, inicio de la entrada atmosférica (~130 km)
    ENTRY_V: 5500,          // m/s (Perseverance: 19 500 km/h = 5 420 m/s)
    PEAK_HEAT_C: 1300,      // °C en la superficie del escudo térmico
    CHUTE_H: 11,            // km, altitud de apertura del paracaídas
    CHUTE_V: 420,           // m/s (1 512 km/h)
    // Lanzadores
    SATURN_V_LEO: 118,      // t a órbita baja
    // Escala de tiempo del despegue: 1 s de juego ≈ 8 s reales (las aceleraciones se multiplican por 8)
    LAUNCH_TIME_SCALE: 8
  };
  REAL.VE = REAL.ISP * REAL.G0 / 1000;                              // km/s, velocidad de escape de gases
  /** Ecuación de Tsiolkovski: Δv (km/s) de una nave de masa seca `dry` con `prop` toneladas de propelente. */
  REAL.rocketDv = (dry, prop) => REAL.VE * Math.log((dry + prop) / dry);
  /** Velocidad de órbita circular (km/s) a una altitud dada sobre la Tierra. */
  REAL.vCirc = (hKm) => Math.sqrt(REAL.EARTH_GM / (REAL.EARTH_R + hKm));

  const SOURCES = [
    ['NASA NSSDCA · Earth Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html'],
    ['NASA NSSDCA · Mars Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
    ['NASA-JPL · Mars 2020 Perseverance Landing Press Kit', 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission'],
    ['NASA-JPL · Touchdown! Perseverance lands on Mars (203 días, 472 millones de km)', 'https://www.jpl.nasa.gov/news/touchdown-nasas-mars-perseverance-rover-safely-lands-on-red-planet/'],
    ['NASA · 10 Things: Rockets We Love — Saturn V', 'https://solarsystem.nasa.gov/news/382/10-things-rockets-we-love-saturn-v'],
    ['ESA · Mars: datos físicos', 'https://sci.esa.int/web/solar-system/-/35650-mars'],
    ['National Geographic · línea de Kármán: FAI 100 km, NASA y USAF 80 km', 'https://www.nationalgeographic.com/science/2018/12/where-is-the-edge-of-space-and-what-is-the-karman-line'],
    ['L3Harris (Aerojet Rocketdyne) · ficha del motor RL10', 'https://www.l3harris.com/all-capabilities/rl10-engine']
  ];

  A.REAL = REAL; A.SOURCES = SOURCES;
})();
