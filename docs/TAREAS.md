# Tareas — BlackoutTracker

> Fuente de verdad del avance. El diseño está en `docs/PLAN.md` y las decisiones en `docs/DECISIONES.md`.
> Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecha · `[!]` bloqueada (decir por qué).
> Dueño: **L** = Leonardo / sesiones de Claude en este repo · **F** = Freddy (frontend, solo como referencia).

## Estado

- **Fase actual:** 0. Fundaciones (S1)
- **Próxima tarea:** T-020
- **Bloqueos:** ninguno para la fase 0. T-012 usa un polígono provisional mientras no exista el GeoJSON real (D-005).
- **Decisiones por confirmar con Leonardo:** D-002, D-003, D-004, D-007, D-008, D-013, D-015, D-016, D-017, D-018 y las peticiones P1 a P4 del frontend (`docs/frontend/datos.md` §3). Las sesiones pueden avanzar con la propuesta, que siempre es configurable o fácil de cambiar; P1 a P4 no entran en `shared` hasta que se decidan.
- **Última actualización:** 2026-10-07, T-001 y T-002 hechas (en PR); T-003, T-004, T-005, T-010, T-012, T-013 y T-015 hechas (ramas `feat/T-003-esqueleto-api`, `feat/T-004-postgis-local`, `feat/T-005-drizzle`, `feat/T-010-esquema` y `feat/T-012-sectores-seed` y `feat/T-013-guard-jwt` y `feat/T-015-registro`).

---

## Protocolo de cada sesión

1. Lee `CLAUDE.md`, la sección *Estado* de este archivo y, del plan, solo la parte que toque la tarea.
2. Toma **la próxima tarea** (o la que pida Leonardo). Verifica que sus dependencias estén en `[x]`. Márcala `[~]`.
3. **Siempre en una rama nueva** (`CLAUDE.md` §10): `git switch main && git pull && git switch -c feat/T-0XX-descripcion-corta` (o `fix/`, `chore/`, `docs/`, `test/`). Nunca se trabaja sobre `main`.
4. Implementa **con los tests** que pide la tarea. Cada test empieza por el ID del caso (`'REP-05: ...'`).
5. Antes de cerrar: `pnpm lint && pnpm typecheck && pnpm test` (y `pnpm test:int` si toca la BD) en verde.
6. Actualiza:
   - Este archivo: la casilla `[x]`, la sección *Estado* y las notas de la tarea si algo cambió.
   - `CHANGELOG.md`: una línea en `[Sin publicar]`.
   - `docs/DECISIONES.md`: si decidiste algo que no estaba en el plan.
7. Commits en español con Conventional Commits (`feat(api): ...`, `test(consenso): ...`). El primer push es `git push --set-upstream origin <rama>` y los siguientes, `git push`. Se abre un PR a `main` con `gh pr create`. **Solo Leonardo fusiona**, salvo que él indique otra cosa.
8. Si una tarea resulta más grande de lo previsto, divídela aquí (T-021a, T-021b) en lugar de dejarla a medias sin rastro.
9. No toques `apps/web` (es de Freddy) ni crees recursos en Supabase o en Render sin la confirmación de Leonardo.

---

## Fase 0 — Fundaciones (S1)

