# Plan de implementación — BlackoutTracker

> Documento vivo. Redactado el 7-oct-2026, a partir de `CLAUDE.md` y `docs/casos-de-prueba.md`.
> Lo complementan:
> - **`docs/TAREAS.md`**: la lista de tareas, el estado actual y el protocolo de trabajo de cada sesión.
> - **`docs/DECISIONES.md`**: el registro de decisiones (las tomadas y las propuestas pendientes de confirmar).
> - **`CHANGELOG.md`**: los cambios por versión.
>
> Si este plan y `CLAUDE.md` se contradicen, manda `CLAUDE.md`. Corrige el plan y anota la discrepancia en `DECISIONES.md`.

---

## 1. Punto de partida

- Repo `lpzzlnrd/BlackoutTracker`, rama principal **`main`** (antes `master`). Solo hay README, LICENSE, `CLAUDE.md` y `docs/`.
- Máquina de Leonardo: Windows 11, Node 22.20, pnpm 10.33, Docker 28 y `gh` autenticado.
- El stack es definitivo (`CLAUDE.md` §4). Este plan no lo discute; lo baja a archivos, tablas, endpoints y tareas.
- Alcance de este repo para las sesiones de Claude: **backend (`apps/api`), `packages/shared`, infraestructura del monorepo, base de datos y CI**. El frontend (`apps/web`) es de Freddy. Sus tareas aparecen en `TAREAS.md` solo como referencia de dependencias.

---

## 2. Arquitectura

```
 Residente (navegador móvil)
   │
   ▼
 apps/web  (React + Vite PWA)
   │  · Supabase Auth  ─────────────► Supabase Auth (emite el JWT)
   │  · Realtime (solo estado_sector) ◄── Supabase Realtime
   │  · Cola offline en Dexie (IndexedDB)
   │
   │  HTTPS + Bearer JWT
   ▼
 apps/api  (NestJS 11)
   · Guard global: verifica el JWT con jose + JWKS (caché ≤ 10 min)
   · Reportes → Consenso → estado_sector        (escribe)
   · Estimación (mediana) / historial / sectores (lee)
   · Cron (@nestjs/schedule): vence las ventanas y los ciclos incompletos
   │
   │  Drizzle (postgres-js), rol que se salta RLS
   ▼
 Postgres + PostGIS (Supabase)
   · RLS deny-all en todo, salvo SELECT de estado_sector
   · estado_sector publicado en supabase_realtime
```

**Lectura TGS** (útil para la defensa y para nombrar los módulos):

| TGS | Módulo / artefacto |
|---|---|
| Entrada | `reportes` (PUT inicio / PATCH cierre) |
| Proceso: validación | `residentes` (punto en polígono) y la validación de horas |
| Proceso: regulación (homeostasis) | `consenso` (N usuarios distintos dentro de la ventana) |
| Proceso: estadística | `estimacion` (mediana) |
| Salida | `estado_sector` (Realtime), `/estimaciones`, `/historial` |
| Retroalimentación | Cada evento cerrado entra al cálculo de la mediana (EST-06) |
| Isomorfismo | Una sola tabla y un solo algoritmo para `agua` y `electricidad` |

---

## 3. Estructura del monorepo

