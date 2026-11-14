/* Programa de Simulación Orbital — interfaz y flujo de pantallas. */
(function () {
  'use strict';
  const { K, DATA } = Sim;
  const $ = (sel, el = document) => el.querySelector(sel);
  const pantalla = $('#pantalla');
  const hud = $('#hud');
  const sinAnimacion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const E = { cfg: Sim.configPorDefecto(), m: null, timer: null };

  /* ---------- utilidades ---------- */
  const n = (v, dec = 1) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const msg = (quien, html, cls = '') => `<div class="msg ${cls}"><span class="etq">${quien}</span>${html}</div>`;
  const instructor = (html, quien = 'Instructor') => msg(quien, html, 'instructor');
  const control = (html, cls = '') => msg('Control de Misión', html, cls);
  const boton = (accion, texto, cls = 'principal', extra = '') => `<button class="${cls}" data-accion="${accion}" ${extra}>[ ${texto} ]</button>`;
  const datos = (filas) => `<ul class="datos">${filas.map(([k, v, c]) => `<li><span>${k}</span><span class="${c || ''}">${v}</span></li>`).join('')}</ul>`;

  function mostrar(html, conHud = true) {
    clearInterval(E.timer);
    cancelAnimationFrame(E.raf);
    hud.hidden = !conHud;
    pantalla.innerHTML = html;
    pantalla.style.animation = 'none';
    void pantalla.offsetWidth;
    pantalla.style.animation = '';
    window.scrollTo(0, 0);
    if (conHud) pintarHud();
  }

  /** Anima un valor de 0 a 1 durante `ms` y llama a `paso(t)`; al final llama a `fin`. */
  function animar(ms, paso, fin) {
    if (sinAnimacion) { paso(1); fin && fin(); return; }
    const t0 = performance.now();
    const tic = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      paso(p);
      if (p < 1) E.raf = requestAnimationFrame(tic); else fin && fin();
    };
    E.raf = requestAnimationFrame(tic);
  }

  /* ---------- HUD de telemetría ---------- */
  function pintarHud() {
    const m = E.m;
    const d = m ? m.d : Sim.evaluar(E.cfg);
    const dv = m ? Sim.dvRestante(m) : d.dv;
    const masa = m ? Sim.masaActual(m) : d.masaTotal;
    const o2 = m ? Sim.oxigeno(m) : 100;
    const pot = m ? m.potencia : d.potencia;
    const escudo = m ? m.escudo : 100;
    const nivel = (v, av, mal) => (v <= mal ? 'mal' : v <= av ? 'av' : '');
    const item = (etq, valor, pct, cls) =>
      `<div class="hud-item ${cls}">${etq}<strong>${valor}</strong><div class="barra"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
    hud.innerHTML =
      item('Delta-v', `${n(dv, 2)} km/s`, (dv / 6) * 100, nivel(dv, 0.8, 0.05)) +
      item('Masa total', `${n(masa)} t`, (masa / d.lanzador.capacidad) * 100, !m && !d.capOk ? 'mal' : '') +
      item('Escudo', `${n(escudo, 0)} %`, escudo, nivel(escudo, 15, 0)) +
      item('Soporte vital', `${n(o2, 0)} %`, o2, nivel(o2, 15, K.O2_MIN)) +
      item('Potencia', `${n(pot)} kW`, (pot / 24) * 100, pot < K.POT_ESENCIAL ? 'mal' : pot < d.demanda ? 'av' : '');
  }

  /* ---------- 1. Inicio ---------- */
  function inicio() {
    E.m = null;
    mostrar(`
      <div class="panel">
        <p class="etq">Instructor Jefe — Control de Misión</p>
        <h1>Programa de Simulación Orbital</h1>
        <p><strong>Bienvenido, cadete.</strong></p>
        <p>Has sido seleccionado para participar en el Programa de Simulación Orbital, un entrenamiento diseñado para preparar a la próxima generación de exploradores espaciales.</p>
        <p>Tu misión: diseñar, ejecutar y evaluar una expedición desde una estación espacial en órbita terrestre hasta la superficie de Marte.</p>
        <p>Pero el espacio no perdona los errores de planificación.</p>
        <p>Dispones de un presupuesto limitado, una capacidad de carga restringida y recursos que deberás administrar cuidadosamente. Cada decisión afectará la seguridad de la tripulación, el rendimiento de la nave y el éxito científico de la expedición.</p>
        <p>Para graduarte, deberás dominar los cuatro segmentos fundamentales de una misión espacial:</p>
        <ol class="segmentos">
          <li><strong>SEGMENTO DE LANZAMIENTO:</strong> Seleccionar el vehículo adecuado y colocar la carga en la órbita prevista.</li>
          <li><strong>SEGMENTO ESPACIAL:</strong> Diseñar y operar la nave, administrar sus recursos y ejecutar el viaje interplanetario.</li>
          <li><strong>SEGMENTO TERRESTRE:</strong> Mantener las comunicaciones, supervisar la telemetría y coordinar las operaciones desde la Tierra.</li>
          <li><strong>SEGMENTO DE USUARIO:</strong> Recibir, analizar y aprovechar los datos científicos obtenidos durante la misión.</li>
        </ol>
        <p>Tu objetivo no es simplemente llegar a Marte.</p>
        <p>Debes llegar con combustible suficiente, sistemas operativos, tripulación protegida y capacidad científica para cumplir los objetivos de la expedición.</p>
        <p class="lema centro">La ingeniería hace posible el viaje. La planificación permite sobrevivirlo.</p>
        <p class="centro">¿Estás preparado, cadete?</p>
        <div class="acciones centro">${boton('manual', 'Iniciar entrenamiento')}</div>
      </div>`, false);
  }

  /* ---------- 2. Manual de telemetría ---------- */
  const MANUAL = [
    ['01. Delta-v / Combustible', 'km/s', 'Representa el cambio de velocidad que tu nave puede conseguir mediante sus propulsores. Lo necesitarás para abandonar la órbita terrestre, corregir desviaciones de trayectoria, realizar maniobras de navegación y reducir velocidad durante la llegada a Marte.',
      'El combustible es tu capacidad de maniobra. Cada corrección tiene un coste. Planifica con anticipación y evita gastar propelente innecesariamente.', 'Reservas de combustible insuficientes pueden impedir completar el descenso.'],
    ['02. Masa total', 'toneladas (t)', 'Representa el peso total de la nave, incluyendo combustible, módulos, instrumentos y carga científica. Una masa mayor exige más energía para acelerar y maniobrar. También puede superar la capacidad del vehículo de lanzamiento.',
      'Cada componente tiene un precio en masa. Un instrumento adicional puede aportar información valiosa, pero también aumentar las exigencias de combustible. No confundas una nave equipada con una nave eficiente.', 'Capacidad de carga del lanzador superada.'],
    ['03. Escudo térmico', '%', 'Indica la integridad y capacidad de protección del sistema térmico de la nave. Durante la entrada atmosférica marciana, la compresión y el calentamiento del gas alrededor del vehículo producen temperaturas extremas, que pueden superar los 1.600 °C según el perfil de entrada.',
      'El escudo térmico es tu última barrera de protección durante el descenso. Su integridad debe mantenerse dentro de los márgenes de seguridad.', 'Protección térmica insuficiente. Riesgo crítico durante la entrada atmosférica.'],
    ['04. Soporte vital y oxígeno', 'días / %', 'Indica cuánto tiempo puede mantenerse la tripulación con los recursos disponibles. El soporte vital administra el oxígeno, elimina el dióxido de carbono y mantiene condiciones habitables dentro de la nave. Un viaje interplanetario puede durar aproximadamente siete meses, dependiendo de la trayectoria y de la ventana de lanzamiento.',
      'La nave debe mantener condiciones habitables durante todo el trayecto. Calcula las reservas para la duración prevista y conserva un margen de seguridad.', 'Reservas de soporte vital por debajo del mínimo operativo.'],
    ['05. Potencia eléctrica', 'kW', 'Representa la energía disponible para alimentar los sistemas de la nave. Es indispensable para las computadoras de navegación, los sistemas de comunicación, los instrumentos científicos, el control térmico y el soporte vital.',
      'Sin energía, los sistemas dejan de responder. Distribuye la potencia entre las funciones esenciales y evita sobrecargar la red eléctrica.', 'Potencia eléctrica insuficiente. Prioriza los sistemas esenciales.'],
  ];
  function manual() {
    mostrar(`
      <h1>Manual rápido de telemetría</h1>
      <p class="etq">Lo que controlarás durante la misión</p>
      ${instructor('<p>Antes del lanzamiento, debes aprender a interpretar los instrumentos de tu nave.</p><p>La telemetría es el conjunto de datos que permite conocer el estado de los sistemas de una misión espacial. Durante el trayecto, estos indicadores serán tu principal fuente de información.</p><p>No los ignores. Una lectura incorrecta puede comprometer toda la expedición.</p>')}
      <div class="rejilla">
        ${MANUAL.map(([t, u, d, i, a]) => `<section class="panel"><span class="unidad">${u}</span><h2>${t}</h2><p>${d}</p>${instructor(`<p>${i}</p>`)}<p class="aviso">ALERTA: ${a}</p></section>`).join('')}
      </div>
      <div class="acciones centro">${boton('hangar', 'Continuar al hangar de diseño')}</div>`, false);
  }

  /* ---------- 3. Hangar: diseño de la misión ---------- */
  function tarjetas(grupo, lista, specs) {
    return `<div class="tarjetas">${DATA[lista].map((p) => `
      <label class="tarjeta"><input type="radio" name="${grupo}" value="${p.id}" ${E.cfg[grupo] === p.id ? 'checked' : ''}>
      <strong>${p.nombre}</strong>${p.desc}<span class="specs">${specs(p)}</span></label>`).join('')}</div>`;
  }
  function hangar() {
    E.m = null;
    const c = E.cfg;
    mostrar(`
      <h1>Hangar de diseño</h1>
      ${instructor(`<p>Debes seleccionar y equilibrar los componentes de la expedición. Cada módulo consume masa, presupuesto y, en algunos casos, energía.</p><p>Presupuesto del programa: <strong>${K.PRESUPUESTO} M</strong>. Delta-v nominal de la misión: <strong>${n(K.DV_NOMINAL)} km/s</strong> (salida ${n(K.DV.tmi)} + correcciones ${n(K.DV.corr)} + descenso ${n(K.DV.retro)}), más el margen que consideres prudente.</p>`)}
      <form class="hangar" id="diseno">
        <div>
          <section class="panel"><h2>Identificación</h2>
            <label class="etq" for="nombre">Nombre de la misión</label><br>
            <input type="text" id="nombre" name="nombre" maxlength="24" value="${esc(c.nombre)}"></section>
          <section class="panel"><h2>Vehículo de lanzamiento</h2>
            ${tarjetas('lanzador', 'lanzadores', (p) => `${p.capacidad} t · ${p.coste} M`)}</section>
          <section class="panel"><h2>1. Nave principal</h2>
            <p>Es el módulo central de transporte y operación. Contiene los sistemas de navegación, propulsión, comunicaciones y soporte vital.</p>
            ${tarjetas('nave', 'naves', (p) => `${p.masa} t · ${p.potencia} kW · ${p.dias} días · ${p.coste} M`)}
            <h3>Propelente: <span id="propTxt"></span></h3>
            <input type="range" name="propelente" min="20" max="110" step="1" value="${c.propelente}" aria-label="Toneladas de propelente">
            <p class="etq">${n(K.COSTE_PROP)} M por tonelada. Más propelente da más delta-v, pero también más masa.</p></section>
          <section class="panel"><h2>2. Módulo de aterrizaje (lander)</h2>
            <p>Vehículo destinado a transportar la carga científica y realizar el descenso hasta la superficie marciana.</p>
            ${tarjetas('lander', 'landers', (p) => `${p.masa} t · ${p.plazas} instrumentos · ${p.coste} M`)}</section>
          <section class="panel"><h2>3. Escudo térmico</h2>
            <p>Sistema de protección diseñado para soportar el calentamiento durante la entrada atmosférica. Cuanto más pesada llegue la nave, más calor deberá soportar.</p>
            ${tarjetas('escudo', 'escudos', (p) => `${p.masa} t · resistencia ${p.resistencia} · ${p.coste} M`)}</section>
          <section class="panel"><h2>4. Instrumentos científicos <span class="unidad" id="plazasTxt"></span></h2>
            <p>Equipamiento destinado a analizar el suelo, la atmósfera y las condiciones ambientales de Marte. Objetivo científico completo: ${K.CIENCIA_OBJ} puntos.</p>
            <div class="tarjetas">${DATA.instrumentos.map((i) => `
              <label class="tarjeta"><input type="checkbox" name="instrumentos" value="${i.id}" ${c.instrumentos.includes(i.id) ? 'checked' : ''}>
              <strong>${i.nombre}</strong><span class="specs">${n(i.masa)} t · ${n(i.potencia)} kW · ${i.coste} M<br>ciencia +${i.ciencia}</span></label>`).join('')}</div></section>
        </div>
        <aside class="panel"><h2>Telemetría de diseño</h2><div id="resumen"></div>
          <div class="acciones">${boton('confirmarDiseno', 'Confirmar diseño')}</div></aside>
      </form>`);
    $('#diseno').addEventListener('input', leerDiseno);
    $('#diseno').addEventListener('submit', (e) => e.preventDefault());
    leerDiseno();
  }

  function leerDiseno() {
    const f = $('#diseno');
    const c = E.cfg;
    ['lanzador', 'nave', 'lander', 'escudo'].forEach((g) => { c[g] = f.elements[g].value; });
    c.nombre = f.elements.nombre.value.trim() || 'Sin nombre';
    c.propelente = Number(f.elements.propelente.value);
    // El lander limita cuántos instrumentos caben.
    const plazas = DATA.landers.find((l) => l.id === c.lander).plazas;
    const cajas = [...f.elements.instrumentos];
    cajas.filter((x) => x.checked).slice(plazas).forEach((x) => { x.checked = false; });
    c.instrumentos = cajas.filter((x) => x.checked).map((x) => x.value);
    cajas.forEach((x) => { x.disabled = !x.checked && c.instrumentos.length >= plazas; });
    $('#plazasTxt').textContent = `${c.instrumentos.length}/${plazas} plazas`;
    $('#propTxt').textContent = `${c.propelente} t`;

    const d = Sim.evaluar(c);
    const proy = Sim.simular(c);
    const cien = Sim.ciencia(Sim.crearMision(c));
    const o2 = (100 * (d.nave.dias - K.DIAS_VIAJE)) / d.nave.dias;
    const alertas = [];
    if (!d.capOk) alertas.push(['', 'Capacidad de carga del lanzador superada.']);
    if (!d.presOk) alertas.push(['', 'Presupuesto del programa superado.']);
    if (d.dv < K.DV_NOMINAL) alertas.push(['', 'Reservas de combustible insuficientes para la misión nominal.']);
    else if (d.dv < K.DV_NOMINAL + 0.2) alertas.push(['av', 'Delta-v sin margen para imprevistos.']);
    if (d.capOk && d.presOk && d.dv >= K.DV_NOMINAL && proy.resultado === 'D') alertas.push(['', 'Protección térmica insuficiente para la masa de entrada prevista.']);
    else if (proy.m.aterrizado && proy.m.escudo < 15) alertas.push(['av', 'Margen térmico muy bajo: cualquier desviación será crítica.']);
    if (o2 < 15) alertas.push(['av', 'Reservas de soporte vital con poco margen.']);
    if (d.potencia < d.demanda) alertas.push(['av', 'Potencia insuficiente para todos los instrumentos. Se priorizarán los esenciales.']);
    if (cien.objetivos < 50) alertas.push(['av', 'Capacidad científica por debajo del objetivo mínimo.']);
    if (!alertas.length) alertas.push(['ok', 'Diseño dentro de todos los parámetros nominales.']);

    $('#resumen').innerHTML = datos([
      ['Masa total', `${n(d.masaTotal)} / ${d.lanzador.capacidad} t`, d.capOk ? 'v-ok' : 'v-mal'],
      ['Presupuesto', `${n(d.coste, 0)} / ${K.PRESUPUESTO} M`, d.presOk ? 'v-ok' : 'v-mal'],
      ['Delta-v', `${n(d.dv, 2)} / ${n(K.DV_NOMINAL)} km/s`, d.dv >= K.DV_NOMINAL ? 'v-ok' : 'v-mal'],
      ['Escudo tras entrada', proy.m.aterrizado ? `${proy.m.escudo} %` : '—', proy.m.aterrizado && proy.m.escudo >= 15 ? 'v-ok' : 'v-av'],
      ['O₂ a la llegada', `${n(o2, 0)} %`, o2 >= 15 ? 'v-ok' : 'v-av'],
      ['Potencia', `${n(d.demanda)} / ${n(d.potencia)} kW`, d.potencia >= d.demanda ? 'v-ok' : 'v-av'],
      ['Objetivos científicos', `${cien.objetivos} %`, cien.objetivos >= 100 ? 'v-ok' : cien.objetivos >= 50 ? '' : 'v-av'],
    ]) + `<p class="etq">Proyección con vuelo nominal, sin anomalías.</p><ul class="alertas">${alertas.map(([c2, t]) => `<li class="${c2}">${c2 === 'ok' ? '✓' : 'ALERTA:'} ${t}</li>`).join('')}</ul>`;
    pintarHud();
  }

  /* ---------- 4. Segmento de lanzamiento ---------- */
  function lanzamiento() {
    E.m = Sim.crearMision(E.cfg);
    E.verificados = new Set();
    mostrar(`
      <p class="etq">Fase 1 — Preparación y despegue</p>
      <h1>Segmento de lanzamiento</h1>
      ${instructor(`<p>Cadete, la configuración de tu nave ya ha sido seleccionada. Ahora debemos verificar que el vehículo y su carga cumplen los requisitos necesarios para iniciar la expedición.</p>
        <p><strong>CAPACIDAD DE CARGA:</strong> comprueba que la masa total de la nave no supere la capacidad máxima del vehículo de lanzamiento seleccionado.</p>
        <p><strong>COSTE DE LANZAMIENTO:</strong> verifica que los servicios de lanzamiento y puesta en órbita se encuentren dentro del presupuesto disponible.</p>`)}
      ${instructor('<p>Tu responsabilidad ahora es comprobar que todo está preparado para el despegue. Una misión segura comienza con una verificación rigurosa.</p>', 'Instructor — Consejo de vuelo')}
      <div class="panel"><h2>Lista de verificación — ${esc(E.cfg.nombre)}</h2>
        <div class="acciones">
          ${boton('verificar:capacidad', 'Verificar capacidad de carga', '')}
          ${boton('verificar:presupuesto', 'Comprobar presupuesto', '')}
          ${boton('verificar:servicios', 'Confirmar servicios de puesta en órbita', '')}
        </div>
        <ul class="datos" id="verificacion"></ul>
        <div class="acciones">${boton('autorizar', 'Autorizar lanzamiento', 'principal', 'disabled id="btnAutorizar"')}${boton('hangar', 'Volver al hangar', 'sec')}</div>
      </div>`);
  }
  function verificar(cual) {
    const d = E.m.d;
    const fila = {
      capacidad: ['Capacidad de carga', `${n(d.masaTotal)} t de ${d.lanzador.capacidad} t — ${d.capOk ? 'DENTRO DE LÍMITES' : 'SUPERADA'}`, d.capOk],
      presupuesto: ['Presupuesto', `${n(d.presupuestoPct, 0)} % utilizado — ${d.presOk ? 'DISPONIBLE' : 'EXCEDIDO'}`, d.presOk],
      servicios: [`Servicios ${d.lanzador.nombre}`, `Órbita terrestre baja · ${d.lanzador.coste} M — CONTRATADOS`, true],
    }[cual];
    if (E.verificados.has(cual)) return;
    E.verificados.add(cual);
    $('#verificacion').insertAdjacentHTML('beforeend', `<li><span>${fila[0]}</span><span class="${fila[2] ? 'v-ok' : 'v-mal'}">${fila[1]}</span></li>`);
    $(`[data-accion="verificar:${cual}"]`).disabled = true;
    if (E.verificados.size === 3) $('#btnAutorizar').disabled = false;
  }
  function autorizar() {
    if (!Sim.lanzamiento(E.m).ok) return resultadoB();
    mostrar(`
      ${control('<p>Vehículo de lanzamiento confirmado. Carga útil verificada. Trayectoria inicial calculada.</p><p>Todos los sistemas se encuentran dentro de los parámetros establecidos.</p><p>Cadete, tienes autorización para iniciar la secuencia de lanzamiento.</p>')}
      <div class="cuenta" id="cuenta">T-10</div>
      <div class="acciones centro">${boton('enOrbita', 'Saltar cuenta atrás', 'sec')}</div>`);
    let t = 10;
    E.timer = setInterval(() => {
      t -= 1;
      $('#cuenta').textContent = t > 0 ? `T-${t}` : '¡DESPEGUE!';
      if (t < 0) enOrbita();
    }, sinAnimacion ? 60 : 450);
  }
  function enOrbita() {
    const d = E.m.d;
    mostrar(`
      <p class="alerta-titulo ok">&lt; LANZAMIENTO EXITOSO &gt;</p>
      ${control('<p>Inserción orbital completada.</p><p>La nave ha alcanzado la órbita terrestre prevista. El vehículo de lanzamiento ha cumplido su función.</p><p>Cadete, hemos superado el primer segmento. Ahora comienza tu responsabilidad como operador de la nave.</p>', 'ok')}
      <div class="panel"><h2>Segmento espacial — configuración registrada</h2>
        ${instructor('<p>Una nave demasiado pesada puede no despegar. Una nave mal equipada puede no aterrizar. Y una nave sin instrumentos adecuados puede llegar a Marte sin cumplir su objetivo científico.</p>')}
        ${datos([
          ['Masa total', `${n(d.masaTotal)} t`],
          ['Presupuesto utilizado', `${n(d.presupuestoPct, 0)} %`],
          ['Capacidad de propelente', `${n(d.dv, 2)} km/s`],
          ['Integridad térmica', '100 %'],
          ['Soporte vital', `100 % (${d.nave.dias} días)`],
          ['Potencia eléctrica', `${n(d.potencia)} kW`],
          ['Instrumentos a bordo', d.instrumentos.length ? d.instrumentos.map((i) => i.nombre).join(', ') : 'Ninguno'],
        ])}
        ${control('<p>La misión está lista para iniciar la transferencia interplanetaria.</p>')}
        <div class="acciones centro">${boton('iniciarViaje', 'Iniciar viaje a Marte')}</div>
      </div>`);
  }

  /* ---------- 5. Viaje interplanetario ---------- */
  const EVENTOS = [
    {
      alerta: 'ALERTA DE TELEMETRÍA', titulo: 'Evento crítico 01 — Pérdida parcial de comunicaciones', quien: 'Estación terrestre — Comunicación',
      texto: '<p>Atención, Control de Misión. Estamos detectando una degradación en la señal de comunicación con la nave.</p><p>La recepción de telemetría es intermitente. Algunos paquetes de datos no están llegando correctamente.</p>',
      estado: () => [['Señal de comunicación', '42 %', 'v-mal'], ['Telemetría', 'Parcial', 'v-av'], ['Navegación', 'Sin anomalías confirmadas'], ['Estado de la nave', 'Operativo']],
      orden: 'Cadete, debemos recuperar la recepción de datos antes de perder visibilidad sobre los sistemas de la nave.',
      bien: 'Activar el sistema de comunicaciones de respaldo.',
      mal: 'Mantener la configuración actual y solicitar una nueva transmisión de telemetría.',
      resBien: ['Comunicación de respaldo establecida. La recepción de telemetría mejora progresivamente.', 'Buena decisión, cadete. Hemos recuperado visibilidad sobre la nave.'],
      resMal: ['La pérdida de datos continúa. El equipo terrestre no puede verificar adecuadamente el estado de los sistemas.', 'La supervisión de la misión está comprometida. Debemos recuperar la comunicación antes de continuar.'],
      coste: () => `Respaldo activado con retraso. Una deriva no detectada exige una corrección tardía: −${n(K.DV.tardia, 2)} km/s de delta-v.`,
    },
    {
      alerta: 'ALERTA DE RADIACIÓN', titulo: 'Evento crítico 02 — Tormenta solar', quien: 'Centro de Control de Misión',
      texto: '<p>Atención, cadete. Los instrumentos de monitoreo espacial han detectado un incremento de actividad solar.</p><p>La radiación puede afectar los componentes electrónicos y aumentar la exposición de la tripulación.</p>',
      estado: (m) => [['Actividad solar', 'Elevada', 'v-mal'], ['Exposición a radiación', 'En aumento', 'v-av'], ['Sistemas electrónicos', 'Operativos'], ['Potencia eléctrica', `${n(m.potencia)} kW`]],
      orden: 'Debemos proteger los sistemas sensibles y conservar la energía disponible.',
      bien: 'Activar el protocolo de protección contra radiación y priorizar los sistemas esenciales.',
      mal: 'Mantener todos los sistemas funcionando a máxima potencia.',
      resBien: ['Protocolo de protección activado. Los sistemas esenciales permanecen operativos y la tripulación dispone de protección adicional.', 'Excelente respuesta. La seguridad de la tripulación es prioritaria. Hemos reducido los riesgos operativos.'],
      resMal: ['El consumo eléctrico permanece elevado y los sistemas continúan expuestos a condiciones desfavorables.', 'La gestión energética y la protección de la tripulación son insuficientes. Reevalúa tus prioridades.'],
      coste: (r) => `Daños por radiación: −4 kW de potencia, −10 % de reservas de soporte vital${r.danado ? ` e instrumento inutilizado: ${r.danado.nombre}` : ''}.`,
    },
    {
      alerta: 'ALERTA DE NAVEGACIÓN', titulo: 'Evento crítico 03 — Desviación de trayectoria', quien: 'Centro de Control de Misión',
      texto: '<p>Cadete, hemos detectado una desviación respecto a la trayectoria interplanetaria prevista.</p><p>Los datos de navegación indican que la nave podría llegar a Marte fuera de los parámetros establecidos.</p>',
      estado: (m) => [['Desviación de trayectoria', 'Elevada', 'v-mal'], ['Propelente disponible', `${n(Sim.dvRestante(m), 2)} km/s`], ['Navegación', 'Operativa'], ['Tiempo estimado de llegada', `${K.DIAS_VIAJE - m.dia} días`]],
      orden: 'Debemos evaluar la trayectoria y determinar si es necesaria una corrección. Recuerda que cada maniobra consume propelente. No podemos desperdiciar nuestras reservas.',
      bien: 'Ejecutar una corrección de trayectoria utilizando el presupuesto de delta-v disponible.',
      mal: 'Mantener el rumbo actual y continuar monitoreando la desviación.',
      resBien: ['Maniobra de corrección completada. La nave recupera una trayectoria compatible con los parámetros de llegada previstos.', 'Excelente trabajo, cadete. Has corregido la desviación sin comprometer las reservas críticas de combustible.'],
      resMal: ['La desviación persiste y los parámetros de llegada continúan fuera de los márgenes previstos.', 'Una trayectoria incorrecta puede comprometer toda la fase de aproximación. La navegación requiere supervisión constante.'],
      coste: () => `La entrada será más brusca: +25 % de carga térmica y +${n(K.DV.retroExtra)} km/s de frenado en el descenso.`,
    },
  ];

  // Trayectoria Tierra → Marte (Bézier cuadrática) sobre un lienzo de 800×200.
  const P = [[70, 160], [400, -40], [730, 70]];
  const punto = (t) => [0, 1].map((k) => (1 - t) ** 2 * P[0][k] + 2 * (1 - t) * t * P[1][k] + t ** 2 * P[2][k]);
  function mapa() {
    const marcas = K.DIAS_EVENTO.map((d) => { const [x, y] = punto(d / K.DIAS_VIAJE); return `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#ffb547"/>`; }).join('');
    return `<div class="panel"><svg class="mapa" viewBox="0 0 800 200" role="img" aria-label="Trayectoria de la Tierra a Marte">
      <path d="M${P[0]} Q${P[1]} ${P[2]}" fill="none" stroke="#24365c" stroke-width="2" stroke-dasharray="6 6"/>${marcas}
      <circle cx="${P[0][0]}" cy="${P[0][1]}" r="16" fill="#3b82f6"/><text x="${P[0][0]}" y="195" fill="#8296b8" font-size="12" text-anchor="middle">TIERRA</text>
      <circle cx="${P[2][0]}" cy="${P[2][1]}" r="12" fill="#e2603a"/><text x="${P[2][0]}" y="105" fill="#8296b8" font-size="12" text-anchor="middle">MARTE</text>
      <circle id="nave" r="5" fill="#fff" stroke="#4fd8ff" stroke-width="2"/></svg>
      <p class="etq centro" id="diaTxt"></p></div><div id="bitacora"></div>`;
  }
  function situarNave(dia) {
    const [x, y] = punto(dia / K.DIAS_VIAJE);
    $('#nave').setAttribute('cx', x); $('#nave').setAttribute('cy', y);
    $('#diaTxt').textContent = `Día ${Math.round(dia)} de ${K.DIAS_VIAJE} · ${n((dia / K.DIAS_VIAJE) * 480, 0)} millones de km recorridos`;
  }
  const bitacora = (html) => { $('#bitacora').innerHTML = html; pintarHud(); };

  function iniciarViaje() {
    if (!Sim.tmi(E.m)) return resultadoC(['La nave agotó el propelente durante la inyección transmarciana']);
    E.evento = 0;
    mostrar(`<p class="etq">Fase 2 — El viaje interplanetario</p><h1>Segmento terrestre en acción</h1>${mapa()}`);
    situarNave(0);
    bitacora(`
      ${instructor(`<p>Cadete, la nave ha abandonado la órbita terrestre y se encuentra en trayectoria interplanetaria. La inyección ha consumido ${n(K.DV.tmi)} km/s de delta-v.</p>
        <p>Desde el Centro de Control de Misión, las estaciones terrestres reciben telemetría, verifican las comunicaciones y supervisan el comportamiento de la nave. Durante el viaje, pueden aparecer anomalías que exijan decisiones inmediatas.</p>
        <p>Recuerda: el Segmento Terrestre no controla físicamente la nave de forma continua. Analiza los datos recibidos, evalúa las condiciones y transmite instrucciones cuando es necesario.</p>
        <p>Tu capacidad para interpretar la información será puesta a prueba.</p>`)}
      <div class="acciones centro">${boton('avanzar', 'Continuar el viaje')}</div>`);
  }

  function avanzar() {
    const desde = E.m.dia;
    const hasta = E.evento < 3 ? K.DIAS_EVENTO[E.evento] : K.DIAS_VIAJE;
    bitacora('<p class="etq centro">Navegando… recibiendo telemetría</p>');
    animar(1600, (t) => { E.m.dia = desde + (hasta - desde) * t; situarNave(E.m.dia); pintarHud(); }, () => (E.evento < 3 ? plantearEvento() : finViaje()));
  }

  function plantearEvento() {
    const ev = EVENTOS[E.evento];
    // El orden de las opciones se baraja: hay que leer la telemetría, no memorizar la letra.
    const opciones = [['bien', ev.bien], ['mal', ev.mal]];
    if (Math.random() < 0.5) opciones.reverse();
    bitacora(`<div class="panel">
      <p class="alerta-titulo">&lt; ${ev.alerta} &gt;</p><h2>${ev.titulo}</h2>
      ${msg(ev.quien, ev.texto)}
      <p class="etq">Telemetría actual</p>${datos(ev.estado(E.m))}
      ${control(`<p>${ev.orden}</p>`)}
      <p class="etq">Decisión del cadete</p>
      ${opciones.map(([k, t], i) => `<button class="opcion" data-accion="decidir:${k}"><b>${'AB'[i]}.</b>${t}</button>`).join('')}
    </div>`);
  }

  function decidir(cual) {
    const ev = EVENTOS[E.evento];
    const correcta = cual === 'bien';
    const r = Sim.decidir(E.m, E.evento + 1, correcta);
    const [res, ctrl] = correcta ? ev.resBien : ev.resMal;
    E.evento += 1;
    bitacora(`<div class="panel">
      <h2>${ev.titulo}</h2>
      ${msg(correcta ? 'Resultado — decisión correcta' : 'Resultado — decisión incorrecta', `<p>${res}</p>${correcta ? '' : `<p><strong>${ev.coste(r)}</strong></p>`}`, correcta ? 'ok' : 'mal')}
      ${control(`<p>${ctrl}</p>`)}
      <div class="acciones centro">${boton('avanzar', 'Continuar el viaje')}</div>
    </div>`);
  }

  function finViaje() {
    const estado = Sim.llegada(E.m);
    pintarHud();
    if (!estado.ok) return resultadoC(estado.fallos);
    bitacora(`<div class="panel"><h2>Final del viaje interplanetario</h2>
      ${control('<p>Cadete, los datos de navegación confirman que la nave ha llegado a las proximidades de Marte.</p><p>Las comunicaciones se mantienen dentro de los parámetros operativos. La tripulación está preparada y los sistemas de descenso han iniciado su secuencia de comprobación.</p><p>Hemos recorrido millones de kilómetros. Ahora comienza la fase más delicada de la expedición.</p>')}
      <p class="lema centro">PREPARA LA MANIOBRA DE ENTRADA, DESCENSO Y ATERRIZAJE.</p>
      <div class="acciones centro">${boton('edl', 'Iniciar descenso')}</div></div>`);
  }

  /* ---------- 6. Entrada, descenso y aterrizaje ---------- */
  const PASOS = ['Entrada atmosférica', 'Reducción de velocidad', 'Retropropulsores', 'Aterrizaje'];
  function edl(paso = 0, html) {
    const cabecera = `<p class="etq">Fase 3 — Descenso en Marte</p><h1>Maniobra de aterrizaje (EDL)</h1>
      <p class="alerta-titulo">&lt; ALERTA: FASE DE DESCENSO INICIADA &gt;</p>
      <ol class="pasos">${PASOS.map((p, i) => `<li class="${i < paso ? 'hecho' : i === paso ? 'actual' : ''}">Paso 0${i + 1}<br>${p}</li>`).join('')}</ol>`;
    const cuerpo = html || [
      `${instructor('<p>Cadete, estamos entrando en la fase de mayor exigencia térmica y dinámica de la misión. El vehículo debe atravesar la atmósfera marciana, reducir su velocidad y alcanzar una zona de aterrizaje segura. Cada sistema debe responder correctamente.</p>', 'Instructor — Cabina')}
       <div class="panel"><h2>Paso 01 — Entrada atmosférica</h2><p>Verifica la integridad del escudo térmico. La nave está experimentando un calentamiento intenso debido a la interacción con la atmósfera.</p>
       ${instructor('<p>Confirma que la protección térmica se encuentra dentro de los parámetros de seguridad.</p>')}
       <div class="acciones centro">${boton('edlEntrada', 'Verificar escudo térmico')}</div></div>`,
      `<div class="panel"><h2>Paso 02 — Reducción de velocidad</h2>
       ${datos([['Integridad del escudo térmico', `${E.m.escudo} %`, E.m.escudo >= 15 ? 'v-ok' : 'v-av'], ['Temperatura máxima registrada', `${n(1350 + (100 - E.m.escudo) * 4, 0)} °C`]])}
       <p>Los sistemas de desaceleración deben reducir la velocidad del vehículo para preparar las siguientes fases del descenso.</p>
       ${instructor('<p>Supervisa la telemetría. La velocidad debe mantenerse dentro de los márgenes previstos.</p>')}
       <p class="centro grande" id="lectura">5,80 km/s</p>
       <div class="acciones centro">${boton('edlFrenado', 'Supervisar desaceleración')}</div></div>`,
      `<div class="panel"><h2>Paso 03 — Activación de retropropulsores</h2><p>Los sistemas de propulsión deben proporcionar el empuje necesario para completar la desaceleración y controlar el descenso final.</p>
       ${instructor('<p>Verifica la disponibilidad de propelente y confirma la activación de los sistemas de descenso.</p>')}
       ${datos([['Delta-v disponible', `${n(Sim.dvRestante(E.m), 2)} km/s`], ['Delta-v requerido', `${n(Sim.dvRetro(E.m), 2)} km/s`, Sim.dvRestante(E.m) >= Sim.dvRetro(E.m) ? 'v-ok' : 'v-mal']])}
       <div class="acciones centro">${boton('edlRetro', 'Activar retropropulsores')}</div></div>`,
      `<div class="panel"><h2>Paso 04 — Aterrizaje</h2><p>El vehículo se aproxima a la superficie marciana. Controla la velocidad vertical y confirma que todos los sistemas de aterrizaje responden correctamente.</p>
       ${instructor('<p>¡Atención, cadete! Estamos a pocos segundos de la superficie. Confirma los parámetros de descenso.</p>')}
       <ul class="datos"><li><span>Retropropulsores</span><span class="v-ok">ACTIVOS</span></li><li><span>Velocidad</span><span id="vel">75,0 m/s</span></li><li><span>Altitud</span><span id="alt">1.200 m</span></li>
       <li><span>Combustible disponible</span><span>${n(Sim.dvRestante(E.m), 2)} km/s</span></li></ul>
       <div class="acciones centro" id="zonaContacto">${boton('edlContacto', 'Confirmar parámetros de descenso')}</div></div>`,
    ][paso];
    mostrar(cabecera + cuerpo);
  }
  const edlEntrada = () => (Sim.entrada(E.m) ? edl(1) : resultadoD('NO ACTIVADOS'));
  function edlFrenado() {
    $('[data-accion="edlFrenado"]').disabled = true;
    animar(1500, (t) => { $('#lectura').textContent = `${n(5.8 - 5.4 * t, 2)} km/s`; }, () => edl(2));
  }
  const edlRetro = () => (Sim.retro(E.m) ? edl(3) : resultadoD('PROPELENTE AGOTADO'));
  function edlContacto() {
    $('[data-accion="edlContacto"]').disabled = true;
    animar(2400, (t) => {
      $('#alt').textContent = `${n(1200 * (1 - t) ** 2, 0)} m`;
      $('#vel').textContent = `${n(75 - 74.2 * t)} m/s`;
    }, () => {
      $('#zonaContacto').innerHTML = `<div>${control('<p>Contacto con la superficie confirmado.</p><p class="lema">¡ATERRIZAJE COMPLETADO!</p>', 'ok')}${boton('reporteFinal', 'Recibir datos científicos')}</div>`;
    });
  }

  /* ---------- 7. Segmento de usuario y reporte final ---------- */
  function reporteFinal() {
    const m = E.m; const d = m.d; const r = Sim.reporte(m);
    const veredicto = r.graduado
      ? `<p class="alerta-titulo ok">&lt; MISIÓN COMPLETADA &gt;</p>
        ${msg('Centro de Control de Misión — Tierra', `<p>Cadete, tenemos confirmación.</p><p>La nave ha aterrizado en Marte, los sistemas esenciales permanecen operativos y los instrumentos científicos han ${r.ciencia.objetivos >= 100 ? 'completado satisfactoriamente' : 'cumplido la parte esencial de'} sus objetivos.</p>
          <p>Has demostrado dominio de los cuatro segmentos de una misión espacial. El vehículo de lanzamiento fue seleccionado correctamente. La nave mantuvo su estabilidad durante el viaje. El equipo terrestre gestionó las anomalías y los instrumentos científicos proporcionaron información valiosa.</p>
          <p>Pero tu mayor logro no fue simplemente alcanzar Marte. Fue conseguirlo respetando los límites de masa, presupuesto y recursos disponibles.</p>`, 'ok')}
        ${instructor('<p>Durante esta simulación aprendiste que una misión espacial no depende de una sola decisión, sino de cientos de decisiones coordinadas.</p><p>Cada gramo cuenta. Cada kilovatio importa. Cada maniobra tiene consecuencias.</p><p>Hoy has demostrado que puedes pensar como un ingeniero, actuar como un operador de vuelo y evaluar una misión como un científico.</p><p><strong>¡FELICITACIONES, CADETE!</strong> Has completado el Programa de Simulación Orbital.</p>', 'Instructor Jefe')}
        <p class="centro"><span class="sello">GRADUACIÓN AUTORIZADA</span></p>
        <div class="acciones centro">${boton('cierre', 'Finalizar entrenamiento')}${boton('hangar', 'Mejorar la misión', 'sec')}</div>`
      : `<p class="alerta-titulo">&lt; OBJETIVO CIENTÍFICO NO CUMPLIDO &gt;</p>
        ${msg('Centro de Control de Misión — Tierra', '<p>Cadete, la nave ha aterrizado, pero los datos recibidos no bastan para cumplir los objetivos de investigación.</p>', 'mal')}
        ${instructor('<p>El éxito no se mide únicamente por llegar al destino. Una nave sin instrumentos adecuados puede llegar a Marte sin cumplir su objetivo científico.</p><p><strong>LECCIÓN APRENDIDA:</strong> reserva masa, potencia y presupuesto para la carga científica, y protégela durante el viaje.</p>')}
        <p class="centro"><span class="sello mal">GRADUACIÓN PENDIENTE</span></p>
        <div class="acciones centro">${boton('hangar', 'Reintentar misión')}</div>`;
    mostrar(`
      <p class="etq">Fase 3 — Segmento de usuario</p><h1>Análisis de datos y evaluación científica</h1>
      ${msg('Centro de Control de Misión — Tierra', '<p>La nave ha alcanzado Marte. Los instrumentos científicos han comenzado a transmitir los primeros datos de la expedición.</p><p>Ahora, los científicos e investigadores en Tierra analizarán los resultados para determinar si se cumplieron los objetivos de la misión. El éxito no se mide únicamente por llegar al destino: también debemos evaluar la cantidad, calidad y utilidad de la información obtenida.</p>')}
      <div class="panel"><h2>Reporte final de misión</h2>
        ${datos([['Nombre de misión', esc(m.cfg.nombre)], ['Destino', 'Marte'], ['Estado', r.graduado ? 'COMPLETADA' : 'ATERRIZAJE SIN OBJETIVO CIENTÍFICO', r.graduado ? 'v-ok' : 'v-av']])}
        <h3>Resumen de telemetría</h3>
        ${datos([
          ['Masa total', `${n(d.masaTotal)} t`], ['Delta-v utilizado', `${n(m.dvUsado, 2)} km/s`],
          ['Propelente restante', `${n(Sim.combustiblePct(m))} %`], ['Integridad del escudo térmico', `${m.escudo} %`],
          ['Reservas de soporte vital', `${n(Sim.oxigeno(m), 0)} %`], ['Potencia eléctrica', `${n(m.potencia)} kW`],
          ['Instrumentos científicos operativos', `${r.ciencia.activos.length} de ${d.instrumentos.length}${r.ciencia.activos.length ? ` — ${r.ciencia.activos.map((i) => i.nombre).join(', ')}` : ''}`],
        ])}
        <h3>Evaluación de los cuatro segmentos</h3>
        ${datos([['Segmento de lanzamiento', r.evalLanzamiento], ['Segmento espacial', r.evalEspacial], ['Segmento terrestre', r.evalTerrestre], ['Segmento de usuario', r.evalUsuario]])}
        <h3>Eficiencia de la misión</h3>
        ${datos([
          ['Presupuesto utilizado', `${n(d.presupuestoPct, 0)} %`], ['Masa transportada', `${n(d.masaTotal)} t`],
          ['Objetivos científicos completados', `${r.ciencia.objetivos} %`], ['Eficiencia de recursos', `${r.eficiencia} %`],
          ['Calificación final', `${r.calificacion} (${r.nota}/100)`, r.nota >= 70 ? 'v-ok' : r.nota >= 50 ? 'v-av' : 'v-mal'],
        ])}
      </div>${veredicto}`);
  }

  /* ---------- 8. Resultados de fallo ---------- */
  function fallo(titulo, intro, informe, leccionInstructor, leccion) {
    mostrar(`
      <p class="alerta-titulo">&lt; MISIÓN INTERRUMPIDA &gt;</p><h1>${titulo}</h1>
      ${msg('Centro de Control de Misión', intro, 'mal')}
      <div class="panel"><h2>Informe de fallo</h2>${datos(informe)}</div>
      ${instructor(leccionInstructor)}
      <div class="panel"><h3>Lección aprendida</h3><p>${leccion}</p></div>
      <div class="acciones centro">${boton('hangar', 'Reintentar misión')}</div>`);
  }
  function resultadoB() {
    const d = E.m.d;
    fallo('Fallo técnico: limitaciones del lanzamiento',
      `<p>Cadete, la expedición no pudo superar la fase de lanzamiento.</p><p>El análisis de telemetría indica que ${d.capOk ? 'la planificación presupuestaria no cubría los servicios de la misión' : 'el vehículo seleccionado no cumplía los requisitos de capacidad de carga de la misión'}.</p>`,
      [['Segmento afectado', 'Lanzamiento'], ['Causa', d.capOk ? 'Planificación presupuestaria inadecuada' : 'Capacidad de carga insuficiente'],
        ['Masa total', `${n(d.masaTotal)} t`, d.capOk ? '' : 'v-mal'], ['Capacidad del lanzador', `${d.lanzador.capacidad} t`],
        ['Presupuesto', `${n(d.coste, 0)} M de ${K.PRESUPUESTO} M disponibles`, d.presOk ? '' : 'v-mal']],
      '<p>El error comenzó durante la planificación.</p><p>Un vehículo de lanzamiento debe seleccionarse considerando la masa total de la carga y los requisitos orbitales. Una misión no puede comenzar correctamente si sus capacidades no han sido verificadas.</p>',
      'Comprueba la capacidad del lanzador y optimiza la masa antes de autorizar el despegue.');
  }
  function resultadoC(fallos) {
    const m = E.m;
    fallo('Fallo técnico: pérdida de capacidad operativa',
      '<p>Cadete, la nave no consiguió completar el viaje interplanetario.</p><p>El análisis de telemetría revela que uno o varios sistemas críticos quedaron fuera de sus parámetros operativos.</p>',
      [['Segmento afectado', 'Espacial'], ['Causa', 'Gestión inadecuada de los recursos de la nave'],
        ['Propelente restante', `${n(Sim.combustiblePct(m))} %`], ['Reservas de oxígeno', `${n(Sim.oxigeno(m), 0)} %`],
        ['Potencia eléctrica', `${n(m.potencia)} kW (mínimo ${K.POT_ESENCIAL} kW)`], ['Integridad de sistemas', fallos.join(' · ').toUpperCase(), 'v-mal']],
      '<p>Durante un viaje interplanetario, cada recurso debe calcularse para toda la duración prevista.</p><p>Una nave puede tener una trayectoria correcta y aun así fracasar si no dispone de energía, propelente o soporte vital suficiente.</p>',
      'Equilibra la masa, el consumo energético y las reservas de soporte vital. Conserva siempre márgenes para situaciones imprevistas.');
  }
  function resultadoD(propulsores) {
    const m = E.m;
    fallo('Fallo técnico: descenso no completado',
      '<p>Cadete, hemos perdido la confirmación de un aterrizaje seguro.</p><p>Los últimos datos recibidos indican que el vehículo de descenso no pudo completar correctamente la secuencia de entrada, descenso y aterrizaje.</p>',
      [['Segmento afectado', 'Espacial'], ['Causa', m.escudo <= 0 ? 'Protección térmica insuficiente' : 'Reservas de propelente inadecuadas'],
        ['Integridad del escudo térmico', `${m.escudo} %`, m.escudo <= 0 ? 'v-mal' : ''], ['Propelente disponible', `${n(Sim.combustiblePct(m))} %`],
        ['Estado de retropropulsores', propulsores], ['Estado de aterrizaje', 'NO CONFIRMADO', 'v-mal']],
      '<p>La llegada a Marte exige una planificación completa de la fase de descenso.</p><p>No basta con alcanzar el planeta. La nave debe estar preparada para atravesar su atmósfera y completar el aterrizaje dentro de los parámetros establecidos.</p>',
      'Verifica la integridad del escudo térmico, la capacidad de propulsión y las reservas necesarias antes de iniciar el descenso.');
  }

  /* ---------- 9. Cierre ---------- */
  function cierre() {
    mostrar(`<div class="panel centro">
      <p class="etq">Instructor Jefe — Control de Misión</p><h1>Mensaje final del instructor</h1>
      <p>Cadete, tu entrenamiento ha concluido.</p>
      <p>Ahora comprendes que explorar el espacio es mucho más que construir una nave y elegir un destino.</p>
      <p>Es aprender a trabajar con recursos limitados, interpretar datos, resolver problemas y tomar decisiones bajo presión.</p>
      <p>Desde el lanzamiento hasta el análisis científico, cada segmento cumple una función indispensable.</p>
      <p>Marte es solo el comienzo.</p>
      <p>El universo sigue esperando a quienes se atrevan a explorarlo.</p>
      <p class="lema">FIN DEL ENTRENAMIENTO.</p>
      <div class="acciones centro">${boton('reiniciar', 'Volver al inicio')}</div></div>`, false);
  }

  /* ---------- acciones y arranque ---------- */
  const ACCIONES = {
    manual, hangar, confirmarDiseno: lanzamiento, verificar, autorizar, enOrbita, iniciarViaje, avanzar, decidir,
    edl: () => edl(0), edlEntrada, edlFrenado, edlRetro, edlContacto, reporteFinal, cierre,
    reiniciar: () => { E.cfg = Sim.configPorDefecto(); inicio(); },
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    const [accion, arg] = b.dataset.accion.split(':');
    ACCIONES[accion](arg);
  });

  function estrellas() {
    const c = $('#estrellas');
    const g = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    for (let i = 0; i < (c.width * c.height) / 5000; i += 1) {
      g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.6})`;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, Math.random() < 0.9 ? 1 : 2, 1);
    }
  }
  addEventListener('resize', estrellas);
  estrellas();
  inicio();
})();
