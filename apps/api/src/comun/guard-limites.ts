import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SolicitudAutenticada } from '../auth/residente-actual.decorator';

/**
 * El throttle global (T-051, D-044). Con sesión cuenta por residente: el `sub` que ya verificó
 * `JwtGuard`, que por eso se registra antes en `AppModule`. Sin sesión (rutas `@Public()`), por IP,
 * como el guard de la librería (IPv6 agrupada por subred). Contar por IP las rutas con sesión
 * frenaba a vecinos distintos que comparten IP (el Wi-Fi de una casa o de una prueba de campo, el
 * CGNAT de las operadoras móviles) justo cuando un apagón hace que todos avisen a la vez.
 */
@Injectable()
export class GuardLimites extends ThrottlerGuard {
  protected override async getTracker(solicitud: Record<string, unknown>): Promise<string> {
    const { residenteId } = solicitud as Pick<SolicitudAutenticada, 'residenteId'>;
    return residenteId ? `residente:${residenteId}` : super.getTracker(solicitud);
  }
}
