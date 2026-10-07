# BlackoutTracker — contexto para Claude Code

Proyecto universitario de la cátedra **Sistemas de Información** (Escuela de Computación, UJAP, año académico 2026; profesora: Oneida Jimenez). Equipo de 2, plazo de **15 semanas**.

- **Leonardo Correa** — backend e integración (dueño de este repo)
- **Freddy Parra** — frontend y pruebas

Idioma del proyecto: **español** (UI, commits, documentación y comentarios).

> El stack ya está decidido (§4). Rama principal: **`main`**.
>
> **Antes de programar, lee la sección *Estado* y el *Protocolo* de `docs/TAREAS.md`.** Ahí está la próxima tarea.
> - `docs/PLAN.md`: modelo de datos, API, algoritmos y estrategia de pruebas.
> - `docs/DECISIONES.md`: decisiones tomadas y propuestas.
> - `CHANGELOG.md`: se actualiza en cada tarea.

---

## 1. Qué es

Plataforma web comunitaria (PWA) para **monitorear de forma colaborativa las interrupciones de agua potable y electricidad**. Piloto: **Urbanización Guaparo, Valencia, estado Carabobo (Venezuela)**.

**El problema:** hoy los vecinos se avisan por grupos de WhatsApp ("se fue", "volvió", "aquí seguimos sin luz"). La información existe, pero no tiene estructura ni validación y nadie la agrega. No se puede planificar porque los cortes no tienen horario fijo.

**La idea:** estructurar y validar la información que la comunidad ya produce. No hay administrador: el estado de un sector cambia solo cuando varios reportes independientes coinciden (consenso). El tiempo de restablecimiento se estima con la mediana histórica.

Marco teórico: **Teoría General de Sistemas (TGS)**.
- Entrada: los reportes. Proceso: validación geográfica, consenso y estadística. Salida: el mapa y las estimaciones. Retroalimentación: cada ciclo cerrado mejora la estimación.
- Agua y luz comparten modelo, como caso de **isomorfismo**.
- El consenso sin admin es un caso de **homeostasis / autorregulación**.

---

## 2. Requerimientos (alcance del MVP)

### Funcionales (§5.2 de la propuesta) → módulos y prefijos de prueba

| Prefijo | Módulo | Qué hace |
|---|---|---|
| **REG** | Registro + validación geográfica | El residente se registra **una sola vez** poniendo un pin en el mapa sobre su vivienda. Se valida con punto-dentro-de-polígono contra el GeoJSON de Guaparo. **No** se pide geolocalización en vivo en cada reporte. |
| **REP** | Ciclo de reportes | Reporta el inicio y el cierre (restablecimiento) de un corte. Agua y luz van en la misma tabla, diferenciados por `tipo_servicio`. |
| **CON** | Consenso estructural | El estado de un sector solo cambia con **N reportes de usuarios distintos, del mismo sector y servicio, dentro de una ventana de tiempo**. Sin rol admin ni moderador. |
| **OFF** | Modo sin conexión | Cola persistente en **IndexedDB** (nunca en memoria). Sincroniza con el evento `online`, y con Background Sync API como mejora progresiva. |
| **EST** | Estimación estadística | **Mediana** histórica de la duración de los ciclos completos, por sector y tipo de servicio. |
| **VIS** | Visualización | Mapa de calor por sector y panel/dashboard filtrable por servicio, con actualización en tiempo real. |

### No funcionales (§5.3)
- Funcionar de forma confiable con conectividad **intermitente o lenta**.
- Accesible desde el navegador móvil **sin instalar nada** (PWA).
- Solo herramientas **open source o de nivel gratuito**, sin licencias.
- **Ningún rol administrador** para la operación básica.
- **Exposición mínima de la ubicación**: nadie puede ver las coordenadas exactas de otro residente, solo datos agregados por sector. Lo garantiza la API, que nunca devuelve coordenadas, y RLS en deny-all (ver §4).

### Fuera de alcance (no implementar)
- Rol de "jefe de calle" o cualquier moderador (lo reemplaza el consenso).
- Logística de camiones cisterna, rutas, división de costos y pagos.
- Escalamiento a otras urbanizaciones o a nivel nacional.
- Protección contra cuentas falsas (Sybil). Es una limitación conocida.
- Integración con sistemas de las empresas prestadoras.
- Sensores IoT (ESP32, PZEM-004T, sensor ultrasónico): solo están documentados como trabajo futuro para calibrar el modelo.

---

