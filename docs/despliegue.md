# Despliegue y variables de entorno

> Qué crear en Supabase, Render y Vercel, qué variables poner y dónde va el `.env` (uno solo, en la raíz).
> Ninguna clave secreta entra al repo: `.gitignore` ignora `.env*` salvo los `.env.example`.

## Orden

1. **Supabase**: crear el proyecto, revisar las claves JWT y la configuración de Auth (§1).
2. **El `.env` de la raíz**: llenarlo, migrar y sembrar (§2).
3. **Render**: crear el servicio de la API y anotar su URL (§3).
4. **Vercel**: crear la web con la URL de la API y anotar la suya (§4).
5. **Cerrar el círculo**: poner la URL de Vercel en `CORS_ORIGINS` (Render) y en la *Site URL* (Supabase).
6. **GitHub**: añadir el *deploy hook* y el *keep-alive* (§5).
7. **Verificar** (§6). Para probar todo en local antes de desplegar: Docker (§7).

---

## 1. Supabase

### 1.1 Crear el proyecto
- Créalo en una **organización personal con el plan Free** (gratis, hasta 2 proyectos activos). En la organización de Botinfy, que es de pago, cada proyecto se cobra.
- **Nombre:** `blackout-staging`. **Región:** `East US (North Virginia)` (us-east-1). **Contraseña de la base:** genérala y guárdala; la necesitas en §1.5.
- El plan Free **pausa el proyecto tras ~7 días sin actividad**. El *keep-alive* de §5 lo evita de paso, porque la API consulta la base.

### 1.2 PostGIS
- *Database → Extensions →* `postgis` → activar en el esquema **`extensions`**.
- Si lo olvidas no pasa nada: la migración `0000` lo crea igual en ese esquema.

### 1.3 Claves JWT asimétricas (obligatorio)
La API **solo acepta tokens ES256/RS256** (D-021). Con la clave HS256 heredada, todo lo que requiere sesión devolvería 401.

- *Project Settings → JWT Keys*: la clave en uso (**Current key**) debe ser **ECC (P-256)**.
- Si en uso está **Legacy HS256 (Shared Secret)**: *Migrate JWT secret* → *Rotate keys*.
- **Para comprobarlo**, abre `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`. Tiene que aparecer una clave con `"kty":"EC"`.

### 1.4 Auth
- *Authentication → Sign In / Providers → Email*: **Enable email provider** activado y **Confirm email desactivado**. El correo gratuito de Supabase manda muy pocos mensajes por hora, así que las pruebas y la demo se trabarían esperando el correo de confirmación.
- *Authentication → URL Configuration*:
  - **Site URL:** `https://<app>.vercel.app` (la pones en el paso 5).
  - **Redirect URLs:** `http://localhost:5173` y `http://localhost:8080`.

### 1.5 Qué copiar (botón **Connect** y *Project Settings → API Keys*)

| Dato | Dónde está | Es secreto | Va en |
|---|---|---|---|
| **Project URL** `https://<ref>.supabase.co` | *Project Settings → Data API* | No | API y web |
| **Publishable key** (`sb_publishable_…`, o la `anon` heredada) | *Project Settings → API Keys* | No (es pública) | Solo la web |
| **Cadena de conexión de Postgres** | *Connect →* **Session pooler** (puerto **5432**) | **Sí** | Solo la API |
| `service_role` / *secret key* | — | **Sí** | **En ningún lado.** No se usa. |

- **Formato de la cadena:** `postgresql://postgres.<ref>:<clave>@aws-0-us-east-1.pooler.supabase.com:5432/postgres` (el host exacto cópialo del panel).
- **Por qué el *Session pooler* y no la conexión directa:** la directa es solo IPv6, y Render no sale por IPv6.
- Si la clave tiene símbolos (`@`, `#`, `/`, `%`…), escríbelos codificados para URL: `@` → `%40`, `#` → `%23`.

### 1.6 Después de migrar (§2), comprobar
- *Database → Publications → `supabase_realtime`* incluye la tabla `estado_sector`. La deja así la migración `0002`, y es lo que hace funcionar el mapa en vivo.
- *Table Editor*: todas las tablas aparecen con **RLS enabled**.

---

## 2. El `.env` de la raíz (tu máquina y Docker)

