/* AEON-01 — Fase 3: entrada, descenso y aterrizaje (EDL) desde la cabina, reporte final y cierres.
   Usa la misma cabina que el lanzamiento: monitores con los datos y control manual.
   Paso 1: mantener el ángulo de entrada dentro del corredor (◀ ▶) para cuidar el escudo.
   Paso 2: abrir el paracaídas (P) dentro de la ventana de altitud.
   Pasos 3-4: retropropulsores (ESPACIO) para tocar suelo a menos de 4 m/s. */
(function () {
  'use strict';
  const A = window.AEON, M = A.mission;
  const $ = (s) => document.querySelector(s);
  const cv = $('#launch'), c = cv.getContext('2d'), VW = cv.width, VH = cv.height;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const R = A.REAL;
  const G_MARS = R.G_MARS, THRUST = 13;            // m/s²: gravedad de Marte (NASA/ESA) y frenado de los retropropulsores
  // Paracaídas: Perseverance lo abrió a unos 11 km y 420 m/s. La ventana verde se centra en ese dato.
  const CH_TOP = R.CHUTE_H + 2.7, CH_HI = R.CHUTE_H + 0.9, CH_LO = R.CHUTE_H - 0.9, CH_END = R.CHUTE_H - 2.8;   // 13,7 · 11,9 · 10,1 · 8,2 km
  const km1 = (x) => x.toFixed(1).replace('.', ',');

  let E = null, cfg = null, voy = null, on = false, last = 0, raf = 0;
  const keys = { l: false, r: false, fire: false };
  const q = (who, t) => '<div class="quote"><div class="who">' + who + '</div>' + t + '</div>';

  A.startEDL = function (v) {
    voy = v; cfg = M.calc();
    E = { stage: 1, t: 0, h: R.ENTRY_H, v: R.ENTRY_V, heat: 0, a: 0, z: 0, off: 0, shield: v.shield, fuel: 100, fuelSec: clamp(6 + v.dv * 10, 6, 26), chute: null,
      energy: v.bat, hm: 0, vm: 0, firing: false, landed: false, hard: false, end: 0, step: 0 };
    keys.l = keys.r = keys.fire = false;
    const L = { 'cam-lbl': 'CÁM. EXTERIOR · LANDER', 'ml-t': 'FASE 3 · DESCENSO', 'ml-a': 'ALTITUD', 'ml-b': 'VELOCIDAD', 'mr-t': 'PROTECCIÓN TÉRMICA', 'mr-a': 'TEMPERATURA', 'mr-au': '°C', 'mr-b': 'ESCUDO', 'l-fire-lbl': 'DESCENSO' };
    Object.keys(L).forEach((k) => { $('#' + k).textContent = L[k]; });
    ['#holo', '#launch-end', '#l-msg-box'].forEach((s) => { $(s).classList.add('hidden'); $(s).classList.remove('flex'); });
    $('#l-count').textContent = ''; $('#heat').style.opacity = 0; $('#l-clock').textContent = 'EDL';
    A.show('launch'); on = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
    card(1);
  };

  // ---------- Tarjeta holográfica de cada paso ----------
  const STEPS = {
    1: ['< ALERTA: FASE DE DESCENSO INICIADA > · PASO 01 — ENTRADA ATMOSFÉRICA', 'Verifica la integridad del escudo térmico. La nave está experimentando un calentamiento intenso debido a la interacción con la atmósfera. <b>Mantén el ángulo de entrada en la zona verde con ◀ ▶ (A / D).</b>'],
    2: ['PASO 02 — REDUCCIÓN DE VELOCIDAD', 'Los sistemas de desaceleración deben reducir la velocidad del vehículo. <b>Abre el paracaídas con P (o la pantalla DESCENSO) cuando la altitud esté en la zona verde.</b>'],
    3: ['PASO 03 — ACTIVACIÓN DE RETROPROPULSORES', 'Verifica la disponibilidad de propelente y confirma la activación de los sistemas de descenso. <b>Mantén ESPACIO para frenar. Toca suelo a menos de 4 m/s.</b>'],
    4: ['PASO 04 — ATERRIZAJE', '¡Atención, cadete! Estamos a pocos segundos de la superficie. Controla la velocidad vertical: <b>menos de 4 m/s al contacto</b>.']
  };
  function card(n) {
    E.step = n;
    $('#edl-step').textContent = STEPS[n][0]; $('#edl-txt').innerHTML = '<b>INSTRUCTOR:</b> ' + STEPS[n][1];
    const ui = $('#edl-ui');
    if (n === 1) {
      ui.innerHTML = '<div class="flex items-center gap-3"><button id="e-l" class="opt" style="flex:none;width:56px;text-align:center">◀</button><div class="corr flex-1"><i id="e-zone"></i><u id="e-mark"></u></div><button id="e-r" class="opt" style="flex:none;width:56px;text-align:center">▶</button></div>';
      [['#e-l', 'l'], ['#e-r', 'r']].forEach((x) => {
        const b = $(x[0]); b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[x[1]] = true; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => { keys[x[1]] = false; }));
      });
    } else if (n === 2) ui.innerHTML = '<div class="corr"><i style="left:' + ((CH_TOP - CH_HI) / (CH_TOP - CH_END) * 100).toFixed(1) + '%;width:' + ((CH_HI - CH_LO) / (CH_TOP - CH_END) * 100).toFixed(1) + '%"></i><u id="e-mark"></u></div><div class="flex justify-between text-[13px] mt-1"><span>' + km1(CH_TOP) + ' km</span><span>ventana ' + km1(CH_HI) + ' – ' + km1(CH_LO) + ' km</span><span>' + km1(CH_END) + ' km</span></div>';
    else ui.innerHTML = '';
    $('#edl-card').classList.remove('hidden');
  }
  function fireLabel(t, ready) { $('#l-fire-txt').textContent = t; $('#l-fire').classList.toggle('ready', !!ready); }

  function deploy() {
    if (E.stage !== 2 || E.chute) return;
    E.chute = E.h > CH_HI ? 'rip' : E.h >= CH_LO ? 'ok' : 'late';
    E.stage = 2.5; E.t = 0; E.h1 = E.h; E.v1 = E.v;
    A.beep(E.chute === 'ok' ? 880 : 200, 0.3);
    $('#edl-step').textContent = { ok: 'PARACAÍDAS DESPLEGADO', rip: 'PARACAÍDAS DAÑADO: apertura demasiado pronto', late: 'APERTURA TARDÍA: frenado parcial' }[E.chute];
    $('#edl-txt').innerHTML = '<b>INSTRUCTOR:</b> Supervisa la telemetría. La velocidad debe mantenerse dentro de los márgenes previstos.'; $('#edl-ui').innerHTML = '';
  }

  // ---------- Simulación ----------
  function update(dt) {
    const e = E; e.t += dt; e.firing = false;
    e.energy = Math.max(0, e.energy - 0.1 * dt);
    if (e.stage === 1) {
      const u = clamp(e.t / 20, 0, 1);
      e.h = R.ENTRY_H - (R.ENTRY_H - CH_TOP) * Math.pow(u, 0.85); e.v = R.ENTRY_V - (R.ENTRY_V - 450) * (u * u * (3 - 2 * u)); e.heat = Math.pow(Math.sin(Math.PI * u), 1.5);
      e.z = 0.5 * Math.sin(e.t * 0.7) + 0.25 * Math.sin(e.t * 1.9);
      e.a = clamp(e.a + (0.45 * Math.sin(e.t * 1.3 + 1) + ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * 1.3) * dt, -1, 1);
      e.off = Math.max(0, Math.abs(e.a - e.z) - 0.22);
      e.shield -= e.heat * (1.2 + 14 * e.off) / cfg.shieldF * dt;
      fireLabel(e.off > 0 ? 'FUERA DE CORREDOR' : 'ESCUDO ACTIVO', e.off === 0);
      if (e.shield <= 0) { e.shield = 0; return fail('El escudo térmico se consumió durante la entrada atmosférica.', 'NO ACTIVADOS'); }
      if (u >= 1) { e.stage = 2; e.t = 0; e.heat = 0; card(2); fireLabel('PARACAÍDAS (P)', true); }
    } else if (e.stage === 2) {
      e.h = CH_TOP - 0.8 * e.t; e.v = 450 - 8 * e.t;      // a 11 km la velocidad es de unos 420 m/s, como en Perseverance
      if (e.h < CH_END) deploy();
    } else if (e.stage === 2.5) {
      const u = clamp(e.t / 3.5, 0, 1), k = u * u * (3 - 2 * u);
      const vt = { ok: 70, late: 110, rip: 190 }[e.chute], h0 = { ok: 1.2, late: 1.8, rip: 2.6 }[e.chute];
      e.h = e.h1 + (h0 - e.h1) * k; e.v = e.v1 + (vt - e.v1) * k;
      if (u >= 1) { e.stage = 3; e.hm = h0 * 1000; e.vm = vt; card(3); fireLabel('RETRO (ESPACIO)', true); }
    } else if (e.stage === 3) {
      e.firing = keys.fire && e.fuel > 0;
      e.vm += (G_MARS - (e.firing ? THRUST : 0)) * dt; e.hm -= e.vm * dt;
      if (e.firing) e.fuel = Math.max(0, e.fuel - 100 / e.fuelSec * dt);
      e.h = e.hm / 1000; e.v = e.vm;
      fireLabel(e.fuel <= 0 ? 'SIN PROPELENTE' : e.firing ? 'RETRO ACTIVOS' : 'RETRO (ESPACIO)', !e.firing && e.fuel > 0);
      if (e.step === 3 && e.hm < 300) card(4);
      if (e.step === 4) $('#edl-ui').innerHTML = '<div class="kv"><span>Retropropulsores: <b>' + (e.firing ? 'ACTIVOS' : 'EN ESPERA') + '</b></span><span>Velocidad: <b>' + e.vm.toFixed(1) + ' m/s</b></span><span>Altitud: <b>' + Math.max(0, e.hm).toFixed(0) + ' m</b></span><span>Combustible: <b>' + e.fuel.toFixed(0) + ' %</b></span></div>';
      if (e.hm <= 0) {
        e.hm = 0; e.h = 0; e.touch = e.vm;
        if (e.vm > 10) return fail('El vehículo llegó a la superficie a ' + e.vm.toFixed(0) + ' m/s.', e.fuel > 0 ? 'EMPUJE INSUFICIENTE' : 'SIN PROPELENTE');
        e.hard = e.vm > 4; e.landed = true; e.stage = 5; e.t = 0; e.v = 0; e.firing = false; A.beep(880, 0.6);
        $('#edl-step').textContent = 'CONTROL DE MISIÓN'; $('#edl-ui').innerHTML = '';
        $('#edl-txt').innerHTML = 'Contacto con la superficie confirmado' + (e.hard ? ' (aterrizaje brusco: ' + e.vm.toFixed(1) + ' m/s)' : '') + '.<br><span class="motto">¡ATERRIZAJE COMPLETADO!</span>';
        fireLabel('EN SUPERFICIE', true);
      }
    } else if (e.stage === 5 && e.t > 3.2) { e.stage = 6; finalReport(); }
  }

  // ---------- Monitor central: cámara exterior del lander ----------
  function drawView(now) {
    const e = E, sp = clamp((e.h - 25) / 60, 0, 1), RX = VW / 2, RY = 92;
    const g = c.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, 'rgb(' + Math.round(150 * (1 - sp)) + ',' + Math.round(105 * (1 - sp)) + ',' + Math.round(80 * (1 - sp) + 8) + ')'); g.addColorStop(1, 'rgb(' + Math.round(232 - 200 * sp) + ',' + Math.round(180 - 165 * sp) + ',' + Math.round(130 - 115 * sp) + ')');
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    if (e.stage < 3) { c.fillStyle = '#b9562c'; c.beginPath(); c.arc(RX, VH + 620 - (1 - sp) * 60, 660, 0, 7); c.fill(); }
    else { const gy = RY + 26 + e.hm * 0.11; if (gy < VH + 10) { c.fillStyle = '#8a3d1e'; c.fillRect(0, gy, VW, VH); c.fillStyle = '#5a2110'; for (let i = 0; i < 9; i++) c.fillRect(20 + i * 50, gy + 4 + (i % 3) * 5, 14, 5); } }
    if (e.heat > 0.05) { const pg = c.createRadialGradient(RX, RY + 22, 4, RX, RY + 22, 90); pg.addColorStop(0, 'rgba(255,240,200,' + e.heat + ')'); pg.addColorStop(0.4, 'rgba(255,130,40,' + e.heat * 0.8 + ')'); pg.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = pg; c.fillRect(0, 0, VW, VH); }
    if (e.chute && e.stage >= 2.5 && e.stage < 5 && e.chute !== 'rip') {
      c.strokeStyle = '#ddd'; c.lineWidth = 1; [-34, 0, 34].forEach((x) => { c.beginPath(); c.moveTo(RX, RY - 8); c.lineTo(RX + x, RY - 58); c.stroke(); });
      c.fillStyle = e.chute === 'ok' ? '#ff7a3c' : '#c9a37a'; c.beginPath(); c.arc(RX, RY - 56, e.chute === 'ok' ? 40 : 26, Math.PI, 0); c.fill();
    }
    if (e.firing) { const len = 26 + Math.random() * 16, fg = c.createLinearGradient(0, RY + 22, 0, RY + 22 + len); fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.4, 'rgba(255,170,60,.9)'); fg.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = fg; [-14, 14].forEach((x) => { c.beginPath(); c.moveTo(RX + x - 5, RY + 22); c.lineTo(RX + x, RY + 22 + len); c.lineTo(RX + x + 5, RY + 22); c.fill(); }); }
    c.fillStyle = '#e9eef4'; c.beginPath(); c.moveTo(RX - 10, RY - 10); c.lineTo(RX + 10, RY - 10); c.lineTo(RX + 30, RY + 16); c.lineTo(RX - 30, RY + 16); c.fill();   // cápsula
    c.fillStyle = '#6b3a1e'; c.beginPath(); c.ellipse(RX, RY + 18, 32, 6, 0, 0, 7); c.fill();
    if (e.stage >= 3) { c.strokeStyle = '#9aa3ad'; c.lineWidth = 2; c.beginPath(); c.moveTo(RX - 22, RY + 18); c.lineTo(RX - 32, RY + 27); c.moveTo(RX + 22, RY + 18); c.lineTo(RX + 32, RY + 27); c.stroke(); }
    c.strokeStyle = 'rgba(127,220,255,.5)'; c.lineWidth = 1; c.strokeRect(6, 22, VW - 12, VH - 28);
    if (Math.floor(now / 500) % 2 && !e.landed) { c.fillStyle = '#ff3c3c'; c.beginPath(); c.arc(VW - 16, 34, 4, 0, 7); c.fill(); }
  }

  function drawPanels() {
    const e = E, km = e.stage < 3;
    $('#l-alt').textContent = km ? e.h.toFixed(e.h < 20 ? 1 : 0) : Math.max(0, e.hm).toFixed(0); $('#ml-au').textContent = km ? 'km' : 'm';
    $('#l-vel').textContent = e.v > 1000 ? (e.v / 1000).toFixed(2) : e.v.toFixed(e.stage >= 3 ? 1 : 0); $('#ml-bu').textContent = e.v > 1000 ? 'km/s' : 'm/s';
    $('#l-q').textContent = Math.round(20 + e.heat * (R.PEAK_HEAT_C - 20) - (e.stage > 1 ? 70 : 0));      // pico: 1.300 °C (Perseverance)
    $('#l-hull').textContent = e.shield.toFixed(0);
    $('#l-fuel').textContent = e.fuel.toFixed(0) + '%'; $('#l-energy').textContent = e.energy.toFixed(0) + '%';
    $('#lb-alt').style.width = clamp(km ? e.h / R.ENTRY_H * 100 : e.hm / 26, 0, 100) + '%';
    $('#lb-vel').style.width = clamp(e.stage < 3 ? e.v / 55 : e.vm / 2, 0, 100) + '%'; $('#lb-vel').classList.toggle('danger', e.stage === 3 && e.vm > 10 && e.hm < 200);
    $('#lb-q').style.width = e.heat * 100 + '%'; $('#lb-q').classList.toggle('danger', e.off > 0);
    $('#lb-hull').style.width = e.shield + '%'; $('#lb-hull').classList.toggle('danger', e.shield < 40);
    $('#lb-fuel').style.width = e.fuel + '%'; $('#lb-fuel').classList.toggle('danger', e.fuel < 20);
    $('#lb-energy').style.width = e.energy + '%';
    $('#l-fire').classList.toggle('is-held', e.firing);
    if (e.step === 1 && $('#e-mark')) { $('#e-zone').style.left = ((e.z - 0.22 + 1) * 50) + '%'; $('#e-zone').style.width = '22%'; $('#e-mark').style.left = ((e.a + 1) * 50) + '%'; }
    if (e.stage === 2 && $('#e-mark')) $('#e-mark').style.left = clamp((CH_TOP - e.h) / (CH_TOP - CH_END) * 100, 0, 100) + '%';
    const shake = e.stage === 1 ? e.heat * 5 : e.firing ? 3 : e.stage === 2.5 ? 2 : 0;
    $('#cockpit').style.transform = shake ? 'translate(' + ((Math.random() - 0.5) * shake).toFixed(1) + 'px,' + ((Math.random() - 0.5) * shake).toFixed(1) + 'px)' : '';
  }

  function loop(now) {
    raf = 0;
    if (!on || $('#screen-launch').classList.contains('hidden')) { on = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000) * (A.ts || 1); last = now;
    if (E.stage < 6) update(dt);
    if (!on) return;
    A.sky.drawMars(E, dt, now); drawView(now); drawPanels();
    raf = requestAnimationFrame(loop);
  }

  // ---------- Resultados ----------
  function fail(cause, retro) {
    E.stage = 9; $('#edl-card').classList.add('hidden'); $('#cockpit').style.transform = ''; A.beep(140, 0.7);
    M.report('<h3>&lt; MISIÓN INTERRUMPIDA &gt;</h3><div class="who">CENTRO DE CONTROL DE MISIÓN</div>' +
      '<p>Cadete, hemos perdido la confirmación de un aterrizaje seguro.</p><p>Los últimos datos recibidos indican que el vehículo de descenso no pudo completar correctamente la secuencia de entrada, descenso y aterrizaje.</p>' +
      '<div class="alert mb-2"><b>INFORME DE FALLO</b> · Segmento afectado: Espacial.<br>Causa: Protección térmica insuficiente, reservas de propelente inadecuadas o configuración incorrecta del sistema de descenso. ' + cause + '<br>' +
      'Integridad del escudo térmico: ' + E.shield.toFixed(0) + ' % · Propelente disponible: ' + E.fuel.toFixed(0) + ' % · Estado de retropropulsores: ' + retro + ' · Estado de aterrizaje: NO CONFIRMADO.</div>' +
      q('INSTRUCTOR', 'La llegada a Marte exige una planificación completa de la fase de descenso. No basta con alcanzar el planeta. La nave debe estar preparada para atravesar su atmósfera y completar el aterrizaje dentro de los parámetros establecidos.') +
      '<p class="motto">LECCIÓN APRENDIDA: Verifica la integridad del escudo térmico, la capacidad de propulsión y las reservas necesarias antes de iniciar el descenso.</p>',
      [{ l: 'Menú principal', fn: () => { on = false; A.show('menu'); } }, { l: 'Repetir el descenso', fn: () => A.startEDL(voy) }, { l: '[ Reintentar misión ]', fn: () => { on = false; A.startShip('config'); } }]);
  }

  function finalReport() {
    $('#edl-card').classList.add('hidden');
    const e = E, k = cfg, tries = A.run.tries || 1;
    const op = Math.max(0, voy.instrOk - (e.hard ? 1 : 0)), obj = Math.round(op / M.INSTR.length * 100);
    const kwNow = (k.kw * clamp(e.energy / 100, 0, 1)).toFixed(1);
    const evL = tries > 1 ? 'SUPERADO (tras ' + tries + ' lanzamientos)' : 'SUPERADO';
    const evS = (voy.crit < 6 && !e.hard && e.chute === 'ok') ? 'EXCELENTE' : 'SUPERADO' + (e.hard ? ' — aterrizaje brusco' : '') + (voy.crit >= 6 ? ' — recursos en estado crítico durante el viaje' : '');
    const evT = (voy.right === 3 ? 'EXCELENTE' : voy.right === 2 ? 'SUPERADO' : 'DEFICIENTE') + ' (' + voy.right + '/3 decisiones correctas al primer intento)';
    const evU = (obj >= 75 ? 'EXCELENTE' : obj >= 50 ? 'SUPERADO' : obj > 0 ? 'PARCIAL' : 'NO CUMPLIDO') + ' (' + op + ' instrumentos transmitiendo)';
    const eff = Math.round(0.35 * obj + 0.2 * e.fuel + 0.2 * e.shield + 0.15 * voy.o2 + 0.1 * voy.right / 3 * 100);
    const grade = eff >= 80 ? 'SOBRESALIENTE' : eff >= 65 ? 'NOTABLE' : eff >= 50 ? 'APROBADO' : 'INSUFICIENTE';
    const grad = obj >= 50 && eff >= 50;
    const kv = (l, v) => '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>';
    const seg = (t, qq, r) => '<div class="seg"><b>' + t + '</b>' + qq + '<div class="mt-1 text-emerald-300">Resultado: ' + r + '</div></div>';

    const page3 = () => M.report('<div class="who">INSTRUCTOR JEFE — CONTROL DE MISIÓN</div><h3>MENSAJE FINAL DEL INSTRUCTOR</h3>' +
      '<p>Cadete, tu entrenamiento ha concluido.</p><p>Ahora comprendes que explorar el espacio es mucho más que construir una nave y elegir un destino.</p>' +
      '<p>Es aprender a trabajar con recursos limitados, interpretar datos, resolver problemas y tomar decisiones bajo presión.</p>' +
      '<p>Desde el lanzamiento hasta el análisis científico, cada segmento cumple una función indispensable.</p><p>Marte es solo el comienzo.</p>' +
      '<p>El universo sigue esperando a quienes se atrevan a explorarlo.</p><p class="motto">FIN DEL ENTRENAMIENTO.</p>',
      [{ l: '[ Volver al inicio ]', fn: () => { on = false; A.store.del('aeon01.save'); A.show('menu'); } }]);

    const page2 = () => grad ? M.report('<h3>&lt; MISIÓN COMPLETADA &gt;</h3><div class="who">CENTRO DE CONTROL DE MISIÓN — TIERRA</div>' +
      '<p>Cadete, tenemos confirmación.</p><p>La nave ha aterrizado en Marte, los sistemas esenciales permanecen operativos y los instrumentos científicos han completado satisfactoriamente sus objetivos. Los datos recibidos confirman que la expedición ha cumplido los parámetros establecidos.</p>' +
      '<p>Has demostrado dominio de los cuatro segmentos de una misión espacial. El vehículo de lanzamiento fue seleccionado correctamente. La nave mantuvo su estabilidad durante el viaje. El equipo terrestre gestionó las anomalías y los instrumentos científicos proporcionaron información valiosa.</p>' +
      '<p>Pero tu mayor logro no fue simplemente alcanzar Marte. Fue conseguirlo respetando los límites de masa, presupuesto y recursos disponibles.</p>' +
      q('INSTRUCTOR JEFE', 'Durante esta simulación aprendiste que una misión espacial no depende de una sola decisión, sino de cientos de decisiones coordinadas. Cada gramo cuenta. Cada kilovatio importa. Cada maniobra tiene consecuencias. ' +
        'Hoy has demostrado que puedes pensar como un ingeniero, actuar como un operador de vuelo y evaluar una misión como un científico.') +
      '<p>En nombre del Centro de Control de Misión:</p><p class="motto">¡FELICITACIONES, CADETE! Has completado el Programa de Simulación Orbital.<br>TU MISIÓN HA SIDO UN ÉXITO.</p><div class="ok">&lt; GRADUACIÓN AUTORIZADA &gt;</div>',
      [{ l: 'Continuar', fn: page3 }])
      : M.report('<h3>&lt; MISIÓN PARCIAL &gt;</h3><div class="who">CENTRO DE CONTROL DE MISIÓN — TIERRA</div>' +
        '<p>Cadete, la nave ha aterrizado en Marte, pero la expedición no cumplió sus objetivos: objetivos científicos ' + obj + ' %, eficiencia de recursos ' + eff + ' %.</p>' +
        q('INSTRUCTOR', 'El éxito no se mide únicamente por llegar al destino. Una nave sin instrumentos operativos puede llegar a Marte sin cumplir su objetivo científico. Revisa el diseño y la gestión de recursos, y vuelve a intentarlo.') +
        '<div class="alert">Graduación no autorizada todavía.</div>',
        [{ l: '[ Reintentar misión ]', fn: () => { on = false; A.startShip('config'); } }, { l: 'Continuar', fn: page3 }]);

    M.report('<div class="who">5.2 · SEGMENTO DE USUARIO — CENTRO DE CONTROL DE MISIÓN · TIERRA</div>' +
      '<p>La nave ha alcanzado Marte. Los instrumentos científicos han comenzado a transmitir los primeros datos de la expedición. Ahora, los científicos e investigadores en Tierra analizarán los resultados para determinar si se cumplieron los objetivos de la misión. ' +
      'El éxito no se mide únicamente por llegar al destino: también debemos evaluar la cantidad, calidad y utilidad de la información obtenida.</p>' +
      '<h3>REPORTE FINAL DE MISIÓN</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 34px">' +
      kv('Nombre de misión', A.settings.shipName || 'AEON-01') + kv('Destino', 'Marte') + kv('Estado', grad ? 'COMPLETADA' : 'PARCIAL') + kv('Masa total', k.mass + ' t') +
      kv('Delta-v utilizado', (k.dv - voy.dv * e.fuel / 100).toFixed(2) + ' km/s') + kv('Propelente restante', e.fuel.toFixed(0) + ' %') +
      kv('Integridad del escudo térmico', e.shield.toFixed(0) + ' %') + kv('Reservas de soporte vital', voy.o2.toFixed(0) + ' %') +
      kv('Potencia eléctrica', kwNow + ' kW') + kv('Instrumentos científicos operativos', op + ' de ' + voy.instrN) + '</div>' +
      '<div class="who mt-2">EVALUACIÓN DE LOS CUATRO SEGMENTOS</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      seg('SEGMENTO DE LANZAMIENTO', '¿El vehículo seleccionado permitió colocar la carga en la órbita prevista sin superar los límites de masa y presupuesto?', evL) +
      seg('SEGMENTO ESPACIAL', '¿La nave mantuvo sus sistemas operativos durante el viaje y completó correctamente la maniobra de descenso?', evS) +
      seg('SEGMENTO TERRESTRE', '¿Se mantuvo una supervisión adecuada de las comunicaciones, la telemetría y las anomalías de vuelo?', evT) +
      seg('SEGMENTO DE USUARIO', '¿Los instrumentos científicos consiguieron transmitir información útil para los objetivos de investigación?', evU) + '</div>' +
      '<div class="who mt-2">EFICIENCIA DE LA MISIÓN</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 34px">' +
      kv('Presupuesto utilizado', k.budgetPct + ' %') + kv('Masa transportada', k.mass + ' t') + kv('Objetivos científicos completados', obj + ' %') + kv('Eficiencia de recursos', eff + ' %') + '</div>' +
      '<p class="motto mt-2">Calificación final: ' + grade + '</p>',
      [{ l: 'Continuar', fn: page2 }]);
  }

  // ---------- Controles ----------
  window.addEventListener('keydown', (e) => {
    if (!on || !E || E.stage >= 5) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { keys.l = true; e.preventDefault(); }
    if (k === 'd' || k === 'arrowright') { keys.r = true; e.preventDefault(); }
    if (k === 'p') deploy();
    if (e.code === 'Space') { keys.fire = true; e.preventDefault(); }
    if (k === 'escape') { on = false; A.show('menu'); }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') keys.l = false;
    if (k === 'd' || k === 'arrowright') keys.r = false;
    if (e.code === 'Space') keys.fire = false;
  });
  const fb = $('#l-fire');
  fb.addEventListener('pointerdown', (e) => { if (!on || !E) return; e.preventDefault(); if (E.stage === 2) deploy(); else keys.fire = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => fb.addEventListener(t, () => { keys.fire = false; }));
})();
