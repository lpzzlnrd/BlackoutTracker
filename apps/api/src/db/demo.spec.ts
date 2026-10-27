import { CORTES_DEMO, motivoParaNoSembrar } from './demo';

describe('motivoParaNoSembrar (T-061, D-027)', () => {
  const local = 'postgres://postgres:postgres@localhost:5433/blackout';
  const remota = 'postgres://postgres.abc:clave@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  it('T-061: una base local siempre se puede, aun con NODE_ENV=production', () => {
    expect(motivoParaNoSembrar({ url: local, nodeEnv: 'production', forzar: false })).toBeNull();
    expect(
      motivoParaNoSembrar({ url: local.replace('localhost', '127.0.0.1'), forzar: false }),
    ).toBeNull();
  });

  it('T-061: una base remota de staging se puede', () => {
    expect(motivoParaNoSembrar({ url: remota, nodeEnv: 'development', forzar: false })).toBeNull();
  });

  it('T-061: se niega con NODE_ENV=production o con una URL que parece de producción', () => {
    expect(motivoParaNoSembrar({ url: remota, nodeEnv: 'production', forzar: false })).toMatch(
      /NODE_ENV=production/,
    );
    expect(
      motivoParaNoSembrar({ url: 'postgres://u:p@db-prod.ejemplo.com/x', forzar: false }),
    ).toMatch(/producción/);
  });

  it('T-061: --forzar salta la regla, y una URL inválida se rechaza', () => {
    expect(motivoParaNoSembrar({ url: remota, nodeEnv: 'production', forzar: true })).toBeNull();
    expect(motivoParaNoSembrar({ url: 'no-es-url', forzar: false })).toMatch(/no es una URL/);
  });

  it('T-061: los reportes en vivo de cada corte caben en la ventana de consenso y no repiten residentes', () => {
    const ids = CORTES_DEMO.flatMap((c) => c.reportes.map((r) => r.residenteId));
    expect(new Set(ids).size).toBe(ids.length);
    const luz = CORTES_DEMO[0].reportes.map((r) => r.minutos);
    // 30 min es la ventana por defecto de la luz (D-004).
    expect(Math.max(...luz) - Math.min(...luz)).toBeLessThan(30);
    for (const c of CORTES_DEMO) for (const r of c.reportes) expect(r.minutos).toBeLessThan(0);
  });
});
