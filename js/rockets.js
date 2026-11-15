/* AEON-01 — Cohetes en 2D: catálogo, dibujo por código y calcomanías.
   Cada cohete es también un vehículo de lanzamiento de js/mission.js (mismo id), así que
   elegirlo fija la capacidad de carga y el coste. Se dibujan con la base en el origen y
   1000 unidades de alto para el más grande; draw() los escala al tamaño pedido. */
(function () {
  'use strict';
  const A = window.AEON;
  const K = '#14181f';

  const LIST = [
    { id: 'ares-m', name: 'CENTELLA', sub: 'Avión espacial ligero', rel: 0.72, hw: 34,
      info: 'Diseño propio del Equipo 7: despega en vertical y regresa planeando. Poca carga y bajo coste.',
      slots: [[0, 395, 46], [0, 235, 50], [0, 120, 44]] },
    { id: 'titan-x', name: 'X', sub: 'Nave de acero reutilizable', rel: 0.86, hw: 70,
      info: 'Casco de acero inoxidable y cuatro aletas para frenar en la atmósfera. La mayor capacidad de carga.',
      slots: [[0, 500, 86], [0, 345, 86], [0, 190, 80]] },
    { id: 'ares-h', name: 'APOLLO 11', sub: 'Saturno V · 1969', rel: 1, hw: 46,
      info: 'El cohete de tres etapas que llevó a la primera tripulación a la Luna en julio de 1969.',
      slots: [[0, 545, 62], [0, 165, 62], [0, 742, 40]] }
  ];
  const get = (id) => LIST.find((r) => r.id === id) || LIST[2];

  // ---------- Primitivas (y hacia arriba = altura h) ----------
  const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], -p[1]) : c.moveTo(p[0], -p[1]))); c.closePath(); };
  /** Sombrea el trazado actual como un volumen redondo de semiancho hw centrado en cx. */
  function vol(c, hw, cx) {
    cx = cx || 0;
    c.save(); c.clip();
    const g = c.createLinearGradient(cx - hw, 0, cx + hw, 0);
    g.addColorStop(0, 'rgba(0,0,0,.16)'); g.addColorStop(0.2, 'rgba(255,255,255,.3)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    c.fillStyle = g; c.fillRect(cx - hw - 400, -1200, hw * 2 + 800, 1400); c.restore();
  }
  const fill = (c, pts, col) => { poly(c, pts); c.fillStyle = col; c.fill(); };
  const cyl = (c, hw, h0, h1, col, cx) => { cx = cx || 0; fill(c, [[cx - hw, h0], [cx + hw, h0], [cx + hw, h1], [cx - hw, h1]], col); vol(c, hw, cx); };
  const cone = (c, hw0, hw1, h0, h1, col, cx) => { cx = cx || 0; fill(c, [[cx - hw0, h0], [cx + hw0, h0], [cx + hw1, h1], [cx - hw1, h1]], col); vol(c, Math.max(hw0, hw1), cx); };
  const bell = (c, cx, hTop, hBot, wTop, wBot) => { cone(c, wBot, wTop, hBot, hTop, '#39424f', cx); fill(c, [[cx - wBot, hBot], [cx + wBot, hBot], [cx + wBot, hBot + 5], [cx - wBot, hBot + 5]], '#0c0f14'); };
  const both = (fn) => { fn(1); fn(-1); };

  // ---------- APOLLO 11 (Saturno V) ----------
  function apollo(c, paint) {
    const B = paint || '#eef2f6';
    [-31, 0, 31].forEach((x) => bell(c, x, 40, 0, 9, 17));                                  // motores de la primera etapa
    both((s) => { fill(c, [[s * 44, 40], [s * 86, 40], [s * 44, 128]], K); fill(c, [[s * 40, 40], [s * 60, 40], [s * 44, 108]], '#2a313c'); });   // aletas y carenados
    cyl(c, 46, 40, 400, B);                                                                 // primera etapa
    both((s) => cyl(c, 15, 40, 122, K, s * 31));
    cyl(c, 46, 348, 400, K); cyl(c, 15, 348, 400, B);
    cyl(c, 46, 400, 640, B); cyl(c, 46, 400, 428, K); cyl(c, 46, 624, 640, K);              // segunda etapa
    cone(c, 46, 30, 640, 690, K);
    cyl(c, 30, 690, 790, B); cyl(c, 30, 690, 702, K);                                       // tercera etapa
    cone(c, 30, 18, 790, 850, B);
    cyl(c, 18, 850, 895, '#cdd5de'); cyl(c, 18, 850, 856, K);                               // módulo de servicio
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; [-9, 0, 9].forEach((x) => { c.beginPath(); c.moveTo(x, -860); c.lineTo(x, -892); c.stroke(); });
    cone(c, 18, 5, 895, 926, '#e3e8ee');                                                    // módulo de mando
    c.strokeStyle = '#8f9aa8'; c.lineWidth = 2;                                             // torre de escape
    c.beginPath(); c.moveTo(-5, -926); c.lineTo(-3, -960); c.moveTo(5, -926); c.lineTo(3, -960); c.moveTo(-5, -926); c.lineTo(3, -944); c.moveTo(5, -926); c.lineTo(-3, -944); c.moveTo(-4, -944); c.lineTo(3, -960); c.stroke();
    cone(c, 6, 4, 954, 962, '#39424f'); cyl(c, 4, 962, 990, '#eef2f6'); fill(c, [[-4, 990], [4, 990], [0, 1000]], '#eef2f6');
    c.fillStyle = '#c8102e'; c.font = '900 30px Orbitron, Arial, sans-serif'; c.textAlign = 'center';     // rótulo
    ['U', 'S', 'A'].forEach((l, i) => c.fillText(l, 0, -306 + i * 36));
    c.textAlign = 'left';
  }

  // ---------- X (nave de acero) ----------
  function xship(c, paint) {
    const S = paint || '#c3ccd6', F = paint || '#a9b4c1';
    [-30, 0, 30].forEach((x) => bell(c, x, 26, 0, 9, 16));
    both((s) => {                                                                           // aletas traseras y delanteras
      fill(c, [[s * 60, 26], [s * 152, 26], [s * 152, 150], [s * 60, 268]], F); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
      fill(c, [[s * 140, 26], [s * 152, 26], [s * 152, 150], [s * 140, 166]], K);
      fill(c, [[s * 50, 612], [s * 114, 612], [s * 114, 706], [s * 50, 800]], F); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
      fill(c, [[s * 104, 612], [s * 114, 612], [s * 114, 706], [s * 104, 722]], K);
    });
    cyl(c, 70, 26, 620, S);                                                                 // cuerpo
    c.beginPath(); c.moveTo(-70, -620); c.quadraticCurveTo(-66, -800, 0, -860); c.quadraticCurveTo(66, -800, 70, -620); c.closePath();
    c.fillStyle = S; c.fill(); vol(c, 70);                                                  // ojiva
    c.strokeStyle = 'rgba(0,0,0,.17)'; c.lineWidth = 2;                                     // anillos de soldadura
    for (let h = 86; h <= 620; h += 60) { c.beginPath(); c.moveTo(-70, -h); c.lineTo(70, -h); c.stroke(); }
    both((s) => { cyl(c, 5, 26, 268, K, s * 65); cyl(c, 4, 612, 700, K, s * 66); });         // bisagras de las aletas
    cyl(c, 70, 26, 40, '#2a313c');
    c.fillStyle = 'rgba(10,20,34,.75)'; c.beginPath(); c.arc(-34, -596, 9, 0, 7); c.arc(34, -430, 7, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-40, -60); c.lineTo(-40, -600); c.stroke();     // canalización exterior
  }

  // ---------- CENTELLA (avión espacial, diseño propio) ----------
  function centella(c, paint) {
    const B = paint || '#e9eef4', T = paint ? '#ffffff' : '#ff7a3c';
    bell(c, 0, 62, 0, 14, 30);
    both((s) => {
      fill(c, [[s * 28, 345], [s * 192, 74], [s * 192, 38], [s * 28, 62]], paint || '#b9c5d3');           // ala en delta
      if (paint) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fill(); }
      fill(c, [[s * 28, 345], [s * 192, 74], [s * 192, 60], [s * 28, 322]], T);                           // borde de ataque
      fill(c, [[s * 190, 38], [s * 206, 38], [s * 206, 176], [s * 190, 122]], K);                         // deriva de punta de ala
      bell(c, s * 106, 46, 22, 7, 12);                                                                    // góndola de motor
      cyl(c, 13, 46, 168, '#d3dbe4', s * 106); cone(c, 13, 3, 168, 204, '#d3dbe4', s * 106);
      fill(c, [[s * 26, 452], [s * 84, 420], [s * 84, 408], [s * 26, 418]], '#8f9aa8');                   // plano delantero
    });
    c.beginPath(); c.moveTo(-34, -62); c.lineTo(-34, -470); c.quadraticCurveTo(-30, -650, 0, -720); c.quadraticCurveTo(30, -650, 34, -470); c.lineTo(34, -62); c.closePath();
    c.fillStyle = B; c.fill(); vol(c, 34);                                                  // fuselaje
    cyl(c, 34, 62, 80, '#2a313c'); cyl(c, 34, 292, 302, T);
    const g = c.createLinearGradient(-14, -610, 14, -520); g.addColorStop(0, '#5ec2ff'); g.addColorStop(0.5, '#0b2a52'); g.addColorStop(1, '#04101f');
    c.beginPath(); c.moveTo(0, -628); c.quadraticCurveTo(19, -590, 15, -528); c.lineTo(-15, -528); c.quadraticCurveTo(-19, -590, 0, -628); c.closePath();
    c.fillStyle = g; c.fill(); c.strokeStyle = '#8f9aa8'; c.lineWidth = 2.5; c.stroke();     // cabina
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-34, -470); c.lineTo(34, -470); c.stroke();
  }
  const DRAW = { 'ares-m': centella, 'titan-x': xship, 'ares-h': apollo };

  // ---------- Calcomanías (caja de 100 × 100 centrada en el origen) ----------
  let userImg = null, userSrc = '';
  function customImage() {
    const src = A.settings.stickerImg || '';
    if (src !== userSrc) { userSrc = src; userImg = null; if (src) { const im = new Image(); im.onload = () => { userImg = im; }; im.src = src; } }
    return userImg;
  }
  const star = (c, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.42 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); };
  const STICKERS = [
    { id: 'aeon', name: 'Emblema AEON', draw(c) {
      c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(Math.cos(i * Math.PI / 3 + Math.PI / 6) * 48, Math.sin(i * Math.PI / 3 + Math.PI / 6) * 48); c.closePath();
      c.fillStyle = '#0a1a3a'; c.fill(); c.strokeStyle = '#19b4ff'; c.lineWidth = 5; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -30); c.lineTo(25, 24); c.lineTo(12, 24); c.lineTo(0, -4); c.lineTo(-12, 24); c.lineTo(-25, 24); c.closePath(); c.fill();
      c.fillStyle = '#ff7a3c'; c.beginPath(); c.arc(0, 15, 6, 0, 7); c.fill();
    } },
    { id: 'e7', name: 'Equipo 7', draw(c) {
      c.fillStyle = '#10151d'; c.beginPath(); c.arc(0, 0, 46, 0, 7); c.fill(); c.strokeStyle = '#ffc93c'; c.lineWidth = 6; c.stroke();
      c.fillStyle = '#ffc93c'; c.textAlign = 'center'; c.font = '700 11px Orbitron, Arial, sans-serif'; c.fillText('EQUIPO', 0, -22);
      c.fillStyle = '#fff'; c.font = '900 52px Orbitron, Arial, sans-serif'; c.fillText('7', 0, 30); c.textAlign = 'left';
    } },
    { id: 'mars', name: 'Destino Marte', draw(c) {
      const g = c.createRadialGradient(-12, -12, 4, 0, 0, 40); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#8a3216');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 36, 0, 7); c.fill();
      c.fillStyle = 'rgba(90,30,10,.5)'; [[-12, 6, 7], [14, -10, 5], [8, 16, 4]].forEach((o) => { c.beginPath(); c.arc(o[0], o[1], o[2], 0, 7); c.fill(); });
      c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, 48, 16, -0.5, 0.35, Math.PI * 1.75); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(38, -28, 6, 0, 7); c.fill();
    } },
    { id: 'star', name: 'Estrella', draw(c) { star(c, 46); c.fillStyle = '#ffc93c'; c.fill(); c.strokeStyle = '#10151d'; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke(); } },
    { id: 'chev', name: 'Galones', draw(c) {
      ['#fff', '#19b4ff', '#fff'].forEach((col, i) => { const y = -34 + i * 26; c.fillStyle = col; c.beginPath(); c.moveTo(-44, y + 20); c.lineTo(0, y - 6); c.lineTo(44, y + 20); c.lineTo(44, y + 36); c.lineTo(0, y + 10); c.lineTo(-44, y + 36); c.closePath(); c.fill(); c.strokeStyle = '#10151d'; c.lineWidth = 3; c.stroke(); });
    } },
    { id: 'bolt', name: 'Rayo', draw(c) {
      c.beginPath(); c.moveTo(12, -48); c.lineTo(-26, 6); c.lineTo(-4, 6); c.lineTo(-14, 48); c.lineTo(28, -10); c.lineTo(4, -10); c.closePath();
      c.fillStyle = '#ffe14a'; c.fill(); c.strokeStyle = '#10151d'; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke();
    } },
    { id: 'img', name: 'Tu imagen', draw(c) {
      const im = customImage();
      c.save(); c.beginPath(); c.roundRect(-46, -46, 92, 92, 10);
      if (im) { c.clip(); const k = Math.min(92 / im.width, 92 / im.height); c.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k); }
      else { c.fillStyle = 'rgba(10,26,58,.6)'; c.fill(); c.setLineDash([8, 6]); c.strokeStyle = '#7fdcff'; c.lineWidth = 4; c.stroke(); c.setLineDash([]); c.fillStyle = '#7fdcff'; c.fillRect(-4, -22, 8, 44); c.fillRect(-22, -4, 44, 8); }
      c.restore();
    } }
  ];
  function sticker(c, id, x, y, size) {
    const s = STICKERS.find((k) => k.id === id); if (!s) return;
    c.save(); c.translate(x, y); c.scale(size / 100, size / 100); c.lineJoin = 'miter'; s.draw(c); c.restore();
  }

  /** Dibuja un cohete con la base en (x, baseY). size = alto en píxeles del cohete más grande.
      o.paint: color principal ('' = librea original) · o.stickers: lista de calcomanías. */
  function draw(c, id, x, baseY, size, o) {
    o = o || {};
    const r = get(id), k = size / 1000;
    c.save(); c.translate(x, baseY); c.scale(k, k); c.lineJoin = 'round';
    DRAW[r.id](c, o.paint || '');
    (o.stickers || []).slice(0, r.slots.length).forEach((sid, i) => { const s = r.slots[i]; sticker(c, sid, s[0], -s[1], s[2]); });
    c.restore();
  }

  A.rockets = { LIST, STICKERS, get, draw, sticker, customImage };
})();
