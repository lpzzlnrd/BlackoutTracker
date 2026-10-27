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

### D-005 · Sectores de Guaparo y su GeoJSON — **En uso un borrador, falta validarlo con los vecinos** (ver D-036)
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

### D-019 · Esqueleto de la API: `.env`, errores y módulos CJS — **Propuesta**
**Decisión:** (1) El `.env` se valida con una clase `Env` de class-validator (la misma librería de los DTO) y no con Joi o Zod; los valores numéricos por defecto vienen de `@blackout/shared`. (2) El filtro de errores usa el `codigo` de `ErrorNegocio` y, para excepciones de Nest sin código, `DATOS_INVALIDOS` (4xx) o `ERROR_INTERNO` (5xx); un error no controlado nunca filtra su detalle. (3) `apps/api` compila a CJS con `module: nodenext`, que resuelve `@blackout/shared` por la condición `require` (`index.cjs`).
**Por qué:** (1) no agrega una dependencia más. (2) el front siempre recibe un código del enum, sin casos sueltos. (3) es lo que D-017 preveía para Nest.

### D-020 · Las migraciones se aplican con nuestro migrador, no con `drizzle-kit migrate` — **Propuesta**
**Decisión:** `pnpm db:migrate` y el `globalSetup` de los tests usan `migrar()` (`src/db/migrar.ts`), que conecta con `search_path=public,extensions`. `drizzle-kit` solo se usa para `generate` y `studio`.
**Por qué:** `drizzle-kit migrate` abre su propia conexión sin ese `search_path`; con PostGIS en el esquema `extensions` (Supabase, y el local tras la migración 0000) el tipo `geometry` no se resuelve y la migración 0001 falla. Con un solo migrador, local, tests y Supabase corren exactamente el mismo SQL.

### D-021 · `jose` 5.x y solo algoritmos asimétricos — **Propuesta**
**Decisión:** la API usa `jose@^5` (no la 6) y el guard acepta únicamente `ES256` y `RS256`.
**Por qué:** `jose` 6 es solo ESM y no corre bajo Jest en CJS; la 5.10 trae las dos versiones y sigue vigente. Limitar los algoritmos evita la confusión de algoritmo (un token HS256 firmado con la clave pública como secreto) y es coherente con `CLAUDE.md` §4 (claves asimétricas). Si el proyecto de Supabase usara HS256, T-007 lo detecta antes de llegar aquí.

### D-022 · `TRUST_PROXY` y 403 en `GET /residentes/me` sin perfil — **Propuesta**
**Decisión:** (1) `TRUST_PROXY` (número de proxies de confianza, 0 por defecto, 1 en Render) controla `trust proxy` de Express. (2) `GET /residentes/me` de un usuario de Auth sin perfil responde 403 `REGISTRO_INCOMPLETO`, igual que el resto de rutas que exigen perfil, y no 404.
**Por qué:** (1) detrás del proxy de Render todas las peticiones llegan con la IP del proxy: sin esto el throttle de `validar-pin` bloquearía a todos a la vez o a nadie. (2) es la señal que el front ya espera para devolver al residente al paso del pin (D-014).

