/* Programa de Simulación Orbital — modelo de misión (sin DOM, usable en navegador y Node). */
(function (root) {
  'use strict';

  const K = {
    VE: 4.4,              // velocidad de escape de gases (km/s)
    PRESUPUESTO: 900,     // millones de créditos
    DIAS_VIAJE: 210,      // ~7 meses
    DIAS_EVENTO: [45, 110, 165],
    POT_ESENCIAL: 7,      // kW mínimos: navegación, comunicaciones, control térmico, soporte vital
    O2_MIN: 10,           // % mínimo operativo a la llegada
    COSTE_PROP: 0.5,      // M por tonelada de propelente
    CIENCIA_OBJ: 80,      // puntos de ciencia para el 100 % de objetivos
    DV: { tmi: 3.6, corr: 0.3, tardia: 0.15, retro: 0.7, retroExtra: 0.5 },
  };
  K.DV_NOMINAL = K.DV.tmi + K.DV.corr + K.DV.retro;

  const DATA = {
    lanzadores: [
      { id: 'ligero', nombre: 'Halcón-L', desc: 'Lanzador ligero. Económico, pero con poca capacidad.', capacidad: 70, coste: 150 },
      { id: 'medio', nombre: 'Titán-M', desc: 'Lanzador medio. Equilibrio entre capacidad y coste.', capacidad: 110, coste: 260 },
      { id: 'pesado', nombre: 'Coloso-H', desc: 'Lanzador superpesado. Gran capacidad, gran factura.', capacidad: 150, coste: 400 },
    ],
    naves: [
      { id: 'pionera', nombre: 'Pionera', desc: 'Nave compacta. Ligera, con reservas muy justas.', masa: 12, potencia: 10, dias: 250, coste: 150 },
      { id: 'odisea', nombre: 'Odisea', desc: 'Arquitectura equilibrada para tripulación y sistemas.', masa: 17, potencia: 16, dias: 290, coste: 230 },
      { id: 'arca', nombre: 'Arca', desc: 'Nave de larga duración. Amplios márgenes, mucha masa.', masa: 24, potencia: 24, dias: 360, coste: 330 },
    ],
    landers: [
      { id: 'colibri', nombre: 'Colibrí', desc: 'Lander ligero.', masa: 5, plazas: 2, coste: 80 },
      { id: 'aguila', nombre: 'Águila', desc: 'Lander estándar.', masa: 8, plazas: 4, coste: 130 },
      { id: 'condor', nombre: 'Cóndor', desc: 'Lander pesado.', masa: 12, plazas: 6, coste: 190 },
    ],
    escudos: [
      { id: 'basico', nombre: 'Básico', desc: 'Solo apto para vehículos ligeros.', masa: 2, resistencia: 70, coste: 40 },
      { id: 'reforzado', nombre: 'Reforzado', desc: 'Protección estándar de entrada.', masa: 4, resistencia: 100, coste: 80 },
      { id: 'ablativo', nombre: 'Ablativo avanzado', desc: 'Máxima protección térmica.', masa: 6, resistencia: 130, coste: 130 },
    ],
    instrumentos: [
      { id: 'espectrometro', nombre: 'Espectrómetro de suelo', masa: 0.6, potencia: 1.5, coste: 40, ciencia: 25 },
      { id: 'taladro', nombre: 'Taladro de subsuelo', masa: 1.2, potencia: 3, coste: 70, ciencia: 30 },
      { id: 'radar', nombre: 'Radar de penetración', masa: 0.8, potencia: 2.5, coste: 55, ciencia: 25 },
      { id: 'meteo', nombre: 'Estación meteorológica', masa: 0.3, potencia: 0.5, coste: 20, ciencia: 15 },
      { id: 'sismometro', nombre: 'Sismómetro', masa: 0.4, potencia: 0.8, coste: 30, ciencia: 15 },
      { id: 'camara', nombre: 'Cámara panorámica', masa: 0.3, potencia: 1, coste: 25, ciencia: 15 },
    ],
  };

  const pieza = (lista, id) => DATA[lista].find((x) => x.id === id);
  const dvCap = (seca, prop) => (prop <= 0 ? 0 : K.VE * Math.log((seca + prop) / seca));

  function configPorDefecto() {
    return { nombre: 'Ares I', lanzador: 'medio', nave: 'odisea', lander: 'aguila', escudo: 'reforzado', instrumentos: [], propelente: 50 };
  }

  /** Resumen estático del diseño: masas, costes, potencia y alertas de planificación. */
  function evaluar(cfg) {
    const lanzador = pieza('lanzadores', cfg.lanzador);
    const nave = pieza('naves', cfg.nave);
    const lander = pieza('landers', cfg.lander);
    const escudo = pieza('escudos', cfg.escudo);
    const instrumentos = cfg.instrumentos.map((id) => pieza('instrumentos', id));
    const suma = (k) => instrumentos.reduce((s, i) => s + i[k], 0);

    const masaSeca = nave.masa + lander.masa + escudo.masa + suma('masa');
    const masaTotal = masaSeca + cfg.propelente;
    const coste = lanzador.coste + nave.coste + lander.coste + escudo.coste + suma('coste') + cfg.propelente * K.COSTE_PROP;
    const d = {
      lanzador, nave, lander, escudo, instrumentos,
      masaSeca, masaTotal, coste,
      presupuestoPct: (coste / K.PRESUPUESTO) * 100,
      dv: dvCap(masaSeca, cfg.propelente),
      potencia: nave.potencia,
      demanda: K.POT_ESENCIAL + suma('potencia'),
      capOk: masaTotal <= lanzador.capacidad,
      presOk: coste <= K.PRESUPUESTO,
    };
    return d;
  }

  function crearMision(cfg) {
    const d = evaluar(cfg);
    return {
      cfg, d,
      seca: d.masaSeca, prop: cfg.propelente, propInicial: cfg.propelente,
      potencia: d.potencia, o2Penal: 0, dia: 0, escudo: 100,
      empinada: false, danados: [], decisiones: [], dvUsado: 0, aterrizado: false,
    };
  }

  /** Gasta delta-v según la ecuación del cohete. Devuelve true si la maniobra se completó. */
  function quemar(m, dv) {
    const cap = dvCap(m.seca, m.prop);
    const real = Math.min(dv, cap);
    m.prop = real >= cap ? 0 : (m.seca + m.prop) * Math.exp(-real / K.VE) - m.seca;
    m.dvUsado += real;
    return real >= dv - 1e-9;
  }

  const dvRestante = (m) => dvCap(m.seca, m.prop);
  const masaActual = (m) => m.seca + m.prop;
  const combustiblePct = (m) => (m.propInicial > 0 ? (m.prop / m.propInicial) * 100 : 0);
  const oxigeno = (m) => Math.max(0, (100 * (m.d.nave.dias - m.dia)) / m.d.nave.dias - m.o2Penal);

  const lanzamiento = (m) => ({ ok: m.d.capOk && m.d.presOk, capOk: m.d.capOk, presOk: m.d.presOk });
  const tmi = (m) => quemar(m, K.DV.tmi);

  /** Aplica la decisión del cadete en el evento n (1..3). */
  function decidir(m, n, correcta) {
    m.dia = K.DIAS_EVENTO[n - 1];
    m.decisiones[n - 1] = correcta;
    const r = { correcta, danado: null };
    if (n === 1 && !correcta) quemar(m, K.DV.tardia); // deriva no detectada: corrección tardía
    if (n === 2 && !correcta) {
      m.potencia -= 4;
      m.o2Penal += 10;
      const victima = m.d.instrumentos.slice().sort((a, b) => b.potencia - a.potencia)[0];
      if (victima) { m.danados.push(victima.id); r.danado = victima; }
    }
    if (n === 3) {
      if (!correcta || !quemar(m, K.DV.corr)) m.empinada = true;
    }
    return r;
  }

  /** Comprobación de sistemas al llegar a las proximidades de Marte. */
  function llegada(m) {
    m.dia = K.DIAS_VIAJE;
    const fallos = [];
    if (m.prop <= 0) fallos.push('Propelente agotado');
    if (oxigeno(m) < K.O2_MIN) fallos.push('Soporte vital bajo mínimos');
    if (m.potencia < K.POT_ESENCIAL) fallos.push('Potencia insuficiente para sistemas esenciales');
    return { ok: fallos.length === 0, fallos };
  }

  /** Entrada atmosférica: la carga térmica crece con la masa y con una trayectoria desviada. */
  function entrada(m) {
    const carga = (45 + 0.8 * masaActual(m)) * (m.empinada ? 1.25 : 1);
    m.escudo = Math.max(0, Math.round(100 * (1 - carga / m.d.escudo.resistencia)));
    return m.escudo > 0;
  }

  const dvRetro = (m) => K.DV.retro + (m.empinada ? K.DV.retroExtra : 0);
  function retro(m) {
    const ok = quemar(m, dvRetro(m));
    m.aterrizado = ok;
    return ok;
  }

  /** Reparte la potencia sobrante entre los instrumentos no dañados (mejor ciencia por kW primero). */
  function ciencia(m) {
    let libre = m.potencia - K.POT_ESENCIAL;
    const activos = [];
    m.d.instrumentos
      .filter((i) => !m.danados.includes(i.id))
      .sort((a, b) => b.ciencia / b.potencia - a.ciencia / a.potencia)
      .forEach((i) => { if (i.potencia <= libre + 1e-9) { libre -= i.potencia; activos.push(i); } });
    const puntos = activos.reduce((s, i) => s + i.ciencia, 0);
    return { activos, puntos, objetivos: Math.min(100, Math.round((puntos / K.CIENCIA_OBJ) * 100)) };
  }

  function reporte(m) {
    const c = ciencia(m);
    const aciertos = m.decisiones.filter(Boolean).length;
    const margenes = [combustiblePct(m) >= 3, m.escudo >= 15, oxigeno(m) >= 15, m.potencia >= m.d.demanda];
    const sanos = margenes.filter(Boolean).length;
    const uso = m.d.masaTotal / m.d.lanzador.capacidad;
    const eficiencia = Math.round(50 * (sanos / 4) + 50 * Math.min(1, c.objetivos / m.d.presupuestoPct));
    const nota = Math.round(0.35 * c.objetivos + 0.25 * (aciertos / 3) * 100 + 0.25 * eficiencia + 15);
    return {
      ciencia: c, aciertos, sanos, eficiencia, nota,
      graduado: c.objetivos >= 50,
      calificacion: nota >= 85 ? 'SOBRESALIENTE' : nota >= 70 ? 'NOTABLE' : nota >= 50 ? 'APROBADO' : 'INSUFICIENTE',
      evalLanzamiento: uso > 0.95 ? 'CUMPLIDO — margen de masa muy ajustado' : uso < 0.6 ? 'CUMPLIDO — lanzador sobredimensionado' : 'CUMPLIDO',
      evalEspacial: sanos === 4 ? 'ÓPTIMO — todos los márgenes conservados' : sanos >= 2 ? 'CUMPLIDO — con reservas bajas' : 'CRÍTICO — aterrizaje al límite',
      evalTerrestre: `${['DEFICIENTE', 'DEFICIENTE', 'ADECUADA', 'EXCELENTE'][aciertos]} — ${aciertos}/3 anomalías bien resueltas`,
      evalUsuario: c.objetivos >= 100 ? 'OBJETIVOS COMPLETADOS' : c.objetivos >= 50 ? 'OBJETIVOS PARCIALES' : 'DATOS INSUFICIENTES',
    };
  }

  /**
   * Ejecuta la misión completa. Resultado: 'A' graduación, 'B' fallo de lanzamiento,
   * 'C' pérdida de capacidad operativa, 'D' descenso no completado, 'E' aterrizaje sin ciencia suficiente.
   */
  function simular(cfg, decisiones = [true, true, true]) {
    const m = crearMision(cfg);
    const fin = (resultado) => ({ resultado, m, o2Llegada: oxigeno(m) });
    if (!lanzamiento(m).ok) return fin('B');
    if (!tmi(m)) return fin('C');
    decisiones.forEach((ok, i) => decidir(m, i + 1, ok));
    if (!llegada(m).ok) return fin('C');
    if (!entrada(m) || !retro(m)) return fin('D');
    return fin(reporte(m).graduado ? 'A' : 'E');
  }

  const Sim = {
    K, DATA, configPorDefecto, evaluar, crearMision, simular, lanzamiento, tmi, decidir, llegada,
    entrada, retro, dvRetro, ciencia, reporte, dvRestante, masaActual, combustiblePct, oxigeno,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(typeof globalThis !== 'undefined' ? globalThis : this);