- [x] **T-001 · Monorepo pnpm** (L)
  `package.json` raíz (con `packageManager` y `engines.node >=22`), `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint (flat config) + Prettier, `.editorconfig`, `.gitattributes` (`* text=auto eol=lf`), `.nvmrc`, `.gitignore` (node, dist, coverage, `.env*` salvo `.env.example`). Scripts raíz: `dev`, `build`, `lint`, `typecheck`, `test`, `test:int`.
  *Hecho cuando:* `pnpm install && pnpm lint && pnpm typecheck` corren sin error en un repo vacío de código.
  *Nota:* `pnpm lint` es `eslint . --max-warnings 0 && prettier --check .`. TypeScript queda en 5.9 con un catálogo de pnpm (D-016) y ESLint en la 10 con flat config.
- [x] **T-002 · `packages/shared`** (L) — dep: T-001
  `TipoServicio`, `EstadoServicio`, `CodigoError` (enum de códigos de error), interfaces de los DTO de §5 del plan y constantes por defecto (N = 3, n_min = 5). Se compila con `tsup` (ESM + CJS + d.ts) para que lo consuman Nest (CJS) y Vite.
  *Hecho cuando:* `apps/api` lo importa y compila.
  *Nota:* el paquete es `@blackout/shared` (D-017). Además de lo pedido exporta `OrigenEvento`, todas las constantes por defecto de §7 del plan (`constantes.ts`) y `EstadoSectorFila`; los enums son objetos `as const` y `CodigoError` tiene 12 códigos (D-018). Como `apps/api` aún no existe, "lo importa y compila" se comprobó con consumidores de prueba (CJS con `nodenext`, ESM y `bundler`) en `packages/shared/test/consumo/`: **T-003 lo confirma con el consumidor real**. Se consume desde `dist/`, así que hay que compilarlo antes (`pnpm build`, o `pnpm dev`, que lo deja en modo watch). También completa `docs/frontend/datos.md` (§5: tabla código → mensaje).
- [x] **T-003 · Esqueleto de `apps/api`** (L) — dep: T-001, T-002
  Nest 11: `ConfigModule` con validación del `.env` (§7 del plan), `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), Helmet, Throttler, CORS desde el env, prefijo `/api`, Swagger en `/api/docs`, filtro de errores que agrega `codigo` y `GET /salud`.
  *Hecho cuando:* `pnpm --filter api dev` levanta, `/api/docs` abre, y hay un e2e de `/salud` en verde.
  *Nota (hecha):* `apps/api` es `@blackout/api`; `configurarApp(app)` (`src/configurar-app.ts`) concentra prefijo, Helmet, CORS, pipe, filtro y Swagger, y lo usan `main.ts` y los e2e. El `.env` se valida con class-validator (`src/config/env.ts`); `DATABASE_URL` y `SUPABASE_URL` son opcionales hasta T-005 y T-013. `ErrorNegocio(codigo, mensaje)` es la excepción de dominio. `GET /salud` devuelve `baseDeDatos: 'ok'` fijo hasta que T-005 agregue el ping. Con el consumidor real, `@blackout/shared` compila y se importa desde CJS (`module: nodenext`): el "hecho cuando" de T-002 queda confirmado. ESLint activa `no-floating-promises` y `no-misused-promises` solo en `apps/api`.
  *Notas de T-001 y T-002:* instalar `@nestjs/*@^11` (el `latest` de npm es la 12, que `CLAUDE.md` §4 descarta). `apps/api` depende de `"@blackout/shared": "workspace:*"` y usa `"typescript": "catalog:"`. Como `shared` se consume desde `dist/`, el `dev` raíz tiene que compilarlo antes de arrancar los demás (`pnpm --filter @blackout/shared build`) y el `typecheck` del api lo necesita compilado; el filtro de errores y los DTO implementan `ErrorApi`, `CodigoError` y las interfaces de `shared`.
- [x] **T-004 · PostGIS local** (L) — dep: T-001
  `docker-compose.yml` con `postgis/postgis:16-3.4` en el puerto 5433 y las bases `blackout` y `blackout_test`. Scripts `db:up` y `db:down`. `apps/api/.env.example`.
  *Nota (hecha):* `docker/initdb/01-bases.sql` crea `blackout_test` solo la primera vez que arranca el volumen; `pnpm db:reset` borra el volumen y lo vuelve a crear. Usuario y clave `postgres`/`postgres`. `DATABASE_URL_TEST` apunta a `blackout_test`.
