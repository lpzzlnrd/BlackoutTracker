// Contrato de valores: lo que viaja por la red y lo que se guarda en la base de datos
// (docs/PLAN.md §4 y §5). Si uno de estos tests falla porque cambió un valor, no basta con
// actualizar el test: hace falta una migración de la base o una versión nueva de la API.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  CodigoError,
  ESTADOS_SERVICIO,
  ESTADO_HTTP_DE_CODIGO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  EstadoServicio,
  ORIGENES_EVENTO,
  OrigenEvento,
  TIPOS_SERVICIO,
  TipoServicio,
  ZONA_HORARIA,
} from '../dist/index.js';

test('los enums tienen los valores y el orden de los enums de Postgres', () => {
  // El orden importa: el bloqueo por sector usa la posición del servicio en el enum (PLAN §6.3).
  assert.deepEqual(TIPOS_SERVICIO, ['agua', 'electricidad']);
  assert.deepEqual(ESTADOS_SERVICIO, ['con_servicio', 'sin_servicio']);
  assert.deepEqual(ORIGENES_EVENTO, ['consenso', 'campo']);
});

test('cada objeto de enum coincide con su tupla (la tupla se escribe a mano)', () => {
  assert.deepEqual(Object.values(TipoServicio), [...TIPOS_SERVICIO]);
  assert.deepEqual(Object.values(EstadoServicio), [...ESTADOS_SERVICIO]);
  assert.deepEqual(Object.values(OrigenEvento), [...ORIGENES_EVENTO]);
});

test('los códigos de error son únicos y van en MAYÚSCULAS_CON_GUION_BAJO', () => {
  const codigos = Object.values(CodigoError);
  assert.equal(new Set(codigos).size, codigos.length);
  for (const codigo of codigos) {
    assert.match(codigo, /^[A-Z]+(_[A-Z]+)*$/);
  }
});

test('cada código de error tiene un estado HTTP de error, y no sobra ninguno', () => {
  assert.deepEqual(Object.keys(ESTADO_HTTP_DE_CODIGO).sort(), Object.values(CodigoError).sort());
  for (const [codigo, estado] of Object.entries(ESTADO_HTTP_DE_CODIGO)) {
    assert.ok(Number.isInteger(estado) && estado >= 400 && estado <= 599, `${codigo}: ${estado}`);
  }
});

test('los códigos que fija el plan responden con el estado del plan', () => {
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.PinFueraDeGuaparo], 422); // PLAN §5, validar-pin
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.RegistroIncompleto], 403); // D-014
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.ResidenteYaRegistrado], 409); // POST /residentes/me
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.ReporteAbiertoDuplicado], 409); // REP-05
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.ReporteConflicto], 409); // OFF-05
  assert.equal(ESTADO_HTTP_DE_CODIGO[CodigoError.HoraInvalida], 422); // REP-07, D-013
});

test('los valores por defecto son los de CLAUDE.md y DECISIONES.md', () => {
  assert.equal(CONSENSO_N_POR_DEFECTO, 3); // D-006
  assert.equal(ESTIMACION_N_MIN_POR_DEFECTO, 5); // D-006
  assert.deepEqual(CONSENSO_VENTANA_MIN_POR_DEFECTO, { agua: 180, electricidad: 30 }); // D-004
});

test('hay una ventana de consenso por cada servicio, ni más ni menos', () => {
  assert.deepEqual(Object.keys(CONSENSO_VENTANA_MIN_POR_DEFECTO), [...TIPOS_SERVICIO]);
});

test('ZONA_HORARIA es una zona IANA válida y en 2026 está en UTC−4', () => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date('2026-10-07T19:06:00Z'));
  assert.equal(partes.find((parte) => parte.type === 'timeZoneName')?.value, 'GMT-04:00');
});
