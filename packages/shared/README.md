# @blackout/shared

Lo que comparten la API (`apps/api`) y el frontend (`apps/web`): enums del dominio, códigos de error, interfaces de los DTO y valores por defecto. **Solo tipos, enums y constantes: sin lógica y sin dependencias de runtime** ([`PLAN.md`](../../docs/PLAN.md) §3).

## Qué exporta

| Archivo         | Contenido                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `enums.ts`      | `TipoServicio`, `EstadoServicio` y `OrigenEvento`: objeto `as const`, tipo del mismo nombre y tupla de valores (`TIPOS_SERVICIO`…) |
| `errores.ts`    | `CodigoError`, `ESTADO_HTTP_DE_CODIGO` y `ErrorApi`                                              |
| `dto.ts`        | Interfaces de las solicitudes y respuestas de [`PLAN.md`](../../docs/PLAN.md) §5, y `EstadoSectorFila` |
| `constantes.ts` | Valores por defecto: N, ventanas de consenso, n_min, límites de la hora del evento y zona horaria |

## Cómo se usa

En el `package.json` del consumidor: `"@blackout/shared": "workspace:*"`. Se importa por su nombre y no se copian los tipos:

```ts
import { CodigoError, TipoServicio, type ReporteDto } from '@blackout/shared';
```

## Compilar

El paquete se consume desde `dist/` (ESM para Vite y CJS para Nest, cada uno con sus tipos), así que hay que compilarlo antes de usarlo:

- `pnpm --filter @blackout/shared build`, o `pnpm build` en la raíz.
- `pnpm --filter @blackout/shared dev` lo deja en modo watch.

## Reglas

- Los valores de los enums y de los códigos de error son un contrato con la base de datos y con el frontend. `pnpm --filter @blackout/shared test` falla si cambian: cambiarlos exige una migración o una versión nueva de la API, no solo actualizar el test.
- Si agregas un valor a un enum, agrégalo también a su tupla y al enum de Postgres.
- Los DTO con `class-validator` viven en `apps/api` e implementan estas interfaces.
- Las pruebas (`test/`) comprueban los valores y que el paquete se importe bien desde CJS, ESM y `bundler` (`test/consumo/`).
