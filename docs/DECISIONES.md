# Registro de decisiones — BlackoutTracker

> Una entrada por decisión. Estados posibles: **Decidida** · **Propuesta** (se puede avanzar con ella, pero Leonardo debe confirmarla) · **Pendiente** (falta información) · **Reemplazada por D-0XX**.
> Las sesiones agregan aquí lo que decidan y no esté en el plan. Las entradas no se borran: si algo cambia, se marca como reemplazada.

---

### D-001 · Stack definitivo — **Decidida** (7-oct-2026)
Es el de `CLAUDE.md` §4: monorepo pnpm, NestJS 11 + Drizzle, React + Vite PWA, Supabase (Postgres + PostGIS, Auth y Realtime). No se reabre.

### D-002 · Pin sobre el borde (REG-03) — **Propuesta**
**Decisión:** se **acepta**. El servidor usa `ST_Covers(sector.geom, punto)`, que incluye el borde. Si el pin cae justo en el límite entre dos sectores, se asigna al de **menor `id`**. En el cliente, Turf `booleanPointInPolygon` con su valor por defecto (que también incluye el borde).
**Por qué:** `ST_Contains` rechazaría a quien ponga el pin sobre la línea que separa dos sectores internos, aunque esté dentro de Guaparo. Con `ST_Covers` y un desempate fijo, la regla siempre da el mismo resultado, que es lo que exige REG-03.
**Nota:** `CLAUDE.md` menciona `ST_Contains`. Si se confirma esta decisión, hay que actualizar esa línea.

### D-003 · Cierre sin inicio previo (REP-04) — **Propuesta**
**Decisión:** se **bloquea**. El front solo muestra "volvió" si hay un reporte abierto, y la API responde 404 a un cierre de un id inexistente.
**Por qué:** guardarlo como "aviso sin duración" obliga a tener filas con `inicio_en` nulo, lo que rompe el modelo y la mediana. Para la cola offline, ese 404 se puede reintentar (el inicio todavía puede estar en camino).

### D-004 · Ventana de consenso (CON-07) — **Propuesta**
**Decisión:** una ventana **distinta por servicio y configurable**: electricidad **30 min**, agua **180 min**.
**Por qué:** un apagón lo nota todo el mundo al mismo instante. La falta de agua, en cambio, se nota cuando se vacía el tanque o se abre el grifo, y eso puede ser horas después. Una sola ventana sería demasiado estricta para el agua o demasiado laxa para la luz. Además, la ventana se mide sobre la **hora del evento** (`inicio_en`), no sobre la hora de llegada, así que no la afecta la sincronización offline.

### D-005 · Sectores de Guaparo y su GeoJSON — **Pendiente** (Leonardo + Freddy)
Mientras tanto se usa un GeoJSON **provisional** (3–4 sectores aproximados) en `data/`. Criterio sugerido para el real: dividir por calles o avenidas (no en cuadrícula), con sectores que tengan residentes suficientes para llegar a N = 3. Cambiarlo solo requiere volver a correr el seed; el código no depende de los sectores concretos.

### D-006 · N y n_min configurables — **Decidida** (recomendación de `CLAUDE.md`)
Se configuran con variables de entorno (`CONSENSO_N=3`, `ESTIMACION_N_MIN=5`), y las funciones puras los reciben como parámetro.

### D-007 · Hora de inicio y de fin de un evento de sector — **Propuesta**
**Decisión:** es la **mediana** de las horas de los N reportes que dispararon el consenso.
**Por qué:** es coherente con el argumento de robustez del proyecto: un reloj manipulado o un vecino que reporta tarde no mueven la hora del evento. Con N = 3, corresponde al segundo valor.

### D-008 · Universo de la estimación — **Propuesta**
**Decisión:** la mediana se calcula sobre los **eventos de sector cerrados** (los confirmados por consenso más el dataset de campo), no sobre los reportes individuales.
**Por qué:** un corte reportado por 6 vecinos es un solo ciclo. Usar los reportes daría más peso a los sectores con más usuarios activos y contaría el mismo corte varias veces. La fórmula T̂(s,v) de `CLAUDE.md` se mantiene; solo se precisa que *i* recorre los eventos y no los reportes.

### D-009 · El consenso de inicio solo mira los reportes abiertos — **Propuesta**
Un reporte que llega ya cerrado (con inicio y fin enviados offline) cuenta para el restablecimiento de un evento abierto, pero **no** crea eventos históricos retroactivos. Es una limitación aceptada del MVP para no complicar el algoritmo.

### D-010 · Concurrencia en el consenso — **Decidida**
Cada evaluación toma `pg_advisory_xact_lock` por (sector, servicio) dentro de la transacción del reporte. Como segunda barrera, hay un índice único parcial para un solo evento abierto por par.

### D-011 · Estado de sincronización — **Decidida**
El campo `pendiente | enviado | error` vive en el modelo del cliente (Dexie). El servidor guarda `recibido_en` (y `cerrado_recibido_en`) para auditar los envíos diferidos.

### D-012 · Base de datos de los tests — **Decidida**
Los tests de integración corren contra PostGIS en Docker (en local y como *service container* en el CI). El Supabase de staging se usa solo para las pruebas de humo (JWKS, Realtime, RLS con la clave anon).

