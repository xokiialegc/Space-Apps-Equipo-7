/* AEON-01 — Fase 1 en la cabina (primera persona, 2D).
   1) Verificación de carga y presupuesto: holograma delante de los monitores.
   2) Confirmación de Control de Misión.
   3) Cuenta atrás y despegue: el monitor central muestra la cámara exterior,
      con combustible y energía; los monitores laterales, altitud/velocidad y estructura.
   Modelo de vuelo (constantes físicas en js/datos.js, auditadas en docs/AUDITORIA_NASA.md):
   - Empuje constante mientras se mantienen los impulsores; el combustible baja en tiempo real.
   - Densidad del aire: rho = e^(-h/H), con H = 8,5 km (altura de escala de la atmósfera, NASA).
     Presión dinámica Q ∝ rho·v² (la real es ½·rho·v²; aquí va normalizada al límite estructural).
     Por encima del límite la estructura acumula daño: hay que modular el empuje en el aire denso.
   - La gravedad es g₀ = 9,80665 m/s² multiplicada por la escala de tiempo del despegue (1 s de
     juego ≈ 8 s reales) y se anula al alcanzar la velocidad orbital: g·(1 − v²/v_orb²).
   - Objetivo: 7,8 km/s por encima de la línea de Kármán (100 km). */