Hay **un solo `.env`, en la raíz del repo** (D-030). Plantilla: [`.env.example`](../.env.example), con cada variable comentada. Cópiala a `.env` y llena solo lo marcado con `<…>`.

| Quién | Qué toma del `.env` |
|---|---|
| La API con `pnpm dev` | Todo menos las `VITE_*` |
| Los scripts `pnpm db:*` (migrar y sembrar) | `DATABASE_URL` (los de demo, todo lo de la API) |
| La web con `pnpm dev` | Solo las `VITE_*` (Vite no expone nada más al navegador) |
| Docker (`pnpm app:up`, §7) | La API lo recibe entero al arrancar; la web, sus `VITE_*` como argumentos del build. Ningún `.env` entra a una imagen |

Tres advertencias:
- **`DATABASE_URL` es la base de Supabase**, la misma que lee la web por Realtime. Si apuntas la API a la base local, el mapa no se entera de ningún cambio.
- **Usa el *Session pooler* (puerto 5432)**, no la conexión directa (§1.5).
- **`DATABASE_URL_TEST` siempre apunta a la base local** de Docker (`pnpm db:up`), nunca a Supabase: los tests la vacían.

### Migrar y sembrar Supabase (una vez, desde tu máquina)
Con el `.env` de la raíz apuntando a Supabase:
```bash
pnpm db:migrate        # 0000..0003: PostGIS, esquema, RLS + Realtime, ciclos incompletos
pnpm db:seed:demo      # sectores + historial de demo + corte en vivo (docs/demo.md)
```
- **Antes de correrlo:** el `pnpm` de tu PATH está roto. Arréglalo una vez con `corepack enable` o con `npm i -g pnpm@10.33.2`.
- **Sin arreglar pnpm:** se puede correr desde el contenedor de la API (§7).
- **Otra opción:** pídeme que lo corra yo cuando el `.env` esté listo.

---

## 3. Render (la API)

*New → Web Service →* el repo `lpzzlnrd/BlackoutTracker`.

| Campo | Valor |
|---|---|
| Branch | `staging` para probar hoy; `main` cuando se promueva |
| Region | **Virginia (US East)**, junto a Supabase |
| Root Directory | *(vacío: la raíz del repo, porque es un monorepo)* |
| Runtime | Node |
| Build Command | `npm i -g pnpm@10.33.2 && pnpm install --frozen-lockfile && pnpm --filter @blackout/shared build && pnpm --filter @blackout/api build` |
| Start Command | `cd apps/api && node dist/main.js` |
| Health Check Path | `/api/salud` |
| Instance Type | Free |
| Auto-Deploy | **No** si usas el *deploy hook* de §5 (si no, despliega dos veces); **Yes** si no lo usas |

- Si `npm i -g` falla en el build, cambia cada `pnpm` del comando por `npx --yes pnpm@10.33.2`.
- **No pongas `NODE_ENV=production`:** `pnpm install` omitiría las devDependencies y `nest build` fallaría.

### Variables (*Environment*)

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | La del *Session pooler* (§1.5) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `JWT_AUDIENCE` | `authenticated` |
| `CORS_ORIGINS` | `https://<app>.vercel.app` (paso 5; separa con coma si son varios, nunca `*`) |
| `TRUST_PROXY` | `1` (detrás del proxy de Render; sin esto el throttle ve una sola IP) |
| `CONSENSO_N` | `3` |
| `CONSENSO_VENTANA_MIN_ELECTRICIDAD` | `30` |
| `CONSENSO_VENTANA_MIN_AGUA` | `180` |
| `ESTIMACION_N_MIN` | `5` |
| `REPORTE_MAX_ANTIGUEDAD_DIAS` | `7` |
| `REPORTE_VENCE_HORAS` | `48` |
| `CRON_ACTIVO` | `true` |

- `PORT` no se pone: lo asigna Render.
- **Anota la URL** que te da Render: `https://<servicio>.onrender.com`.
- El plan Free se duerme a los 15 min sin tráfico y tarda ~1 min en despertar; §5 lo mantiene despierto.

---

## 4. Vercel (la web)