### D-013 · Límites de la hora del evento — **Propuesta**
Se aceptan horas hasta **2 min en el futuro** (por el desfase de los relojes) y hasta **7 días en el pasado** (una cola offline larga). Fuera de eso → 422. Nunca se corrige en silencio.

### D-014 · Registro en dos pasos — **Decidida**
Primero `validar-pin` (público), después `signUp` en Supabase y por último `POST /residentes/me`. Nest no crea usuarios de Auth ni usa la *service role key* para eso.

### D-015 · Vencimiento de los reportes abiertos — **Propuesta** (fase 5)
Un reporte abierto hace más de **48 h** se marca `vencido`: deja de contar para el consenso y libera la restricción de REP-05. Valor configurable.

### D-016 · TypeScript 5.9 fijado con un catálogo de pnpm — **Propuesta**
**Decisión:** TypeScript se fija en `~5.9.3` en el `catalog` de `pnpm-workspace.yaml` y cada paquete lo declara como `"typescript": "catalog:"`. No se usa la 7.x.
**Por qué:** la versión `latest` de npm es la 7.0.2, y `typescript-eslint` (acepta TypeScript < 6.1) y `ts-jest` (T-003, < 7) todavía no la soportan. Con el catálogo, subir de versión es cambiar una línea para toda la raíz, `shared` y `api`.
**Nota:** solo TypeScript va en el catálogo. Se probaron `catalogMode: strict` y `prefer`, y los dos mandan **cada** dependencia nueva al catálogo y reescriben `pnpm-workspace.yaml` en cada `pnpm add`: no compensa en un proyecto de dos personas. Con el modo por defecto, un `pnpm add -D typescript` a secas escribe `catalog:`; solo pedir otra versión de forma explícita (`typescript@7`) se sale del pin, y eso sería a propósito.
**Relacionada:** pnpm 10 no corre los scripts de instalación de las dependencias. El de `esbuild` (que usa `tsup`) solo cambia su shim por el binario nativo, así que se ignora de forma explícita (`ignoredBuiltDependencies`) y la instalación no ejecuta código de terceros.

### D-017 · Paquetes `@blackout/*` y compilación dual de `shared` — **Propuesta**
**Decisión:** los paquetes del monorepo llevan el alcance `@blackout/` (`@blackout/shared` y, después, `@blackout/api` y `@blackout/web`); `pnpm --filter api` sigue funcionando como atajo. `shared` se compila con `tsup` a ESM y CJS con sus tipos (`index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`) y se consume desde `dist/` a través del mapa `exports`.
**Por qué:** Nest compila a CJS y Vite consume ESM; con un solo formato, uno de los dos tendría que transpilar al otro. El alcance evita choques de nombre con paquetes de npm (`shared`, `api`). Se descartó exportar el `.ts` sin compilar para que cada consumidor use el paquete como una dependencia más, sin configuración extra.
**Consecuencia:** quien importe `@blackout/shared` necesita `dist/` compilado: `pnpm build` antes del primer `typecheck`, o `pnpm dev`, que lo deja en modo watch. T-003 y T-006 lo cablean en `apps/api` y en el CI.

### D-018 · Enums como objetos constantes y conjunto de `CodigoError` — **Propuesta**
**Decisión:** (1) los enums del dominio (`TipoServicio`, `EstadoServicio`, `OrigenEvento`) son objetos `as const` con un tipo del mismo nombre y una tupla de valores (`TIPOS_SERVICIO`…), no `enum` de TypeScript. (2) `CodigoError` tiene 12 códigos: los 4 que nombra `PLAN.md` §5, `REPORTE_ABIERTO_DUPLICADO` (de `TAREAS.md`) y 7 nuevos que dan nombre a estados HTTP que el plan menciona sin nombre: `DATOS_INVALIDOS` (400), `NO_AUTENTICADO` (401), `SECTOR_NO_ENCONTRADO` y `REPORTE_NO_ENCONTRADO` (404), `RESIDENTE_YA_REGISTRADO` (409), `DEMASIADAS_SOLICITUDES` (429) y `ERROR_INTERNO` (500). (3) `shared` también exporta `EstadoSectorFila`, la fila de `estado_sector` tal como la lee el frontend de Supabase, con sus columnas en `snake_case`.
**Por qué:** (1) un `enum` de TypeScript genera código en runtime y se lleva mal con `isolatedModules`; el objeto `as const` se importa igual desde Nest y desde Vite, y la tupla es lo que piden `pgEnum` de Drizzle y `@IsIn` de class-validator. Un test comprueba que objeto y tupla coinciden y que el orden es el de los enums de Postgres, del que depende el bloqueo por sector (`PLAN.md` §6.3). (2) El frontend necesita un código por caso para mostrar el texto en español sin depender del mensaje del servidor. (3) Es lo único que el frontend lee sin pasar por la API.
**Nota:** los DTO de `shared` siguen `PLAN.md` §4 y §5 y **no incluyen** las peticiones P1 a P4 del frontend (`docs/frontend/datos.md` §3) mientras no se decidan.
