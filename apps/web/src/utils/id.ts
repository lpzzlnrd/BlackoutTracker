/**
 * UUID v4 para un aviso nuevo: es la clave de idempotencia del reporte (OFF-05), así que se
 * genera una sola vez, al encolar, y se reutiliza en cada reintento.
 */
export const nuevoId = (): string => crypto.randomUUID();
