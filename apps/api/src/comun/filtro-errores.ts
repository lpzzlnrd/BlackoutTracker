import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CodigoError, type ErrorApi } from '@blackout/shared';
import { ErrorNegocio } from './error-negocio';

const CODIGO_POR_ESTADO: Record<number, CodigoError> = {
  400: CodigoError.DatosInvalidos,
  401: CodigoError.NoAutenticado,
  429: CodigoError.DemasiadasSolicitudes,
};

/** Devuelve el formato estándar de Nest más `codigo` (docs/PLAN.md §5). Nunca filtra el detalle de un 500. */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger(FiltroErrores.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(excepcion instanceof HttpException)) {
      this.log.error(excepcion);
      const cuerpo: ErrorApi = {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
        codigo: CodigoError.ErrorInterno,
      };
      res.status(500).json(cuerpo);
      return;
    }

    const estado = excepcion.getStatus();
    const respuesta = excepcion.getResponse();
    const base =
      typeof respuesta === 'string'
        ? { message: respuesta, error: excepcion.name }
        : (respuesta as { message?: string | string[]; error?: string });

    // Un 403/404/409/422 de Nest sin código de dominio (p. ej. una ruta inexistente) usa el genérico
    // DATOS_INVALIDOS; los 5xx, ERROR_INTERNO.
    const codigo =
      excepcion instanceof ErrorNegocio
        ? excepcion.codigo
        : (CODIGO_POR_ESTADO[estado] ??
          (estado >= 500 ? CodigoError.ErrorInterno : CodigoError.DatosInvalidos));

    const cuerpo: ErrorApi = {
      statusCode: estado,
      message: base.message ?? excepcion.message,
      error: base.error ?? excepcion.name,
      codigo,
    };
    res.status(estado).json(cuerpo);
  }
}