- [x] **T-005 · Drizzle** (L) — dep: T-003, T-004
  `drizzle.config.ts` con `extensionsFilters: ['postgis']`, proveedor Drizzle (postgres-js) inyectable y migración 0000 (esquema `extensions` + PostGIS, ver §4 del plan). `customType` para `MultiPolygon`. Scripts `db:generate`, `db:migrate` y `db:studio`.
  *Hecho cuando:* la migración corre en local y un test de integración ejecuta `SELECT postgis_version()`. **Verificar** que el `search_path` funcione igual que en Supabase.
  *Nota (hecha):* `DbModule` (global) expone `DB` (Drizzle) y `CLIENTE_PG`; la conexión fija `search_path=public,extensions` y desactiva las sentencias preparadas si la URL usa el puerto 6543 (pooler en modo transaction). `DATABASE_URL` pasa a ser obligatoria y `GET /salud` ya hace `select 1` (`baseDeDatos: 'error'` y `estado: 'degradado'` si falla). La migración 0000 es SQL a mano (`drizzle-kit generate --custom`). Los tests de integración migran `blackout_test` en un `globalSetup` y apuntan siempre a esa base (`test/setup-env.ts`). **Pendiente de verificar en T-007:** que PostGIS en el esquema `extensions` de Supabase resuelva con el mismo `search_path` (local lo trae en `public`; el test comprueba que la conexión y el SQL funcionan con los dos esquemas en el path). Scripts raíz: `db:generate`, `db:migrate`, `db:studio`.
- [ ] **T-006 · CI** (L) — dep: T-003, T-005
  `.github/workflows/ci.yml`, que corre en los PR y en los push a `main`: pnpm con caché (`pnpm install --frozen-lockfile`) → build → lint → typecheck → test → test:int (service container PostGIS). El `build` va primero porque `shared` se consume desde `dist/` (D-017). Leonardo activa a mano la protección de `main` (o con `gh api`, previa confirmación).
- [ ] **T-007 · Supabase staging** (L, **lo hace Leonardo** o la sesión con su confirmación)
  Crear el proyecto de staging, activar PostGIS, **verificar que las JWT signing keys sean asimétricas** (ES256/RS256) y anotar `SUPABASE_URL` y `DATABASE_URL` (pooler en modo session) en un `.env` local, nunca en el repo. El de producción se crea en la fase 5.

## Fase 1 — Modelo de datos, auth y registro (S1–S3) → `v0.1.0`

- [x] **T-010 · Esquema** (L) — dep: T-005
  Las tablas, enums, checks e índices de §4 del plan (incluidos los únicos parciales de REP-05 y de evento abierto, y el GIST en `sectores.geom`).
  *Tests:* un insert que viola `fin_en < inicio_en` falla (REP-07 a nivel BD), y un segundo reporte abierto del mismo servicio falla (REP-05 a nivel BD).
  *Nota (hecha):* esquema en `src/db/schema/*.ts` y migración `0001_esquema.sql`. Dos ajustes a lo que genera drizzle-kit: `sectores.id` es `smallint` con identidad (`generatedByDefaultAsIdentity`) porque el `smallserial` salía entre comillas como un tipo inexistente, y `residentes.ubicacion` es un `customType` `geometry(Point, 4326)` porque el `geometry` de Drizzle no emite el SRID. Los tests (`test/esquema.e2e-spec.ts`) también cubren REP-06, CON-03 a nivel BD y las claves foráneas. Helpers en `test/bd.ts` (`abrirBd`, `limpiar`, `codigoPg`, `cuadrado`).
- [ ] **T-011 · RLS y Realtime** (L) — dep: T-010
  Migración SQL a mano: RLS en todas las tablas, `SELECT` en `estado_sector` para `anon, authenticated`, `REVOKE` en las demás, y la publicación `supabase_realtime` (en un bloque `DO` condicional).
  *Tests (integración):* con `SET ROLE anon` (se crea el rol en local si no existe), leer `reportes` o `residentes` falla o devuelve 0 filas, y `estado_sector` se puede leer (NF-06).
- [x] **T-012 · Sectores provisionales + seed** (L) — dep: T-010
  `data/sectores-guaparo.geojson` provisional (Guaparo dividido en 3–4 sectores aproximados; dejarlo marcado como PROVISIONAL en `properties`). Script `db:seed` que valida `ST_IsValid` y el SRID, inserta los sectores y crea las filas de `estado_sector` (sector × servicio). Coordenadas de control en `apps/api/test/fixtures/puntos.ts`.
  *Nota (hecha):* cuadrícula de 2 × 2 sectores (Noroeste = 1, Noreste = 2, Suroeste = 3, Sureste = 4) con `"provisional": true` en el archivo y en cada `properties`; son coordenadas aproximadas, **no** los límites reales. La lógica está en `src/db/sembrar-sectores.ts` (`leerSectores` valida la forma sin base; `sembrarSectores` hace upsert por nombre en una transacción, rechaza geometrías inválidas y sectores solapados, y crea las 8 filas de `estado_sector`); `pnpm db:seed [ruta]` la corre. Los puntos de control (dentro, fuera, borde exterior, borde entre sectores, esquina común, lat/lng intercambiados) están en `test/fixtures/puntos.ts`. `pnpm db:migrate` ahora usa un migrador propio (`src/db/migrar.ts`, D-020).
