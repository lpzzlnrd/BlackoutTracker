/**
 * UUID v4 para un aviso nuevo: es la clave de idempotencia del reporte (OFF-05), así que se
 * genera una sola vez, al encolar, y se reutiliza en cada reintento.
 *
 * `crypto.randomUUID` solo existe en orígenes seguros (https o localhost). Abierta por la IP de la
 * red local (un teléfono probando contra Docker) o desde las pruebas E2E (`http://web`), se arma
 * el mismo UUID v4 con `getRandomValues`, que sí está disponible.
 */
export function nuevoId(
  generar: Pick<Crypto, 'getRandomValues'> & Partial<Crypto> = crypto,
): string {
  if (typeof generar.randomUUID === 'function') return generar.randomUUID();
  const bytes = generar.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // versión 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
