/* AEON-01 — Datos reales: constantes físicas verificadas y auditoría «juego vs. agencias» (issue #6).
   Este archivo es la única fuente de las constantes físicas del simulador: js/launch.js,
   js/mission.js, js/ship.js y js/edl.js leen de AEON.REAL en lugar de escribir el número.
   Cada valor lleva su fuente en SOURCES; la tabla AUDIT es la que muestra el botón
   «Datos reales» del menú y la que resume docs/AUDITORIA_NASA.md. */
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

  // ---------- Auditoría: [parámetro, valor en el juego, valor oficial, desviación, veredicto, nota] ----------
  // Veredictos: ok = exacto · ap = aproximación aceptable para tiempo real · fx = era incorrecto y se corrigió · ju = valor de diseño del juego
  const v300 = REAL.vCirc(300).toFixed(2).replace('.', ',');
  const AUDIT = [
    ['DESPEGUE · TIERRA'],
    ['Gravedad', 'g₀ = 9,80665 m/s² × escala de tiempo 8', '9,80665 m/s² (estándar)', '0 %', 'fx', 'Antes era un 0,08 km/s² sin origen; ahora sale de g₀.'],
    ['Altura de escala de la atmósfera', '8,5 km', '8,5 km', '0 %', 'fx', 'Antes 12 km (+41 %): el aire tardaba demasiado en enrarecerse.'],
    ['Densidad del aire', 'ρ = e^(−h/8,5)', 'modelo exponencial', '—', 'ap', 'Una sola capa isoterma; la atmósfera real tiene varias capas.'],
    ['Línea de Kármán', '100 km', '100 km (FAI)', '0 %', 'ok', 'NASA y la USAF usan 80 km (50 millas) para las alas de astronauta.'],
    ['Velocidad orbital (órbita baja)', '7,8 km/s', v300 + ' km/s a 300 km', '+1 %', 'ok', 'Calculada con el GM terrestre de NASA.'],
    ['Gravedad efectiva en ascenso', 'g·(1 − v²/v_orb²)', 'g − v²/r', '—', 'ap', 'Término centrífugo correcto; el vuelo se reduce a una dimensión.'],
    ['Presión dinámica', 'q ∝ ρ·v²', 'q = ½·ρ·v²', '—', 'ap', 'Normalizada al límite estructural: se muestra en %.'],
    ['Duración del ascenso', '≈ 40 s de juego', 'varios minutos (≈ 8–12)', '—', 'ap', 'Tiempo comprimido para que sea jugable.'],
    ['Saturno V · carga a órbita baja', '118 t', '118 t', '0 %', 'fx', 'Antes 100 t (−15 %).'],
    ['Saturno V · etapas y fecha', '3 etapas · julio de 1969', '3 etapas · julio de 1969', '0 %', 'ok', ''],
    ['VIAJE INTERPLANETARIO'],
    ['Δv de inyección a Marte', '3,6 km/s', '≈ 3,6 km/s desde órbita baja', '0 %', 'ok', ''],
    ['Velocidad tras la inyección', '7,8 + 3,6 = 11,4 km/s', 'escape de la Tierra: 11,186 km/s', '—', 'ok', 'Coherente: la nave supera la velocidad de escape.'],
    ['Δv de la nave', 'Tsiolkovski: Isp·g₀·ln(m₀/m_f)', 'ecuación del cohete', '—', 'fx', 'Antes era un número fijo por tanque, igual para cualquier masa.'],
    ['Impulso específico', '450 s', '449,7–465,5 s (RL10, vacío)', '0 %', 'ok', 'Hidrógeno y oxígeno líquidos.'],
    ['Duración del viaje', '210 días', '203 días (Perseverance)', '+3 %', 'ap', 'Una transferencia de Hohmann ideal dura 259 días.'],
    ['Distancia recorrida', '«más de 470 millones de km»', '472 millones de km', '0 %', 'fx', 'Antes decía solo «millones de kilómetros».'],
    ['Llegada a Marte', 'entrada directa en la atmósfera', 'entrada directa (Perseverance)', '—', 'fx', 'Antes el puesto del piloto decía «Órbita de Marte: alcanzada», pero la nave no frena para entrar en órbita.'],
    ['DESCENSO EN MARTE'],
    ['Gravedad de Marte', '3,71 m/s²', '3,73 media · 3,69 ecuador (NASA) · 3,71 (ESA)', '−0,5 %', 'ok', ''],
    ['Altitud de entrada', '125 km', '≈ 130 km', '−4 %', 'ap', ''],
    ['Velocidad de entrada', '5,5 km/s', '5,42 km/s (19 500 km/h)', '+1,5 %', 'ok', ''],
    ['Temperatura máxima del escudo', '≈ 1 300 °C', '≈ 1 300 °C', '0 %', 'fx', 'Antes el monitor llegaba a 1 700 °C (+31 %) y el manual decía 1 600 °C.'],
    ['Apertura del paracaídas · altitud', 'ventana 11,9–10,1 km', '≈ 11 km', '0 %', 'fx', 'Antes 9,2–7,4 km (−25 %).'],
    ['Apertura del paracaídas · velocidad', '≈ 420 m/s', '420 m/s (1 512 km/h)', '0 %', 'ok', ''],
    ['Fin del paracaídas', '70 m/s a 1,2 km', '89 m/s a 2,1 km', '−21 %', 'ap', 'Simplificado para que el frenado final quepa en el propelente.'],
    ['Velocidad de contacto', '< 4 m/s', '0,75 m/s (grúa aérea)', '—', 'ap', 'Tolerancia de juego: un lander con patas admite algo más.'],
    ['Duración del descenso', '≈ 1 min de juego', '≈ 7 min', '—', 'ap', 'Tiempo comprimido.'],
    ['DISEÑO DE LA MISIÓN'],
    ['Costes (M$), masas de módulos, cohetes Centella y X', 'valores propios', 'no existen datos oficiales', '—', 'ju', 'Son ficticios y sirven para equilibrar el juego.']
  ];
  const TAG = { ok: ['EXACTO', '#3cff9e'], ap: ['APROXIMADO', '#ffd23c'], fx: ['CORREGIDO', '#7fdcff'], ju: ['FICTICIO', '#c9a8ff'] };

  function openData() {
    const n = { ok: 0, ap: 0, fx: 0, ju: 0 };
    AUDIT.forEach((r) => { if (r.length > 1) n[r[4]]++; });
    const cell = 'padding:5px 10px;border-bottom:1px solid rgba(25,180,255,.18);vertical-align:top';
    const rows = AUDIT.map((r) => r.length === 1
      ? '<tr><td colspan="5" style="padding:12px 10px 4px;font-family:Orbitron,sans-serif;font-size:13px;letter-spacing:.2em;color:#7fdcff">' + r[0] + '</td></tr>'
      : '<tr><td style="' + cell + '"><b>' + r[0] + '</b>' + (r[5] ? '<div style="font-size:14px;color:rgba(190,225,255,.7)">' + r[5] + '</div>' : '') + '</td>' +
        '<td style="' + cell + '">' + r[1] + '</td><td style="' + cell + '">' + r[2] + '</td><td style="' + cell + ';white-space:nowrap;text-align:right">' + r[3] + '</td>' +
        '<td style="' + cell + ';white-space:nowrap;font-family:Orbitron,sans-serif;font-size:12px;letter-spacing:.1em;color:' + TAG[r[4]][1] + '">' + TAG[r[4]][0] + '</td></tr>').join('');
    A.openModal('Datos reales',
      '<p style="font-size:18px">Cada dato físico del simulador, comparado con el valor publicado por NASA, ESA y otras fuentes oficiales. ' +
      '<b style="color:#3cff9e">' + n.ok + ' exactos</b> · <b style="color:#ffd23c">' + n.ap + ' aproximados</b> · <b style="color:#7fdcff">' + n.fx + ' corregidos</b> · <b style="color:#c9a8ff">' + n.ju + ' ficticio</b>.</p>' +
      '<div id="data-scroll" style="max-height:520px;overflow-y:auto;margin-top:12px;padding-right:8px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:16px;line-height:1.25">' +
      '<thead><tr style="text-align:left;font-family:Orbitron,sans-serif;font-size:12px;letter-spacing:.15em;color:#9fd8ff">' +
      '<th style="padding:4px 10px">PARÁMETRO</th><th style="padding:4px 10px">EN EL JUEGO</th><th style="padding:4px 10px">VALOR OFICIAL</th><th style="padding:4px 10px;text-align:right">DESVIACIÓN</th><th style="padding:4px 10px">VEREDICTO</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div style="margin-top:14px;font-family:Orbitron,sans-serif;font-size:13px;letter-spacing:.2em;color:#7fdcff">FUENTES</div>' +
      '<ul style="font-size:15px;line-height:1.4;margin-top:4px">' + SOURCES.map((s) => '<li>' + s[0] + ' — <span style="color:rgba(160,215,255,.75)">' + s[1].replace('https://', '') + '</span></li>').join('') + '</ul>' +
      '<p style="font-size:15px;margin-top:8px;color:rgba(190,225,255,.75)">Informe completo, con las correcciones de código: <code>docs/AUDITORIA_NASA.md</code>.</p></div>',
      1240);
  }

  A.REAL = REAL; A.AUDIT = AUDIT; A.SOURCES = SOURCES;
  A.actions.data = openData;
})();
