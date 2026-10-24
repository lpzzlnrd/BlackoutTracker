import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** La solicitud, con el id del residente que dejó el guard (el `sub` del JWT). */
export type SolicitudAutenticada = Request & { residenteId?: string };

/** Inyecta el id del residente autenticado (el `sub` del JWT de Supabase). */
export const ResidenteActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext) => {
  const id = ctx.switchToHttp().getRequest<SolicitudAutenticada>().residenteId;
  if (!id) throw new Error('@ResidenteActual() se usó en una ruta pública');
  return id;
});
