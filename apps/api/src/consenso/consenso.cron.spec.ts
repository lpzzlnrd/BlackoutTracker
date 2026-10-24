import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { ConsensoCron } from './consenso.cron';
import type { ConsensoService } from './consenso.service';

const config = (activo: boolean) => ({ get: () => activo }) as unknown as ConfigService<Env, true>;
const crear = (reevaluarVencidos: jest.Mock, activo = true) =>
  new ConsensoCron({ reevaluarVencidos } as unknown as ConsensoService, config(activo));

describe('ConsensoCron (T-033)', () => {
  it('no corre si CRON_ACTIVO es false', async () => {
    const reevaluarVencidos = jest.fn();
    await crear(reevaluarVencidos, false).alMinuto();
    expect(reevaluarVencidos).not.toHaveBeenCalled();
  });

  it('un fallo del barrido se registra y no lanza; la siguiente pasada corre', async () => {
    const reevaluarVencidos = jest
      .fn()
      .mockRejectedValueOnce(new Error('bd caída'))
      .mockResolvedValueOnce(0);
    const cron = crear(reevaluarVencidos);
    jest.spyOn(cron['log'], 'error').mockImplementation(() => undefined);
    await expect(cron.alMinuto()).resolves.toBeUndefined();
    await cron.alMinuto();
    expect(reevaluarVencidos).toHaveBeenCalledTimes(2);
  });

  it('no solapa ejecuciones: con una en curso, la otra se salta', async () => {
    let liberar!: () => void;
    const reevaluarVencidos = jest.fn(() => new Promise<number>((r) => (liberar = () => r(0))));
    const cron = crear(reevaluarVencidos);
    const primera = cron.alMinuto();
    await cron.alMinuto();
    expect(reevaluarVencidos).toHaveBeenCalledTimes(1);
    liberar();
    await primera;
  });
});
