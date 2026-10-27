// Contrato de la cola offline (docs/PLAN.md §5, OFF-04 y OFF-05): qué hace el cliente con cada
// respuesta. Si cambia la tabla, cambia también lo que hace el frontend con su cola.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AccionCola,
  CodigoError,
  ESTADO_HTTP_DE_CODIGO,
  accionDeRespuesta,
} from '../dist/index.js';

test('2xx es éxito: el envío sale de la cola', () => {
  for (const estado of [200, 201, 204]) {
    assert.equal(accionDeRespuesta(estado, 'inicio'), AccionCola.Exito);
    assert.equal(accionDeRespuesta(estado, 'cierre'), AccionCola.Exito);
  }
});

test('OFF-05: sin respuesta (red caída o corte a mitad del envío) se reintenta', () => {
  assert.equal(accionDeRespuesta(null, 'inicio'), AccionCola.Reintentar);
  assert.equal(accionDeRespuesta(null, 'cierre'), AccionCola.Reintentar);
});

test('5xx y 429 se reintentan', () => {
  for (const estado of [429, 500, 502, 503, 504]) {
    assert.equal(accionDeRespuesta(estado, 'inicio'), AccionCola.Reintentar, `${estado}`);
    assert.equal(accionDeRespuesta(estado, 'cierre'), AccionCola.Reintentar, `${estado}`);
  }
});

test('OFF-04: un 404 en un cierre se reintenta (el inicio aún no llega); en un inicio no', () => {
  assert.equal(accionDeRespuesta(404, 'cierre'), AccionCola.Reintentar);
  assert.equal(accionDeRespuesta(404, 'inicio'), AccionCola.ErrorPermanente);
});

test('400, 409 y 422 son errores permanentes: reintentar no los arregla', () => {
  for (const estado of [400, 409, 422]) {
    assert.equal(accionDeRespuesta(estado, 'inicio'), AccionCola.ErrorPermanente, `${estado}`);
    assert.equal(accionDeRespuesta(estado, 'cierre'), AccionCola.ErrorPermanente, `${estado}`);
  }
});

test('401 refresca la sesión; 403 (registro incompleto) es permanente', () => {
  assert.equal(accionDeRespuesta(401, 'inicio'), AccionCola.RefrescarSesion);
  assert.equal(accionDeRespuesta(401, 'cierre'), AccionCola.RefrescarSesion);
  assert.equal(accionDeRespuesta(403, 'inicio'), AccionCola.ErrorPermanente);
});

test('cada código de error de la API cae en la acción que fija el plan (el 404 de un cierre, arriba)', () => {
  const esperada = {
    [CodigoError.NoAutenticado]: AccionCola.RefrescarSesion,
    [CodigoError.DemasiadasSolicitudes]: AccionCola.Reintentar,
    [CodigoError.ErrorInterno]: AccionCola.Reintentar,
  };
  for (const [codigo, estado] of Object.entries(ESTADO_HTTP_DE_CODIGO)) {
    assert.equal(
      accionDeRespuesta(estado, 'inicio'),
      esperada[codigo] ?? AccionCola.ErrorPermanente,
      codigo,
    );
  }
});