*Add New → Project →* el repo.

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | `apps/web` (deja activado *Include files outside the root directory*) |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm --filter @blackout/shared build && pnpm --filter @blackout/web build` |
| Output Directory | `dist` |
| Node.js Version | 22.x (*Settings → General*) |
| Production Branch | `main` (*Settings → Git*); cada rama tiene además su preview |

- `apps/web/vercel.json`, con la regla que manda las rutas de la app a `index.html`, entra con el frontend (S0).

### Variables (*Settings → Environment Variables*, marcar **Production** y **Preview**)

| Variable | Valor |
|---|---|
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (así Vercel usa el pnpm 10.33.2 de `packageManager`) |
| `VITE_API_URL` | `https://<servicio>.onrender.com/api` (**con** `/api` al final) |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | La *publishable key* |

- Las `VITE_*` se graban en el build: si cambias una, hay que redesplegar.
- **Nunca** pongas aquí la `DATABASE_URL` ni la `service_role`: todo lo que empieza por `VITE_` termina en el navegador.
- **Las previews tienen URL aleatoria** y `CORS_ORIGINS` no admite comodines. Para probar una rama contra la API, añade a `CORS_ORIGINS` su alias fijo (`https://<proyecto>-git-<rama>-<usuario>.vercel.app`).

---

## 5. GitHub (CD y keep-alive)

*Settings → Environments → New environment →* `produccion`:

| Tipo | Nombre | Valor | Para qué |
|---|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_URL` | Render → servicio → *Settings → Deploy Hook* | `deploy-api.yml`: despliega tras un CI verde en `main` |
| Variable | `API_URL` | `https://<servicio>.onrender.com` (**sin** `/api`) | `keepalive.yml`: llama a `/api/salud` cada 14 min (Render no se duerme y Supabase no se pausa) |

Sin estos valores, los dos workflows se saltan sin fallar.

---

## 6. Verificación

- [ ] `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` → una clave con `"kty":"EC"`.
- [ ] `https://<servicio>.onrender.com/api/salud` → `{"estado":"ok", "baseDeDatos":"ok", …}`.
- [ ] `https://<servicio>.onrender.com/api/docs` → abre Swagger.
- [ ] En `https://<app>.vercel.app` se ven el mapa y los colores de los sectores sin iniciar sesión.
- [ ] Crear una cuenta, poner el pin y reportar: llega a la API (Network → 200) y no hay errores de CORS en la consola.
- [ ] Con dos navegadores, al completar el consenso con 3 cuentas, el otro cambia de color sin recargar (Realtime).
- [ ] *Supabase → Database → Publications*: `estado_sector` aparece en `supabase_realtime`.

---

## 7. Probar todo en Docker (local)

La base, la API y la web en contenedores, con la web en **http://localhost:8080**. nginx sirve la PWA y reenvía `/api` a la API, así que no hay CORS y el service worker funciona igual que en producción.

- **Requisitos:** Docker Desktop encendido y el `.env` de la raíz lleno (§2). La API usa la `DATABASE_URL` de Supabase, no la base local.
- **Levantar o reconstruir** tras cambiar código o las `VITE_*`:
  ```bash
  pnpm app:up      # docker compose --profile app up -d --build --wait
  ```
- **Sin Supabase todavía:** `http://localhost:8080/?demo=en-linea` (o `?demo=sin-conexion`) funciona con los datos de ejemplo.
- **Swagger:** http://localhost:8080/api/docs. **Salud:** http://localhost:8080/api/salud.
- **Migrar y sembrar desde el contenedor** (contra la `DATABASE_URL` del `.env`; no hace falta el pnpm de tu máquina):
  ```bash
  docker compose --profile app run --rm --no-deps api pnpm db:migrate
  docker compose --profile app run --rm --no-deps api pnpm db:seed:demo
  ```
- **Logs:** `pnpm app:logs`.
- **Apagar solo la app** (la base local sigue): `docker compose --profile app stop api web`. **Ojo:** `pnpm db:down` y `pnpm db:reset` apagan también la base, y `db:reset` además borra su volumen.
- **Pruebas de punta a punta (Playwright + axe) en Docker**, con la app levantada:
  ```bash
  pnpm e2e         # docker compose --profile e2e run --rm --build e2e
  ```
  Corren en teléfono (Pixel 7) y en escritorio (1280 × 860) contra `http://web`, con los datos de ejemplo (`?demo=`), así que no escriben nada en Supabase. El informe HTML queda en `e2e/informe/index.html` (ábrelo con doble clic) y las trazas de los fallos, en `e2e/resultados/`. Sin el `pnpm` de tu máquina: `docker compose --profile e2e run --rm --build e2e`.