## 3. Reglas de dominio (las que deben cumplir el código y los tests)

### Modelo de datos
- Una **única entidad de reportes de interrupción**. Campos esenciales: sector, `tipo_servicio` (agua | electricidad), hora de inicio, hora de fin (nula hasta el cierre), residente que reporta y estado de sincronización.
- Es una sola tabla y no una por servicio, porque ambos servicios comparten la misma estructura de entrada → proceso → salida.
- Al registrarse, el residente queda asociado al **sector** que contiene su pin.

### Reportes (REP)
- Un usuario no puede tener **dos reportes abiertos del mismo servicio** a la vez (REP-05). Sí puede tener uno de agua y otro de luz al mismo tiempo (REP-06).
- **Nunca** se guarda una duración negativa (fin < inicio): se rechaza (REP-07).
- Cierre sin un inicio previo: aún no está decidido (ver §6).

### Consenso (CON)
- **Umbral inicial N = 3** usuarios distintos.
- Varios reportes del **mismo usuario** cuentan como uno (CON-04).
- Los reportes de **sectores distintos no se suman** (CON-05).
- Los reportes fuera de la ventana de tiempo no cuentan (CON-07).
- Con N − 1 reportes el estado no cambia, aunque puede mostrarse "reportes sin confirmar".
- Con N + 1 reportes no se generan eventos duplicados.
- El restablecimiento también se confirma por consenso (CON-06) y cierra el evento del sector.

### Offline (OFF)
- El servidor guarda la **hora real del evento**, no la del envío (OFF-03). Esto es crítico.
- Reintentos **idempotentes**: un reporte nunca se duplica aunque la conexión se corte a mitad del envío (OFF-05). Usar un id generado en el cliente o una clave de idempotencia.
- La cola sobrevive al cierre del navegador (OFF-06) y se sincroniza en **orden cronológico** (OFF-04).
- Sin red, la app muestra la última información guardada con el aviso "datos no actualizados" (OFF-07).

### Estimación (EST)
- Usa la mediana de las duraciones de los **ciclos completos** (con inicio y fin) de un sector y servicio: T̂(s,v) = mediana{ fin_i − inicio_i : i ∈ C(s,v) }. Los ciclos abiertos se excluyen.
- Se usa la mediana y no el promedio porque es robusta ante valores atípicos: un corte de 30 h no arruina la estimación (EST-03). Esto pesa sobre todo en electricidad, que es más errática.
- Con una cantidad par de datos, se toma el promedio de los dos valores centrales (EST-02).
- **Umbral mínimo n_min = 5** ciclos. Por debajo, se muestra "datos insuficientes" y no una cifra (EST-04).
- **Siempre mostrar el n**: "aprox. 4 h, según 12 cortes registrados".
- Agua y luz **nunca se mezclan** (EST-05). La mediana se recalcula cada vez que se cierra un ciclo (EST-06).
- Opcional: mostrar el rango intercuartílico, o un intervalo por **bootstrap** (≈1000 remuestreos, percentiles 2,5 y 97,5). No usar intervalos que asuman normalidad.
- Error estándar de la mediana ≈ 1,2533·σ/√n: reducir el error a la mitad exige 4 veces más datos. Con 6 ciclos la estimación es orientativa, con 25 es fiable y con 100 es estable.
- **Terminología: "estimación estadística", nunca "predicción" ni "algoritmo predictivo".** Es un estimador de tendencia central, no un modelo entrenado.

---

## 4. Stack (DEFINITIVO, decidido el 7-oct-2026)

**Arquitectura:** PWA (React) → API REST propia (NestJS) → Postgres en Supabase.
Supabase se usa solo para tres cosas: **Postgres + PostGIS**, **Auth** y **Realtime**. Toda la lógica de negocio vive en NestJS.

### Monorepo (pnpm workspaces)
```
apps/api/          NestJS 11 + Drizzle
apps/web/          React + Vite + TypeScript (PWA)
packages/shared/   tipos y enums comunes (tipo_servicio, estados de sector, DTOs compartidos)
```

### Backend — `apps/api` (dueño: Leonardo)
- **NestJS 11** sobre **Node 22 LTS**. No migrar a Nest 12 durante el proyecto.
- **ORM: Drizzle**, conectado al Postgres de Supabase. Las migraciones se versionan en el repo con `drizzle-kit`.
  - Columnas geográficas con el tipo `geometry` de PostGIS. Las consultas espaciales (`ST_Contains`) y la mediana (`percentile_cont(0.5)`) se escriben con el helper `sql` de Drizzle, sin salir del ORM.
  - **No usar Prisma**: no soporta PostGIS de forma nativa.
