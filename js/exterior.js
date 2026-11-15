/* AEON-01 — Cámara exterior (vista de dron / satélite), issue #9.
   La tecla C (o el botón de arriba en el centro) cambia entre la vista de dentro (cabina o
   interior de la nave) y una toma exterior de cuerpo completo del vehículo.
   Este archivo solo DIBUJA: no toca la física. Cada fase publica su telemetría en
   AEON.flight (launch.js, ship.js y edl.js) y aquí se lee en cada fotograma:
   - Fase 1 (despegue): el cohete elegido en el hangar, inclinándose al ganar altura, con llamas
     y partículas según el empuje y separación de etapas. Fondo según la altitud real: cielo azul
     en la troposfera, oscurecimiento en la estratosfera y la mesosfera, negro al cruzar la
     línea de Kármán (100 km) y la Tierra curvándose abajo.
   - Órbita, viaje y llegada (interior de la nave): la nave interplanetaria con sus seis módulos;
     las alarmas, la fuga de propelente, el escudo dañado o la antena sin señal se ven por fuera.
     La Tierra se aleja y Marte se acerca según el progreso del viaje.
   - Fase 3 (descenso): cápsula con plasma en la entrada, paracaídas, escudo y carcasa que se
     sueltan, retropropulsores y el suelo de Marte acercándose.
   Un HUD mínimo mantiene altitud, velocidad, combustible y alertas a la vista. Al abrirse un
   diálogo, un informe o el fin de una fase, la cámara vuelve sola al interior. */
