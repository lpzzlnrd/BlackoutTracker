import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { EnvioService } from './envio.service';
import { RecordatoriosService } from './recordatorios.service';

/**
 * Crons de las notificaciones (T-072). No usa `pg_cron` (CLAUDE.md §4). Cada minuto vacía la
 * bandeja de salida; cada 10 min mira si es la hora de una franja de recordatorios. Si Render
 * duerme, lo pendiente sale al despertar, salvo lo que ya caducó (12 h) o dejó de tener sentido.
 */
@Injectable()
export class NotificacionesCron {
  private readonly log = new Logger(NotificacionesCron.name);
  private enviando = false;
  private programando = false;

  constructor(
    private readonly envio: EnvioService,
    private readonly recordatorios: RecordatoriosService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async alMinuto(): Promise<void> {
    if (!this.config.get('CRON_ACTIVO', { infer: true })) return;
    await this.enviar();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cadaDiezMinutos(): Promise<void> {
    if (!this.config.get('CRON_ACTIVO', { infer: true })) return;
    await this.programarRecordatorios();
  }

  /** Una pasada del envío. Si la anterior sigue en curso, se salta; nunca lanza. */
  async enviar(): Promise<void> {
    if (this.enviando) return;
    this.enviando = true;
    try {
      await this.envio.enviarPendientes();
    } catch (e) {
      this.log.error(
        `Falló el envío de notificaciones: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.enviando = false;
    }
  }

  /** Encola los recordatorios de la franja (si es la hora) y los envía enseguida. Nunca lanza. */
  async programarRecordatorios(): Promise<void> {
    if (this.programando) return;
    this.programando = true;
    try {
      if ((await this.recordatorios.programar()) > 0) await this.enviar();
    } catch (e) {
      this.log.error(`Fallaron los recordatorios: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.programando = false;
    }
  }
}
