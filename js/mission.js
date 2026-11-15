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

  // ---------- Briefing: dos pantallas de un vistazo ----------
  // Indicadores que el jugador vigilará: nombre, unidad, para qué sirve y cuándo es peligro (una línea cada uno).
  const TELEMETRY = [
    { t: 'DELTA-v', u: 'km/s', d: 'Tu capacidad de maniobra', a: 'Sin Δv no hay descenso' },
    { t: 'MASA', u: 't', d: 'Peso total de la nave', a: 'No superes la carga del lanzador' },
    { t: 'ESCUDO', u: '%', d: 'Protege al entrar en Marte', a: 'Bajo 40 %: peligro' },
    { t: 'OXÍGENO', u: '%', d: 'Aire para 210 días', a: 'Bajo 25 %: crítico' },
    { t: 'ENERGÍA', u: '%', d: 'Alimenta todos los sistemas', a: 'Bajo 20 %: crítico' }
  ];

  const body = $('#brief-body'), foot = $('#brief-foot');
  const btn = (id, label, extra) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm"' + (extra || '') + '>' + label + '</button></div>';
  function head(who, sub, step) {
    $('#brief-who').textContent = who; $('#brief-sub').textContent = sub; $('#brief-step').textContent = step;
    body.scrollTop = 0;
  }
  const click = (id, fn) => { $(id).onclick = () => { A.beep(440, 0.1); fn(); }; };
  const toMenu = () => A.show('menu');
  const card = (n, t, line) => '<div class="uxc"><span class="num">' + n + '</span><small>' + t + '</small><b>' + line + '</b></div>';

  // ---------- 1. Misión ----------
  function pageIntro() {
    head('TU MISIÓN', 'Programa de Simulación Orbital', '1 / 2');
    body.innerHTML =
      '<div class="ux-big">LLEVA TU NAVE A MARTE</div>' +
      '<div class="ux-hero">De la órbita terrestre a la superficie marciana.</div>' +
      '<div class="ux-grid" style="grid-template-columns:repeat(4,1fr)">' +
      card(1, 'Lanzamiento', 'Ponla en órbita') + card(2, 'Espacial', 'Sobrevive al viaje') +
      card(3, 'Terrestre', 'Decide en las alertas') + card(4, 'Usuario', 'Aterriza con ciencia') + '</div>' +
      '<div class="ux-grid" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="uxc"><small>Presupuesto</small><b>' + BUDGET.toLocaleString('es') + ' M$</b></div>' +
      '<div class="uxc"><small>Carga</small><b>Según el lanzador</b></div>' +
      '<div class="uxc"><small>Recursos</small><b>Limitados</b></div></div>' +
      '<p class="motto mt-6" style="font-size:24px">PLANIFICA · SOBREVIVE · ATERRIZA</p>';
    foot.innerHTML = btn('b-back', '◀ Menú') + btn('b-next', 'Siguiente ▶');
    click('#b-back', toMenu); click('#b-next', pageTelemetry);
  }

  // ---------- 2. Indicadores ----------
  function pageTelemetry() {
    head('TUS INDICADORES', 'Vigílalos toda la misión', '2 / 2');
    body.innerHTML =
      '<div class="ux-hero">Verde: bien. <span style="color:#ff8f7a">Rojo: actúa ya.</span></div>' +
      '<div class="ux-grid" style="grid-template-columns:repeat(5,1fr)">' +
      TELEMETRY.map((x) => '<div class="uxc" style="min-height:190px"><small>' + x.u + '</small><b style="font-size:24px">' + x.t + '</b><span>' + x.d + '</span><span class="warn mt-3">⚠ ' + x.a + '</span></div>').join('') + '</div>' +
      '<div class="ux-ctrl mt-4"><div><span class="ic">⚠</span>Las alertas parpadean en rojo arriba a la derecha.</div><div>' + A.key('ESC') + 'Pausa en cualquier momento.</div></div>';
    foot.innerHTML = btn('b-back', '◀ Atrás') + btn('b-next', 'Fase 1 · Despegue ▶');
    click('#b-back', pageIntro); click('#b-next', () => A.startCockpit(calc()));
  }

  A.mission = { LAUNCHERS, COMP, INSTR, BUDGET, ESSENTIAL_KW, DV_NEEDED, DV_REF, ship, calc, report, telemetry: pageTelemetry };
  A.startBriefing = function () {
    try { $('#brief-bg').getContext('2d').drawImage(A.bg, 0, 0); } catch (e) { /* fondo opcional */ }
    A.run = { tries: 0 };
    A.audio(); A.show('brief'); pageIntro();
  };
})();