### D-023 · Frontend con puertos y adaptadores, y la demo como un adaptador más — **Propuesta**
**Decisión:** `apps/web` separa una **capa pura** (`dominio/`, `aplicacion/`, `utils/`, `datos/puertos/` y `datos/adaptadores/mock/`), que no importa React, Dexie, TanStack, Supabase ni Workbox, de los **adaptadores reales** (`http/`, `dexie/`, `supabase/`, `navegador/`) y de la interfaz. La app recibe un objeto `Puertos` (12 interfaces: reloj, conexión, sonda de salud, configuración, sesión, y un puerto por recurso de la API, `estado_sector` y la cola) armado en un solo lugar, `datos/componer.ts`. Cada puerto tiene su `*.mock.ts`, y `?demo=en-linea|sin-conexion` (CANON §11) elige los mocks. ESLint (`no-restricted-imports`) hace cumplir la frontera. Los tokens de estilo se importan de `docs/frontend/tokens/` sin copiarlos.
**Por qué:** el modo demo es obligatorio para la prueba de fidelidad y para trabajar sin backend; con puertos es un conjunto de adaptadores y no `if (demo)` repartidos por la app. Los casos de uso (`sincronizarCola`, `vigilarConexion`) y las reglas de la API reproducidas en los mocks (REP-05/06/07, OFF-03/05, REG-02) se prueban en Node, sin red. Una suite de contrato (`datos/contratos/`) corre contra el mock y contra Dexie para comprobar que son intercambiables.
**Consecuencias:** (1) `AvisoCola` lleva `reporteId` además de `id`: un inicio y su cierre pendientes a la vez no pueden compartir la clave de la cola. (2) En los mocks las lecturas funcionan sin red (las sirve la caché del service worker, PWA.md §4) y solo las escrituras fallan. (3) Elegida la propuesta A (tokens, fuente del sistema, manifest `#f8fafc`). (4) Pendiente: iconos PNG de la PWA (`pwa-192`, `pwa-512`, `pwa-maskable-512`, `apple-touch-icon`), que salen del SVG con una herramienta; el manifest ya los referencia.
### D-024 · Ciclos incompletos: el evento termina sin hora de fin — **Propuesta** (T-050)
**Decisión:** si todos los reportes de un evento abierto vencen (D-015) sin que nadie haya reportado el regreso, el evento se marca `incompleto` (columna nueva de `eventos_sector`), con `restablecido_en` = la hora en que se detectó y **`fin_en` nulo**. Deja de contar como evento abierto (sale del único parcial) y `estado_sector` vuelve a `con_servicio` con `desde` nulo. Si al menos un residente cerró, se aplica la regla de "ya no quedan reportes abiertos" (PLAN §6.2) con los cierres que hay. Un cierre que llega tarde a un reporte vencido se guarda en el reporte, pero no reabre ni cambia el evento.
**Por qué:** inventar un fin (la hora del vencimiento, la del último reporte) metería en la mediana una duración que nadie observó, justo lo que la estimación quiere evitar; con `fin_en` nulo, la consulta de EST (eventos con fin) lo excluye sin filtros extra. Dejarlo abierto era peor: el próximo corte del mismo sector se sumaría a este y su cierre daría una duración de días.
**Consecuencia:** el historial (T-034) ya solo lista eventos con fin, y el resumen (T-043) excluye los incompletos de sus últimos eventos para que no parezcan un corte en curso; siguen en la base para auditoría y para T-052.
**Alternativa descartada:** borrar el evento (se pierde que hubo un corte confirmado) o darle `fin_en` y filtrar `NOT incompleto` en cada consulta de la estimación (fácil de olvidar).

### D-025 · Importación del dataset de campo: idempotencia y solapes — **Propuesta**
**Decisión:** (1) `db:seed:campo` reconoce una fila ya cargada por (sector, servicio, inicio, fin) entre los eventos de `origen='campo'` y no la vuelve a insertar; no se agrega una restricción única ni una migración. (2) Una fila que se solapa con otro evento del mismo sector y servicio (del archivo o ya guardado, de campo o de consenso, incluso uno abierto) se rechaza. (3) Las horas exigen zona horaria y solo se cargan ciclos completos con `fin > inicio` (una duración cero no es un corte). (4) En un evento de campo, `confirmado_en = inicio` y `restablecido_en = fin`. (5) Las filas inválidas no detienen la carga de las válidas, pero el script sale con código 1.
**Por qué:** (1) el script se corre a mano y en una transacción con la tabla bloqueada contra escrituras, así que basta con comprobarlo antes de insertar; una restricción única obligaría a una migración que choca con la numeración de otras ramas (T-011 usa la 0002). Permite volver a correrlo con el CSV ampliado. (2) un sector no puede tener dos cortes del mismo servicio a la vez; un solape casi siempre es una fila mal transcrita y contaría dos veces en la mediana. (3) sin zona, una hora de Venezuela se leería como UTC y movería el ciclo 4 h; un ciclo abierto no entra a la mediana (EST) y chocaría con el evento abierto del consenso. (4) no hubo consenso: la hora del corte es la mejor aproximación. (5) una transcripción con pocos errores no debe bloquear el resto, pero el error tiene que verse.

