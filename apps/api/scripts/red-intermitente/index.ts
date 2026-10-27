// Prueba larga de NF-04 (T-054): 10 min de red intermitente contra una API real.
//
// Uso:
//   RED_API_URL=https://<servicio>.onrender.com/api \
//   RED_TOKENS=<jwt1>,<jwt2>,... \
//   DATABASE_URL=postgres://... \
//   pnpm --filter api red:intermitente
//
// - RED_TOKENS: JWT de Supabase de residentes YA registrados (con sector) y sin reportes abiertos.
//   Mejor cuentas de prueba: la corrida les deja decenas de reportes.
// - DATABASE_URL: la base de esa API (solo lectura) para verificar 0 pérdidas y 0 duplicados.
// - Opcionales: RED_DURACION_MIN (10), RED_PAUSA_MS ("1000-4000"), RED_TIMEOUT_MS (8000),
//   RED_PROB_CORTE ("0.1,0.05,0.1,0.1": antes, a mitad del envío, después de guardar, lenta),
//   RED_LATENCIA_MAX_MS (12000) y RED_CAIDAS_S ("20-60,5-20": cada cuánto y cuánto dura una caída).
//
// El script levanta un proxy local que corta y demora las peticiones al azar; los residentes
// simulados envían por él con reintentos del mismo id. Al final la red se estabiliza, se drenan las
// colas y se compara con la BD. Sale con código 1 si hubo pérdidas, duplicados o respuestas
// inesperadas. Ojo con el throttle por IP de la API (T-051): todas las peticiones salen de esta
// máquina, así que conviene pocos residentes (3-4) y la pausa por defecto; los 429 se reintentan.
import postgres from 'postgres';
import { opcionesConexion } from '../../src/db/db.module';
import { ProxyIntermitente } from './proxy';
import { type ResidenteSimulado, simular } from './simulacion';
import { resumirVerificacion, verificar } from './verificacion';
import { cargarEnv } from '../../src/config/cargar-env';

cargarEnv();

function rango(valor: string | undefined, porDefecto: [number, number]): [number, number] {
  if (!valor) return porDefecto;
  const [min, max] = valor.split('-').map(Number);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error(`Rango inválido: "${valor}" (se espera "min-max")`);
  }
  return [min, max];
}

/** El `sub` del JWT (no se verifica la firma: la API lo hará en cada petición). */
function sub(token: string): string {
  const carga = token.split('.')[1];
  const id = carga
    ? (JSON.parse(Buffer.from(carga, 'base64url').toString('utf-8')) as { sub?: unknown }).sub
    : undefined;
  if (typeof id !== 'string') throw new Error('Un token de RED_TOKENS no trae `sub`');
  return id;
}

async function main(): Promise<void> {
  const urlApi = process.env.RED_API_URL?.replace(/\/+$/, '');
  const tokens = (process.env.RED_TOKENS ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const urlBd = process.env.DATABASE_URL;
  if (!urlApi || tokens.length === 0 || !urlBd) {
    throw new Error('Faltan RED_API_URL, RED_TOKENS o DATABASE_URL (ver el encabezado del script)');
  }
  const residentes: ResidenteSimulado[] = tokens.map((token) => ({ id: sub(token), token }));
  const ids = residentes.map((r) => r.id);
  const duracionMs = Number(process.env.RED_DURACION_MIN ?? 10) * 60_000;
  const [pAntes, pEnvio, pDespues, pLenta] = (process.env.RED_PROB_CORTE ?? '0.1,0.05,0.1,0.1')
    .split(',')
    .map(Number);
  const [cada, dura] = (process.env.RED_CAIDAS_S ?? '20-60,5-20').split(',');
  const aMs = ([a, b]: [number, number]): [number, number] => [a * 1000, b * 1000];

  const sql = postgres(urlBd, { ...opcionesConexion(urlBd), max: 1 });
  try {
    const abiertos = await sql`
      select count(*)::int as n from reportes
      where residente_id in ${sql(ids)} and fin_en is null and not vencido`;
    if ((abiertos[0].n as number) > 0) {
      throw new Error('Algún residente de RED_TOKENS tiene reportes abiertos: ciérralos antes');
    }
    const previos = new Set(
      (await sql`select id from reportes where residente_id in ${sql(ids)}`).map(
        (f) => f.id as string,
      ),
    );

    // La API base sin el prefijo: el proxy reenvía la ruta completa.
    const base = new URL(urlApi);
    const proxy = new ProxyIntermitente({
      destino: base.origin,
      probCortaAntes: pAntes,
      probCortaEnvio: pEnvio,
      probCortaDespues: pDespues,
      probLenta: pLenta,
      latenciaMaxMs: Number(process.env.RED_LATENCIA_MAX_MS ?? 12_000),
      caidas: { cadaMs: aMs(rango(cada, [20, 60])), duracionMs: aMs(rango(dura, [5, 20])) },
    });
    await proxy.abrir();
    console.log(
      `Red intermitente: ${residentes.length} residentes, ${duracionMs / 60_000} min contra ${urlApi}`,
    );
    const progreso = setInterval(
      () => console.log(`  red: ${JSON.stringify(proxy.estadisticas)}`),
      60_000,
    );

    const r = await simular({
      urlApi: `${proxy.url}${base.pathname.replace(/\/+$/, '')}`,
      residentes,
      duracionMs,
      pausaMs: rango(process.env.RED_PAUSA_MS, [1000, 4000]),
      esperaReintentoMs: [500, 5000],
      timeoutMs: Number(process.env.RED_TIMEOUT_MS ?? 8000),
      probReenvio: 0.1,
      antesDeDrenar: () => proxy.calmar(),
    });
    clearInterval(progreso);
    await proxy.cerrar();

    const v = await verificar(sql, r.esperados, ids, previos);
    console.log(`Cliente: ${JSON.stringify({ ...r, esperados: r.esperados.length })}`);
    console.log(`Red: ${JSON.stringify(proxy.estadisticas)}`);
    console.log(`Resultado: ${resumirVerificacion(v)}`);
    const ok =
      r.inesperados.length === 0 &&
      v.perdidos.length === 0 &&
      v.duplicados.length === 0 &&
      v.diferencias.length === 0;
    if (!ok) {
      console.error(JSON.stringify({ inesperados: r.inesperados, ...v }, null, 2));
      process.exitCode = 1;
    }
    console.log(ok ? 'NF-04 aprobado: 0 pérdidas y 0 duplicados.' : 'NF-04 FALLIDO.');
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