(function () {
  'use strict';
  const A = window.AEON;
  const $ = (s) => document.querySelector(s);
  const cv = $('#launch'), c = cv.getContext('2d');
  const VW = cv.width, VH = cv.height;           // lienzo del monitor (resolución x2)

  const R = A.REAL;
  const V_ORBIT = R.V_LEO, H_SPACE = R.KARMAN, H_SCALE = R.EARTH_SCALE_H;
  const BURN = 2.3;       // % de combustible por segundo de impulso
  const GRAV = R.G0 / 1000 * R.LAUNCH_TIME_SCALE;      // km/s² de juego (0,0785)
  // Q_LIMIT es el límite estructural en unidades del juego: se reajustó de 0,8 a 0,6 al corregir
  // la altura de escala (12 → 8,5 km) para que el ascenso a fondo siga rompiendo la nave.
  const DRAG = 0.04, Q_LIMIT = 0.6, STRESS_RATE = 25;

  let st = null, cfg = null, mode = 'off', last = 0, firing = false, held = false, raf = 0;
  const stars = [], clouds = [], streaks = [];
  for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * VW, y: Math.random() * VH, r: Math.random() * 1.3 + 0.4 });
  for (let i = 0; i < 12; i++) clouds.push({ x: Math.random() * VW, alt: 1.2 + Math.random() * 11, w: 70 + Math.random() * 120 });
  for (let i = 0; i < 26; i++) streaks.push({ x: Math.random() * VW, y: Math.random() * VH, l: 8 + Math.random() * 22 });

  const fresh = () => ({ h: 0, v: 0, q: 0, fuel: 100, energy: 100, stress: 0, t: -10, maxH: 0, out: 0, done: false });

  // ---------- Holograma del parabrisas ----------
  const holo = $('#holo'), hBody = $('#holo-body'), hFoot = $('#holo-foot');
  const btn = (id, label, extra) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm"' + (extra || '') + '>' + label + '</button></div>';
  const click = (id, fn) => { $(id).onclick = () => { A.beep(440, 0.1); fn(); }; };
  function showHolo(who, sub) {
    $('#holo-who').textContent = who; $('#holo-sub').textContent = sub;
    hBody.scrollTop = 0; holo.classList.remove('hidden'); holo.classList.add('flex');
  }
  function hideHolo() { holo.classList.add('hidden'); holo.classList.remove('flex'); }

  const K = (k) => A.key(k);
  function pageCheck() {
    const k = cfg, done = { mass: false, cost: false };
    showHolo('FASE 1 · VERIFICACIÓN', 'Comprueba antes de despegar');
    hBody.innerHTML =
      '<div class="ux-hero">Dos comprobaciones y despegas.</div>' +
      '<div class="ux-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="uxc" id="c-mass"><small>Carga · ' + k.launcher.name + '</small><b>¿' + k.mass + ' t caben en ' + k.cap + ' t?</b><div class="mt-3">' + btn('v-mass', 'Verificar carga') + '</div></div>' +
      '<div class="uxc" id="c-cost"><small>Presupuesto</small><b>¿' + k.cost + ' M$ de ' + k.budget + ' M$?</b><div class="mt-3">' + btn('v-cost', 'Verificar presupuesto') + '</div></div></div>';
    hFoot.innerHTML = btn('b-back', '◀ Atrás') + btn('b-go', 'Autorizar lanzamiento ▶', ' disabled');
    const mark = (id, good, txt) => { const el = $(id); el.classList.add(good ? 'good' : 'bad'); el.querySelector('b').textContent = (good ? '✓ ' : '✗ ') + txt; el.querySelector('.mt-3').remove(); };
    const refresh = () => {
      if (!(done.mass && done.cost)) return;
      if (k.massOk && k.costOk) $('#b-go').disabled = false;
      else A.mission.report(
        '<div class="ux-big bad">✗ LANZAMIENTO CANCELADO</div>' +
        '<div class="ux-grid" style="grid-template-columns:repeat(3,1fr)">' +
        '<div class="uxc' + (k.massOk ? '' : ' bad') + '"><small>Masa</small><b>' + k.mass + ' t</b></div>' +
        '<div class="uxc"><small>Capacidad</small><b>' + k.cap + ' t</b></div>' +
        '<div class="uxc' + (k.costOk ? '' : ' bad') + '"><small>Presupuesto</small><b>' + k.cost + ' / ' + k.budget + ' M$</b></div></div>' +
        '<p class="ux-tip">Aligera la nave o elige un lanzador más grande.</p>',
        [{ l: 'Ajustar la nave', fn: () => { stopLoop(); A.startShip('config'); } }, { l: 'Cambiar de cohete', fn: () => { stopLoop(); A.show('menu'); A.actions.custom(); } }]);
    };
    click('#v-mass', () => { done.mass = true; mark('#c-mass', k.massOk, k.massOk ? 'Carga OK · sobran ' + (k.cap - k.mass) + ' t' : 'Exceso: ' + (k.mass - k.cap) + ' t de más'); refresh(); });
    click('#v-cost', () => { done.cost = true; mark('#c-cost', k.costOk, k.costOk ? 'Presupuesto OK · sobran ' + (k.budget - k.cost) + ' M$' : 'Faltan ' + (k.cost - k.budget) + ' M$'); refresh(); });
    click('#b-back', () => { stopLoop(); A.show('brief'); A.mission.telemetry(); });
    click('#b-go', pageConfirm);
  }

  function pageConfirm() {
    showHolo('CONTROL DE MISIÓN', 'Listo para despegar');
    hBody.innerHTML =
      '<div class="ok">✓ Lanzador &nbsp; ✓ Carga &nbsp; ✓ Trayectoria</div>' +
      '<div class="ux-hero">Meta: <b>7,8 km/s</b> por encima de <b>100 km</b>.</div>' +
      '<div class="ux-ctrl">' +
      '<div>' + K('ESPACIO') + 'Mantén para encender los motores</div>' +
      '<div><span class="ic">⚠</span>¿Presión por encima de 100 %? Suelta un momento</div>' +
      '<div><span class="ic" style="color:#7fdcff">⛽</span>El combustible no sobra: no te quedes parado</div></div>';
    hFoot.innerHTML = btn('b-back', '◀ Atrás') + btn('b-go', 'Iniciar cuenta atrás ▶');
    click('#b-back', pageCheck);
    click('#b-go', () => A.startLaunch(cfg));
  }

  // ---------- Entradas ----------
  A.startCockpit = function (config) {
    cfg = config; st = fresh(); mode = 'check'; held = false; firing = false;
    resetOverlay(); setFire('BLOQUEADO', false);
    A.show('launch'); pageCheck(); startLoop();
  };

  A.startLaunch = function (config) {
    cfg = config || cfg; st = fresh(); mode = 'launch'; held = false; lastTick = 99; A.run.tries = (A.run.tries || 0) + 1;
    resetOverlay(); hideHolo(); setFire('EN ESPERA', false);
    msg('CUENTA ATRÁS');
    A.show('launch'); startLoop();
  };

  function resetOverlay() {
    const cnt = $('#l-count'); cnt.style.fontSize = ''; cnt.style.top = ''; cnt.textContent = '';
    $('#launch-end').classList.add('hidden'); $('#launch-end').classList.remove('flex');
    $('#cockpit').style.transform = ''; $('#heat').style.opacity = 0;
    $('#l-clock').textContent = 'T - 10'; $('#edl-card').classList.add('hidden');
    const L = { 'cam-lbl': 'CÁM. EXTERIOR · AEON-01', 'ml-t': 'FASE 1 · ASCENSO', 'ml-a': 'ALTITUD', 'ml-au': 'km', 'ml-b': 'VELOCIDAD', 'ml-bu': '/7.8 km/s', 'mr-t': 'ESTRUCTURA', 'mr-a': 'PRESIÓN DIN.', 'mr-au': '%', 'mr-b': 'INTEGRIDAD', 'l-fire-lbl': 'IMPULSORES' };
    Object.keys(L).forEach((k) => { $('#' + k).textContent = L[k]; });
    msg('');
  }
  function setFire(txt, ready) { $('#l-fire-txt').textContent = txt; $('#l-fire').classList.toggle('ready', !!ready); }
  function msg(t) {
    $('#l-msg').textContent = t; $('#l-msg-box').classList.toggle('hot', /^¡/.test(t));
    $('#l-msg-box').classList.toggle('hidden', !t); $('#l-msg-box').classList.toggle('flex', !!t);
  }

  function end(ok, title, text) {
    st.done = true; mode = 'end'; held = false; firing = false;
    msg('');
    $('#cockpit').style.transform = '';
    setFire(ok ? 'APAGADO' : 'FALLO', false);
    $('#le-title').textContent = title; $('#le-text').innerHTML = text;
    const b = (id, l) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm">' + l + '</button></div>';
    $('#le-btns').innerHTML = ok ? b('le-menu', 'Menú') + b('le-next', 'Ir a la nave ▶')
                                 : b('le-menu', 'Menú') + b('le-retry', 'Reintentar ▶');
    $('#le-menu').onclick = () => { stopLoop(); A.show('menu'); };
    if (ok) $('#le-next').onclick = () => { stopLoop(); A.startShip('config'); };
    else $('#le-retry').onclick = () => A.startLaunch(cfg);
    $('#launch-end').classList.remove('hidden'); $('#launch-end').classList.add('flex');
    if (A.fx) A.fx.event(ok ? 'success' : /SUBORBITAL/.test(title) ? 'fault' : 'crash');
    else A.beep(ok ? 880 : 160, 0.5);
  }

  // ---------- Simulación ----------
  let lastTick = 99;
  function update(dt) {
    st.t += dt;
    const cnt = $('#l-count');
    if (st.t < 0) {                                  // cuenta atrás
      const n = Math.ceil(-st.t);
      if (n !== lastTick) { lastTick = n; A.beep(n <= 3 ? 660 : 440, 0.12); }
      cnt.textContent = n; $('#l-clock').textContent = 'T - ' + String(n).padStart(2, '0');
      firing = false; return;
    }
    if (st.t < 2.5 && st.h < 0.5) { cnt.textContent = '¡DESPEGUE!'; cnt.style.fontSize = '54px'; cnt.style.top = '290px'; }
    else cnt.textContent = '';
    if (lastTick !== 0) { lastTick = 0; A.beep(990, 0.4); msg('MANTÉN ESPACIO · MOTORES'); }
    $('#l-clock').textContent = 'T + ' + String(Math.floor(st.t)).padStart(3, '0') + ' s';

    firing = held && st.fuel > 0;
    const rho = Math.exp(-st.h / H_SCALE);
    const q = rho * st.v * st.v / Q_LIMIT;
    const g = (st.h > 0 || firing) ? GRAV * (1 - Math.pow(Math.min(1, st.v / V_ORBIT), 2)) : 0;
    st.v += ((firing ? cfg.thrust : 0) - g - DRAG * rho * st.v * Math.abs(st.v)) * dt;
    st.h += st.v * dt;
    if (st.h <= 0) { st.h = 0; if (st.v < 0) st.v = 0; }
    st.maxH = Math.max(st.maxH, st.h);
    if (firing) st.fuel = Math.max(0, st.fuel - BURN * dt);
    // energía: aviónica y bombas de los motores (informativo en esta fase)
    const solar = cfg.kw >= 24;
    st.energy = Math.max(0, st.energy - ((firing ? 0.3 : 0.12) * (solar ? 0.6 : 1)) * dt);
    st.q = q;
    if (q > 1) st.stress += (q - 1) * STRESS_RATE * dt;
    else if (q < 0.8) st.stress = Math.max(0, st.stress - 2 * dt);
    setFire(st.fuel <= 0 ? 'SIN COMBUST.' : firing ? 'ENCENDIDOS' : 'LISTO', st.fuel > 0 && !firing);

    if (q > 1) msg('¡MAX-Q! SUELTA EL EMPUJE');
    else if (st.fuel <= 0) msg('¡SIN COMBUSTIBLE!');
    else if (st.fuel < 15) msg('¡COMBUSTIBLE BAJO!');
    else if (st.h >= H_SPACE && st.v < V_ORBIT) msg('EN EL ESPACIO · ACELERA A 7,8 km/s');
    else if (st.h > 45) msg('AIRE TENUE · EMPUJE A FONDO');
    else if (st.h > 0.2) msg('ASCENSO · VIGILA LA PRESIÓN');

    if (st.stress >= 100) return end(false, '✗ FALLO ESTRUCTURAL',
      'Demasiada presión a ' + st.h.toFixed(0) + ' km.<br><span class="text-sky-300">Suelta el empuje en el aire denso.</span>');
    if (st.v >= V_ORBIT && st.h >= H_SPACE) return end(true, '✓ EN ÓRBITA',
      '<span class="font-display text-2xl tracking-wider text-white">Fase 1 superada</span><br>' +
      '<span class="text-sky-300 text-lg">Combustible ' + st.fuel.toFixed(0) + ' % · Energía ' + st.energy.toFixed(0) + ' % · Integridad ' + (100 - st.stress).toFixed(0) + ' %</span>');
    if (st.maxH > 1 && st.h <= 0) return end(false, '✗ MISIÓN ABORTADA', 'La nave cayó.<br><span class="text-sky-300">Sin empuje, la gravedad gana.</span>');
    if (st.fuel <= 0) {
      st.out += dt;
      if (st.out > 2.5) return end(false, '✗ TRAYECTORIA SUBORBITAL',
        'Sin combustible a ' + st.v.toFixed(1) + ' km/s (meta 7,8).<br><span class="text-sky-300">No pierdas tiempo sin empuje.</span>');
    }
  }

  // ---------- Monitor central: cámara exterior que sigue al cohete ----------
  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  function drawView(dt, now) {
    const h = st.h, rho = Math.exp(-h / H_SCALE), sky = Math.min(1, h / 70);
    const RX = VW / 2, RY = 104;                     // posición del cohete en pantalla
    const g = c.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, 'rgb(' + mix(40, 1, sky) + ',' + mix(120, 3, sky) + ',' + mix(230, 10, sky) + ')');
    g.addColorStop(1, 'rgb(' + mix(150, 2, sky) + ',' + mix(205, 8, sky) + ',' + mix(255, 24, sky) + ')');
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    const sa = Math.max(0, Math.min(1, (h - 25) / 45));
    if (sa > 0) for (const s of stars) { c.fillStyle = 'rgba(225,238,255,' + sa * (0.4 + s.r / 2.4) + ')'; c.fillRect(s.x, s.y, s.r, s.r); }
    // curvatura de la Tierra
    if (h > 40) {
      const up = Math.min(1, (h - 40) / 90), ey = VH + 30 - up * 70;
      const eg = c.createLinearGradient(0, ey - 10, 0, VH);
      eg.addColorStop(0, '#7cc4ff'); eg.addColorStop(0.15, '#1a62c0'); eg.addColorStop(1, '#062258');
      c.fillStyle = eg; c.beginPath(); c.arc(RX, ey + 900, 900, 0, 7); c.fill();
    }
    // nubes
    for (const cl of clouds) {
      const y = RY + (h - cl.alt) * 70;
      if (y < -30 || y > VH + 30) continue;
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.ellipse(cl.x, y, cl.w / 2, cl.w / 8, 0, 0, 7); c.ellipse(cl.x + cl.w / 5, y - cl.w / 12, cl.w / 3, cl.w / 9, 0, 0, 7); c.fill();
    }
    // suelo y torre de lanzamiento
    const gy = RY + 66 + h * 160;
    if (gy < VH + 10) {
      c.fillStyle = '#2f4a2a'; c.fillRect(0, gy, VW, VH);
      c.fillStyle = '#6b6f75'; c.fillRect(RX - 60, gy - 4, 120, 6);
      c.fillStyle = '#9a3b2a'; c.fillRect(RX - 34, gy - 120, 8, 116);
      c.strokeStyle = '#9a3b2a'; c.lineWidth = 2;
      for (let y = gy - 116; y < gy - 6; y += 12) { c.beginPath(); c.moveTo(RX - 34, y); c.lineTo(RX - 26, y + 12); c.stroke(); }
      c.fillRect(RX - 34, gy - 92, 22, 3);
    }
    // estelas de aire
    const al = Math.min(0.5, rho * st.v * 0.5);
    if (al > 0.01) {
      c.strokeStyle = 'rgba(255,255,255,' + al + ')'; c.lineWidth = 1.2;
      for (const s of streaks) {
        s.y += st.v * 300 * dt; if (s.y > VH) { s.y = -s.l; s.x = Math.random() * VW; }
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x, s.y + s.l * Math.min(2, st.v)); c.stroke();
      }
    }
    // llama: más ancha cuanto menos aire hay
    if (firing) {
      const len = 34 + Math.random() * 14 + (1 - rho) * 20, wid = 6 + (1 - rho) * 14;
      const fg = c.createLinearGradient(0, RY + 50, 0, RY + 50 + len);
      fg.addColorStop(0, 'rgba(255,255,230,1)'); fg.addColorStop(0.3, 'rgba(255,180,60,.95)'); fg.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = fg; c.beginPath();
      c.moveTo(RX - 6, RY + 50); c.quadraticCurveTo(RX - wid, RY + 50 + len * 0.5, RX, RY + 50 + len);
      c.quadraticCurveTo(RX + wid, RY + 50 + len * 0.5, RX + 6, RY + 50); c.fill();
      if (h < 0.6) { c.fillStyle = 'rgba(235,235,235,.55)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(RX + (Math.random() - 0.5) * 120, gy - 6 - Math.random() * 14, 10 + Math.random() * 12, 0, 7); c.fill(); } }
    } else if (mode === 'launch' && st.t > -3 && st.t < 0) {
      c.fillStyle = 'rgba(235,235,235,.45)';                       // vapor previo a la ignición
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(RX + (Math.random() - 0.5) * 70, gy - 8, 8 + Math.random() * 8, 0, 7); c.fill(); }
    }
    // plasma en la punta con presión dinámica alta
    if (st.q > 0.6) {
      const pg = c.createRadialGradient(RX, RY - 46, 2, RX, RY - 46, 26);
      pg.addColorStop(0, 'rgba(255,170,80,' + Math.min(0.9, st.q - 0.5) + ')'); pg.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = pg; c.beginPath(); c.arc(RX, RY - 46, 26, 0, 7); c.fill();
    }
    // cohete elegido en Personalizar, con su color
    A.rockets.draw(c, A.settings.launcher, RX, RY + 53, 112, { paint: A.settings.paint });
    // marco de cámara y piloto de grabación
    c.strokeStyle = 'rgba(127,220,255,.5)'; c.lineWidth = 1;
    c.strokeRect(6, 22, VW - 12, VH - 28);
    if (Math.floor(now / 500) % 2 && mode === 'launch' && st.t >= 0) { c.fillStyle = '#ff3c3c'; c.beginPath(); c.arc(VW - 16, 34, 4, 0, 7); c.fill(); }
  }

  function drawPanels() {
    const q = (st.q || 0) * 100;
    $('#l-alt').textContent = st.h.toFixed(st.h < 10 ? 1 : 0);
    $('#l-vel').textContent = st.v.toFixed(1);
    $('#l-q').textContent = q.toFixed(0);
    $('#l-hull').textContent = Math.max(0, 100 - st.stress).toFixed(0);
    $('#l-fuel').textContent = st.fuel.toFixed(0) + '%';
    $('#l-energy').textContent = st.energy.toFixed(0) + '%';
    $('#lb-alt').style.width = Math.min(100, st.h / H_SPACE * 100) + '%';
    $('#lb-vel').style.width = Math.min(100, st.v / V_ORBIT * 100) + '%';
    $('#lb-q').style.width = Math.min(100, q / 1.5) + '%';
    $('#lb-q').classList.toggle('danger', q > 100);
    $('#lb-hull').style.width = Math.max(0, 100 - st.stress) + '%';
    $('#lb-hull').classList.toggle('danger', st.stress > 50);
    $('#lb-fuel').style.width = st.fuel + '%';
    $('#lb-fuel').classList.toggle('danger', st.fuel < 15);
    $('#lb-energy').style.width = st.energy + '%';
    $('#lb-energy').classList.toggle('danger', st.energy < 20);
    $('#l-fire').classList.toggle('is-held', firing);
    // la vibración de la cabina la aplica js/fx.js (proporcional al empuje y a la densidad del aire)
    $('#heat').style.opacity = st.q > 0.6 ? Math.min(0.18, (st.q - 0.6) * 0.25) : 0;
  }

  function loop(now) {
    raf = 0;
    if (mode === 'off' || $('#screen-launch').classList.contains('hidden')) { mode = 'off'; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'launch' && !A.paused) update(dt);
    A.sky.draw(st, firing, mode, dt, now);
    drawView(dt, now); drawPanels();
    if (mode !== 'off') raf = requestAnimationFrame(loop);
  }
  function startLoop() { last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }
  function stopLoop() { mode = 'off'; held = false; firing = false; }

  // ---------- Telemetría para la cámara exterior (js/exterior.js, issue #9) ----------
  (A.flight = A.flight || {}).launch = () => (mode !== 'launch' || !st || $('#screen-launch').classList.contains('hidden')) ? null : {
    kind: 'launch', t: st.t, h: st.h, v: st.v, q: st.q || 0, fuel: st.fuel, thrust: firing ? 1 : 0,
    rocket: A.settings.launcher, msg: $('#l-msg').textContent,
    alerts: [st.q > 1 && '¡MAX-Q! ' + (st.q * 100).toFixed(0) + ' %',
      st.stress > 50 && '¡ESTRUCTURA DAÑADA! ' + Math.max(0, 100 - st.stress).toFixed(0) + ' %',
      st.fuel < 15 && (st.fuel <= 0 ? '¡SIN COMBUSTIBLE!' : '¡COMBUSTIBLE BAJO!'),
      st.energy < 20 && '¡ENERGÍA BAJA! ' + st.energy.toFixed(0) + ' %'].filter(Boolean)
  };

  // ---------- Controles ----------
  const isFireKey = (e) => e.code === 'Space' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp';
  window.addEventListener('keydown', (e) => {
    if (mode !== 'launch') return;
    if (isFireKey(e)) { held = true; e.preventDefault(); }
    if (e.key === 'Escape' && !e.repeat) A.togglePause();
  });
  window.addEventListener('keyup', (e) => { if (isFireKey(e)) held = false; });
  const fb = $('#l-fire');
  fb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (mode === 'launch') held = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => fb.addEventListener(t, () => { held = false; }));
  fb.addEventListener('keydown', (e) => { if (e.code === 'Space') e.preventDefault(); });
})();
