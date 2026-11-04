import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { GuardLimites } from './guard-limites';
import {
  THROTTLE_ESCRITURA,
  THROTTLE_GENERAL,
  THROTTLE_LECTURA_PUBLICA,
  THROTTLE_REGISTRO,
  THROTTLE_VALIDAR_PIN,
} from './limites';
import { EstimacionController } from '../estimacion/estimacion.controller';
import { HistorialController } from '../historial/historial.controller';
import { ReportesController } from '../reportes/reportes.controller';
import { ResidentesController } from '../residentes/residentes.controller';
import { ResumenController } from '../resumen/resumen.controller';
import { SectoresController } from '../sectores/sectores.controller';

/** Metadatos que guarda `@Throttle()` (nombre `default`), en el método o en la clase. */
const limiteDe = (destino: object) => Reflect.getMetadata('THROTTLER:LIMITdefault', destino);

describe('throttle por ruta (T-051, D-044)', () => {
  it('cada ruta de reportes y de residentes declara su propio límite', () => {
    const rutas = [
      ReportesController.prototype.mios,
      ReportesController.prototype.iniciar,
      ReportesController.prototype.cerrar,
      ResidentesController.prototype.registrar,
      ResidentesController.prototype.yo,
      ResidentesController.prototype.validarPin,
    ];
    for (const ruta of rutas) expect(limiteDe(ruta)).toEqual(expect.any(Number));
  });

  it('el registro es la ruta más restringida entre las autenticadas', () => {
    expect(limiteDe(ResidentesController.prototype.registrar)).toBe(
      THROTTLE_REGISTRO.default.limit,
    );
    expect(limiteDe(ReportesController.prototype.iniciar)).toBeGreaterThan(
      limiteDe(ResidentesController.prototype.registrar),
    );
  });

  it('las escrituras dejan vaciar una cola de 20 avisos en un minuto (OFF-04)', () => {
    expect(limiteDe(ReportesController.prototype.iniciar)).toBe(THROTTLE_ESCRITURA.default.limit);
    expect(limiteDe(ReportesController.prototype.cerrar)).toBe(THROTTLE_ESCRITURA.default.limit);
    expect(THROTTLE_ESCRITURA.default.limit).toBeGreaterThanOrEqual(20);
  });

  it('las lecturas públicas van por IP con el límite holgado, y validar-pin con el suyo', () => {
    for (const controlador of [
      SectoresController,
      HistorialController,
      ResumenController,
      EstimacionController,
    ]) {
      expect(limiteDe(controlador)).toBe(THROTTLE_LECTURA_PUBLICA.default.limit);
    }
    expect(limiteDe(ResidentesController.prototype.validarPin)).toBe(
      THROTTLE_VALIDAR_PIN.default.limit,
    );
  });
});

describe('GuardLimites: a quién se le cuenta (D-044)', () => {
  const crear = async () => {
    const guard = new GuardLimites(
      { throttlers: [THROTTLE_GENERAL] },
      {} as ThrottlerStorage,
      new Reflector(),
    );
    await guard.onModuleInit();
    return (solicitud: object) =>
      (guard as unknown as { getTracker(s: object): Promise<string> }).getTracker(solicitud);
  };

  it('con sesión, al residente: dos vecinos con la misma IP no comparten el límite', async () => {
    const rastreo = await crear();
    const a = await rastreo({ residenteId: 'a', ip: '200.44.1.9' });
    const b = await rastreo({ residenteId: 'b', ip: '200.44.1.9' });
    expect(a).toBe('residente:a');
    expect(b).toBe('residente:b');
  });

  it('sin sesión, a la IP', async () => {
    const rastreo = await crear();
    expect(await rastreo({ ip: '200.44.1.9' })).toBe('200.44.1.9');
  });
});