(function () {
  'use strict';
  const A = window.AEON, R = A.REAL;
  A.flight = A.flight || {};
  const $ = (s) => document.querySelector(s);
  const W = 1600, H = 900, CX = 800;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = (t) => t * t * (3 - 2 * t);
  const rgb = (a) => 'rgb(' + a.map(Math.round).join(',') + ')';
  const mixA = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');

  const root = $('#ext'), cv = $('#ext-cv'), c = cv.getContext('2d'), btn = $('#cam-btn');
  let on = false, raf = 0, last = 0, kind = '', thr = 0, tt = 0;

  // ---------- Telemetría de la fase activa ----------
  function feed() {
    const F = A.flight;
    for (const k of ['launch', 'edl', 'ship']) { const f = F[k] && F[k](); if (f) return f; }
    return null;
  }
  // con cualquiera de estos paneles a la vista, la cámara vuelve dentro
  const BLOCK = ['#launch-end', '#report', '#ship-holo', '#modal', '#holo'];
  const blocked = () => BLOCK.some((s) => { const el = $(s); return el && el.getClientRects().length > 0; });   // visible de verdad (no basta la clase: su pantalla puede estar oculta)
  const available = () => !blocked() && !!feed();

  // ---------- Recursos generados una vez ----------
  const layers = [0.25, 0.55, 1].map((k) => {
    const a = []; for (let i = 0; i < 170; i++) a.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.4, 1.1) + k * 0.9, p: rnd(0, 6.3) });
    return { k, a, ox: 0, oy: 0 };
  });
  function cloudSprite() {
    const s = document.createElement('canvas'); s.width = 420; s.height = 200;
    const g = s.getContext('2d'), puffs = [];
    for (let i = 0; i < 16; i++) puffs.push([rnd(70, 350), rnd(80, 130), rnd(30, 70)]);
    g.fillStyle = 'rgba(150,170,200,.9)';
    puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y + 14, r, 0, 7); g.fill(); });
    puffs.forEach(([x, y, r]) => {
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dfe8f4');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    });
    return s;
  }
  const sprites = [0, 1, 2, 3].map(cloudSprite);
  const clouds = [];
  for (let i = 0; i < 34; i++) clouds.push({ x: rnd(0, W + 600), alt: rnd(0.8, 11), s: sprites[i % 4], w: rnd(0.5, 1.2), front: Math.random() < 0.18 });
  const earthTex = document.createElement('canvas'); earthTex.width = 3200; earthTex.height = 500;
  (function () {
    const g = earthTex.getContext('2d');
    const b = g.createLinearGradient(0, 0, 0, 500); b.addColorStop(0, '#2c7fd6'); b.addColorStop(1, '#0a3478');
    g.fillStyle = b; g.fillRect(0, 0, 3200, 500);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(' + Math.round(rnd(60, 150)) + ',' + Math.round(rnd(110, 150)) + ',70,.78)';
      g.beginPath(); g.ellipse(rnd(0, 3200), rnd(20, 480), rnd(60, 260), rnd(18, 70), rnd(-0.4, 0.4), 0, 7); g.fill();
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(255,255,255,' + rnd(0.15, 0.6) + ')';
      g.beginPath(); g.ellipse(rnd(0, 3200), rnd(0, 500), rnd(30, 180), rnd(5, 18), rnd(-0.2, 0.2), 0, 7); g.fill();
    }
  })();
  // manchas fijas de los planetas (fracciones del radio)
  const spots = (n, a, b) => { const s = []; for (let i = 0; i < n; i++) s.push([rnd(-0.9, 0.9), rnd(-0.8, 0.8), rnd(a, b), rnd(-0.6, 0.6)]); return s; };
  const EARTH_SPOTS = spots(9, 0.15, 0.4), EARTH_CLOUDS = spots(14, 0.1, 0.35), MARS_SPOTS = spots(8, 0.08, 0.3);
  const rocks = []; for (let i = 0; i < 26; i++) rocks.push([rnd(-1, 1), rnd(0.05, 1), rnd(3, 11)]);

  // ---------- Partículas y piezas desprendidas ----------
  let parts = [];
  function puff(x, y, vx, vy, life, r0, r1, col, add) { if (parts.length < 900) parts.push({ x, y, vx, vy, life, age: 0, r0, r1, col, add }); }
  function stepParts(dt, wx, wy) {
    for (const p of parts) { p.age += dt; p.x += (p.vx + wx) * dt; p.y += (p.vy + wy) * dt; p.vx *= 0.985; p.vy *= 0.985; }
    parts = parts.filter((p) => p.age < p.life && p.x > -200 && p.x < W + 200 && p.y > -200 && p.y < H + 200);
  }
  function drawParts(add) {
    c.save(); if (add) c.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!!p.add !== add) continue;
      const u = p.age / p.life, r = lerp(p.r0, p.r1, u);
      c.globalAlpha = (1 - u) * (add ? 0.5 : 0.6);
      c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    }
    c.restore();
  }
  let debris = [], banner = null;   // banner: aviso grande de separación
  const say = (txt) => { banner = { txt, born: performance.now() }; };
  const bannerAge = () => (banner ? (performance.now() - banner.born) / 1000 : 99);

  // ---------- Fondos ----------
  const EARTH_SKY = [   // altitud km, cénit, horizonte
    [0, [64, 132, 222], [182, 216, 250]],
    [12, [38, 94, 196], [140, 190, 240]],     // tropopausa
    [50, [12, 36, 104], [64, 116, 196]],      // estratopausa
    [85, [4, 10, 34], [22, 46, 104]],         // mesopausa
    [100, [1, 2, 9], [8, 16, 44]],            // línea de Kármán
    [180, [0, 0, 4], [2, 5, 18]]
  ];
  const MARS_SKY = [
    [0, [186, 140, 104], [232, 186, 140]],
    [12, [150, 104, 80], [214, 160, 116]],
    [40, [78, 50, 42], [160, 104, 76]],
    [80, [18, 10, 12], [62, 32, 26]],
    [125, [2, 2, 6], [10, 6, 10]]
  ];
  function skyAt(T, h) {
    let i = 0; while (i < T.length - 2 && h > T[i + 1][0]) i++;
    const a = T[i], b = T[i + 1], u = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    return [mixA(a[1], b[1], u), mixA(a[2], b[2], u)];
  }
  function sky(T, h) {
    const [top, hor] = skyAt(T, h);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(hor));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  /** Estrellas en tres capas que se desplazan contra el movimiento (sp en px/s). */
  function stars(alpha, dx, dy, sp, dt) {
    if (alpha <= 0.01) return;
    for (const L of layers) {
      L.ox = (((L.ox - dx * sp * L.k * dt) % W) + W) % W; L.oy = (((L.oy - dy * sp * L.k * dt) % H) + H) % H;
      const streak = sp * L.k > 120 ? Math.min(30, sp * L.k / 40) : 0;
      for (const s of L.a) {
        const x = (s.x + L.ox) % W, y = (s.y + L.oy) % H, tw = 0.65 + 0.35 * Math.sin(tt * 2 + s.p);
        c.fillStyle = 'rgba(230,240,255,' + (alpha * tw * (0.35 + L.k * 0.6)) + ')';
        if (streak) { c.strokeStyle = c.fillStyle; c.lineWidth = s.r; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * streak, y + dy * streak); c.stroke(); }
        else { c.beginPath(); c.arc(x, y, s.r, 0, 7); c.fill(); }
      }
    }
  }
  function sun(x, y, k) {
    const g = c.createRadialGradient(x, y, 0, x, y, 240);
    g.addColorStop(0, 'rgba(255,255,255,' + k + ')'); g.addColorStop(0.07, 'rgba(255,248,220,' + 0.85 * k + ')');
    g.addColorStop(0.3, 'rgba(140,200,255,' + 0.18 * k + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - 260, y - 260, 520, 520);
  }
  let earthScroll = 0;
  /** Limbo terrestre que asoma abajo: top = y de la cima del arco, Rr = radio. */
  function earthLimb(top, Rr, scroll, glow) {
    const cy = top + Rr;
    c.save(); c.shadowColor = 'rgba(110,190,255,.95)'; c.shadowBlur = 50 * glow;
    c.fillStyle = '#1a5fb8'; c.beginPath(); c.arc(CX, cy, Rr, 0, 7); c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(CX, cy, Rr, 0, 7); c.clip();
    const sx = ((scroll % 3200) + 3200) % 3200;
    c.drawImage(earthTex, sx, 0, 1600, 500, -100, top, W + 200, H - top + 60);
    c.drawImage(earthTex, sx - 3200, 0, 1600, 500, -100, top, W + 200, H - top + 60);
    const sh = c.createLinearGradient(0, top, 0, H);
    sh.addColorStop(0, 'rgba(170,225,255,.6)'); sh.addColorStop(0.06, 'rgba(60,140,255,.12)'); sh.addColorStop(1, 'rgba(0,10,40,.5)');
    c.fillStyle = sh; c.fillRect(0, top, W, H - top + 10); c.restore();
    c.strokeStyle = 'rgba(150,215,255,' + 0.55 * glow + ')'; c.lineWidth = 7;
    c.beginPath(); c.arc(CX, cy, Rr + 6, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
  }
  /** Planeta completo (viaje): kind 'earth' o 'mars'; la luz viene de la derecha arriba. */
  function planet(x, y, r, k) {
    if (r < 1.5) { c.fillStyle = k === 'earth' ? '#7cc4ff' : '#ff9a6a'; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); return; }
    c.save();
    const halo = c.createRadialGradient(x, y, r * 0.9, x, y, r * 1.25);
    halo.addColorStop(0, k === 'earth' ? 'rgba(120,190,255,.5)' : 'rgba(255,160,110,.25)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 1.25, 0, 7); c.fill();
    c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
    const g = c.createRadialGradient(x + r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    if (k === 'earth') { g.addColorStop(0, '#4fa3ff'); g.addColorStop(1, '#0b3a86'); }
    else { g.addColorStop(0, '#f0a070'); g.addColorStop(1, '#8a3a1c'); }
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    const rot = tt * (k === 'earth' ? 0.04 : 0.03);
    (k === 'earth' ? EARTH_SPOTS : MARS_SPOTS).forEach((s) => {
      const sx = ((s[0] + rot + 1) % 2 + 2) % 2 - 1;
      c.fillStyle = k === 'earth' ? 'rgba(90,140,70,.85)' : 'rgba(90,35,15,.45)';
      c.beginPath(); c.ellipse(x + sx * r, y + s[1] * r, s[2] * r, s[2] * r * 0.55, s[3], 0, 7); c.fill();
    });
    if (k === 'earth') EARTH_CLOUDS.forEach((s) => {
      const sx = ((s[0] + rot * 1.4 + 1) % 2 + 2) % 2 - 1;
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x + sx * r, y + s[1] * r, s[2] * r, s[2] * r * 0.25, s[3] * 0.3, 0, 7); c.fill();
    });
    else { c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x, y - r * 0.93, r * 0.32, r * 0.12, 0, 0, 7); c.fill(); }
    const sh = c.createLinearGradient(x + r * 0.6, y - r * 0.6, x - r, y + r);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,0,.15)'); sh.addColorStop(1, 'rgba(0,0,8,.85)');
    c.fillStyle = sh; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  /** Línea de referencia de una capa de la atmósfera (escala propia: 8 px por km). */
  function marker(hNow, alt, label, col) {
    const y = 470 - (alt - hNow) * 8;
    if (y < 70 || y > H - 20) return;          // arriba queda el botón de la cámara
    c.save(); c.setLineDash([14, 10]); c.strokeStyle = col; c.globalAlpha = 0.7; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 0.95; c.fillStyle = col; c.font = '600 15px Orbitron, Arial, sans-serif'; c.fillText(label, 420, y - 9);
    c.restore();
  }

  // ---------- Cohetes: pila de etapas ----------
  const K = '#14181f';
  function cylG(x0, x1, y0, y1, col) {    // cilindro con volumen (coordenadas ya en canvas, y hacia abajo)
    c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(0.22, 'rgba(255,255,255,.3)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function bellG(x, y, w0, w1, hgt) {     // tobera: boca w1 abajo en y, garganta w0 arriba
    c.fillStyle = '#39424f'; c.beginPath(); c.moveTo(x - w0, y - hgt); c.lineTo(x + w0, y - hgt); c.lineTo(x + w1, y); c.lineTo(x - w1, y); c.closePath(); c.fill();
    c.fillStyle = '#0c0f14'; c.fillRect(x - w1, y - 3, w1 * 2, 4);
  }
  /** Propulsor bajo la nave X (como el Super Heavy bajo Starship). */
  function superHeavy(paint) {
    const S = paint || '#c3ccd6';
    for (let i = -3; i <= 3; i++) bellG(i * 18.5, 0, 6, 9, 22);
    cylG(-70, 70, -720, -22, S);
    c.fillStyle = '#2a313c'; c.fillRect(-70, -40, 140, 18);
    c.strokeStyle = 'rgba(0,0,0,.17)'; c.lineWidth = 2;
    for (let y = -90; y > -700; y -= 60) { c.beginPath(); c.moveTo(-70, y); c.lineTo(70, y); c.stroke(); }
    c.fillStyle = '#1b2029'; c.fillRect(-70, -722, 140, 16);                 // anillo de separación en caliente
    c.fillStyle = '#ff9a4a'; for (let x = -62; x < 62; x += 14) c.fillRect(x, -718, 7, 8);
    [-1, 1].forEach((s) => {                                                    // aletas de rejilla
      c.fillStyle = '#4b5462'; c.fillRect(s > 0 ? 70 : -102, -676, 32, 40);
      c.strokeStyle = '#1b2029'; c.lineWidth = 2;
      for (let k = 0; k < 4; k++) { const x0 = s > 0 ? 70 : -102; c.beginPath(); c.moveTo(x0 + k * 8, -676); c.lineTo(x0 + k * 8, -636); c.stroke(); c.beginPath(); c.moveTo(x0, -676 + k * 10); c.lineTo(x0 + 32, -676 + k * 10); c.stroke(); }
    });
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(44, -60); c.lineTo(44, -700); c.stroke();
  }
  /** Propulsor bajo el avión espacial Centella. */
  function miniBooster(paint) {
    [-22, 0, 22].forEach((x) => bellG(x, 0, 7, 11, 26));
    cylG(-40, 40, -400, -26, paint || '#e9eef4');
    c.fillStyle = '#ff7a3c'; c.fillRect(-40, -260, 80, 14);
    c.fillStyle = '#2a313c'; c.fillRect(-40, -46, 80, 20); c.fillRect(-40, -404, 80, 10);
    [-1, 1].forEach((s) => { c.fillStyle = K; c.beginPath(); c.moveTo(s * 40, -40); c.lineTo(s * 78, -26); c.lineTo(s * 78, -6); c.lineTo(s * 40, -110); c.closePath(); c.fill(); });
  }
  // bh: altura del propulsor añadido · cuts: alturas de separación · eng: motores de cada etapa [y, [[x, r], ...], tipo, dibujar toberas]
  const STACK = {
    'ares-h': { bh: 0, top: 1000, cuts: [400, 690], fuel: [55, 22],
      eng: [[0, [[-31, 17], [0, 17], [31, 17]], 'rp1'], [400, [[-27, 9], [-9, 9], [9, 9], [27, 9]], 'h2', true], [690, [[0, 11]], 'h2', true]] },
    'titan-x': { bh: 720, top: 1580, cuts: [720], fuel: [50], booster: superHeavy,
      eng: [[0, [[-55, 9], [-37, 9], [-18, 9], [0, 9], [18, 9], [37, 9], [55, 9]], 'ch4'], [720, [[-30, 16], [0, 16], [30, 16]], 'ch4']] },
    'ares-m': { bh: 400, top: 1120, cuts: [400], fuel: [50], booster: miniBooster,
      eng: [[0, [[-22, 11], [0, 11], [22, 11]], 'rp1'], [400, [[-106, 12], [0, 26], [106, 12]], 'h2']] }
  };
  const FLAME = {
    rp1: ['rgba(255,252,232,1)', 'rgba(255,186,70,.92)', 'rgba(255,80,20,0)'],
    h2: ['rgba(245,252,255,1)', 'rgba(150,200,255,.7)', 'rgba(80,120,255,0)'],
    ch4: ['rgba(240,248,255,1)', 'rgba(110,170,255,.8)', 'rgba(255,140,60,0)']
  };
  const look = () => ({ paint: A.settings.paint, stickers: A.settings.stickers || [] });
  /** Dibuja la pila recortada a las alturas [lo, hi] (unidades del cohete, base en 0, arriba negativo). */
  function stack(def, id, lo, hi) {
    c.save(); c.beginPath(); c.rect(-420, -hi, 840, hi - lo); c.clip();
    if (def.booster) def.booster(A.settings.paint);
    A.rockets.draw(c, id, 0, -def.bh, 1000, look());
    c.restore();
  }
  function flame(x, y, r, len, wid, type) {
    const col = FLAME[type], g = c.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, col[0]); g.addColorStop(0.25, col[1]); g.addColorStop(1, col[2]);
    c.fillStyle = g; c.beginPath();
    c.moveTo(x - r * 0.8, y); c.quadraticCurveTo(x - wid, y + len * 0.45, x, y + len); c.quadraticCurveTo(x + wid, y + len * 0.45, x + r * 0.8, y); c.closePath(); c.fill();
    c.fillStyle = col[0]; c.beginPath(); c.ellipse(x, y + r * 0.9, r * 0.55, r * 1.3, 0, 0, 7); c.fill();   // núcleo
  }

  // estado de la toma del despegue
  const RS = { id: '', drop: 0, k: 0, piv: 0, dr: 0, maxH: 0 };
  /** Separación de etapas: visual, según el combustible gastado (la física del despegue no cambia). */
  function trackLaunch(f) {
    const def = STACK[f.rocket] || STACK['ares-h'];
    if (RS.id !== f.rocket || f.t < 0.2 || f.fuel > 99.5) { RS.id = f.rocket; RS.drop = 0; RS.maxH = 0; debris = debris.filter((d) => d.kind !== 'stage'); }
    RS.maxH = Math.max(RS.maxH, f.h);
    let want = 0; def.fuel.forEach((p) => { if (f.fuel <= p && RS.maxH > 2) want++; });
    while (RS.drop < want) {
      const i = RS.drop++;
      debris.push({ kind: 'stage', i, lo: i ? def.cuts[i - 1] : 0, hi: def.cuts[i], born: performance.now(), vr: rnd(-0.12, 0.12), vx: rnd(-12, 12) });
      say('SEPARACIÓN DE ETAPA ' + (i + 1));
      if (A.fx) A.fx.event('stage');          // golpe de cámara, zoom y detonación (js/fx.js)
    }
  }
  function drawLaunch(f, dt) {
    const def = STACK[f.rocket] || STACK['ares-h'], h = f.h, rho = Math.exp(-h / R.EARTH_SCALE_H), vac = 1 - rho;
    const lo = RS.drop ? def.cuts[RS.drop - 1] : 0, hi = def.top + 40, span = def.top - lo;
    const kT = Math.min(1.05, 600 / span), pT = (lo + def.top) / 2;
    if (!RS.k) { RS.k = kT; RS.piv = pT; }
    // tras una separación la toma espera un momento antes de acercarse a la etapa superior,
    // para que se vea caer el propulsor
    const sm = bannerAge() < 2.6 ? 0 : 1 - Math.exp(-dt * 1.2); RS.k += (kT - RS.k) * sm; RS.piv += (pT - RS.piv) * sm;
    const k = RS.k, a = 1.1 * ease(clamp((h - 1.5) / 105, 0, 1));          // giro de gravedad
    const dx = Math.sin(a), dy = -Math.cos(a);                              // dirección de avance en pantalla
    RS.dr += f.v * dx * dt;
    const CY = 470, PXK = 120;
    const shake = thr * (0.5 + rho * 2.5) + (f.q > 0.9 ? 2 : 0);
    const ox = rnd(-shake, shake), oy = rnd(-shake, shake);

    sky(EARTH_SKY, h);
    stars(clamp((h - 28) / 55, 0, 1), dx, dy, 20 + f.v * 45, dt);
    sun(1330, 130, clamp((h - 35) / 55, 0, 1));
    if (h > 18) {                                                           // la Tierra se curva abajo
      const u = clamp((h - 18) / 150, 0, 1);
      earthScroll += dt * (6 + f.v * 30);
      earthLimb(lerp(H + 30, 640, ease(u)), lerp(14000, 2600, u), earthScroll, clamp((h - 25) / 60, 0, 1));
    }
    marker(h, 12, 'TROPOPAUSA · 12 km', 'rgba(220,240,255,.9)');
    marker(h, 50, 'ESTRATOPAUSA · 50 km', 'rgba(180,215,255,.9)');
    marker(h, R.KARMAN, 'LÍNEA DE KÁRMÁN · ' + R.KARMAN + ' km · COMIENZA EL ESPACIO', 'rgba(127,220,255,1)');
    // nubes del fondo
    const cloudPass = (front) => clouds.forEach((cl) => {
      if (cl.front !== front) return;
      const y = CY + (h - cl.alt) * PXK, x = ((cl.x - RS.dr * PXK * 0.6) % (W + 600) + (W + 600)) % (W + 600) - 300;
      if (y < -120 || y > H + 120) return;
      const s = cl.w * (front ? 1.5 : 1);
      c.globalAlpha = front ? 0.45 : 0.95; c.drawImage(cl.s, x - 210 * s, y - 100 * s, 420 * s, 200 * s); c.globalAlpha = 1;
    });
    cloudPass(false);
    // suelo, torre y humo
    const baseY = CY + RS.piv * k, gy = baseY + h * PXK;
    if (gy < H + 40) {
      c.fillStyle = '#2f4a2a'; c.fillRect(0, gy, W, H - gy + 40);
      c.fillStyle = '#4a5f3a'; c.fillRect(0, gy, W, 6);
      c.fillStyle = '#6b6f75'; c.fillRect(CX - 170, gy - 10, 340, 12);
      const tx = CX - 150, th = Math.min(def.top * k * 1.02, 760);
      c.fillStyle = '#7e2f22'; c.fillRect(tx - 34, gy - th, 12, th); c.fillRect(tx, gy - th, 12, th);
      c.strokeStyle = '#a3402e'; c.lineWidth = 3;
      for (let y = gy - th; y < gy - 20; y += 30) { c.beginPath(); c.moveTo(tx - 34, y); c.lineTo(tx + 12, y + 30); c.moveTo(tx + 12, y); c.lineTo(tx - 34, y + 30); c.stroke(); }
      c.fillStyle = '#5b636e'; c.fillRect(tx + 12, gy - th * 0.62, 70, 7); c.fillRect(tx + 12, gy - th * 0.35, 60, 7);
      c.fillStyle = (f.t > -6 && f.t < 0 && Math.floor(tt * 2.5) % 2) ? '#ff3c3c' : '#511';
      c.beginPath(); c.arc(tx - 28, gy - th - 8, 6, 0, 7); c.fill();
      if (f.t > -3 && f.t < 0 && Math.random() < 0.7) puff(CX + rnd(-60, 60), gy - rnd(5, 30), rnd(-60, 60), rnd(-30, -5), 2.2, 12, 40, 'rgba(235,238,242,1)');
    }
    // rocket transform
    c.save(); c.translate(CX + ox, CY + oy); c.rotate(a); c.scale(k, k); c.translate(0, RS.piv);
    const m = c.getTransform();                                             // unidades del cohete -> pantalla
    const scr = (x, y) => new DOMPoint(x, y).matrixTransform(m);
    // llamas proporcionales al empuje; se abren al bajar la presión exterior
    const eng = def.eng[RS.drop];
    if (thr > 0.02 && eng) {
      c.save(); c.globalCompositeOperation = 'lighter';
      eng[1].forEach(([x, r]) => {
        const len = (r * 5 + 260 * thr) * (1 + vac * 1.3) * rnd(0.9, 1.1), wid = r * (1.1 + 3.2 * vac) * (0.6 + 0.4 * thr);
        flame(x, -eng[0], r, len, wid, eng[2]);
      });
      c.restore();
    }
    if (eng && eng[3]) eng[1].forEach(([x, r]) => bellG(x, -eng[0] + r * 1.6, r * 0.5, r, r * 1.6));
    stack(def, f.rocket, lo, hi);
    if (f.q > 0.65 && h < 30) {                                             // cono de condensación cerca de Max-Q
      const qa = clamp((f.q - 0.65) * 0.8, 0, 0.45), yy = -(lo + def.top) / 2;
      c.fillStyle = 'rgba(255,255,255,' + qa + ')'; c.beginPath(); c.ellipse(0, yy, 120, 46, 0, 0, 7); c.fill();
    }
    if (f.q > 0.6) {                                                        // calentamiento en la punta
      const g = c.createRadialGradient(0, -def.top, 4, 0, -def.top, 90);
      g.addColorStop(0, 'rgba(255,170,80,' + Math.min(0.9, f.q - 0.5) + ')'); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, -def.top, 90, 0, 7); c.fill();
    }
    c.restore();
    // partículas de escape (en pantalla): fuego y, en aire denso, humo
    const ex = -dx, ey = -dy, wsp = clamp(f.v * 90, 0, 700);
    if (thr > 0.02 && eng) {
      const n = Math.round(thr * 6);
      for (let i = 0; i < n; i++) {
        const e = eng[1][i % eng[1].length], p = scr(e[0] + rnd(-e[1], e[1]) * 0.6, -eng[0] + e[1] * 2);
        const sp = rnd(260, 520) * (0.6 + 0.4 * thr);
        puff(p.x, p.y, ex * sp + rnd(-40, 40) * (1 + vac * 2), ey * sp + rnd(-40, 40) * (1 + vac * 2), rnd(0.25, 0.6), e[1] * k * 0.9, e[1] * k * (2 + vac * 3), eng[2] === 'rp1' ? 'rgba(255,170,60,1)' : 'rgba(140,190,255,1)', true);
        if (rho > 0.12 && Math.random() < rho) puff(p.x, p.y, ex * sp * 0.4 + rnd(-30, 30), ey * sp * 0.4 + rnd(-30, 30), rnd(1.6, 3), 10, 46 * (0.5 + rho), 'rgba(225,225,228,1)', false);
      }
      if (gy < H + 40 && h < 0.6) for (let i = 0; i < 3; i++) puff(CX + rnd(-40, 40), gy - 8, rnd(-380, 380), rnd(-60, -10), rnd(1.8, 3), 18, 70, 'rgba(232,234,238,1)', false);
    }
    // separación: anillo de gas en el corte
    if (bannerAge() < 0.1 && RS.drop) { const p = scr(0, -lo); for (let i = 0; i < 40; i++) { const an = rnd(0, 6.3), sp = rnd(60, 220); puff(p.x, p.y, Math.cos(an) * sp, Math.sin(an) * sp, rnd(0.8, 1.6), 4, 26, 'rgba(240,244,250,1)', false); } }
    stepParts(dt, -dx * wsp * (h < 0.3 ? 0 : 1), -dy * wsp * (h < 0.3 ? 0 : 1));
    drawParts(false); drawParts(true);
    // etapas que se separan: caen hacia atrás girando (encima del chorro, para que se distingan)
    debris.filter((d) => d.kind === 'stage').forEach((d) => {
      const age = (performance.now() - d.born) / 1000; if (age > 8) return;
      const fall = 20 * age + 0.5 * 60 * age * age;
      c.save(); c.setTransform(m); c.globalAlpha = clamp((8 - age) / 2.5, 0, 1);
      c.translate(d.vx * age, fall); c.translate(0, -(d.lo + d.hi) / 2); c.rotate(d.vr * age); c.translate(0, (d.lo + d.hi) / 2);
      stack(def, f.rocket, d.lo, d.hi);
      c.restore();
    });
    cloudPass(true);
    // estelas de aire a gran velocidad
    const al = Math.min(0.45, rho * f.v * 0.5);
    if (al > 0.02) {
      c.strokeStyle = 'rgba(255,255,255,' + al + ')'; c.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) { const x = rnd(0, W), y = rnd(0, H), l = rnd(30, 120); c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx * l, y - dy * l); c.stroke(); }
    }
  }

  // ---------- Nave interplanetaria ----------
  const MOD = [   // mismas salas que js/ship.js, de proa a popa
    { id: 'bridge', n: 'PUENTE', hue: [50, 120, 210], w: 1150 }, { id: 'life', n: 'SOPORTE', hue: [40, 170, 120], w: 1000 },
    { id: 'lab', n: 'LABORAT.', hue: [150, 100, 225], w: 1050 }, { id: 'hangar', n: 'HANGAR', hue: [200, 80, 80], w: 1050 },
    { id: 'power', n: 'ENERGÍA', hue: [220, 170, 40], w: 1000 }, { id: 'prop', n: 'MOTORES', hue: [220, 110, 50], w: 1050 }
  ];
  const MOD_W = MOD.reduce((s, m) => s + m.w, 0);
  function drawShipEnv(f, dt) {
    const p = f.progress;
    if (f.mode === 'config') {                                              // en órbita baja
      c.fillStyle = '#01020a'; c.fillRect(0, 0, W, H);
      stars(1, -1, 0, 18, dt); sun(1360, 120, 1);
      earthScroll += dt * 40; earthLimb(600, 2600, earthScroll, 1);
      return 0;
    }
    c.fillStyle = '#000006'; c.fillRect(0, 0, W, H);
    stars(1, -1, 0, 14 + (f.mode === 'voyage' ? 10 : 0), dt);
    sun(1500, 90, 0.8);
    const u = ease(clamp(p, 0, 1));
    planet(lerp(1250, 1560, u), lerp(690, 760, u), lerp(260, 3, Math.pow(clamp(p * 1.6, 0, 1), 0.5)), 'earth');   // la Tierra se aleja
    const mr = lerp(3, 300, Math.pow(p, 3));
    planet(lerp(160, 200, u), lerp(250, 640, u), mr, 'mars');               // Marte se acerca
    return mr;
  }
  function drawShip(f, dt) {
    drawShipEnv(f, dt);
    const L = 1060, x0 = CX - L / 2 + 40, top = 392, bot = 492, mid = (top + bot) / 2, sc = L / MOD_W;
    const hot = new Set(f.hot || []), blink = Math.floor(tt * 3) % 2, dim = f.bat < 20 ? 0.35 : 1;
    const xs = []; let x = x0; MOD.forEach((m) => { xs.push([x, x + m.w * sc]); x += m.w * sc; });
    const X1 = x;
    const at = (id, k) => { const i = MOD.findIndex((m) => m.id === id); return lerp(xs[i][0], xs[i][1], k); };
    // paneles solares (sala de energía): giran despacio; se apagan con poca batería
    const px = at('power', 0.5);
    c.fillStyle = '#55627a'; c.fillRect(px - 5, top - 160, 10, bot - top + 320);
    [-1, 1].forEach((s) => {
      const y0 = s < 0 ? top - 160 : bot + 30;
      for (let j = 0; j < 2; j++) {
        const yy = y0 + j * 66;
        c.fillStyle = 'rgba(20,58,120,' + (0.6 + 0.4 * dim) + ')'; c.fillRect(px - 190, yy, 380, 58);
        c.strokeStyle = 'rgba(111,182,255,' + 0.8 * dim + ')'; c.lineWidth = 1.5; c.strokeRect(px - 190, yy, 380, 58);
        for (let i = -152; i < 190; i += 38) { c.beginPath(); c.moveTo(px + i, yy); c.lineTo(px + i, yy + 58); c.stroke(); }
        const sh = c.createLinearGradient(px - 190, yy, px + 190, yy + 58); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5 + 0.3 * Math.sin(tt * 0.3), 'rgba(200,230,255,' + 0.25 * dim + ')'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sh; c.fillRect(px - 190, yy, 380, 58);
      }
    });
    // radiadores del soporte vital
    const lx = at('life', 0.5);
    [-1, 1].forEach((s) => { for (let i = 0; i < 3; i++) { c.fillStyle = '#dfe6ee'; c.fillRect(lx - 70 + i * 50, s < 0 ? top - 70 : bot, 34, 70); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(lx - 70 + i * 50 + 26, s < 0 ? top - 70 : bot, 8, 70); } });
    // motores y escape (popa, a la derecha)
    [mid - 32, mid, mid + 32].forEach((y, i) => {
      c.fillStyle = '#39424f'; c.beginPath(); c.moveTo(X1, y - 10); c.lineTo(X1 + 46, y - 22); c.lineTo(X1 + 46, y + 22); c.lineTo(X1, y + 10); c.closePath(); c.fill();
      if (thr > 0.02) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const len = (120 + 220 * thr) * rnd(0.9, 1.1), g = c.createLinearGradient(X1 + 46, 0, X1 + 46 + len, 0);
        g.addColorStop(0, 'rgba(235,250,255,.95)'); g.addColorStop(0.25, 'rgba(70,190,255,.65)'); g.addColorStop(1, 'rgba(30,90,255,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(X1 + 46, y - 20); c.quadraticCurveTo(X1 + 46 + len * 0.6, y - 26, X1 + 46 + len, y); c.quadraticCurveTo(X1 + 46 + len * 0.6, y + 26, X1 + 46, y + 20); c.fill();
        c.restore();
        if (Math.random() < thr) puff(X1 + 50, y + rnd(-12, 12), rnd(300, 500), rnd(-25, 25), rnd(0.3, 0.7), 4, 14, 'rgba(120,190,255,1)', true);
      }
    });
    // morro (proa, a la izquierda)
    c.fillStyle = '#b9c4d2'; c.beginPath(); c.moveTo(x0, top); c.quadraticCurveTo(x0 - 100, top + 6, x0 - 128, mid); c.quadraticCurveTo(x0 - 100, bot - 6, x0, bot); c.closePath(); c.fill();
    c.fillStyle = '#0b1626'; c.beginPath(); c.moveTo(x0 - 30, top + 12); c.quadraticCurveTo(x0 - 80, top + 18, x0 - 104, mid - 6); c.lineTo(x0 - 40, mid - 6); c.closePath(); c.fill();
    c.strokeStyle = '#7fdcff'; c.lineWidth = 2; c.stroke();
    // casco por módulos
    MOD.forEach((m, i) => {
      const [a, b] = xs[i], g = c.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, '#dde4ec'); g.addColorStop(0.35, '#a9b4c2'); g.addColorStop(1, '#4e5868');
      c.fillStyle = g; c.fillRect(a, top, b - a, bot - top);
      c.fillStyle = rgb(m.hue); c.fillRect(a, top + 8, b - a, 7);                                 // franja del módulo
      c.fillStyle = '#2a313c'; c.fillRect(b - 4, top - 4, 8, bot - top + 8);                      // anillo de unión
      for (let wx = a + 22; wx < b - 20; wx += 34) {                                             // ventanillas
        c.fillStyle = hot.has(m.id) && blink ? 'rgba(255,70,60,.95)' : 'rgba(255,214,140,' + (0.25 + 0.6 * dim) + ')';
        c.fillRect(wx, mid - 10, 12, 9);
      }
      c.fillStyle = 'rgba(10,16,26,.75)'; c.font = '700 12px Orbitron, Arial, sans-serif'; c.textAlign = 'center';
      c.fillText(m.n, (a + b) / 2, bot - 12); c.textAlign = 'left';
      if (hot.has(m.id)) {                                                                       // baliza de alarma del módulo
        const bx = (a + b) / 2, g2 = c.createRadialGradient(bx, top - 8, 2, bx, top - 8, 70);
        g2.addColorStop(0, 'rgba(255,60,50,' + (blink ? 0.95 : 0.35) + ')'); g2.addColorStop(1, 'rgba(255,60,50,0)');
        c.fillStyle = g2; c.fillRect(bx - 70, top - 78, 140, 140);
        c.fillStyle = '#ff3c3c'; c.fillRect(bx - 6, top - 14, 12, 10);
        c.strokeStyle = 'rgba(255,60,50,' + (blink ? 0.9 : 0.3) + ')'; c.lineWidth = 3; c.strokeRect(a + 2, top + 2, b - a - 4, bot - top - 4);
      }
    });
    c.fillStyle = A.settings.accent || '#19b4ff'; c.fillRect(x0, mid + 8, X1 - x0, 5);
    c.fillStyle = '#1b2430'; c.font = '700 17px Orbitron, Arial, sans-serif'; c.fillText(A.settings.shipName || 'AEON-01', at('bridge', 0.1), mid + 34);
    // antena del puente: sin señal parpadea y se desapunta
    const ax = at('bridge', 0.6), ang = -0.5 + (f.comms < 35 ? Math.sin(tt * 3) * 0.3 : 0);
    c.fillStyle = '#55627a'; c.fillRect(ax - 3, top - 46, 6, 46);
    c.save(); c.translate(ax, top - 50); c.rotate(ang); c.fillStyle = '#c9d4e2'; c.beginPath(); c.ellipse(0, 0, 40, 11, 0, 0, 7); c.fill();
    c.fillStyle = f.comms < 35 ? (blink ? '#ff3c3c' : '#511') : '#3cff9e'; c.beginPath(); c.arc(0, -20, 4, 0, 7); c.fill(); c.restore();
    if (f.comms >= 35 && f.mode === 'voyage') { c.strokeStyle = 'rgba(120,220,255,.35)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const r = ((tt * 60 + i * 40) % 120) + 20; c.beginPath(); c.arc(ax + 12, top - 70, r, -2.6, -1.9); c.stroke(); } }
    // instrumentos del laboratorio
    const ix = at('lab', 0.5);
    c.fillStyle = '#8f9aa8'; c.fillRect(ix - 2, bot, 4, 40); c.fillStyle = f.instr ? '#ff3c3c' : '#ffd23c'; c.beginPath(); c.arc(ix, bot + 44, 7, 0, 7); c.fill();
    // lander con su escudo térmico (bajo el hangar)
    const hx = at('hangar', 0.5), sh = clamp(f.shield / 100, 0, 1);
    c.fillStyle = '#c9a24a'; c.fillRect(hx - 40, bot, 80, 26);
    c.fillStyle = 'rgb(' + Math.round(lerp(150, 107, sh)) + ',' + Math.round(lerp(40, 58, sh)) + ',' + Math.round(lerp(30, 30, sh)) + ')';
    c.beginPath(); c.ellipse(hx, bot + 30, 66, 14, 0, 0, Math.PI); c.fill();
    if (sh < 0.6) { c.strokeStyle = '#150a05'; c.lineWidth = 2; for (let i = 0; i < Math.round((1 - sh) * 10); i++) { const cx = hx - 50 + (i * 23) % 100; c.beginPath(); c.moveTo(cx, bot + 30); c.lineTo(cx + 6, bot + 36); c.lineTo(cx + 1, bot + 41); c.stroke(); } }
    // fuga de propelente: cristales de hielo saliendo del módulo de motores
    if (f.leak) for (let i = 0; i < 4; i++) puff(at('prop', 0.4) + rnd(-10, 10), top, rnd(-40, 40), rnd(-220, -120), rnd(0.8, 1.6), 2, 9, 'rgba(210,240,255,1)', false);
    // impacto de micrometeorito
    if (f.flash > 0.6) for (let i = 0; i < 6; i++) puff(hx + rnd(-40, 40), bot + 20, rnd(-260, 260), rnd(-200, 200), rnd(0.3, 0.8), 2, 5, 'rgba(255,220,150,1)', true);
    stepParts(dt, 0, 0); drawParts(false); drawParts(true);
    if (f.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + f.flash * 0.35 + ')'; c.fillRect(0, 0, W, H); }
  }

  // ---------- Descenso en Marte ----------
  const LS = 3.6;   // escala del lander
  function aeroshell(shield, heat) {
    c.fillStyle = '#e4e8ee'; c.beginPath(); c.moveTo(-30, 0); c.lineTo(30, 0); c.lineTo(13, -34); c.lineTo(-13, -34); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-21, -18, 42, 3); c.fillStyle = '#8f9aa8'; c.fillRect(-8, -40, 16, 6);
    if (shield) { c.fillStyle = 'rgb(' + Math.round(107 + 120 * heat) + ',' + Math.round(58 + 60 * heat) + ',30)'; c.beginPath(); c.ellipse(0, 0, 33, 10, 0, 0, Math.PI); c.fill(); }
  }
  function lander(firing) {
    c.fillStyle = '#c9a24a'; c.fillRect(-20, -6, 40, 14);
    c.fillStyle = '#e9eef4'; c.fillRect(-14, -16, 28, 10); c.fillStyle = '#39424f'; c.fillRect(-4, -24, 3, 8);
    c.strokeStyle = '#9aa3ad'; c.lineWidth = 2; c.beginPath(); c.moveTo(-16, 8); c.lineTo(-26, 16); c.moveTo(16, 8); c.lineTo(26, 16); c.stroke();
    c.fillStyle = '#9aa3ad'; c.fillRect(-30, 15, 8, 2); c.fillRect(22, 15, 8, 2);
    [-12, 12].forEach((x) => { c.fillStyle = '#39424f'; c.fillRect(x - 3, 8, 6, 5); });
  }
  const ES = { stage: 0, sx: 0 };
  function trackEDL(f) {
    if (f.stage < ES.stage || !ES.stage) { ES.stage = f.stage; debris = debris.filter((d) => d.kind === 'stage'); }
    if (f.stage >= 2.5 && ES.stage < 2.5) { debris.push({ kind: 'shield', born: performance.now() }); say('ESCUDO TÉRMICO LIBERADO'); }
    if (f.stage >= 3 && ES.stage < 3) { debris.push({ kind: 'back', born: performance.now(), chute: f.chute }); say('SEPARACIÓN DE LA CARCASA · DESCENSO PROPULSADO'); }
    ES.stage = f.stage;
  }
  function drawEDL(f, dt) {
    const h = f.h, LX = CX, LY = 420;
    sky(MARS_SKY, h);
    stars(clamp((h - 60) / 50, 0, 1), 0, 1, 20 + f.v / 1000 * 40, dt);
    if (f.stage < 3) {                                                      // limbo de Marte
      const u = clamp((R.ENTRY_H - h) / (R.ENTRY_H - 12), 0, 1), top = lerp(780, 640, ease(u)), Rr = lerp(2200, 9000, u);
      c.save(); c.shadowColor = 'rgba(255,170,120,.6)'; c.shadowBlur = 40 * (1 - u);
      const g = c.createLinearGradient(0, top, 0, H); g.addColorStop(0, '#c0643a'); g.addColorStop(1, '#6e2c14');
      c.fillStyle = g; c.beginPath(); c.arc(CX, top + Rr, Rr, 0, 7); c.fill(); c.restore();
    } else {
      const g = c.createLinearGradient(0, 640, 0, H); g.addColorStop(0, '#b86a40'); g.addColorStop(1, '#7a3418');
      c.fillStyle = g; c.fillRect(0, 640, W, H - 640);
    }
    // suelo cercano en el descenso propulsado
    const gy = f.stage >= 3 ? LY + 17 * LS + Math.max(0, f.hm) * 0.25 : H + 99;
    if (gy < H + 20) {
      const g = c.createLinearGradient(0, gy, 0, H); g.addColorStop(0, '#9a4a24'); g.addColorStop(1, '#5a2110');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, gy + 30); c.quadraticCurveTo(400, gy - 10, 800, gy); c.quadraticCurveTo(1200, gy + 10, 1600, gy + 26); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      const z = clamp(1 - f.hm / 1500, 0.15, 1);
      rocks.forEach(([rx, ry, rs]) => { c.fillStyle = 'rgba(60,22,8,.7)'; c.beginPath(); c.ellipse(CX + rx * 900, gy + ry * (H - gy), rs * z * 2, rs * z, 0, 0, 7); c.fill(); });
      if (f.firing && f.hm < 80) for (let i = 0; i < 5; i++) puff(CX + rnd(-30, 30), gy, rnd(-420, 420), rnd(-90, -10), rnd(1, 2.2), 8, 46, 'rgba(200,130,90,1)', false);
    }
    // piezas que se sueltan
    debris.forEach((d) => {
      const age = (performance.now() - d.born) / 1000; if (age > 6 || d.kind === 'stage') return;
      c.save(); c.globalAlpha = clamp((6 - age) / 2, 0, 1);
      if (d.kind === 'shield') { c.translate(LX + age * 8, LY + 30 * age + 160 * age * age); c.rotate(age * 0.6); c.scale(LS, LS); c.fillStyle = '#6b3a1e'; c.beginPath(); c.ellipse(0, 0, 33, 10, 0, 0, Math.PI); c.fill(); }
      else { c.translate(LX - age * 30, LY - 40 * age - 90 * age * age); c.rotate(-age * 0.3); c.scale(LS, LS); aeroshell(false, 0); if (d.chute === 'ok' || d.chute === 'late') { c.fillStyle = '#ff7a3c'; c.beginPath(); c.arc(0, -72, 36, Math.PI, 0); c.fill(); } }
      c.restore();
    });
    // vehículo
    const tilt = f.stage === 1 ? f.a * 0.4 : 0, shake = f.stage === 1 ? f.heat * 4 : f.firing ? 1.5 : 0;
    c.save(); c.translate(LX + rnd(-shake, shake), LY + rnd(-shake, shake)); c.rotate(tilt);
    if (f.stage < 3 && f.heat > 0.03) {                                     // plasma de la entrada
      c.save(); c.globalCompositeOperation = 'lighter';
      const hot = f.off > 0 ? 'rgba(255,70,40,' : 'rgba(255,150,60,';
      const g = c.createRadialGradient(0, 36, 10, 0, 20, 220); g.addColorStop(0, 'rgba(255,245,220,' + f.heat + ')'); g.addColorStop(0.3, hot + 0.75 * f.heat + ')'); g.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 40, 200, 120, 0, 0, 7); c.fill();
      for (let i = 0; i < 2 + f.heat * 6; i++) puff(LX + rnd(-110, 110), LY + 30, rnd(-30, 30), rnd(-700, -400), rnd(0.2, 0.5), 6, 2, f.off > 0 ? 'rgba(255,80,40,1)' : 'rgba(255,170,80,1)', true);
      c.restore();
    }
    c.scale(LS, LS);
    if (f.stage >= 2.5 && f.stage < 3 && f.chute !== 'rip') {              // paracaídas
      c.strokeStyle = '#ddd'; c.lineWidth = 0.6; [-24, -8, 8, 24].forEach((x) => { c.beginPath(); c.moveTo(0, -38); c.lineTo(x * 1.4, -72); c.stroke(); });
      const ok = f.chute === 'ok', r = ok ? 36 : 24;
      c.fillStyle = ok ? '#ff7a3c' : '#c9a37a'; c.beginPath(); c.arc(0, -72, r, Math.PI, 0); c.fill();
      c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0, -72); c.arc(0, -72, r, Math.PI + i * Math.PI / 4, Math.PI + i * Math.PI / 4 + Math.PI / 8); c.closePath(); c.fill(); }
    }
    if (f.stage >= 2.5 && f.stage < 3 && f.chute === 'rip') { c.strokeStyle = '#c9a37a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -38); c.quadraticCurveTo(10 * Math.sin(tt * 9), -70, -6, -100); c.stroke(); }
    if (f.stage < 3) aeroshell(f.stage < 2.5, f.heat);
    else {
      if (f.firing) { c.save(); c.globalCompositeOperation = 'lighter'; [-12, 12].forEach((x) => flame(x, 13, 3, rnd(30, 44), 6, 'h2')); c.restore(); }
      lander(f.firing);
    }
    c.restore();
    stepParts(dt, 0, f.stage >= 3 ? 0 : -60); drawParts(false); drawParts(true);
  }

  // ---------- HUD mínimo ----------
  const hud = $('#ext-hud'), alertsEl = $('#ext-alerts'), msgEl = $('#ext-msg');
  let alertKey = '';
  function row(i, label, val, unit, pct, bad) {
    hud.children[i].querySelector('label').textContent = label;
    hud.children[i].querySelector('b').textContent = val;
    hud.children[i].querySelector('small').textContent = unit;
    const bar = hud.children[i].querySelector('i'); bar.style.width = clamp(pct, 0, 100) + '%'; bar.classList.toggle('danger', !!bad);
  }
  const layer = (h) => h < 12 ? 'TROPOSFERA' : h < 50 ? 'ESTRATOSFERA' : h < 85 ? 'MESOSFERA' : h < R.KARMAN ? 'TERMOSFERA' : 'ESPACIO · SOBRE LA LÍNEA DE KÁRMÁN';
  function renderHud(f, dt) {
    let sub = '', al = f.alerts || [], m = f.msg || '';
    if (f.kind === 'launch') {
      sub = f.t < 0 ? 'CUENTA ATRÁS · T - ' + Math.ceil(-f.t) : 'FASE 1 · ' + layer(f.h);
      row(0, 'ALTITUD', fmt(f.h, f.h < 10 ? 1 : 0), 'km', f.h / R.KARMAN * 100, false);
      row(1, 'VELOCIDAD', fmt(f.v, 1), '/ ' + fmt(R.V_LEO, 1) + ' km/s', f.v / R.V_LEO * 100, false);
      row(2, 'COMBUSTIBLE', f.fuel.toFixed(0), '%', f.fuel, f.fuel < 15);
    } else if (f.kind === 'edl') {
      const km = f.stage < 3;
      sub = 'FASE 3 · DESCENSO EN MARTE' + (f.stage < 2.5 ? ' · ENTRADA ATMOSFÉRICA' : f.stage < 3 ? ' · PARACAÍDAS' : f.landed ? ' · EN SUPERFICIE' : ' · DESCENSO PROPULSADO');
      row(0, 'ALTITUD', km ? fmt(f.h, f.h < 20 ? 1 : 0) : Math.max(0, f.hm).toFixed(0), km ? 'km' : 'm', km ? f.h / R.ENTRY_H * 100 : f.hm / 26, false);
      row(1, 'VELOCIDAD', f.v > 1000 ? fmt(f.v / 1000, 2) : fmt(f.v, f.stage >= 3 ? 1 : 0), f.v > 1000 ? 'km/s' : 'm/s', f.stage < 3 ? f.v / 55 : f.v / 2, f.stage >= 3 && f.v > 10 && f.hm < 200);
      row(2, 'PROPELENTE', f.fuel.toFixed(0), '%', f.fuel, f.fuel < 20);
    } else {
      const left = R.CRUISE_KM * (1 - clamp(f.progress, 0, 1)) / 1e6;
      if (f.mode === 'config') { sub = '3.2 · EN ÓRBITA TERRESTRE'; row(0, 'ÓRBITA', 'BAJA', '> ' + R.KARMAN + ' km', 100, false); row(1, 'VELOCIDAD', fmt(R.V_LEO, 1), 'km/s', 100, false); }
      else {
        sub = f.mode === 'arrived' ? 'FASE 2 · LLEGADA A MARTE' : 'FASE 2 · VIAJE INTERPLANETARIO · DÍA ' + String(Math.floor(f.day)).padStart(3, '0') + ' / ' + R.CRUISE_DAYS;
        row(0, 'TRAYECTO RESTANTE', fmt(left, left < 10 ? 1 : 0), 'millones de km', 100 - f.progress * 100, false);
        row(1, 'VELOCIDAD MEDIA', fmt(R.CRUISE_KM / (R.CRUISE_DAYS * 86400), 1), 'km/s respecto al Sol', 100, false);
      }
      row(2, 'COMBUSTIBLE · Δv', fmt(Math.max(0, f.dv), 2), 'km/s', f.dv0 > 0 ? f.dv / f.dv0 * 100 : 100, f.leak || f.dv < 0.5);
      if (al.length && f.mode === 'voyage') m = 'Pulsa C para volver adentro y reparar el módulo en alarma.';
    }
    $('#ext-sub').textContent = sub;
    const key = al.join('|');
    if (key !== alertKey) {
      alertKey = key;
      alertsEl.innerHTML = al.length ? '<div class="alrt-h">⚠ ALERTAS DE EMERGENCIA</div>' + al.map((t) => '<div class="alrt"><span>' + t + '</span></div>').join('') : '';
    }
    const ba = bannerAge();
    $('#ext-banner').textContent = ba < 3.2 ? banner.txt : '';
    $('#ext-banner').style.opacity = clamp(3.2 - ba, 0, 1);
    msgEl.textContent = m; msgEl.style.display = m ? '' : 'none';
  }

  // ---------- Bucle ----------
  function track(f) { if (f.kind === 'launch') trackLaunch(f); else if (f.kind === 'edl') trackEDL(f); }
  function frame(now) {
    raf = 0; if (!on) return;
    const f = feed();
    if (!f || blocked()) { set(false); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    if (f.kind !== kind) { kind = f.kind; parts = []; RS.k = 0; banner = null; }
    thr += ((f.thrust || 0) - thr) * (1 - Math.exp(-dt * 9));
    track(f);
    if (f.kind === 'launch') drawLaunch(f, dt);
    else if (f.kind === 'edl') drawEDL(f, dt);
    else drawShip(f, dt);
    renderHud(f, dt);
    raf = requestAnimationFrame(frame);
  }
  function set(v) {
    if (v === on) return;
    on = v;
    root.classList.toggle('hidden', !on);
    btn.classList.toggle('on', on);
    btn.querySelector('span').textContent = on ? 'C · VOLVER ADENTRO' : 'C · CÁMARA EXTERIOR';
    A.beep(on ? 620 : 420, 0.08);
    if (on) {
      const f = feed(); kind = f ? f.kind : ''; parts = []; RS.k = 0; alertKey = null;
      if (f && f.onEnter) f.onEnter();
      last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
    }
  }
  function toggle() { if (on) set(false); else if (available()) set(true); }
  A.exterior = { toggle, get on() { return on; } };

  // el botón solo aparece cuando hay vuelo; las separaciones se registran aunque se mire desde dentro
  setInterval(() => {
    const f = !on && feed();
    if (f && !blocked()) track(f);
    btn.classList.toggle('hidden', !(on || (f && !blocked())));
  }, 200);
  btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); btn.blur(); });

  // C alterna la cámara. Fuera de la nave interior no se camina: se bloquean A/D/E/Espacio
  // mientras se mira desde fuera (en el despegue y el descenso los mandos siguen activos).
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!e.repeat && (on || available())) toggle();
      e.preventDefault(); return;
    }
    if (on && kind === 'ship' && ['a', 'd', 'e', ' ', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
