/* AEON-01 — Hangar de lanzamiento: pantalla de personalización del cohete.
   Carrusel para elegir cohete (que es también el vehículo de lanzamiento), color principal en
   tiempo real, calcomanías sobre el fuselaje y nombre de la nave. El cohete elegido espera en
   la plataforma, listo para despegar. */
(function () {
  'use strict';
  const A = window.AEON, M = A.mission, R = A.rockets, S = A.settings, W = 1600, H = 900;
  const $ = (s) => document.querySelector(s);
  const cv = $('#pad'), c = cv.getContext('2d');
  const RX = 600, BASE = 742, SIZE = 452;                    // cohete: centro, base y alto del mayor
  const COLORS = ['#f2f5f8', '#19b4ff', '#ff5a3c', '#ffc93c', '#3cff9e', '#c06bff', '#ff7ac8', '#2b3442'];
  const MAX_STICKERS = 3;
  let raf = 0, swap = 1, puffs = [];

  if (!Array.isArray(S.stickers)) S.stickers = [];
  if (typeof S.paint !== 'string') S.paint = '';
  const look = () => ({ paint: S.paint, stickers: S.stickers });
  const visible = () => !$('#screen-custom').classList.contains('hidden');

  // ---------- Escenario fijo: cielo, horizonte, plataforma y torre ----------
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = [];
  (function paint() {
    const b = bg.getContext('2d'), HOR = 652;
    const sky = b.createLinearGradient(0, 0, 0, HOR);
    sky.addColorStop(0, '#02050f'); sky.addColorStop(0.45, '#081433'); sky.addColorStop(0.78, '#2a2a66'); sky.addColorStop(0.93, '#a2506a'); sky.addColorStop(1, '#f08a4b');
    b.fillStyle = sky; b.fillRect(0, 0, W, HOR);
    for (let i = 0; i < 260; i++) { const x = rnd() * W, y = rnd() * 470, r = rnd() * 1.2 + 0.3; stars.push([x, y, r, rnd() * 6.28, 0.6 + rnd() * 1.8]); }
    const sun = b.createRadialGradient(930, HOR, 0, 930, HOR, 520); sun.addColorStop(0, 'rgba(255,205,140,.85)'); sun.addColorStop(0.25, 'rgba(255,140,80,.3)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
    b.fillStyle = sun; b.fillRect(0, 0, W, HOR);
    b.fillStyle = 'rgba(40,30,70,.55)';                       // nubes del atardecer
    [[220, 560, 260, 16], [520, 600, 200, 10], [1080, 548, 320, 18], [1380, 596, 240, 12], [820, 520, 180, 9]].forEach((n) => { b.beginPath(); b.ellipse(n[0], n[1], n[2], n[3], 0, 0, 7); b.fill(); });
    b.fillStyle = '#0f1630';                                  // colinas lejanas
    b.beginPath(); b.moveTo(0, HOR); [[0, 624], [160, 612], [330, 630], [520, 618], [760, 634], [980, 622], [1220, 636], [1420, 616], [1600, 628], [1600, HOR]].forEach((p) => b.lineTo(p[0], p[1])); b.closePath(); b.fill();
    b.fillStyle = '#0a1024';                                  // edificio de ensamblaje, depósitos y torres lejanas
    b.fillRect(96, 548, 150, 104); b.fillRect(246, 600, 70, 52); b.beginPath(); b.arc(1010, 630, 24, 0, 7); b.arc(1066, 634, 18, 0, 7); b.fill(); b.fillRect(1004, 630, 12, 22); b.fillRect(1062, 634, 8, 18);
    b.strokeStyle = '#0a1024'; b.lineWidth = 3; [[860, 560], [900, 574], [1290, 566]].forEach((p) => { b.beginPath(); b.moveTo(p[0], HOR); b.lineTo(p[0], p[1]); b.stroke(); });
    b.fillStyle = 'rgba(120,200,255,.5)'; for (let i = 0; i < 5; i++) b.fillRect(112 + i * 26, 566, 10, 5);
    b.strokeStyle = 'rgba(25,180,255,.45)'; b.lineWidth = 1.5; b.strokeRect(96.5, 548.5, 150, 104);
    const sea = b.createLinearGradient(0, HOR, 0, HOR + 26); sea.addColorStop(0, '#c9683f'); sea.addColorStop(1, '#1a1c3c');
    b.fillStyle = sea; b.fillRect(0, HOR, W, 26);
    const gr = b.createLinearGradient(0, HOR + 26, 0, H); gr.addColorStop(0, '#0e1524'); gr.addColorStop(1, '#04070c');
    b.fillStyle = gr; b.fillRect(0, HOR + 26, W, H - HOR - 26);
    b.strokeStyle = 'rgba(120,170,230,.07)'; b.lineWidth = 1;   // losas del suelo en perspectiva
    for (let i = -8; i <= 24; i++) { b.beginPath(); b.moveTo(RX + (i - 8) * 60, HOR + 26); b.lineTo(RX + (i - 8) * 260, H); b.stroke(); }
    [700, 730, 772, 830].forEach((y) => { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); });
    b.fillStyle = '#182030'; b.beginPath(); b.moveTo(RX - 70, 800); b.lineTo(RX + 70, 800); b.lineTo(RX + 190, H); b.lineTo(RX - 190, H); b.closePath(); b.fill();        // vía de la oruga
    b.fillStyle = '#1a2231'; b.beginPath(); b.moveTo(RX - 300, 772); b.lineTo(RX + 300, 772); b.lineTo(RX + 390, 836); b.lineTo(RX - 390, 836); b.closePath(); b.fill();   // montículo de la plataforma
    b.fillStyle = '#222c3f'; b.fillRect(RX - 300, 766, 600, 8);
    b.fillStyle = '#05070b'; b.beginPath(); b.moveTo(RX - 62, 774); b.lineTo(RX + 62, 774); b.lineTo(RX + 96, 836); b.lineTo(RX - 96, 836); b.closePath(); b.fill();     // foso de llamas
    b.fillStyle = '#2c384d'; b.fillRect(RX - 150, BASE, 300, 12);                             // mesa de lanzamiento
    b.fillStyle = '#1b2433'; [-136, -60, 48, 124].forEach((x) => b.fillRect(RX + x, BASE + 12, 12, 16)); b.fillRect(RX - 150, BASE + 22, 300, 6);
    b.fillStyle = '#3a4a64'; b.fillRect(RX - 150, BASE, 300, 3);
    // torre de servicio
    const TX = RX - 196, TW = 58, TT = 300;
    b.strokeStyle = '#3b2a36'; b.lineWidth = 5; b.strokeRect(TX, TT, TW, 772 - TT);
    b.lineWidth = 2.5; for (let y = TT; y < 772 - 20; y += 42) { b.beginPath(); b.moveTo(TX, y); b.lineTo(TX + TW, y + 42); b.moveTo(TX + TW, y); b.lineTo(TX, y + 42); b.moveTo(TX, y); b.lineTo(TX + TW, y); b.stroke(); }
    b.fillStyle = '#2a1f2b'; for (let y = TT + 84; y < 760; y += 126) b.fillRect(TX - 14, y, TW + 28, 6);
    b.strokeStyle = '#4a3642'; b.lineWidth = 4; b.beginPath(); b.moveTo(TX + TW / 2, TT); b.lineTo(TX + TW / 2, TT - 24); b.stroke();                                    // pararrayos
    b.fillStyle = '#10151d'; b.fillRect(TX + TW + 6, 700, 30, 72); b.fillRect(RX + 232, 716, 40, 56);                                                                      // casetas
    b.strokeStyle = '#2c384d'; b.lineWidth = 4; b.beginPath(); b.moveTo(RX + 330, 772); b.lineTo(RX + 330, 560); b.stroke(); b.fillStyle = '#2c384d'; b.fillRect(RX + 306, 548, 48, 14);   // torre de focos
  })();

  // ---------- Escena animada ----------
  function draw(now) {
    raf = 0;
    if (!visible()) return;
    const t = S.anim ? now / 1000 : 0, r = R.get(S.launcher), top = BASE - SIZE * r.rel, hw = r.hw * SIZE / 1000;
    c.drawImage(bg, 0, 0);
    stars.forEach((s) => { c.fillStyle = 'rgba(225,236,255,' + (0.3 + 0.6 * Math.abs(Math.sin(t * s[4] + s[3]))) + ')'; c.fillRect(s[0], s[1], s[2], s[2]); });
    const TX = RX - 196, TW = 58;
    c.fillStyle = Math.sin(t * 3) > 0 ? '#ff3c2c' : '#5a1810'; c.beginPath(); c.arc(TX + TW / 2, 274, 5, 0, 7); c.fill();                                                  // baliza de la torre
    [[RX + 330, 555, -1], [RX - 330, 770, 1]].forEach((f, i) => {                              // focos que iluminan el cohete
      const a = 0.065 + 0.02 * Math.sin(t * 0.7 + i), g = c.createLinearGradient(f[0], f[1], RX, (top + BASE) / 2);
      g.addColorStop(0, 'rgba(190,225,255,' + a * 2 + ')'); g.addColorStop(1, 'rgba(190,225,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(f[0], f[1]); c.lineTo(RX - f[2] * 30, top - 20); c.lineTo(RX - f[2] * 30, BASE); c.closePath(); c.fill();
    });
    const glow = c.createRadialGradient(RX, BASE + 6, 10, RX, BASE + 6, 300); glow.addColorStop(0, 'rgba(120,200,255,.2)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = glow; c.fillRect(RX - 320, BASE - 120, 640, 200);
    c.strokeStyle = '#4a3642'; c.lineWidth = 7;                                               // brazos de servicio hasta el fuselaje
    [0.3, 0.58].forEach((f) => { const y = BASE - SIZE * r.rel * f; c.beginPath(); c.moveTo(TX + TW, y); c.lineTo(RX - hw - 3, y); c.stroke(); c.fillStyle = '#6a5260'; c.fillRect(RX - hw - 11, y - 7, 10, 14); });
    c.save(); c.globalAlpha = Math.min(1, swap); c.translate(0, (1 - Math.min(1, swap)) * 16);
    R.draw(c, r.id, RX, BASE, SIZE, look());
    c.restore();
    if (swap < 1) swap += 0.07;
    if (S.anim) {                                                                             // vapor de los depósitos
      if (Math.random() < 0.35) puffs.push({ x: RX + (Math.random() - 0.5) * hw * 2.6, y: BASE - 4, vx: (Math.random() - 0.3) * 0.7, vy: -0.25 - Math.random() * 0.4, r: 8 + Math.random() * 10, a: 0.3 });
      if (Math.random() < 0.12) puffs.push({ x: RX + hw, y: BASE - SIZE * r.rel * 0.58, vx: 0.5 + Math.random() * 0.5, vy: -0.1, r: 5, a: 0.34 });
      puffs = puffs.filter((p) => p.a > 0.01);
      puffs.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += 0.22; p.a *= 0.975; c.fillStyle = 'rgba(225,238,255,' + p.a + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); });
    }
    for (let i = 0; i < 9; i++) { c.fillStyle = Math.sin(t * 4 - i * 0.7) > 0.4 ? '#19b4ff' : '#0f3c66'; c.fillRect(RX - 292 + i * 72, 767, 8, 5); }                        // luces del borde
    const v = c.createRadialGradient(800, 470, 420, 800, 470, 1050); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(draw);
  }

  // ---------- Carrusel ----------
  function thumb(cvs, id, o) {
    const x = cvs.getContext('2d'); x.clearRect(0, 0, cvs.width, cvs.height);
    R.draw(x, id, cvs.width / 2, cvs.height - 8, (cvs.height - 16) / R.get(id).rel, o);
  }
  function renderCells() {
    $('#cu-cells').innerHTML = R.LIST.map((r) => {
      const l = M.LAUNCHERS.find((x) => x.id === r.id);
      return '<button class="cu-cell' + (r.id === S.launcher ? ' on' : '') + '" data-id="' + r.id + '" aria-pressed="' + (r.id === S.launcher) + '">' +
        '<canvas width="140" height="220"></canvas><span><b>' + r.name + '</b><small>' + r.sub + '</small><em>' + l.cap + ' t · ' + l.cost + ' M$</em></span></button>';
    }).join('');
    $('#cu-cells').querySelectorAll('.cu-cell').forEach((b) => {
      thumb(b.querySelector('canvas'), b.dataset.id, b.dataset.id === S.launcher ? look() : {});
      b.onclick = () => select(b.dataset.id);
    });
  }
  function select(id) {
    if (id === S.launcher) return;
    S.launcher = id; swap = 0; puffs = []; A.saveSettings(); A.beep(520, 0.08); renderAll();
  }
  function step(d) { const i = R.LIST.findIndex((r) => r.id === S.launcher); select(R.LIST[(i + d + R.LIST.length) % R.LIST.length].id); }

  // ---------- Panel de opciones ----------
  function renderInfo() {
    const r = R.get(S.launcher), k = M.calc(), cls = (b) => (b ? 'text-emerald-300' : 'text-red-400');
    $('#cu-name').textContent = r.name; $('#cu-sub').textContent = r.sub;
    $('#cu-info').innerHTML = '<p>' + r.info + '</p>' +
      '<div class="kv"><span>Capacidad de carga</span><b>' + k.cap + ' t</b></div><div class="kv"><span>Coste del lanzador</span><b>' + k.launcher.cost + ' M$</b></div>' +
      '<div class="kv"><span>Masa de la misión</span><b class="' + cls(k.massOk) + '">' + k.mass + ' / ' + k.cap + ' t</b></div>' +
      '<div class="kv"><span>Coste total</span><b class="' + cls(k.costOk) + '">' + k.cost + ' / ' + k.budget + ' M$</b></div>';
  }
  function renderColors() {
    $('#cu-colors').innerHTML = '<button class="cu-sw cu-sw--orig' + (S.paint ? '' : ' on') + '" data-c="" title="Librea original" aria-label="Librea original">ORIG.</button>' +
      COLORS.map((x) => '<button class="cu-sw' + (x === S.paint ? ' on' : '') + '" style="background:' + x + '" data-c="' + x + '" aria-label="Color ' + x + '"></button>').join('') +
      '<label class="cu-sw cu-sw--pick' + (S.paint && !COLORS.includes(S.paint) ? ' on' : '') + '" title="Otro color"><input id="cu-pick" type="color" value="' + (S.paint || '#19b4ff') + '">+</label>';
    $('#cu-colors').querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { setPaint(b.dataset.c); A.beep(520, 0.06); renderColors(); });
    $('#cu-pick').oninput = (e) => { setPaint(e.target.value); $('#cu-colors').querySelectorAll('.cu-sw').forEach((x) => x.classList.toggle('on', x.classList.contains('cu-sw--pick'))); };
  }
  function setPaint(col) {
    S.paint = col; S.accent = col || '#19b4ff';             // el mismo color viste la franja de la nave y el traje del cadete
    A.saveSettings(); A.applyShip(); refreshThumb();
  }
  function refreshThumb() { const b = $('#cu-cells .cu-cell.on'); if (b) thumb(b.querySelector('canvas'), b.dataset.id, look()); }
  function renderStickers() {
    $('#cu-stickers').innerHTML = R.STICKERS.map((s) => '<button class="cu-st' + (S.stickers.includes(s.id) ? ' on' : '') + '" data-s="' + s.id + '" aria-pressed="' + S.stickers.includes(s.id) + '">' +
      '<canvas width="96" height="96"></canvas><span>' + s.name + '</span></button>').join('');
    $('#cu-stickers').querySelectorAll('.cu-st').forEach((b) => {
      R.sticker(b.querySelector('canvas').getContext('2d'), b.dataset.s, 48, 48, 88);
      b.onclick = () => toggleSticker(b.dataset.s);
    });
    $('#cu-file-btn').textContent = S.stickerImg ? 'Cambiar tu imagen' : 'Cargar tu imagen';
    $('#cu-count').textContent = S.stickers.length + ' / ' + MAX_STICKERS;
  }
  function toggleSticker(id) {
    const a = S.stickers, i = a.indexOf(id);
    if (i < 0 && id === 'img' && !S.stickerImg) return $('#cu-file').click();
    if (i >= 0) a.splice(i, 1); else { if (a.length >= MAX_STICKERS) a.shift(); a.push(id); }
    A.saveSettings(); A.beep(i >= 0 ? 330 : 660, 0.06); renderStickers(); refreshThumb();
  }
  // imagen propia: se reduce a 160 px y se guarda con los ajustes
  $('#cu-file-btn').onclick = () => $('#cu-file').click();
  $('#cu-file').onchange = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = document.createElement('canvas'), k = Math.min(1, 160 / Math.max(im.width, im.height));
        s.width = Math.max(1, Math.round(im.width * k)); s.height = Math.max(1, Math.round(im.height * k));
        s.getContext('2d').drawImage(im, 0, 0, s.width, s.height);
        S.stickerImg = s.toDataURL('image/png');
        const pre = new Image(); pre.onload = () => { R.customImage(); setTimeout(() => { renderStickers(); refreshThumb(); }, 60); }; pre.src = S.stickerImg;
        if (!S.stickers.includes('img')) { if (S.stickers.length >= MAX_STICKERS) S.stickers.shift(); S.stickers.push('img'); }
        A.saveSettings(); A.beep(660, 0.06);
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  $('#cu-shipname').oninput = (e) => { S.shipName = e.target.value.trim().toUpperCase() || 'AEON-01'; A.saveSettings(); A.applyShip(); };

  function renderAll() { renderCells(); renderInfo(); renderColors(); renderStickers(); }
  function close() { A.beep(330, 0.08); A.show('menu'); }
  $('#cu-prev').onclick = () => step(-1); $('#cu-next').onclick = () => step(1); $('#cu-back').onclick = close;
  window.addEventListener('keydown', (e) => {
    if (!visible() || (e.target && e.target.tagName === 'INPUT')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'Escape') close();
  });

  A.openCustom = function () {
    if (!R.get(S.launcher) || R.get(S.launcher).id !== S.launcher) S.launcher = 'ares-h';
    S.stickers = S.stickers.filter((id) => R.STICKERS.some((s) => s.id === id) && (id !== 'img' || S.stickerImg));
    $('#cu-shipname').value = S.shipName || 'AEON-01';
    R.customImage(); swap = 0; puffs = [];
    A.show('custom'); renderAll();
    if (S.stickerImg) setTimeout(() => { if (visible()) { renderStickers(); refreshThumb(); } }, 120);   // la imagen propia tarda un instante en cargar
    if (!raf) raf = requestAnimationFrame(draw);
  };
})();
