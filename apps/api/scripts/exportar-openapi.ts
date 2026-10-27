// Uso: pnpm --filter api openapi:export [ruta]   (por defecto, docs/openapi.json en la raíz)
//
// Escribe el documento OpenAPI de la API (el mismo que sirve Swagger en /api/docs) sin conectarse a
// la base ni escuchar un puerto: crea la app sin `init()`. Se vuelve a ejecutar al integrar cada PR
// que cambie rutas o DTO (T-060).
import 'reflect-metadata';
import './entorno-sin-conexion'; // antes que AppModule: ver el archivo
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

async function main(): Promise<void> {
  const ruta = resolve(process.argv[2] ?? join(__dirname, '../../../docs/openapi.json'));
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  try {
    const documento = configurarApp(app);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, `${JSON.stringify(documento, null, 2)}\n`);
    const rutas = Object.keys(documento.paths).length;
    console.log(`OpenAPI exportado a ${ruta} (${rutas} rutas).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
