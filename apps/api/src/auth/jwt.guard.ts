import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { CodigoError } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import type { Env } from '../config/env';
import { CLAVES_JWT, issuerSupabase } from './claves-jwt';
import { ES_PUBLICA } from './publico.decorator';
import type { SolicitudAutenticada } from './residente-actual.decorator';

/** Solo claves asimétricas: así un token firmado con HS256 (o `none`) nunca se acepta. */
const ALGORITMOS = ['ES256', 'RS256'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard global. Nest no emite tokens: solo verifica el JWT de Supabase (firma, emisor, audiencia y
 * vencimiento) y deja el `sub` en `request.residenteId`. Las rutas con `@Public()` no lo exigen.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audiencia: string;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
    @Inject(CLAVES_JWT) private readonly claves: JWTVerifyGetKey,
  ) {
    this.issuer = issuerSupabase(config.get('SUPABASE_URL', { infer: true }));
    this.audiencia = config.get('JWT_AUDIENCE', { infer: true });
  }

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) return true;

    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const [esquema, token] = (solicitud.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      throw new ErrorNegocio(CodigoError.NoAutenticado, 'Falta el token de acceso');
    }

    try {
      const { payload } = await jwtVerify(token, this.claves, {
        issuer: this.issuer,
        audience: this.audiencia,
        algorithms: ALGORITMOS,
      });
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
        throw new Error('sub inválido');
      }
      solicitud.residenteId = payload.sub;
      return true;
    } catch {
      // Sin detalle: no se le dice al cliente por qué falló la verificación.
      throw new ErrorNegocio(CodigoError.NoAutenticado, 'Token inválido o vencido');
    }
  }
}
