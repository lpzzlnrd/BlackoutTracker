import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { TipoNotificacion, type TipoServicio } from '@blackout/shared';
import type { Env } from '../config/env';
import type { Transaccion } from '../db/db.module';
import { primerMomentoPermitido, type Silencio } from './horario.puro';

export interface EventoParaAvisar {
  tipo: typeof TipoNotificacion.CorteConfirmado | typeof TipoNotificacion.ServicioRestablecido;
  eventoId: number;
  sectorId: number;
  tipoServicio: TipoServicio;
  /** Vecinos que confirmaron (sus reportes de inicio o de cierre). */
  aportantes: readonly string[];
  ahora: Date;
}

/**
 * Escribe en la bandeja de salida (`notificaciones`) desde la transacción del consenso (T-072,
 * D-042). No envía nada: lo hace `EnvioService` desde el cron. Así, si la API se cae después del
 * commit, nada se pierde, y si el consenso se reevalúa con N + 1 reportes, el índice único impide
 * duplicar el aviso. Solo se encola para vecinos con algún dispositivo suscrito.
 */
@Injectable()
export class BandejaService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  silencio(): Silencio {
    return {
      desde: this.config.get('SILENCIO_DESDE', { infer: true }),
      hasta: this.config.get('SILENCIO_HASTA', { infer: true }),
    };
  }

  /** Un aviso por vecino suscrito del sector: «se fue» o «volvió/llegó». */
  async encolarEvento(tx: Transaccion, e: EventoParaAvisar): Promise<void> {
    const ahora = e.ahora.toISOString();
    const programada = primerMomentoPermitido(e.ahora, this.silencio()).toISOString();
    const aporto =
      e.aportantes.length > 0
        ? sql`r.id in (${sql.join(
            e.aportantes.map((a) => sql`${a}::uuid`),
            sql`, `,
          )})`
        : sql`false`;
    // «Llegó el agua» suena de noche a quien lo pidió (D-042, idea d).
    const programadaPara =
      e.tipo === TipoNotificacion.ServicioRestablecido && e.tipoServicio === 'agua'
        ? sql`case when r.agua_de_noche then ${ahora}::timestamptz else ${programada}::timestamptz end`
        : sql`${programada}::timestamptz`;
    await tx.execute(sql`
      insert into notificaciones
        (residente_id, tipo, sector_id, tipo_servicio, evento_id, datos, creada_en, programada_para)
      select r.id, ${e.tipo}::tipo_notificacion, ${e.sectorId}::smallint,
             ${e.tipoServicio}::tipo_servicio, ${e.eventoId}::int,
             jsonb_build_object('vecinos', ${new Set(e.aportantes).size}::int, 'aporto', ${aporto}),
             ${ahora}::timestamptz, ${programadaPara}
      from residentes r
      where r.sector_id = ${e.sectorId}
        and exists (select 1 from suscripciones_push s where s.residente_id = r.id)
      on conflict do nothing`);
  }

  /**
   * La pregunta a los vecinos (D-042, idea c): aparecieron reportes sin confirmar en el sector. Va a
   * quien tiene los recordatorios activos y todavía no reportó ese servicio. Es un recordatorio: al
   * enviarla cuenta para el tope diario.
   */
  async encolarPregunta(
    tx: Transaccion,
    p: { sectorId: number; tipoServicio: TipoServicio; ahora: Date },
  ): Promise<void> {
    const programada = primerMomentoPermitido(p.ahora, this.silencio()).toISOString();
    await tx.execute(sql`
      insert into notificaciones
        (residente_id, tipo, sector_id, tipo_servicio, creada_en, programada_para)
      select r.id, ${TipoNotificacion.PreguntaVecinos}::tipo_notificacion, ${p.sectorId}::smallint,
             ${p.tipoServicio}::tipo_servicio, ${p.ahora.toISOString()}::timestamptz,
             ${programada}::timestamptz
      from residentes r
      where r.sector_id = ${p.sectorId}
        and r.recordatorios
        and exists (select 1 from suscripciones_push s where s.residente_id = r.id)
        and not exists (
          select 1 from reportes x
          where x.residente_id = r.id and x.tipo_servicio = ${p.tipoServicio}::tipo_servicio
            and x.fin_en is null and not x.vencido
        )`);
  }
}
