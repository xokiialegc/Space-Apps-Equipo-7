const test = require('node:test');
const assert = require('node:assert');
const Sim = require('../js/sim.js');

const equilibrada = {
  nombre: 'Test', lanzador: 'medio', nave: 'odisea', lander: 'aguila', escudo: 'reforzado',
  instrumentos: ['espectrometro', 'taladro', 'meteo', 'sismometro'], propelente: 65,
};
const con = (cambios) => ({ ...equilibrada, ...cambios });

test('una misión equilibrada con buenas decisiones se gradúa (A)', () => {
  const r = Sim.simular(equilibrada);
  assert.equal(r.resultado, 'A');
  assert.ok(r.m.d.presOk && r.m.d.capOk);
  assert.equal(Sim.reporte(r.m).ciencia.objetivos, 100);
});

test('superar la capacidad del lanzador o el presupuesto impide despegar (B)', () => {
  assert.equal(Sim.simular(con({ lanzador: 'ligero' })).resultado, 'B');
  assert.equal(Sim.simular(con({ lanzador: 'pesado', nave: 'arca', lander: 'condor' })).resultado, 'B');
});

test('sin propelente para la transferencia la nave no completa el viaje (C)', () => {
  assert.equal(Sim.simular(con({ propelente: 30 })).resultado, 'C');
});

test('nave sin márgenes + tormenta solar mal gestionada pierde capacidad operativa (C)', () => {
  const cfg = con({ nave: 'pionera', lander: 'colibri', instrumentos: ['espectrometro', 'meteo'], propelente: 50 });
  assert.equal(Sim.simular(cfg).resultado, 'A');
  assert.equal(Sim.simular(cfg, [true, false, true]).resultado, 'C');
});

test('escudo insuficiente o falta de propelente en el descenso (D)', () => {
  assert.equal(Sim.simular(con({ escudo: 'basico' })).resultado, 'D');
  assert.equal(Sim.simular(con({ propelente: 58 })).resultado, 'D');
});

test('no corregir la trayectoria endurece la entrada y el frenado', () => {
  const ok = Sim.simular(equilibrada);
  const mal = Sim.simular(con({ propelente: 68 }), [true, true, false]);
  assert.ok(mal.m.empinada);
  assert.ok(mal.m.escudo < ok.m.escudo);
});

test('aterrizar sin instrumentos no cumple el objetivo científico (E)', () => {
  assert.equal(Sim.simular(con({ instrumentos: [] })).resultado, 'E');
});

test('la tormenta solar mal gestionada daña un instrumento y reduce la ciencia', () => {
  const r = Sim.simular(con({ propelente: 65 }), [true, false, true]);
  assert.equal(r.m.danados[0], 'taladro');
  assert.ok(Sim.reporte(r.m).ciencia.objetivos < 100);
});