```
/
├─ package.json              scripts raíz: dev, build, lint, typecheck, test, test:int
├─ pnpm-workspace.yaml       apps/*, packages/*
├─ tsconfig.base.json
├─ eslint.config.mjs  .prettierrc  .editorconfig  .gitattributes (eol=lf)  .nvmrc (22)
├─ docker-compose.yml        postgis/postgis:16-3.4 para desarrollo y tests de integración
├─ .github/workflows/ci.yml
├─ data/
│  └─ sectores-guaparo.geojson   (provisional hasta tener el real; ver D-005)
├─ packages/shared/          tipos y enums sin dependencias de runtime
│  └─ src/  enums.ts · constantes.ts · dto.ts · errores.ts (códigos de error) · index.ts
├─ apps/api/
│  ├─ drizzle.config.ts
│  ├─ drizzle/               migraciones generadas + SQL a mano (RLS, realtime)
│  ├─ scripts/               seed-sectores.ts · seed-campo.ts · probar-realtime.ts
│  ├─ test/                  e2e/integración (Supertest + PostGIS en Docker)
│  └─ src/
│     ├─ main.ts  app.module.ts
│     ├─ config/             validación del .env
│     ├─ db/                 schema/*.ts, proveedor Drizzle, tipos geometry
│     ├─ auth/               guard JWKS, @Public(), @ResidenteActual()
│     ├─ comun/              filtro de errores (agrega `codigo`), pipes
│     ├─ salud/
│     ├─ sectores/
│     ├─ residentes/         registro y validación del pin
│     ├─ reportes/           incluye tiempo.puro.ts (validación de horas)
│     ├─ consenso/           consenso.puro.ts · consenso.service.ts · consenso.cron.ts
│     └─ estimacion/         estadistica.puro.ts · estimacion.service.ts · controller
└─ apps/web/                 (Freddy)
```

Convenciones:
- El **dominio va en español** (`reportes`, `inicioEn`, `tipoServicio`), sin tildes ni ñ en los identificadores. Los términos del framework quedan en inglés (`Controller`, `Module`).
- En la base de datos se usa `snake_case` (`tipo_servicio`, `inicio_en`). En TypeScript y JSON, `camelCase`.
- Los archivos `*.puro.ts` no importan Nest ni Drizzle: reciben datos y devuelven datos. Ahí vive la lógica que exige cobertura ≥ 70 %.
- `packages/shared` solo exporta tipos, enums y constantes. Los DTO con `class-validator` viven en `apps/api` e implementan las interfaces de `shared`. Así el front no arrastra `class-validator`.

---

## 4. Modelo de datos

Todas las horas son `timestamptz` en UTC. El front las muestra en `America/Caracas` (UTC−4, sin horario de verano). El SRID es 4326 en todas las geometrías.

```sql
-- enums
tipo_servicio   = ('agua', 'electricidad')
estado_servicio = ('con_servicio', 'sin_servicio')
origen_evento   = ('consenso', 'campo')        -- 'campo' = dataset semilla de las entrevistas

sectores (
  id          smallserial PK,
  nombre      text UNIQUE NOT NULL,
  geom        geometry(MultiPolygon, 4326) NOT NULL   -- índice GIST
)
-- "Guaparo" = la unión de los sectores. No hay una tabla aparte para el polígono exterior.

residentes (
  id          uuid PK,              -- = sub del JWT de Supabase
  sector_id   smallint FK NOT NULL,
  ubicacion   geometry(Point, 4326) NOT NULL,   -- NUNCA sale por la API (NF-06)
  creado_en   timestamptz DEFAULT now()
)

reportes (
  id            uuid PK,            -- generado en el cliente (idempotencia, OFF-05)
  residente_id  uuid FK NOT NULL,
  sector_id     smallint FK NOT NULL,           -- copia del sector del residente al crear
  tipo_servicio tipo_servicio NOT NULL,
  inicio_en     timestamptz NOT NULL,           -- hora real del evento (OFF-03)
  fin_en        timestamptz NULL,               -- nula hasta el cierre
  recibido_en   timestamptz DEFAULT now(),      -- cuándo llegó al servidor (auditoría offline)
  cerrado_recibido_en timestamptz NULL,
  vencido       boolean DEFAULT false,          -- ciclo incompleto (fase 5, D-015)
  CHECK (fin_en IS NULL OR fin_en >= inicio_en)                      -- REP-07
)
UNIQUE (residente_id, tipo_servicio) WHERE fin_en IS NULL AND NOT vencido   -- REP-05
INDEX (sector_id, tipo_servicio, inicio_en)

eventos_sector (                                -- el corte confirmado por consenso
  id              serial PK,
  sector_id       smallint FK NOT NULL,
  tipo_servicio   tipo_servicio NOT NULL,
  inicio_en       timestamptz NOT NULL,         -- mediana de las horas de los N reportes que confirmaron (D-007)
  fin_en          timestamptz NULL,
  confirmado_en   timestamptz NOT NULL,         -- cuándo se alcanzó el consenso
  restablecido_en timestamptz NULL,
  origen          origen_evento DEFAULT 'consenso',
  incompleto      boolean DEFAULT false,        -- sus reportes vencieron sin cierre: sin fin_en (T-050, D-024)
  CHECK (fin_en IS NULL OR fin_en >= inicio_en),
  CHECK (NOT incompleto OR fin_en IS NULL)
)
UNIQUE (sector_id, tipo_servicio) WHERE fin_en IS NULL AND NOT incompleto   -- a lo sumo 1 evento abierto (CON-03)

estado_sector (                                 -- lo único que el front lee directo (Realtime)
  sector_id               smallint FK,
  tipo_servicio           tipo_servicio,
  estado                  estado_servicio NOT NULL DEFAULT 'con_servicio',
  reportes_sin_confirmar  smallint NOT NULL DEFAULT 0,
  evento_id               int NULL FK,
  desde                   timestamptz NULL,
  actualizado_en          timestamptz DEFAULT now(),
  PRIMARY KEY (sector_id, tipo_servicio)
)
```