### D-026 · Documentación generada: OpenAPI y trazabilidad versionadas — **Propuesta**
**Decisión:** (1) `docs/openapi.json` y `docs/trazabilidad.md` se generan con scripts (`pnpm docs:openapi`, `pnpm docs:trazabilidad`) y **se versionan**; se regeneran al integrar los PR que cambien rutas, DTO o tests, y no llevan fecha, así que regenerarlos sin cambios no deja diff. `docs/openapi.json` va en `.prettierignore`. (2) El OpenAPI sale de la misma configuración de Swagger que sirve `/api/docs`: `configurarApp` devuelve el documento y el script crea la app sin `init()` ni puerto, con variables de relleno, sin conectarse a la base. (3) El generador de trazabilidad es un script de la raíz (`scripts/trazabilidad.mjs`, sin dependencias) y sus tests corren con `node --test` dentro de `pnpm test`; solo cuenta los IDs que aparecen en los **nombres** de los tests (`it`, `test`, `describe`), no en comentarios.
**Por qué:** (1) el tribunal y Freddy pueden leer el contrato y la trazabilidad sin levantar nada. (2) un solo origen para el documento evita que el exportado y el servido diverjan, y así corre en el CI sin base. (3) recorre `apps/` y `packages/` (no es de la API) y con `pnpm -r` los scripts de la raíz no corrían en el CI.

### D-027 · Seed de demo: historial con fechas fijas y corte en vivo por el consenso — **Propuesta** (T-061)
**Decisión:** (1) el historial de la demo es un CSV versionado (`data/demo.csv`) con fechas **fijas** en el pasado, cargado con el importador de campo (`origen = 'campo'`). (2) El corte en curso y el aviso "sin confirmar" se crean con `ReportesService.iniciar` para residentes de demo con id fijo, y el consenso real decide el estado. (3) El script se niega con `NODE_ENV=production` o una URL que contenga "prod", salvo `--forzar`.
**Por qué:** (1) la estimación no filtra por antigüedad, así que unas fechas fijas no caducan, y la idempotencia del importador (D-025) evita duplicados sin más lógica. Unas fechas relativas a la siembra, en cambio, generarían ciclos nuevos en cada corrida. (2) Escribir `estado_sector` a mano mostraría un estado que el sistema no produjo; por la vía del consenso, la demo enseña el mecanismo real. (3) Las URL de Supabase no distinguen staging de producción, así que la regla es una red de seguridad, no una garantía.
**Consecuencia:** el corte en vivo depende del reloj: el aviso "sin confirmar" de agua dura unas 3 h (la ventana del agua) y el corte de luz, hasta que los reportes vencen (48 h). Por eso el seed se corre la mañana de la defensa (`docs/demo.md`). Los ciclos de demo no se distinguen de los de campo en la base: no se siembra la demo donde haya datos de campo reales.


### D-028 · Flat design sobre la propuesta A — **Decidida por Leonardo** (F-002)
**Decisión:** la interfaz es la propuesta A (azul, fuente del sistema) en versión plana: `--sombra-flotante` y `--sombra-hoja` valen `none` (claro y oscuro), sin degradados ni relieves; la profundidad la dan los bordes de 1 px y las superficies sólidas de los tokens. Se sobrescribe en `apps/web/src/estilos/globales.css`, después de importar los tokens del canon, que no se tocan.
**Por qué:** lo pidió Leonardo el 27-oct. A ya era casi plana (bordes finos, dos sombras suaves), así que el cambio es mínimo y no toca ningún color: los de estado ya pasaron la verificación de contraste y de daltonismo (`verificar-tokens.mjs`).
**Consecuencia:** las pruebas de fidelidad de CANON §11 contra `a-*.html` pueden dar algo más del 1 % por las sombras que faltan; se comparan sin ellas.

