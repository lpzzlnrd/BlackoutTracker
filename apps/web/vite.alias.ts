import { fileURLToPath } from 'node:url';

const desdeAqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

/**
 * Atajos a carpetas de la raíz del monorepo que solo usa la demo (`datos/adaptadores/mock/cargar.ts`).
 * Vite y Vitest comparten esta tabla; el espejo para TypeScript está en `tsconfig.json` (`paths`).
 */
export const alias = {
  '@docs': desdeAqui('../../docs'),
  '@data': desdeAqui('../../data'),
};
