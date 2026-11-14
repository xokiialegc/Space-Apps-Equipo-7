/* AEON-01 — Vista exterior por las ventanas de la cabina durante la Fase 1.
   Se dibuja en un canvas DETRÁS de la imagen de cabina (que tiene los cristales transparentes).
   Depende solo del estado del vuelo: altitud h (km), velocidad v (km/s), presión dinámica q,
   si los motores están encendidos y el tiempo T de la misión. */
(function () {
  'use strict';
  const W = 1600, H = 900, CX = 800, Y0 = 330;     // Y0: centro visual del parabrisas
  const cv = document.querySelector('#sky'), c = cv.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Recursos generados una sola vez ----------
  function cloudSprite() {                         // nube de cúmulos con sombra inferior
    const s = document.createElement('canvas'); s.width = 420; s.height = 200;
    const g = s.getContext('2d');
    const puffs = [];
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
  const sprites = [0, 1, 2, 3, 4, 5].map(cloudSprite);

  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({ x: rnd(-200, W + 200), alt: rnd(0.6, 13), s: sprites[i % 6], w: rnd(0.6, 1.4), drift: rnd(4, 14) });
  }
  const stars = [];
  for (let i = 0; i < 520; i++) stars.push({ x: rnd(-300, W + 300), y: rnd(-300, H), r: rnd(0.4, 1.8), p: rnd(0, 6.28), s: rnd(0.8, 3) });
  const streaks = [];
  for (let i = 0; i < 70; i++) streaks.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(40, 160), sp: rnd(0.7, 1.3) });
  const steam = [];

  // textura de la Tierra (franja que se desplaza)
  const earth = document.createElement('canvas'); earth.width = 3200; earth.height = 420;
  (function paintEarth() {
    const g = earth.getContext('2d');
    const base = g.createLinearGradient(0, 0, 0, 420);
    base.addColorStop(0, '#2c7fd6'); base.addColorStop(1, '#0b3b86');
    g.fillStyle = base; g.fillRect(0, 0, 3200, 420);
    for (let i = 0; i < 40; i++) {                 // continentes
      const x = rnd(0, 3200), y = rnd(20, 400);
      g.fillStyle = 'rgba(' + mix(60, 150, Math.random()) + ',' + mix(110, 150, Math.random()) + ',70,.75)';
      g.beginPath(); g.ellipse(x, y, rnd(60, 260), rnd(18, 60), rnd(-0.4, 0.4), 0, 7); g.fill();
    }
    for (let i = 0; i < 260; i++) {                // nubes
      g.fillStyle = 'rgba(255,255,255,' + rnd(0.15, 0.6) + ')';
      g.beginPath(); g.ellipse(rnd(0, 3200), rnd(0, 420), rnd(30, 180), rnd(5, 18), rnd(-0.2, 0.2), 0, 7); g.fill();
    }
  })();

  let earthScroll = 0, sunPulse = 0;

  // ---------- Dibujo ----------
  function draw(st, firing, mode, dt, now) {
    const h = st.h, v = st.v, q = st.q || 0, rho = Math.exp(-h / 12);
    const space = clamp(h / 75, 0, 1);              // 0 = cielo diurno, 1 = espacio negro
    const tsec = now / 1000;

    c.save();
    // giro de gravedad: el horizonte se inclina poco a poco al ganar altura
    const tilt = clamp(h / 100, 0, 1) * -0.09;
    c.translate(CX, Y0); c.rotate(tilt); c.translate(-CX, -Y0);

    // cielo
    const top = [mix(38, 0, space), mix(110, 2, space), mix(215, 8, space)];
    const hor = [mix(170, 6, space), mix(215, 14, space), mix(255, 34, space)];
    const g = c.createLinearGradient(0, -200, 0, H);
    g.addColorStop(0, 'rgb(' + top + ')'); g.addColorStop(1, 'rgb(' + hor + ')');
    c.fillStyle = g; c.fillRect(-300, -300, W + 600, H + 600);

    // estrellas que aparecen y titilan
    const sa = clamp((h - 22) / 45, 0, 1);
    if (sa > 0) {
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(tsec * s.s + s.p);
        c.fillStyle = 'rgba(230,240,255,' + (sa * tw * (0.35 + s.r / 2.4)) + ')';
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill();
      }
    }

    // sol y destello
    const sun = clamp((h - 30) / 50, 0, 1);
    if (sun > 0) {
      sunPulse += dt;
      const sx = 1340, sy = 120, pr = 1 + Math.sin(sunPulse * 2) * 0.04;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 260 * pr);
      sg.addColorStop(0, 'rgba(255,255,255,' + sun + ')'); sg.addColorStop(0.08, 'rgba(255,250,225,' + 0.8 * sun + ')');
      sg.addColorStop(0.3, 'rgba(140,200,255,' + 0.22 * sun + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.fillRect(sx - 300, sy - 300, 600, 600);
      c.strokeStyle = 'rgba(255,255,240,' + 0.25 * sun + ')'; c.lineWidth = 2;   // rayos
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + tsec * 0.05;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 190, sy + Math.sin(a) * 190); c.stroke();
      }
      [[0.35, 22, 'rgba(160,220,255,'], [0.6, 12, 'rgba(255,210,150,'], [0.85, 30, 'rgba(170,210,255,']].forEach(([k, r, col]) => {
        c.fillStyle = col + 0.1 * sun + ')';
        c.beginPath(); c.arc(sx + (CX - sx) * k * 2, sy + (Y0 - sy) * k * 2, r, 0, 7); c.fill();
      });
    }

    // Tierra que asoma por debajo al acercarse a la órbita
    const up = clamp((h - 45) / 70, 0, 1);
    if (up > 0) {
      const ey = 980 - up * 640, R = 2700;
      earthScroll = (earthScroll + dt * (12 + v * 6)) % 3200;
      c.save();
      c.shadowColor = 'rgba(110,190,255,.95)'; c.shadowBlur = 60;
      c.fillStyle = '#1a5fb8'; c.beginPath(); c.arc(CX, ey + R, R, 0, 7); c.fill();
      c.restore();
      c.save(); c.beginPath(); c.arc(CX, ey + R, R, 0, 7); c.clip();
      c.drawImage(earth, earthScroll, 0, 1600, 420, -300, ey, W + 600, 520);
      c.drawImage(earth, earthScroll - 3200, 0, 1600, 420, -300, ey, W + 600, 520);
      const shade = c.createLinearGradient(0, ey, 0, ey + 300);
      shade.addColorStop(0, 'rgba(160,220,255,.55)'); shade.addColorStop(0.08, 'rgba(60,140,255,.1)'); shade.addColorStop(1, 'rgba(0,10,40,.45)');
      c.fillStyle = shade; c.fillRect(-300, ey, W + 600, 600);
      c.restore();
      c.strokeStyle = 'rgba(150,215,255,' + (0.6 * up) + ')'; c.lineWidth = 6;   // capa de atmósfera
      c.beginPath(); c.arc(CX, ey + R + 4, R + 10, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
    }

    // nubes: se acercan y pasan hacia abajo durante el ascenso
    for (const cl of clouds) {
      cl.x += cl.drift * dt; if (cl.x > W + 400) cl.x = -400;
      const d = cl.alt - h;                          // km por encima de la nave
      if (d < -1.2 || d > 6) continue;
      const k = clamp(1.4 / (Math.abs(d) + 0.5), 0.25, 2.6) * cl.w;
      const y = Y0 - d * 120;
      const a = clamp(1 - space * 1.5, 0, 1) * clamp((d + 1.2) / 0.8, 0, 1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      c.drawImage(cl.s, cl.x - 210 * k, y - 100 * k, 420 * k, 200 * k);
    }
    c.globalAlpha = 1;
    c.restore();

    // torre de lanzamiento en la ventana izquierda (se aleja al despegar)
    const ty = h * 2600;
    if (ty < 900) {
      c.save(); c.translate(0, ty);
      c.fillStyle = '#7e2f22'; c.fillRect(150, 120, 26, 820); c.fillRect(250, 120, 26, 820);
      c.strokeStyle = '#a3402e'; c.lineWidth = 5;
      for (let y = 130; y < 900; y += 46) { c.beginPath(); c.moveTo(150, y); c.lineTo(276, y + 46); c.moveTo(276, y); c.lineTo(150, y + 46); c.stroke(); }
      c.fillStyle = '#5b636e'; c.fillRect(276, 300, 160, 18); c.fillRect(276, 470, 130, 16);   // brazos umbilicales
      c.fillStyle = (mode === 'launch' && st.t > -6 && Math.floor(now / 400) % 2) ? '#ff3c3c' : '#511';
      c.beginPath(); c.arc(163, 110, 8, 0, 7); c.fill();
      c.restore();
    }

    // vapor y humo en la plataforma
    const nearPad = mode === 'launch' && h < 1.2 && st.t > -4;
    if (nearPad && Math.random() < (firing ? 0.9 : 0.35)) {
      const side = Math.random() < 0.5 ? rnd(0, 380) : rnd(1220, W);
      steam.push({ x: side, y: 560 + rnd(0, 60), r: rnd(30, 70), vx: rnd(-20, 20), vy: rnd(-40, -10), a: 0.75 });
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const p = steam[i];
      p.x += p.vx * dt; p.y += (p.vy + v * 900) * dt; p.r += 30 * dt; p.a -= 0.25 * dt;
      if (p.a <= 0 || p.y > H + 200) { steam.splice(i, 1); continue; }
      c.fillStyle = 'rgba(240,242,246,' + p.a + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
    }

    // estelas de aire / condensación sobre el cristal
    const al = clamp(rho * v * 0.6, 0, 0.55);
    if (al > 0.02) {
      c.lineWidth = 2;
      for (const s of streaks) {
        s.y += (300 + v * 700) * s.sp * dt; if (s.y > H) { s.y = rnd(-200, 0); s.x = rnd(0, W); }
        c.strokeStyle = 'rgba(235,245,255,' + al * s.sp * 0.8 + ')';
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + 6, s.y + s.l * Math.min(2.2, 0.6 + v)); c.stroke();
      }
    }

    // plasma por rozamiento: resplandor naranja en los bordes del cristal
    if (q > 0.55) {
      const a = clamp((q - 0.55) * 0.8, 0, 0.7);
      const pg = c.createRadialGradient(CX, Y0, 250, CX, Y0, 900);
      pg.addColorStop(0, 'rgba(255,120,40,0)'); pg.addColorStop(1, 'rgba(255,110,30,' + a + ')');
      c.fillStyle = pg; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,170,90,' + a * 0.8 + ')'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const x = rnd(0, W), y = rnd(0, H);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-6, 6), y + rnd(40, 110)); c.stroke();
      }
    }

    // destello de los motores reflejado
    if (firing && h < 30) {
      const fl = c.createLinearGradient(0, H, 0, 300);
      fl.addColorStop(0, 'rgba(255,170,70,' + (0.22 * rho + rnd(0, 0.06)) + ')'); fl.addColorStop(1, 'rgba(255,170,70,0)');
      c.fillStyle = fl; c.fillRect(0, 300, W, 600);
    }
  }

  // ---------- Marte: entrada, descenso y aterrizaje ----------
  const dunes = []; for (let i = 0; i < 60; i++) dunes.push(rnd(0, 1));
  const rocks = []; for (let i = 0; i < 40; i++) rocks.push([rnd(-200, W + 200), rnd(0, 1), rnd(4, 16)]);
  const dustP = [];
  function drawMars(e, dt, now) {
    const h = e.h, sp = clamp((h - 25) / 60, 0, 1), tsec = now / 1000;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + mix(150, 0, sp) + ',' + mix(105, 2, sp) + ',' + mix(80, 8, sp) + ')');
    g.addColorStop(1, 'rgb(' + mix(232, 20, sp) + ',' + mix(180, 8, sp) + ',' + mix(130, 6, sp) + ')');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (sp > 0) for (const s of stars) { c.fillStyle = 'rgba(230,240,255,' + sp * (0.3 + 0.4 * Math.abs(Math.sin(tsec * s.s + s.p))) + ')'; c.fillRect(s.x, s.y, s.r, s.r); }
    if (h > 12) {                                    // limbo del planeta
      const ey = 250 + sp * 210, R = 2400;
      c.save(); c.shadowColor = 'rgba(255,170,110,.8)'; c.shadowBlur = 50;
      const mg = c.createLinearGradient(0, ey, 0, ey + 400); mg.addColorStop(0, '#e9a26c'); mg.addColorStop(0.2, '#b9562c'); mg.addColorStop(1, '#5a2110');
      c.fillStyle = mg; c.beginPath(); c.arc(CX, ey + R, R, 0, 7); c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(CX, ey + R, R, 0, 7); c.clip(); c.fillStyle = 'rgba(70,25,10,.3)';
      rocks.forEach((r, i) => { c.beginPath(); c.ellipse((r[0] + tsec * 40 * (1 + r[1])) % (W + 400) - 200, ey + 60 + r[1] * 420, 40 + r[2] * 6, 8 + r[2], 0, 0, 7); c.fill(); });
      c.restore();
    } else {                                         // superficie cercana
      const hy = 330 + (1 - clamp(h / 12, 0, 1)) * 150;
      c.fillStyle = '#a34e28'; c.beginPath(); c.moveTo(0, H);
      for (let i = 0; i <= 60; i++) c.lineTo(i * W / 59, hy - dunes[i % 60] * 46 - Math.sin(i * 0.4) * 14);
      c.lineTo(W, H); c.fill();
      const fg = c.createLinearGradient(0, hy, 0, H); fg.addColorStop(0, 'rgba(200,110,60,.6)'); fg.addColorStop(1, '#6e2c14'); c.fillStyle = fg; c.fillRect(0, hy + 10, W, H);
      const near = 1 - clamp(h / 3, 0, 1);
      rocks.forEach((r) => { const y = hy + 30 + r[1] * (H - hy), k = (0.3 + r[1]) * (0.5 + near * 1.6); c.fillStyle = 'rgba(60,22,10,.8)'; c.beginPath(); c.ellipse(r[0], y, r[2] * k * 1.6, r[2] * k * 0.7, 0, 0, 7); c.fill(); });
    }
    if (e.heat > 0.05) {                             // plasma de entrada
      const a = clamp(e.heat, 0, 1), pg = c.createRadialGradient(CX, Y0, 120, CX, Y0, 950);
      pg.addColorStop(0, 'rgba(255,230,170,' + a * 0.35 + ')'); pg.addColorStop(0.5, 'rgba(255,120,40,' + a * 0.6 + ')'); pg.addColorStop(1, 'rgba(255,60,20,' + a * 0.85 + ')');
      c.fillStyle = pg; c.fillRect(0, 0, W, H);
      c.lineWidth = 3;
      for (let i = 0; i < 26 * a; i++) { const x = rnd(0, W), y = rnd(0, H), d = Math.atan2(y - Y0, x - CX); c.strokeStyle = 'rgba(255,' + mix(160, 240, Math.random()) + ',120,' + a * 0.8 + ')'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(d) * rnd(40, 150), y + Math.sin(d) * rnd(40, 150)); c.stroke(); }
    }
    if (e.stage >= 2 && h < 12 && !e.landed) {       // aire pasando
      c.strokeStyle = 'rgba(255,235,215,.35)'; c.lineWidth = 2;
      for (const s of streaks) { s.y -= (200 + e.v * 3) * s.sp * dt; if (s.y < -160) { s.y = H + rnd(0, 100); s.x = rnd(0, W); } c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x, s.y + s.l * 0.6); c.stroke(); }
    }
    if ((e.firing && h < 0.12) || e.landed) {        // polvo levantado por los retropropulsores
      if (e.firing || dustP.length < 8) for (let i = 0; i < 3; i++) dustP.push({ x: rnd(0, W), y: rnd(420, 620), r: rnd(40, 110), a: 0.5, vx: rnd(-60, 60) });
    }
    for (let i = dustP.length - 1; i >= 0; i--) { const p = dustP[i]; p.x += p.vx * dt; p.y -= 30 * dt; p.r += 40 * dt; p.a -= 0.22 * dt; if (p.a <= 0) { dustP.splice(i, 1); continue; } c.fillStyle = 'rgba(214,150,100,' + p.a + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
  }

  window.AEON.sky = { draw, drawMars };
})();