### D-029 · Mirar es público; reportar pide cuenta — **Decidida por Leonardo** (F-002)
**Decisión:** `GET /estimaciones`, `GET /sectores/:id/historial` y `GET /sectores/:id/resumen` pasan a `@Public()` (con su throttle de lectura), como ya lo eran `GET /sectores` y la lectura de `estado_sector` por RLS. En la web, el mapa y el panel se ven sin cuenta; la cuenta (correo y clave de Supabase Auth) y el pin se piden la primera vez que se va a Reportar.
**Por qué:** esas rutas solo devuelven agregados por sector, así que NF-06 se cumple igual (el barrido de privacidad las llama sin token). La identidad solo hace falta para escribir: el consenso cuenta residentes distintos (CON-04), el sector del reporte sale del pin del registro (REG) y REP-05 y el cierre necesitan un dueño. Un login anónimo no sirve: cada navegador sería un vecino nuevo y una persona confirmaría un corte sola.
**Alternativa descartada:** enlace mágico por correo: el correo gratuito de Supabase manda muy pocos mensajes por hora y trabaría las pruebas y la demo.

### D-030 · Un solo `.env`, en la raíz del monorepo — **Decidida por Leonardo** (F-002)
**Decisión:** todas las variables (API, scripts `db:*`, web y Docker) viven en el `.env` de la raíz; la plantilla es el `.env.example` de la raíz y desaparecen `apps/api/.env.example` y `apps/web/.env.example`. La API busca `apps/api/.env` y, si no existe, `../../.env` (`src/config/cargar-env.ts`, que usan `ConfigModule`, los scripts y `drizzle.config.ts`); en los tests no se lee ninguno. Vite usa `envDir: '../..'` y solo expone las `VITE_*`. Docker: `env_file: .env` para la API y las `VITE_*` como argumentos del build de la web.
**Por qué:** un solo archivo que llenar. Lo que ya está en el entorno (Render, Docker, los tests) manda sobre el archivo (`process.loadEnvFile` y `ConfigModule` no sobrescriben), así que nada cambia fuera de local. Ningún `.env` entra a una imagen (`.dockerignore`).

### D-031 · Reportar depende del corte propio, no del estado del sector — **Propuesta** (F-002, S3)
**Decisión:** el botón dice "Se fue la luz" si el vecino no tiene un corte propio abierto de ese servicio y "Ya volvió la luz" si lo tiene. "Abierto" mezcla `GET /reportes/mios` con la cola: un inicio en cola (pendiente o enviado) abre; un cierre en cola cierra; uno con error no cuenta. La hora "Fue antes" se lee como hora de Caracas (UTC−4 fijo) y se valida con las reglas de la API.
**Por qué:** solo se puede cerrar un reporte propio (D-003): con el sector sin servicio y sin reporte propio, "Ya volvió" daría un 404. Se aparta de CANON §7.1, que ata el texto al estado del sector.

### D-032 · Primero la cuenta, después el pin (ajusta D-014) — **Propuesta** (F-002, S1)
**Decisión:** el registro es cuenta → pin, porque Reportar pide la sesión antes (D-029). Se mantiene `validar-pin` antes de `POST /residentes/me` y que Nest no crea usuarios. El pin vive solo en el estado del componente y se olvida al crear el perfil.

### D-033 · Mapa y panel: lo que las maquetas no dibujan — **Propuesta** (F-002, S2 y S4)
**Decisión:** (1) sin P2, un sector sin servicio dice "Desde las {hora}" sin "confirmado por n vecinos"; (2) el botón de reportar del mapa sale solo en el sector propio (el reporte va al sector del pin); (3) la hoja completa deja a la vista la barra, el selector y la leyenda; (4) el panel pone el sector propio primero y el resto por gravedad, y una fila abre el detalle en `/panel?sector=` (no el mapa); (5) el rango intercuartílico se muestra como texto, sin la barra de C.

