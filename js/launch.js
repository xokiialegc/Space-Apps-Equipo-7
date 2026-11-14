/* AEON-01 — Fase 1: despegue en primera persona desde la cabina.
   Modelo simplificado (unidades de juego):
   - Empuje constante mientras se mantienen los impulsores; el combustible baja en tiempo real.
   - Densidad del aire: rho = e^(-h/12). Presión dinámica Q = rho·v². Por encima del límite
     la estructura acumula daño: hay que modular el empuje en la atmósfera densa.
   - La gravedad frena la nave mientras no alcanza la velocidad orbital (7,8 km/s). */
(function () {
  'use strict';
  const A = window.AEON, W = A.W, H = A.H;
  const $ = (s) => document.querySelector(s);
  const cv = $('#launch'), c = cv.getContext('2d');
  const CX = 800, CY = 385;

  const V_ORBIT = 7.8, H_SPACE = 100;
  const BURN = 2.3;       // % de combustible por segundo de impulso
  const GRAV = 0.08, DRAG = 0.04, Q_LIMIT = 0.8, STRESS_RATE = 25;

  // el marco de cabina es el mismo que el del vuelo interplanetario
  $('#launch-frame').innerHTML = $('#cockpit-frame').outerHTML.replace('id="cockpit-frame"', '').replace(/id="dash"/, 'id="dash2"').replace('url(#dash)', 'url(#dash2)');

  let st = null, cfg = null, running = false, last = 0, firing = false, held = false;
  const stars = [], clouds = [], streaks = [];
  for (let i = 0; i < 260; i++) stars.push({ x: Math.random() * W, y: Math.random() * 720, r: Math.random() * 1.4 + 0.3 });
  for (let i = 0; i < 14; i++) clouds.push({ x: 150 + Math.random() * 1300, alt: 1.5 + Math.random() * 11, w: 180 + Math.random() * 320 });
  for (let i = 0; i < 70; i++) streaks.push({ x: Math.random() * W, y: Math.random() * 720, l: 20 + Math.random() * 60 });

  A.startLaunch = function (config) {
    cfg = config;
    st = { h: 0, v: 0, fuel: 100, stress: 0, t: -10, maxH: 0, out: 0, done: false };
    held = false; lastTick = 99;
    const cnt = $('#l-count'); cnt.style.fontSize = ''; cnt.style.top = ''; cnt.textContent = '';
    $('#launch-end').classList.add('hidden'); $('#launch-end').classList.remove('flex');
    msg('Secuencia de lanzamiento iniciada.');
    A.show('launch'); running = true; last = performance.now(); requestAnimationFrame(loop);
  };

  function msg(t) { $('#l-msg').textContent = t; }

  function end(ok, title, text) {
    st.done = true; running = false; held = false;
    $('#le-title').textContent = title; $('#le-text').innerHTML = text;
    const b = (id, l) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm">' + l + '</button></div>';
    $('#le-btns').innerHTML = ok ? b('le-menu', 'Menú principal') + b('le-next', 'Segmento espacial →')
                                 : b('le-menu', 'Menú principal') + b('le-retry', 'Repetir lanzamiento');
    $('#le-menu').onclick = () => A.show('menu');
    if (ok) $('#le-next').onclick = () => A.startFlight(null);
    else $('#le-retry').onclick = () => A.startLaunch(cfg);
    $('#launch-end').classList.remove('hidden'); $('#launch-end').classList.add('flex');
    A.beep(ok ? 880 : 160, 0.5);
  }

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
    if (st.t < 2.5 && st.h < 0.5) { cnt.textContent = '¡DESPEGUE AUTORIZADO!'; cnt.style.fontSize = '64px'; cnt.style.top = '300px'; }
    else cnt.textContent = '';
    if (lastTick !== 0) { lastTick = 0; A.beep(990, 0.4); msg('Mantén ESPACIO para encender los impulsores.'); }
    $('#l-clock').textContent = 'T + ' + String(Math.floor(st.t)).padStart(3, '0') + ' s';

    firing = held && st.fuel > 0;
    const rho = Math.exp(-st.h / 12);
    const q = rho * st.v * st.v / Q_LIMIT;
    const g = (st.h > 0 || firing) ? GRAV * (1 - Math.pow(Math.min(1, st.v / V_ORBIT), 2)) : 0;
    st.v += ((firing ? cfg.thrust : 0) - g - DRAG * rho * st.v * Math.abs(st.v)) * dt;
    st.h += st.v * dt;
    if (st.h <= 0) { st.h = 0; if (st.v < 0) st.v = 0; }
    st.maxH = Math.max(st.maxH, st.h);
    if (firing) st.fuel = Math.max(0, st.fuel - BURN * dt);
    st.q = q;
    if (q > 1) st.stress += (q - 1) * STRESS_RATE * dt;
    else if (q < 0.8) st.stress = Math.max(0, st.stress - 2 * dt);

    if (q > 1) msg('⚠ Presión dinámica excesiva: reduce el impulso.');
    else if (st.fuel <= 0) msg('Combustible agotado.');
    else if (st.h >= H_SPACE && st.v < V_ORBIT) msg('Fuera de la atmósfera. Acelera hasta 7,8 km/s.');
    else if (st.h > 45) msg('Aire tenue: impulso a fondo.');
    else if (st.h > 0.2) msg('Ascenso. Vigila la presión dinámica.');

    if (st.stress >= 100) return end(false, 'FALLO ESTRUCTURAL',
      'La presión dinámica superó lo que el vehículo podía soportar a ' + st.h.toFixed(0) + ' km de altitud. En la atmósfera densa hay que modular el empuje.');
    if (st.v >= V_ORBIT && st.h >= H_SPACE) return end(true, 'LANZAMIENTO EXITOSO',
      '<b>Inserción orbital completada.</b><br>La nave ha alcanzado la órbita terrestre prevista. El vehículo de lanzamiento ha cumplido su función.<br><br>' +
      'Cadete, hemos superado el primer segmento.<br>Ahora comienza tu responsabilidad como operador de la nave.<br>' +
      '<span class="text-sky-300 text-lg">Combustible restante: ' + st.fuel.toFixed(0) + ' % · Integridad: ' + (100 - st.stress).toFixed(0) + ' %</span>');
    if (st.maxH > 1 && st.h <= 0) return end(false, 'MISIÓN ABORTADA', 'La nave perdió velocidad y regresó a la superficie. Sin empuje, la gravedad siempre gana.');
    if (st.fuel <= 0) {
      st.out += dt;
      if (st.out > 2.5) return end(false, 'TRAYECTORIA SUBORBITAL',
        'El combustible se agotó a ' + st.v.toFixed(1) + ' km/s, por debajo de los 7,8 km/s necesarios para mantenerse en órbita. Cada segundo sin empuje dentro de la gravedad terrestre cuesta propelente.');
    }
  }

  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  function draw(dt) {
    const h = st.h, rho = Math.exp(-h / 12), sky = Math.min(1, h / 70);
    c.save();
    if (firing) c.translate((Math.random() - 0.5) * 5 * (0.4 + rho), (Math.random() - 0.5) * 5 * (0.4 + rho));
    // cielo: de azul diurno a negro espacial
    const g = c.createLinearGradient(0, 60, 0, 720);
    g.addColorStop(0, 'rgb(' + mix(40, 1, sky) + ',' + mix(120, 3, sky) + ',' + mix(230, 10, sky) + ')');
    g.addColorStop(1, 'rgb(' + mix(150, 2, sky) + ',' + mix(205, 8, sky) + ',' + mix(255, 24, sky) + ')');
    c.fillStyle = g; c.fillRect(-10, -10, W + 20, H + 20);
    // estrellas
    const sa = Math.max(0, Math.min(1, (h - 25) / 45));
    if (sa > 0) for (const s of stars) { c.fillStyle = 'rgba(225,238,255,' + sa * (0.4 + s.r / 2.4) + ')'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }
    // nubes que quedan atrás
    for (const cl of clouds) {
      const y = CY + (h - cl.alt) * 190;
      if (y < -80 || y > 800) continue;
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.ellipse(cl.x, y, cl.w / 2, cl.w / 9, 0, 0, 7); c.ellipse(cl.x + cl.w / 5, y - cl.w / 14, cl.w / 3, cl.w / 10, 0, 0, 7); c.fill();
    }
    // estelas de velocidad en el aire
    const al = Math.min(0.5, rho * st.v * 0.5);
    if (al > 0.01) {
      c.strokeStyle = 'rgba(255,255,255,' + al + ')'; c.lineWidth = 1.5;
      for (const s of streaks) {
        s.y += st.v * 900 * dt; if (s.y > 720) { s.y = 60; s.x = Math.random() * W; }
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x, s.y + s.l * Math.min(2, st.v)); c.stroke();
      }
    }
    // curvatura de la Tierra al ganar altura
    if (h > 55) {
      const up = Math.min(1, (h - 55) / 90), ey = 760 - up * 130;
      c.save(); c.shadowColor = 'rgba(90,180,255,.9)'; c.shadowBlur = 40;
      const eg = c.createLinearGradient(0, ey, 0, ey + 200);
      eg.addColorStop(0, '#5fb4ff'); eg.addColorStop(0.15, '#1259b8'); eg.addColorStop(1, '#041a44');
      c.fillStyle = eg; c.beginPath(); c.arc(CX, ey + 2600, 2600, 0, 7); c.fill(); c.restore();
    }
    // resplandor por rozamiento
    if (st.q > 0.6) {
      const a = Math.min(0.55, (st.q - 0.6) * 0.5);
      const pg = c.createRadialGradient(CX, 760, 80, CX, 760, 760);
      pg.addColorStop(0, 'rgba(255,150,60,' + a + ')'); pg.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = pg; c.fillRect(0, 0, W, H);
    }
    c.restore();

    // instrumentos
    const q = (st.q || 0) * 100;
    $('#l-alt').textContent = h.toFixed(h < 10 ? 1 : 0);
    $('#l-vel').textContent = st.v.toFixed(1);
    $('#l-q').textContent = q.toFixed(0);
    $('#l-hull').textContent = Math.max(0, 100 - st.stress).toFixed(0);
    $('#l-fuel').textContent = st.fuel.toFixed(0);
    $('#lb-alt').style.width = Math.min(100, h / H_SPACE * 100) + '%';
    $('#lb-vel').style.width = Math.min(100, st.v / V_ORBIT * 100) + '%';
    $('#lb-q').style.width = Math.min(100, q / 1.5) + '%';
    $('#lb-q').classList.toggle('danger', q > 100);
    $('#lb-hull').style.width = Math.max(0, 100 - st.stress) + '%';
    $('#lb-hull').classList.toggle('danger', st.stress > 50);
    $('#lb-fuel').style.width = st.fuel + '%';
    $('#lb-fuel').classList.toggle('danger', st.fuel < 15);
    $('#l-fire').classList.toggle('is-held', firing);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); if (st) draw(dt);
    if (running) requestAnimationFrame(loop);
  }

  // ---------- Controles ----------
  const isFireKey = (e) => e.code === 'Space' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp';
  window.addEventListener('keydown', (e) => {
    if (!running) return;
    if (isFireKey(e)) { held = true; e.preventDefault(); }
    if (e.key === 'Escape') { running = false; A.show('menu'); }
  });
  window.addEventListener('keyup', (e) => { if (isFireKey(e)) held = false; });
  const fb = $('#l-fire');
  fb.addEventListener('pointerdown', (e) => { e.preventDefault(); held = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => fb.addEventListener(t, () => { held = false; }));
  fb.addEventListener('keydown', (e) => { if (e.code === 'Space') e.preventDefault(); });
})();
