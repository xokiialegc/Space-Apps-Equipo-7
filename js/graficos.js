/* Programa de Simulación Orbital — gráficos 2D procedurales sobre canvas (sin imágenes externas). */
(function (root) {
  'use strict';
  const W = 960; // ancho lógico de todas las escenas
  const TAU = Math.PI * 2;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { cian: '#4fd8ff', ambar: '#ffb547', verde: '#5be39a', rojo: '#ff5d6c', pared: '#7f93b8', dentro: '#0a1322' };
  const INSTR = ['#4fd8ff', '#ffb547', '#c08bff', '#5be39a', '#ff8fb1', '#f2f2f2'];
  const ESCUDO = { basico: '#a9744c', reforzado: '#74503c', ablativo: '#3d2b27' };

  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const ESTRELLAS = Array.from({ length: 170 }, () => [azar() * W, azar() * 520, azar() < 0.85 ? 1 : 2, azar() * TAU]);
  const ROCAS = Array.from({ length: 26 }, () => [azar() * W, azar(), 4 + azar() * 12]);
  const NUBES = Array.from({ length: 7 }, () => [azar() * W, -200 - azar() * 1100, 60 + azar() * 80]);
  const idx = (lista, id) => Sim.DATA[lista].findIndex((x) => x.id === id);
  const limitar = (v) => Math.max(0, Math.min(1, v));

  /** Bucle de dibujo: se detiene solo cuando el canvas sale del documento. */
  function escena(canvas, H, dibujar) {
    const g = canvas.getContext('2d');
    const t0 = performance.now();
    canvas.style.aspectRatio = `${W} / ${H}`;
    (function cuadro(ahora) {
      if (!canvas.isConnected) return;
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      const cw = Math.round(canvas.clientWidth * dpr) || W;
      const ch = Math.round((cw * H) / W);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      g.setTransform(cw / W, 0, 0, cw / W, 0, 0);
      g.clearRect(0, 0, W, H);
      dibujar(g, quieto ? 0 : (ahora - t0) / 1000, H);
      requestAnimationFrame(cuadro);
    })(t0);
  }

  /* ---------- fondos ---------- */
  function planeta(g, x, y, r, c1, c2, halo) {
    const a = g.createRadialGradient(x, y, r, x, y, r + 30);
    a.addColorStop(0, halo + '99'); a.addColorStop(1, halo + '00');
    g.fillStyle = a; g.beginPath(); g.arc(x, y, r + 30, 0, TAU); g.fill();
    const p = g.createRadialGradient(x - r * 0.3, y - r * 0.9, r * 0.1, x, y, r);
    p.addColorStop(0, c1); p.addColorStop(1, c2);
    g.fillStyle = p; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function espacio(g, t, H, tipo) {
    const f = g.createLinearGradient(0, 0, 0, H);
    f.addColorStop(0, '#03060f'); f.addColorStop(1, '#0a1226');
    g.fillStyle = f; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    for (const [x, y, s, fase] of ESTRELLAS) {
      if (y > H) continue;
      g.globalAlpha = 0.4 + 0.35 * Math.sin(t * 1.5 + fase);
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    if (tipo === 'tierra') planeta(g, 170, H + 540, 620, '#3d83ea', '#0c2a66', '#7fc4ff');
    if (tipo === 'marte') planeta(g, 800, H + 480, 560, '#e0703f', '#6b2412', '#ffb38a');
  }

  /* ---------- piezas comunes ---------- */
  function metal(g, h, tono) {
    const m = g.createLinearGradient(0, -h / 2, 0, h / 2);
    const [a, b, c] = { claro: ['#f6f8fc', '#c3ccdb', '#6f7c94'], oscuro: ['#9aa6bd', '#59657c', '#2c3447'], oro: ['#f8dd92', '#bb8c30', '#6e4e14'], apagado: ['#4a5262', '#2c3340', '#151a24'] }[tono];
    m.addColorStop(0, a); m.addColorStop(0.5, b); m.addColorStop(1, c);
    return m;
  }
  const caja = (g, m, r = 10) => { g.beginPath(); g.roundRect(m.x + 1, -m.h / 2, m.w - 2, m.h, r); };
  /** Trapecio horizontal: alto `hi` a la izquierda, `hd` a la derecha. */
  const cono = (g, m, hi, hd) => { g.beginPath(); g.moveTo(m.x + 1, -hi / 2); g.lineTo(m.x + m.w - 1, -hd / 2); g.lineTo(m.x + m.w - 1, hd / 2); g.lineTo(m.x + 1, hi / 2); g.closePath(); };
  /** Llama hacia −x desde (x, 0) con radio r. */
  function llama(g, x, r, t, largo = 120) {
    const l = largo * (1 + (quieto ? 0 : 0.18 * Math.sin(t * 43) + 0.08 * Math.sin(t * 17)));
    for (const [k, col] of [[1, 'rgba(79,216,255,'], [0.5, 'rgba(255,255,255,']]) {
      const f = g.createLinearGradient(x, 0, x - l * k, 0);
      f.addColorStop(0, col + '0.95)'); f.addColorStop(1, col + '0)');
      g.fillStyle = f; g.beginPath(); g.moveTo(x, -r * k); g.quadraticCurveTo(x - l * k * 1.2, 0, x, r * k); g.fill();
    }
  }
  function astronauta(g, x, y, rot, s = 1) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.strokeStyle = '#e8eef7'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, 2); g.lineTo(-9, 8); g.moveTo(4, 2); g.lineTo(9, 7); g.moveTo(-2, 10); g.lineTo(-4, 18); g.moveTo(2, 10); g.lineTo(5, 17); g.stroke();
    g.fillStyle = '#9aa6bd'; g.fillRect(-7, -1, 3, 10);
    g.fillStyle = '#e8eef7'; g.beginPath(); g.roundRect(-5, -2, 10, 13, 3); g.fill();
    g.beginPath(); g.arc(0, -7, 5.5, 0, TAU); g.fill();
    g.fillStyle = '#16345e'; g.beginPath(); g.arc(1, -7, 3.4, 0, TAU); g.fill();
    g.restore();
  }
  function etiqueta(g, texto, x, y, color = '#d7e3f7') {
    g.font = '10px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center';
    const w = g.measureText(texto).width + 8;
    g.fillStyle = 'rgba(4,8,18,.8)'; g.fillRect(x - w / 2, y - 10, w, 14);
    g.fillStyle = color; g.fillText(texto, x, y);
  }

  /* ---------- nave: distribución de módulos de popa (izquierda) a proa (derecha) ---------- */
  function distribucion(cfg) {
    const n = idx('naves', cfg.nave); const l = idx('landers', cfg.lander);
    const h = 84 + n * 12;
    const partes = [['motor', 52, h * 0.8, 'Motor'], ['tanques', 110 + cfg.propelente * 1.1, h + 10, 'Tanques'], ['energia', 78, h * 0.72, 'Energía'],
      ['ciencia', 92, h * 0.9, 'Ciencia'], ['habitat', 112 + n * 22, h, 'Hábitat'], ['puente', 72, h * 0.86, 'Puente'],
      ['lander', 58 + l * 9, h * 0.74, 'Lander'], ['escudo', 20, h * 0.9 + l * 6, 'Escudo']];
    let x = -partes.reduce((s, p) => s + p[1], 0) / 2;
    return partes.map(([id, w, alto, nombre]) => { const m = { id, x, w, h: alto, nombre }; x += w; return m; });
  }

  const EXT = {
    motor(g, m, t, o) {
      cono(g, m, m.h, m.h * 0.45); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'oscuro'); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) { g.beginPath(); g.moveTo(m.x + i * 13, -m.h / 2); g.lineTo(m.x + i * 13, m.h / 2); g.stroke(); }
      if (o.quemando) llama(g, m.x + 3, m.h * 0.42, t);
    },
    tanques(g, m, t, o) {
      caja(g, m, 22); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'claro'); g.fill();
      g.fillStyle = o.apagada ? '#3a2a1a' : '#e8843a';
      g.fillRect(m.x + m.w * 0.16, -m.h / 2 + 1, 12, m.h - 2); g.fillRect(m.x + m.w * 0.8, -m.h / 2 + 1, 12, m.h - 2);
      g.strokeStyle = 'rgba(40,50,70,.3)'; g.lineWidth = 1;
      for (let x = m.x + 40; x < m.x + m.w - 20; x += 36) { g.beginPath(); g.moveTo(x, -m.h / 2 + 3); g.lineTo(x, m.h / 2 - 3); g.stroke(); }
    },
    energia(g, m, t, o) {
      caja(g, m, 6); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'oscuro'); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
      for (let y = -m.h / 2 + 8; y < m.h / 2 - 4; y += 7) { g.beginPath(); g.moveTo(m.x + 10, y); g.lineTo(m.x + m.w - 10, y); g.stroke(); }
    },
    ciencia(g, m, t, o) {
      caja(g, m, 8); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'claro'); g.fill();
      g.strokeStyle = 'rgba(40,50,70,.45)'; g.lineWidth = 1.5; g.strokeRect(m.x + m.w / 2 - 14, -10, 28, 26);
      o.est.d.instrumentos.forEach((ins, i) => {
        g.fillStyle = o.est.danados.includes(ins.id) ? '#55303a' : INSTR[i % 6];
        g.fillRect(m.x + 8 + i * 13, -m.h / 2 - 7, 10, 8);
      });
    },
    habitat(g, m, t, o) {
      caja(g, m, 14); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'claro'); g.fill();
      g.fillStyle = o.apagada ? '#243044' : C.cian; g.fillRect(m.x + 8, m.h * 0.26, m.w - 16, 3);
      for (let x = m.x + 18; x < m.x + m.w - 10; x += 22) {
        g.fillStyle = o.apagada ? '#161c28' : '#ffe9a8'; g.shadowColor = '#ffd76a'; g.shadowBlur = o.apagada ? 0 : 8;
        g.beginPath(); g.arc(x, -m.h * 0.14, 5, 0, TAU); g.fill();
      }
      g.shadowBlur = 0;
      g.font = 'bold 10px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(30,42,66,.8)';
      g.fillText(String(o.cfg.nombre).toUpperCase().slice(0, 16), m.x + m.w / 2, m.h * 0.14, m.w - 16);
    },
    puente(g, m, t, o) {
      cono(g, m, m.h, m.h * 0.86); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'claro'); g.fill();
      g.fillStyle = o.apagada ? '#0c111b' : '#12305f'; g.beginPath(); g.roundRect(m.x + m.w * 0.45, -m.h * 0.3, m.w * 0.42, m.h * 0.3, 5); g.fill();
      if (!o.apagada) { g.fillStyle = 'rgba(127,196,255,.6)'; g.fillRect(m.x + m.w * 0.5, -m.h * 0.26, m.w * 0.12, 3); }
    },
    lander(g, m, t, o) {
      cono(g, m, m.h, m.h * 0.78); g.fillStyle = metal(g, m.h, o.apagada ? 'apagado' : 'oro'); g.fill();
      g.strokeStyle = 'rgba(60,40,10,.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(m.x + 6, -m.h / 2 + 6); g.lineTo(m.x + m.w - 8, -m.h * 0.3); g.moveTo(m.x + 6, m.h / 2 - 6); g.lineTo(m.x + m.w - 8, m.h * 0.3); g.stroke();
      g.fillStyle = '#1b2a47'; g.beginPath(); g.arc(m.x + m.w * 0.45, 0, 6, 0, TAU); g.fill();
    },
    escudo(g, m, t, o) {
      g.beginPath(); g.moveTo(m.x, -m.h / 2); g.quadraticCurveTo(m.x + m.w * 2.3, 0, m.x, m.h / 2); g.quadraticCurveTo(m.x + m.w * 0.6, 0, m.x, -m.h / 2);
      g.fillStyle = ESCUDO[o.cfg.escudo]; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.stroke();
    },
  };

  function base(g, m, r) { caja(g, m, r); g.fillStyle = C.dentro; g.fill(); g.lineWidth = 3; g.strokeStyle = C.pared; g.stroke(); }
  function baseCono(g, m, hi, hd) { cono(g, m, hi, hd); g.fillStyle = C.dentro; g.fill(); g.lineWidth = 3; g.strokeStyle = C.pared; g.stroke(); }
  /** Depósito vertical con nivel de 0 a 1. */
  function deposito(g, x, y, w, h, nivel, color, t) {
    g.save(); g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2.5); g.clip();
    g.fillStyle = '#060b16'; g.fillRect(x, y, w, h);
    const ys = y + h * (1 - limitar(nivel));
    g.fillStyle = color; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(x, y + h);
    for (let i = 0; i <= w; i += 4) g.lineTo(x + i, ys + Math.sin(t * 3 + (x + i) * 0.15) * 1.6);
    g.lineTo(x + w, y + h); g.fill();
    g.restore();
    g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2.5); g.stroke();
  }
  const semaforo = (v, av, mal) => (v <= mal ? C.rojo : v <= av ? C.ambar : C.verde);

  const INT = {
    motor(g, m, t, o) {
      baseCono(g, m, m.h, m.h * 0.45);
      g.strokeStyle = C.ambar; g.lineWidth = 2; g.beginPath(); g.arc(m.x + m.w - 13, 0, 8, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(m.x + m.w - 21, 0); g.lineTo(m.x + 8, -m.h * 0.3); g.moveTo(m.x + m.w - 21, 0); g.lineTo(m.x + 8, m.h * 0.3); g.stroke();
      if (o.quemando) llama(g, m.x + 3, m.h * 0.42, t);
    },
    tanques(g, m, t, o) {
      base(g, m, 22);
      const tw = (m.w - 34) / 2; const th = m.h - 26; const nivel = o.est.propNivel;
      for (let k = 0; k < 2; k += 1) deposito(g, m.x + 12 + k * (tw + 10), -th / 2, tw, th, nivel, semaforo(nivel, 0.12, 0.03) === C.verde ? C.cian : semaforo(nivel, 0.12, 0.03), t);
    },
    energia(g, m, t, o) {
      base(g, m, 6);
      const e = o.est; const lit = Math.round(8 * limitar(e.potencia / 24));
      const col = e.potencia < Sim.K.POT_ESENCIAL ? C.rojo : e.potencia < e.demanda ? C.ambar : C.verde;
      const cw = (m.w - 30) / 2; const ch = (m.h - 24) / 4 - 4;
      for (let i = 0; i < 8; i += 1) {
        const x = m.x + 12 + (i % 2) * (cw + 6); const y = m.h / 2 - 12 - (Math.floor(i / 2) + 1) * (ch + 4) + 4;
        g.fillStyle = i < lit && !o.apagada ? col : '#182238'; g.fillRect(x, y, cw, ch);
      }
    },
    ciencia(g, m, t, o) {
      base(g, m, 8);
      const sw = (m.w - 28) / 3; const sh = (m.h - 26) / 2;
      for (let i = 0; i < 6; i += 1) {
        const x = m.x + 10 + (i % 3) * (sw + 4); const y = -m.h / 2 + 10 + Math.floor(i / 3) * (sh + 6);
        const ins = o.est.d.instrumentos[i];
        if (!ins) { g.setLineDash([3, 3]); g.strokeStyle = '#2c3d61'; g.lineWidth = 1; g.strokeRect(x, y, sw, sh); g.setLineDash([]); continue; }
        const roto = o.est.danados.includes(ins.id);
        g.fillStyle = '#16233d'; g.fillRect(x, y, sw, sh); g.strokeStyle = roto ? C.rojo : INSTR[i]; g.lineWidth = 1.5; g.strokeRect(x, y, sw, sh);
        g.fillStyle = roto ? (Math.sin(t * 8) > 0 ? C.rojo : '#40151c') : C.verde; g.beginPath(); g.arc(x + sw / 2, y + sh / 2, 3, 0, TAU); g.fill();
      }
    },
    habitat(g, m, t, o) {
      base(g, m, 14);
      const col = semaforo(o.est.o2, 15, Sim.K.O2_MIN);
      for (let k = 0; k < 3; k += 1) deposito(g, m.x + 12 + k * 15, -m.h / 2 + 12, 11, m.h - 24, o.est.o2 / 100, col, t + k);
      g.strokeStyle = '#2c3d61'; g.lineWidth = 1; g.strokeRect(m.x + m.w - 30, -m.h / 2 + 10, 20, 12); g.strokeRect(m.x + m.w - 30, m.h / 2 - 22, 20, 12);
      if (!o.apagada) {
        astronauta(g, m.x + m.w * 0.55, Math.sin(t * 0.9) * 6 - 2, Math.sin(t * 0.5) * 0.5);
        astronauta(g, m.x + m.w * 0.78, Math.cos(t * 0.7) * 7 + 4, 0.8 + Math.cos(t * 0.4) * 0.4);
      }
    },
    puente(g, m, t, o) {
      baseCono(g, m, m.h, m.h * 0.86);
      const alerta = o.alerta === 'puente';
      g.fillStyle = o.apagada ? '#111827' : alerta ? '#4a1620' : '#0f3a5c'; g.fillRect(m.x + m.w - 22, -m.h * 0.28, 12, m.h * 0.5);
      if (!o.apagada) { g.fillStyle = alerta ? C.rojo : C.cian; g.fillRect(m.x + m.w - 20, -m.h * 0.24 + ((t * 14) % (m.h * 0.4)), 8, 2); astronauta(g, m.x + m.w * 0.42, 2, 0.15); }
      g.strokeStyle = '#2c3d61'; g.lineWidth = 3; g.beginPath(); g.moveTo(m.x + 14, 16); g.lineTo(m.x + 30, 16); g.stroke();
    },
    lander(g, m, t, o) {
      baseCono(g, m, m.h, m.h * 0.78);
      g.strokeStyle = '#bb8c30'; g.lineWidth = 1.5; g.strokeRect(m.x + 10, -12, 14, 12); g.strokeRect(m.x + 10, 3, 14, 10);
      g.beginPath(); g.arc(m.x + m.w - 18, 0, 8, Math.PI / 2, -Math.PI / 2); g.stroke();
    },
    escudo(g, m, t, o) {
      const capas = Math.ceil(o.est.escudo / 34);
      for (let i = 0; i < 3; i += 1) {
        g.beginPath(); g.moveTo(m.x + i * 3, -m.h / 2 + i * 3); g.quadraticCurveTo(m.x + m.w * (1.1 + i * 0.6), 0, m.x + i * 3, m.h / 2 - i * 3);
        g.strokeStyle = i < capas ? ESCUDO[o.cfg.escudo] : '#2c3d61'; g.lineWidth = 3; g.setLineDash(i < capas ? [] : [3, 4]); g.stroke();
      }
      g.setLineDash([]);
    },
  };

  function paneles(g, m, o) {
    const e = o.est; const largo = 28 + e.potMax * 3.2; const w = 96; const x = m.x + m.w / 2 - w / 2;
    for (const s of [-1, 1]) {
      const y0 = s * (m.h / 2 + 8); const y = s < 0 ? y0 - largo : y0;
      g.strokeStyle = '#9fb2d6'; g.lineWidth = 3; g.beginPath(); g.moveTo(m.x + m.w / 2, s * m.h / 2); g.lineTo(m.x + m.w / 2, y0); g.stroke();
      const f = g.createLinearGradient(0, y, 0, y + largo); f.addColorStop(0, '#2b63c9'); f.addColorStop(1, '#0d2a66');
      g.fillStyle = o.apagada ? '#111a2c' : f; g.fillRect(x, y, w, largo);
      g.strokeStyle = 'rgba(127,196,255,.35)'; g.lineWidth = 1; g.beginPath();
      for (let i = 12; i < w; i += 12) { g.moveTo(x + i, y); g.lineTo(x + i, y + largo); }
      for (let j = 12; j < largo; j += 12) { g.moveTo(x, y + j); g.lineTo(x + w, y + j); }
      g.stroke(); g.strokeStyle = '#9fb2d6'; g.lineWidth = 1.5; g.strokeRect(x, y, w, largo);
      if (s > 0 && e.potencia < e.potMax) { // panel dañado por radiación
        g.fillStyle = 'rgba(8,8,16,.7)'; g.fillRect(x, y, w, largo);
        g.strokeStyle = C.rojo; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y + 6); g.lineTo(x + 40, y + largo * 0.5); g.lineTo(x + 28, y + largo * 0.6); g.lineTo(x + 70, y + largo - 6); g.stroke();
      }
    }
  }
  function antena(g, m, t, o) {
    const x = m.x + m.w * 0.3; const y = -m.h / 2;
    g.strokeStyle = '#c3ccdb'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 20); g.stroke();
    g.beginPath(); g.arc(x, y - 30, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 3; g.stroke();
    if (o.apagada) return;
    const mal = o.alerta === 'puente';
    g.strokeStyle = mal ? C.rojo : C.cian; g.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const p = (t * (mal ? 0.5 : 1.1) + i / 3) % 1;
      if (mal && Math.sin(t * 9 + i) < 0.2) continue; // señal intermitente
      g.globalAlpha = 1 - p; g.beginPath(); g.arc(x, y - 34, 8 + p * 26, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function marcas(g, m, t, o, interior) {
    const cx = m.x + m.w / 2; const alerta = o.alerta === m.id; const sel = o.sel === m.id; const hover = o.hover === m.id;
    if (alerta || sel || hover) {
      g.strokeStyle = alerta ? C.rojo : sel ? C.cian : 'rgba(255,255,255,.55)'; g.lineWidth = alerta ? 2.5 : 2;
      g.globalAlpha = alerta && !quieto ? 0.4 + 0.6 * Math.abs(Math.sin(t * 4)) : 1;
      g.setLineDash(alerta ? [6, 4] : []); g.strokeRect(m.x - 2, -m.h / 2 - 6, m.w + 4, m.h + 12); g.setLineDash([]); g.globalAlpha = 1;
    }
    if (alerta) { g.fillStyle = C.rojo; g.beginPath(); g.arc(cx, -m.h / 2 - 26, 9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('!', cx, -m.h / 2 - 21); }
    if (interior || sel || hover || alerta) etiqueta(g, m.nombre, cx, m.h / 2 + 20, alerta ? C.rojo : sel ? C.cian : '#d7e3f7');
  }

  /** Dibuja la nave. Devuelve los módulos para poder localizar clics. */
  function nave(g, t, o) {
    const mods = distribucion(o.cfg); const interior = o.modo === 'interior';
    const M = Object.fromEntries(mods.map((m) => [m.id, m]));
    g.save(); g.translate(W / 2, o.cy + Math.sin(t * 0.8) * 3);
    if (o.apagada) g.rotate(Math.sin(t * 0.3) * 0.06 - 0.08);
    g.scale(o.escala || 1, o.escala || 1);
    paneles(g, M.energia, o);
    for (const m of mods) (interior ? INT : EXT)[m.id](g, m, t, o);
    antena(g, M.puente, t, o);
    if (o.interactivo || interior) for (const m of mods) marcas(g, m, t, o, interior);
    g.restore();
    return mods;
  }
  /** Módulo bajo el puntero (o null). */
  function moduloEn(canvas, ev, mods, o) {
    const r = canvas.getBoundingClientRect(); const k = W / r.width; const e = o.escala || 1;
    const x = ((ev.clientX - r.left) * k - W / 2) / e; const y = ((ev.clientY - r.top) * k - o.cy) / e;
    const m = (mods || []).find((q) => x >= q.x && x <= q.x + q.w && Math.abs(y) <= q.h / 2 + 8);
    return m ? m.id : null;
  }
  /** Franja de ruta Tierra → Marte con los eventos marcados. */
  function ruta(g, H, dia, total, eventos) {
    const x0 = 130; const x1 = W - 130; const y = H - 26; const px = (d) => x0 + (x1 - x0) * (d / total);
    g.strokeStyle = '#24365c'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
    g.strokeStyle = C.cian; g.beginPath(); g.moveTo(x0, y); g.lineTo(px(dia), y); g.stroke();
    for (const d of eventos) { g.strokeStyle = d <= dia ? '#5b6f95' : C.ambar; g.beginPath(); g.arc(px(d), y, 4, 0, TAU); g.stroke(); }
    g.fillStyle = '#3d83ea'; g.beginPath(); g.arc(x0, y, 9, 0, TAU); g.fill();
    g.fillStyle = '#e0703f'; g.beginPath(); g.arc(x1, y, 7, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px(dia) + 7, y); g.lineTo(px(dia) - 5, y - 5); g.lineTo(px(dia) - 5, y + 5); g.fill();
    g.font = '10px ui-monospace, Menlo, Consolas, monospace'; g.fillStyle = '#8296b8';
    g.textAlign = 'right'; g.fillText('TIERRA', x0 - 16, y + 4); g.textAlign = 'left'; g.fillText('MARTE', x1 + 14, y + 4);
    g.textAlign = 'center'; g.fillStyle = '#d7e3f7'; g.fillText(`DÍA ${Math.round(dia)} / ${total}`, px(dia), y - 12);
  }

  /* ---------- lanzamiento ---------- */
  function lanzamiento(g, t, H, o) {
    const p = o.p || 0; const e = p * p; const suelo = H - 56 + e * 1500; const k = idx('lanzadores', o.cfg.lanzador);
    espacio(g, t, H);
    g.globalAlpha = 1 - limitar(e * 1.3);
    const cielo = g.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, '#16356b'); cielo.addColorStop(0.75, '#5d7fb5'); cielo.addColorStop(1, '#f0a868');
    g.fillStyle = cielo; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.7)';
    for (const [x, y, r] of NUBES) { const cy = y + e * 1500; if (cy > -60 && cy < H + 60) { g.beginPath(); g.ellipse(x, cy, r, r * 0.3, 0, 0, TAU); g.fill(); } }
    g.globalAlpha = 1;
    if (suelo < H + 200) {
      g.fillStyle = '#243049'; g.beginPath(); g.moveTo(0, suelo); for (let x = 0; x <= W; x += 40) g.lineTo(x, suelo - 14 - 12 * Math.sin(x * 0.011) - 8 * Math.sin(x * 0.027)); g.lineTo(W, suelo); g.fill();
      g.fillStyle = '#121826'; g.fillRect(0, suelo, W, 400);
      g.strokeStyle = '#6f7c94'; g.lineWidth = 2; const tx = W / 2 - 78; const th = 150 + k * 28;
      g.strokeRect(tx, suelo - th, 22, th);
      g.beginPath(); for (let y = 0; y < th; y += 22) { g.moveTo(tx, suelo - y); g.lineTo(tx + 22, suelo - y - 22); g.moveTo(tx + 22, suelo - y); g.lineTo(tx, suelo - y - 22); } g.stroke();
      g.fillStyle = o.abortado ? (Math.sin(t * 7) > 0 ? C.rojo : '#40151c') : C.verde; g.beginPath(); g.arc(tx + 11, suelo - th - 7, 5, 0, TAU); g.fill();
    }
    const by = H - 56 - Math.min(e * 1500, H * 0.42); const bw = 30 + k * 9; const bh = 140 + k * 28;
    g.save(); g.translate(W / 2 + (p > 0 && p < 0.45 && !quieto ? Math.sin(t * 70) * 1.5 : 0), by);
    if (p > 0) { g.save(); g.rotate(-Math.PI / 2); llama(g, 0, bw * 0.5 + k * 6, t, 150 + k * 40); g.restore(); }
    const cuerpo = g.createLinearGradient(-bw / 2, 0, bw / 2, 0); cuerpo.addColorStop(0, '#aab4c6'); cuerpo.addColorStop(0.45, '#ffffff'); cuerpo.addColorStop(1, '#7d899e');
    if (k > 0) for (const s of [-1, 1]) { // aceleradores laterales
      const w = bw * 0.46; const h = bh * (0.45 + k * 0.08); const x = s * (bw / 2 + w / 2 + 1);
      g.fillStyle = cuerpo; g.fillRect(x - w / 2, -h, w, h);
      g.beginPath(); g.moveTo(x - w / 2, -h); g.quadraticCurveTo(x, -h - w * 1.6, x + w / 2, -h); g.fill();
      g.fillStyle = '#39445a'; g.fillRect(x - w / 2, -8, w, 8);
    }
    g.fillStyle = cuerpo; g.fillRect(-bw / 2, -bh, bw, bh);
    g.beginPath(); g.moveTo(-bw / 2 - 3, -bh); g.quadraticCurveTo(0, -bh - bw * 2, bw / 2 + 3, -bh); g.fill();
    g.fillStyle = C.cian; g.fillRect(-bw / 2, -bh * 0.62, bw, 5); g.fillStyle = '#e8843a'; g.fillRect(-bw / 2, -bh * 0.3, bw, 8);
    g.fillStyle = '#39445a'; g.fillRect(-bw / 2, -10, bw, 10);
    g.beginPath(); g.moveTo(-bw / 2, -26); g.lineTo(-bw / 2 - 12, 0); g.lineTo(-bw / 2, 0); g.moveTo(bw / 2, -26); g.lineTo(bw / 2 + 12, 0); g.lineTo(bw / 2, 0); g.fill();
    g.restore();
    if (p > 0 && suelo < H + 100) { // humo en la plataforma
      g.fillStyle = 'rgba(230,230,235,.75)';
      for (let i = -5; i <= 5; i += 1) { const r = 18 + p * 90 + 10 * Math.sin(t * 3 + i); g.beginPath(); g.arc(W / 2 + i * (16 + p * 60), suelo - r * 0.4, r, 0, TAU); g.fill(); }
    }
  }

  /* ---------- entrada, descenso y aterrizaje ---------- */
  function capsula(g, x, y, rot, o) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(o.s || 1, o.s || 1);
    if (o.patas) {
      g.strokeStyle = '#c3ccdb'; g.lineWidth = 3; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, 10); g.lineTo(s * 38, 30); g.moveTo(s * 32, 30); g.lineTo(s * 44, 30); g.stroke(); }
      g.fillStyle = '#39445a'; g.fillRect(-9, 16, 18, 8);
    } else {
      g.fillStyle = o.color; g.beginPath(); g.moveTo(-34, 16); g.quadraticCurveTo(0, 36, 34, 16); g.closePath(); g.fill();
    }
    const oro = g.createLinearGradient(-30, 0, 30, 0); oro.addColorStop(0, '#8a651c'); oro.addColorStop(0.45, '#f8dd92'); oro.addColorStop(1, '#6e4e14');
    g.fillStyle = oro; g.beginPath(); g.moveTo(-30, 16); g.lineTo(-13, -20); g.lineTo(13, -20); g.lineTo(30, 16); g.closePath(); g.fill();
    g.fillStyle = '#12305f'; g.beginPath(); g.arc(0, -2, 6, 0, TAU); g.fill();
    g.restore();
  }
  function terrenoMarte(g, H, y0) {
    g.fillStyle = '#a8603a'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 30) g.lineTo(x, y0 - 34 - 22 * Math.sin(x * 0.006 + 1) - 10 * Math.sin(x * 0.021)); g.lineTo(W, H); g.fill();
    g.fillStyle = '#8a4526'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 30) g.lineTo(x, y0 - 8 - 9 * Math.sin(x * 0.013 + 2)); g.lineTo(W, H); g.fill();
    g.fillStyle = '#74361b'; g.fillRect(0, y0, W, H - y0);
    g.fillStyle = '#5a2812'; for (const [x, f, r] of ROCAS) { g.beginPath(); g.ellipse(x, y0 + 6 + f * (H - y0 - 10), r, r * 0.45, 0, 0, TAU); g.fill(); }
  }
  function cieloMarte(g, H) {
    const c = g.createLinearGradient(0, 0, 0, H); c.addColorStop(0, '#8a5230'); c.addColorStop(1, '#ecc49a');
    g.fillStyle = c; g.fillRect(0, 0, W, H);
  }
  function edl(g, t, H, o) {
    const color = ESCUDO[o.cfg.escudo]; const p = o.p || 0; const y0 = H - 70;
    if (o.fase === 0 || (o.fase === 1 && p < 0.5)) { // aproximación y entrada con plasma
      const caliente = o.fase === 1 || o.fallo; const x = W / 2; const y = H * 0.45;
      espacio(g, t, H); planeta(g, W / 2, H + 1180, 1300, '#e0703f', '#6b2412', '#ffb38a');
      if (caliente) { g.fillStyle = 'rgba(120,40,10,.35)'; g.fillRect(0, 0, W, H); }
      g.strokeStyle = caliente ? 'rgba(255,190,120,.5)' : 'rgba(255,255,255,.25)'; g.lineWidth = 1.5;
      for (let i = 0; i < 16; i += 1) { const q = (t * (caliente ? 1.6 : 0.5) + i * 0.137) % 1; const sx = (i * 97) % W; g.beginPath(); g.moveTo(sx - 150 + q * 500, H - q * H * 1.3); g.lineTo(sx - 120 + q * 500, H - q * H * 1.3 - 42); g.stroke(); }
      g.save(); g.translate(x, y); g.rotate(0.62);
      const fuego = g.createRadialGradient(0, 22, 4, 0, 22, caliente ? 110 : 55);
      fuego.addColorStop(0, 'rgba(255,245,210,.95)'); fuego.addColorStop(0.35, 'rgba(255,140,40,.6)'); fuego.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = fuego; g.beginPath(); g.arc(0, 22, 110, 0, TAU); g.fill();
      if (caliente) { const cola = g.createLinearGradient(0, 0, 0, -260); cola.addColorStop(0, 'rgba(255,160,60,.55)'); cola.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = cola; g.beginPath(); g.moveTo(-38, 14); g.lineTo(Math.sin(t * 20) * 6, -260); g.lineTo(38, 14); g.fill(); }
      g.restore();
      if (o.fallo) { // el vehículo se fragmenta
        for (let i = 0; i < 7; i += 1) { const q = (t * 0.5 + i / 7) % 1; g.fillStyle = `rgba(255,${150 + i * 12},80,${1 - q})`; g.beginPath(); g.arc(x - q * (40 + i * 26), y + q * (30 + i * 17) - i * 9, 7 - i * 0.6, 0, TAU); g.fill(); }
      } else capsula(g, x, y, 0.62, { color });
      return;
    }
    cieloMarte(g, H);
    if (o.fase <= 2) { // paracaídas
      const sw = Math.sin(t * 1.3) * 16; const x = W / 2 + sw; const y = H * 0.62;
      g.fillStyle = 'rgba(116,54,27,.55)'; g.fillRect(0, H - 30, W, 30);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
      for (let i = -3; i <= 3; i += 1) { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x - sw * 1.4 + i * 26, y - 150); g.stroke(); }
      for (let i = 0; i < 6; i += 1) { g.fillStyle = i % 2 ? '#f2f2f2' : '#e0523a'; g.beginPath(); g.moveTo(x - sw * 1.4, y - 150); g.ellipse(x - sw * 1.4, y - 150, 80, 52, 0, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6); g.fill(); }
      capsula(g, x, y, sw * 0.004, { color });
      return;
    }
    terrenoMarte(g, H, y0);
    const posado = o.fase === 4; const alt = posado ? 0 : (1 - p) ** 2;
    const x = W / 2; const y = y0 - 34 - alt * (H * 0.55);
    if (o.fallo) { capsula(g, x + Math.sin(t) * 30, 60 + ((t * 120) % (y0 - 80)), t * 2, { patas: true }); return; }
    if (!posado) { g.save(); g.translate(x, y + 24); g.rotate(-Math.PI / 2); llama(g, 0, 10, t, 70 + alt * 30); g.restore(); }
    const polvo = posado ? 0.25 : limitar(1 - alt * 4);
    if (polvo > 0) { g.fillStyle = `rgba(214,150,104,${polvo * 0.7})`; for (let i = -4; i <= 4; i += 1) { const r = 22 + 14 * Math.sin(t * 2 + i); g.beginPath(); g.arc(x + i * 34, y0 - 4, r, 0, TAU); g.fill(); } }
    capsula(g, x, y, 0, { patas: true });
  }

  /* ---------- superficie de Marte con los instrumentos desplegados ---------- */
  function superficie(g, t, H, o) {
    const y0 = H - 80; const x = W / 2;
    cieloMarte(g, H);
    g.fillStyle = 'rgba(255,244,220,.9)'; g.shadowColor = '#fff'; g.shadowBlur = 24; g.beginPath(); g.arc(770, 64, 11, 0, TAU); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#9fd0ff'; g.beginPath(); g.arc(170, 46, 2.5, 0, TAU); g.fill(); etiqueta(g, 'TIERRA', 170, 34);
    terrenoMarte(g, H, y0);
    o.activos.forEach((ins, i) => {
      const ix = x + (i % 2 ? 1 : -1) * (120 + Math.floor(i / 2) * 95); const iy = y0 + 14 + (i % 3) * 8;
      g.strokeStyle = '#d7e3f7'; g.lineWidth = 2; g.beginPath(); g.moveTo(ix - 10, iy); g.lineTo(ix, iy - 22); g.lineTo(ix + 10, iy); g.moveTo(ix, iy - 22); g.lineTo(ix, iy - 44); g.stroke();
      g.fillStyle = INSTR[i % 6]; g.fillRect(ix - 9, iy - 54, 18, 11);
      g.fillStyle = Math.sin(t * 4 + i) > 0 ? C.verde : '#1f5c3d'; g.beginPath(); g.arc(ix, iy - 60, 2.5, 0, TAU); g.fill();
    });
    capsula(g, x, y0 - 48, 0, { patas: true, s: 1.5 });
    g.strokeStyle = '#d7e3f7'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 8, y0 - 78); g.lineTo(x + 8, y0 - 104); g.stroke();
    if (o.activos.length) { // transmisión de datos hacia la Tierra
      g.strokeStyle = C.cian; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) { const q = (t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - q; g.beginPath(); g.arc(x + 8, y0 - 106, 8 + q * 46, 1.05 * Math.PI, 1.45 * Math.PI); g.stroke(); }
      g.globalAlpha = 1;
    }
  }

  root.Gfx = { escena, espacio, nave, moduloEn, ruta, lanzamiento, edl, superficie };
})(typeof globalThis !== 'undefined' ? globalThis : this);
