/* AEON-01 — Interior de la nave: mapa lateral continuo (2D).
   La nave es un único plano en corte, de proa (izquierda) a popa (derecha), con seis salas
   unidas por puertas. El cadete se mueve libremente con A/D o ←/→ y la cámara lo sigue.
   Todo se hace por proximidad: hay que acercarse al panel y pulsar E o Espacio cuando
   aparece el indicador.
   Modo 'config' (3.2 Segmento Espacial): la consola de cada sala configura un componente.
   Modo 'voyage' (Fase 2): viaje de ~7 meses comprimido; cada recurso se repone en su módulo,
   el panel de alertas lleva andando hasta el módulo afectado y Control de Misión plantea
   tres eventos críticos.
   Modo 'arrived': hay que volver al puesto del piloto para iniciar el descenso. */
(function () {
  'use strict';
  const A = window.AEON, M = A.mission, W = 1600, H = 900;
  const $ = (s) => document.querySelector(s);
  const cv = $('#ship'), c = cv.getContext('2d');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Geometría del mapa (coordenadas de mundo = píxeles del escenario) ----------
  const TOP = 150, CEIL = 205, FLOOR = 690, BOT = 765;   // casco superior, techo, suelo, casco inferior
  const DOOR = 440;                                       // dintel de las puertas
  const ROOMS = [
    { id: 'bridge', name: 'Puente de mando', short: 'PUENTE', res: 'Pilotaje · navegación · comunicaciones', hue: [50, 120, 210], w: 1150 },
    { id: 'life', name: 'Soporte vital', short: 'SOPORTE', res: 'Oxígeno', hue: [40, 170, 120], w: 1000 },
    { id: 'lab', name: 'Laboratorio', short: 'LABORAT.', res: 'Instrumentos científicos', hue: [150, 100, 225], w: 1050 },
    { id: 'hangar', name: 'Hangar del lander', short: 'HANGAR', res: 'Lander · escudo térmico', hue: [200, 80, 80], w: 1050 },
    { id: 'power', name: 'Sala de energía', short: 'ENERGÍA', res: 'Potencia eléctrica', hue: [220, 170, 40], w: 1000 },
    { id: 'prop', name: 'Propulsión', short: 'MOTORES', res: 'Delta-v / combustible', hue: [220, 110, 50], w: 1050 }
  ];
  let SHIP_W = 0; ROOMS.forEach((r) => { r.x0 = SHIP_W; SHIP_W += r.w; });
  const ri = (id) => ROOMS.findIndex((r) => r.id === id);
  const at = (id, f) => { const r = ROOMS[ri(id)]; return r.x0 + r.w * f; };
  const roomAt = (x) => { let i = 0; ROOMS.forEach((r, j) => { if (x >= r.x0) i = j; }); return i; };

  // Puestos con los que se interactúa por proximidad
  const SEAT_X = 175;                                     // asiento del piloto (mira a proa)
  const ST = [
    { id: 'seat', room: 'bridge', x: 215, label: 'PUESTO DEL PILOTO' },
    { id: 'bridge', room: 'bridge', x: 965, label: 'COMUNICACIONES', cfgLabel: 'NAVE PRINCIPAL' },
    { id: 'life', room: 'life', x: at('life', 0.8), label: 'SOPORTE VITAL' },
    { id: 'lab', room: 'lab', x: at('lab', 0.82), label: 'INSTRUMENTOS' },
    { id: 'hangar', room: 'hangar', x: at('hangar', 0.82), label: 'LANDER Y ESCUDO' },
    { id: 'power', room: 'power', x: at('power', 0.8), label: 'RED ELÉCTRICA' },
    { id: 'prop', room: 'prop', x: at('prop', 0.8), label: 'PROPULSIÓN' }
  ];
  const station = (id) => ST.find((s) => s.id === id);
  const X_MIN = 262, X_MAX = SHIP_W - 85, REACH = 125, SPEED = 470;
  const T_TOTAL = 150, DAYS = 210, DV_TMI = 3.6;

  let mode = 'off', S = null, cfg = null, last = 0, raf = 0;
  let paused = false, serv = false, open = null, dirty = true, conKey = '', alertKey = '', actKey = '', hud = 0;
  const P = { x: SEAT_X, vx: 0, face: -1, ph: 0, seated: true, auto: null, work: false, full: '' };   // el cadete
  const cam = { x: 0 };
  const keys = { l: false, r: false };
  const doors = ROOMS.map(() => 0);                       // apertura 0-1 de la puerta de entrada de cada sala

  // ---------- Diálogo superpuesto a la vista ----------
  function dlg(who, html, buttons) {
    paused = true; serv = false; keys.l = keys.r = false;
    $('#sd-who').textContent = who; $('#sd-body').innerHTML = html; $('#sd-body').scrollTop = 0;
    $('#sd-btns').innerHTML = buttons.map((b, i) => '<div class="neon-wrap"><button data-i="' + i + '" class="neon-btn neon-btn--sm" style="min-width:150px;height:auto;min-height:44px;white-space:normal;padding:8px 16px;max-width:900px">' + b.l + '</button></div>').join('');
    $('#sd-btns').querySelectorAll('button').forEach((b) => b.onclick = () => {
      A.beep(440, 0.1); $('#ship-holo').classList.add('hidden'); $('#ship-holo').classList.remove('flex'); paused = false; last = performance.now(); dirty = true;
      buttons[+b.dataset.i].fn();
    });
    $('#ship-holo').classList.remove('hidden'); $('#ship-holo').classList.add('flex');
  }
  const q = (who, t) => '<div class="quote"><div class="who">' + who + '</div>' + t + '</div>';
  const ok = (b) => '<span class="' + (b ? 'text-emerald-300' : 'text-red-400') + '">' + (b ? '✓' : '✗') + '</span> ';

  // ---------- Eventos críticos de la Fase 2 ----------
  const EV = [
    { at: 22, st: 'bridge', tag: '&lt; ALERTA DE TELEMETRÍA &gt;', title: 'EVENTO CRÍTICO 01 — PÉRDIDA PARCIAL DE COMUNICACIONES', who: 'ESTACIÓN TERRESTRE — COMUNICACIÓN', short: 'Comunicaciones degradadas',
      body: 'Atención, Control de Misión. Estamos detectando una degradación en la señal de comunicación con la nave. La recepción de telemetría es intermitente. Algunos paquetes de datos no están llegando correctamente.',
      tel: () => ['Señal de comunicación: 42 %', 'Telemetría: Parcial', 'Navegación: Sin anomalías confirmadas', 'Estado de la nave: Operativo'],
      cm: 'Cadete, debemos recuperar la recepción de datos antes de perder visibilidad sobre los sistemas de la nave.',
      a: 'A. Activar el sistema de comunicaciones de respaldo.', b: 'B. Mantener la configuración actual y solicitar una nueva transmisión de telemetría.',
      good: ['Comunicación de respaldo establecida. La recepción de telemetría mejora progresivamente.', 'Buena decisión, cadete. Hemos recuperado visibilidad sobre la nave.'],
      bad: ['La pérdida de datos continúa. El equipo terrestre no puede verificar adecuadamente el estado de los sistemas.', 'La supervisión de la misión está comprometida. Debemos recuperar la comunicación antes de continuar.'],
      start(s) { s.comms = 42; }, onGood(s) { s.comms = 92; }, onBad(s) { s.comms = Math.max(15, s.comms - 10); } },
    { at: 66, st: 'power', tag: '&lt; ALERTA DE RADIACIÓN &gt;', title: 'EVENTO CRÍTICO 02 — TORMENTA SOLAR', who: 'CENTRO DE CONTROL DE MISIÓN', short: 'Tormenta solar',
      body: 'Atención, cadete. Los instrumentos de monitoreo espacial han detectado un incremento de actividad solar. La radiación puede afectar los componentes electrónicos y aumentar la exposición de la tripulación.',
      tel: (s) => ['Actividad solar: Elevada', 'Exposición a radiación: En aumento', 'Sistemas electrónicos: Operativos', 'Potencia eléctrica: ' + kw(s) + ' kW'],
      cm: 'Debemos proteger los sistemas sensibles y conservar la energía disponible.',
      a: 'A. Activar el protocolo de protección contra radiación y priorizar los sistemas esenciales.', b: 'B. Mantener todos los sistemas funcionando a máxima potencia.',
      good: ['Protocolo de protección activado. Los sistemas esenciales permanecen operativos y la tripulación dispone de protección adicional.', 'Excelente respuesta. La seguridad de la tripulación es prioritaria. Hemos reducido los riesgos operativos.'],
      bad: ['El consumo eléctrico permanece elevado y los sistemas continúan expuestos a condiciones desfavorables.', 'La gestión energética y la protección de la tripulación son insuficientes. Reevalúa tus prioridades.'],
      start() {}, onGood(s) { s.bat = Math.max(5, s.bat - 4); }, onBad(s) { s.bat = Math.max(5, s.bat - 20); const i = s.instr.find((x) => x.ok); if (i) i.ok = false; } },
    { at: 108, st: 'seat', tag: '&lt; ALERTA DE NAVEGACIÓN &gt;', title: 'EVENTO CRÍTICO 03 — DESVIACIÓN DE TRAYECTORIA', who: 'CENTRO DE CONTROL DE MISIÓN', short: 'Desviación de trayectoria',
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
      (good ? '' : '<p>La anomalía sigue activa: tendrás que volver a decidir.</p>'), [{ l: 'Continuar', fn: () => {} }]);
  }

  // ---------- Arranques ----------
  function begin(m) {
    mode = m; serv = false; paused = false; dirty = true; conKey = alertKey = actKey = ''; keys.l = keys.r = false;
    P.x = SEAT_X; P.vx = 0; P.face = -1; P.ph = 0; P.seated = true; P.auto = null; P.work = false; P.full = '';   // se empieza sentado a los mandos
    open = m === 'config' ? 'seat' : null;
    doors.fill(0); cam.x = camTarget();
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
      '<p>Estás en el <b>puesto del piloto</b>. Pulsa <b>E</b> para levantarte y recorre la nave con <b>A / D</b> o <b>← / →</b>: la cámara te sigue de una sala a otra.</p>' +
      '<p>Acércate a la consola de cada sala y pulsa <b>E</b> (o <b>Espacio</b>) cuando aparezca el indicador para configurar su componente. Cuando termines, vuelve a sentarte a los mandos y confirma el diseño.</p>',
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
      '<p>A bordo: vigila los indicadores de abajo y las luces de alarma de cada módulo. Lo crítico aparece en el <b>panel de alertas</b> (arriba a la derecha): púlsalo para ir andando hasta el módulo, o camina tú con <b>A / D</b>. ' +
      'Junto al panel averiado, mantén <b>E</b> (o <b>Espacio</b>) para repararlo. Al llegar a Marte tendrás que volver al puesto del piloto.</p>',
      [{ l: 'Iniciar transferencia', fn: () => {} }]);
  }
  function goEDL() { const voy = A.run.voy; mode = 'off'; A.startEDL(voy); }

  // ---------- Consola de cada sala (configuración) ----------
  const TXT = {
    bridge: ['1. NAVE PRINCIPAL', 'Es el módulo central de transporte y operación. Contiene los sistemas de navegación, propulsión, comunicaciones y soporte vital.', 'Prioriza una arquitectura equilibrada. La nave debe ser capaz de transportar a la tripulación y mantener sus sistemas durante todo el viaje.', 'hull', (o) => o.mass + ' t · ' + o.cost + ' M$ · ' + o.spares + ' repuestos'],
    prop: ['PROPULSIÓN · DELTA-v', 'Los tanques de propelente fijan el delta-v: salir de la órbita, corregir el rumbo y frenar en Marte.', 'El combustible es tu capacidad de maniobra. Cada corrección tiene un coste.', 'prop', (o) => o.dv + ' km/s · ' + o.mass + ' t · ' + o.cost + ' M$'],
    life: ['SOPORTE VITAL · OXÍGENO', 'Reservas de oxígeno y depuración de CO₂ para la tripulación. El viaje dura unos siete meses (' + DAYS + ' días).', 'Calcula las reservas para la duración prevista y conserva un margen de seguridad.', 'life', (o) => o.days + ' días · ' + o.mass + ' t · ' + o.cost + ' M$'],
    power: ['POTENCIA ELÉCTRICA', 'Paneles y baterías que alimentan navegación, comunicaciones, control térmico, soporte vital e instrumentos.', 'Sin energía, los sistemas dejan de responder. Evita sobrecargar la red eléctrica.', 'power', (o) => o.kw + ' kW · ' + o.mass + ' t · ' + o.cost + ' M$']
  };
  const kvRow = (l, v, bad) => '<div class="kv"><span>' + l + '</span><b class="' + (bad ? 'text-red-400' : 'text-emerald-300') + '">' + v + '</b></div>';
  function optBtns(key, fmt) {
    const sh = M.ship();
    return '<div class="flex gap-2">' + M.COMP[key].map((o, i) => '<button class="opt' + (sh[key] === i ? ' on' : '') + '" data-k="' + key + '" data-v="' + i + '"><b>' + o.n + '</b><br>' + fmt(o) + '</button>').join('') + '</div>';
  }
  function consoleConfig(id) {
    const sh = M.ship(), k = cfg; let h = '';
    if (TXT[id]) { const t = TXT[id]; h = '<h4>' + t[0] + '</h4><p>' + t[1] + '</p>' + '<div class="quote"><b>INSTRUCTOR:</b> ' + t[2] + '</div>' + optBtns(t[3], t[4]); }
    if (id === 'seat') h = '<h4>PUESTO DEL PILOTO</h4><p>Desde los mandos se verifica el diseño y se inicia la transferencia a Marte. Levántate con <b>E</b> y recorre la nave: cada sala tiene la consola de su componente.</p>' +
      '<div class="my-2">' + kvRow('Masa total', k.mass + ' / ' + k.cap + ' t', !k.massOk) + kvRow('Presupuesto', k.budgetPct + ' %', !k.costOk) + kvRow('Delta-v', k.dv + ' km/s', !k.dvOk) +
      kvRow('Potencia', k.kw + ' / ' + k.demand + ' kW', !k.powerOk) + kvRow('Instrumentos', k.instr.length + ' / ' + k.landerCap, !k.capOk) + '</div>' +
      '<button id="c-confirm" class="serv mt-1">VERIFICAR Y CONFIRMAR DISEÑO</button>';
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
  function renderConsole() {
    const el = $('#console'), id = mode === 'config' && !paused ? open : null;
    el.style.display = id ? '' : 'none';
    if (!id) { conKey = ''; return; }
    const key = id + JSON.stringify(M.ship()) + A.settings.launcher;
    if (key === conKey) return;
    conKey = key;
    el.innerHTML = consoleConfig(id);
    el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { M.ship()[b.dataset.k] = +b.dataset.v; changed(); });
    el.querySelectorAll('[data-ins]').forEach((b) => b.onclick = () => { const a = M.ship().instr, i = a.indexOf(b.dataset.ins); if (i < 0) a.push(b.dataset.ins); else a.splice(i, 1); changed(); });
    if ($('#c-confirm')) $('#c-confirm').onclick = confirmDesign;
  }
  function changed() { A.saveSettings(); cfg = M.calc(); S.dv = cfg.dv; A.beep(520, 0.06); dirty = true; if (document.activeElement) document.activeElement.blur(); }

  // ---------- Reparaciones del viaje: [acción, se puede, motivo si no, progreso 0-1] ----------
  const SERV = {
    bridge: ['REAPUNTAR ANTENA', (s) => s.comms < 99, () => 'SEÑAL NOMINAL', (s) => s.comms / 100],
    life: ['REGENERAR OXÍGENO (usa energía)', (s) => s.o2 < 99 && s.bat > 6, (s) => (s.o2 >= 99 ? 'OXÍGENO AL MÁXIMO' : 'SIN ENERGÍA PARA REGENERAR'), (s) => s.o2 / 100],
    power: ['REORIENTAR PANELES SOLARES', (s) => s.bat < 99, () => 'BATERÍAS CARGADAS', (s) => s.bat / 100],
    prop: ['SELLAR FUGA DE PROPELENTE', (s) => s.leak, () => 'CIRCUITO ESTANCO', (s) => s.seal / 2.5],
    hangar: ['REPARAR LOSETAS (1 repuesto)', (s) => s.shield < 99 && s.spares > 0, (s) => (s.shield >= 99 ? 'ESCUDO ÍNTEGRO' : 'SIN REPUESTOS'), (s) => s.rep / 1.4],
    lab: ['RECALIBRAR INSTRUMENTO (1 repuesto)', (s) => s.instr.some((i) => !i.ok) && s.spares > 0, (s) => (s.instr.some((i) => !i.ok) ? 'SIN REPUESTOS' : 'INSTRUMENTOS OPERATIVOS'), (s) => s.cal / 2.5]
  };
  /** Lecturas que flotan sobre cada puesto: [etiqueta, valor, ¿mal?]. */
  function lines(id) {
    const s = S, k = cfg;
    if (mode === 'config') {
      if (id === 'seat') { const all = k.massOk && k.costOk && k.dvOk && k.powerOk && k.capOk && k.days >= DAYS + 30; return [['Masa', k.mass + ' / ' + k.cap + ' t', !k.massOk], ['Presupuesto', k.budgetPct + ' %', !k.costOk], ['Diseño', all ? 'LISTO' : 'REVISAR', !all]]; }
      if (id === 'bridge') return [['Nave principal', k.pick.hull.n.toUpperCase()], ['Repuestos', String(k.spares)]];
      if (id === 'life') return [['Reserva de oxígeno', k.days + ' días', k.days < DAYS + 30]];
      if (id === 'power') return [['Potencia', k.kw + ' kW'], ['Demanda', k.demand + ' kW', !k.powerOk]];
      if (id === 'prop') return [['Tanques', k.pick.prop.n.toUpperCase()], ['Delta-v', k.dv + ' km/s', !k.dvOk]];
      if (id === 'hangar') return [['Lander', k.pick.lander.n.toUpperCase()], ['Escudo térmico', k.pick.shield.n.toUpperCase()]];
      return [['Instrumentos', k.instr.length + ' / ' + k.landerCap, !k.capOk]];
    }
    if (id === 'seat') return mode === 'arrived' ? [['Órbita de Marte', 'ALCANZADA'], ['Descenso', 'LISTO']] : [['Trayectoria', s.dev ? 'DESVIADA' : 'NOMINAL', !!s.dev], ['Llegada a Marte en', Math.max(0, Math.round(DAYS - day(s))) + ' días']];
    if (id === 'bridge') return [['Señal de comunicación', s.comms.toFixed(0) + ' %', s.comms < 35]];
    if (id === 'life') return [['Oxígeno', s.o2.toFixed(0) + ' %', s.o2 < 25], ['Reserva instalada', k.days + ' días']];
    if (id === 'power') return [['Baterías', s.bat.toFixed(0) + ' %', s.bat < 20], ['Potencia disponible', kw(s) + ' kW', s.bat < 20], ['Demanda', k.demand + ' kW']];
    if (id === 'prop') return [['Delta-v disponible', s.dv.toFixed(2) + ' km/s', s.dv < 0.5], ['Circuito de propelente', s.leak ? 'FUGA' : 'ESTANCO', s.leak]];
    if (id === 'hangar') return [['Integridad del escudo', s.shield.toFixed(0) + ' %', s.shield < 60], ['Repuestos', String(s.spares), s.spares === 0]];
    return s.instr.map((i) => [i.name, i.ok ? 'OPERATIVO' : 'FALLO', !i.ok]).concat([['Repuestos', String(s.spares), s.spares === 0]]);
  }

  function confirmDesign() {
    const k = cfg = M.calc();
    const checks = [[k.massOk, 'Masa total dentro de la capacidad del lanzador (' + k.mass + ' / ' + k.cap + ' t)'], [k.costOk, 'Presupuesto disponible (' + k.cost + ' / ' + k.budget + ' M$)'],
      [k.dvOk, 'Propelente suficiente para las maniobras (' + k.dv + ' km/s; mínimo ' + M.DV_NEEDED + ')'], [true, 'Integridad del escudo térmico (100 %, escudo ' + k.pick.shield.n.toLowerCase() + ')'],
      [k.days >= DAYS + 30, 'Reservas adecuadas de oxígeno (' + k.days + ' días para ' + DAYS + ' de viaje)'], [k.powerOk, 'Potencia eléctrica suficiente para los sistemas esenciales (' + k.kw + ' / ' + k.demand + ' kW)'],
      [k.capOk, 'Instrumentos dentro de la capacidad del lander (' + k.instr.length + ' / ' + k.landerCap + ')']];
    const all = checks.every((x) => x[0]);
    const list = '<div class="who">CONSEJO DE CONFIGURACIÓN</div><ul>' + checks.map((x) => '<li style="padding-left:0">' + ok(x[0]) + x[1] + '</li>').join('') + '</ul>';
    if (!all) return dlg('CONTROL DE MISIÓN — VERIFICACIÓN DE DISEÑO', list + q('INSTRUCTOR', 'Una nave demasiado pesada puede no despegar. Una nave mal equipada puede no aterrizar. Y una nave sin instrumentos adecuados puede llegar a Marte sin cumplir su objetivo científico. Diseña con inteligencia, cadete.') +
      '<div class="alert">El diseño no cumple todos los requisitos. Levántate y ajusta los componentes marcados en su sala.</div>', [{ l: 'Seguir configurando', fn: () => {} }]);
    dlg('CONTROL DE MISIÓN — CONFIRMACIÓN DE CONFIGURACIÓN', list + '<div class="ok"><b>Configuración de la nave registrada.</b></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 30px">' +
      [['Masa total', k.mass + ' t'], ['Presupuesto utilizado', k.budgetPct + ' %'], ['Capacidad de propelente', k.dv + ' km/s'], ['Integridad térmica', '100 %'], ['Soporte vital', '100 %'], ['Potencia eléctrica', k.kw + ' kW']]
        .map((x) => '<div class="kv"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>' +
      '<p class="motto mt-2">La misión está lista para iniciar la transferencia interplanetaria.</p>',
      [{ l: 'Seguir configurando', fn: () => {} }, { l: '[ INICIAR VIAJE A MARTE ]', fn: startVoyage }]);
  }

  // ---------- Movimiento libre del cadete ----------
  function sit() { P.seated = true; P.x = SEAT_X; P.vx = 0; P.face = -1; P.auto = null; if (mode === 'config') open = 'seat'; }
  function stand() { P.seated = false; P.x = X_MIN + 4; P.vx = 0; P.face = 1; if (open === 'seat') open = null; }
  /** Va andando hasta un puesto (panel de alertas, minimapa). Cualquier tecla de movimiento lo cancela. */
  function goTo(id) {
    if (paused) return;
    const st = station(id); if (!st) return;
    if (P.seated) { if (id === 'seat') return; stand(); }
    if (open && open !== id) open = null;
    P.auto = clamp(st.id === 'seat' ? X_MIN + 8 : st.x - 52, X_MIN, X_MAX); dirty = true;
  }
  function movePlayer(dt) {
    let dir = 0;
    if (!P.seated) {
      if (keys.l !== keys.r) { dir = keys.r ? 1 : -1; P.auto = null; }
      else if (P.auto != null) {
        const d = P.auto - P.x;
        if (Math.abs(d) < 8) { P.x = P.auto; P.vx = 0; P.auto = null; const st = current(); P.face = st && st.x < P.x ? -1 : 1; }
        else dir = Math.sign(d) * clamp(Math.abs(d) / 70, 0.25, 1);
      }
    }
    P.vx += (dir * SPEED - P.vx) * (1 - Math.exp(-dt * 12));
    if (!dir && Math.abs(P.vx) < 3) P.vx = 0;
    const nx = clamp(P.x + P.vx * dt, P.seated ? SEAT_X : X_MIN, X_MAX);
    if (nx !== P.x + P.vx * dt) P.vx = 0;
    P.x = nx;
    if (dir) P.face = dir > 0 ? 1 : -1;
    P.ph += Math.abs(P.vx) * dt * 0.02;
    const cur = current();
    if (open && open !== 'seat' && (!cur || cur.id !== open)) { open = null; dirty = true; }   // alejarse cierra la consola
    ROOMS.forEach((r, i) => {                                // las puertas se abren al acercarse
      if (!i) return;
      const near = Math.abs(P.x - r.x0) < 250, o = doors[i];
      doors[i] = clamp(o + (near ? 1 : -1) * dt * 4.5, 0, 1);
      if (near && o === 0) A.beep(260, 0.05);
    });
  }
  function camTarget() {
    const panel = mode === 'config' && open ? 330 : 0;       // deja sitio a la consola abierta
    return clamp(P.x - W / 2 + P.face * 70 * Math.min(1, Math.abs(P.vx) / SPEED) + panel, -300, SHIP_W - 1300 + panel);
  }

  // ---------- Interacción por proximidad ----------
  /** Puesto al alcance del cadete (el asiento, si está sentado). */
  function current() {
    if (P.seated) return ST[0];
    let best = null, bd = REACH;
    ST.forEach((s) => { const d = Math.abs(P.x - s.x); if (d < bd) { bd = d; best = s; } });
    return best;
  }
  /** Acción disponible ahora: { l: texto, fn | hold, can, prog, hot }. */
  function action() {
    const st = current(); if (!st) return null;
    const seatAct = () => (P.seated ? { l: 'LEVANTARSE DEL ASIENTO', fn: stand, can: true } : { l: 'SENTARSE A LOS MANDOS', fn: sit, can: true });
    if (mode === 'arrived') return st.id === 'seat' ? { l: P.seated ? 'INICIAR EL DESCENSO A MARTE' : 'SENTARSE Y PILOTAR EL DESCENSO', fn: goEDL, can: true } : null;
    if (mode === 'voyage') {
      const i = S.ev.findIndex((e) => e.on && !e.done && e.st === st.id);
      if (i >= 0) { const e = S.ev[i]; return S.t > e.cool ? { l: 'ATENDER EVENTO CRÍTICO 0' + (i + 1), fn: () => openEvent(e, i), can: true, hot: true } : { l: 'SISTEMAS REINICIANDO…', can: false }; }
      if (st.id === 'seat') return seatAct();
      const sv = SERV[st.id], can = sv[1](S) && P.full !== st.id;
      return { l: can ? sv[0] : sv[2](S), hold: true, can, prog: clamp(sv[3](S), 0, 1) };
    }
    if (st.id === 'seat') return seatAct();
    return open === st.id ? { l: 'CERRAR CONSOLA', fn: () => { open = null; }, can: true } : { l: 'ABRIR CONSOLA · ' + (st.cfgLabel || st.label), fn: () => { open = st.id; P.auto = null; }, can: true };
  }
  function press() {
    if (paused || (mode !== 'config' && mode !== 'voyage' && mode !== 'arrived')) return;
    const a = action();
    if (!a) return;
    if (a.hold) { serv = true; return; }
    if (a.can && a.fn) { A.beep(520, 0.07); a.fn(); dirty = true; } else A.beep(160, 0.08);
  }
  function renderAct() {
    const el = $('#sh-act'), a = paused ? null : action();
    if (!a) { if (actKey !== '-') { el.style.display = 'none'; actKey = '-'; } return; }
    const held = serv && a.hold && a.can, pr = a.hold && a.can ? Math.round(a.prog * 50) : -1;
    const key = a.l + a.can + held + pr + (a.hot ? 1 : 0);
    if (key === actKey) return;
    actKey = key;
    el.style.display = 'flex';
    el.className = 'actp absolute' + (a.can ? '' : ' off') + (held ? ' is-held' : '') + (a.hot ? ' hot' : '');
    el.innerHTML = '<kbd>E</kbd><span>' + (a.hold && a.can ? 'MANTÉN · ' : '') + a.l + '</span>' + (pr >= 0 ? '<i style="width:' + pr * 2 + '%"></i>' : '');
  }
  (function () {
    const b = $('#sh-act');
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => { serv = false; }));
    [['#nav-l', 'l'], ['#nav-r', 'r']].forEach((n) => {       // botones para ratón y pantalla táctil
      const el = $(n[0]);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!paused) keys[n[1]] = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, () => { keys[n[1]] = false; }));
    });
  })();

  // ---------- Alertas ----------
  /** Lista de [puesto, texto]. */
  function alerts() {
    if (mode === 'arrived') return [['seat', 'Llegada a Marte: vuelve al puesto del piloto']];
    if (mode !== 'voyage') return [];
    const s = S, a = [];
    s.ev.forEach((e, i) => { if (e.on && !e.done) a.push([e.st, 'EVENTO CRÍTICO 0' + (i + 1) + ' · ' + e.short]); });
    if (s.o2 < 25) a.push(['life', 'Oxígeno crítico: ' + s.o2.toFixed(0) + ' %']);
    if (s.bat < 20) a.push(['power', 'Potencia eléctrica crítica: ' + s.bat.toFixed(0) + ' %']);
    if (s.leak) a.push(['prop', 'Fuga de propelente: perdiendo delta-v']);
    if (s.shield < 60) a.push(['hangar', 'Escudo térmico dañado: ' + s.shield.toFixed(0) + ' %']);
    if (s.comms < 35 && !s.ev[0].on) a.push(['bridge', 'Señal de comunicación débil: ' + s.comms.toFixed(0) + ' %']);
    if (s.instr.some((i) => !i.ok)) a.push(['lab', 'Instrumento científico en fallo']);
    return a;
  }
  /** Averías y eventos activos (lo que enciende las luces de alarma). */
  const faults = () => (mode === 'voyage' ? alerts() : []);
  function renderHud() {
    const al = alerts(), cur = current(), room = roomAt(P.x), hot = new Set(al.map((x) => ri(station(x[0]).room)));
    const rel = (id) => (cur && cur.id === id ? 'AQUÍ' : station(id).x < P.x ? '← IR' : 'IR →');
    const key = JSON.stringify(al.map((x) => x[1].replace(/\d+ %/, '') + rel(x[0]))) + room + mode;
    if (key !== alertKey) {
      alertKey = key;
      $('#alerts').innerHTML = al.length ? '<div class="alrt-h">⚠ PANEL DE ALERTAS</div>' + al.map((x) => '<button class="alrt" data-s="' + x[0] + '"><span>' + x[1] + '</span><b>' + rel(x[0]) + '</b></button>').join('') : '';
      $('#alerts').querySelectorAll('button').forEach((b) => b.onclick = () => { goTo(b.dataset.s); b.blur(); });
      $('#sh-map').innerHTML = ROOMS.map((r, i) => '<button class="mapb' + (i === room ? ' on' : '') + (hot.has(i) ? ' alarm' : '') + '" style="flex:' + r.w + ' 1 0" data-s="' + (i ? r.id : 'seat') + '">' + r.short + '</button>').join('') + '<i id="map-me"></i>';
      $('#sh-map').querySelectorAll('button').forEach((b) => b.onclick = () => { goTo(b.dataset.s); b.blur(); });
      const l = ROOMS[room - 1], r = ROOMS[room + 1];
      $('#nav-l').innerHTML = '<small>◀ A</small>' + (l ? l.name : 'Proa'); $('#nav-r').innerHTML = '<small>D ▶</small>' + (r ? r.name : 'Popa');
      $('#nav-l').classList.toggle('alarm', [...hot].some((i) => i < room)); $('#nav-r').classList.toggle('alarm', [...hot].some((i) => i > room));
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
      $('#sh-phase').textContent = mode === 'arrived' ? 'FASE 2 · VIAJE INTERPLANETARIO · LLEGADA A MARTE' : 'FASE 2 · VIAJE INTERPLANETARIO · DÍA ' + String(Math.min(DAYS, Math.floor(day(s)))).padStart(3, '0') + ' / ' + DAYS;
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
    const s = S, lv = M.ship(), cur = current(), id = cur ? cur.id : '';
    s.t += dt;
    s.o2 -= [0.85, 0.68, 0.55][lv.life] * dt;
    s.bat -= Math.max(0.1, 0.42 + 0.07 * s.instr.length - [0, 0.14, 0.26][lv.power]) * dt;
    s.comms -= 0.22 * dt;
    if (!s.leak && s.leakAt && s.t > s.leakAt) { s.leak = true; s.leakAt = 0; s.seal = 0; A.beep(180, 0.4); }
    if (s.leak) s.dv -= 0.013 * dt;
    if (s.hits.length && s.t > s.hits[0]) { s.hits.shift(); s.shield -= 13 + Math.random() * 6; s.flash = 1; A.beep(120, 0.3); }
    if (s.glitchAt && s.t > s.glitchAt) { s.glitchAt = 0; const i = s.instr.find((x) => x.ok); if (i) { i.ok = false; A.beep(200, 0.2); } }
    s.ev.forEach((e) => { if (!e.on && s.t > e.at) { e.on = true; e.start(s); A.beep(700, 0.5); } });
    if (s.o2 < 25 || s.bat < 20) s.crit += dt;

    // reparar: junto al panel, parado y manteniendo la tecla de acción
    const busy = s.ev.some((e) => e.on && !e.done && e.st === id);
    if (!serv) P.full = '';
    else if (SERV[id] && !busy && !SERV[id][1](s)) P.full = id;      // ya no hay nada que reponer: soltar para volver a empezar
    P.work = serv && !!SERV[id] && !busy && P.full !== id && Math.abs(P.vx) < 40;
    if (P.work) {
      P.face = cur.x >= P.x ? 1 : -1;
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

    if (s.t >= T_TOTAL && s.ev.every((x) => x.done)) {
      mode = 'arrived'; P.work = false; serv = false;
      const voy = { o2: s.o2, bat: s.bat, dv: s.dv, shield: s.shield, comms: s.comms, right: s.right, wrong: s.wrong, crit: s.crit,
        instrOk: s.instr.filter((i) => i.ok).length, instrN: s.instr.length };
      A.run.voy = voy; A.store.set('aeon01.save', { phase: 'edl', run: A.run });
      dlg('CONTROL DE MISIÓN — FINAL DEL VIAJE INTERPLANETARIO',
        '<p>Cadete, los datos de navegación confirman que la nave ha llegado a las proximidades de Marte.</p><p>Las comunicaciones se mantienen dentro de los parámetros operativos.</p>' +
        '<p>La tripulación está preparada y los sistemas de descenso han iniciado su secuencia de comprobación.</p><p>Hemos recorrido millones de kilómetros.</p><p>Ahora comienza la fase más delicada de la expedición.</p>' +
        '<p class="motto">PREPARA LA MANIOBRA DE ENTRADA, DESCENSO Y ATERRIZAJE.</p>' +
        (P.seated ? '' : '<p>Vuelve al <b>puesto del piloto</b> y siéntate a los mandos para iniciar el descenso.</p>'),
        P.seated ? [{ l: 'Iniciar el descenso', fn: goEDL }] : [{ l: 'Ir al puesto del piloto', fn: () => goTo('seat') }]);
    }
  }

  // ---------- Equipo de cada sala (se dibuja sobre la pared del fondo) ----------
  const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
  const dust = []; for (let i = 0; i < 40; i++) dust.push([Math.random() * W, Math.random() * H, Math.random() * 6.28]);
  const wstars = []; for (let i = 0; i < 90; i++) wstars.push([Math.random(), Math.random(), Math.random() * 1.6 + 0.4]);

  // ---------- Detalle estructural del casco (issue #2), llevado al mapa lateral ----------
  // Tuberías metálicas con bridas, bandeja y mazo de cables, paneles técnicos junto a las puertas,
  // zócalo de paneles y guía de luz en el suelo, sobre la pared del fondo de cada sala y por
  // debajo de su equipo. El metal es gris azulado neutro; el color de la sala solo aparece en un
  // cable, los testigos y la guía. Es estático: se pinta una vez por sala en un lienzo aparte.
  const METAL = ['#27303d', '#56637a', '#a9b6c8', '#6b788c', '#1c232e'];                                 // sombra → brillo → sombra
  const LAYERS = {};
  function detailLayer(r, col) {
    if (LAYERS[r.id]) return LAYERS[r.id];
    const w = r.w, h = FLOOR - CEIL, cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
    const g = cvs.getContext('2d');
    const CABLES = ['#2b3442', col(1, 0.95), '#c9a23a', '#8d99ab'];
    const hpipe = (y0, y1) => { const lg = g.createLinearGradient(0, y0, 0, y1); METAL.forEach((m, i) => lg.addColorStop(i / 4, m)); g.fillStyle = lg; g.fillRect(0, y0, w, y1 - y0); };
    // tubería gruesa con bridas y tubería fina con abrazaderas, de mamparo a mamparo
    hpipe(17, 31); hpipe(35, 42);
    for (let x = 70; x < w; x += 140) { g.fillStyle = '#141a23'; g.fillRect(x - 9, 13, 18, 22); g.fillStyle = '#7d8a9d'; g.fillRect(x - 4, 13, 8, 22); }
    for (let x = 35; x < w; x += 105) { g.fillStyle = '#141a23'; g.fillRect(x - 4, 33, 8, 11); }
    // bandeja portacables con su mazo ordenado y bridas
    g.fillStyle = '#0b1018'; g.fillRect(0, 46, w, 17);
    CABLES.forEach((cb, i) => { g.fillStyle = cb; g.fillRect(0, 48.5 + i * 3.5, w, 2.4); });
    g.fillStyle = '#6f7c8f'; g.fillRect(0, 45, w, 1.5); g.fillStyle = '#3c4656'; g.fillRect(0, 63, w, 1.5);
    for (let x = 50; x < w; x += 96) { g.fillStyle = '#05080d'; g.fillRect(x - 2.5, 45, 5, 19); g.fillStyle = '#93a0b3'; g.fillRect(x - 0.75, 45, 1.5, 19); }
    // paneles técnicos a los lados de las puertas: rejilla, testigo de estado y registro de mantenimiento
    (r.id === 'bridge' ? [w - 100] : [34, w - 100]).forEach((x) => {
      g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, 282, 66, 128);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(x, 282, 66, 128);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x, 283, 66, 1);
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 9, 295 + i * 7, 32, 3); }
      g.fillStyle = col(1, 0.75); g.fillRect(x + 46, 295, 12, 9);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 9, 346, 48, 50);
      [[13, 350], [50, 350], [13, 389], [50, 389]].forEach((p) => { g.fillStyle = '#8693a6'; g.fillRect(x + p[0], p[1], 3, 3); });
    });
    // zócalo de paneles técnicos
    for (let x = 22; x + 108 < w; x += 140) {
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, 437, 108, 32);
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.strokeRect(x + 0.5, 437.5, 108, 32);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 10, 443 + i * 6, 52, 2.5); }
      g.fillStyle = col(1, 0.8); g.fillRect(x + 74, 444, 22, 5); g.fillStyle = '#8693a6'; g.fillRect(x + 74, 456, 9, 5); g.fillRect(x + 87, 456, 9, 5);
    }
    // guía de luz junto al suelo
    g.fillStyle = col(1, 0.22); g.fillRect(0, h - 13, w, 8); g.fillStyle = col(1.2, 0.8); g.fillRect(0, h - 8, w, 2);
    // iluminación ambiental técnica: baño frío y limpio desde el techo
    const amb = g.createLinearGradient(0, 0, 0, h); amb.addColorStop(0, 'rgba(190,220,255,.08)'); amb.addColorStop(0.5, 'rgba(190,220,255,.02)'); amb.addColorStop(1, 'rgba(0,0,0,.10)');
    g.fillStyle = amb; g.fillRect(0, 0, w, h);
    return (LAYERS[r.id] = cvs);
  }

  function centerpiece(id, col, t) {
    const s = S, lv = M.ship();
    if (id === 'bridge') {                                   // ventanal + pantalla de navegación
      c.save(); c.beginPath(); c.roundRect(470, 225, 660, 250, 24); c.fillStyle = '#01030a'; c.fill(); c.clip();
      wstars.forEach((p) => { c.fillStyle = 'rgba(220,235,255,' + (0.4 + 0.5 * Math.abs(Math.sin(t * p[2] + p[0] * 9))) + ')'; c.fillRect(470 + ((p[0] * 660 + t * (mode === 'config' ? 2 : 14) * p[2]) % 660), 225 + p[1] * 250, p[2], p[2]); });
      if (mode === 'config') { const g = c.createLinearGradient(0, 400, 0, 480); g.addColorStop(0, '#7cc4ff'); g.addColorStop(0.3, '#1a62c0'); g.addColorStop(1, '#062258'); c.fillStyle = g; c.beginPath(); c.arc(800, 1330, 920, 0, 7); c.fill(); }
      else { const p = clamp(s.t / T_TOTAL, 0, 1), rr = 6 + p * p * 70, g = c.createRadialGradient(990 - rr * 0.3, 330 - rr * 0.3, 1, 990, 330, rr); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#8a3216'); c.fillStyle = g; c.beginPath(); c.arc(990, 330, rr, 0, 7); c.fill(); }
      c.restore(); c.strokeStyle = col(1.1); c.lineWidth = 5; c.beginPath(); c.roundRect(470, 225, 660, 250, 24); c.stroke();
      c.fillStyle = '#04101f'; c.fillRect(560, 500, 480, 120); c.strokeRect(560, 500, 480, 120);
      c.strokeStyle = 'rgba(127,220,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(590, 595); c.quadraticCurveTo(800, 480, 1010, 540); c.stroke();
      const p = mode === 'config' ? 0 : clamp(s.t / T_TOTAL, 0, 1), bx = 590 + 420 * p, by = (1 - p) * (1 - p) * 595 + 2 * (1 - p) * p * 480 + p * p * 540 + (s.dev ? Math.sin(t * 5) * 6 - 14 : 0);
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
      c.save(); c.translate(960, 340); c.fillStyle = '#0c1620'; c.beginPath(); c.arc(0, 0, 95, 0, 7); c.fill(); c.rotate(t * (P.work ? 9 : 2.5));
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
        const x = 450 + i * 180, on = sel.includes(ins.id), st = mode !== 'config' ? s.instr.find((z) => z.id === ins.id) : null, fault = st && !st.ok;
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

  // ---------- Dibujo del mapa lateral ----------
  const mk = (h) => (k, a) => 'rgba(' + (h[0] * k | 0) + ',' + (h[1] * k | 0) + ',' + (h[2] * k | 0) + ',' + (a == null ? 1 : a) + ')';
  const seg = (x1, y1, x2, y2, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const rr = (x, y, w, h, r, fill) => { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };

  /** Casco exterior: planchas de techo y suelo, popa con motores, antena y panel solar. */
  function hull(t, x1, x2) {
    c.fillStyle = '#1d2533'; c.fillRect(x1, TOP, x2 - x1, CEIL - TOP);
    c.fillStyle = '#0d1219'; c.fillRect(x1, FLOOR, x2 - x1, BOT - FLOOR);
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2;
    for (let x = Math.ceil(x1 / 150) * 150; x < x2; x += 150) { c.beginPath(); c.moveTo(x, TOP); c.lineTo(x, CEIL); c.moveTo(x + 60, FLOOR + 26); c.lineTo(x + 60, BOT); c.stroke(); }
    c.fillStyle = '#0b1018'; c.fillRect(x1, TOP + 8, x2 - x1, 15);                           // bandeja de cables del techo
    ['#2b3442', '#8d99ab', '#c9a23a', '#b9c4d2'].forEach((cb, i) => { c.fillStyle = cb; c.fillRect(x1, TOP + 10 + i * 3.2, x2 - x1, 2.2); });
    for (let x = Math.ceil(x1 / 96) * 96; x < x2; x += 96) { c.fillStyle = '#05080d'; c.fillRect(x - 2, TOP + 7, 4, 17); }
    const pg = c.createLinearGradient(0, TOP + 29, 0, TOP + 42); METAL.forEach((m, i) => pg.addColorStop(i / 4, m));
    c.fillStyle = pg; c.fillRect(x1, TOP + 29, x2 - x1, 13);                                // conducto metálico con bridas
    for (let x = Math.ceil(x1 / 170) * 170 + 40; x < x2; x += 170) { c.fillStyle = '#141a23'; c.fillRect(x - 8, TOP + 26, 16, 19); c.fillStyle = '#7d8a9d'; c.fillRect(x - 3.5, TOP + 26, 7, 19); }
    c.fillStyle = '#05080d'; for (let x = Math.ceil(x1 / 34) * 34; x < x2; x += 34) c.fillRect(x, FLOOR + 9, 20, 5);       // rejilla del suelo
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x1, FLOOR, x2 - x1, 2);
    seg(x1, TOP, x2, TOP, 3, '#4c5a72'); seg(x1, BOT, x2, BOT, 3, '#3b475c');
    for (let x = Math.ceil(x1 / 420) * 420; x < x2; x += 420) { c.fillStyle = Math.sin(t * 3 + x) > 0.3 ? '#ff5a3c' : '#4a1a12'; c.fillRect(x, BOT - 3, 10, 6); }

    if (x2 > SHIP_W - 60) {                                  // popa: mamparo, bloque de motores y toberas
      const X = SHIP_W, fire = mode === 'voyage';
      c.fillStyle = '#1c2330'; c.fillRect(X, TOP, 34, BOT - TOP); c.fillRect(X + 34, TOP + 46, 60, BOT - TOP - 92);
      [300, 458, 616].forEach((y, i) => {
        const g = c.createLinearGradient(X + 94, 0, X + 230, 0); g.addColorStop(0, '#5a6678'); g.addColorStop(1, '#161b24');
        poly([[X + 94, y - 36], [X + 230, y - 60], [X + 230, y + 60], [X + 94, y + 36]], g);
        if (fire) {
          const L = 230 + 60 * Math.sin(t * 31 + i * 2) + 30 * Math.sin(t * 7 + i), f = c.createLinearGradient(X + 225, 0, X + 225 + L, 0);
          f.addColorStop(0, 'rgba(235,250,255,.95)'); f.addColorStop(0.25, 'rgba(70,190,255,.7)'); f.addColorStop(1, 'rgba(30,90,255,0)');
          c.fillStyle = f; c.beginPath(); c.moveTo(X + 228, y - 52); c.quadraticCurveTo(X + 228 + L * 0.7, y - 30, X + 228 + L, y); c.quadraticCurveTo(X + 228 + L * 0.7, y + 30, X + 228, y + 52); c.fill();
        }
      });
    }
    if (x1 < 900 && x2 > 500) {                              // antena de comunicaciones (se mueve al reapuntarla)
      const a = -0.5 + (P.work && current() && current().id === 'bridge' ? Math.sin(t * 5) * 0.35 : Math.sin(t * 0.4) * 0.05);
      seg(700, TOP, 700, TOP - 52, 6, '#55627a');
      c.save(); c.translate(700, TOP - 56); c.rotate(a); c.fillStyle = '#c9d4e2'; c.beginPath(); c.ellipse(0, 0, 44, 12, 0, 0, 7); c.fill(); seg(0, 0, 0, -26, 3, '#c9d4e2'); c.restore();
    }
    const px = at('power', 0.5);
    if (x1 < px + 300 && x2 > px - 300) {                    // panel solar (gira al reorientarlo)
      const a = P.work && current() && current().id === 'power' ? Math.sin(t * 4) * 0.25 : -0.12;
      seg(px, TOP, px, TOP - 46, 6, '#55627a');
      c.save(); c.translate(px, TOP - 50); c.rotate(a); c.fillStyle = '#143a78'; c.fillRect(-190, -9, 380, 18); c.strokeStyle = '#6fb6ff'; c.lineWidth = 1.5; c.strokeRect(-190, -9, 380, 18);
      for (let i = -150; i < 190; i += 38) { c.beginPath(); c.moveTo(i, -9); c.lineTo(i, 9); c.stroke(); } c.restore();
    }
  }

  /** Proa: morro con parabrisas y tablero de mandos del piloto. */
  function bow(t) {
    poly([[0, TOP], [-150, TOP + 70], [-270, 400], [-300, 470], [-270, 560], [-120, BOT - 20], [0, BOT]], '#222b3a');
    poly([[0, CEIL], [-118, 292], [-212, 432], [-212, FLOOR], [0, FLOOR]], '#1a2333');
    const g = c.createLinearGradient(-270, 400, -118, 292); g.addColorStop(0, 'rgba(40,110,200,.75)'); g.addColorStop(1, 'rgba(150,225,255,.55)');
    poly([[-150, TOP + 70], [-270, 400], [-212, 432], [-118, 292]], '#02040a'); poly([[-150, TOP + 70], [-270, 400], [-212, 432], [-118, 292]], g);
    seg(-150, TOP + 70, -270, 400, 3, '#9fe0ff');
    poly([[-212, 566], [-120, 548], [58, 548], [100, 602], [100, FLOOR], [-212, FLOOR]], '#101722');       // tablero de mandos
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(70,170,255,' + (0.55 + 0.3 * Math.sin(t * 2 + i * 1.7)) + ')'; c.fillRect(-100 + i * 40, 554, 30, 12); }
    c.fillStyle = '#3cff9e'; c.fillRect(64, 566, 8, 5); c.fillStyle = '#ffd23c'; c.fillRect(74, 580, 8, 5);
    seg(80, 580, 108, 572, 6, '#55627a'); rr(100, 564, 20, 14, 5, '#8fa0b8');                               // palanca de mando
    c.fillStyle = '#2a3445'; c.fillRect(104, FLOOR - 14, 52, 6);                                          // reposapiés
  }

  /** Pared de fondo, luces y equipo de una sala. */
  function roomBack(r, i, t, hot) {
    const col = mk(r.hue), x = r.x0, w = r.w, [R, G, B] = r.hue;
    const g = c.createLinearGradient(0, CEIL, 0, FLOOR);
    g.addColorStop(0, 'rgb(' + (36 + R * 0.05 | 0) + ',' + (47 + G * 0.05 | 0) + ',' + (64 + B * 0.05 | 0) + ')'); g.addColorStop(1, 'rgb(' + (22 + R * 0.03 | 0) + ',' + (29 + G * 0.03 | 0) + ',' + (41 + B * 0.03 | 0) + ')');
    c.fillStyle = g; c.fillRect(x, CEIL, w, FLOOR - CEIL);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, 612, w, FLOOR - 612);
    c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 2;
    for (let px = x + 125; px < x + w - 20; px += 125) { c.beginPath(); c.moveTo(px, CEIL); c.lineTo(px, FLOOR); c.stroke(); }
    c.beginPath(); c.moveTo(x, 612); c.lineTo(x + w, 612); c.stroke();
    c.drawImage(detailLayer(r, col), x, CEIL);                // tuberías, cables y paneles (issue #2)
    const pulse = hot ? 0.55 + 0.45 * Math.sin(t * 9) : 0.8 + 0.2 * Math.sin(t * 2 + i), lc = hot ? (k, a) => 'rgba(255,' + (70 * k | 0) + ',' + (50 * k | 0) + ',' + a + ')' : col;
    [0.27, 0.73].forEach((f) => {                             // luces de techo con su cono
      const lx = x + w * f, cg = c.createLinearGradient(0, CEIL, 0, FLOOR); cg.addColorStop(0, lc(1, 0.2 * pulse)); cg.addColorStop(1, lc(1, 0));
      poly([[lx - 70, CEIL + 14], [lx + 70, CEIL + 14], [lx + 250, FLOOR], [lx - 250, FLOOR]], cg);
      c.fillStyle = lc(1.15, 0.95 * pulse); c.fillRect(lx - 70, CEIL + 5, 140, 10);
    });
    c.fillStyle = col(1, 0.9); c.fillRect(x, CEIL, w, 5); c.fillRect(x, FLOOR - 5, w, 5);
    c.font = '700 21px Orbitron, sans-serif'; c.fillStyle = col(1.25, 0.6); c.textAlign = 'left';
    c.fillText('0' + (i + 1) + ' · ' + r.name.toUpperCase(), x + 46, CEIL + 86);
    c.font = '600 13px Orbitron, sans-serif'; c.fillStyle = 'rgba(190,225,255,.45)';
    if (i) c.fillText('◀ ' + ROOMS[i - 1].name.toUpperCase(), x + 46, CEIL + 106);
    if (ROOMS[i + 1]) { c.textAlign = 'right'; c.fillText(ROOMS[i + 1].name.toUpperCase() + ' ▶', x + w - 46, CEIL + 86); c.textAlign = 'left'; }
    const cx = r.id === 'bridge' ? x + w * 0.5 : x + w * 0.4, sc = 0.8;                                    // equipo en la pared del fondo
    c.save(); c.translate(cx - 800 * sc, 462 - 430 * sc); c.scale(sc, sc); centerpiece(r.id, col, t); c.restore();
    const bx = x + w * 0.5;                                   // baliza de alarma
    rr(bx - 16, CEIL + 5, 32, 10, 3, '#0c1118');
    if (hot) {
      const a = t * 7;
      c.save(); c.beginPath(); c.rect(x, CEIL, w, FLOOR - CEIL); c.clip(); c.translate(bx, CEIL + 22); c.rotate(a); c.fillStyle = 'rgba(255,60,40,.22)';
      [0, Math.PI].forEach((o) => { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 260, o - 0.28, o + 0.28); c.closePath(); c.fill(); });
      c.restore();
    }
    c.fillStyle = hot ? (Math.sin(t * 9) > 0 ? '#ff3c2c' : '#7a1810') : '#1f6f4c'; c.beginPath(); c.arc(bx, CEIL + 22, 11, 0, 7); c.fill();
    if (hot) { c.fillStyle = 'rgba(255,40,30,' + (0.08 + 0.07 * Math.sin(t * 6)) + ')'; c.fillRect(x, CEIL, w, FLOOR - CEIL); }
  }

  /** Consola de un puesto con su lectura flotante. */
  function drawStation(st, t, near, hot) {
    const x = st.x, col = mk(ROOMS[ri(st.room)].hue), L = lines(st.id), label = (mode === 'config' && st.cfgLabel) || st.label;
    if (st.id !== 'seat') {
      poly([[x - 32, FLOOR], [x - 22, FLOOR - 94], [x + 22, FLOOR - 94], [x + 32, FLOOR]], '#121a26');
      poly([[x - 54, FLOOR - 94], [x - 44, FLOOR - 142], [x + 44, FLOOR - 142], [x + 54, FLOOR - 94]], near ? '#2a3a55' : '#1b2535');
      c.fillStyle = hot ? (Math.sin(t * 9) > 0 ? '#ff4a36' : '#5a1810') : col(1.1, 0.9); c.fillRect(x - 36, FLOOR - 135, 72, 26);
      c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) c.fillRect(x - 32 + i * 18, FLOOR - 130 + (i % 2) * 8, 12, 4);
      for (let i = 0; i < 3; i++) { c.fillStyle = Math.sin(t * 3 + i * 2 + x) > 0 ? '#3cff9e' : '#1b5c3e'; c.fillRect(x - 20 + i * 16, FLOOR - 104, 8, 5); }
      if (near) { c.strokeStyle = 'rgba(127,220,255,' + (0.6 + 0.4 * Math.sin(t * 5)) + ')'; c.lineWidth = 3; c.strokeRect(x - 56, FLOOR - 146, 112, 148); }
    }
    const w = 268, h = 32 + L.length * 22, px = x - w / 2, py = 478 - h, bad = hot || L.some((l) => l[2]);
    c.globalAlpha = near ? 1 : 0.8;
    c.fillStyle = bad ? 'rgba(72,12,8,.78)' : 'rgba(6,26,56,.78)'; c.fillRect(px, py, w, h);
    c.strokeStyle = bad ? '#ff5a3c' : 'rgba(110,210,255,.85)'; c.lineWidth = 1.5; c.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
    c.textAlign = 'left'; c.font = '700 12px Orbitron, sans-serif'; c.fillStyle = bad ? '#ffb4a3' : '#7fdcff'; c.fillText(label, px + 10, py + 19);
    L.forEach((l, i) => {
      const y = py + 41 + i * 22;
      c.textAlign = 'left'; c.font = '500 16px Rajdhani, sans-serif'; c.fillStyle = '#d6ecff'; c.fillText(l[0], px + 10, y);
      c.textAlign = 'right'; c.font = '700 13px Orbitron, sans-serif'; c.fillStyle = l[2] ? '#ff8f7a' : '#9dffcf'; c.fillText(l[1], px + w - 10, y);
    });
    c.textAlign = 'left'; c.globalAlpha = 1;
    if (st.id !== 'seat') seg(x, py + h, x, FLOOR - 142, 1.5, bad ? 'rgba(255,90,60,.6)' : 'rgba(110,210,255,.5)');
    if (near && !paused) {                                    // tecla de acción junto al panel
      const kx = x, ky = py - 26 + Math.sin(t * 5) * 4;
      rr(kx - 17, ky - 17, 34, 34, 7, '#eaf6ff'); c.fillStyle = '#061a38'; c.font = '900 18px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('E', kx, ky + 7); c.textAlign = 'left';
    }
  }

  function drawSeat() {
    const x = SEAT_X;
    c.fillStyle = '#0e141d'; c.fillRect(x + 2, FLOOR - 40, 18, 40); c.fillRect(x - 18, FLOOR - 6, 60, 6);
    c.save(); c.translate(x + 36, FLOOR - 46); c.rotate(0.1); rr(-8, -132, 22, 136, 8, '#2b3648'); rr(-10, -162, 26, 36, 9, '#34425a'); c.fillStyle = A.settings.accent; c.fillRect(-8, -100, 22, 5); c.restore();
    rr(x - 30, FLOOR - 54, 78, 16, 7, '#2b3648');
  }

  /** El cadete: camina, espera, trabaja o va sentado a los mandos. */
  function astronaut(t) {
    const K = 0.9, mv = clamp(Math.abs(P.vx) / SPEED, 0, 1), sw = Math.sin(P.ph) * mv, acc = A.settings.accent;
    const lit = '#e8eef5', dim = '#a3b0c0', boot = '#465168';
    const bob = Math.abs(Math.cos(P.ph)) * 5 * mv + Math.sin(t * 2.2) * 1.5 * (1 - mv);
    c.save();
    if (P.seated) c.translate(SEAT_X + 2, FLOOR - 58); else c.translate(P.x, FLOOR - 84 * K - bob * K);
    c.scale(P.face * K, K); c.lineCap = 'round'; c.lineJoin = 'round';
    const leg = (a, col, fwd) => {                            // origen en la cadera
      if (P.seated) { seg(0, 2, 42, 4, 20, col); seg(42, 4, 44, 44, 18, col); seg(44, 46, 58, 46, 14, boot); return; }
      const kx = Math.sin(a) * 42 + fwd, ky = Math.cos(a) * 42, fx = Math.sin(a) * 84, fy = 84 - Math.max(0, fwd) * 0.9;
      seg(0, 0, kx, ky, 20, col); seg(kx, ky, fx, fy, 18, col); seg(fx - 2, fy - 2, fx + 15, fy - 2, 14, boot);
    };
    const arm = (a, col) => {                                 // origen en el hombro
      if (P.seated) { seg(2, -66, 30, -52, 15, col); seg(30, -52, 62, -60, 13, col); return; }
      if (P.work && col === lit) {
        seg(2, -66, 30, -52, 15, col); seg(30, -52, 56, -62 + Math.sin(t * 22) * 3, 13, col);
        c.fillStyle = 'rgba(255,230,140,' + (0.5 + Math.random() * 0.5) + ')'; c.beginPath(); c.arc(64, -62, 4 + Math.random() * 7, 0, 7); c.fill();
        return;
      }
      const ex = Math.sin(a) * 30, ey = -66 + Math.cos(a) * 30, hx = Math.sin(a + 0.25) * 58, hy = -66 + Math.cos(a + 0.25) * 58;
      seg(2, -66, ex, ey, 15, col); seg(ex, ey, hx + 4, hy, 13, col);
    };
    const idle = (1 - mv) * 0.09;
    leg(-sw * 0.55 - idle, dim, sw < 0 ? -sw * 12 : 0); arm(sw * 0.6, dim);
    c.save(); c.rotate(P.seated ? -0.06 : 0.07 * mv);
    rr(-40, -82, 22, 62, 7, '#b4c0cf');                         // mochila de soporte vital
    rr(-24, -84, 48, 88, 15, lit); c.fillStyle = '#aab7c6'; c.fillRect(-24, -8, 48, 8);
    c.fillStyle = acc; c.fillRect(-24, -44, 48, 6);
    rr(4, -68, 17, 20, 4, '#c3cedb'); c.fillStyle = '#3cff9e'; c.fillRect(8, -63, 5, 4);
    c.fillStyle = '#f4f8fb'; c.beginPath(); c.arc(2, -110, 30, 0, 7); c.fill();                               // casco
    const vg = c.createLinearGradient(-4, -128, 30, -92); vg.addColorStop(0, '#2a6aa6'); vg.addColorStop(0.5, '#0b1626'); vg.addColorStop(1, '#04080f');
    c.fillStyle = vg; c.beginPath(); c.ellipse(12, -110, 19, 19, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(200,235,255,.75)'; c.lineWidth = 2.5; c.beginPath(); c.arc(11, -111, 13, 3.6, 4.7); c.stroke();
    c.restore();
    leg(sw * 0.55 + idle, lit, sw > 0 ? sw * 12 : 0); arm(-sw * 0.6, lit);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(P.seated ? SEAT_X + 6 : P.x, FLOOR + 3, 40, 6, 0, 0, 7); c.fill();
  }

  /** Mamparo entre dos salas, con su puerta corredera. */
  function bulkhead(i, t, hot) {
    const x = ROOMS[i].x0, o = doors[i], col = mk(ROOMS[i].hue);
    c.fillStyle = '#10151d'; c.fillRect(x - 30, CEIL, 60, DOOR - CEIL);
    c.fillStyle = '#2c3749'; c.fillRect(x - 30, CEIL, 5, DOOR - CEIL); c.fillRect(x + 25, CEIL, 5, DOOR - CEIL);
    c.fillStyle = col(1, 0.9); c.fillRect(x - 30, DOOR - 6, 60, 6);
    c.fillStyle = hot ? (Math.sin(t * 9) > 0 ? '#ff3c2c' : '#5a1810') : o > 0.5 ? '#3cff9e' : '#ffd23c'; c.fillRect(x - 9, DOOR - 30, 18, 10);
    const h = (FLOOR - DOOR) * (1 - o);
    if (h > 2) {
      c.save(); c.beginPath(); c.rect(x - 17, DOOR, 34, h); c.clip();
      c.fillStyle = '#39465a'; c.fillRect(x - 17, DOOR, 34, h);
      for (let y = DOOR + h - 400; y < DOOR + h; y += 44) poly([[x - 17, y + 22], [x + 17, y], [x + 17, y + 12], [x - 17, y + 34]], 'rgba(255,210,60,.55)');
      c.restore(); c.strokeStyle = '#586a86'; c.lineWidth = 2; c.strokeRect(x - 17, DOOR, 34, h);
    }
    c.fillStyle = '#2c3749'; c.fillRect(x - 30, FLOOR - 4, 60, 8);
  }

  function draw(now) {
    const t = now / 1000, fly = mode !== 'config', p = fly ? clamp(S.t / T_TOTAL, 0, 1) : 0;
    const shake = fly && S.flash > 0 ? S.flash * 9 : 0;
    const cx = Math.round(cam.x + (Math.random() - 0.5) * shake), cy = Math.sin(t * 0.8) * 3 + (Math.random() - 0.5) * shake;
    c.fillStyle = '#02040a'; c.fillRect(0, 0, W, H);
    wstars.forEach((s) => {                                   // estrellas con paralaje
      const x = (((s[0] * 2400 - cx * 0.1 * s[2] - (mode === 'voyage' ? t * 12 * s[2] : 0)) % W) + W) % W;
      c.fillStyle = 'rgba(220,235,255,' + (0.35 + 0.5 * Math.abs(Math.sin(t * s[2] + s[0] * 9))) + ')'; c.fillRect(x, s[1] * H, s[2], s[2]);
    });
    if (!fly) {                                               // la Tierra bajo la nave en órbita
      const ex = 800 - cx * 0.04, g = c.createLinearGradient(0, 790, 0, 900); g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.25, '#1f6fd0'); g.addColorStop(1, '#06224f');
      c.fillStyle = g; c.beginPath(); c.arc(ex, 790 + 2600, 2600, 0, 7); c.fill();
    } else {                                                  // Marte, más cerca cada día
      const mr = 7 + p * p * 62, mx = 1090 - cx * 0.02, my = 74, g = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 1, mx, my, mr); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#8a3216');
      c.fillStyle = g; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill();
    }
    c.save(); c.translate(-cx, cy);
    const x1 = cx - 40, x2 = cx + W + 40, bad = faults(), hot = new Set(bad.map((a) => station(a[0]).room)), cur = paused ? null : current();
    hull(t, Math.max(0, x1), Math.min(SHIP_W, x2));
    ROOMS.forEach((r, i) => { if (r.x0 < x2 && r.x0 + r.w > x1) roomBack(r, i, t, hot.has(r.id)); });
    if (x1 < 160) { bow(t); drawSeat(); }
    const hotSt = new Set(bad.map((a) => a[0]));
    ST.forEach((s) => { if (s.x > x1 - 160 && s.x < x2 + 160) drawStation(s, t, cur === s, hotSt.has(s.id)); });
    astronaut(t);
    ROOMS.forEach((r, i) => { if (i && r.x0 > x1 - 40 && r.x0 < x2 + 40) bulkhead(i, t, hot.has(r.id) || hot.has(ROOMS[i - 1].id)); });
    dust.forEach((d) => {                                     // polvo en suspensión dentro del casco
      d[0] += Math.cos(d[2]) * 0.25; d[1] = CEIL + ((d[1] + Math.sin(d[2]) * 0.2 - CEIL + (FLOOR - CEIL)) % (FLOOR - CEIL));
      const x = cx + ((((d[0] - cx) % W) + W) % W);
      if (x > 0 && x < SHIP_W) { c.fillStyle = 'rgba(200,225,255,.22)'; c.fillRect(x, d[1], 2, 2); }
    });
    c.restore();
    if (fly) {
      if (S.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + S.flash * 0.45 + ')'; c.fillRect(0, 0, W, H); S.flash -= 0.04; }
      if (S.comms < 35) for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(180,220,255,.08)'; c.fillRect(0, Math.random() * H, W, 3); }
    }
    const v = c.createRadialGradient(800, 450, 430, 800, 450, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  function loop(now) {
    raf = 0;
    if (mode === 'off' || $('#screen-ship').classList.contains('hidden')) { mode = 'off'; return; }
    const dt = Math.min(0.05, (now - last) / 1000) * (A.ts || 1); last = now;
    if (!paused) {
      movePlayer(dt);
      if (mode === 'voyage') update(dt);
    } else P.vx = 0;
    if (mode === 'off') return;
    cam.x += (camTarget() - cam.x) * (1 - Math.exp(-dt * 5));   // la cámara sigue al cadete con suavidad
    draw(now);
    renderAct();
    const me = $('#map-me'); if (me) me.style.left = (clamp(P.x / SHIP_W, 0, 1) * 100).toFixed(1) + '%';
    hud += dt; if (hud > 0.15 || dirty) { hud = 0; dirty = false; renderConsole(); renderHud(); }
    raf = requestAnimationFrame(loop);
  }

  A.resume = function (save) {
    A.run = save.run || { tries: 1 };
    if (save.phase === 'edl' && A.run.voy) { cfg = M.calc(); A.startEDL(A.run.voy); }
    else A.startShip(save.phase === 'voyage' ? 'voyage' : 'config');
  };

  // ---------- Teclado ----------
  const live = () => mode === 'config' || mode === 'voyage' || mode === 'arrived';
  window.addEventListener('keydown', (e) => {
    if (!live() || (e.target && e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && !paused) { if (mode === 'config' && open && open !== 'seat') { open = null; dirty = true; } else { mode = 'off'; A.show('menu'); } return; }
    if (paused) return;
    if (k === 'a' || k === 'arrowleft') { keys.l = true; e.preventDefault(); }
    if (k === 'd' || k === 'arrowright') { keys.r = true; e.preventDefault(); }
    if (k === 'e' || k === ' ') { e.preventDefault(); if (!e.repeat) press(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') keys.l = false;
    if (k === 'd' || k === 'arrowright') keys.r = false;
    if (k === 'e' || k === ' ') { serv = false; if (live() && !paused && k === ' ') e.preventDefault(); }
  });
  window.addEventListener('blur', () => { keys.l = keys.r = false; serv = false; });
})();
