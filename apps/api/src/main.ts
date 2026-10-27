import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';
import type { Env } from './config/env';

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  await app.listen(app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true }));
}

void arrancar();
