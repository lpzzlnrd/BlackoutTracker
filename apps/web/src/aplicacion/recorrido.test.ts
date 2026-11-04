import { describe, expect, it } from 'vitest';
import {
  avanzarRecorrido,
  CLAVE_RECORRIDO,
  conContexto,
  crearRecorrido,
  iniciarRecorrido,
  leerRecorrido,
  progresoRecorrido,
  retrocederRecorrido,
  siguientePasoRecorrido,
  type EstadoRecorrido,
} from './recorrido';

const VISITANTE = { hayUsuario: false, tienePerfil: false };
const SIN_VIVIENDA = { hayUsuario: true, tienePerfil: false };
const VECINO = { hayUsuario: true, tienePerfil: true };

const en = (paso: Exclude<EstadoRecorrido['paso'], 'fin'>, indicacion = 0, logro = false) =>
  ({ paso, indicacion, logro }) as EstadoRecorrido;

const memoria = () => {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
  };
};

describe('iniciarRecorrido', () => {
  it('D-043: sin cuenta empieza por crearla', () => {
    expect(iniciarRecorrido(VISITANTE)).toEqual(en('cuenta'));
  });

  it('D-043: salta lo que el vecino ya hizo', () => {
    expect(iniciarRecorrido(SIN_VIVIENDA)).toEqual(en('vivienda'));
    expect(iniciarRecorrido(VECINO)).toEqual(en('mapa'));
  });
});

describe('avanzarRecorrido', () => {
  const tres = { indicaciones: 3, conLogro: true };

  it('D-043: pasa de una indicación a la siguiente y termina en el logro', () => {
    let estado = avanzarRecorrido(en('cuenta'), tres, VISITANTE);
    expect(estado).toEqual(en('cuenta', 1));
    estado = avanzarRecorrido(en('cuenta', 2), tres, VISITANTE);
    expect(estado).toEqual(en('cuenta', 2, true));
  });

  it('D-043: un paso sin logro pasa directo al siguiente', () => {
    const estado = avanzarRecorrido(en('consenso'), { indicaciones: 1, conLogro: false }, VECINO);
    expect(estado).toEqual(en('estimacion'));
  });

  it('D-043: el último paso lleva al final', () => {
    const estado = avanzarRecorrido(
      en('sin-conexion'),
      { indicaciones: 1, conLogro: false },
      VECINO,
    );
    expect(estado).toEqual({ paso: 'fin' });
  });

  it('D-043: retroceder vuelve a la indicación anterior, nunca antes de la primera', () => {
    expect(retrocederRecorrido(en('cuenta', 1))).toEqual(en('cuenta'));
    expect(retrocederRecorrido(en('cuenta'))).toEqual(en('cuenta'));
  });
});

describe('siguientePasoRecorrido', () => {
  it('D-043: tras crear la cuenta enseña cómo entrar, aunque ya haya sesión', () => {
    expect(siguientePasoRecorrido(en('cuenta', 2, true), SIN_VIVIENDA)).toEqual(en('entrar'));
  });

  it('D-043: salta la vivienda si la cuenta ya la tenía marcada', () => {
    expect(siguientePasoRecorrido(en('entrar'), VECINO)).toEqual(en('mapa'));
    expect(siguientePasoRecorrido(en('entrar'), SIN_VIVIENDA)).toEqual(en('vivienda'));
  });
});

describe('conContexto', () => {
  it('D-043: la sesión cumple "cuenta" aunque el formulario se enviara antes de tiempo', () => {
    expect(conContexto(en('cuenta', 0), SIN_VIVIENDA)).toEqual(en('cuenta', 0, true));
  });

  it('D-043: el perfil cumple "vivienda"', () => {
    expect(conContexto(en('vivienda', 1), VECINO)).toEqual(en('vivienda', 1, true));
  });

  it('D-043: sin cambios devuelve el mismo objeto (no reescribe el almacenamiento)', () => {
    const estado = en('mapa', 1);
    expect(conContexto(estado, VECINO)).toBe(estado);
    const cuenta = en('cuenta');
    expect(conContexto(cuenta, VISITANTE)).toBe(cuenta);
  });
});

describe('progresoRecorrido', () => {
  it('D-043: "cuenta" y "entrar" se reparten el paso 1', () => {
    expect(progresoRecorrido(en('cuenta'), 3)).toEqual({ hechos: 0, parcial: 0 });
    expect(progresoRecorrido(en('cuenta', 2, true), 3)).toEqual({ hechos: 0, parcial: 0.5 });
    expect(progresoRecorrido(en('entrar'), 1)).toEqual({ hechos: 0, parcial: 0.5 });
  });

  it('D-043: el logro completa el paso; el final, los siete', () => {
    expect(progresoRecorrido(en('vivienda', 2, true), 3)).toEqual({ hechos: 2, parcial: 0 });
    expect(progresoRecorrido(en('avisar', 1), 3).hechos).toBe(3);
    expect(progresoRecorrido({ paso: 'fin' })).toEqual({ hechos: 7, parcial: 0 });
  });
});

describe('crearRecorrido', () => {
  it('D-043: se recuerda en el dispositivo y se borra al terminar', () => {
    const almacen = memoria();
    const recorrido = crearRecorrido(almacen);
    expect(recorrido.estado.leer()).toBeNull();

    recorrido.fijar(en('vivienda', 1));
    expect(crearRecorrido(almacen).estado.leer()).toEqual(en('vivienda', 1));

    recorrido.fijar(null);
    expect(almacen.datos.has(CLAVE_RECORRIDO)).toBe(false);
  });

  it('D-043: ignora lo guardado si no tiene la forma esperada', () => {
    const almacen = memoria();
    almacen.setItem(CLAVE_RECORRIDO, '{"paso":"otro","indicacion":0,"logro":false}');
    expect(leerRecorrido(almacen)).toBeNull();
    almacen.setItem(CLAVE_RECORRIDO, 'no es json');
    expect(leerRecorrido(almacen)).toBeNull();
    almacen.setItem(CLAVE_RECORRIDO, '{"paso":"fin"}');
    expect(leerRecorrido(almacen)).toEqual({ paso: 'fin' });
  });

  it('D-043: sin almacenamiento (modo privado) vale para la pestaña', () => {
    const roto = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const recorrido = crearRecorrido(roto);
    recorrido.fijar(en('mapa'));
    expect(recorrido.estado.leer()).toEqual(en('mapa'));
  });
});
