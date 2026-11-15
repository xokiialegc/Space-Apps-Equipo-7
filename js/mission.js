/* AEON-01 — Programa de Simulación Orbital: briefing del instructor, manual de telemetría
   y verificación del Segmento de Lanzamiento (Fase 1). */
(function () {
  'use strict';
  const A = window.AEON;
  const $ = (s) => document.querySelector(s);

  // ---------- Configuración de la misión ----------
  // El lanzador es el cohete elegido en Personalizar (js/rockets.js); los sistemas, a bordo (Segmento Espacial).
  const LAUNCHERS = [
    { id: 'ares-m', name: 'CENTELLA', cap: 70, cost: 900 },
    { id: 'ares-h', name: 'APOLLO 11', cap: A.REAL.SATURN_V_LEO, cost: 1400 },   // Saturno V: 118 t a órbita baja (NASA)
    { id: 'titan-x', name: 'X', cap: 130, cost: 2100 }
  ];
  const COMP = {
    hull:   [{ n: 'Compacta', mass: 30, cost: 480, spares: 3 }, { n: 'Equilibrada', mass: 38, cost: 600, spares: 5 }, { n: 'Extendida', mass: 48, cost: 760, spares: 7 }],
    // mass = tanques vacíos (lo que sube el lanzador); fuel = propelente que se carga en la estación orbital.
    // El delta-v ya no es un número fijo: lo da la ecuación de Tsiolkovski con la masa real de la nave (ver calc).
    prop:   [{ n: 'Tanques S', mass: 14, cost: 240, fuel: 160 }, { n: 'Tanques M', mass: 20, cost: 300, fuel: 270 }, { n: 'Tanques L', mass: 27, cost: 380, fuel: 450 }],
    life:   [{ n: '240 días', mass: 6, cost: 140, days: 240 }, { n: '300 días', mass: 9, cost: 180, days: 300 }, { n: '360 días', mass: 12, cost: 240, days: 360 }],
    power:  [{ n: '12 kW', mass: 4, cost: 140, kw: 12 }, { n: '18 kW', mass: 6, cost: 200, kw: 18 }, { n: '24 kW', mass: 9, cost: 290, kw: 24 }],
    lander: [{ n: 'Ligero', mass: 8, cost: 240, cap: 2 }, { n: 'Estándar', mass: 11, cost: 300, cap: 3 }, { n: 'Pesado', mass: 15, cost: 400, cap: 4 }],
    shield: [{ n: 'Básico', mass: 3, cost: 90, f: 0.75 }, { n: 'Estándar', mass: 5, cost: 150, f: 1 }, { n: 'Reforzado', mass: 8, cost: 230, f: 1.4 }]
  };
  const INSTR = [
    { id: 'espec', name: 'Espectrómetro de suelo', mass: 3, cost: 110, kw: 2.5 },
    { id: 'meteo', name: 'Estación meteorológica', mass: 2, cost: 70, kw: 1.5 },
    { id: 'perf', name: 'Perforadora de muestras', mass: 4, cost: 130, kw: 3 },
    { id: 'cam', name: 'Cámara panorámica', mass: 2, cost: 80, kw: 2 }
  ];
  const BUDGET = 3500;        // millones de $
  const ESSENTIAL_KW = 9;     // navegación, comunicaciones, control térmico y soporte vital
  const DV_NEEDED = 4.5;      // inyección a Marte (3,6 km/s) + correcciones de rumbo + frenado final
  const DV_REF = 7.5;         // delta-v con el que el indicador de tanques marca «lleno»
  const DEF_SHIP = { hull: 1, prop: 1, life: 1, power: 1, lander: 1, shield: 1, instr: ['espec', 'meteo'] };

  function ship() {
    const s = A.settings;
    if (!s.ship || !Array.isArray(s.ship.instr)) s.ship = JSON.parse(JSON.stringify(DEF_SHIP));
    return s.ship;
  }
  function calc() {
    const sh = ship();
    const l = LAUNCHERS.find((x) => x.id === A.settings.launcher) || LAUNCHERS[1];
    const pick = {}; let mass = 0, cost = l.cost;
    Object.keys(COMP).forEach((k) => { pick[k] = COMP[k][sh[k]] || COMP[k][1]; mass += pick[k].mass; cost += pick[k].cost; });
    const instr = INSTR.filter((i) => sh.instr.includes(i.id));
    instr.forEach((i) => { mass += i.mass; cost += i.cost; });
    const demand = ESSENTIAL_KW + instr.reduce((t, i) => t + i.kw, 0);
    const dv = Math.round(A.REAL.rocketDv(mass, pick.prop.fuel) * 100) / 100;      // Δv = Isp·g₀·ln(m₀/m_f)
    return {
      launcher: l, pick, instr, mass, cap: l.cap, cost, budget: BUDGET, budgetPct: Math.round(cost / BUDGET * 100),
      massOk: mass <= l.cap, costOk: cost <= BUDGET,
      dv, dvOk: dv >= DV_NEEDED, fuel: pick.prop.fuel, isp: A.REAL.ISP, days: pick.life.days, kw: pick.power.kw, demand, powerOk: pick.power.kw >= demand,
      shieldF: pick.shield.f, landerCap: pick.lander.cap, capOk: instr.length <= pick.lander.cap, spares: pick.hull.spares,
      // cuanto más margen de carga, más empuje sobra en el despegue
      thrust: 0.285 + 0.09 * Math.max(0, 1 - mass / l.cap)
    };
  }

  // Panel superpuesto a la vista del jugador (informes y resultados)
  function report(html, buttons) {
    const el = $('#report');
    $('#rep-body').innerHTML = html; $('#rep-body').scrollTop = 0;
    $('#rep-btns').innerHTML = buttons.map((b, i) => '<div class="neon-wrap"><button data-i="' + i + '" class="neon-btn neon-btn--sm">' + b.l + '</button></div>').join('');
    $('#rep-btns').querySelectorAll('button').forEach((b) => b.onclick = () => { A.beep(440, 0.1); el.classList.add('hidden'); el.classList.remove('flex'); buttons[+b.dataset.i].fn(); });
    el.classList.remove('hidden'); el.classList.add('flex');
  }

  // ---------- Textos ----------
  const TELEMETRY = [
    { n: '01', t: 'DELTA-v / COMBUSTIBLE', u: 'Unidad: km/s',
      d: '<p>Representa el cambio de velocidad que tu nave puede conseguir mediante sus propulsores. Lo fija la ecuación del cohete de Tsiolkovski: <b>Δv = Isp · g₀ · ln(m₀ / m_f)</b>. Cuanta más masa lleve la nave, menos delta-v dan los mismos tanques.</p><p>Lo necesitarás para:</p>' +
         '<ul><li>Abandonar la órbita terrestre (unos 3,6 km/s).</li><li>Corregir desviaciones de trayectoria.</li><li>Realizar maniobras de navegación.</li><li>Reducir velocidad durante la llegada a Marte.</li></ul>',
      i: 'El combustible es tu capacidad de maniobra. Cada corrección tiene un coste. Planifica con anticipación y evita gastar propelente innecesariamente.',
      a: 'Reservas de combustible insuficientes pueden impedir completar el descenso.' },
    { n: '02', t: 'MASA TOTAL', u: 'Unidad: toneladas (t)',
      d: '<p>Representa el peso total de la nave, incluyendo combustible, módulos, instrumentos y carga científica.</p>' +
         '<p>Una masa mayor exige más energía para acelerar y maniobrar. También puede superar la capacidad del vehículo de lanzamiento.</p>',
      i: 'Cada componente tiene un precio en masa. Un instrumento adicional puede aportar información valiosa, pero también aumentar las exigencias de combustible.<br><br>No confundas una nave equipada con una nave eficiente.',
      a: 'Capacidad de carga del lanzador superada.' },
    { n: '03', t: 'ESCUDO TÉRMICO', u: 'Unidad: porcentaje (%)',
      d: '<p>Indica la integridad y capacidad de protección del sistema térmico de la nave.</p>' +
         '<p>Durante la entrada atmosférica marciana, la compresión y el calentamiento del gas alrededor del vehículo producen temperaturas extremas, de unos 1.300 °C en la superficie del escudo (dato de la misión Perseverance de la NASA, 2021).</p>',
      i: 'El escudo térmico es tu última barrera de protección durante el descenso. Su integridad debe mantenerse dentro de los márgenes de seguridad.',
      a: 'Protección térmica insuficiente. Riesgo crítico durante la entrada atmosférica.' },
    { n: '04', t: 'SOPORTE VITAL Y OXÍGENO', u: 'Unidad: días / porcentaje (%)',
      d: '<p>Indica cuánto tiempo puede mantenerse la tripulación con los recursos disponibles.</p>' +
         '<p>El soporte vital administra el oxígeno, elimina el dióxido de carbono y mantiene condiciones habitables dentro de la nave.</p>' +
         '<p>Un viaje interplanetario puede durar aproximadamente siete meses, dependiendo de la trayectoria y de la ventana de lanzamiento.</p>',
      i: 'La nave debe mantener condiciones habitables durante todo el trayecto. Calcula las reservas para la duración prevista y conserva un margen de seguridad.',
      a: 'Reservas de soporte vital por debajo del mínimo operativo.' },
    { n: '05', t: 'POTENCIA ELÉCTRICA', u: 'Unidad: kilovatios (kW)',
      d: '<p>Representa la energía disponible para alimentar los sistemas de la nave.</p><p>Es indispensable para:</p>' +
         '<ul><li>Computadoras de navegación.</li><li>Sistemas de comunicación.</li><li>Instrumentos científicos.</li><li>Control térmico.</li><li>Sistemas de soporte vital.</li></ul>',
      i: 'Sin energía, los sistemas dejan de responder. Distribuye la potencia entre las funciones esenciales y evita sobrecargar la red eléctrica.',
      a: 'Potencia eléctrica insuficiente. Prioriza los sistemas esenciales.' }
  ];

  const body = $('#brief-body'), foot = $('#brief-foot');
  const btn = (id, label, extra) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm"' + (extra || '') + '>' + label + '</button></div>';
  function head(who, sub, step) {
    $('#brief-who').textContent = who; $('#brief-sub').textContent = sub; $('#brief-step').textContent = step;
    body.scrollTop = 0;
  }
  const click = (id, fn) => { $(id).onclick = () => { A.beep(440, 0.1); fn(); }; };
  const toMenu = () => A.show('menu');

  // ---------- 1. Bienvenida ----------
  function pageIntro() {
    head('INSTRUCTOR JEFE — CONTROL DE MISIÓN', 'Programa de Simulación Orbital', '1 / 2');
    body.innerHTML =
      '<p class="motto">Bienvenido, cadete.</p>' +
      '<p>Has sido seleccionado para participar en el Programa de Simulación Orbital, un entrenamiento diseñado para preparar a la próxima generación de exploradores espaciales.</p>' +
      '<p><b>Tu misión:</b> diseñar, ejecutar y evaluar una expedición desde una estación espacial en órbita terrestre hasta la superficie de Marte.</p>' +
      '<p>Pero el espacio no perdona los errores de planificación.</p>' +
      '<p>Dispones de un presupuesto limitado, una capacidad de carga restringida y recursos que deberás administrar cuidadosamente. Cada decisión afectará la seguridad de la tripulación, el rendimiento de la nave y el éxito científico de la expedición.</p>' +
      '<p>Para graduarte, deberás dominar los cuatro segmentos fundamentales de una misión espacial:</p>' +
      '<div class="mb-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">' +
      '<div class="seg"><b>1 · LANZAMIENTO</b>Poner la nave y su carga en órbita.</div>' +
      '<div class="seg"><b>2 · ESPACIAL</b>Operar la nave durante el trayecto.</div>' +
      '<div class="seg"><b>3 · TERRESTRE</b>Control de misión y comunicaciones.</div>' +
      '<div class="seg"><b>4 · USUARIO</b>Ciencia y objetivos de la expedición.</div></div>' +
      '<p>Tu objetivo no es simplemente llegar a Marte.</p>' +
      '<p>Debes llegar con combustible suficiente, sistemas operativos, tripulación protegida y capacidad científica para cumplir los objetivos de la expedición.</p>' +
      '<p class="motto">La ingeniería hace posible el viaje. La planificación permite sobrevivirlo.</p>' +
      '<p>¿Estás preparado, cadete?</p>';
    foot.innerHTML = btn('b-back', 'Menú principal') + btn('b-next', '[ Iniciar entrenamiento ]');
    click('#b-back', toMenu); click('#b-next', pageTelemetry);
  }

  // ---------- 2. Manual rápido de telemetría ----------
  function pageTelemetry() {
    head('MANUAL RÁPIDO DE TELEMETRÍA', 'Lo que controlarás durante la misión', '2 / 2');
    const seen = new Set();
    body.innerHTML =
      '<div class="quote"><div class="who">INSTRUCTOR</div>Antes del lanzamiento, debes aprender a interpretar los instrumentos de tu nave. ' +
      'La telemetría es el conjunto de datos que permite conocer el estado de los sistemas de una misión espacial. Durante el trayecto, estos indicadores serán tu principal fuente de información. ' +
      '<b>No los ignores.</b> Una lectura incorrecta puede comprometer toda la expedición.</div>' +
      '<div class="flex gap-6"><div class="w-[340px] flex-none">' +
      TELEMETRY.map((x, i) => '<button class="tab" data-i="' + i + '">' + x.n + ' · ' + x.t + '</button>').join('') +
      '</div><div id="tel" class="flex-1"></div></div>';
    const sel = (i) => {
      const x = TELEMETRY[i]; seen.add(i);
      body.querySelectorAll('.tab').forEach((b, j) => { b.classList.toggle('on', j === i); if (seen.has(j)) b.classList.add('seen'); });
      $('#tel').innerHTML = '<h3>' + x.n + '. ' + x.t + '</h3><div class="unit">' + x.u + '</div>' + x.d +
        '<div class="quote"><div class="who">INSTRUCTOR</div>' + x.i + '</div><div class="alert"><b>ALERTA:</b> ' + x.a + '</div>';
    };
    body.querySelectorAll('.tab').forEach((b) => b.onclick = () => { A.beep(520, 0.06); sel(+b.dataset.i); });
    sel(0);
    foot.innerHTML = btn('b-back', 'Atrás') + btn('b-next', 'Fase 1 · Preparación y despegue');
    click('#b-back', pageIntro); click('#b-next', () => A.startCockpit(calc()));
  }

  A.mission = { LAUNCHERS, COMP, INSTR, BUDGET, ESSENTIAL_KW, DV_NEEDED, DV_REF, ship, calc, report, telemetry: pageTelemetry };
  A.startBriefing = function () {
    try { $('#brief-bg').getContext('2d').drawImage(A.bg, 0, 0); } catch (e) { /* fondo opcional */ }
    A.run = { tries: 0 };
    A.audio(); A.show('brief'); pageIntro();
  };
})();
