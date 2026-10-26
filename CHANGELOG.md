# Changelog

Todos los cambios relevantes de BlackoutTracker se anotan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen [SemVer](https://semver.org/lang/es/): `0.x` durante el desarrollo y una versión menor por fase (ver `docs/PLAN.md` §9).

Secciones por versión: **Añadido**, **Cambiado**, **Corregido**, **Eliminado**, **Seguridad**. Cada línea lleva el ID de la tarea (`T-0XX`) y, si aplica, los de los casos de prueba.

## [Sin publicar]

### Seguridad
- `overrides` en `pnpm-workspace.yaml` que suben `body-parser` a 2.4.0 y `multer` a 2.5.0, dependencias de `@nestjs/platform-express` con avisos altos de DoS (GHSA-27r3-jxmh-p828, GHSA-q7qp-rjg7-q26m). Con esto `pnpm audit --prod --audit-level high` vuelve a pasar (T-006).

### Añadido
- Cron de las ventanas de consenso: `@nestjs/schedule` cada minuto (`ConsensoCron`) que reevalúa, con `ConsensoService.reevaluar`, los pares con reportes sin confirmar para que vuelvan a 0 al vencer la ventana, sin solapar pasadas y sin que un par fallido corte el resto; `refrescarSiViejo` para recalcular al leer. Variable `CRON_ACTIVO` (apagada en los tests). Test CON-07 con reloj controlado (T-033).
- `ConsensoService.reevaluar`: dentro de la transacción del reporte (inicio y cierre) toma `pg_advisory_xact_lock(sector, servicio)`, aplica `evaluarInicio`/`evaluarRestablecimiento`, abre o cierra el evento en `eventos_sector` y hace upsert de `estado_sector` solo si algo cambió. `RELOJ` pasa a `comun/reloj.ts`. Tests de integración CON-01 a CON-07, incluidos 4 PUT concurrentes → 1 evento (T-032).
- `consenso/consenso.puro.ts`: `evaluarRestablecimiento` (CON-06): el evento se cierra con N residentes distintos con `fin_en` en una misma ventana W, o cuando ya no queda ningún reporte abierto y hay al menos un cierre; el fin es la mediana de los cierres que lo dispararon (D-007). Reutiliza la deduplicación y la ventana de `evaluarInicio`. Con tests CON-04, CON-06 y CON-07 y los dos motivos de cierre (T-031).
- `consenso/consenso.puro.ts`: `evaluarInicio` (ventana deslizante de ancho W sobre residentes distintos, uno por residente con su reporte más antiguo, límites inclusivos) y `medianaDeHoras` para el inicio del evento (D-007), con el reloj como parámetro. Con tests CON-01, CON-02, CON-03, CON-04, CON-05, CON-07 y la mediana, y `coverageThreshold` de 70 % en `src/consenso/` (T-030).
- `GET /api/reportes/mios?abiertos=`: los reportes del propio residente (nunca ajenos), el más reciente primero, para recuperar el estado en otro dispositivo (T-023).
- `PATCH /api/reportes/:id/cierre`: cierre idempotente que calcula la duración, bloquea un cierre sin inicio (404, D-003) y rechaza un fin anterior al inicio (422). Con tests REP-03, REP-04, REP-07 y OFF-05 (también en paralelo) (T-022).
- `PUT /api/reportes/:id`: inicio de un corte, idempotente (el id lo genera el cliente), con la hora del evento y no la del envío, `sector_id` tomado del residente y el enganche (no-op) del consenso dentro de la transacción. Con tests REP-01, REP-02, REP-05, REP-06, OFF-03 y OFF-05 (también en paralelo) (T-021).
- `reportes/tiempo.puro.ts`: validación de la hora de un reporte (no futuro con +2 min de tolerancia, no más antigua de 7 días, `fin ≥ inicio`) con el reloj como parámetro. Con tests REP-07, OFF-03 y los valores límite (T-020, D-013).
- Registro: `POST /api/registro/validar-pin` (público, con throttle), `POST /api/residentes/me` y `GET /api/residentes/me`, con `ST_Covers` y desempate por el menor id (D-002), `RegistroGuard` reutilizable (403 `REGISTRO_INCOMPLETO`) y la variable `TRUST_PROXY`. Con tests REG-01, REG-02, REG-03 y NF-06 (T-015).
- Guard global de JWT de Supabase (`jose` + JWKS con caché de 10 min, solo ES256/RS256, verifica emisor y audiencia), `@Public()` y `@ResidenteActual()`; con tests de token válido, vencido, de otra firma, de otro emisor, de otra audiencia, HS256 y sin token (T-013).
- CI/CD en GitHub Actions: `ci.yml` (build, lint, typecheck, tests unitarios y de integración con PostGIS, y auditoría informativa), `deploy-api.yml` (despliegue a Render por deploy hook), `keepalive.yml` (ping a `/api/salud`), Dependabot y plantilla de PR (T-006).
- Sectores provisionales de Guaparo (`data/sectores-guaparo.geojson`, 4 sectores aproximados, marcados PROVISIONAL), `pnpm db:seed` (valida geometrías y solapes, upsert idempotente y filas de `estado_sector`) y las coordenadas de control de `test/fixtures/puntos.ts` (T-012, D-005).
- Esquema de la base (migración 0001): enums, `sectores`, `residentes`, `reportes`, `eventos_sector` y `estado_sector` con el check de duración (REP-07), los únicos parciales de reporte abierto (REP-05/06) y de evento abierto (CON-03) y el índice GIST de `sectores.geom`. Con tests de integración (T-010).
- Drizzle ORM con postgres-js: `DbModule` global, `customType` para `MultiPolygon`, `drizzle.config.ts` (`extensionsFilters: ['postgis']`), migración 0000 (esquema `extensions` + PostGIS), scripts `db:generate`, `db:migrate` y `db:studio`, ping a la base en `GET /api/salud` y tests de integración contra PostGIS (`SELECT postgis_version()`, `search_path`, orden lng/lat) (T-005).
- PostGIS local con Docker (`postgis/postgis:16-3.4`, puerto 5433, bases `blackout` y `blackout_test`), los scripts `db:up`, `db:down` y `db:reset`, y `apps/api/.env.example` (T-004).
- `apps/api` (`@blackout/api`): esqueleto de NestJS 11 con `ConfigModule` y validación del `.env`, `ValidationPipe` global, Helmet, Throttler, CORS desde el env, prefijo `/api`, Swagger en `/api/docs`, filtro de errores que agrega `codigo` y `GET /api/salud`. Con tests unitarios y un e2e de `/salud` (T-003, D-019).
- `packages/shared` (`@blackout/shared`): enums del dominio (`TipoServicio`, `EstadoServicio`, `OrigenEvento`), `CodigoError` con el estado HTTP de cada código, interfaces de los DTO de la API, la fila de `estado_sector` y los valores por defecto (N = 3, n_min = 5, ventanas de consenso por servicio y límites de la hora del evento). Se compila con `tsup` a ESM y CJS con sus tipos, para Vite y Nest. Con tests de valores y de consumo (CJS, ESM y `bundler`) (T-002, D-016 a D-018).
- Monorepo pnpm: workspaces `apps/*` y `packages/*`, `tsconfig.base.json`, ESLint 10 (flat config) con Prettier, `.editorconfig`, `.gitattributes` y los scripts raíz `dev`, `build`, `lint`, `format`, `typecheck`, `test` y `test:int` (T-001).
- Canon del frontend (`docs/frontend/`): tres diseños completos de la PWA (A mapa primero, B estado primero, C datos primero) con sus referencias HTML, tokens CSS, receta de construcción por pantalla, datos de ejemplo y guía de la PWA. Incluye `herramientas/verificar-tokens.mjs`, que comprueba contraste, daltonismo y cobertura de los colores.
- `CLAUDE.md` con el contexto del proyecto y el stack definitivo (D-001).
- `docs/casos-de-prueba.md` (resumen del plan de pruebas ISO/IEC/IEEE 29119-3) y `docs/contexto-academico.md`.
- `docs/PLAN.md` (plan de implementación), `docs/TAREAS.md` (lista de tareas y protocolo de las sesiones), `docs/DECISIONES.md` (registro de decisiones) y este changelog.

### Cambiado
- `docs/frontend/datos.md` deja de marcar la forma de los datos como provisional, apunta a `@blackout/shared`, lista las diferencias con `datos-ejemplo.json` y completa la tabla código de error → mensaje en español (T-002).
- La rama principal ahora se llama `main` (antes `master`).
