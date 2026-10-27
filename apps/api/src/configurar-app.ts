import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { FiltroErrores } from './comun/filtro-errores';
import { LIMITE_BODY } from './comun/limites';
import type { Env } from './config/env';

/** Texto de Swagger. La tabla de la cola es la de docs/PLAN.md §5 y la implementa `accionDeRespuesta`. */
const DESCRIPCION_API = [
  'Monitoreo colaborativo de cortes de agua y electricidad (piloto: Guaparo).',
  '',
  '## Contrato de sincronización (cola offline)',
  '',
  'Qué hace el cliente con la respuesta de `PUT /reportes/:id` y `PATCH /reportes/:id/cierre`. ' +
    'Las dos operaciones son idempotentes, así que reintentar es seguro (OFF-05). Se guarda la hora ' +
    'del evento (`ocurridoEn`), no la del envío (OFF-03), y la cola envía en orden cronológico (OFF-04).',
  '',
  '| Respuesta | Qué hace el cliente |',
  '|---|---|',
  '| 2xx | Éxito: lo saca de la cola |',
  '| Sin respuesta (red caída o corte a mitad del envío), 5xx o 429 | Reintenta, con backoff |',
  '| 404 en un cierre (el inicio aún no llega) | Reintenta |',
  '| 400, 409 o 422 | Error permanente: lo saca de la cola, lo marca `error` y avisa al usuario |',
  '| 401 | Refresca la sesión y reintenta |',
  '',
  'Todo error lleva un campo `codigo` (enum `CodigoError` de `@blackout/shared`). La tabla está ' +
    'implementada en `accionDeRespuesta` (`@blackout/shared`).',
].join('\n');

/** Configuración común de `main.ts` y de los e2e: así las pruebas ejercitan lo mismo que producción. */
export function configurarApp(
  app: INestApplication,
): ReturnType<typeof SwaggerModule.createDocument> {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxies = config.get('TRUST_PROXY', { infer: true });
  if (proxies > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxies);

  app.setGlobalPrefix('api');
  app.use(helmet());
  // Reemplaza el body parser por defecto (100 kB) por uno más estricto; el exceso es un 413.
  (app as NestExpressApplication).useBodyParser('json', { limit: LIMITE_BODY });
  // La API solo habla JSON, pero Express también acepta formularios (100 kB por defecto): se les
  // pone el mismo límite y sin objetos anidados, para que no sean una vía para saltarse el de arriba.
  (app as NestExpressApplication).useBodyParser('urlencoded', {
    limit: LIMITE_BODY,
    extended: false,
  });
  // CORS estricto: solo los orígenes de la lista, los métodos y cabeceras que usa la API y sin
  // cookies (la autenticación va en `Authorization`).
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new FiltroErrores());

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BlackoutTracker API')
      .setDescription(DESCRIPCION_API)
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);
  // Lo usa scripts/exportar-openapi.ts para escribir docs/openapi.json (T-060).
  return documento;
}
