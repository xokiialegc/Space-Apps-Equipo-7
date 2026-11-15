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
    { music: 40, sfx: 70, muted: false, anim: true, accent: '#19b4ff', shipName: 'AEON-01', launcher: 'ares-h', ship: null, paint: '', stickers: [], stickerImg: '' },
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

  // ---------- Sonido (WebAudio, se activa con el primer clic o tecla) ----------
  // Los efectos pasan por `master`, que el botón de silencio (js/fx.js) pone a cero.
  // La música son tres pistas de Kevin MacLeod (CC BY 4.0) en assets/music (ver «Música por escena», más abajo).
  let actx = null, master = null;
  function audio() {
    if (actx) { if (actx.state === 'suspended' && unlocked) actx.resume().catch(() => {}); return actx; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.connect(actx.destination);
      applyVolume();
    } catch (e) { actx = null; }
    return actx;
  }
  function applyVolume() {
    if (master) master.gain.setTargetAtTime(settings.muted ? 0 : 1, actx.currentTime, 0.03);
    fadeMusic(true);
  }
  // El navegador solo deja sonar el audio tras un gesto del jugador: el primero lo desbloquea.
  let unlocked = false;
  const unlock = () => { unlocked = true; const a = audio(); if (a && a.state === 'suspended') a.resume().catch(() => {}); playScene(); };

  // ---------- Música por escena ----------
  // principal: menú, briefing, despegue y viaje · descenso: desde la entrada en Marte hasta el informe final
  // personalizacion: solo en el hangar de personalización. Se funden al cambiar de escena.
  // El volumen sale del deslizador «Música» de Ajustes; el botón de silencio también la apaga.
  const TRACKS = { main: 'assets/music/principal.mp3', descent: 'assets/music/descenso.mp3', custom: 'assets/music/personalizacion.mp3' };
  const players = {};
  let scene = 'main';
  function player(id) {
    if (!players[id]) {
      const a = new Audio(TRACKS[id]); a.loop = true; a.preload = 'auto'; a.volume = 0;
      a.addEventListener('error', () => { a.dead = true; });     // sin el archivo, el juego sigue sin esa música
      players[id] = a;
    }
    return players[id];
  }
  const musicVol = () => (settings.muted ? 0 : settings.music / 100);
  function playScene() {
    if (!unlocked || !scene) return;
    const a = player(scene);
    if (a.paused && !a.dead) a.play().catch(() => { /* el navegador aún no deja reproducir */ });
  }
  /** Cambia la música de fondo: 'main', 'descent', 'custom' o '' (silencio). La de descenso empieza siempre desde el principio. */
  function music(id) {
    if (id === scene) return;
    scene = id;
    if (id === 'descent' && players.descent) players.descent.currentTime = 0;
    playScene();
  }
  /** Lleva cada canción hacia su volumen: la de la escena al del deslizador, las demás a cero (y se pausan). */
  function fadeMusic(now) {
    const v = musicVol();
    Object.keys(players).forEach((id) => {
      const a = players[id], want = id === scene ? v : 0, d = want - a.volume;
      a.volume = Math.max(0, Math.min(1, now && id === scene ? want : a.volume + Math.sign(d) * Math.min(Math.abs(d), 0.04)));
      if (id !== scene && a.volume <= 0.001 && !a.paused) a.pause();
    });
  }
  setInterval(() => { fadeMusic(false); playScene(); }, 50);
  ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, unlock, { capture: true, once: true }));
  /** Pitido táctil de interfaz: ataque corto (sin chasquido) y un leve barrido de tono. */
  function beep(freq, dur) {
    const a = audio(); if (!a || !settings.sfx || a.state !== 'running') return;
    try {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'triangle'; o.frequency.setValueAtTime(freq * 1.06, t); o.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.04, dur));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * settings.sfx / 100, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
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
  const screens = { menu: $('#screen-menu'), custom: $('#screen-custom'), brief: $('#screen-brief'), launch: $('#screen-launch'), ship: $('#screen-ship'), exit: $('#screen-exit') };
  function show(name) {
    for (const k in screens) {
      screens[k].classList.toggle('hidden', k !== name);
      if (k === 'exit') screens[k].classList.toggle('flex', k === name);
    }
    menuActive = name === 'menu';
    music(name === 'custom' ? 'custom' : name === 'exit' ? '' : 'main');   // js/edl.js pide 'descent' al empezar el descenso
    if (name === 'menu') { const b = document.querySelector('[data-action="continue"]'); if (b) b.classList.toggle('dim', !store.get('aeon01.save', null)); }
  }

  // ---------- Modal ----------
  const modal = $('#modal'), mTitle = $('#modal-title'), mBody = $('#modal-body');
  function openModal(title, html) {
    mTitle.textContent = title; mBody.innerHTML = html;
    modal.classList.remove('hidden'); modal.classList.add('flex');
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

  const btn = (id, label) => '<div class="neon-wrap"><button id="' + id + '" class="neon-btn neon-btn--sm">' + label + '</button></div>';

  const actions = {
    new() {
      if (store.get('aeon01.save', null)) {
        openModal('Nueva partida', '<p class="font-display tracking-wider text-2xl">¿Borrar la partida guardada?</p>' +
          '<div class="mt-6 flex gap-4 justify-end">' + btn('m-no', 'Cancelar') + btn('m-yes', 'Empezar de cero') + '</div>');
        $('#m-no').onclick = closeModal;
        $('#m-yes').onclick = () => { closeModal(); store.del('aeon01.save'); AEON.startBriefing(); };
      } else AEON.startBriefing();
    },
    continue() {
      const save = store.get('aeon01.save', null);
      if (save && save.phase) AEON.resume(save);
      else {
        openModal('Continuar', '<p class="font-display tracking-wider text-2xl">Sin partida guardada.</p><div class="mt-6 flex justify-end">' + btn('m-yes', 'Nueva partida') + '</div>');
        $('#m-yes').onclick = () => { closeModal(); AEON.startBriefing(); };
      }
    },
    settings() {
      openModal('Ajustes',
        '<div class="row"><span>Música</span><input id="s-music" type="range" min="0" max="100" value="' + settings.music + '"></div>' +
        '<div class="row"><span>Efectos</span><input id="s-sfx" type="range" min="0" max="100" value="' + settings.sfx + '"></div>' +
        '<div class="row"><label for="s-anim">Animaciones</label><input id="s-anim" type="checkbox" class="w-6 h-6 accent-sky-400"' + (settings.anim ? ' checked' : '') + '></div>' +
        '<div class="row"><span>Pantalla completa</span>' + btn('s-full', 'Activar') + '</div>' +
        '<div class="row"><span>Borrar partida guardada</span>' + btn('s-wipe', 'Borrar') + '</div>');
      $('#s-music').oninput = (e) => { settings.music = +e.target.value; unlocked = true; audio(); applyVolume(); playScene(); saveSettings(); };
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
    custom() { AEON.openCustom(); },          // pantalla propia: js/custom.js
    credits() {
      // Para añadir los nombres del equipo, edita las líneas de abajo.
      const cr = (k, v) => '<div class="mt-4"><div class="font-display text-[12px] tracking-[.3em] text-sky-300">' + k + '</div><div class="font-display text-2xl tracking-wider">' + v + '</div></div>';
      openModal('Créditos', '<div class="text-center py-2"><div class="title-metal font-display font-black text-[64px] leading-none tracking-[.08em]">AEON-01</div>' +
        cr('UN JUEGO DE', 'EQUIPO 7 · SPACE APPS') + cr('PROGRAMACIÓN', 'EQUIPO 7 + CLAUDE') + cr('ARTE Y EFECTOS', 'GENERADOS POR CÓDIGO') +
        cr('MÚSICA', 'KEVIN MACLEOD · INCOMPETECH.COM') +
        '<div class="text-[15px] text-sky-200/80 mt-1">«Hitman» · «Hero Down» · «Aggressor»<br>Licencia Creative Commons: By Attribution 4.0 · creativecommons.org/licenses/by/4.0</div></div>');
    },
    exit() {
      openModal('Salir', '<p class="font-display tracking-wider text-2xl">¿Salir del juego?</p><div class="mt-6 flex gap-4 justify-end">' + btn('m-no', 'Cancelar') + btn('m-yes', 'Salir') + '</div>');
      $('#m-no').onclick = closeModal;
      $('#m-yes').onclick = () => { closeModal(); show('exit'); try { window.close(); } catch (e) { /* el navegador no lo permite */ } };
    }
  };

  document.querySelectorAll('[data-action]').forEach((b) => {
    b.addEventListener('mouseenter', () => beep(880, 0.04));
    b.addEventListener('click', () => { beep(440, 0.1); actions[b.dataset.action](); });
  });
  $('#exit-back').addEventListener('click', () => show('menu'));

  // ---------- Pausa y panel de partida ----------
  // Desde que empieza la partida (briefing, cabina, nave y descenso) hay un panel pequeño arriba a la
  // derecha con PAUSA y MENÚ. Esc también pausa. En pausa, cada bucle de juego deja de avanzar
  // (AEON.paused); la música sigue sonando.
  const pauseEl = $('#pause'), gm = $('#game-menu'), gmPause = $('#gm-pause');
  const inGame = () => ['brief', 'launch', 'ship'].some((k) => !screens[k].classList.contains('hidden'));
  function setPause(v) {
    window.AEON.paused = v;
    pauseEl.classList.toggle('hidden', !v); pauseEl.classList.toggle('flex', v);
    gmPause.classList.toggle('on', v); gmPause.querySelector('span').textContent = v ? 'SEGUIR' : 'PAUSA';
    if (v && window.AEON.exterior && window.AEON.exterior.on) window.AEON.exterior.toggle();
    beep(v ? 330 : 520, 0.08);
  }
  function togglePause() { if (window.AEON.paused) setPause(false); else if (inGame()) setPause(true); }
  /** Vuelve al menú principal desde cualquier punto de la partida (la partida guardada sigue disponible en Continuar). */
  function goMenu() {
    if (window.AEON.paused) setPause(false);
    ['#report', '#modal'].forEach((sel) => { $(sel).classList.add('hidden'); $(sel).classList.remove('flex'); });
    if (window.AEON.exterior && window.AEON.exterior.on) window.AEON.exterior.toggle();
    beep(440, 0.1); show('menu');
  }
  $('#p-go').onclick = () => setPause(false);
  $('#p-menu').onclick = goMenu;
  gmPause.addEventListener('click', (e) => { e.preventDefault(); togglePause(); gmPause.blur(); });
  $('#gm-menu').addEventListener('click', (e) => { e.preventDefault(); goMenu(); });
  setInterval(() => gm.classList.toggle('hidden', !inGame()), 200);
  // en pausa ninguna otra tecla llega al juego; Esc sale de la pausa
  window.addEventListener('keydown', (e) => {
    if (!window.AEON.paused) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.key === 'Escape' && !e.repeat) setPause(false);
  }, true);

  /** Tecla dibujada como icono, para textos de controles. */
  const key = (k) => '<kbd class="kc">' + k + '</kbd>';

  // API compartida con el módulo de vuelo
  window.AEON = { W, H, store, settings, saveSettings, applyShip, applyVolume, show, beep, audio, master: () => master, bg, actions, key, togglePause, music, paused: false, run: { tries: 0 }, startBriefing() {} };
})();
