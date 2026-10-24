import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { FiltroErrores } from './comun/filtro-errores';
import { LIMITE_BODY } from './comun/limites';
import type { Env } from './config/env';

/** Configuración común de `main.ts` y de los e2e: así las pruebas ejercitan lo mismo que producción. */
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxies = config.get('TRUST_PROXY', { infer: true });
  if (proxies > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxies);

  app.setGlobalPrefix('api');
  app.use(helmet());
  // Reemplaza el body parser por defecto (100 kB) por uno más estricto; el exceso es un 413.
  (app as NestExpressApplication).useBodyParser('json', { limit: LIMITE_BODY });
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
      .setDescription('Monitoreo colaborativo de cortes de agua y electricidad (piloto: Guaparo).')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);
}
