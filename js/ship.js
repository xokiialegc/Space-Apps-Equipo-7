/* AEON-01 — Interior de la nave: mapa lateral continuo (2D).
   La nave es un único plano en corte, de proa (izquierda) a popa (derecha), con seis salas
   unidas por puertas. El cadete se mueve libremente con A/D o ←/→ y la cámara lo sigue.
   Todo se hace por proximidad: hay que acercarse al panel y pulsar E o Espacio cuando
   aparece el indicador.
   Modo 'config' (3.2 Segmento Espacial): la consola de cada sala configura un componente.
   Modo 'voyage' (Fase 2): viaje de ~7 meses comprimido; cada recurso se repone en su módulo,
   el panel de alertas lleva andando hasta el módulo afectado y Control de Misión plantea
   tres eventos críticos.
   Modo 'arrived': hay que volver al puesto del piloto para iniciar el descenso.
   Tripulación (issue #5): dos NPC recorren la nave por su cuenta; durante el viaje, el que está
   más cerca de una avería la detecta, camina hasta el módulo y la repara. */
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
    { id: 'bridge', name: 'Bridge', short: 'BRIDGE', res: 'Piloting · comms', hue: [50, 120, 210], w: 1150 },
    { id: 'life', name: 'Life support bay', short: 'LIFE SUP.', res: 'Oxygen', hue: [40, 170, 120], w: 1000 },
    { id: 'lab', name: 'Laboratory', short: 'LAB', res: 'Instruments', hue: [150, 100, 225], w: 1050 },
    { id: 'hangar', name: 'Lander hangar', short: 'HANGAR', res: 'Lander · heat shield', hue: [200, 80, 80], w: 1050 },
    { id: 'power', name: 'Power room', short: 'POWER', res: 'Electric power', hue: [220, 170, 40], w: 1000 },
    { id: 'prop', name: 'Engine room', short: 'ENGINES', res: 'Delta-v', hue: [220, 110, 50], w: 1050 }
  ];
  let SHIP_W = 0; ROOMS.forEach((r) => { r.x0 = SHIP_W; SHIP_W += r.w; });
  const ri = (id) => ROOMS.findIndex((r) => r.id === id);
  const at = (id, f) => { const r = ROOMS[ri(id)]; return r.x0 + r.w * f; };
  const roomAt = (x) => { let i = 0; ROOMS.forEach((r, j) => { if (x >= r.x0) i = j; }); return i; };

  // Puestos con los que se interactúa por proximidad
  const SEAT_X = 175;                                     // asiento del piloto (mira a proa)
  const ST = [
    { id: 'seat', room: 'bridge', x: 215, label: 'PILOT SEAT' },
    { id: 'bridge', room: 'bridge', x: 965, label: 'COMMUNICATIONS', cfgLabel: 'MAIN HULL' },
    { id: 'life', room: 'life', x: at('life', 0.8), label: 'LIFE SUPPORT' },
    { id: 'lab', room: 'lab', x: at('lab', 0.82), label: 'INSTRUMENTS' },
    { id: 'hangar', room: 'hangar', x: at('hangar', 0.82), label: 'LANDER & SHIELD' },
    { id: 'power', room: 'power', x: at('power', 0.8), label: 'POWER GRID' },
    { id: 'prop', room: 'prop', x: at('prop', 0.8), label: 'PROPULSION' }
  ];
  const station = (id) => ST.find((s) => s.id === id);
  const X_MIN = 262, X_MAX = SHIP_W - 85, REACH = 125, SPEED = 470;
  const T_TOTAL = 150, DAYS = A.REAL.CRUISE_DAYS, DV_TMI = A.REAL.DV_TMI;   // 210 días y 3,6 km/s (js/datos.js)

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
  const AV = A.avatar, CREW = A.crew;
  /** Tarjeta de un personaje con su retrato, para los diálogos. */
  const card = (id, t) => '<div class="crewcard">' + AV.tag(id, 52) + '<div><div class="who">' + CREW[id].name.toUpperCase() + '</div>' + t + '</div></div>';
  const K = (k) => A.key(k);
  const chip = (l, v, cls) => '<div class="uxc' + (cls ? ' ' + cls : '') + '"><small>' + l + '</small><b>' + v + '</b></div>';
  const chips = (arr, n) => '<div class="ux-grid" style="grid-template-columns:repeat(' + (n || arr.length) + ',1fr)">' + arr.join('') + '</div>';
  const ok = (b) => '<span class="' + (b ? 'text-emerald-300' : 'text-red-400') + '">' + (b ? '✓' : '✗') + '</span> ';

  // ---------- Eventos críticos de la Fase 2 ----------
  const EV = [
    { at: 22, st: 'bridge', title: 'EVENT 1 · COMMUNICATIONS', short: 'COMMUNICATIONS',
      body: 'The signal to Earth is fading.',
      tel: () => [['Signal', '42%', 'bad'], ['Telemetry', 'PARTIAL', 'bad'], ['Navigation', 'OK', 'good']],
      a: 'A · Switch to backup comms', b: 'B · Wait for another transmission',
      good: 'Signal restored.', bad: 'Still no data. Decide again.',
      start(s) { s.comms = 42; }, onGood(s) { s.comms = 92; }, onBad(s) { s.comms = Math.max(15, s.comms - 10); } },
    { at: 66, st: 'power', title: 'EVENT 2 · SOLAR STORM', short: 'SOLAR STORM',
      body: 'Radiation rising: equipment and crew at risk.',
      tel: (s) => [['Radiation', 'HIGH', 'bad'], ['Power', kw(s) + ' kW', ''], ['Systems', 'OK', 'good']],
      a: 'A · Shelter and run essentials only', b: 'B · Stay at full power',
      good: 'Crew and systems protected.', bad: 'Batteries damaged and one instrument knocked out.',
      start() {}, onGood(s) { s.bat = Math.max(5, s.bat - 4); }, onBad(s) { s.bat = Math.max(5, s.bat - 20); const i = s.instr.find((x) => x.ok); if (i) i.ok = false; } },
    { at: 108, st: 'seat', title: 'EVENT 3 · COURSE DEVIATION', short: 'COURSE DEVIATION',
      body: 'The ship is drifting off its Mars trajectory.',
      tel: (s) => [['Deviation', 'HIGH', 'bad'], ['Δv', s.dv.toFixed(2) + ' km/s', ''], ['Arrival', Math.max(0, Math.round(DAYS - day(s))) + ' days', '']],
      a: 'A · Correct course (uses Δv)', b: 'B · Hold course and monitor',
      good: 'Course corrected.', bad: 'The deviation grows: fixing it will cost more Δv.',
      start(s) { s.dev = 1; }, onGood(s) { s.dv = Math.max(0.05, s.dv - s.corr); s.dev = 0; }, onBad(s) { s.corr += 0.15; } }
  ];
  const day = (s) => s.t / T_TOTAL * DAYS;
  const kw = (s) => (cfg.kw * clamp(s.bat / 100, 0, 1)).toFixed(1);

  function openEvent(e, n) {
    dlg(e.title, '<div class="ux-hero" style="color:#ffb4a3">⚠ ' + e.body + '</div>' + chips(e.tel(S).map((x) => chip(x[0], x[1], x[2]))) +
      '<div class="who decide">' + AV.tag('player', 40) + 'YOUR CALL</div>',
      [{ l: e.a, fn: () => { e.done = true; if (e.tries === 0) S.right++; e.onGood(S); result(e, true); } },
       { l: e.b, fn: () => { e.tries++; S.wrong++; e.cool = S.t + 5; e.onBad(S); result(e, false); } }]);
  }
  function result(e, good) {
    dlg(e.title, '<div class="ux-big ' + (good ? 'good">✓ WELL DONE' : 'bad">✗ BAD CALL') + '</div><div class="ux-hero">' + (good ? e.good : e.bad) + '</div>',
      [{ l: 'Continue', fn: () => {} }]);
  }

  // ---------- Arranques ----------
  function begin(m) {
    mode = m; serv = false; paused = false; dirty = true; conKey = alertKey = actKey = ''; keys.l = keys.r = false;
    P.x = SEAT_X; P.vx = 0; P.face = -1; P.ph = 0; P.seated = true; P.auto = null; P.work = false; P.full = '';   // se empieza sentado a los mandos
    open = m === 'config' ? 'seat' : null;
    resetCrew();
    doors.fill(0); cam.x = camTarget();
    A.show('ship'); last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }

  A.startShip = function (m) {
    cfg = M.calc();
    if (m === 'voyage') return startVoyage();
    S = { t: 0, o2: 100, bat: 100, dv: cfg.dv, shield: 100, comms: 100, dev: 0, leak: false, instr: [] };
    A.store.set('aeon01.save', { phase: 'config', run: A.run });
    begin('config');
    dlg('3.2 · CONFIGURE YOUR SHIP', '<div class="ux-big">CHOOSE YOUR SYSTEMS</div>' +
      '<div class="ux-ctrl">' +
      '<div>' + K('A') + K('D') + 'Walk</div>' +
      '<div>' + K('E') + 'Stand up · open the room console</div>' +
      '<div><span class="ic" style="color:#9dffcf">✓</span>Return to the seat to confirm the design</div></div>' +
      card('vera', 'Power and propulsion.') + card('iker', 'Life support and instruments.'),
      [{ l: 'Start ▶', fn: () => {} }]);
  };

  function startVoyage() {
    cfg = M.calc();
    const r = (a, b) => a + Math.random() * (b - a);
    S = { t: 0, o2: 100, bat: 100, dv: cfg.dv - DV_TMI, shield: 100, comms: 100, dev: 0, corr: 0.3, leak: false, seal: 0, rep: 0, cal: 0, nrep: 0, ncal: 0, helped: 0,
      spares: cfg.spares, instr: cfg.instr.map((i) => ({ id: i.id, name: i.name, ok: true })), right: 0, wrong: 0, crit: 0,
      hits: [r(30, 40), r(82, 92), r(122, 132)], leakAt: r(44, 56), glitchAt: r(94, 100), ev: EV.map((e) => Object.assign({}, e, { on: false, done: false, tries: 0, cool: 0 })) };
    A.store.set('aeon01.save', { phase: 'voyage', run: A.run });
    begin('voyage');
    dlg('PHASE 2 · CRUISE TO MARS', '<div class="ux-big">' + DAYS + ' DAYS · KEEP THE SHIP ALIVE</div>' +
      '<div class="ux-ctrl">' +
      '<div><span class="ic">⚠</span>Click an alert to walk to the module</div>' +
      '<div>' + K('E') + 'Hold next to the panel to repair</div>' +
      '<div><span class="ic">!</span>Critical events: you decide</div>' +
      '<div>' + K('C') + 'View the ship from outside</div></div>' +
      card('vera', 'Iker and I fix whatever is nearest.'),
      [{ l: 'Start cruise ▶', fn: () => {} }]);
  }
  function goEDL() { const voy = A.run.voy; mode = 'off'; A.startEDL(voy); }

  // ---------- Consola de cada sala (configuración) ----------
  const TXT = {
    bridge: ['MAIN HULL', 'Bigger: more spares and more mass.', 'hull', (o) => o.mass + ' t · ' + o.cost + ' M$ · ' + o.spares + ' spares'],
    prop: ['PROPULSION · Δv', 'More propellant: more Δv. Minimum ' + M.DV_NEEDED + ' km/s.', 'prop', (o) => o.fuel + ' t of propellant<br>' + o.mass + ' t · ' + o.cost + ' M$'],
    life: ['OXYGEN', 'You need at least ' + (DAYS + 30) + ' days.', 'life', (o) => o.days + ' days · ' + o.mass + ' t · ' + o.cost + ' M$'],
    power: ['POWER', 'Must cover the systems demand.', 'power', (o) => o.kw + ' kW · ' + o.mass + ' t · ' + o.cost + ' M$']
  };
  const kvRow = (l, v, bad) => '<div class="kv"><span>' + l + '</span><b class="' + (bad ? 'text-red-400' : 'text-emerald-300') + '">' + v + '</b></div>';
  function optBtns(key, fmt) {
    const sh = M.ship();
    return '<div class="flex gap-2">' + M.COMP[key].map((o, i) => '<button class="opt' + (sh[key] === i ? ' on' : '') + '" data-k="' + key + '" data-v="' + i + '"><b>' + o.n + '</b><br>' + fmt(o) + '</button>').join('') + '</div>';
  }
  function consoleConfig(id) {
    const sh = M.ship(), k = cfg; let h = '';
    if (TXT[id]) { const t = TXT[id]; h = '<h4>' + t[0] + '</h4><p>' + t[1] + '</p>' + optBtns(t[2], t[3]); }
    if (id === 'prop') h += '<div class="my-2">' + kvRow('Ship mass', k.mass + ' t') + kvRow('Δv', k.dv.toFixed(2) + ' km/s', !k.dvOk) + '</div>';
    if (id === 'power') h += '<div class="my-2">' + kvRow('Power / demand', k.kw + ' / ' + k.demand + ' kW', !k.powerOk) + '</div>';
    if (id === 'life') h += '<div class="my-2">' + kvRow('Oxygen', k.days + ' days', k.days < DAYS + 30) + '</div>';
    if (id === 'seat') h = '<h4>PILOT SEAT</h4>' +
      '<div class="my-2">' + kvRow('Mass', k.mass + ' / ' + k.cap + ' t', !k.massOk) + kvRow('Budget', k.budgetPct + '%', !k.costOk) + kvRow('Δv', k.dv + ' km/s', !k.dvOk) +
      kvRow('Power', k.kw + ' / ' + k.demand + ' kW', !k.powerOk) + kvRow('Oxygen', k.days + ' days', k.days < DAYS + 30) + kvRow('Instruments', k.instr.length + ' / ' + k.landerCap, !k.capOk) + '</div>' +
      '<button id="c-confirm" class="serv mt-1">CONFIRM DESIGN ▶</button>';
    if (id === 'hangar') h = '<h4>LANDER</h4><p>Bigger: more instruments.</p>' +
      optBtns('lander', (o) => o.cap + ' instr. · ' + o.mass + ' t · ' + o.cost + ' M$') +
      '<h4 class="mt-3">HEAT SHIELD</h4><p>Protects you entering Mars. Don\'t skimp on it.</p>' +
      optBtns('shield', (o) => o.mass + ' t · ' + o.cost + ' M$');
    if (id === 'lab') h = '<h4>INSTRUMENTS</h4><p>Up to ' + cfg.landerCap + '. Each one draws power.</p>' +
      '<div class="grid grid-cols-2 gap-2">' + M.INSTR.map((o) => '<button class="opt' + (sh.instr.includes(o.id) ? ' on' : '') + '" data-ins="' + o.id + '"><b>' + o.name + '</b><br>' + o.mass + ' t · ' + o.cost + ' M$ · ' + o.kw + ' kW</button>').join('') + '</div>';
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
    bridge: ['REALIGN ANTENNA', (s) => s.comms < 99, () => 'SIGNAL OK', (s) => s.comms / 100],
    life: ['REGENERATE OXYGEN · USES POWER', (s) => s.o2 < 99 && s.bat > 6, (s) => (s.o2 >= 99 ? 'OXYGEN FULL' : 'NO POWER'), (s) => s.o2 / 100],
    power: ['RECHARGE BATTERIES', (s) => s.bat < 99, () => 'BATTERIES FULL', (s) => s.bat / 100],
    prop: ['SEAL LEAK', (s) => s.leak, () => 'NO LEAKS', (s) => s.seal / 2.5],
    hangar: ['REPAIR SHIELD · 1 SPARE', (s) => s.shield < 99 && s.spares > 0, (s) => (s.shield >= 99 ? 'SHIELD OK' : 'NO SPARES'), (s) => s.rep / 1.4],
    lab: ['RECALIBRATE · 1 SPARE', (s) => s.instr.some((i) => !i.ok) && s.spares > 0, (s) => (s.instr.some((i) => !i.ok) ? 'NO SPARES' : 'INSTRUMENTS OK'), (s) => s.cal / 2.5]
  };
  /** Lecturas que flotan sobre cada puesto: [etiqueta, valor, ¿mal?]. */
  function lines(id) {
    const s = S, k = cfg;
    if (mode === 'config') {
      if (id === 'seat') { const all = k.massOk && k.costOk && k.dvOk && k.powerOk && k.capOk && k.days >= DAYS + 30; return [['Mass', k.mass + ' / ' + k.cap + ' t', !k.massOk], ['Budget', k.budgetPct + '%', !k.costOk], ['Design', all ? 'READY' : 'CHECK', !all]]; }
      if (id === 'bridge') return [['Main hull', k.pick.hull.n.toUpperCase()], ['Spares', String(k.spares)]];
      if (id === 'life') return [['Oxygen', k.days + ' days', k.days < DAYS + 30]];
      if (id === 'power') return [['Power', k.kw + ' kW'], ['Demand', k.demand + ' kW', !k.powerOk]];
      if (id === 'prop') return [['Tanks', k.pick.prop.n.toUpperCase()], ['Δv', k.dv + ' km/s', !k.dvOk]];
      if (id === 'hangar') return [['Lander', k.pick.lander.n.toUpperCase()], ['Shield', k.pick.shield.n.toUpperCase()]];
      return [['Instruments', k.instr.length + ' / ' + k.landerCap, !k.capOk]];
    }
    if (id === 'seat') return mode === 'arrived' ? [['Mars', 'REACHED'], ['Descent', 'READY']] : [['Trajectory', s.dev ? 'OFF COURSE' : 'NOMINAL', !!s.dev], ['Arrival in', Math.max(0, Math.round(DAYS - day(s))) + ' days']];
    if (id === 'bridge') return [['Signal', s.comms.toFixed(0) + '%', s.comms < 35]];
    if (id === 'life') return [['Oxygen', s.o2.toFixed(0) + '%', s.o2 < 25], ['Reserve', k.days + ' days']];
    if (id === 'power') return [['Batteries', s.bat.toFixed(0) + '%', s.bat < 20], ['Power', kw(s) + ' / ' + k.demand + ' kW', s.bat < 20]];
    if (id === 'prop') return [['Δv', s.dv.toFixed(2) + ' km/s', s.dv < 0.5], ['Fuel lines', s.leak ? 'LEAK' : 'OK', s.leak]];
    if (id === 'hangar') return [['Shield', s.shield.toFixed(0) + '%', s.shield < 60], ['Spares', String(s.spares), s.spares === 0]];
    return s.instr.map((i) => [i.name, i.ok ? 'OPERATIONAL' : 'FAILED', !i.ok]).concat([['Spares', String(s.spares), s.spares === 0]]);
  }

  function confirmDesign() {
    const k = cfg = M.calc();
    const checks = [[k.massOk, 'Mass', k.mass + ' / ' + k.cap + ' t'], [k.costOk, 'Budget', k.budgetPct + '%'], [k.dvOk, 'Δv', k.dv + ' km/s'],
      [k.days >= DAYS + 30, 'Oxygen', k.days + ' days'], [k.powerOk, 'Power', k.kw + ' / ' + k.demand + ' kW'], [k.capOk, 'Instruments', k.instr.length + ' / ' + k.landerCap],
      [true, 'Shield', k.pick.shield.n]];
    const all = checks.every((x) => x[0]);
    const grid = chips(checks.map((x) => chip((x[0] ? '✓ ' : '✗ ') + x[1], x[2], x[0] ? 'good' : 'bad')), 4);
    if (!all) return dlg('DESIGN CHECK', '<div class="ux-big bad">✗ DESIGN INCOMPLETE</div>' + grid +
      '<div class="ux-hero">Fix every ✗ in its room.</div>', [{ l: 'Keep configuring', fn: () => {} }]);
    dlg('DESIGN CHECK', '<div class="ux-big good">✓ SHIP READY</div>' + grid + '<div class="ux-hero">Next stop: Mars.</div>',
      [{ l: 'Keep configuring', fn: () => {} }, { l: 'Start cruise to Mars ▶', fn: startVoyage }]);
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
      const near = Math.abs(P.x - r.x0) < 250 || NPCS.some((n) => Math.abs(n.x - r.x0) < 170), o = doors[i];
      doors[i] = clamp(o + (near ? 1 : -1) * dt * 4.5, 0, 1);
      if (near && o === 0 && Math.abs(P.x - r.x0) < 900) A.beep(260, 0.05);
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
    const seatAct = () => (P.seated ? { l: 'STAND UP', fn: stand, can: true } : { l: 'SIT DOWN', fn: sit, can: true });
    if (mode === 'arrived') return st.id === 'seat' ? { l: 'START DESCENT', fn: goEDL, can: true } : null;
    if (mode === 'voyage') {
      const i = S.ev.findIndex((e) => e.on && !e.done && e.st === st.id);
      if (i >= 0) { const e = S.ev[i]; return S.t > e.cool ? { l: 'EVENT ' + (i + 1) + '! · DECIDE', fn: () => openEvent(e, i), can: true, hot: true } : { l: 'REBOOTING…', can: false }; }
      if (st.id === 'seat') return seatAct();
      const sv = SERV[st.id], can = sv[1](S) && P.full !== st.id;
      return { l: can ? sv[0] : sv[2](S), hold: true, can, prog: clamp(sv[3](S), 0, 1) };
    }
    if (st.id === 'seat') return seatAct();
    return open === st.id ? { l: 'CLOSE', fn: () => { open = null; }, can: true } : { l: 'CONSOLE · ' + (st.cfgLabel || st.label), fn: () => { open = st.id; P.auto = null; }, can: true };
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
    el.innerHTML = '<kbd>E</kbd><span>' + (a.hold && a.can ? 'HOLD · ' : '') + a.l + '</span>' + (pr >= 0 ? '<i style="width:' + pr * 2 + '%"></i>' : '');
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

  // ---------- Tripulación: NPC con movimiento libre e IA de reparación (issue #5) ----------
  const NPC_SPEED = 250, NPC_REACT = 1.3;
  const NPCS = ['vera', 'iker'].map((id) => ({ id, who: CREW[id], x: 0, vx: 0, face: 1, ph: 0, seated: false, work: false, st: 'idle', wait: 0, tx: 0, job: null, K: 0.86 }));
  /** Averías que la tripulación sabe reparar: cuándo saltan, cuándo se dan por resueltas y cómo se trabaja en ellas. */
  const JOBS = {
    life: { txt: 'Low oxygen', end: 'Oxygen stable', need: (s) => s.o2 < 25, done: (s) => s.o2 >= 60, can: (s) => s.bat > 12, work(s, dt) { s.o2 += 8 * dt; s.bat -= 1.4 * dt; } },
    power: { txt: 'Low power', end: 'Batteries charged', need: (s) => s.bat < 20, done: (s) => s.bat >= 60, can: () => true, work(s, dt) { s.bat += 7 * dt; } },
    bridge: { txt: 'Weak signal', end: 'Antenna realigned', need: (s) => s.comms < 35, done: (s) => s.comms >= 75, can: (s) => !(s.ev[0].on && !s.ev[0].done), work(s, dt) { s.comms += 9 * dt; } },   // con el evento 1 activo la antena no basta: decide el cadete
    prop: { txt: 'Propellant leak', end: 'Leak sealed', need: (s) => s.leak, done: (s) => !s.leak, can: () => true, work(s, dt) { s.seal += 0.6 * dt; if (s.seal > 2.5) { s.leak = false; A.beep(880, 0.2); } } },
    hangar: { txt: 'Shield damaged', end: 'Shield repaired', need: (s) => s.shield < 60 && s.spares > 0, done: (s) => s.shield >= 60, can: (s) => s.spares > 0, work(s, dt) { s.nrep += dt; if (s.nrep > 2.4) { s.nrep = 0; s.spares--; s.shield += 12; A.beep(880, 0.1); } } },
    lab: { txt: 'Instrument failure', end: 'Instrument fixed', need: (s) => s.instr.some((i) => !i.ok) && s.spares > 0, done: (s) => s.instr.every((i) => i.ok), can: (s) => s.spares > 0, work(s, dt) { s.ncal += dt; if (s.ncal > 4) { s.ncal = 0; s.spares--; s.instr.find((i) => !i.ok).ok = true; A.beep(880, 0.2); } } }
  };
  const roam = (n) => { n.st = 'walk'; n.job = null; n.work = false; n.tx = X_MIN + 120 + Math.random() * (X_MAX - X_MIN - 160); };
  function resetCrew() {
    NPCS.forEach((n, i) => { n.x = i ? at('lab', 0.3) : at('power', 0.35); n.vx = 0; n.face = i ? 1 : -1; n.ph = i * 2; n.st = 'idle'; n.wait = 1 + i * 2.5; n.job = null; n.work = false; });
    say(null);
  }
  /** Mensaje de radio de un tripulante, con su retrato. */
  let sayT = 0;
  function say(n, txt) {
    const el = $('#crew-msg');
    if (!n) { el.style.display = 'none'; sayT = 0; return; }
    el.innerHTML = AV.tag(n.id, 52) + '<div><b>' + n.who.name.toUpperCase() + '</b><span>' + txt + '</span></div>';
    el.style.display = 'flex'; sayT = 4.5; A.beep(600, 0.08);
  }
  function updateCrew(dt) {
    if (sayT > 0 && (sayT -= dt) <= 0) say(null);
    if (mode === 'voyage') {                                // detección: el tripulante libre más cercano acude
      Object.keys(JOBS).forEach((id) => {
        const j = JOBS[id];
        if (!j.need(S) || !j.can(S) || NPCS.some((n) => n.job === id)) return;
        if (P.work && current() && current().id === id) return;                // el cadete ya está en ello
        const sx = station(id).x, free = NPCS.filter((n) => !n.job).sort((a, b) => Math.abs(a.x - sx) - Math.abs(b.x - sx))[0];
        if (!free) return;
        free.job = id; free.st = 'alert'; free.wait = NPC_REACT; free.work = false; free.tx = clamp(sx + 52, X_MIN, X_MAX); free.face = sx >= free.x ? 1 : -1;
        say(free, j.txt + '! Heading to the ' + ROOMS[ri(station(id).room)].name.toLowerCase() + '.');
      });
    }
    NPCS.forEach((n) => {
      const j = n.job && JOBS[n.job];
      let dir = 0;
      if (j && (mode !== 'voyage' || j.done(S) || !j.can(S))) {   // resuelta (o ya no se puede seguir)
        if (mode === 'voyage' && j.done(S)) { say(n, '✓ ' + j.end + (n.st === 'fix' ? '' : ' · Nice work, cadet!')); if (n.st === 'fix') S.helped++; }
        n.job = null; n.work = false; n.st = 'idle'; n.wait = 2 + Math.random() * 2;
      } else if (n.st === 'alert') { if ((n.wait -= dt) <= 0) n.st = 'go'; }
      else if (n.st === 'fix') { n.work = true; n.face = -1; j.work(S, dt); }
      else if (n.st === 'idle') { if ((n.wait -= dt) <= 0) roam(n); }
      else {                                                // 'walk' (paseo libre) o 'go' (hacia la avería)
        const d = n.tx - n.x;
        if (Math.abs(d) < 6) { n.x = n.tx; if (n.st === 'go') n.st = 'fix'; else { n.st = 'idle'; n.wait = 1.5 + Math.random() * 3.5; } }
        else dir = Math.sign(d) * clamp(Math.abs(d) / 60, 0.3, 1) * (n.st === 'go' ? 1.15 : 0.6);
      }
      n.vx += (dir * NPC_SPEED - n.vx) * (1 - Math.exp(-dt * 10));
      if (!dir && Math.abs(n.vx) < 3) n.vx = 0;
      n.x = clamp(n.x + n.vx * dt, X_MIN, X_MAX);
      if (dir) n.face = dir > 0 ? 1 : -1;
      n.ph += Math.abs(n.vx) * dt * 0.02;
    });
  }
  /** Qué está haciendo cada tripulante (barra de tripulación). */
  function crewStatus(n) {
    const room = ROOMS[roomAt(n.x)].name;
    if (n.st === 'fix') return ['REPAIRING', 'fix'];
    if (n.job) return ['→ ' + ROOMS[ri(station(n.job).room)].name, 'go'];
    return [room, ''];
  }
  let crewKey = '';
  function renderCrew() {
    const me = P.seated ? 'At the controls' : P.work ? 'REPAIRING' : ROOMS[roomAt(P.x)].name;
    const rows = [['player', me, P.work ? 'fix' : '']].concat(NPCS.map((n) => [n.id].concat(crewStatus(n))));
    const key = JSON.stringify(rows) + A.settings.accent;
    if (key === crewKey) return;
    crewKey = key;
    $('#crew').innerHTML = rows.map((r) => '<div class="crewchip ' + r[2] + '">' + AV.tag(r[0], 38) + '<div><b>' + CREW[r[0]].name.split(' ')[0] + '</b><span>' + r[1] + '</span></div></div>').join('');
  }

  // ---------- Alertas ----------
  /** Lista de [puesto, texto]. */
  function alerts() {
    if (mode === 'arrived') return [['seat', 'MARS · BACK TO THE CONTROLS']];
    if (mode !== 'voyage') return [];
    const s = S, a = [];
    s.ev.forEach((e, i) => { if (e.on && !e.done) a.push([e.st, 'EVENT ' + (i + 1) + '! ' + e.short]); });
    if (s.o2 < 25) a.push(['life', 'LOW OXYGEN! ' + s.o2.toFixed(0) + ' %']);
    if (s.bat < 20) a.push(['power', 'LOW POWER! ' + s.bat.toFixed(0) + ' %']);
    if (s.leak) a.push(['prop', 'PROPELLANT LEAK!']);
    if (s.shield < 60) a.push(['hangar', 'SHIELD DAMAGED! ' + s.shield.toFixed(0) + ' %']);
    if (s.comms < 35 && !s.ev[0].on) a.push(['bridge', 'WEAK SIGNAL! ' + s.comms.toFixed(0) + ' %']);
    if (s.instr.some((i) => !i.ok)) a.push(['lab', 'INSTRUMENT FAILURE!']);
    return a;
  }
  /** Averías y eventos activos (lo que enciende las luces de alarma). */
  const faults = () => (mode === 'voyage' ? alerts() : []);
  function renderHud() {
    const al = alerts(), cur = current(), room = roomAt(P.x), hot = new Set(al.map((x) => ri(station(x[0]).room)));
    const rel = (id) => (cur && cur.id === id ? 'HERE' : station(id).x < P.x ? '← GO' : 'GO →');
    const key = JSON.stringify(al.map((x) => x[1].replace(/\d+ %/, '') + rel(x[0]))) + room + mode;
    if (key !== alertKey) {
      alertKey = key;
      $('#alerts').innerHTML = al.length ? '<div class="alrt-h">⚠ ALERTS</div>' + al.map((x) => '<button class="alrt" data-s="' + x[0] + '"><span>' + x[1] + '</span><b>' + rel(x[0]) + '</b></button>').join('') : '';
      $('#alerts').querySelectorAll('button').forEach((b) => b.onclick = () => { goTo(b.dataset.s); b.blur(); });
      $('#sh-map').innerHTML = ROOMS.map((r, i) => '<button class="mapb' + (i === room ? ' on' : '') + (hot.has(i) ? ' alarm' : '') + '" style="flex:' + r.w + ' 1 0" data-s="' + (i ? r.id : 'seat') + '">' + r.short + '</button>').join('') + '<i id="map-me"></i>' + NPCS.map((n) => '<i class="map-npc" id="map-' + n.id + '" style="background:' + n.who.tint + '" title="' + n.who.name + '"></i>').join('');
      $('#sh-map').querySelectorAll('button').forEach((b) => b.onclick = () => { goTo(b.dataset.s); b.blur(); });
      const l = ROOMS[room - 1], r = ROOMS[room + 1];
      $('#nav-l').innerHTML = '<small>◀ A</small>' + (l ? l.name : 'Bow'); $('#nav-r').innerHTML = '<small>D ▶</small>' + (r ? r.name : 'Stern');
      $('#nav-l').classList.toggle('alarm', [...hot].some((i) => i < room)); $('#nav-r').classList.toggle('alarm', [...hot].some((i) => i > room));
      $('#sh-room').textContent = ROOMS[room].name; $('#sh-res').textContent = '';
    }
    const st = (l, v, bad) => '<div class="stat' + (bad ? ' bad' : '') + '"><label>' + l + '</label><b>' + v + '</b></div>';
    if (mode === 'config') {
      const k = cfg;
      $('#sh-phase').textContent = '3.2 · CONFIGURATION IN ORBIT';
      $('#sh-stats').innerHTML = st('MASS', k.mass + '/' + k.cap + ' t', !k.massOk) + st('BUDGET', k.budgetPct + '%', !k.costOk) + st('DELTA-v', k.dv + ' km/s', !k.dvOk) +
        st('OXYGEN', k.days + ' days', false) + st('POWER', k.kw + '/' + k.demand + ' kW', !k.powerOk) + st('SHIELD', k.pick.shield.n, false) + st('INSTRUM.', k.instr.length + '/' + k.landerCap, !k.capOk);
    } else {
      const s = S;
      $('#sh-phase').textContent = mode === 'arrived' ? 'PHASE 2 · MARS ARRIVAL' : 'PHASE 2 · DAY ' + String(Math.min(DAYS, Math.floor(day(s)))).padStart(3, '0') + ' / ' + DAYS;
      $('#sh-stats').innerHTML = st('DELTA-v', s.dv.toFixed(2) + ' km/s', s.leak || s.dv < 0.5) + st('OXYGEN', s.o2.toFixed(0) + '%', s.o2 < 25) + st('POWER', s.bat.toFixed(0) + '%', s.bat < 20) +
        st('SHIELD', s.shield.toFixed(0) + '%', s.shield < 60) + st('COMMS', s.comms.toFixed(0) + '%', s.comms < 35) + st('INSTRUM.', s.instr.filter((i) => i.ok).length + '/' + s.instr.length, s.instr.some((i) => !i.ok)) + st('SPARES', s.spares, false);
    }
  }

  // ---------- Simulación del viaje ----------
  function failC(cause) {
    mode = 'off';
    const s = S;
    M.report('<div class="ux-big bad">✗ MISSION FAILED</div><div class="ux-hero">' + cause.toUpperCase() + ' · DAY ' + Math.floor(day(s)) + '</div>' +
      chips([chip('Δv', Math.max(0, s.dv / (cfg.dv - DV_TMI) * 100).toFixed(0) + '%', s.dv <= 0 ? 'bad' : ''), chip('Oxygen', Math.max(0, s.o2).toFixed(0) + '%', s.o2 <= 0 ? 'bad' : ''),
        chip('Power', kw(s) + ' kW', s.bat <= 0 ? 'bad' : '')]) +
      '<p class="ux-tip">Keep a margin of oxygen, power and Δv.</p>',
      [{ l: 'Menu', fn: () => A.show('menu') }, { l: 'Repeat the cruise', fn: startVoyage }, { l: 'Redesign the ship ▶', fn: () => A.startShip('config') }]);
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

    if (s.o2 <= 0) return failC('oxygen depleted');
    if (s.bat <= 0) return failC('ship out of power');
    if (s.dv <= 0) return failC('propellant depleted');

    if (s.t >= T_TOTAL && s.ev.every((x) => x.done)) {
      mode = 'arrived'; P.work = false; serv = false;
      const voy = { o2: s.o2, bat: s.bat, dv: s.dv, shield: s.shield, comms: s.comms, right: s.right, wrong: s.wrong, crit: s.crit,
        instrOk: s.instr.filter((i) => i.ok).length, instrN: s.instr.length };
      A.run.voy = voy; A.store.set('aeon01.save', { phase: 'edl', run: A.run });
      dlg('PHASE 2 · ARRIVAL', '<div class="ux-big good">YOU MADE IT TO MARS!</div><div class="ux-hero">Over 470 million km traveled.</div>' +
        (P.seated ? '' : '<p class="ux-tip">Return to the controls to descend.</p>'),
        P.seated ? [{ l: 'Start descent ▶', fn: goEDL }] : [{ l: 'Go to the controls ▶', fn: () => goTo('seat') }]);
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

  /** ¿Hay alguien (el cadete o un tripulante) trabajando en ese puesto? */
  const working = (id) => (P.work && current() && current().id === id) || NPCS.some((n) => n.st === 'fix' && n.job === id);

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
      c.save(); c.translate(960, 340); c.fillStyle = '#0c1620'; c.beginPath(); c.arc(0, 0, 95, 0, 7); c.fill(); c.rotate(t * (working('life') ? 9 : 2.5));
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
      const full = clamp(s.dv / M.DV_REF, 0, 1);
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
      const a = -0.5 + (working('bridge') ? Math.sin(t * 5) * 0.35 : Math.sin(t * 0.4) * 0.05);
      seg(700, TOP, 700, TOP - 52, 6, '#55627a');
      c.save(); c.translate(700, TOP - 56); c.rotate(a); c.fillStyle = '#c9d4e2'; c.beginPath(); c.ellipse(0, 0, 44, 12, 0, 0, 7); c.fill(); seg(0, 0, 0, -26, 3, '#c9d4e2'); c.restore();
    }
    const px = at('power', 0.5);
    if (x1 < px + 300 && x2 > px - 300) {                    // panel solar (gira al reorientarlo)
      const a = working('power') ? Math.sin(t * 4) * 0.25 : -0.12;
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

  /** Un astronauta (el cadete o un tripulante): camina, espera, trabaja o va sentado a los mandos. */
  function astronaut(t, B) {
    const npc = B !== P, K = B.K || 0.9, mv = clamp(Math.abs(B.vx) / (npc ? NPC_SPEED : SPEED), 0, 1), sw = Math.sin(B.ph) * mv, acc = npc ? B.who.tint : A.settings.accent;
    const lit = npc ? B.who.suit[0] : '#e8eef5', dim = npc ? B.who.suit[1] : '#a3b0c0', boot = '#465168';
    const bob = Math.abs(Math.cos(B.ph)) * 5 * mv + Math.sin(t * 2.2) * 1.5 * (1 - mv);
    c.save();
    if (B.seated) c.translate(SEAT_X + 2, FLOOR - 58); else c.translate(B.x, FLOOR - 84 * K - bob * K);
    c.scale(B.face * K, K); c.lineCap = 'round'; c.lineJoin = 'round';
    const leg = (a, col, fwd) => {                            // origen en la cadera
      if (B.seated) { seg(0, 2, 42, 4, 20, col); seg(42, 4, 44, 44, 18, col); seg(44, 46, 58, 46, 14, boot); return; }
      const kx = Math.sin(a) * 42 + fwd, ky = Math.cos(a) * 42, fx = Math.sin(a) * 84, fy = 84 - Math.max(0, fwd) * 0.9;
      seg(0, 0, kx, ky, 20, col); seg(kx, ky, fx, fy, 18, col); seg(fx - 2, fy - 2, fx + 15, fy - 2, 14, boot);
    };
    const arm = (a, col) => {                                 // origen en el hombro
      if (B.seated) { seg(2, -66, 30, -52, 15, col); seg(30, -52, 62, -60, 13, col); return; }
      if (B.work && col === lit) {
        seg(2, -66, 30, -52, 15, col); seg(30, -52, 56, -62 + Math.sin(t * 22) * 3, 13, col);
        c.fillStyle = 'rgba(255,230,140,' + (0.5 + Math.random() * 0.5) + ')'; c.beginPath(); c.arc(64, -62, 4 + Math.random() * 7, 0, 7); c.fill();
        return;
      }
      const ex = Math.sin(a) * 30, ey = -66 + Math.cos(a) * 30, hx = Math.sin(a + 0.25) * 58, hy = -66 + Math.cos(a + 0.25) * 58;
      seg(2, -66, ex, ey, 15, col); seg(ex, ey, hx + 4, hy, 13, col);
    };
    const idle = (1 - mv) * 0.09;
    leg(-sw * 0.55 - idle, dim, sw < 0 ? -sw * 12 : 0); arm(sw * 0.6, dim);
    c.save(); c.rotate(B.seated ? -0.06 : 0.07 * mv);
    rr(-40, -82, 22, 62, 7, npc ? dim : '#b4c0cf');                         // mochila de soporte vital
    rr(-24, -84, 48, 88, 15, lit); c.fillStyle = npc ? dim : '#aab7c6'; c.fillRect(-24, -8, 48, 8);
    c.fillStyle = acc; c.fillRect(-24, -44, 48, 6);
    rr(4, -68, 17, 20, 4, '#c3cedb'); c.fillStyle = '#3cff9e'; c.fillRect(8, -63, 5, 4);
    c.fillStyle = '#f4f8fb'; c.beginPath(); c.arc(2, -110, 30, 0, 7); c.fill();                               // casco
    const vg = c.createLinearGradient(-4, -128, 30, -92); vg.addColorStop(0, '#2a6aa6'); vg.addColorStop(0.5, '#0b1626'); vg.addColorStop(1, '#04080f');
    c.fillStyle = vg; c.beginPath(); c.ellipse(12, -110, 19, 19, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(200,235,255,.75)'; c.lineWidth = 2.5; c.beginPath(); c.arc(11, -111, 13, 3.6, 4.7); c.stroke();
    c.restore();
    leg(sw * 0.55 + idle, lit, sw > 0 ? sw * 12 : 0); arm(-sw * 0.6, lit);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(B.seated ? SEAT_X + 6 : B.x, FLOOR + 3, 40, 6, 0, 0, 7); c.fill();
  }


  /** Icono flotante de un tripulante: retrato, nombre y lo que está haciendo. */
  function crewTag(n, t) {
    const low = ST.some((s) => Math.abs(s.x - n.x) < 210);   // junto a un puesto va a los pies, para no tapar su lectura
    const y = low ? FLOOR + 34 : FLOOR - 84 * n.K - 178 + Math.sin(t * 2 + n.ph) * 3, name = n.who.name.toUpperCase() + (n.st === 'fix' ? ' · REPAIRING' + '.'.repeat(1 + Math.floor(t * 3) % 3) : '');
    c.font = '700 12px Orbitron, sans-serif'; const w = c.measureText(name).width + 50, x = n.x - w / 2, hot = n.st === 'alert' || n.st === 'go';
    rr(x, y - 15, w, 30, 15, n.st === 'fix' ? 'rgba(8,60,40,.88)' : hot ? 'rgba(72,12,8,.88)' : 'rgba(4,20,45,.85)');
    c.strokeStyle = n.st === 'fix' ? '#3cff9e' : hot ? '#ff5a3c' : n.who.tint; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x, y - 15, w, 30, 15); c.stroke();
    c.drawImage(AV.img(n.id), x + 2, y - 13, 26, 26);
    c.textAlign = 'left'; c.fillStyle = '#eaf6ff'; c.fillText(name, x + 36, y + 4.5);
    if (hot) {                                               // ha detectado una avería
      const by = low ? FLOOR - 84 * n.K - 150 : y - 36 + Math.sin(t * 9) * 3;
      rr(n.x - 13, by - 14, 26, 28, 7, '#ff5a3c'); c.fillStyle = '#fff'; c.font = '900 20px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('!', n.x, by + 8);
    }
    c.textAlign = 'left';
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

  // ---------- Partículas de averías y reparaciones (sensación de juego, ver js/fx.js) ----------
  // Paneles averiados: chispas eléctricas y arcos. Soporte vital: vapor saliendo de la tubería.
  // Propulsión: chorro de gas de la fuga. Quien repara (cadete o NPC) suelta chispas de soldadura
  // con el soplete encendido, y al quedar resuelta una avería sale una nube verde de confirmación.
  let fxp = [], fxT = 0, prevHot = null;
  const FXK = { life: 'vapor', prop: 'jet' };                // el resto de averías dan chispas
  const rnd = (a, b) => a + Math.random() * (b - a);
  const addP = (p) => { if (fxp.length < 600) fxp.push(Object.assign({ age: 0, g: 0, add: true }, p)); };
  function emitFx(t, hotSt, x1, x2) {
    const dt = clamp(t - fxT, 0, 0.05); fxT = t;
    const mid = cam.x + W / 2;
    let sparkNear = 0;
    if (mode === 'voyage') hotSt.forEach((id) => {
      const st = station(id); if (!st || st.x < x1 - 200 || st.x > x2 + 200) return;
      const kind = FXK[id] || 'spark', y0 = FLOOR - 122;
      if (kind === 'spark') {
        sparkNear = Math.max(sparkNear, 1 - Math.min(1, Math.abs(st.x - mid) / 900));
        if (Math.random() < 0.2) {
          const sx = st.x + rnd(-36, 36);
          for (let i = 0; i < 6 + Math.random() * 10; i++) addP({ k: 'spark', x: sx, y: y0, vx: rnd(-280, 280), vy: rnd(-360, -40), g: 1100, life: rnd(0.35, 0.8), c: Math.random() < 0.5 ? '255,220,120' : '170,220,255' });
          addP({ k: 'arc', x: sx, y: y0, life: 0.09, c: '190,230,255' });
        }
      } else if (kind === 'vapor') {
        for (let i = 0; i < 2; i++) addP({ k: 'puff', x: st.x - 130 + rnd(-6, 6), y: CEIL + 46, vx: rnd(-40, 40), vy: rnd(60, 150), life: rnd(1.2, 2), r0: 6, r1: 46, c: '225,240,255', add: false });
      } else {
        for (let i = 0; i < 3; i++) addP({ k: 'puff', x: st.x + 70, y: FLOOR - 170 + rnd(-4, 4), vx: rnd(280, 460), vy: rnd(-40, 40), life: rnd(0.5, 0.9), r0: 3, r1: 30, c: '200,235,255', add: false });
      }
    });
    if (sparkNear > 0.05 && A.fx) A.fx.hold('spark', sparkNear);
    let welding = false;
    [P].concat(NPCS).forEach((w) => {                       // soplete de quien repara
      if (!w.work || w.x < x1 - 100 || w.x > x2 + 100) return;
      welding = true;
      const wx = w.x + w.face * 40, wy = FLOOR - 120 + Math.sin(t * 23) * 3;
      addP({ k: 'glow', x: wx, y: wy, life: 0.06, c: '200,235,255' });
      for (let i = 0; i < 3; i++) addP({ k: 'spark', x: wx, y: wy, vx: rnd(-200, 200) - w.face * 80, vy: rnd(-260, 60), g: 900, life: rnd(0.2, 0.55), c: Math.random() < 0.6 ? '255,190,90' : '255,255,220' });
    });
    if (welding && A.fx) A.fx.hold('weld');
    if (prevHot) prevHot.forEach((id) => {                  // avería resuelta: confirmación verde
      if (hotSt.has(id) || mode !== 'voyage') return;
      const st = station(id); if (!st) return;
      for (let i = 0; i < 40; i++) { const an = rnd(0, 6.28), sp = rnd(40, 220); addP({ k: 'ok', x: st.x + rnd(-30, 30), y: FLOOR - 120, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 90, g: -40, life: rnd(0.8, 1.5), c: '80,255,160' }); }
      addP({ k: 'ring', x: st.x, y: FLOOR - 120, life: 0.7, c: '80,255,160' });
      if (A.fx) A.fx.event('fixed');
    });
    prevHot = mode === 'voyage' ? new Set(hotSt) : null;
    fxp.forEach((p) => { p.age += dt; if (p.vx != null) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } });
    fxp = fxp.filter((p) => p.age < p.life);
  }
  function drawFx() {
    c.save();
    fxp.forEach((p) => {
      const u = p.age / p.life, a = 1 - u;
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.k === 'spark') { c.strokeStyle = 'rgba(' + p.c + ',' + a + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); c.stroke(); }
      else if (p.k === 'arc') {
        c.strokeStyle = 'rgba(' + p.c + ',.95)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(p.x - 40, p.y + 6);
        for (let i = 1; i <= 6; i++) c.lineTo(p.x - 40 + i * 13, p.y + rnd(-14, 14));
        c.stroke();
        const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 90); g.addColorStop(0, 'rgba(170,220,255,.5)'); g.addColorStop(1, 'rgba(170,220,255,0)'); c.fillStyle = g; c.fillRect(p.x - 90, p.y - 90, 180, 180);
      } else if (p.k === 'glow') {
        const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, 46 + Math.random() * 14); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.2, 'rgba(150,210,255,.6)'); g.addColorStop(1, 'rgba(150,210,255,0)');
        c.fillStyle = g; c.fillRect(p.x - 60, p.y - 60, 120, 120);
      } else if (p.k === 'puff') { c.fillStyle = 'rgba(' + p.c + ',' + (0.4 * a) + ')'; c.beginPath(); c.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * u, 0, 7); c.fill(); }
      else if (p.k === 'ok') { c.fillStyle = 'rgba(' + p.c + ',' + a + ')'; c.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); }
      else if (p.k === 'ring') { c.strokeStyle = 'rgba(' + p.c + ',' + a + ')'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y, 20 + u * 120, 0, 7); c.stroke(); }
    });
    c.restore();
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
    NPCS.forEach((n) => { if (n.x > x1 - 120 && n.x < x2 + 120) astronaut(t, n); });
    astronaut(t, P);
    ROOMS.forEach((r, i) => { if (i && r.x0 > x1 - 40 && r.x0 < x2 + 40) bulkhead(i, t, hot.has(r.id) || hot.has(ROOMS[i - 1].id)); });
    NPCS.forEach((n) => { if (n.x > x1 - 120 && n.x < x2 + 120) crewTag(n, t); });
    emitFx(t, hotSt, x1, x2); drawFx();
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
    if (A.paused) { draw(now); raf = requestAnimationFrame(loop); return; }
    if (!paused) {
      movePlayer(dt);
      updateCrew(dt);
      if (mode === 'voyage') update(dt);
    } else P.vx = 0;
    if (mode === 'off') return;
    cam.x += (camTarget() - cam.x) * (1 - Math.exp(-dt * 5));   // la cámara sigue al cadete con suavidad
    draw(now);
    renderAct();
    const me = $('#map-me'); if (me) me.style.left = (clamp(P.x / SHIP_W, 0, 1) * 100).toFixed(1) + '%';
    NPCS.forEach((n) => { const el = $('#map-' + n.id); if (el) el.style.left = (clamp(n.x / SHIP_W, 0, 1) * 100).toFixed(1) + '%'; });
    hud += dt; if (hud > 0.15 || dirty) { hud = 0; dirty = false; renderConsole(); renderHud(); renderCrew(); }
    raf = requestAnimationFrame(loop);
  }

  A.resume = function (save) {
    A.run = save.run || { tries: 1 };
    if (save.phase === 'edl' && A.run.voy) { cfg = M.calc(); A.startEDL(A.run.voy); }
    else A.startShip(save.phase === 'voyage' ? 'voyage' : 'config');
  };

  // ---------- Teclado ----------
  const live = () => mode === 'config' || mode === 'voyage' || mode === 'arrived';

  // ---------- Telemetría para la cámara exterior (js/exterior.js, issue #9) ----------
  (A.flight = A.flight || {}).ship = () => (!live() || paused || !S || $('#screen-ship').classList.contains('hidden')) ? null : {
    kind: 'ship', mode, progress: mode === 'config' ? 0 : mode === 'arrived' ? 1 : clamp(S.t / T_TOTAL, 0, 1), day: day(S),
    dv: S.dv, dv0: mode === 'config' ? cfg.dv : cfg.dv - DV_TMI, o2: S.o2, bat: S.bat, shield: S.shield, comms: S.comms,
    leak: !!S.leak, flash: S.flash || 0, instr: S.instr.some((i) => !i.ok), thrust: mode === 'voyage' ? 0.3 : 0,
    alerts: alerts().map((a) => a[1]), hot: faults().map((a) => station(a[0]).room),
    onEnter: () => { keys.l = keys.r = false; serv = false; P.auto = null; }   // mirando desde fuera, el cadete se queda quieto
  };
  window.addEventListener('keydown', (e) => {
    if (!live() || (e.target && e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && !paused) { if (mode === 'config' && open && open !== 'seat') { open = null; dirty = true; } else if (!e.repeat) A.togglePause(); return; }
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
