/* AEON-01 — Interior de la nave en primera persona (2D).
   Modo 'config' (3.2 Segmento Espacial): cada sala configura un componente.
   Modo 'voyage' (Fase 2): viaje de ~7 meses comprimido; cada recurso se vigila y se repone
   en su sala, el panel de alertas lleva directo a la sala afectada y Control de Misión
   plantea tres eventos críticos. */
(function () {
  'use strict';
  const A = window.AEON, M = A.mission, W = 1600, H = 900;
  const $ = (s) => document.querySelector(s);
  const cv = $('#ship'), c = cv.getContext('2d');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const ROOMS = [
    { id: 'bridge', name: 'Puente de mando', res: 'Nave principal · navegación · comunicaciones', hue: [50, 120, 210] },
    { id: 'life', name: 'Soporte vital', res: 'Oxígeno', hue: [40, 170, 120] },
    { id: 'power', name: 'Sala de energía', res: 'Potencia eléctrica', hue: [220, 170, 40] },
    { id: 'prop', name: 'Propulsión', res: 'Delta-v / combustible', hue: [220, 110, 50] },
    { id: 'hangar', name: 'Hangar del lander', res: 'Lander · escudo térmico', hue: [200, 80, 80] },
    { id: 'lab', name: 'Laboratorio', res: 'Instrumentos científicos', hue: [150, 100, 225] }
  ];
  const ri = (id) => ROOMS.findIndex((r) => r.id === id);
  const T_TOTAL = 150, DAYS = 210, DV_TMI = 3.6;

  let mode = 'off', room = 0, move = null, queue = [], S = null, cfg = null, last = 0, raf = 0;
  let paused = false, serv = false, conKey = '', alertKey = '', hud = 0;

  // ---------- Diálogo superpuesto a la vista ----------
  function dlg(who, html, buttons) {
    paused = true; serv = false;
    $('#sd-who').textContent = who; $('#sd-body').innerHTML = html; $('#sd-body').scrollTop = 0;
    $('#sd-btns').innerHTML = buttons.map((b, i) => '<div class="neon-wrap"><button data-i="' + i + '" class="neon-btn neon-btn--sm" style="min-width:150px;height:auto;min-height:44px;white-space:normal;padding:8px 16px;max-width:900px">' + b.l + '</button></div>').join('');
    $('#sd-btns').querySelectorAll('button').forEach((b) => b.onclick = () => {
      A.beep(440, 0.1); $('#ship-holo').classList.add('hidden'); $('#ship-holo').classList.remove('flex'); paused = false; last = performance.now();
      buttons[+b.dataset.i].fn();
    });
    $('#ship-holo').classList.remove('hidden'); $('#ship-holo').classList.add('flex');
  }
  const q = (who, t) => '<div class="quote"><div class="who">' + who + '</div>' + t + '</div>';
  const ok = (b) => '<span class="' + (b ? 'text-emerald-300' : 'text-red-400') + '">' + (b ? '✓' : '✗') + '</span> ';

  // ---------- Eventos críticos de la Fase 2 ----------
  const EV = [
    { at: 22, room: 'bridge', tag: '&lt; ALERTA DE TELEMETRÍA &gt;', title: 'EVENTO CRÍTICO 01 — PÉRDIDA PARCIAL DE COMUNICACIONES', who: 'ESTACIÓN TERRESTRE — COMUNICACIÓN', short: 'Comunicaciones degradadas',
      body: 'Atención, Control de Misión. Estamos detectando una degradación en la señal de comunicación con la nave. La recepción de telemetría es intermitente. Algunos paquetes de datos no están llegando correctamente.',
      tel: () => ['Señal de comunicación: 42 %', 'Telemetría: Parcial', 'Navegación: Sin anomalías confirmadas', 'Estado de la nave: Operativo'],
      cm: 'Cadete, debemos recuperar la recepción de datos antes de perder visibilidad sobre los sistemas de la nave.',
      a: 'A. Activar el sistema de comunicaciones de respaldo.', b: 'B. Mantener la configuración actual y solicitar una nueva transmisión de telemetría.',
      good: ['Comunicación de respaldo establecida. La recepción de telemetría mejora progresivamente.', 'Buena decisión, cadete. Hemos recuperado visibilidad sobre la nave.'],
      bad: ['La pérdida de datos continúa. El equipo terrestre no puede verificar adecuadamente el estado de los sistemas.', 'La supervisión de la misión está comprometida. Debemos recuperar la comunicación antes de continuar.'],
      start(s) { s.comms = 42; }, onGood(s) { s.comms = 92; }, onBad(s) { s.comms = Math.max(15, s.comms - 10); } },
    { at: 66, room: 'power', tag: '&lt; ALERTA DE RADIACIÓN &gt;', title: 'EVENTO CRÍTICO 02 — TORMENTA SOLAR', who: 'CENTRO DE CONTROL DE MISIÓN', short: 'Tormenta solar',
      body: 'Atención, cadete. Los instrumentos de monitoreo espacial han detectado un incremento de actividad solar. La radiación puede afectar los componentes electrónicos y aumentar la exposición de la tripulación.',
      tel: (s) => ['Actividad solar: Elevada', 'Exposición a radiación: En aumento', 'Sistemas electrónicos: Operativos', 'Potencia eléctrica: ' + kw(s) + ' kW'],
      cm: 'Debemos proteger los sistemas sensibles y conservar la energía disponible.',
      a: 'A. Activar el protocolo de protección contra radiación y priorizar los sistemas esenciales.', b: 'B. Mantener todos los sistemas funcionando a máxima potencia.',
      good: ['Protocolo de protección activado. Los sistemas esenciales permanecen operativos y la tripulación dispone de protección adicional.', 'Excelente respuesta. La seguridad de la tripulación es prioritaria. Hemos reducido los riesgos operativos.'],
      bad: ['El consumo eléctrico permanece elevado y los sistemas continúan expuestos a condiciones desfavorables.', 'La gestión energética y la protección de la tripulación son insuficientes. Reevalúa tus prioridades.'],
      start() {}, onGood(s) { s.bat = Math.max(5, s.bat - 4); }, onBad(s) { s.bat = Math.max(5, s.bat - 20); const i = s.instr.find((x) => x.ok); if (i) i.ok = false; } },
    { at: 108, room: 'bridge', tag: '&lt; ALERTA DE NAVEGACIÓN &gt;', title: 'EVENTO CRÍTICO 03 — DESVIACIÓN DE TRAYECTORIA', who: 'CENTRO DE CONTROL DE MISIÓN', short: 'Desviación de trayectoria',
      body: 'Cadete, hemos detectado una desviación respecto a la trayectoria interplanetaria prevista. Los datos de navegación indican que la nave podría llegar a Marte fuera de los parámetros establecidos.',
      tel: (s) => ['Desviación de trayectoria: Elevada', 'Propelente disponible: ' + s.dv.toFixed(2) + ' km/s', 'Navegación: Operativa', 'Tiempo estimado de llegada: ' + Math.max(0, Math.round(DAYS - day(s))) + ' días'],
      cm: 'Debemos evaluar la trayectoria y determinar si es necesaria una corrección. Recuerda que cada maniobra consume propelente. No podemos desperdiciar nuestras reservas.',
      a: 'A. Ejecutar una corrección de trayectoria utilizando el presupuesto de delta-v disponible.', b: 'B. Mantener el rumbo actual y continuar monitoreando la desviación.',
      good: ['Maniobra de corrección completada. La nave recupera una trayectoria compatible con los parámetros de llegada previstos.', 'Excelente trabajo, cadete. Has corregido la desviación sin comprometer las reservas críticas de combustible.'],
      bad: ['La desviación persiste y los parámetros de llegada continúan fuera de los márgenes previstos.', 'Una trayectoria incorrecta puede comprometer toda la fase de aproximación. La navegación requiere supervisión constante.'],
      start(s) { s.dev = 1; }, onGood(s) { s.dv = Math.max(0.05, s.dv - s.corr); s.dev = 0; }, onBad(s) { s.corr += 0.15; } }
  ];
  const day = (s) => s.t / T_TOTAL * DAYS;
  const kw = (s) => (cfg.kw * clamp(s.bat / 100, 0, 1)).toFixed(1);

  function openEvent(e, n) {
    const tel = e.tel(S).map((x) => '<li>' + x + '</li>').join('');
    dlg(e.title, '<div class="alert mb-2"><b>' + e.tag + '</b></div>' + q(e.who, e.body) + '<ul>' + tel + '</ul>' + q('CONTROL DE MISIÓN', e.cm) +
      '<div class="who">DECISIÓN DEL CADETE</div>',
      [{ l: e.a, fn: () => { e.done = true; if (e.tries === 0) S.right++; e.onGood(S); result(e, true); } },
       { l: e.b, fn: () => { e.tries++; S.wrong++; e.cool = S.t + 5; e.onBad(S); result(e, false); } }]);
  }
  function result(e, good) {
    const r = good ? e.good : e.bad;
    dlg(good ? 'RESULTADO — DECISIÓN CORRECTA' : 'RESULTADO — DECISIÓN INCORRECTA', '<div class="' + (good ? 'ok' : 'alert mb-2') + '">' + r[0] + '</div>' + q('CONTROL DE MISIÓN', r[1]) +
      (good ? '' : '<p>La anomalía sigue activa: tendrás que volver a decidir.</p>'), [{ l: 'Continuar', fn: () => { conKey = ''; } }]);
  }

  // ---------- Arranques ----------
  function begin(m) {
    mode = m; room = 0; move = null; queue = []; serv = false; paused = false; conKey = ''; alertKey = '';
    A.show('ship'); last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }

  A.startShip = function (m) {
    cfg = M.calc();
    if (m === 'voyage') return startVoyage();
    S = { t: 0, o2: 100, bat: 100, dv: cfg.dv, shield: 100, comms: 100, dev: 0, leak: false, instr: [] };
    A.store.set('aeon01.save', { phase: 'config', run: A.run });
    begin('config');
    dlg('INSTRUCTOR — SEGMENTO ESPACIAL', '<h3>3.2 · CONFIGURACIÓN DE LA NAVE INTERPLANETARIA</h3>' +
      '<p>Con la nave en órbita, comienza la configuración de los sistemas que harán posible el viaje a Marte.</p>' +
      '<p>Debes seleccionar y equilibrar los componentes de la expedición. Cada módulo consume masa, presupuesto y, en algunos casos, energía.</p>' +
      '<p>Recorre la nave con <b>A / D</b> (o las puertas laterales): cada sala controla un componente. Cuando termines, confirma el diseño en el <b>Puente de mando</b>.</p>',
      [{ l: 'Recorrer la nave', fn: () => {} }]);
  };

  function startVoyage() {
    cfg = M.calc();
    const r = (a, b) => a + Math.random() * (b - a);
    S = { t: 0, o2: 100, bat: 100, dv: cfg.dv - DV_TMI, shield: 100, comms: 100, dev: 0, corr: 0.3, leak: false, seal: 0, rep: 0, cal: 0,
      spares: cfg.spares, instr: cfg.instr.map((i) => ({ id: i.id, name: i.name, ok: true })), right: 0, wrong: 0, crit: 0,
      hits: [r(30, 40), r(82, 92), r(122, 132)], leakAt: r(44, 56), glitchAt: r(94, 100), ev: EV.map((e) => Object.assign({}, e, { on: false, done: false, tries: 0, cool: 0 })) };
    A.store.set('aeon01.save', { phase: 'voyage', run: A.run });
    begin('voyage');
    dlg('INSTRUCTOR — FASE 2 · EL VIAJE INTERPLANETARIO', '<h3>SEGMENTO TERRESTRE EN ACCIÓN</h3>' +
      '<p>Cadete, la nave ha abandonado la órbita terrestre y se encuentra en trayectoria interplanetaria.</p>' +
      '<p>Desde el Centro de Control de Misión, las estaciones terrestres reciben telemetría, verifican las comunicaciones y supervisan el comportamiento de la nave. Durante el viaje, pueden aparecer anomalías que exijan decisiones inmediatas.</p>' +
      '<p>Recuerda: el Segmento Terrestre no controla físicamente la nave de forma continua. Analiza los datos recibidos, evalúa las condiciones y transmite instrucciones cuando es necesario.</p>' +
      '<p class="motto">Tu capacidad para interpretar la información será puesta a prueba.</p>' +
      '<p>A bordo: vigila los indicadores de abajo. Cuando algo entre en estado crítico aparecerá en el <b>panel de alertas</b> (arriba a la derecha): púlsalo para ir directo a la sala y mantén <b>E</b> para reponerlo.</p>',
      [{ l: 'Iniciar transferencia', fn: () => {} }]);
  }

  // ---------- Consola de cada sala ----------
  const TXT = {
    bridge: ['1. NAVE PRINCIPAL', 'Es el módulo central de transporte y operación. Contiene los sistemas de navegación, propulsión, comunicaciones y soporte vital.', 'Prioriza una arquitectura equilibrada. La nave debe ser capaz de transportar a la tripulación y mantener sus sistemas durante todo el viaje.', 'hull', (o) => o.mass + ' t · ' + o.cost + ' M$ · ' + o.spares + ' repuestos'],
    prop: ['PROPULSIÓN · DELTA-v', 'Los tanques de propelente fijan el delta-v: salir de la órbita, corregir el rumbo y frenar en Marte.', 'El combustible es tu capacidad de maniobra. Cada corrección tiene un coste.', 'prop', (o) => o.dv + ' km/s · ' + o.mass + ' t · ' + o.cost + ' M$'],
    life: ['SOPORTE VITAL · OXÍGENO', 'Reservas de oxígeno y depuración de CO₂ para la tripulación. El viaje dura unos siete meses (' + DAYS + ' días).', 'Calcula las reservas para la duración prevista y conserva un margen de seguridad.', 'life', (o) => o.days + ' días · ' + o.mass + ' t · ' + o.cost + ' M$'],
    power: ['POTENCIA ELÉCTRICA', 'Paneles y baterías que alimentan navegación, comunicaciones, control térmico, soporte vital e instrumentos.', 'Sin energía, los sistemas dejan de responder. Evita sobrecargar la red eléctrica.', 'power', (o) => o.kw + ' kW · ' + o.mass + ' t · ' + o.cost + ' M$']
  };
  function optBtns(key, fmt) {
    const sh = M.ship();
    return '<div class="flex gap-2">' + M.COMP[key].map((o, i) => '<button class="opt' + (sh[key] === i ? ' on' : '') + '" data-k="' + key + '" data-v="' + i + '"><b>' + o.n + '</b><br>' + fmt(o) + '</button>').join('') + '</div>';
  }
  function consoleConfig(id) {
    const sh = M.ship(); let h = '';
    if (TXT[id]) { const t = TXT[id]; h = '<h4>' + t[0] + '</h4><p>' + t[1] + '</p>' + '<div class="quote"><b>INSTRUCTOR:</b> ' + t[2] + '</div>' + optBtns(t[3], t[4]); }
    if (id === 'bridge') h += '<button id="c-confirm" class="serv mt-3">VERIFICAR Y CONFIRMAR DISEÑO</button>';
    if (id === 'hangar') h = '<h4>2. MÓDULO DE ATERRIZAJE (LANDER)</h4><p>Vehículo destinado a transportar la carga científica y realizar el descenso hasta la superficie marciana.</p>' +
      optBtns('lander', (o) => o.cap + ' instr. · ' + o.mass + ' t · ' + o.cost + ' M$') +
      '<h4 class="mt-3">3. ESCUDO TÉRMICO</h4><div class="quote"><b>INSTRUCTOR:</b> No sacrifiques protección térmica para ahorrar masa. Una nave que no puede soportar la entrada atmosférica no llegará intacta a su destino.</div>' +
      optBtns('shield', (o) => o.mass + ' t · ' + o.cost + ' M$');
    if (id === 'lab') h = '<h4>4. INSTRUMENTOS CIENTÍFICOS</h4><p>Equipamiento destinado a analizar el suelo, la atmósfera y las condiciones ambientales de Marte.</p>' +
      '<div class="quote"><b>INSTRUCTOR:</b> Cada instrumento representa una oportunidad científica. Selecciona aquellos que aporten información relevante sin comprometer los recursos de la misión.</div>' +
      '<div class="grid grid-cols-2 gap-2">' + M.INSTR.map((o) => '<button class="opt' + (sh.instr.includes(o.id) ? ' on' : '') + '" data-ins="' + o.id + '"><b>' + o.name + '</b><br>' + o.mass + ' t · ' + o.cost + ' M$ · ' + o.kw + ' kW</button>').join('') + '</div>' +
      '<p class="mt-2">El lander admite ' + cfg.landerCap + ' instrumentos.</p>';
    return h;
  }
  const SERV = {
    bridge: ['COMUNICACIONES Y NAVEGACIÓN', 'REAPUNTAR ANTENA', (s) => s.comms < 99],
    life: ['SOPORTE VITAL', 'REGENERAR OXÍGENO (usa energía)', (s) => s.o2 < 99 && s.bat > 6],
    power: ['RED ELÉCTRICA', 'REORIENTAR PANELES SOLARES', (s) => s.bat < 99],
    prop: ['PROPULSIÓN', 'SELLAR FUGA DE PROPELENTE', (s) => s.leak],
    hangar: ['ESCUDO TÉRMICO', 'REPARAR LOSETAS (1 repuesto)', (s) => s.shield < 99 && s.spares > 0],
    lab: ['INSTRUMENTOS', 'RECALIBRAR INSTRUMENTO (1 repuesto)', (s) => s.instr.some((i) => !i.ok) && s.spares > 0]
  };
  function statHtml(id) {
    const s = S, k = (l, v, bad) => '<div class="kv"><span>' + l + '</span><b class="' + (bad ? 'text-red-400' : 'text-emerald-300') + '">' + v + '</b></div>';
    if (id === 'bridge') return k('Señal de comunicación', s.comms.toFixed(0) + ' %', s.comms < 35) + k('Trayectoria', s.dev ? 'DESVIADA' : 'NOMINAL', s.dev) + k('Llegada a Marte en', Math.max(0, Math.round(DAYS - day(s))) + ' días', false);
    if (id === 'life') return k('Oxígeno', s.o2.toFixed(0) + ' %', s.o2 < 25) + k('Reserva instalada', cfg.days + ' días', false);
    if (id === 'power') return k('Baterías', s.bat.toFixed(0) + ' %', s.bat < 20) + k('Potencia disponible', kw(s) + ' kW', s.bat < 20) + k('Demanda', cfg.demand + ' kW', false);
    if (id === 'prop') return k('Delta-v disponible', s.dv.toFixed(2) + ' km/s', s.dv < 0.5) + k('Circuito de propelente', s.leak ? 'FUGA' : 'ESTANCO', s.leak);
    if (id === 'hangar') return k('Integridad del escudo', s.shield.toFixed(0) + ' %', s.shield < 60) + k('Repuestos', s.spares, s.spares === 0);
    return s.instr.map((i) => k(i.name, i.ok ? 'OPERATIVO' : 'FALLO', !i.ok)).join('') + k('Repuestos', s.spares, s.spares === 0) || k('Sin instrumentos', '—', true);
  }
  function renderConsole() {
    const id = ROOMS[room].id, el = $('#console');
    const key = mode + id + (mode === 'config' ? JSON.stringify(M.ship()) + A.settings.launcher : '');
    if (key !== conKey) {
      conKey = key;
      if (mode === 'config') {
        el.innerHTML = consoleConfig(id);
        el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { M.ship()[b.dataset.k] = +b.dataset.v; changed(); });
        el.querySelectorAll('[data-ins]').forEach((b) => b.onclick = () => { const a = M.ship().instr, i = a.indexOf(b.dataset.ins); if (i < 0) a.push(b.dataset.ins); else a.splice(i, 1); changed(); });
        if ($('#c-confirm')) $('#c-confirm').onclick = confirmDesign;
      } else {
        el.innerHTML = '<h4>' + SERV[id][0] + '</h4><div id="c-stat" class="my-2"></div><button id="c-serv" class="serv">' + SERV[id][1] + ' — mantén E</button>';
        const b = $('#c-serv');
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); serv = true; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => { serv = false; }));
      }
    }
    if (mode === 'voyage' && $('#c-stat')) {
      $('#c-stat').innerHTML = statHtml(id);
      const can = SERV[id][2](S); $('#c-serv').disabled = !can; $('#c-serv').classList.toggle('is-held', serv && can);
    }
  }
  function changed() { A.saveSettings(); cfg = M.calc(); S.dv = cfg.dv; A.beep(520, 0.06); conKey = ''; }

  function confirmDesign() {
    const k = cfg = M.calc();
    const checks = [[k.massOk, 'Masa total dentro de la capacidad del lanzador (' + k.mass + ' / ' + k.cap + ' t)'], [k.costOk, 'Presupuesto disponible (' + k.cost + ' / ' + k.budget + ' M$)'],
      [k.dvOk, 'Propelente suficiente para las maniobras (' + k.dv + ' km/s; mínimo ' + M.DV_NEEDED + ')'], [true, 'Integridad del escudo térmico (100 %, escudo ' + k.pick.shield.n.toLowerCase() + ')'],
      [k.days >= DAYS + 30, 'Reservas adecuadas de oxígeno (' + k.days + ' días para ' + DAYS + ' de viaje)'], [k.powerOk, 'Potencia eléctrica suficiente para los sistemas esenciales (' + k.kw + ' / ' + k.demand + ' kW)'],
      [k.capOk, 'Instrumentos dentro de la capacidad del lander (' + k.instr.length + ' / ' + k.landerCap + ')']];
    const all = checks.every((x) => x[0]);
    const list = '<div class="who">CONSEJO DE CONFIGURACIÓN</div><ul>' + checks.map((x) => '<li style="padding-left:0">' + ok(x[0]) + x[1] + '</li>').join('') + '</ul>';
    if (!all) return dlg('CONTROL DE MISIÓN — VERIFICACIÓN DE DISEÑO', list + q('INSTRUCTOR', 'Una nave demasiado pesada puede no despegar. Una nave mal equipada puede no aterrizar. Y una nave sin instrumentos adecuados puede llegar a Marte sin cumplir su objetivo científico. Diseña con inteligencia, cadete.') +
      '<div class="alert">El diseño no cumple todos los requisitos. Ajusta los componentes marcados.</div>', [{ l: 'Seguir configurando', fn: () => {} }]);
    dlg('CONTROL DE MISIÓN — CONFIRMACIÓN DE CONFIGURACIÓN', list + '<div class="ok"><b>Configuración de la nave registrada.</b></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 30px">' +
      [['Masa total', k.mass + ' t'], ['Presupuesto utilizado', k.budgetPct + ' %'], ['Capacidad de propelente', k.dv + ' km/s'], ['Integridad térmica', '100 %'], ['Soporte vital', '100 %'], ['Potencia eléctrica', k.kw + ' kW']]
        .map((x) => '<div class="kv"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>' +
      '<p class="motto mt-2">La misión está lista para iniciar la transferencia interplanetaria.</p>',
      [{ l: 'Seguir configurando', fn: () => {} }, { l: '[ INICIAR VIAJE A MARTE ]', fn: startVoyage }]);
  }

  // ---------- Movimiento por la nave ----------
  function step(dir) { if (!move && !paused) { move = { to: (room + dir + ROOMS.length) % ROOMS.length, dir, p: 0 }; serv = false; A.beep(300, 0.05); } }
  function goTo(target) {
    if (paused || target === room) return;
    const n = ROOMS.length, fwd = (target - room + n) % n, dir = fwd <= n / 2 ? 1 : -1, cnt = dir > 0 ? fwd : n - fwd;
    queue = []; for (let i = 0; i < cnt; i++) queue.push(dir);
  }
  $('#nav-l').onclick = () => step(-1); $('#nav-r').onclick = () => step(1);

  // ---------- Alertas ----------
  function alerts() {
    if (mode !== 'voyage') return [];
    const s = S, a = [];
    s.ev.forEach((e, i) => { if (e.on && !e.done) a.push(['bridge' === e.room ? 0 : ri(e.room), 'EVENTO CRÍTICO 0' + (i + 1) + ' · ' + e.short]); });
    if (s.o2 < 25) a.push([1, 'Oxígeno crítico: ' + s.o2.toFixed(0) + ' %']);
    if (s.bat < 20) a.push([2, 'Potencia eléctrica crítica: ' + s.bat.toFixed(0) + ' %']);
    if (s.leak) a.push([3, 'Fuga de propelente: perdiendo delta-v']);
    if (s.shield < 60) a.push([4, 'Escudo térmico dañado: ' + s.shield.toFixed(0) + ' %']);
    if (s.comms < 35 && !s.ev[0].on) a.push([0, 'Señal de comunicación débil: ' + s.comms.toFixed(0) + ' %']);
    if (s.instr.some((i) => !i.ok)) a.push([5, 'Instrumento científico en fallo']);
    return a;
  }
  function renderHud() {
    const al = alerts(), key = JSON.stringify(al.map((x) => x[1].replace(/\d+ %/, ''))) + room;
    const hot = new Set(al.map((x) => x[0]));
    if (key !== alertKey) {
      alertKey = key;
      $('#alerts').innerHTML = al.length ? '<div class="alrt-h">⚠ PANEL DE ALERTAS</div>' + al.map((x) => '<button class="alrt" data-r="' + x[0] + '"><span>' + x[1] + '</span><b>' + (x[0] === room ? 'AQUÍ' : 'IR →') + '</b></button>').join('') : '';
      $('#alerts').querySelectorAll('button').forEach((b) => b.onclick = () => goTo(+b.dataset.r));
      $('#sh-map').innerHTML = ROOMS.map((r, i) => '<button class="mapb' + (i === room ? ' on' : '') + (hot.has(i) ? ' alarm' : '') + '" data-r="' + i + '">' + r.name.split(' ')[0].toUpperCase() + '</button>').join('');
      $('#sh-map').querySelectorAll('button').forEach((b) => b.onclick = () => goTo(+b.dataset.r));
      const n = ROOMS.length, l = (room - 1 + n) % n, r = (room + 1) % n;
      $('#nav-l').innerHTML = '<small>◀ A</small>' + ROOMS[l].name; $('#nav-r').innerHTML = '<small>D ▶</small>' + ROOMS[r].name;
      $('#nav-l').classList.toggle('alarm', hot.has(l)); $('#nav-r').classList.toggle('alarm', hot.has(r));
      $('#sh-room').textContent = ROOMS[room].name; $('#sh-res').textContent = ROOMS[room].res;
    }
    const st = (l, v, bad) => '<div class="stat' + (bad ? ' bad' : '') + '"><label>' + l + '</label><b>' + v + '</b></div>';
    if (mode === 'config') {
      const k = cfg;
      $('#sh-phase').textContent = '3.2 · SEGMENTO ESPACIAL · CONFIGURACIÓN EN ÓRBITA';
      $('#sh-stats').innerHTML = st('MASA', k.mass + '/' + k.cap + ' t', !k.massOk) + st('PRESUPUESTO', k.budgetPct + ' %', !k.costOk) + st('DELTA-v', k.dv + ' km/s', !k.dvOk) +
        st('OXÍGENO', k.days + ' días', false) + st('POTENCIA', k.kw + '/' + k.demand + ' kW', !k.powerOk) + st('ESCUDO', k.pick.shield.n, false) + st('INSTRUM.', k.instr.length + '/' + k.landerCap, !k.capOk);
    } else {
      const s = S;
      $('#sh-phase').textContent = 'FASE 2 · VIAJE INTERPLANETARIO · DÍA ' + String(Math.min(DAYS, Math.floor(day(s)))).padStart(3, '0') + ' / ' + DAYS;
      $('#sh-stats').innerHTML = st('DELTA-v', s.dv.toFixed(2) + ' km/s', s.leak || s.dv < 0.5) + st('OXÍGENO', s.o2.toFixed(0) + ' %', s.o2 < 25) + st('ENERGÍA', s.bat.toFixed(0) + ' %', s.bat < 20) +
        st('ESCUDO', s.shield.toFixed(0) + ' %', s.shield < 60) + st('COMUNIC.', s.comms.toFixed(0) + ' %', s.comms < 35) + st('INSTRUM.', s.instr.filter((i) => i.ok).length + '/' + s.instr.length, s.instr.some((i) => !i.ok)) + st('REPUESTOS', s.spares, false);
    }
  }

  // ---------- Simulación del viaje ----------
  function failC(cause) {
    mode = 'off';
    const s = S;
    M.report('<h3>&lt; MISIÓN INTERRUMPIDA &gt;</h3><div class="who">CENTRO DE CONTROL DE MISIÓN</div>' +
      '<p>Cadete, la nave no consiguió completar el viaje interplanetario.</p><p>El análisis de telemetría revela que uno o varios sistemas críticos quedaron fuera de sus parámetros operativos.</p>' +
      '<div class="alert mb-2"><b>INFORME DE FALLO</b> · Segmento afectado: Espacial.<br>Causa: Gestión inadecuada de los recursos de la nave (' + cause + ', día ' + Math.floor(day(s)) + ').<br>' +
      'Propelente restante: ' + Math.max(0, s.dv / (cfg.dv - DV_TMI) * 100).toFixed(0) + ' % · Reservas de oxígeno: ' + Math.max(0, s.o2).toFixed(0) + ' % · Potencia eléctrica: ' + kw(s) + ' kW · Integridad de sistemas: COMPROMETIDA.</div>' +
      q('INSTRUCTOR', 'Durante un viaje interplanetario, cada recurso debe calcularse para toda la duración prevista. Una nave puede tener una trayectoria correcta y aun así fracasar si no dispone de energía, propelente o soporte vital suficiente.') +
      '<p class="motto">LECCIÓN APRENDIDA: Equilibra la masa, el consumo energético y las reservas de soporte vital. Conserva siempre márgenes para situaciones imprevistas.</p>',
      [{ l: 'Menú principal', fn: () => A.show('menu') }, { l: 'Repetir el viaje', fn: startVoyage }, { l: '[ Reintentar misión ]', fn: () => A.startShip('config') }]);
  }

  function update(dt) {
    const s = S, id = ROOMS[room].id, lv = M.ship();
    s.t += dt;
    s.o2 -= [0.85, 0.68, 0.55][lv.life] * dt;
    s.bat -= Math.max(0.1, 0.42 + 0.07 * s.instr.length - [0, 0.14, 0.26][lv.power]) * dt;
    s.comms -= 0.22 * dt;
    if (!s.leak && s.leakAt && s.t > s.leakAt) { s.leak = true; s.leakAt = 0; s.seal = 0; A.beep(180, 0.4); }
    if (s.leak) s.dv -= 0.022 * dt;
    if (s.hits.length && s.t > s.hits[0]) { s.hits.shift(); s.shield -= 13 + Math.random() * 6; s.flash = 1; A.beep(120, 0.3); }
    if (s.glitchAt && s.t > s.glitchAt) { s.glitchAt = 0; const i = s.instr.find((x) => x.ok); if (i) { i.ok = false; A.beep(200, 0.2); } }
    s.ev.forEach((e) => { if (!e.on && s.t > e.at) { e.on = true; e.start(s); A.beep(700, 0.5); } });
    if (s.o2 < 25 || s.bat < 20) s.crit += dt;

    if (serv && !move && SERV[id][2](s)) {                       // reponer en la sala actual
      if (id === 'life') { s.o2 += 14 * dt; s.bat -= 2.5 * dt; }
      if (id === 'power') s.bat += 12 * dt;
      if (id === 'bridge') s.comms += 16 * dt;
      if (id === 'prop') { s.seal += dt; if (s.seal > 2.5) { s.leak = false; A.beep(880, 0.2); } }
      if (id === 'hangar') { s.rep += dt; if (s.rep > 1.4) { s.rep = 0; s.spares--; s.shield += 12; A.beep(880, 0.1); } }
      if (id === 'lab') { s.cal += dt; if (s.cal > 2.5) { s.cal = 0; s.spares--; s.instr.find((i) => !i.ok).ok = true; A.beep(880, 0.2); } }
    }
    s.o2 = Math.min(100, s.o2); s.bat = Math.min(100, s.bat); s.comms = clamp(s.comms, 0, 100); s.shield = clamp(s.shield, 0, 100);
    if (s.ev[0].on && !s.ev[0].done) s.comms = Math.min(s.comms, 42);

    if (s.o2 <= 0) return failC('oxígeno agotado');
    if (s.bat <= 0) return failC('nave sin energía');
    if (s.dv <= 0) return failC('propelente agotado');

    const e = s.ev.find((x) => x.on && !x.done && ri(x.room) === room && s.t > x.cool);
    if (e && !move) return openEvent(e, s.ev.indexOf(e));

    if (s.t >= T_TOTAL && s.ev.every((x) => x.done)) {
      mode = 'arrived';
      const voy = { o2: s.o2, bat: s.bat, dv: s.dv, shield: s.shield, comms: s.comms, right: s.right, wrong: s.wrong, crit: s.crit,
        instrOk: s.instr.filter((i) => i.ok).length, instrN: s.instr.length };
      A.run.voy = voy; A.store.set('aeon01.save', { phase: 'edl', run: A.run });
      dlg('CONTROL DE MISIÓN — FINAL DEL VIAJE INTERPLANETARIO',
        '<p>Cadete, los datos de navegación confirman que la nave ha llegado a las proximidades de Marte.</p><p>Las comunicaciones se mantienen dentro de los parámetros operativos.</p>' +
        '<p>La tripulación está preparada y los sistemas de descenso han iniciado su secuencia de comprobación.</p><p>Hemos recorrido millones de kilómetros.</p><p>Ahora comienza la fase más delicada de la expedición.</p>' +
        '<p class="motto">PREPARA LA MANIOBRA DE ENTRADA, DESCENSO Y ATERRIZAJE.</p>',
        [{ l: 'Ir a la cabina', fn: () => { mode = 'off'; A.startEDL(voy); } }]);
    }
  }

  // ---------- Dibujo de las salas (perspectiva 2D en primera persona) ----------
  const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
  const dust = []; for (let i = 0; i < 40; i++) dust.push([Math.random() * W, Math.random() * H, Math.random() * 6.28]);
  const wstars = []; for (let i = 0; i < 90; i++) wstars.push([Math.random(), Math.random(), Math.random() * 1.6 + 0.4]);

  function shell(r, t) {
    const [R, G, B] = r.hue, col = (k, a) => 'rgba(' + (R * k | 0) + ',' + (G * k | 0) + ',' + (B * k | 0) + ',' + (a == null ? 1 : a) + ')';
    c.fillStyle = '#05080d'; c.fillRect(0, 0, W, H);
    poly([[0, 0], [W, 0], [1220, 190], [380, 190]], '#161d29');
    poly([[0, H], [W, H], [1220, 650], [380, 650]], '#0c1118');
    poly([[0, 0], [380, 190], [380, 650], [0, H]], '#1b2331');
    poly([[W, 0], [1220, 190], [1220, 650], [W, H]], '#1b2331');
    const wg = c.createLinearGradient(0, 190, 0, 650); wg.addColorStop(0, '#263143'); wg.addColorStop(1, '#19212e');
    c.fillStyle = wg; c.fillRect(380, 190, 840, 460);
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3;
    [0.3, 0.6, 1].forEach((f) => c.strokeRect(380 * f, 190 * f, W - 760 * f, H - 440 * f));           // costillas del casco
    [[0, 0, 380, 190], [W, 0, 1220, 190], [0, H, 380, 650], [W, H, 1220, 650]].forEach((l) => { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); });
    for (let i = 1; i < 8; i++) { const x = i * 200; c.beginPath(); c.moveTo(x, H); c.lineTo(380 + x * 0.525, 650); c.stroke(); }    // rejilla del suelo
    const pulse = 0.75 + 0.25 * Math.sin(t * 2);
    poly([[500, 60], [1100, 60], [1040, 110], [560, 110]], col(1.1, 0.85 * pulse));                       // luz de techo
    const lg = c.createRadialGradient(800, 90, 20, 800, 300, 700); lg.addColorStop(0, col(1, 0.22)); lg.addColorStop(1, col(1, 0));
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    c.fillStyle = col(1, 0.9); c.fillRect(380, 190, 840, 7); c.fillRect(380, 643, 840, 7);
    // puertas laterales
    [[0.26, 0.74, 1], [0.26, 0.74, -1]].forEach((d) => {
      const X = (f) => (d[2] > 0 ? 380 * f : W - 380 * f), top = (f) => 190 * f + (H - 440 * f) * 0.2, bot = (f) => H - 250 * f;
      poly([[X(d[0]), top(d[0])], [X(d[1]), top(d[1])], [X(d[1]), bot(d[1])], [X(d[0]), bot(d[0])]], '#070b11');
      c.strokeStyle = col(1.1, 0.9); c.lineWidth = 4; c.stroke();
      c.fillStyle = col(1, 0.12); c.fill();
    });
    return col;
  }

  function centerpiece(id, col, t) {
    const s = S, lv = M.ship();
    if (id === 'bridge') {                                   // ventanal + pantalla de navegación
      c.save(); c.beginPath(); c.roundRect(470, 225, 660, 250, 24); c.fillStyle = '#01030a'; c.fill(); c.clip();
      wstars.forEach((p) => { c.fillStyle = 'rgba(220,235,255,' + (0.4 + 0.5 * Math.abs(Math.sin(t * p[2] + p[0] * 9))) + ')'; c.fillRect(470 + ((p[0] * 660 + t * (mode === 'voyage' ? 14 : 2) * p[2]) % 660), 225 + p[1] * 250, p[2], p[2]); });
      if (mode === 'config') { const g = c.createLinearGradient(0, 400, 0, 480); g.addColorStop(0, '#7cc4ff'); g.addColorStop(0.3, '#1a62c0'); g.addColorStop(1, '#062258'); c.fillStyle = g; c.beginPath(); c.arc(800, 1330, 920, 0, 7); c.fill(); }
      else { const p = clamp(s.t / T_TOTAL, 0, 1), rr = 6 + p * p * 70, g = c.createRadialGradient(990 - rr * 0.3, 330 - rr * 0.3, 1, 990, 330, rr); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#8a3216'); c.fillStyle = g; c.beginPath(); c.arc(990, 330, rr, 0, 7); c.fill(); }
      c.restore(); c.strokeStyle = col(1.1); c.lineWidth = 5; c.beginPath(); c.roundRect(470, 225, 660, 250, 24); c.stroke();
      c.fillStyle = '#04101f'; c.fillRect(560, 500, 480, 120); c.strokeRect(560, 500, 480, 120);
      c.strokeStyle = 'rgba(127,220,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(590, 595); c.quadraticCurveTo(800, 480, 1010, 540); c.stroke();
      const p = mode === 'voyage' ? clamp(s.t / T_TOTAL, 0, 1) : 0, bx = 590 + 420 * p, by = (1 - p) * (1 - p) * 595 + 2 * (1 - p) * p * 480 + p * p * 540 + (s.dev ? Math.sin(t * 5) * 6 - 14 : 0);
      c.fillStyle = s.dev ? '#ff5a3c' : '#fff'; c.beginPath(); c.arc(bx, by, 6, 0, 7); c.fill();
      c.fillStyle = '#3c8cff'; c.beginPath(); c.arc(590, 595, 9, 0, 7); c.fill(); c.fillStyle = '#e0683a'; c.beginPath(); c.arc(1010, 540, 7, 0, 7); c.fill();
      const bars = Math.round(s.comms / 20); for (let i = 0; i < 5; i++) { c.fillStyle = i < bars ? '#3cff9e' : '#243'; c.fillRect(960 + i * 13, 606 - i * 5, 9, 8 + i * 5); }
    }
    if (id === 'life') {                                     // depósitos de O2 + ventilador + huerto
      for (let i = 0; i < 3; i++) {
        const x = 480 + i * 110; c.fillStyle = '#0c1620'; c.beginPath(); c.roundRect(x, 250, 80, 330, 38); c.fill();
        const hgt = 310 * clamp(s.o2 / 100, 0, 1); c.save(); c.beginPath(); c.roundRect(x + 8, 260, 64, 310, 30); c.clip();
        c.fillStyle = s.o2 < 25 ? '#ff5a3c' : '#3cdfb0'; c.fillRect(x, 570 - hgt + Math.sin(t * 3 + i) * 3, 80, hgt + 10); c.restore();
        c.strokeStyle = col(1.2); c.lineWidth = 3; c.beginPath(); c.roundRect(x, 250, 80, 330, 38); c.stroke();
      }
      c.save(); c.translate(960, 340); c.fillStyle = '#0c1620'; c.beginPath(); c.arc(0, 0, 95, 0, 7); c.fill(); c.rotate(t * (serv ? 9 : 2.5));
      c.fillStyle = col(1.1, 0.9); for (let i = 0; i < 5; i++) { c.rotate(6.283 / 5); c.beginPath(); c.ellipse(45, 0, 42, 13, 0.4, 0, 7); c.fill(); } c.restore();
      c.strokeStyle = col(1.2); c.lineWidth = 4; c.beginPath(); c.arc(960, 340, 95, 0, 7); c.stroke();
      c.fillStyle = '#3a2a1c'; c.fillRect(850, 540, 240, 50);
      for (let i = 0; i < 9; i++) { c.strokeStyle = '#4fd06a'; c.lineWidth = 4; c.beginPath(); c.moveTo(865 + i * 26, 540); c.quadraticCurveTo(858 + i * 26 + Math.sin(t + i) * 6, 510, 870 + i * 26 + Math.sin(t * 1.3 + i) * 8, 482 + (i % 3) * 8); c.stroke(); }
    }
    if (id === 'power') {                                    // núcleo + baterías
      const pl = 0.6 + 0.4 * Math.sin(t * 4), g = c.createRadialGradient(660, 410, 10, 660, 410, 170);
      g.addColorStop(0, 'rgba(255,245,200,' + (0.4 + 0.6 * s.bat / 100) + ')'); g.addColorStop(0.4, col(1.1, 0.7 * pl)); g.addColorStop(1, col(1, 0));
      c.fillStyle = '#0c1118'; c.beginPath(); c.arc(660, 410, 150, 0, 7); c.fill(); c.fillStyle = g; c.beginPath(); c.arc(660, 410, 170, 0, 7); c.fill();
      c.strokeStyle = col(1.2); c.lineWidth = 6; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(660, 410, 80 + i * 32, t * (i + 1) * 0.6, t * (i + 1) * 0.6 + 4.2); c.stroke(); }
      for (let i = 0; i < 5; i++) {
        const x = 900 + i * 56; c.fillStyle = '#0c1118'; c.fillRect(x, 260, 42, 320);
        const n = Math.round(clamp(s.bat / 100, 0, 1) * 10); for (let j = 0; j < 10; j++) { c.fillStyle = j < n ? (s.bat < 20 ? '#ff5a3c' : '#ffd23c') : '#252c38'; c.fillRect(x + 5, 548 - j * 30, 32, 24); }
        c.strokeStyle = col(1.1); c.lineWidth = 2; c.strokeRect(x, 260, 42, 320);
      }
    }
    if (id === 'prop') {                                     // tanques y tuberías
      const full = clamp(s.dv / M.COMP.prop[2].dv, 0, 1);
      [[460, 250], [460, 430]].forEach((p, i) => {
        c.fillStyle = '#0c1118'; c.beginPath(); c.roundRect(p[0], p[1], 520, 150, 75); c.fill();
        c.save(); c.beginPath(); c.roundRect(p[0] + 8, p[1] + 8, 504, 134, 66); c.clip();
        c.fillStyle = i ? '#ff9a3c' : '#5ac8ff'; c.fillRect(p[0], p[1], 520 * full + Math.sin(t * 2 + i) * 4, 150); c.restore();
        c.strokeStyle = col(1.2); c.lineWidth = 4; c.beginPath(); c.roundRect(p[0], p[1], 520, 150, 75); c.stroke();
      });
      c.strokeStyle = '#7b8798'; c.lineWidth = 14; c.beginPath(); c.moveTo(980, 325); c.lineTo(1110, 325); c.lineTo(1110, 620); c.moveTo(980, 505); c.lineTo(1110, 505); c.stroke();
      c.fillStyle = '#39414f'; c.beginPath(); c.moveTo(1050, 600); c.lineTo(1170, 600); c.lineTo(1150, 645); c.lineTo(1070, 645); c.fill();
      if (s.leak) for (let i = 0; i < 26; i++) { const a = -0.9 + Math.random() * 0.7, d = Math.random() * 180; c.fillStyle = 'rgba(210,240,255,' + (1 - d / 180) * 0.8 + ')'; c.beginPath(); c.arc(1110 + Math.cos(a) * d, 420 + Math.sin(a) * d, 3 + d / 30, 0, 7); c.fill(); }
    }
    if (id === 'hangar') {                                   // lander con su escudo
      const sz = 0.85 + lv.lander * 0.12, cx = 800, by = 590;
      c.strokeStyle = '#6b7482'; c.lineWidth = 8; c.beginPath(); c.moveTo(cx - 190, 640); c.lineTo(cx - 120, by); c.moveTo(cx + 190, 640); c.lineTo(cx + 120, by); c.stroke();
      c.fillStyle = '#d9e1ea'; c.beginPath(); c.moveTo(cx - 60 * sz, by - 290 * sz); c.lineTo(cx + 60 * sz, by - 290 * sz); c.lineTo(cx + 190 * sz, by - 40); c.lineTo(cx - 190 * sz, by - 40); c.closePath(); c.fill();
      c.fillStyle = '#9fb0c4'; c.beginPath(); c.moveTo(cx + 10, by - 290 * sz); c.lineTo(cx + 60 * sz, by - 290 * sz); c.lineTo(cx + 190 * sz, by - 40); c.lineTo(cx + 40, by - 40); c.fill();
      c.fillStyle = '#0b1626'; c.beginPath(); c.arc(cx - 20, by - 190 * sz, 22, 0, 7); c.fill(); c.fillStyle = A.settings.accent; c.fillRect(cx - 150 * sz, by - 110, 300 * sz, 8);
      const k = clamp(s.shield / 100, 0, 1), th = 20 + lv.shield * 9;
      c.fillStyle = 'rgb(' + (90 + 150 * (1 - k) | 0) + ',' + (60 * k + 30 | 0) + ',' + (30 | 0) + ')'; c.beginPath(); c.ellipse(cx, by - 30, 205 * sz, th, 0, 0, 7); c.fill();
      c.strokeStyle = col(1.2); c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#150a05'; c.lineWidth = 3; for (let i = 0; i < Math.round((1 - k) * 12); i++) { const x = cx - 170 + (i * 97) % 340; c.beginPath(); c.moveTo(x, by - 42); c.lineTo(x + 12, by - 30); c.lineTo(x + 2, by - 18); c.stroke(); }
    }
    if (id === 'lab') {                                      // bastidores de instrumentos
      const sel = lv.instr;
      M.INSTR.forEach((ins, i) => {
        const x = 450 + i * 180, on = sel.includes(ins.id), st = mode === 'voyage' ? s.instr.find((z) => z.id === ins.id) : null, fault = st && !st.ok;
        c.fillStyle = on ? '#101a2a' : '#0b0f15'; c.fillRect(x, 250, 150, 350); c.strokeStyle = on ? col(1.2) : '#2a3342'; c.lineWidth = 3; c.strokeRect(x, 250, 150, 350);
        if (!on) { c.strokeStyle = '#2a3342'; c.beginPath(); c.moveTo(x, 250); c.lineTo(x + 150, 600); c.moveTo(x + 150, 250); c.lineTo(x, 600); c.stroke(); return; }
        c.fillStyle = '#04101f'; c.fillRect(x + 15, 270, 120, 90);
        c.strokeStyle = fault ? '#ff5a3c' : '#3cff9e'; c.lineWidth = 2; c.beginPath();
        for (let k = 0; k <= 24; k++) { const y = 315 + (fault ? (Math.random() - 0.5) * 50 : Math.sin(t * 3 + k * 0.6 + i) * 22 * Math.sin(k * 0.3 + i)); k ? c.lineTo(x + 15 + k * 5, y) : c.moveTo(x + 15 + k * 5, y); } c.stroke();
        for (let k = 0; k < 6; k++) { c.fillStyle = fault ? (Math.floor(t * 4) % 2 ? '#ff3c3c' : '#511') : (Math.sin(t * 2 + k + i) > 0 ? '#3cff9e' : '#1b5c3e'); c.fillRect(x + 18 + (k % 3) * 40, 385 + (k / 3 | 0) * 34, 30, 20); }
        c.fillStyle = col(0.9, 0.8); c.fillRect(x + 15, 470, 120, 110);
        c.fillStyle = '#04101f'; [[40, 500, 22], [95, 525, 30], [50, 555, 12]].forEach((o) => { c.beginPath(); c.arc(x + o[0], o[1], o[2] / 2 + i * 2, 0, 7); c.fill(); });
      });
    }
  }

  function drawRoom(i, ox, t) {
    const r = ROOMS[i]; c.save(); c.translate(ox, Math.sin(t * 0.8) * 5);
    const col = shell(r, t);
    c.save(); c.translate(390, 420); c.scale(0.62, 0.62); c.translate(-390, -420); centerpiece(r.id, col, t); c.restore();   // equipo a la izquierda, consola a la derecha
    c.restore();
  }

  function draw(now) {
    const t = now / 1000;
    if (move) { const e = move.p * move.p * (3 - 2 * move.p); drawRoom(room, -move.dir * e * W, t); drawRoom(move.to, move.dir * (1 - e) * W, t); }
    else drawRoom(room, 0, t);
    dust.forEach((d) => { d[0] = (d[0] + Math.cos(d[2]) * 0.25 + W) % W; d[1] = (d[1] + Math.sin(d[2]) * 0.25 + H) % H; c.fillStyle = 'rgba(200,225,255,.25)'; c.fillRect(d[0], d[1], 2, 2); });
    if (mode === 'voyage') {
      const hot = alerts().some((x) => x[0] === room);
      if (hot) { c.fillStyle = 'rgba(255,40,30,' + (0.07 + 0.07 * Math.sin(t * 6)) + ')'; c.fillRect(0, 0, W, H); }
      if (S.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + S.flash * 0.5 + ')'; c.fillRect(0, 0, W, H); S.flash -= 0.04; }
      if (S.comms < 35) for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(180,220,255,.08)'; c.fillRect(0, Math.random() * H, W, 3); }
    }
    const v = c.createRadialGradient(800, 450, 420, 800, 450, 980); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    $('#console').style.visibility = move ? 'hidden' : '';
  }

  function loop(now) {
    raf = 0;
    if (mode === 'off' || $('#screen-ship').classList.contains('hidden')) { mode = 'off'; return; }
    const dt = Math.min(0.05, (now - last) / 1000) * (A.ts || 1); last = now;
    if (!paused) {
      if (!move && queue.length) step(queue.shift());
      if (move) { move.p += dt / 0.4 * Math.max(1, A.ts || 1); if (move.p >= 1) { room = move.to; move = null; conKey = ''; alertKey = ''; } }
      if (mode === 'voyage') update(dt);
    }
    if (mode !== 'off') {
      draw(now);
      hud += dt; if (hud > 0.15 || !conKey) { hud = 0; if (mode === 'config' || mode === 'voyage') { renderConsole(); renderHud(); } }
      raf = requestAnimationFrame(loop);
    }
  }

  A.resume = function (save) {
    A.run = save.run || { tries: 1 };
    if (save.phase === 'edl' && A.run.voy) { cfg = M.calc(); A.startEDL(A.run.voy); }
    else A.startShip(save.phase === 'voyage' ? 'voyage' : 'config');
  };

  // ---------- Teclado ----------
  window.addEventListener('keydown', (e) => {
    if (mode !== 'config' && mode !== 'voyage') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') step(-1);
    if (k === 'd' || k === 'arrowright') step(1);
    if (k === 'e' && mode === 'voyage') serv = true;
    if (k === 'escape' && !paused) { mode = 'off'; A.show('menu'); }
  });
  window.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'e') serv = false; });
})();
