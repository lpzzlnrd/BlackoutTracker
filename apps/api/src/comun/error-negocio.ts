import { HttpException } from '@nestjs/common';
import { type CodigoError, ESTADO_HTTP_DE_CODIGO } from '@blackout/shared';

/** Error de dominio con su `codigo`; el estado HTTP sale de `ESTADO_HTTP_DE_CODIGO`. */
export class ErrorNegocio extends HttpException {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje, ESTADO_HTTP_DE_CODIGO[codigo]);
  }
}
