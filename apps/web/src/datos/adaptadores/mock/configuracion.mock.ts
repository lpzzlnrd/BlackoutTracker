import type { ConfigCliente } from '../../../dominio/tipos';
import type { Configuracion } from '../../puertos';

export function crearConfiguracionMock(config: ConfigCliente): Configuracion {
  return { obtener: async () => ({ ...config }) };
}
