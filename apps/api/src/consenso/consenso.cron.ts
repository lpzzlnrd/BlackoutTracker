import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { ConsensoService } from './consenso.service';

/**
 * Cron de las ventanas de consenso (docs/PLAN.md §6.3): cada minuto reevalúa los pares cuyo estado
 * pudo cambiar solo por el tiempo. Es *best effort* (Render gratis se duerme): la lectura también
 * recalcula (`ConsensoService.refrescarSiViejo`).
 */
@Injectable()
export class ConsensoCron {
  private readonly log = new Logger(ConsensoCron.name);
  private enCurso = false;

  constructor(
    private readonly consenso: ConsensoService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async alMinuto(): Promise<void> {
    if (!this.config.get('CRON_ACTIVO', { infer: true })) return;
    await this.ejecutar();
  }

  /** Una pasada del barrido. Si la anterior sigue en curso, se salta; nunca lanza. */
  async ejecutar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      await this.consenso.reevaluarVencidos();
    } catch (e) {
      this.log.error(`Falló el barrido de ventanas: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.enCurso = false;
    }
  }
}