- [x] **T-013 · Guard JWT** (L) — dep: T-003
  `jose.createRemoteJWKSet(<SUPABASE_URL>/auth/v1/.well-known/jwks.json, { cacheMaxAge: 600_000 })`, que verifica `issuer` (`<SUPABASE_URL>/auth/v1`) y `audience`. Guard global con `@Public()` y decorador `@ResidenteActual()` (`sub`). El *getter* de claves se inyecta para poder usar un JWKS local en los tests.
  *Tests:* un token válido pasa; uno vencido, con otra firma, con otro issuer o sin token → 401.
  *Nota (hecha):* módulo `src/auth/` (`JwtGuard` global, `@Public()`, `@ResidenteActual()`, `CLAVES_JWT` inyectable). Solo acepta `ES256` y `RS256` (un token HS256 se rechaza) y exige que el `sub` sea un UUID. Los tests (`test/auth.e2e-spec.ts`) cubren además otra audiencia, sin `sub`, HS256, basura en el encabezado y las rutas públicas; firman con un par ES256 local (`test/jwt.ts`, clase `EmisorJwt`). `SUPABASE_URL` pasa a ser obligatoria. Se usa `jose@^5` (D-021). `GET /salud` quedó con `@Public()`. **Pendiente de verificar en T-007:** que el JWKS real de staging devuelva claves asimétricas y que el `kid` de los tokens coincida.
- [ ] **T-014 · `GET /sectores`** (L) — dep: T-012
  Un FeatureCollection GeoJSON (`ST_AsGeoJSON`) con `Cache-Control: public, max-age=3600`.
- [x] **T-015 · Registro** (L) — dep: T-012, T-013
  `POST /registro/validar-pin` (público, con throttle estricto), `POST /residentes/me` y `GET /residentes/me`. Usa `ST_Covers` y el desempate por el menor `sector.id` (D-002). Un usuario autenticado sin perfil recibe 403 `REGISTRO_INCOMPLETO` en las rutas que lo requieren (un guard o interceptor reutilizable).
  *Tests:* REG-01, REG-02, REG-03 (borde exterior y borde entre sectores, siempre el mismo resultado), registrarse dos veces → 409, y lat/lng intercambiados (punto asimétrico).
  *Nota (hecha):* módulo `src/residentes/`. `RegistroGuard` (`@UseGuards`) + `@PerfilActual()` es la pieza reutilizable: 403 `REGISTRO_INCOMPLETO` sin perfil, y deja `{ id, sectorId, sectorNombre }` (nunca la ubicación) en la solicitud; **T-021 a T-023 lo usan** para sacar el `sector_id`. `POST /residentes/me` es atómico (`ON CONFLICT DO NOTHING`), así que dos registros simultáneos dan un 201 y un 409. `validar-pin` tiene throttle de 10/min por IP. Nueva variable `TRUST_PROXY` (1 en Render): sin ella el throttle vería la IP del proxy (D-022). Tests en `test/registro.e2e-spec.ts` (REG-01/02/03 y NF-06; REG-04 y REG-07 los resuelve Supabase Auth).
- [ ] **T-016 · Barrido de privacidad** (L) — dep: T-015
  Un e2e que llama a todos los endpoints con datos sembrados y verifica que ninguna respuesta contenga `ubicacion`, ni las coordenadas de los residentes de prueba (NF-06). Se amplía en cada fase.
- [ ] **F-001..F-012 · Front de la fase 1** (F) — scaffold Vite + PWA, Leaflet + pin + Turf (`booleanPointInPolygon` **sin** `ignoreBoundary`, que es coherente con D-002), y el flujo de registro de dos pasos (D-014). *Necesita de L:* T-014, T-015 y los tipos de `shared`.

## Fase 2 — Ciclo de reportes (S4–S5) → `v0.2.0`