Notas:
- El **estado de sincronización** (`pendiente | enviado | error`) es un campo del modelo del **cliente** (Dexie). En el servidor todo lo que existe ya está sincronizado; el rastro offline queda en `recibido_en − inicio_en`. Ver D-011.
- `estado_sector` tiene una fila por sector y servicio, y se crea en el seed. No contiene ningún dato personal.
- **RLS:** `ENABLE ROW LEVEL SECURITY` en las cinco tablas, una sola política `SELECT` sobre `estado_sector` para `anon, authenticated` y `REVOKE ALL` de `anon, authenticated` en las demás (defensa en profundidad frente a la Data API de Supabase).
- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE estado_sector`, dentro de un bloque `DO` que verifica que la publicación exista, para que la migración también corra en el PostGIS local.

### PostGIS con Drizzle: los detalles que muerden
- Drizzle trae `geometry(..., { type: 'point', srid: 4326 })`. Para `MultiPolygon` hace falta un `customType`.
- En `drizzle.config.ts` va `extensionsFilters: ['postgis']`; si no, `drizzle-kit` intenta gestionar `spatial_ref_sys`.
- Supabase instala PostGIS en el esquema `extensions`, y la imagen de Docker lo hace en `public`. Para que el SQL sea el mismo en los dos, la primera migración hace `CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;`, y la conexión fija `search_path=public,extensions`. **Hay que verificarlo en la tarea T-005.**
- Orden de las coordenadas: `ST_MakePoint(lng, lat)`. Es el error clásico; tiene que haber un test con una coordenada asimétrica.
- Con el pooler de Supabase en modo *transaction* (puerto 6543), postgres-js necesita `prepare: false`. Se recomienda el modo *session* (5432) o la conexión directa.

---

## 5. API (prefijo `/api`, documentada en Swagger en `/api/docs`)

| Método y ruta | Auth | Qué hace | Casos |
|---|---|---|---|
| `GET /salud` | pública | Estado + ping a la BD (sirve también de keep-alive) | — |
| `GET /sectores` | pública | GeoJSON FeatureCollection de los sectores (`id`, `nombre`, geometría). Lleva `Cache-Control` | VIS-01 |
| `POST /registro/validar-pin` | pública + throttle | `{lat, lng}` → `{sectorId, sectorNombre}` o 422 `PIN_FUERA_DE_GUAPARO` | REG-01/02/03 |
| `POST /residentes/me` | JWT | Crea el perfil del residente con su pin. 409 si ya existe | REG-01/02 |
| `GET /residentes/me` | JWT | `{sectorId, sectorNombre}`. **Sin coordenadas** | NF-06 |
| `PUT /reportes/:id` | JWT | Inicio idempotente `{tipoServicio, ocurridoEn}` | REP-01/02/05/06, OFF-03/05 |
| `PATCH /reportes/:id/cierre` | JWT | Cierre idempotente `{ocurridoEn}` | REP-03/04/07, CON-06 |
| `GET /reportes/mios?abiertos=true` | JWT | Para que el cliente recupere su estado en otro dispositivo | — |
| `GET /estimaciones?sectorId&tipoServicio` | JWT | `{suficiente, medianaMin, n, q1Min?, q3Min?}` | EST-* |
| `GET /sectores/:id/resumen` | JWT | Estado por servicio + estimación + últimos eventos | VIS-04 |
| `GET /sectores/:id/historial?tipoServicio&cursor` | JWT | Eventos cerrados, paginados | Fase 3 |

**Registro en dos pasos** (D-014): el front llama a `validar-pin`, luego a `supabase.auth.signUp`, y por último a `POST /residentes/me`. Un usuario de Auth sin perfil recibe 403 `REGISTRO_INCOMPLETO` en los endpoints de reportes, y el front lo devuelve al paso del pin. REG-04 (correo repetido) y REG-07 (login) los resuelve Supabase Auth y se prueban en el front.

**Idempotencia** (OFF-05):
- `PUT /reportes/:id` con el mismo id y el mismo payload → 200 con el reporte existente. Con el mismo id y un payload distinto → 409 `REPORTE_CONFLICTO`.
- `PATCH .../cierre`: si ya está cerrado con el mismo `ocurridoEn` → 200. Con otro → 409.
- Ninguna de las dos operaciones crea efectos de consenso duplicados, porque el consenso se recalcula desde el estado (no suma deltas).

**Validación de horas** (`tiempo.puro.ts`, D-013):
- `ocurridoEn` no puede estar en el futuro (tolerancia de 2 min por desfase de reloj) ni ser más antiguo que 7 días.
- El cierre exige `fin ≥ inicio`. Si no se cumple → 422 `HORA_INVALIDA`. Nunca se corrige en silencio.

**Contrato para la cola offline del front:**

| Respuesta | Qué hace el cliente |
|---|---|
| 2xx | Éxito: lo saca de la cola |
| Red caída, 5xx, 429 | Reintenta (con backoff) |
| 404 en un cierre (el inicio aún no llega) | Reintenta |
| 400 / 409 / 422 | Error permanente: lo saca de la cola, lo marca `error` y avisa al usuario |
| 401 | Refresca la sesión y reintenta |

**Formato de error:** el estándar de Nest más un campo `codigo` (enum en `packages/shared/src/errores.ts`), para que el front muestre mensajes en español sin depender del texto.

---

## 6. Reglas de negocio, en concreto

### 6.1 Consenso de inicio (`evaluarInicio`, puro)
- **Entrada:** los reportes **abiertos y no vencidos** de un (sector, servicio): `{residenteId, inicioEn}[]`, más `N` y la ventana `W` del servicio.
- **Algoritmo:** se ordenan por `inicioEn` y se recorren con una ventana deslizante de ancho `W`. Si en alguna ventana hay ≥ N **residentes distintos** → `confirmado` (CON-04: se deduplica por residente; si uno tiene varios reportes, cuenta el más antiguo).
- **Salida:** `{confirmado, inicioEvento, sinConfirmar}`.
  - `inicioEvento` = la **mediana** de las horas de inicio de los N primeros residentes de la ventana ganadora (D-007: un reloj manipulado no la mueve).
  - `sinConfirmar` = la cantidad de residentes distintos en la ventana más reciente que termina ahora.
- Los sectores nunca se mezclan, porque la consulta ya filtra por sector (CON-05). Los reportes fuera de `W` no se suman (CON-07).

### 6.2 Consenso de restablecimiento (`evaluarRestablecimiento`, puro)
- **Entrada:** el evento abierto y los reportes del (sector, servicio) **cerrados** con `fin_en ≥ evento.inicio_en`.
- **Regla:** se cierra cuando hay ≥ N residentes distintos con `fin_en` dentro de una misma ventana `W`, **o** cuando ya no queda ningún reporte abierto en el sector y el servicio (todos los que reportaron dijeron que volvió). Esta segunda condición evita que un evento quede abierto para siempre cuando solo hubo N reportantes y cerraron en momentos distintos.
- `fin` del evento = la mediana de los `fin_en` que dispararon el cierre (CON-06).
- Si no queda ningún reporte vivo y **nadie** cerró (todos vencieron, D-015), el evento termina como `incompleto` y sin `fin`: no entra en la mediana (T-050, D-024).

### 6.3 Orquestación (`ConsensoService`)
Tras cada inicio o cierre, en la **misma transacción** que la escritura del reporte:
1. `pg_advisory_xact_lock(sector_id, enum_ordinal(tipo))`. Esto serializa los reportes concurrentes del mismo par y evita los eventos duplicados (CON-03). El índice único parcial es la segunda barrera.
2. Lee los reportes relevantes y llama a las funciones puras.
3. Crea o cierra el `eventos_sector` y hace upsert de `estado_sector`. Solo escribe si algo cambió, para no disparar Realtime de más.

**Cron** (cada minuto): recalcula `reportes_sin_confirmar` en los pares cuya ventana venció (CON-07 visible en el mapa). En la fase 5 también marca como `vencido` los reportes abiertos hace más de 48 h (D-015). Como Render gratis se duerme, el cron es *best effort*: las lecturas de `/resumen` también recalculan si `actualizado_en` es viejo.

### 6.4 Estimación
- **Universo:** los **eventos de sector cerrados** (`origen` consenso o campo) de un (sector, servicio), y no los reportes individuales (D-008): un corte reportado por 6 vecinos es **un** ciclo, no seis.
- **SQL** (en el repositorio, con el helper `sql`): `percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY extract(epoch FROM fin_en - inicio_en))` y `count(*)`.
- **Puro** (`estadistica.puro.ts`):
  - `mediana(xs)`: el par promedia los dos centrales (EST-01/02/03, **sin** umbral).
  - `resumir({n, mediana, q1, q3}, nMin)`: si `n < nMin` → `{suficiente: false, n}` (EST-04). Si no, la cifra **junto con su n**.
  - `bootstrapIC` es opcional (fase 5, solo si sobra tiempo).
- Un test de integración verifica que la mediana del SQL y la de TS coinciden sobre el mismo dataset.
- La mediana se recalcula en cada consulta: no hay caché, así que EST-06 se cumple solo.
- **Terminología:** "estimación", nunca "predicción", ni en el código, ni en Swagger, ni en los mensajes.

---

## 7. Configuración (`apps/api/.env.example`)

```
DATABASE_URL=postgres://postgres:postgres@localhost:5433/blackout     # local (docker)
SUPABASE_URL=https://<ref>.supabase.co                               # para el JWKS y el issuer
JWT_AUDIENCE=authenticated
CORS_ORIGINS=http://localhost:5173
CONSENSO_N=3
CONSENSO_VENTANA_MIN_ELECTRICIDAD=30
CONSENSO_VENTANA_MIN_AGUA=180
ESTIMACION_N_MIN=5
REPORTE_MAX_ANTIGUEDAD_DIAS=7
REPORTE_VENCE_HORAS=48
PORT=3000
```

Se valida al arrancar: si falta una variable o su valor no sirve, Nest no levanta. El `.env` real nunca se sube al repo.

---

## 8. Estrategia de pruebas

| Capa | Herramienta | Dónde | Qué cubre |
|---|---|---|---|
| Unitarias puras | Jest | `src/**/*.puro.spec.ts` | CON-01..07, EST-01..05, REP-07, OFF-03 (reglas de hora) |
| Unitarias de servicio | Jest + dobles | `src/**/*.service.spec.ts` | Orquestación sin BD |
| Integración / e2e | Jest + Supertest + PostGIS en Docker | `apps/api/test/*.e2e-spec.ts` | REG-01..03, REP-01..07, CON-02/03/05/06, OFF-03/04/05, EST-05/06, NF-06, RLS |
| Humo en staging | Scripts | `apps/api/scripts/` | JWKS real, Realtime real (VIS-03, mitad back), RLS con la clave anon |

- **Trazabilidad:** cada test empieza con su ID: `it('CON-04: el mismo usuario ×3 cuenta como 1', ...)`. En la fase 6, un script genera `docs/trazabilidad.md` con el mapa ID → archivo.
- **Cobertura:** `coverageThreshold` de Jest por ruta (`src/consenso/`, `src/estimacion/`) en ≥ 70 % de líneas y ramas, desde la tarea en que se crean. Si baja, falla el CI.
- **JWT en los tests:** se genera un par de claves con `jose` en el setup y se inyecta un `JWKS` local (el guard recibe el *getter* de claves por DI). Nunca se usa el Supabase real en el CI.
- **BD de los tests:** `docker compose up -d db` y una base `blackout_test` que se migra y se limpia (`TRUNCATE`) en cada suite. En el CI se usa un *service container* de `postgis/postgis`.
- **Fixtures geográficas:** coordenadas de control dentro, fuera, sobre el borde exterior y sobre el borde entre dos sectores.

---

## 9. Fases, hitos y versiones

Se asume **S1 = semana del 5-oct-2026**. Hay que ajustarlo si el calendario de la UJAP es otro (ojo con el receso de diciembre).

| Fase | Semanas | Fechas aprox. | Hito de backend | Versión |
|---|---|---|---|---|
| 0. Fundaciones | S1 | 5–9 oct | Monorepo, CI en verde, PostGIS local, Supabase staging creado | `v0.0.1` |
| 1. Diseño y registro | S1–S3 | hasta 23 oct | Esquema + RLS + auth + registro con punto en polígono | `v0.1.0` |
| 2. Ciclo de reportes | S4–S5 | 26 oct – 6 nov | Inicio y cierre idempotentes con validación de horas | `v0.2.0` |
| 3. Consenso e historial | S6–S7 | 9–20 nov | `estado_sector` por consenso + Realtime + historial | `v0.3.0` |
| 4. Offline y estadística | S8–S9 | 23 nov – 4 dic | Contrato de sync probado + estimación + dataset de campo | `v0.4.0` |
| 5. Refinamiento | S10–S13 | 7 dic – 1 ene | Ciclos incompletos, seguridad, despliegue, pruebas | `v0.9.0` |
| 6. Documentación y defensa | S14–S15 | 4–15 ene 2027 | Docs técnicas, trazabilidad, datos de demo | `v1.0.0` |

Al cerrar cada fase: se crea un tag `vX.Y.Z` en `main`, se mueve `[Sin publicar]` del CHANGELOG a la versión nueva y se actualiza la sección "Estado" de `TAREAS.md`.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El GeoJSON de Guaparo y los sectores aún no existen (D-005) | Polígono provisional en `data/`. Todo el código lee los sectores de la BD; cambiarlos es solo cambiar el seed |
| Supabase gratis se pausa tras ~7 días sin uso | `GET /salud` toca la BD; un ping externo gratuito (p. ej. UptimeRobot) al API de prod. Checklist antes de las pruebas de campo y la defensa (T-061) |
| Render gratis se duerme (arranque en frío ≈ 30–60 s, cron detenido) | Cron *best effort* + recálculo al leer; la cola offline del front absorbe la latencia; despertar el API antes de la demo |
| El proyecto de Supabase usa una clave JWT simétrica (HS256) | T-007 verifica que las *JWT signing keys* asimétricas estén activas; si no, se migran antes de T-013 |
| PostGIS en esquemas distintos (local vs. Supabase) | Esquema `extensions` en los dos + `search_path` (§4) |
| Condiciones de carrera en el consenso | Advisory lock por par + índice único parcial + test concurrente |
| Pocos datos reales para la estimación | Dataset de campo como `origen='campo'`; la UI muestra el n y "datos insuficientes" |
| Cuentas falsas (Sybil) | Fuera de alcance. Se documenta como limitación |
