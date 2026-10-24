import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICA = 'esPublica';

/** Marca una ruta (o un controlador) como pública: el guard global de JWT la deja pasar sin token. */
export const Public = () => SetMetadata(ES_PUBLICA, true);