### D-034 · E2E en Docker con los datos de ejemplo — **Propuesta** (F-002, S5)
**Decisión:** las pruebas E2E viven en `e2e/` (paquete aparte, fuera del workspace, con la imagen oficial de Playwright) y corren contra la web de Docker con `?demo=`, en teléfono y escritorio, con axe. No escriben en Supabase ni dependen de él: siempre dan el mismo resultado. El flujo real con tres cuentas (consenso y Realtime) queda para la prueba manual con dos teléfonos (`docs/demo.md`).

### D-035 · Mapa: cortes en primer plano, nombres que no se pisan — **Decidida por Leonardo** (F-002)
**Contexto:** con la demo sobre Supabase (27-oct), al alejar el zoom los nombres "Guaparo Noroeste" y "Guaparo Noreste" se pisaban, el título del detalle se cortaba en "Guaparo Nor…", el contorno del sector seleccionado no se veía y el azul de "con servicio" cubría 3/4 del mapa compitiendo con el rojo. Además, se podía alejar hasta que Guaparo quedaba como un punto en Valencia.
**Decisión:** (1) en oscuro, "con servicio" baja del 55 % al 25 % de opacidad; en claro se queda en 60 % porque más abajo se confunde con "sin datos" (ΔE < 15 en `verificar-tokens`); (2) máscara fuera de los sectores, hacia `--mapa-base` al 60 %; (3) nombres sin "Guaparo" en el mapa, y solo la insignia si el marcador medido no cabe; (4) el contorno del seleccionado va en su propio panel, encima de los estados; (5) zoom mínimo de un nivel por debajo del encuadre, límites de 5 veces Guaparo y botón "Ver todo Guaparo"; (6) el título del detalle hace salto de línea en vez de cortarse. De paso se corrige `--mapa-base` en oscuro: `a.css`, `b.css` y `c.css` lo definían solo en claro con el mismo peso que el `.dark` de `comun.css` y, al cargarse después, ganaban también en oscuro. Canon §4.2 y §4.3.
**Pendiente:** resuelto en D-036.

### D-036 · Sectores del Guaparo real, trazados sobre OSM — **Decidida por Leonardo** (F-002)
**Contexto:** la cuadrícula provisional de D-005 quedaba unos 2,5 km al sureste de Guaparo, sobre Camoruco y Los Sauces. OSM no tiene el límite de la urbanización, solo el nodo `place=neighbourhood` 7118030719.
**Decisión:** `data/sectores-guaparo.geojson` pasa a ser un borrador de 6 sectores trazados sobre vías de OSM: Noroeste, Calle 160, Pérez Carreño, Av. Bolívar, Suroeste y Sur (unos 0,68 km² en total). Por el norte llega a la Calle 126 (límite con Naguanagua), por el este a la Av. Bolívar Norte y la Redoma de Guaparo, y por el sur al Polideportivo Misael Delgado; los ids de OSM de cada borde están en la `nota` del archivo. Son válidos, sin solapes ni huecos (lo comprueba `sectores-seed.e2e-spec.ts`). La cuadrícula se conserva como `data/sectores-cuadricula.geojson`: la usan los tests de integración (sus puntos de control) y el modo demo de la web. La demo (`demo.csv`, `demo.ts`) usa los nombres reales: Noreste → Calle 160 y Sureste → Sur; Pérez Carreño y Av. Bolívar quedan sin historial. Staging se vació y se volvió a sembrar el 27-oct.
**Pendiente:** validarlo con los vecinos. Dudas: si la franja comercial entre la Pérez Carreño y la Av. Bolívar (CC Guaparo, Teatro, metro) cuenta como Guaparo; el borde sur, trazado a mano; tres tramos rectos de 120 a 190 m que no siguen una calle; y Noroeste, casi el doble que los demás. Para corregirlo: editar el archivo, vaciar los sectores de la base (el seed hace upsert por nombre y no borra) y volver a sembrar.

