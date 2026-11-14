/* AEON-01 — menú principal: escalado 16:9, fondo espacial, paneles, ajustes y guardado */
(function () {
  'use strict';
  const W = 1600, H = 900;
  const $ = (s) => document.querySelector(s);

  // ---------- Almacenamiento (puede no estar disponible) ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
  };
  const settings = Object.assign(
    { music: 40, sfx: 70, anim: true, accent: '#19b4ff', shipName: 'AEON-01', launcher: 'ares-h', modules: ['lab', 'shield'] },
    store.get('aeon01.settings', {})
  );
  const saveSettings = () => store.set('aeon01.settings', settings);

  // ---------- Escalado del escenario ----------
  const stage = $('#stage');
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();

  // ---------- Sonido (WebAudio, se activa con el primer clic) ----------
  let actx = null, musicGain = null;
  function audio() {
    if (actx) return actx;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = actx.createGain(); musicGain.connect(actx.destination);
      [55, 82.5, 110.4].forEach((f, i) => {           // zumbido ambiental
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.value = 0.05;
        o.connect(g); g.connect(musicGain); o.start();
      });
      applyVolume();
    } catch (e) { actx = null; }
    return actx;
  }
  function applyVolume() { if (musicGain) musicGain.gain.value = settings.music / 100; }
  function beep(freq, dur) {
    const a = audio(); if (!a || !settings.sfx) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06 * settings.sfx / 100, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
    } catch (e) { /* nada */ }
  }

  // ---------- Fondo: estrellas, galaxia y Tierra ----------
  const cv = $('#space'), cx = cv.getContext('2d');
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  const EARTH = { x: 800, y: 3040, r: 2300 };
  const inEarth = (x, y) => Math.hypot(x - EARTH.x, y - EARTH.y) < EARTH.r + 14;
  const twinkles = [];

  (function paintBackground() {
    const c = bg.getContext('2d');
    const g0 = c.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, '#01030a'); g0.addColorStop(1, '#020b1e');
    c.fillStyle = g0; c.fillRect(0, 0, W, H);

    // estrellas fijas
    for (let i = 0; i < 900; i++) {
      const x = rnd() * W, y = rnd() * H, r = rnd() * 1.1 + 0.2;
      c.fillStyle = 'rgba(' + (200 + rnd() * 55 | 0) + ',' + (215 + rnd() * 40 | 0) + ',255,' + (0.3 + rnd() * 0.6) + ')';
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    // galaxia
    c.save(); c.translate(1010, 300); c.rotate(-0.42); c.scale(1, 0.34);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, 430);
    gg.addColorStop(0, 'rgba(235,240,255,.95)'); gg.addColorStop(0.08, 'rgba(150,190,255,.55)');
    gg.addColorStop(0.35, 'rgba(60,110,255,.22)'); gg.addColorStop(0.7, 'rgba(90,50,200,.08)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, 430, 0, 7); c.fill();
    for (let i = 0; i < 2600; i++) {                 // brazos espirales
      const t = rnd() * 9, arm = (i % 2) * Math.PI, rad = 18 + t * 44 + gauss() * 26;
      const a = t * 0.75 + arm + gauss() * 0.25;
      c.fillStyle = 'rgba(' + (170 + rnd() * 85 | 0) + ',' + (200 + rnd() * 55 | 0) + ',255,' + (0.15 + rnd() * 0.5) + ')';
      c.fillRect(Math.cos(a) * rad, Math.sin(a) * rad, 1.6, 1.6 / 0.34 * 0.6);
    }
    c.restore();

    // Tierra
    c.save();
    c.shadowColor = 'rgba(70,170,255,.95)'; c.shadowBlur = 55;         // atmósfera
    c.fillStyle = '#0a3a8a'; c.beginPath(); c.arc(EARTH.x, EARTH.y, EARTH.r, 0, 7); c.fill();
    c.restore();
    c.save(); c.beginPath(); c.arc(EARTH.x, EARTH.y, EARTH.r, 0, 7); c.clip();
    const ge = c.createLinearGradient(0, 0, W, 0);                      // luz del Sol desde la derecha
    ge.addColorStop(0, '#020a1f'); ge.addColorStop(0.45, '#0a3f95'); ge.addColorStop(0.85, '#2f8fe6'); ge.addColorStop(1, '#7cc4ff');
    c.fillStyle = ge; c.fillRect(0, 700, W, 220);
    for (let i = 0; i < 26; i++) {                                      // continentes
      const x = rnd() * W, y = 770 + rnd() * 130, lit = x / W;
      c.fillStyle = 'rgba(' + (30 + 60 * lit | 0) + ',' + (90 + 70 * lit | 0) + ',' + (60 + 30 * lit | 0) + ',' + (0.25 + 0.4 * lit) + ')';
      c.beginPath(); c.ellipse(x, y, 40 + rnd() * 130, 8 + rnd() * 22, rnd() - 0.5, 0, 7); c.fill();
    }
    for (let i = 0; i < 150; i++) {                                     // nubes
      const x = rnd() * W, y = 752 + rnd() * 150, lit = 0.15 + 0.85 * x / W;
      c.fillStyle = 'rgba(255,255,255,' + (0.05 + rnd() * 0.16) * lit + ')';
      c.beginPath(); c.ellipse(x, y, 30 + rnd() * 120, 3 + rnd() * 9, rnd() * 0.3 - 0.15, 0, 7); c.fill();
    }
    const gl = c.createLinearGradient(0, 740, 0, 900);                  // bruma del limbo
    gl.addColorStop(0, 'rgba(140,210,255,.75)'); gl.addColorStop(0.12, 'rgba(80,160,255,.2)'); gl.addColorStop(1, 'rgba(0,0,0,.25)');
    c.fillStyle = gl; c.fillRect(0, 700, W, 200);
    c.restore();
    const sun = c.createRadialGradient(1500, 838, 0, 1500, 838, 380);   // destello solar
    sun.addColorStop(0, 'rgba(255,255,255,.95)'); sun.addColorStop(0.06, 'rgba(200,235,255,.6)');
    sun.addColorStop(0.3, 'rgba(60,150,255,.18)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sun; c.fillRect(1100, 450, 500, 450);

    for (let i = 0; i < 140; i++) {                                     // estrellas que titilan
      const x = rnd() * W, y = rnd() * 760;
      if (!inEarth(x, y)) twinkles.push({ x, y, r: 0.8 + rnd() * 1.4, p: rnd() * 6.28, s: 0.6 + rnd() * 1.8 });
    }
  })();

  let menuActive = true;
  function drawMenu(t) {
    if (menuActive) {
      cx.drawImage(bg, 0, 0);
      const time = settings.anim ? t / 1000 : 0;
      for (const s of twinkles) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(time * s.s + s.p));
        cx.fillStyle = 'rgba(220,235,255,' + a + ')';
        cx.beginPath(); cx.arc(s.x, s.y, s.r * (0.7 + a * 0.5), 0, 7); cx.fill();
      }
    }
    requestAnimationFrame(drawMenu);
  }
  requestAnimationFrame(drawMenu);

  // ---------- Pantallas ----------
  const screens = { menu: $('#screen-menu'), brief: $('#screen-brief'), launch: $('#screen-launch'), flight: $('#screen-flight'), exit: $('#screen-exit') };
  function show(name) {
    for (const k in screens) {
      screens[k].classList.toggle('hidden', k !== name);
      if (k === 'exit') screens[k].classList.toggle('flex', k === name);
    }
    menuActive = name === 'menu';
  }

  // ---------- Modal ----------
  const modal = $('#modal'), mTitle = $('#modal-title'), mBody = $('#modal-body');
  function openModal(title, html) {
    mTitle.textContent = title; mBody.innerHTML = html;
    modal.classList.remove('hidden'); modal.classList.add('flex');
    modal.firstElementChild.style.width = title === 'Personalizar' ? '860px' : '';
  }
  function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  $('#modal-close').addEventListener('click', () => { beep(330, 0.08); closeModal(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

  // ---------- Personalización de la nave ----------
  function applyShip() {
    document.documentElement.style.setProperty('--ship-accent', settings.accent);
    $('#ship-name').textContent = settings.shipName || 'AEON-01';
    document.body.classList.toggle('no-anim', !settings.anim);
  }
  applyShip();

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const btn = (id, label) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm">' + label + '</button></div>';

  const actions = {
    new() {
      if (store.get('aeon01.save', null)) {
        openModal('Nueva partida', '<p>Ya existe una misión guardada. Si empiezas de nuevo se sobrescribirá.</p>' +
          '<div class="mt-6 flex gap-4 justify-end">' + btn('m-no', 'Cancelar') + btn('m-yes', 'Empezar') + '</div>');
        $('#m-no').onclick = closeModal;
        $('#m-yes').onclick = () => { closeModal(); store.del('aeon01.save'); AEON.startBriefing(); };
      } else AEON.startBriefing();
    },
    continue() {
      const save = store.get('aeon01.save', null);
      if (save) AEON.startFlight(save);
      else openModal('Continuar', '<p>No hay ninguna misión guardada todavía. Inicia una <b>Nueva partida</b> y tu progreso se guardará automáticamente.</p>');
    },
    settings() {
      openModal('Ajustes',
        '<div class="row"><span>Volumen de música</span><input id="s-music" type="range" min="0" max="100" value="' + settings.music + '"></div>' +
        '<div class="row"><span>Volumen de efectos</span><input id="s-sfx" type="range" min="0" max="100" value="' + settings.sfx + '"></div>' +
        '<div class="row"><label for="s-anim">Animaciones del menú</label><input id="s-anim" type="checkbox" class="w-6 h-6 accent-sky-400"' + (settings.anim ? ' checked' : '') + '></div>' +
        '<div class="row"><span>Pantalla completa</span>' + btn('s-full', 'Alternar') + '</div>' +
        '<div class="row"><span>Borrar partida guardada</span>' + btn('s-wipe', 'Borrar') + '</div>');
      $('#s-music').oninput = (e) => { settings.music = +e.target.value; audio(); applyVolume(); saveSettings(); };
      $('#s-sfx').oninput = (e) => { settings.sfx = +e.target.value; saveSettings(); };
      $('#s-sfx').onchange = () => beep(660, 0.1);
      $('#s-anim').onchange = (e) => { settings.anim = e.target.checked; applyShip(); saveSettings(); };
      $('#s-full').onclick = () => {
        try {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen().catch(() => {});
        } catch (e) { /* no permitido */ }
      };
      $('#s-wipe').onclick = (e) => { store.del('aeon01.save'); e.currentTarget.textContent = 'Borrada ✓'; };
    },
    custom() {
      const M = AEON.mission;
      const colors = ['#19b4ff', '#ff5a3c', '#ffc93c', '#3cff9e', '#c06bff', '#ffffff'];
      openModal('Personalizar',
        '<p class="text-base text-sky-200/80 mb-2">Los cambios se ven al instante en la nave del menú.</p>' +
        '<div class="row"><span>Color de la franja</span><div class="flex gap-2">' +
        colors.map((c) => '<button class="swatch' + (c === settings.accent ? ' on' : '') + '" style="background:' + c + ';color:' + c + '" data-c="' + c + '" aria-label="Color ' + c + '"></button>').join('') +
        '</div></div>' +
        '<div class="row"><label for="c-name">Nombre de la nave</label><input id="c-name" class="txt-in" maxlength="10" value="' + esc(settings.shipName) + '"></div>' +
        '<div class="h-px bg-sky-400/30 my-2"></div>' +
        '<p class="font-display text-sm tracking-[.2em] text-sky-300 mt-3">VEHÍCULO DE LANZAMIENTO</p><div class="flex gap-2 mt-2">' +
        M.LAUNCHERS.map((l) => '<button class="opt' + (l.id === settings.launcher ? ' on' : '') + '" data-l="' + l.id + '"><b>' + l.name + '</b><br>' + l.cap + ' t · ' + l.cost + ' M$</button>').join('') + '</div>' +
        '<p class="font-display text-sm tracking-[.2em] text-sky-300 mt-4">MÓDULOS Y CARGA</p><div class="grid grid-cols-2 gap-2 mt-2">' +
        M.MODULES.map((m) => '<button class="opt' + (settings.modules.includes(m.id) ? ' on' : '') + '" data-m="' + m.id + '"><b>' + m.name + '</b><br>+' + m.mass + ' t · +' + m.cost + ' M$</button>').join('') + '</div>' +
        '<div id="c-sum" class="mt-4 text-lg"></div>');
      const sum = () => {
        const k = M.calc();
        $('#c-sum').innerHTML = 'Masa total: <b class="' + (k.massOk ? 'text-emerald-300' : 'text-red-400') + '">' + k.mass + ' / ' + k.cap + ' t</b> &nbsp;·&nbsp; Coste: <b class="' +
          (k.costOk ? 'text-emerald-300' : 'text-red-400') + '">' + k.cost + ' / ' + k.budget + ' M$</b>';
      };
      sum();
      mBody.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => {
        settings.launcher = b.dataset.l; saveSettings(); beep(520, 0.08); sum();
        mBody.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === b));
      });
      mBody.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
        const i = settings.modules.indexOf(b.dataset.m);
        if (i < 0) settings.modules.push(b.dataset.m); else settings.modules.splice(i, 1);
        b.classList.toggle('on', i < 0); saveSettings(); beep(520, 0.08); sum();
      });
      mBody.querySelectorAll('.swatch').forEach((b) => b.onclick = () => {
        settings.accent = b.dataset.c; applyShip(); saveSettings(); beep(520, 0.08);
        mBody.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
      });
      $('#c-name').oninput = (e) => { settings.shipName = e.target.value.toUpperCase().slice(0, 10); applyShip(); saveSettings(); };
    },
    credits() {
      openModal('Créditos',
        '<p class="font-display tracking-[.2em] text-sky-300 text-base">AEON-01 · SPACE SIMULATOR</p>' +
        '<p class="mt-3">Desarrollado por el <b>Equipo 7</b> para el hackatón Space Apps.</p>' +
        '<ul class="mt-3 space-y-1 text-lg">' +
        '<li>Dirección y diseño del juego — Equipo 7</li>' +
        '<li>Programación — Equipo 7 con Claude</li>' +
        '<li>Arte y sonido — generados por código (canvas, SVG y WebAudio)</li></ul>' +
        '<p class="mt-4 text-base text-sky-200/70">Edita esta lista en <code>js/menu.js</code> para añadir los nombres del equipo.</p>');
    },
    exit() {
      openModal('Salir', '<p>¿Quieres cerrar AEON-01?</p><div class="mt-6 flex gap-4 justify-end">' + btn('m-no', 'Cancelar') + btn('m-yes', 'Salir') + '</div>');
      $('#m-no').onclick = closeModal;
      $('#m-yes').onclick = () => { closeModal(); show('exit'); try { window.close(); } catch (e) { /* el navegador no lo permite */ } };
    }
  };

  document.querySelectorAll('[data-action]').forEach((b) => {
    b.addEventListener('mouseenter', () => beep(880, 0.04));
    b.addEventListener('click', () => { beep(440, 0.1); actions[b.dataset.action](); });
  });
  $('#exit-back').addEventListener('click', () => show('menu'));

  // API compartida con el módulo de vuelo
  window.AEON = { W, H, store, settings, show, beep, audio, bg, actions, startFlight() {}, startBriefing() {} };
})();