- [ ] **T-020 · Validación de horas, pura** (L) — dep: T-003
  `reportes/tiempo.puro.ts`: no al futuro (+2 min de tolerancia), no más antiguo que `REPORTE_MAX_ANTIGUEDAD_DIAS`, `fin ≥ inicio`. Recibe `ahora` como parámetro (nada de `Date.now()` adentro).
  *Tests:* REP-07, OFF-03 (unitarios) y los valores límite (exactamente +2 min y exactamente 7 días).
- [ ] **T-021 · `PUT /reportes/:id` (inicio)** (L) — dep: T-010, T-015, T-020
  Upsert idempotente según §5 del plan; `sector_id` sale del residente. Se guarda `inicio_en = ocurridoEn` (nunca `now()`). Deja listo el punto de enganche del consenso (un *no-op* hasta T-032), dentro de la misma transacción.
  *Tests:* REP-01, REP-02, REP-05 (409 `REPORTE_ABIERTO_DUPLICADO`), REP-06, OFF-03 (se envía a las 12:00 con `ocurridoEn` 10:30 → se guarda 10:30), OFF-05 (el mismo PUT ×2 en paralelo → 1 fila, 2 respuestas 200) y el mismo id con otro payload → 409.
- [ ] **T-022 · `PATCH /reportes/:id/cierre`** (L) — dep: T-021
  Idempotente. Si el id es ajeno o no existe → 404 (D-003: un cierre sin inicio se bloquea). La duración se calcula y se devuelve.
  *Tests:* REP-03, REP-04, REP-07 (422), doble cierre igual → 200, doble cierre distinto → 409.
- [ ] **T-023 · `GET /reportes/mios`** (L) — dep: T-021
  Con el filtro `abiertos`. Solo devuelve los reportes del propio residente.
- [ ] **F-020..F-022 · Formularios de inicio y de restablecimiento** (F) — *necesita de L:* T-021, T-022 y los códigos de error de `shared`.

## Fase 3 — Consenso e historial (S6–S7) → `v0.3.0`

- [ ] **T-030 · `evaluarInicio`, pura** (L) — dep: T-002
  `consenso/consenso.puro.ts` según §6.1 del plan. Configura el `coverageThreshold` de `src/consenso/`.
  *Tests:* CON-01, CON-02, CON-03, CON-04, CON-05 (como entradas separadas), CON-07 (justo dentro y justo fuera de W) y el cálculo de la mediana del inicio del evento.
- [ ] **T-031 · `evaluarRestablecimiento`, pura** (L) — dep: T-030
  Según §6.2 del plan. *Tests:* CON-06, el cierre por "ya no quedan reportes abiertos", y N − 1 cierres que no cierran el evento.
- [ ] **T-032 · `ConsensoService`** (L) — dep: T-021, T-022, T-030, T-031
  Transacción + `pg_advisory_xact_lock` + crear o cerrar el evento + upsert de `estado_sector`, que solo escribe si hubo cambios. Reemplaza el *no-op* de T-021.
  *Tests (integración):* CON-02, CON-03 (4 PUT concurrentes → 1 evento), CON-05, CON-06, y `reportes_sin_confirmar` = 2 con N − 1 (CON-01).
- [ ] **T-033 · Cron de las ventanas** (L) — dep: T-032
  `@nestjs/schedule` cada minuto + el recálculo al leer si el estado quedó viejo (§6.3 del plan). *Test:* al vencer la ventana, `reportes_sin_confirmar` vuelve a 0 (CON-07); se usa un reloj inyectable.
- [ ] **T-034 · `GET /sectores/:id/historial`** (L) — dep: T-032
  Los eventos cerrados, paginados por cursor y filtrables por servicio.
- [ ] **T-035 · Humo de Realtime en staging** (L) — dep: T-011, T-032, T-007
  `scripts/probar-realtime.ts`: suscribirse a `estado_sector` con la clave anon, provocar el consenso por la API y ver llegar el cambio (mitad back de VIS-03). Confirma además que la clave anon **no** puede leer `reportes` (NF-06).
- [ ] **F-030..F-032 · Coropleta + Realtime + prueba de usabilidad** (F) — *necesita de L:* T-014, T-032 y T-035.

