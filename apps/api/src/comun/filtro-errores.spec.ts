import { BadRequestException, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { CodigoError } from '@blackout/shared';
import { ErrorNegocio } from './error-negocio';
import { FiltroErrores } from './filtro-errores';

function ejecutar(excepcion: unknown) {
  let estado = 0;
  let cuerpo: unknown;
  const res = {
    status: (s: number) => {
      estado = s;
      return { json: (c: unknown) => (cuerpo = c) };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new FiltroErrores().catch(excepcion, host);
  return { estado, cuerpo };
}

describe('FiltroErrores', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('usa el código y el estado de un ErrorNegocio', () => {
    const { estado, cuerpo } = ejecutar(
      new ErrorNegocio(CodigoError.HoraInvalida, 'fin antes del inicio'),
    );
    expect(estado).toBe(422);
    expect(cuerpo).toMatchObject({ codigo: 'HORA_INVALIDA', message: 'fin antes del inicio' });
  });

  it('un 400 de validación lleva DATOS_INVALIDOS y la lista de mensajes', () => {
    const { cuerpo } = ejecutar(new BadRequestException(['lat debe ser un número']));
    expect(cuerpo).toMatchObject({
      codigo: 'DATOS_INVALIDOS',
      message: ['lat debe ser un número'],
    });
  });

  it('un error no previsto es un 500 que no filtra el detalle', () => {
    const { estado, cuerpo } = ejecutar(new Error('password=secreto'));
    expect(estado).toBe(500);
    expect(JSON.stringify(cuerpo)).not.toContain('secreto');
    expect(cuerpo).toMatchObject({ codigo: 'ERROR_INTERNO' });
  });

  it('un 404 de Nest conserva su estado', () => {
    expect(ejecutar(new NotFoundException()).estado).toBe(404);
  });

  it('un cuerpo demasiado grande es un 413, no un 500', () => {
    const { estado, cuerpo } = ejecutar(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        expose: true,
        type: 'entity.too.large',
      }),
    );
    expect(estado).toBe(413);
    expect(cuerpo).toMatchObject({ statusCode: 413, codigo: 'DATOS_INVALIDOS' });
  });

  it('un JSON mal formado es un 400 con mensaje propio', () => {
    const { estado, cuerpo } = ejecutar(
      Object.assign(new SyntaxError('Unexpected token } in JSON at position 9'), {
        status: 400,
        expose: true,
        type: 'entity.parse.failed',
      }),
    );
    expect(estado).toBe(400);
    expect(JSON.stringify(cuerpo)).not.toContain('position 9');
  });

  it('un error con status 4xx pero sin `expose` sigue siendo un 500', () => {
    expect(ejecutar(Object.assign(new Error('x'), { status: 413 })).estado).toBe(500);
  });
});
