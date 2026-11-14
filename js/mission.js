/* AEON-01 — Programa de Simulación Orbital: briefing del instructor, manual de telemetría
   y verificación del Segmento de Lanzamiento (Fase 1). */
(function () {
  'use strict';
  const A = window.AEON;
  const $ = (s) => document.querySelector(s);

  // ---------- Configuración de la misión (se elige en Personalizar) ----------
  const LAUNCHERS = [
    { id: 'ares-m', name: 'ARES-M', cap: 70, cost: 900 },
    { id: 'ares-h', name: 'ARES-H', cap: 100, cost: 1400 },
    { id: 'titan-x', name: 'TITAN-X', cap: 130, cost: 2100 }
  ];
  const MODULES = [
    { id: 'lab', name: 'Laboratorio científico', mass: 12, cost: 350 },
    { id: 'rover', name: 'Rover de superficie', mass: 9, cost: 300 },
    { id: 'shield', name: 'Escudo térmico reforzado', mass: 7, cost: 200 },
    { id: 'solar', name: 'Paneles solares extra', mass: 5, cost: 150 }
  ];
  const BASE = { mass: 62, cost: 1200 };   // nave, combustible y soporte vital
  const BUDGET = 3500;                     // millones de $

  function calc() {
    const s = A.settings;
    const l = LAUNCHERS.find((x) => x.id === s.launcher) || LAUNCHERS[1];
    const mods = MODULES.filter((m) => (s.modules || []).includes(m.id));
    const mass = BASE.mass + mods.reduce((t, m) => t + m.mass, 0);
    const cost = BASE.cost + l.cost + mods.reduce((t, m) => t + m.cost, 0);
    return {
      launcher: l, mods, mass, cap: l.cap, cost, budget: BUDGET,
      massOk: mass <= l.cap, costOk: cost <= BUDGET,
      // cuanto más margen de carga, más empuje sobra en el despegue
      thrust: 0.285 + 0.09 * Math.max(0, 1 - mass / l.cap)
    };
  }

  // ---------- Textos ----------
  const TELEMETRY = [
    { n: '01', t: 'DELTA-v / COMBUSTIBLE', u: 'Unidad: km/s',
      d: '<p>Representa el cambio de velocidad que tu nave puede conseguir mediante sus propulsores.</p><p>Lo necesitarás para:</p>' +
         '<ul><li>Abandonar la órbita terrestre.</li><li>Corregir desviaciones de trayectoria.</li><li>Realizar maniobras de navegación.</li><li>Reducir velocidad durante la llegada a Marte.</li></ul>',
      i: 'El combustible es tu capacidad de maniobra. Cada corrección tiene un coste. Planifica con anticipación y evita gastar propelente innecesariamente.',
      a: 'Reservas de combustible insuficientes pueden impedir completar el descenso.' },
    { n: '02', t: 'MASA TOTAL', u: 'Unidad: toneladas (t)',
      d: '<p>Representa el peso total de la nave, incluyendo combustible, módulos, instrumentos y carga científica.</p>' +
         '<p>Una masa mayor exige más energía para acelerar y maniobrar. También puede superar la capacidad del vehículo de lanzamiento.</p>',
      i: 'Cada componente tiene un precio en masa. Un instrumento adicional puede aportar información valiosa, pero también aumentar las exigencias de combustible.<br><br>No confundas una nave equipada con una nave eficiente.',
      a: 'Capacidad de carga del lanzador superada.' },
    { n: '03', t: 'ESCUDO TÉRMICO', u: 'Unidad: porcentaje (%)',
      d: '<p>Indica la integridad y capacidad de protección del sistema térmico de la nave.</p>' +
         '<p>Durante la entrada atmosférica marciana, la compresión y el calentamiento del gas alrededor del vehículo producen temperaturas extremas, que pueden superar los 1.600 °C según el perfil de entrada.</p>',
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

  A.mission = { LAUNCHERS, MODULES, BUDGET, calc, telemetry: pageTelemetry };
  A.startBriefing = function () {
    try { $('#brief-bg').getContext('2d').drawImage(A.bg, 0, 0); } catch (e) { /* fondo opcional */ }
    A.audio(); A.show('brief'); pageIntro();
  };
})();
