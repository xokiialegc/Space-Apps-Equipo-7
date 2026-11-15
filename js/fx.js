/* AEON-01 — Sensación de juego: cámara dinámica, viñeta de alarma y sonido procedural.
   Nada de este archivo toca la física ni el movimiento de los personajes:
   - Lee la telemetría que cada fase publica en AEON.flight (empuje, presión dinámica, alertas…)
     y la convierte en vibración de cámara, líneas de estrés y sonido continuo de motores.
   - Las fases avisan de los golpes con AEON.fx.event(nombre): separación de etapa, impacto,
     avería, reparación completada, paracaídas, aterrizaje, fallo…
   - Todos los sonidos se sintetizan con Web Audio (osciladores y ruido filtrado), sin archivos.
     El AudioContext se crea con el primer gesto del jugador (js/menu.js) y el botón de altavoz,
     arriba a la derecha, silencia o activa todo el audio (se guarda en los ajustes).
   Cámara: modelo de «trauma» (los golpes suman, la vibración es trauma² y se disipa) más una
   vibración continua que fija cada fotograma la telemetría. Se aplica con transform al escenario
   visible (cabina, interior o cámara exterior). Respeta «reducir movimiento» del sistema. */
(function () {
  'use strict';
  const A = window.AEON;
  const $ = (s) => document.querySelector(s);
  const W = 1600, H = 900;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;

  // =====================================================================
  //  SONIDO PROCEDURAL
  // =====================================================================
  let bus = null, noise = null, brown = null;
  const loops = {};                                         // sonidos continuos: { src, filter, gain }
  function ctx() {
    const a = A.audio && A.audio();
    if (!a || a.state !== 'running' || !A.master()) return null;
    if (!bus) {
      bus = a.createGain(); bus.connect(A.master());
      const mk = (brownian) => {                            // 2 s de ruido blanco o marrón en bucle
        const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = b.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) {
          const w = Math.random() * 2 - 1;
          if (brownian) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
        }
        return b;
      };
      noise = mk(false); brown = mk(true);
    }
    bus.gain.value = (A.settings.sfx / 100) * 0.9;
    return a;
  }
  /** Nodo de ruido de un solo uso con filtro y envolvente. */
  function burst(a, t, { type = 'bandpass', f = 1000, q = 1, peak = 0.3, attack = 0.005, dur = 0.3, buf, f2 }) {
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf || noise; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  /** Oscilador de un solo uso con envolvente y barrido de tono opcional. */
  function tone(a, t, { type = 'sine', f = 440, f2, peak = 0.2, attack = 0.004, dur = 0.3 }) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  /** Sonido continuo (bucle de ruido filtrado) cuyo volumen y filtro se ajustan cada fotograma. */
  function loop(name, a, { buf, type, q = 0.7 }) {
    if (loops[name]) return loops[name];
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; s.loop = true; fl.type = type; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(bus); s.start();
    return (loops[name] = { s, fl, g });
  }
  function setLoop(name, a, spec, vol, freq) {
    if (!a) return;
    if (vol < 0.002 && !loops[name]) return;
    const L = loop(name, a, spec), t = a.currentTime;
    L.g.gain.setTargetAtTime(vol, t, 0.08); if (freq) L.fl.frequency.setTargetAtTime(freq, t, 0.1);
  }
  function stopLoops() { const a = A.audio && A.audio(); if (!a) return; Object.values(loops).forEach((L) => L.g.gain.setTargetAtTime(0, a.currentTime, 0.1)); }

  const SND = {
    /** Detonación metálica: golpe grave, ruido de pernos explosivos y chapa que resuena. */
    stage(a, t) {
      tone(a, t, { f: 90, f2: 30, peak: 0.9, dur: 0.6 });
      burst(a, t, { type: 'lowpass', f: 2400, f2: 300, peak: 0.8, dur: 0.5 });
      [1, 2.76, 5.4, 8.93].forEach((k, i) => tone(a, t + 0.01, { type: i ? 'triangle' : 'square', f: 190 * k, peak: 0.12 / (i + 1), dur: 1.4 - i * 0.2 }));
    },
    impact(a, t) {
      tone(a, t, { f: 120, f2: 40, peak: 0.7, dur: 0.4 });
      burst(a, t, { type: 'bandpass', f: 1800, q: 2, peak: 0.5, dur: 0.25 });
      [1, 2.4, 4.1].forEach((k, i) => tone(a, t, { type: 'triangle', f: 310 * k, peak: 0.08 / (i + 1), dur: 0.9 }));
    },
    fault(a, t) { tone(a, t, { type: 'square', f: 220, f2: 140, peak: 0.12, dur: 0.35 }); burst(a, t, { type: 'highpass', f: 3500, peak: 0.25, dur: 0.12 }); },
    crash(a, t) {
      burst(a, t, { type: 'lowpass', f: 1600, f2: 80, peak: 1, attack: 0.01, dur: 2.4, buf: brown });
      burst(a, t, { type: 'bandpass', f: 900, q: 0.8, peak: 0.6, dur: 1.2 });
      tone(a, t, { f: 70, f2: 25, peak: 0.9, dur: 1.5 });
    },
    success(a, t) { [660, 880, 1320].forEach((f, i) => tone(a, t + i * 0.09, { f, peak: 0.16, dur: 0.35 })); },
    fixed(a, t) { [784, 1046, 1568].forEach((f, i) => tone(a, t + i * 0.07, { type: 'triangle', f, peak: 0.13, dur: 0.3 })); },
    chute(a, t) { burst(a, t, { type: 'bandpass', f: 500, f2: 160, q: 0.6, peak: 0.7, attack: 0.02, dur: 0.9 }); tone(a, t, { f: 80, f2: 45, peak: 0.4, dur: 0.5 }); },
    touchdown(a, t) { tone(a, t, { f: 70, f2: 40, peak: 0.6, dur: 0.35 }); burst(a, t, { type: 'lowpass', f: 700, peak: 0.4, dur: 0.6, buf: brown }); },
    ignition(a, t) { burst(a, t, { type: 'lowpass', f: 300, f2: 900, peak: 0.6, attack: 0.05, dur: 1.2, buf: brown }); },
    /** Pitido de alarma de dos tonos. */
    alarm(a, t) { tone(a, t, { type: 'square', f: 880, peak: 0.07, dur: 0.16 }); tone(a, t + 0.19, { type: 'square', f: 660, peak: 0.07, dur: 0.16 }); },
    /** Chispa eléctrica: chasquidos muy cortos de ruido agudo. */
    spark(a, t, k) { for (let i = 0; i < 2 + Math.random() * 4; i++) burst(a, t + Math.random() * 0.12, { type: 'highpass', f: rnd(2500, 6000), peak: 0.05 + 0.18 * k, attack: 0.001, dur: rnd(0.012, 0.04) }); },
    /** Reparación: chisporroteo de soldadura y golpecitos de herramienta. */
    weld(a, t) {
      burst(a, t, { type: 'bandpass', f: rnd(2500, 4500), q: 1.5, peak: 0.07, attack: 0.002, dur: rnd(0.05, 0.12) });
      if (Math.random() < 0.25) tone(a, t, { type: 'triangle', f: rnd(1700, 2300), peak: 0.06, dur: 0.06 });
    },
    creak(a, t) { burst(a, t, { type: 'bandpass', f: rnd(120, 260), q: 6, peak: 0.25, attack: 0.05, dur: rnd(0.4, 0.8), buf: brown }); }
  };
  function play(name, k) { const a = ctx(); if (a) try { SND[name](a, a.currentTime + 0.005, k || 1); } catch (e) { /* nada */ } }

  // =====================================================================
  //  CÁMARA, VIÑETA Y LÍNEAS DE ESTRÉS
  // =====================================================================
  let trauma = 0, punch = 0, vig = 0, vigCol = '255,40,30', rumble = 0, stress = 0, alarmOn = false;
  const holds = {};
  const fcv = $('#fx-cv'), fc = fcv.getContext('2d');
  let fcDirty = false;
  const shot = (amount) => { trauma = clamp(trauma + amount * calm, 0, 1); };

  /** Golpes puntuales que piden las fases. */
  const EVENTS = {
    stage: () => { shot(0.75); punch = 0.06; play('stage'); },
    impact: () => { shot(0.6); vig = 1; vigCol = '255,40,30'; play('impact'); },
    fault: () => { shot(0.35); vig = Math.max(vig, 0.8); vigCol = '255,40,30'; play('fault'); },
    crash: () => { shot(1); vig = 1; vigCol = '255,30,20'; punch = 0.05; play('crash'); stopLoops(); },
    success: () => { play('success'); },
    fixed: () => { vig = Math.max(vig, 0.45); vigCol = '60,255,150'; play('fixed'); },
    chute: () => { shot(0.5); punch = 0.035; play('chute'); },
    chuteBad: () => { shot(0.7); vig = 0.8; vigCol = '255,40,30'; play('chute'); play('fault'); },
    touchdown: () => { shot(0.3); play('touchdown'); },
    hardLanding: () => { shot(0.7); vig = 0.8; vigCol = '255,40,30'; play('impact'); },
    ignition: () => { shot(0.3); play('ignition'); }
  };
  A.fx = {
    event(name) { if (EVENTS[name]) EVENTS[name](); },
    /** Marca un estado continuo (p. ej. 'weld', 'spark') como activo durante el próximo instante. */
    hold(name, k) { holds[name] = { until: performance.now() + 150, k: k == null ? 1 : k }; },
    shake: shot
  };
  const held = (n) => (holds[n] && holds[n].until > performance.now() ? holds[n].k : 0);

  // ---------- Botón de silencio ----------
  const mute = $('#snd-btn');
  function paintMute() {
    mute.classList.toggle('off', !!A.settings.muted);
    mute.title = A.settings.muted ? 'Activar el sonido' : 'Silenciar el sonido';
    mute.setAttribute('aria-label', mute.title); mute.setAttribute('aria-pressed', String(!!A.settings.muted));
  }
  mute.addEventListener('click', (e) => {
    e.preventDefault(); A.settings.muted = !A.settings.muted; A.saveSettings(); A.audio(); A.applyVolume(); paintMute(); mute.blur();
    if (!A.settings.muted) A.beep(880, 0.06);
  });
  paintMute();

  // ---------- Lectura de la telemetría ----------
  function feed() {
    const F = A.flight || {};
    for (const k of ['launch', 'edl', 'ship']) { const f = F[k] && F[k](); if (f) return f; }
    return null;
  }
  const TARGETS = ['#screen-launch', '#screen-ship', '#ext'].map($);
  let prev = { kind: '', alerts: 0, flash: 0, ign: false }, thr = 0, last = performance.now(), tt = 0, nextAlarm = 0, nextCreak = 0, nextSpark = 0, nextWeld = 0, wasTransformed = false;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    const f = A.paused ? null : feed(), a = ctx();
    rumble = 0; stress = 0; alarmOn = false;
    let eng = 0, engF = 200, roar = 0;
    if (f) {
      thr += ((f.thrust || 0) - thr) * (1 - Math.exp(-dt * 8));
      if (f.kind === 'launch') {
        const rho = Math.exp(-f.h / A.REAL.EARTH_SCALE_H);
        rumble = thr * (0.08 + 0.22 * rho);                                  // vibración continua en el aire denso
        stress = clamp((f.q - 0.8) / 0.5, 0, 1);                             // Max-Q
        rumble += stress * 0.35;
        eng = thr * (0.35 + 0.65 * rho); engF = 140 + 900 * thr * (0.4 + 0.6 * rho);
        alarmOn = f.q > 1 || (f.fuel > 0 && f.fuel < 10);
        if (f.thrust && !prev.ign) EVENTS.ignition();
        prev.ign = !!f.thrust || f.h > 0.05;
        if (f.t < 0) prev.ign = false;
        if (stress > 0.3 && now > nextCreak) { play('creak'); nextCreak = now + rnd(500, 1200); }
      } else if (f.kind === 'edl') {
        roar = f.stage < 3 ? f.heat : 0;                                     // plasma de la entrada
        rumble = roar * 0.18 + thr * 0.08;
        stress = f.stage === 1 ? clamp(f.heat - 0.5, 0, 1) * 0.8 : 0;
        eng = thr * 0.55; engF = 300 + 500 * thr;
        alarmOn = (f.stage === 1 && f.off > 0) || f.shield < 25 || (f.stage === 3 && f.v > 10 && f.hm < 200);
      } else {
        eng = f.mode === 'voyage' ? 0.05 : 0; engF = 120;
        alarmOn = f.mode === 'voyage' && f.alerts.length > 0;
        if (f.flash > 0.9 && prev.flash <= 0.9) EVENTS.impact();             // micrometeorito
        if (f.kind === prev.kind && f.alerts.length > prev.alerts && f.mode === 'voyage') EVENTS.fault();
        prev.flash = f.flash; prev.alerts = f.alerts.length;
        if (alarmOn) vig = Math.max(vig, 0.22 + 0.12 * Math.sin(tt * 6));   // pulso rojo suave mientras dure la alarma
      }
      prev.kind = f.kind;
    } else { thr = 0; prev.kind = ''; prev.ign = false; }

    // ---------- sonido continuo ----------
    if (a) {
      setLoop('engine', a, { buf: brown, type: 'lowpass', q: 0.8 }, eng * 0.9, engF);
      setLoop('sub', a, { buf: brown, type: 'lowpass', q: 4 }, eng * 0.5, 55);
      setLoop('plasma', a, { buf: noise, type: 'bandpass', q: 0.6 }, roar * 0.35, 700 + roar * 900);
      const w = held('weld');
      setLoop('weld', a, { buf: noise, type: 'bandpass', q: 1.2 }, w * 0.05, 3200);
      if (w && now > nextWeld) { play('weld'); nextWeld = now + rnd(60, 160); }
      const sp = held('spark');
      if (sp && now > nextSpark) { play('spark', sp); nextSpark = now + rnd(250, 900) / Math.max(0.3, sp); }
      if (alarmOn && now > nextAlarm) { play('alarm'); nextAlarm = now + 900; }
    }

    // ---------- cámara ----------
    trauma = Math.max(0, trauma - dt * 1.3); punch *= Math.exp(-dt * 4); vig = Math.max(0, vig - dt * 0.9);
    const k = (trauma * trauma + rumble * rumble) * calm;
    const tx = k * 26 * (Math.random() * 2 - 1) + rumble * calm * 3 * Math.sin(tt * 37);
    const ty = k * 26 * (Math.random() * 2 - 1) + rumble * calm * 3 * Math.sin(tt * 43 + 1);
    const rot = trauma * trauma * calm * 1.1 * (Math.random() * 2 - 1);
    const sc = 1 + punch + k * 0.02;                                         // algo de zoom para no ver los bordes
    const moved = Math.abs(tx) + Math.abs(ty) > 0.05 || Math.abs(rot) > 0.01 || sc > 1.0005;
    if (moved || wasTransformed) {
      const tr = moved ? 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) rotate(' + rot.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')' : '';
      TARGETS.forEach((el) => { if (el) el.style.transform = tr; });
      wasTransformed = moved;
    }

    // ---------- viñeta y líneas de estrés ----------
    if (vig > 0.01 || stress > 0.01) {
      fc.clearRect(0, 0, W, H); fcDirty = true;
      if (vig > 0.01) {
        const g = fc.createRadialGradient(800, 450, 360, 800, 450, 980);
        g.addColorStop(0, 'rgba(' + vigCol + ',0)'); g.addColorStop(1, 'rgba(' + vigCol + ',' + (0.55 * vig).toFixed(3) + ')');
        fc.fillStyle = g; fc.fillRect(0, 0, W, H);
      }
      if (stress > 0.01) {                                                   // líneas de estrés aerodinámico hacia el centro
        fc.strokeStyle = 'rgba(255,255,255,' + (0.6 * stress) + ')'; fc.lineWidth = 2.5;
        for (let i = 0; i < 26 * stress + 4; i++) {
          const an = rnd(0, Math.PI * 2), r0 = rnd(330, 560), l = rnd(70, 220) * (0.5 + stress);
          const x = 800 + Math.cos(an) * r0 * 1.4, y = 450 + Math.sin(an) * r0 * 0.8;
          fc.beginPath(); fc.moveTo(x, y); fc.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l * 0.6); fc.stroke();
        }
        const g = fc.createRadialGradient(800, 450, 300, 800, 450, 950);
        g.addColorStop(0, 'rgba(255,150,60,0)'); g.addColorStop(1, 'rgba(255,150,60,' + 0.22 * stress + ')');
        fc.fillStyle = g; fc.fillRect(0, 0, W, H);
      }
    } else if (fcDirty) { fc.clearRect(0, 0, W, H); fcDirty = false; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