- **Validación:** `class-validator` + `class-transformer`, con `ValidationPipe` global.
- **Auth:** el front usa **Supabase Auth**. Nest **no** emite tokens, solo verifica el JWT de Supabase.
  - Un guard global usa `jose` contra el JWKS en `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` (claves asimétricas).
  - El JWKS no se guarda en caché más de 10 min.
  - El `sub` del token es el id del residente.
- **Tareas programadas:** `@nestjs/schedule` para vencer las ventanas de consenso. No usar `pg_cron`.
- **Docs y seguridad:** `@nestjs/swagger` (documentación OpenAPI, sirve también para la defensa), Helmet y `@nestjs/throttler`.
- **Tests:** Jest (el default de Nest 11) + Supertest.
  - La lógica de consenso y de estimación vive en **servicios puros y fáciles de probar**, para llegar al ≥ 70 % de cobertura.
  - Los tests llevan los IDs del plan (`CON-04`, `EST-02`…).
- **Validación geográfica en el servidor** (`ST_Contains` contra el polígono de Guaparo), aunque el cliente ya la haga con Turf.js.
- **Idempotencia (OFF-05):** cada reporte lleva un UUID generado en el cliente como clave primaria, y Nest hace `upsert` sobre ese id.
- **Hora del evento (OFF-03):** se guarda la hora que envía el cliente (`ocurrido_en`), no `now()`. El servidor rechaza fechas futuras o un fin anterior al inicio.

### Base de datos — Supabase
- Extensión **PostGIS** activada.
- Nest se conecta con un rol que se **salta RLS**. Por eso la privacidad (NF-06) la garantiza la API: **ningún endpoint devuelve coordenadas de residentes**, solo agregados por sector.
- RLS **activado y en deny-all** en todas las tablas, **excepto la lectura de `estado_sector`**, que es lo único que el front lee directo (vía Realtime).
- **Dos proyectos:** uno para el piloto (producción) y uno para pruebas (staging). El plan gratuito permite 2 proyectos activos.
- **Ojo:** el proyecto gratuito **se pausa tras ~7 días sin actividad**. Hay que tenerlo en cuenta antes de las pruebas de campo y de la defensa.

### Tiempo real
- **No** implementar WebSockets en Nest.
- Nest escribe el estado consolidado de cada sector en la tabla `estado_sector`, y el front se suscribe a sus cambios con **Supabase Realtime** (`postgres_changes`). Eso cubre VIS-03.

### Frontend — `apps/web` (dueño: Freddy)
- **React + Vite + TypeScript.**
- **`vite-plugin-pwa`** en modo `injectManifest`, con un service worker propio: caché de la app shell para NF-02 y sincronización en segundo plano.
- **react-leaflet** + teselas de OpenStreetMap. **Turf.js** valida el pin en el cliente.
- **Dexie** (IndexedDB) para la cola offline. La sincronización la escribimos nosotros (evento `online` + Background Sync). **No usar** PowerSync ni RxDB.
- **TanStack Query** para los datos del servidor y **Tailwind** (shadcn/ui opcional) para los estilos.
- **`@supabase/supabase-js` solo para Auth y Realtime.** Toda lectura o escritura de reportes pasa por la API de Nest.
- **Mapa:** coropleta (colorear cada polígono de sector según su estado), no heatmap de puntos, porque los puntos expondrían ubicaciones de residentes.
- **Tests:** Vitest (unitarios) y Playwright (E2E con red simulada lenta o sin conexión). Lighthouse para NF-01 a NF-03.

### Despliegue
- **Web:** Vercel, Netlify o Cloudflare Pages (gratis).
- **API:** Render (plan gratis, se duerme sin tráfico) o el Coolify de Botinfy.
- **Git:** `main` estable y una rama por funcionalidad. Los tests corren antes de integrar a `main`. Las reglas obligatorias están en §10.

---

## 5. Plan de trabajo (15 semanas, cascada adaptada: back y front en paralelo)

