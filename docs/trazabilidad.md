# Trazabilidad — casos de prueba ↔ tests automatizados

> **Archivo generado** por `pnpm docs:trazabilidad` (`scripts/trazabilidad.mjs`). No se edita a mano.
> Cruza los IDs de `docs/casos-de-prueba.md` con los nombres de los tests (`it`, `test`, `describe`) de `apps/` y `packages/`; la columna *Tests* cuenta los tests cuyo nombre lleva el ID.
> "Sin test automatizado" no significa "sin probar": los casos de la interfaz se prueban en `apps/web` (Vitest y Playwright), y los de aceptación y varios no funcionales (red lenta, Lighthouse, SUS) se ejecutan a mano o en campo.

## Resumen

| Grupo | Casos | Con test | Prioridad A con test |
|---|---|---|---|
| REG — Registro y validación geográfica | 7 | 3 | 2 / 4 |
| REP — Ciclo de reportes | 7 | 7 | 4 / 4 |
| CON — Consenso estructural | 7 | 7 | 5 / 5 |
| OFF — Sin conexión | 7 | 3 | 2 / 5 |
| EST — Estimación estadística | 6 | 6 | 4 / 4 |
| VIS — Visualización | 5 | 3 | 1 / 2 |
| No funcionales | 8 | 2 | — |
| Aceptación (8–10 residentes, sin instrucciones paso a paso) | 6 | 0 | — |
| **Total** | **53** | **31** | **18 / 24** |

## REG — Registro y validación geográfica

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| REG-01 | Pin dentro del polígono | A | 3 | `apps/api/test/registro.e2e-spec.ts` (3) |
| REG-02 | Pin fuera del polígono | A | 1 | `apps/api/test/registro.e2e-spec.ts` (1) |
| REG-03 | Pin sobre el borde | M | 2 | `apps/api/test/registro.e2e-spec.ts` (2) |
| REG-04 | Correo ya existente | A | — | sin test automatizado |
| REG-05 | Campos vacíos | M | — | sin test automatizado |
| REG-06 | Permiso de ubicación denegado | M | — | sin test automatizado |
| REG-07 | Login y logout | A | — | sin test automatizado |

## REP — Ciclo de reportes

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| REP-01 | Inicio de un corte de luz | A | 1 | `apps/api/test/reportes-inicio.e2e-spec.ts` (1) |
| REP-02 | Inicio de un corte de agua | A | 1 | `apps/api/test/reportes-inicio.e2e-spec.ts` (1) |
| REP-03 | Cierre (regreso del servicio) | A | 2 | `apps/api/src/reportes/tiempo.puro.spec.ts` (1), `apps/api/test/reportes-cierre.e2e-spec.ts` (1) |
| REP-04 | Cierre sin inicio | M | 2 | `apps/api/test/reportes-cierre.e2e-spec.ts` (2) |
| REP-05 | Duplicado del mismo usuario | A | 5 | `apps/api/test/esquema.e2e-spec.ts` (2), `apps/api/test/reportes-inicio.e2e-spec.ts` (2), `apps/api/test/vencimiento.e2e-spec.ts` (1) |
| REP-06 | Agua y luz a la vez | M | 3 | `apps/api/test/esquema.e2e-spec.ts` (1), `apps/api/test/reportes-cierre.e2e-spec.ts` (1), `apps/api/test/reportes-inicio.e2e-spec.ts` (1) |
| REP-07 | Fin anterior al inicio | M | 7 | `apps/api/src/reportes/tiempo.puro.spec.ts` (2), `apps/api/test/esquema.e2e-spec.ts` (2), `apps/api/test/reportes-cierre.e2e-spec.ts` (2), `apps/api/test/reportes-inicio.e2e-spec.ts` (1) |

## CON — Consenso estructural

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| CON-01 | N − 1 | A | 3 | `apps/api/src/consenso/consenso.puro.spec.ts` (1), `apps/api/test/consenso.e2e-spec.ts` (1), `apps/api/test/resumen.e2e-spec.ts` (1) |
| CON-02 | N | A | 2 | `apps/api/src/consenso/consenso.puro.spec.ts` (1), `apps/api/test/consenso.e2e-spec.ts` (1) |
| CON-03 | N + 1 | M | 4 | `apps/api/src/consenso/consenso.puro.spec.ts` (1), `apps/api/test/consenso.e2e-spec.ts` (2), `apps/api/test/esquema.e2e-spec.ts` (1) |
| CON-04 | Mismo usuario ×3 | A | 6 | `apps/api/src/consenso/consenso.puro.spec.ts` (5), `apps/api/test/consenso.e2e-spec.ts` (1) |
| CON-05 | Sectores distintos | A | 3 | `apps/api/src/consenso/consenso.puro.spec.ts` (1), `apps/api/test/consenso.e2e-spec.ts` (2) |
| CON-06 | Restablecimiento | A | 5 | `apps/api/src/consenso/consenso.puro.spec.ts` (2), `apps/api/test/consenso.e2e-spec.ts` (2), `apps/api/test/vencimiento.e2e-spec.ts` (1) |
| CON-07 | Fuera de la ventana | M | 10 | `apps/api/src/consenso/consenso.puro.spec.ts` (4), `apps/api/test/consenso.e2e-spec.ts` (4), `apps/api/test/resumen.e2e-spec.ts` (1), `apps/api/test/vencimiento.e2e-spec.ts` (1) |

