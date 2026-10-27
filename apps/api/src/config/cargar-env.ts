/**
 * Dónde se busca el `.env`, relativo a `apps/api` (el directorio de trabajo de `pnpm --filter`):
 * primero uno propio de la app y después el de la raíz del monorepo, que es el único que se usa
 * desde D-030. El primero que exista gana; lo que ya está en el entorno (Render, Docker) manda.
 */
export const RUTAS_ENV = ['.env', '../../.env'];

/** En los tests no se lee ningún `.env`: cada suite fija sus variables (`test/setup-env.ts`). */
export const ignorarArchivoEnv = (): boolean => process.env.NODE_ENV === 'test';

/**
 * Para los scripts `db:*` y `drizzle-kit`, que no pasan por `ConfigModule`. Devuelve el archivo
 * leído, o `null`. `cargar` se inyecta solo en los tests.
 */
export function cargarEnv(
  cargar: (ruta: string) => void = (ruta) => process.loadEnvFile(ruta),
): string | null {
  if (ignorarArchivoEnv()) return null;
  for (const ruta of RUTAS_ENV) {
    try {
      cargar(ruta);
      return ruta;
    } catch {
      // no existe: se prueba el siguiente
    }
  }
  return null;
}
