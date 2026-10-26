# BlackoutTracker

Plataforma web comunitaria (PWA) para **monitorear de forma colaborativa las interrupciones de agua potable y electricidad**. Piloto: Urbanización Guaparo, Valencia, estado Carabobo (Venezuela).

Proyecto de la cátedra **Sistemas de Información** (Escuela de Computación, UJAP, 2026). Equipo: Leonardo Correa (backend e integración) y Freddy Parra (frontend y pruebas).

## Qué hace

Hoy los vecinos se avisan por WhatsApp ("se fue", "volvió"). BlackoutTracker estructura y valida esa información:

- Cada residente se registra **una vez** con un pin sobre su vivienda; el servidor lo asocia a su **sector** (punto en polígono con PostGIS).
- Reporta el **inicio** y el **restablecimiento** de un corte de agua o de luz. Funciona **sin conexión**: el reporte espera en una cola local y se envía al volver la red, con la hora real del evento.
- El estado de un sector cambia solo cuando **N = 3 residentes distintos** del mismo sector coinciden dentro de una ventana de tiempo (**consenso**, sin administrador).
- La duración típica de un corte se calcula con la **mediana** de los ciclos cerrados (estimación estadística), siempre junto con el número de cortes en que se basa.
- Nadie ve la ubicación de otro residente: la API solo devuelve datos agregados por sector.

El diseño completo está en [`docs/arquitectura.md`](docs/arquitectura.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend (`apps/web`) | React + Vite + TypeScript, PWA con `vite-plugin-pwa`, react-leaflet + OpenStreetMap, Turf.js, Dexie (IndexedDB), TanStack Query, Tailwind |
| API (`apps/api`) | NestJS 11 sobre Node 22, Drizzle ORM (postgres-js), class-validator, `jose` (JWT de Supabase), `@nestjs/schedule`, Swagger, Helmet, Throttler |
| Base de datos | Postgres + PostGIS en Supabase (en local, `postgis/postgis:16-3.4` en Docker) |
| Auth y tiempo real | Supabase Auth (desde el front) y Supabase Realtime sobre la tabla `estado_sector` |
| Tipos comunes (`packages/shared`) | Enums, DTO, códigos de error y el contrato de la cola offline |
| Pruebas | Jest + Supertest (API), Vitest y Playwright (web), `node:test` (shared y scripts) |

Todo es open source o de nivel gratuito.

## Requisitos

- **Node 22** (`.nvmrc`).
- **pnpm 10.33.2**: la versión está fijada en `packageManager`; con `corepack enable` se usa la correcta.
- **Docker**, para el PostGIS local y los tests de integración.

## Cómo correrlo en local

```bash
pnpm install
pnpm build                      # compila packages/shared (la API y la web lo consumen desde dist/)

pnpm db:up                      # PostGIS en el puerto 5433, con las bases blackout y blackout_test
cp apps/api/.env.example apps/api/.env   # y completar SUPABASE_URL
pnpm db:migrate                 # aplica las migraciones de apps/api/drizzle/
pnpm db:seed                    # sectores (data/sectores-guaparo.geojson) y filas de estado_sector
pnpm db:seed:campo data/campo.ejemplo.csv   # opcional: ciclos históricos (CSV de campo, docs/dataset-campo.md)

pnpm dev                        # API en http://localhost:3000/api (Swagger en /api/docs) y la web
```

Las variables de la API están todas en `apps/api/.env.example`: `DATABASE_URL`, `SUPABASE_URL` (de ahí salen el JWKS y el emisor del JWT), `JWT_AUDIENCE`, `CORS_ORIGINS`, `TRUST_PROXY`, `CONSENSO_N`, `CONSENSO_VENTANA_MIN_ELECTRICIDAD`, `CONSENSO_VENTANA_MIN_AGUA`, `ESTIMACION_N_MIN`, `REPORTE_MAX_ANTIGUEDAD_DIAS`, `REPORTE_VENCE_HORAS`, `CRON_ACTIVO` y `PORT`. Si falta una obligatoria o un valor no sirve, la API no arranca.

> El GeoJSON de `data/` es **provisional** (D-005): sectores aproximados mientras no exista la división real de Guaparo. Cambiarlo es volver a correr `pnpm db:seed` con el archivo nuevo; el código no depende de los sectores concretos.

## Pruebas

```bash
pnpm lint          # ESLint + Prettier
pnpm typecheck
pnpm test          # unitarias (Jest en la API, node:test en shared y scripts, Vitest en la web)
pnpm test:int      # integración y e2e de la API contra PostGIS (base blackout_test; necesita pnpm db:up)
```

Cada test lleva en su nombre el ID del caso del plan de pruebas (`REG-01`, `CON-04`, `EST-02`…). Los módulos de consenso y de estimación exigen una cobertura ≥ 70 % (`coverageThreshold` de Jest). Los tests nunca usan el Supabase real: el JWT se firma con un par de claves generado en el setup. El CI (`.github/workflows/ci.yml`) corre lo mismo en cada PR.

`test:int` incluye una corrida corta (≈25 s, `RED_DURACION_S`) de la simulación de red intermitente de NF-04: un proxy que corta las peticiones al azar, incluso después de que la API guardó, y comprueba 0 pérdidas y 0 duplicados. La versión de 10 min contra una API real es `pnpm --filter api red:intermitente` (instrucciones en `apps/api/scripts/red-intermitente/index.ts`).

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Componentes, módulos de la API, flujo de un reporte, privacidad, modo sin conexión y lectura desde la TGS |
| [`docs/openapi.json`](docs/openapi.json) | Contrato de la API (OpenAPI 3). Se regenera con `pnpm docs:openapi`; en vivo, en `/api/docs` |
| [`docs/trazabilidad.md`](docs/trazabilidad.md) | Casos de prueba ↔ tests. Se regenera con `pnpm docs:trazabilidad` |
| [`docs/PLAN.md`](docs/PLAN.md) | Modelo de datos, API, algoritmos y estrategia de pruebas |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Registro de decisiones de diseño |
| [`docs/casos-de-prueba.md`](docs/casos-de-prueba.md) | Plan de pruebas (ISO/IEC/IEEE 29119-3) resumido |
| [`docs/TAREAS.md`](docs/TAREAS.md) | Avance por tareas y protocolo de trabajo |
| [`docs/frontend/`](docs/frontend/) | Canon del diseño de la PWA |
| [`CHANGELOG.md`](CHANGELOG.md) | Cambios por versión |

## Estructura del monorepo

```
apps/api/          API REST (NestJS 11 + Drizzle)
  drizzle/         migraciones (generadas por drizzle-kit y SQL a mano: RLS y Realtime)
  scripts/         migrar, seed de sectores, exportar OpenAPI
  src/             un módulo por responsabilidad (ver docs/arquitectura.md)
  test/            integración y e2e (Supertest + PostGIS)
apps/web/          PWA (React + Vite)
packages/shared/   tipos, enums y constantes comunes
data/              GeoJSON de los sectores
docker/            inicialización del PostGIS local
docs/              documentación
scripts/           herramientas del repo (trazabilidad)
```

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
