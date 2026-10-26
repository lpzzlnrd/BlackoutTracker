import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { FiltroErrores } from './comun/filtro-errores';
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
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxies = config.get('TRUST_PROXY', { infer: true });
  if (proxies > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxies);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
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
}