## OFF — Sin conexión

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| OFF-01 | Reporte en modo avión | A | — | sin test automatizado |
| OFF-02 | Sincronizar al volver la red | A | — | sin test automatizado |
| OFF-03 | Hora real del evento | A | 3 | `apps/api/src/reportes/tiempo.puro.spec.ts` (1), `apps/api/test/reportes-inicio.e2e-spec.ts` (2) |
| OFF-04 | Varios en cola | M | 5 | `apps/api/test/sincronizacion.e2e-spec.ts` (4), `packages/shared/test/sincronizacion.test.mjs` (1) |
| OFF-05 | Reintento sin duplicado | A | 7 | `apps/api/test/red-intermitente.e2e-spec.ts` (1), `apps/api/test/reportes-cierre.e2e-spec.ts` (2), `apps/api/test/reportes-inicio.e2e-spec.ts` (2), `apps/api/test/sincronizacion.e2e-spec.ts` (1), `packages/shared/test/sincronizacion.test.mjs` (1) |
| OFF-06 | Cerrar con cola pendiente | A | — | sin test automatizado |
| OFF-07 | Consultar sin red | M | — | sin test automatizado |

## EST — Estimación estadística

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| EST-01 | Cantidad impar | A | 3 | `apps/api/src/estimacion/estadistica.puro.spec.ts` (1), `apps/api/test/estimaciones.e2e-spec.ts` (1), `apps/api/test/resumen.e2e-spec.ts` (1) |
| EST-02 | Cantidad par | A | 1 | `apps/api/src/estimacion/estadistica.puro.spec.ts` (1) |
| EST-03 | Valor atípico | M | 2 | `apps/api/src/estimacion/estadistica.puro.spec.ts` (1), `apps/api/test/estimaciones.e2e-spec.ts` (1) |
| EST-04 | Sin historial | A | 6 | `apps/api/src/estimacion/estadistica.puro.spec.ts` (3), `apps/api/test/estimaciones.e2e-spec.ts` (2), `apps/api/test/resumen.e2e-spec.ts` (1) |
| EST-05 | Separación por servicio | A | 2 | `apps/api/test/estimaciones.e2e-spec.ts` (1), `apps/api/test/resumen.e2e-spec.ts` (1) |
| EST-06 | Nuevo ciclo | M | 2 | `apps/api/test/estimaciones.e2e-spec.ts` (1), `apps/api/test/vencimiento.e2e-spec.ts` (1) |

## VIS — Visualización

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| VIS-01 | Mapa de calor | A | 3 | `apps/api/test/sectores.e2e-spec.ts` (3) |
| VIS-02 | Filtro por servicio | A | — | sin test automatizado |
| VIS-03 | Tiempo real | M | 3 | `apps/api/test/rls.e2e-spec.ts` (3) |
| VIS-04 | Panel del sector | M | 3 | `apps/api/test/resumen.e2e-spec.ts` (2), `apps/api/test/vencimiento.e2e-spec.ts` (1) |
| VIS-05 | Pantalla pequeña | B | — | sin test automatizado |

## No funcionales

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| NF-01 | Red lenta | — | — | sin test automatizado |
| NF-02 | Caché | — | — | sin test automatizado |
| NF-03 | PWA | — | — | sin test automatizado |
| NF-04 | Intermitencia | — | 2 | `apps/api/test/red-intermitente.e2e-spec.ts` (2) |
| NF-05 | Compatibilidad | — | — | sin test automatizado |
| NF-06 | Privacidad | — | 19 | `apps/api/test/historial.e2e-spec.ts` (1), `apps/api/test/privacidad.e2e-spec.ts` (6), `apps/api/test/registro.e2e-spec.ts` (1), `apps/api/test/reportes-inicio.e2e-spec.ts` (1), `apps/api/test/reportes-mios.e2e-spec.ts` (1), `apps/api/test/resumen.e2e-spec.ts` (1), `apps/api/test/rls.e2e-spec.ts` (7), `apps/api/test/sectores.e2e-spec.ts` (1) |
| NF-07 | Sin admin | — | — | sin test automatizado |
| NF-08 | Usabilidad | — | — | sin test automatizado |

## Aceptación (8–10 residentes, sin instrucciones paso a paso)

| ID | Caso | P | Tests | Dónde |
|---|---|---|---|---|
| ACE-01 | Registrarse marcando su vivienda | — | — | sin test automatizado |
| ACE-02 | Reportar que se fue la luz | — | — | sin test automatizado |
| ACE-03 | Reportar el regreso | — | — | sin test automatizado |
| ACE-04 | Ver qué sectores están sin agua | — | — | sin test automatizado |
| ACE-05 | Leer la estimación de regreso de la luz | — | — | sin test automatizado |
| ACE-06 | Reportar en modo avión y luego volver | — | — | sin test automatizado |