## Fase 4 — Offline (servidor) y estadística (S8–S9) → `v0.4.0`

- [ ] **T-040 · Contrato de sincronización** (L) — dep: T-022
  Implementar y probar la tabla de códigos de §5 del plan, y documentarla en Swagger.
  *Tests e2e:* OFF-04 (inicio y cierre enviados en orden, el ciclo queda completo), el cierre antes que el inicio → 404 y luego, tras el inicio, el cierre → 200, y OFF-05 con un corte simulado (la petición llega a la BD pero el cliente no recibe la respuesta, y reintenta).
- [ ] **T-041 · `estadistica.puro.ts`** (L) — dep: T-002
  `mediana`, `cuartiles` y `resumir(n_min)`. Configura el `coverageThreshold` de `src/estimacion/`.
  *Tests:* EST-01, EST-02, EST-03 (sin umbral), EST-04 (n = 0 y n = n_min − 1 → insuficiente; n = n_min → cifra).
- [ ] **T-042 · `GET /estimaciones`** (L) — dep: T-032, T-041
  SQL con `percentile_cont` sobre los eventos cerrados (D-008). *Tests (integración):* EST-05 (agua y luz separadas), EST-06 (se cierra un evento → la mediana cambia) y SQL ≡ TS en el mismo dataset.
- [ ] **T-043 · `GET /sectores/:id/resumen`** (L) — dep: T-042, T-034
  Estado por servicio, estimación (con el n) y los últimos 5 eventos (mitad back de VIS-04).
- [ ] **T-044 · Importar el dataset de campo** (L) — dep: T-010; *bloqueada por los datos de la campaña*
  Definir el CSV (`sector, tipo_servicio, inicio, fin`) y el script `db:seed:campo`, que valida las filas y las inserta como `eventos_sector` con `origen='campo'`. Las filas inválidas se informan y no se insertan.
- [ ] **F-040..F-043 · Cola Dexie, sync y dashboard de estimación** (F) — *necesita de L:* T-040, T-042 y T-043.

## Fase 5 — Refinamiento y pruebas (S10–S13) → `v0.9.0`

- [ ] **T-050 · Ciclos incompletos** (L) — dep: T-033
  El cron marca `vencido` los reportes abiertos hace más de `REPORTE_VENCE_HORAS` (D-015). Los vencidos no cuentan para el consenso ni para REP-05. Se revisan los eventos abiertos que se quedaron sin reportes vivos.
- [ ] **T-051 · Seguridad** (L)
  Throttle por ruta, límite de tamaño del body, CORS estricto, `pnpm audit`, `/security-review`, NF-06 completo (T-016 ampliado) y RLS contra staging con la clave anon.
- [ ] **T-052 · Cobertura y regresión** (L)
  Consenso y estimación en ≥ 70 % (esperado ≫ 70), cerrar los huecos y llevar el reporte de cobertura al CI como artefacto.
- [ ] **T-053 · Producción** (L, con confirmación de Leonardo)
  Proyecto Supabase de prod, migraciones, seed de sectores reales, API en Render (o Coolify), variables de entorno, health check, keep-alive y `docs/despliegue.md`.
- [ ] **T-054 · Apoyo a NF-04** (L)
  Un script que simula 10 min de red intermitente contra la API (reintentos aleatorios del mismo id): 0 duplicados y 0 pérdidas.
- [ ] **T-055 · Soporte en las pruebas de campo** (L) — corrección de defectos según la severidad del plan de pruebas.
- [ ] **F-050..F-054 · Filtro agua/luz, Playwright, Lighthouse, pruebas con residentes** (F)

## Fase 6 — Documentación y defensa (S14–S15) → `v1.0.0`

- [ ] **T-060 · Documentación técnica** (L)
  README (cómo correrlo), `docs/arquitectura.md` (diagrama + TGS ↔ módulos), OpenAPI exportado (`docs/openapi.json`) y `docs/trazabilidad.md`, generado por un script que busca los IDs en los tests.
- [ ] **T-061 · Preparar la demo** (L)
  Seed de demo (sectores con historial suficiente para mostrar "aprox. X h según n cortes"), checklist previo a la defensa (despausar Supabase, despertar Render, cuentas de demo) y un tag `v1.0.0`.