| Fase | Semanas | Backend (Leonardo) | Frontend (Freddy) |
|---|---|---|---|
| 1. Diseño y preparación | 1–3 | Modelo de datos, BD geoespacial, auth y endpoint de registro con point-in-polygon | Wireframes, maquetas, Leaflet + pin. Entre los dos: GeoJSON de Guaparo y campaña de entrevistas (15 días) → dataset semilla |
| 2. Registro y ciclo de reportes | 4–5 | API de inicio y de cierre de reporte, cálculo de la duración | Formularios de inicio y de restablecimiento |
| 3. Consenso e historial | 6–7 | Lógica de consenso y endpoint de historial por sector y servicio | Mapa de calor según el estado consolidado; primeras pruebas de usabilidad |
| 4. Offline y estadística | 8–9 | Sincronización diferida en el servidor y mediana histórica | Cola IndexedDB, reconexión y estimación en el dashboard |
| 5. Refinamiento y pruebas | 10–13 | Ciclos incompletos, seguridad, duplicados y soporte en campo | Filtro agua/luz, pruebas con residentes y regresión |
| 6. Documentación y defensa | 14–15 | Documentación técnica y marco TGS | Material visual y demo |

---

## 6. Decisiones de diseño pendientes

> Ya hay propuestas para todas en `docs/DECISIONES.md` (D-002 a D-005). Esta lista se queda como referencia hasta que Leonardo las confirme.

- **Duración de la ventana de consenso** (CON-07). No está definida.
- **Pin sobre el borde del polígono** (REG-03): decidir si se acepta o se rechaza, y aplicarlo siempre igual.
- **Cierre sin inicio previo** (REP-04): bloquear la acción o guardarla como aviso sin duración.
- **Cómo se divide Guaparo en sectores** (sub-polígonos) y el GeoJSON en sí: aún no existen.
- Si N = 3 y n_min = 5 deben ser configurables (se recomienda que sí).

---

## 7. Pruebas y criterios de salida

El plan de pruebas completo (basado en ISO/IEC/IEEE 29119-3) está resumido en **`docs/casos-de-prueba.md`**: 39 casos funcionales, 8 no funcionales y 6 tareas de aceptación. Al implementar un módulo, escribe sus tests con los **mismos IDs** (`REG-01`, `CON-04`, …) para mantener la trazabilidad.

Para dar el producto por terminado se exige:
- 100 % de los casos de prioridad A aprobados y ≥ 90 % del total.
- Ningún defecto crítico ni alto abierto.
- **Cobertura ≥ 70 % en los módulos de consenso y estimación.**
- SUS ≥ 68 en la prueba de aceptación con 8–10 residentes.

Rendimiento: con "3G lenta", la app debe ser usable en ≤ 8 s y en ≤ 3 s con caché. También debe pasar la auditoría PWA de Lighthouse en Chrome Android, Firefox y Safari iOS.

---

## 8. Documentación académica

Los entregables (propuesta, Capítulo 1, plan de pruebas, diagramas, cronograma) **no están en este repo**: viven en
`C:\Users\leoco\OneDrive\Desktop\SISTEMAS_INFORMACION`. Para tenerlos a mano: `claude --add-dir "C:\Users\leoco\OneDrive\Desktop\SISTEMAS_INFORMACION"`.

Los criterios de redacción de la tesis, las fuentes verificadas y el estado de cada documento están en **`docs/contexto-academico.md`**. Léelo solo cuando la tarea sea de documentación o de la tesis, no para programar.

## 9. Cómo trabajar con Leonardo
- Respuestas prácticas y sin relleno. No sobre-ingeniería: es un MVP académico de 15 semanas.
- Prefiere entender el sistema antes que recibir soluciones de caja negra: explica el porqué de las decisiones.
- Si dice "confío en ti", puedes decidir el diseño por tu cuenta.

## 10. Flujo de Git (obligatorio)

`main` todavía no tiene reglas de protección, así que estas normas se cumplen por disciplina:

- **Nunca se hace commit ni push directo a `main`.** Todo el trabajo va en una **rama nueva** creada desde `main` actualizada. La única excepción es la documentación de planificación, y solo cuando Leonardo lo autorice de forma explícita:
  ```
  git switch main && git pull
  git switch -c <tipo>/<T-0XX>-<descripcion-corta>   # tipo: feat | fix | chore | docs | test | refactor
  ```
- El **primer push** de la rama la publica en `origin` con su mismo nombre y deja configurado el upstream:
  ```
  git push --set-upstream origin <rama>
  ```
  Los siguientes pushes son un simple `git push`.
- Al terminar, se abre un PR a `main` con `gh pr create`. **Solo Leonardo fusiona**, salvo que diga explícitamente lo contrario.
- No se usa `git push --force` sobre ramas compartidas ni se reescribe el historial de `main`.
- Los commits van en español con Conventional Commits (`feat(api): ...`).
