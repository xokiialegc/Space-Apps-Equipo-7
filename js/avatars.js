/* AEON-01 — Tripulación y avatares (issue #5).
   Cada personaje tiene un retrato. Por defecto se dibuja por código en un lienzo (sin archivos
   externos); si en FILES se indica la ruta de una imagen, se usa esa imagen en su lugar.
   El retrato se muestra en la barra de tripulación, en los diálogos, en los mensajes de radio
   y como icono flotante sobre cada tripulante en el mapa de la nave. */
(function () {
  'use strict';
  const A = window.AEON;

  // Para usar imágenes propias: pon aquí la ruta de cada retrato (cuadrado, p. ej. 256×256).
  const FILES = { player: '', vera: '', iker: '' };          // p. ej. 'assets/avatars/cadete.png'

  const CREW = {
    player: { id: 'player', name: 'Cadet', role: 'Pilot · you', suit: ['#e8eef5', '#a3b0c0'], skin: '#e9b98f', hair: '#4a3222', style: 'short' },
    vera: { id: 'vera', name: 'Vera Kalani', role: 'Flight engineer', suit: ['#f3b06a', '#c07f3e'], tint: '#ff9a3c', skin: '#b9794f', hair: '#1c1418', style: 'bun' },
    iker: { id: 'iker', name: 'Iker Solano', role: 'Systems technician', suit: ['#86dccb', '#4f9f90'], tint: '#3cdfb0', skin: '#f0c8a4', hair: '#7a4a22', style: 'beard' }
  };
  const SIZE = 128, cache = {};

  /** Retrato dibujado por código: busto con traje, cuello del casco y rostro. */
  function paint(p, accent) {
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    const c = cv.getContext('2d'), tint = p.tint || accent;
    const ell = (x, y, rx, ry, fill) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
    c.save(); c.beginPath(); c.arc(64, 64, 62, 0, 7); c.clip();
    const bg = c.createRadialGradient(64, 46, 6, 64, 64, 74); bg.addColorStop(0, '#1d5a9e'); bg.addColorStop(1, '#04101f');
    c.fillStyle = bg; c.fillRect(0, 0, SIZE, SIZE);
    c.fillStyle = 'rgba(255,255,255,.75)'; [[20, 26], [104, 34], [30, 62], [98, 70], [56, 14]].forEach((s) => c.fillRect(s[0], s[1], 2, 2));
    // casco abierto por detrás de la cabeza
    ell(64, 56, 43, 45, '#dfe7f0'); ell(64, 57, 37, 39, '#0a1a30');
    // hombros y pecho del traje
    const sg = c.createLinearGradient(0, 92, 0, 128); sg.addColorStop(0, p.suit[0]); sg.addColorStop(1, p.suit[1]);
    c.fillStyle = sg; c.beginPath(); c.moveTo(6, 128); c.quadraticCurveTo(10, 96, 42, 92); c.lineTo(86, 92); c.quadraticCurveTo(118, 96, 122, 128); c.fill();
    c.fillStyle = tint; c.fillRect(14, 114, 100, 6);
    c.fillStyle = '#c3cedb'; c.fillRect(74, 100, 18, 11); c.fillStyle = '#3cff9e'; c.fillRect(77, 103, 5, 4);
    // anillo del cuello
    ell(64, 94, 27, 8, '#8b98ab'); ell(64, 92, 23, 6, '#39455a');
    // cuello y cabeza
    c.fillStyle = p.skin; c.fillRect(55, 78, 18, 14);
    if (p.style === 'bun') { ell(64, 27, 11, 10, p.hair); ell(64, 52, 25, 28, p.hair); }
    ell(64, 58, 21, 25, p.skin);
    ell(43, 60, 4, 6, p.skin); ell(85, 60, 4, 6, p.skin);
    // pelo
    c.fillStyle = p.hair; c.beginPath();
    if (p.style === 'bun') { c.moveTo(42, 56); c.quadraticCurveTo(40, 30, 64, 30); c.quadraticCurveTo(88, 30, 86, 56); c.quadraticCurveTo(78, 40, 64, 40); c.quadraticCurveTo(50, 40, 42, 56); }
    else { c.moveTo(42, 54); c.quadraticCurveTo(38, 28, 64, 29); c.quadraticCurveTo(92, 28, 86, 54); c.quadraticCurveTo(82, 42, 70, 40); c.quadraticCurveTo(52, 46, 42, 54); }
    c.fill();
    if (p.style === 'beard') {
      c.beginPath(); c.moveTo(44, 62); c.quadraticCurveTo(46, 88, 64, 86); c.quadraticCurveTo(82, 88, 84, 62); c.quadraticCurveTo(80, 72, 64, 72); c.quadraticCurveTo(48, 72, 44, 62); c.fill();
    }
    // ojos, cejas y boca
    ell(55, 58, 3.4, 3.8, '#fff'); ell(73, 58, 3.4, 3.8, '#fff'); ell(55.5, 58.5, 1.9, 2.2, '#16202e'); ell(73.5, 58.5, 1.9, 2.2, '#16202e');
    c.strokeStyle = p.hair; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(50, 51); c.lineTo(59, 50); c.moveTo(69, 50); c.lineTo(78, 51); c.stroke();
    c.strokeStyle = p.style === 'beard' ? '#f6d9c0' : '#7a3b2a'; c.lineWidth = 2;
    c.beginPath(); c.arc(64, 68, 7, 0.25, Math.PI - 0.25); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(64, 60); c.lineTo(62, 66); c.lineTo(65, 66); c.stroke();
    // brillo del casco
    c.strokeStyle = 'rgba(210,240,255,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(64, 57, 40, 3.5, 4.4); c.stroke();
    c.restore();
    c.strokeStyle = tint; c.lineWidth = 4; c.beginPath(); c.arc(64, 64, 61, 0, 7); c.stroke();
    return cv;
  }

  /** Lienzo o imagen del retrato (para dibujarlo en el Canvas del juego). */
  function image(id) {
    const p = CREW[id], accent = A.settings.accent, key = id + (p.tint ? '' : accent);
    if (!cache[key]) {
      const cv = paint(p, accent), o = { img: cv, url: cv.toDataURL() };
      if (FILES[id]) { const im = new Image(); im.onload = () => { o.img = im; o.url = FILES[id]; }; im.src = FILES[id]; }
      cache[key] = o;
    }
    return cache[key];
  }

  A.crew = CREW;
  A.avatar = {
    img: (id) => image(id).img,
    url: (id) => image(id).url,
    /** Etiqueta <img> lista para insertar en la interfaz. */
    tag: (id, size) => '<img class="avatar" src="' + image(id).url + '" alt="' + CREW[id].name + '" width="' + (size || 44) + '" height="' + (size || 44) + '" draggable="false">'
  };
})();
