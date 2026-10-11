import type { BaseDeDatos } from '../db/db.module';
import { SaludController } from './salud.controller';

const dbCon = (execute: () => Promise<unknown>) => ({ execute }) as unknown as BaseDeDatos;

describe('SaludController', () => {
  it('con la base arriba responde ok', async () => {
    const res = await new SaludController(dbCon(() => Promise.resolve([]))).obtener();
    expect(res).toMatchObject({ estado: 'ok', baseDeDatos: 'ok' });
  });

  it('con la base caída responde degradado y no lanza', async () => {
    const res = await new SaludController(
      dbCon(() => Promise.reject(new Error('caída'))),
    ).obtener();
    expect(res).toMatchObject({ estado: 'degradado', baseDeDatos: 'error' });
  });
});