### D-037 · Barra del teléfono con cinco destinos y Avisos aparte — **Decidida por Leonardo** (F-002)
**Contexto:** con cuatro destinos, Reportar no quedaba en el centro y "Tus avisos" vivía debajo del formulario de Reportar, lejos de la vista cuando había pendientes.
**Decisión:** (1) la navegación del teléfono pasa a Mapa · Panel · Reportar · Avisos · Cuenta, en cinco columnas iguales; (2) Reportar va al centro como un círculo de 56 px de `--acento` con anillo de 4 px de `--superficie` (`--acento-suave` si es la pantalla actual), que sobresale 24 px de la barra, plano y sin sombra (D-028), con la etiqueta alineada con las demás; (3) "Tus avisos" sale de Reportar a su propia ruta `/avisos`, con estado vacío y un enlace "Ver tus avisos" tras guardar un aviso; el botón "1 pendiente" del mapa lleva ahí; (4) Avisos lleva una insignia con los avisos sin enviar (pendientes y rechazados), en los colores de _Error_ si alguno se rechazó y si no en los de _Pendiente_, y con el número también en el nombre accesible; (5) `/avisos` no pide cuenta, como mirar (D-029): la cola es local y cerrar sesión la vacía; (6) en escritorio la barra lateral suma Avisos con la misma insignia. Por debajo de 360 px las píldoras bajan a 48 px de ancho para que quepan los cinco. Canon §2, §7.2 y §9, y propuesta A ("Navegación inferior").

### D-038 · Flat con carácter: acento de tinta, barra superior y fuente de títulos — **Decidida por Leonardo** (F-003)
**Contexto:** el 27-oct Leonardo vio la app "muy simple" y sin esencia en el teléfono. Se comparó la versión actual con una propuesta en un lienzo de Claude Design (capturas reales de Docker frente a la propuesta, con los mismos datos de ejemplo) y aprobó la dirección, manteniendo el flat de D-028.
**Decisión:** (1) el acento de la interfaz pasa del azul a la tinta (`#0b1220`; en oscuro, `#f1f5f9`): así el único color con croma en pantalla es el de los estados (CANON §1.1), y el azul queda para "con servicio" y para el foco; (2) barra superior de tinta fija en el teléfono (`--barra`), con la marca nueva (un rayo en un bloque redondeado) y, a la derecha, los pendientes o "En línea · hora"; la barra flotante del mapa desaparece; (3) Bricolage Grotesque variable (OFL, `@fontsource-variable/bricolage-grotesque`, solo el subconjunto latino, unos 77 KB, servida por la app y dentro de la caché offline) para títulos, marca y cifras; el texto sigue con la fuente del sistema; (4) el `theme-color` y el `theme_color` del manifest toman el color de la barra. Se sobrescribe en `apps/web/src/estilos/globales.css`, como D-028: los tokens del canon no se tocan. Lo que sigue (R2 a R4): bloque de estado sólido en la hoja, consenso con barritas, barra de la estimación (lo que llevas, la mediana y el rango intercuartílico), panel con resumen apilado y Reportar con una tarjeta por servicio.
**Contraste (WCAG):** blanco sobre tinta 18,7; `--tinta-acento` sobre `--acento-suave` 15,1 (oscuro 12,0); `--barra-apoyo` sobre la barra 8,6 (oscuro 8,0); `--secundario` sobre el `--fondo` nuevo (`#f4f6f9`) 7,0; el foco azul sobre el fondo 6,2.
**Consecuencia:** choca con A §2 ("fuente del sistema, no descarga nada"): se acepta el costo de una sola descarga, que queda en caché. Las referencias `a-*.html` dibujan el azul, así que la prueba de fidelidad de CANON §11 no aplica a A hasta rehacerlas (R5), y los iconos PNG de la PWA siguen con el pin hasta entonces.
