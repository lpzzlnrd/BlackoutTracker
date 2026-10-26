import { THROTTLE_REGISTRO } from './limites';
import { ReportesController } from '../reportes/reportes.controller';
import { ResidentesController } from '../residentes/residentes.controller';

/** Metadatos que guarda `@Throttle()` (nombre `default`). */
const limiteDe = (metodo: object) => Reflect.getMetadata('THROTTLER:LIMITdefault', metodo);

describe('throttle por ruta (T-051)', () => {
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
});
