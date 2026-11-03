// Uso: pnpm db:seed:demo [--sin-corte] [--forzar]   (guion y checklist en docs/demo.md)
//
// Deja la base lista para la demo (T-061, D-027), en tres pasos idempotentes:
//   1. La zona y los lugares (lo mismo que `pnpm db:seed`) y los sectores de la demo: las celdas H3
//      de Guaparo, La Viña, Parque Naguanagua, Tocuyito y Flor Amarillo (D-040).
//   2. Historial sintético de data/demo.csv con el importador de campo (T-044): "aprox. X h, según
//      n cortes" en casi todos los pares y "datos insuficientes" en dos.
//   3. Reportes en vivo por el consenso real: un corte de luz confirmado en Suroeste y 2 reportes de
//      agua sin confirmar en Calle 160. Levanta la app de Nest sin servidor HTTP, así que necesita el
//      .env completo de la API; con --sin-corte se salta.
// Se niega con NODE_ENV=production o una URL de base que parezca de producción, salvo --forzar.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { abrirCortesDemo, crearSectoresDemo, motivoParaNoSembrar } from '../src/db/demo';
import { importarCampo } from '../src/db/importar-campo';
import * as schema from '../src/db/schema';
import { leerLugares, leerZona, sembrarZona } from '../src/db/sembrar-zona';
import { cargarEnv } from '../src/config/cargar-env';

cargarEnv();

const DATOS = join(__dirname, '../../../data');

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const argumentos = process.argv.slice(2);
  const motivo = motivoParaNoSembrar({
    url,
    nodeEnv: process.env.NODE_ENV,
    forzar: argumentos.includes('--forzar'),
  });
  if (motivo) throw new Error(`No se siembra la demo: ${motivo}. Usa --forzar si es a propósito.`);

  const sql = postgres(url, { ...opcionesConexion(url), max: 1 });
  try {
    const leer = (archivo: string): unknown =>
      JSON.parse(readFileSync(join(DATOS, archivo), 'utf-8'));
    const zona = await sembrarZona(
      sql,
      leerZona(leer('zona-gran-valencia.geojson')),
      leerLugares(leer('lugares-gran-valencia.geojson')),
    );
    const sectores = await crearSectoresDemo(drizzle(sql, { schema }));
    console.log(
      `Municipios: ${zona.municipios}. Lugares: ${zona.lugares}. Sectores de la demo: ${sectores}.`,
    );

    const csv = readFileSync(join(DATOS, 'demo.csv'), 'utf-8');
    const { insertadas, yaCargadas, invalidas } = await importarCampo(sql, csv, new Date());
    for (const { linea, motivo: m } of invalidas) console.warn(`demo.csv, línea ${linea}: ${m}`);
    console.log(`Historial de demo: ${insertadas} nuevos, ${yaCargadas} ya estaban.`);

    if (!argumentos.includes('--sin-corte')) {
      // El cron no hace falta para sembrar; así no corre una pasada mientras la app está arriba.
      process.env.CRON_ACTIVO = 'false';
      // Se cargan aquí (require: el script corre como CommonJS) para que --sin-corte no exija el
      // .env completo de la API, que ConfigModule valida al cargar AppModule.
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
      const { ReportesService } =
        require('../src/reportes/reportes.service') as typeof import('../src/reportes/reportes.service');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
      });
      try {
        const creados = await abrirCortesDemo(sql, app.get(ReportesService), new Date());
        console.log(
          `Reportes en vivo: ${creados} nuevos (los que ya estaban vivos no se repiten).`,
        );
      } finally {
        await app.close();
      }
    }
    return invalidas.length > 0 ? 1 : 0;
  } finally {
    await sql.end();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
