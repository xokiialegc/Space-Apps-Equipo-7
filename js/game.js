/* AEON-01 — prototipo de vuelo en primera persona (Tierra → Marte)
   Regla física simple: solo se gasta combustible al cambiar de velocidad (acelerar o frenar);
   en el vacío la nave mantiene su velocidad sin consumir nada. */
(function () {
  'use strict';
  const A = window.AEON, W = A.W, H = A.H;
  const $ = (s) => document.querySelector(s);
  const cv = $('#flight'), c = cv.getContext('2d');
  const CX = 800, CY = 385;                 // centro de la ventana de cabina

  const TOTAL = 225;        // millones de km
  const TRIP_SECONDS = 60;  // duración del viaje a velocidad máxima
  const MAX_KMS = 30;       // velocidad mostrada a potencia máxima
  const ACCEL = 0.25;       // cambio de velocidad por segundo
  const BURN = 42;          // % de combustible por unidad de cambio de velocidad
  const SAFE_V = 0.35;      // velocidad máxima para entrar en órbita

  let st = null, running = false, last = 0, saveT = 0;
  const keys = { up: false, down: false };
  const stars = [];
  for (let i = 0; i < 420; i++) stars.push(newStar(true));
  function newStar(any) {
    return { x: (Math.random() - 0.5) * 2400, y: (Math.random() - 0.5) * 1500, z: any ? Math.random() * 1000 + 1 : 1000 };
  }

  function fresh() { return { dist: TOTAL, v: 0, fuel: 100, t: 0, done: false }; }

  A.startFlight = function (save) {
    st = save && !save.done ? Object.assign(fresh(), save) : fresh();
    $('#flight-end').classList.add('hidden'); $('#flight-end').classList.remove('flex');
    msg(st.t ? 'Misión reanudada.' : 'Mantén W para acelerar. Guarda combustible para frenar al llegar.');
    A.audio(); A.show('flight');
    running = true; last = performance.now(); requestAnimationFrame(loop);
  };

  let msgUntil = 0;
  function msg(text, secs) { $('#hud-msg').textContent = text; msgUntil = performance.now() + (secs || 6) * 1000; }

  function stop(toMenu) {
    running = false; keys.up = keys.down = false;
    if (st && !st.done) A.store.set('aeon01.save', st);
    if (toMenu) A.show('menu');
  }

  function finish(ok, title, text) {
    st.done = true; running = false; A.store.del('aeon01.save');
    $('#end-title').textContent = title; $('#end-text').textContent = text;
    $('#flight-end').classList.remove('hidden'); $('#flight-end').classList.add('flex');
    A.beep(ok ? 880 : 160, 0.5);
  }

  function update(dt) {
    let dv = 0;
    if (keys.up && st.fuel > 0) dv = Math.min(ACCEL * dt, 1 - st.v);
    else if (keys.down && st.fuel > 0) dv = -Math.min(ACCEL * dt, st.v);
    if (dv) { st.v += dv; st.fuel = Math.max(0, st.fuel - Math.abs(dv) * BURN); }

    st.dist -= st.v * (TOTAL / TRIP_SECONDS) * dt;
    st.t += dt * (st.v > 0 ? 1 : 0.2);

    if (performance.now() > msgUntil) {
      if (st.fuel <= 0) msg('Combustible agotado: la nave sigue por inercia.', 3);
      else if (st.dist < 45 && st.v > SAFE_V) msg('¡Frena! Velocidad demasiado alta para entrar en órbita.', 2);
      else if (st.v === 0 && st.dist < TOTAL) msg('Nave detenida. Usa W para continuar.', 2);
      else $('#hud-msg').textContent = '';
    }

    if (st.dist <= 0) {
      st.dist = 0;
      if (st.v <= SAFE_V) finish(true, 'ÓRBITA DE MARTE', 'Inserción orbital correcta con ' + st.fuel.toFixed(0) + ' % de combustible. ¡Misión cumplida!');
      else finish(false, 'SOBREVUELO', 'Llegaste a ' + (st.v * MAX_KMS).toFixed(1) + ' km/s: demasiado rápido para que Marte capture la nave.');
    } else if (st.fuel <= 0 && st.v < 0.001) {
      finish(false, 'A LA DERIVA', 'Sin combustible y sin velocidad a ' + st.dist.toFixed(1) + ' millones de km de Marte.');
    }
  }

  function draw() {
    c.fillStyle = '#01030a'; c.fillRect(0, 0, W, H);
    // estrellas en perspectiva
    const sp = 0.6 + st.v * 14;
    for (const s of stars) {
      s.z -= sp;
      if (s.z < 1) Object.assign(s, newStar(false));
      const k = 520 / s.z, x = CX + s.x * k, y = CY + s.y * k;
      if (x < 0 || x > W || y < 0 || y > H) { if (s.z < 400) Object.assign(s, newStar(false)); continue; }
      const b = Math.min(1, 1.2 - s.z / 1000);
      c.strokeStyle = 'rgba(210,230,255,' + b + ')'; c.lineWidth = Math.min(2.4, k * 0.9 + 0.4);
      const tail = 1 + st.v * 0.05 * k * 6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - (x - CX) * 0.01 * tail, y - (y - CY) * 0.01 * tail - 0.6); c.stroke();
    }
    // Marte, cada vez más cerca
    const p = 1 - st.dist / TOTAL, r = 7 + Math.pow(p, 3.2) * 300;
    const g = c.createRadialGradient(CX - r * 0.35, CY - r * 0.35, r * 0.05, CX, CY, r);
    g.addColorStop(0, '#ffb07a'); g.addColorStop(0.55, '#c8502a'); g.addColorStop(1, '#3a1208');
    c.save(); c.shadowColor = 'rgba(255,120,60,.6)'; c.shadowBlur = 10 + r * 0.15;
    c.fillStyle = g; c.beginPath(); c.arc(CX, CY, r, 0, 7); c.fill(); c.restore();
    if (r > 26) {
      c.save(); c.beginPath(); c.arc(CX, CY, r, 0, 7); c.clip();
      c.fillStyle = 'rgba(90,30,15,.35)';
      [[-0.3, 0.1, 0.34, 0.14], [0.25, -0.2, 0.26, 0.1], [0.1, 0.42, 0.4, 0.12], [-0.45, -0.35, 0.18, 0.08]].forEach((m) => {
        c.beginPath(); c.ellipse(CX + m[0] * r, CY + m[1] * r, m[2] * r, m[3] * r, 0.3, 0, 7); c.fill();
      });
      c.fillStyle = 'rgba(255,245,235,.8)';
      c.beginPath(); c.ellipse(CX, CY - r * 0.95, r * 0.35, r * 0.09, 0, 0, 7); c.fill();
      c.restore();
    }
    // HUD
    $('#hud-dist').textContent = st.dist.toFixed(1);
    $('#hud-vel').textContent = (st.v * MAX_KMS).toFixed(1);
    $('#hud-fuel').textContent = st.fuel.toFixed(0);
    $('#hud-day').textContent = 'DÍA ' + String(Math.floor(st.t * 3.5)).padStart(3, '0');
    $('#bar-dist').style.width = (p * 100) + '%';
    $('#bar-vel').style.width = (st.v * 100) + '%';
    $('#bar-fuel').style.width = st.fuel + '%';
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    saveT += dt; if (saveT > 3 && !st.done) { saveT = 0; A.store.set('aeon01.save', st); }
    if (running) requestAnimationFrame(loop);
  }

  // ---------- Controles ----------
  const active = () => running && !$('#screen-flight').classList.contains('hidden');
  window.addEventListener('keydown', (e) => {
    if (!active()) return;
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { keys.up = true; e.preventDefault(); }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { keys.down = true; e.preventDefault(); }
    if (e.key === 'Escape') stop(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.up = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.down = false;
  });
  function hold(el, k) {
    const on = (e) => { e.preventDefault(); keys[k] = true; el.classList.add('is-held'); };
    const off = () => { keys[k] = false; el.classList.remove('is-held'); };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, off));
  }
  hold($('#btn-thrust'), 'up'); hold($('#btn-brake'), 'down');
  $('#btn-menu').addEventListener('click', () => { A.beep(330, 0.1); stop(true); });
  $('#end-menu').addEventListener('click', () => A.show('menu'));
  $('#end-retry').addEventListener('click', () => A.startFlight(null));
  document.addEventListener('visibilitychange', () => { if (document.hidden && st && running && !st.done) A.store.set('aeon01.save', st); });
})();
