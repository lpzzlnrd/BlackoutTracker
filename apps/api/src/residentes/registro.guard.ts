import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { CodigoError } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import type { SolicitudAutenticada } from '../auth/residente-actual.decorator';
import { type PerfilResidente, ResidentesService } from './residentes.service';

export type SolicitudConPerfil = SolicitudAutenticada & { perfil?: PerfilResidente };

/**
 * Se aplica con `@UseGuards(RegistroGuard)` en las rutas que exigen el perfil completo. Un usuario
 * de Auth sin perfil recibe 403 `REGISTRO_INCOMPLETO` y el front lo devuelve al paso del pin (D-014).
 * Corre después del guard global de JWT, así que `residenteId` ya existe.
 */
@Injectable()
export class RegistroGuard implements CanActivate {
  constructor(private readonly residentes: ResidentesService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudConPerfil>();
    const perfil = solicitud.residenteId && (await this.residentes.perfil(solicitud.residenteId));
    if (!perfil) {
      throw new ErrorNegocio(CodigoError.RegistroIncompleto, 'Falta completar el registro');
    }
    solicitud.perfil = perfil;
    return true;
  }
}

/** Inyecta `{ id, sectorId, sectorNombre }` del residente (nunca su ubicación); solo en rutas con `RegistroGuard`. */
export const PerfilActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext) => {
  const perfil = ctx.switchToHttp().getRequest<SolicitudConPerfil>().perfil;
  if (!perfil) throw new Error('@PerfilActual() exige RegistroGuard');
  return perfil;
});
