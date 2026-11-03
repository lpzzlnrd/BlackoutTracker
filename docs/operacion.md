# Operación · guía del mantenedor

> Para quien mantiene BlackoutTracker en marcha (hoy, Leonardo). La app no tiene un rol de administrador, porque el consenso reemplaza al moderador (requisito no funcional, D-041). Por eso todo lo de aquí se hace **fuera de la app**: en Supabase, Render, Vercel y GitHub.
> Cómo se montó cada servicio y qué variable va dónde: [`despliegue.md`](despliegue.md). La demo y la defensa: [`demo.md`](demo.md). Lo que ve un vecino nuevo: la guía "Cómo funciona" de la app (`/guia`).

---

## 1. Qué está en marcha

| Pieza | Dónde | Cómo se despliega | Qué la mantiene despierta |
|---|---|---|---|
| Web (PWA) | Vercel, variable `WEB_URL` del repo | `desplegar-web` en cada push a `main` | Nada: es estática |
| API (NestJS) | Render Free, `https://blackouttracker.onrender.com` (`srv-dbgdjdd9fdbs73e0gb5g`) | `desplegar-api` en cada push a `main` | `keepalive.yml`: un ping a `/api/salud` cada 14 min |
| Base, Auth y Realtime | Supabase Free, proyecto `vtuuujohadsagtfzojoe` | `pnpm db:migrate` desde tu máquina (§3.2) | El mismo ping: `/api/salud` consulta la base |
| CI/CD | GitHub Actions: `ci.yml` y `keepalive.yml` | — | — |

- **Hoy hay un solo proyecto de Supabase y hace de producción.** El plan preveía uno de staging aparte (T-007). Todo lo que corras contra la `DATABASE_URL` del `.env` va a los datos reales.
- **Render Free** da un cupo mensual de horas de instancia por cuenta (750 h al escribir esto; compruébalo en Render). El keep-alive deja la API despierta todo el mes, unas 744 h, así que no cabe un segundo servicio gratis en la misma cuenta.

---

## 2. Revisión semanal (5 minutos)

- [ ] *Actions → Keep-alive*: las últimas corridas en verde. Si fallan, ver §4.
- [ ] `https://blackouttracker.onrender.com/api/salud` responde `{"estado":"ok", "baseDeDatos":"ok", …}`.
- [ ] Panel de Supabase: el proyecto está activo (no dice *Paused*) y *Advisors → Security* no muestra errores nuevos.
- [ ] *Usage* de Supabase y de Render, comparado con los límites del plan Free.
- [ ] Los PR de Dependabot: se revisan uno por uno. Hay que tener en cuenta dos topes del proyecto: **Nest 11 y Node 22 LTS**. No se aceptan Nest 12 ni `@types/node` de otra versión mayor (por eso quedó sin fusionar el #47).

---

## 3. Tareas comunes

### 3.1 Publicar un cambio
1. Rama nueva desde `main`, PR y, cuando pasa la verificación, fusionar (`CLAUDE.md` §10).
2. `ci.yml` corre `verificar` → `desplegar-api` → `desplegar-web`. Se sigue en *Actions → CI/CD* y queda en *Deployments* (`prod-api` y `prod-web`).
3. **Repetir un despliegue** sin commit nuevo: *Actions → CI/CD → Run workflow* sobre `main`. Sirve también tras cambiar una variable de Vercel, porque las `VITE_*` se leen al compilar.
4. **Volver atrás:**
   - Rápido, desde el panel: Render → *Deploys → Rollback*, y Vercel → *Deployments →* el anterior *→ Instant Rollback*.
   - El arreglo de fondo: `git revert` del commit en una rama y un PR, como cualquier cambio. Nunca un push directo a `main`.

### 3.2 Cambiar el esquema de la base
1. En la rama: cambiar el esquema de Drizzle y ejecutar `pnpm db:generate`. Revisar el SQL que queda en `apps/api/drizzle/`. Va en el PR.
2. **Aplicarlo a Supabase** desde tu máquina, con el `.env` de la raíz apuntando a Supabase: `pnpm db:migrate`.
   - Si la migración **solo agrega** (tablas, columnas con valor por defecto, índices), aplícala **antes de fusionar**: la API vieja sigue funcionando con columnas de más, y la nueva arranca con el esquema listo.
   - Si **borra, renombra o exige datos** (como la 0004, que pedía `sectores` vacía), coordina una ventana: avisa, migra y fusiona seguido.
3. Comprobar en el panel:
   - *Table Editor*: toda tabla nueva con **RLS enabled** (deny-all, salvo la lectura de `estado_sector`).
   - *Database → Publications → `supabase_realtime`* sigue incluyendo `estado_sector`.

### 3.3 Sembrar datos

| Comando | Qué hace | ¿En producción? |
|---|---|---|
| `pnpm db:seed` | La zona (los 5 municipios) y los lugares de OSM que dan nombre a los sectores. Es idempotente. | Sí. Si cambia la zona, reinicia la API: el contorno de `GET /zona` se calcula una sola vez |
| `pnpm db:seed:campo` | El dataset de la campaña de entrevistas (T-044) | Sí, con los nombres de sectores que ya existan (D-040 c) |
| `pnpm db:seed:demo` | Sectores, historial sintético y un corte en vivo para la demo | **No.** Mete datos inventados en la estimación |

**Ojo con el seed de demo:** se niega si ve `NODE_ENV=production` o la palabra "prod" en la URL. Las URL de Supabase no llevan esa palabra, así que con el proyecto actual **la guarda no te protege**. No lo corras con el `.env` que apunta a Supabase.

### 3.4 Supabase se pausó
- **Síntomas:**
  - `/api/salud` responde con `baseDeDatos` en error.
  - La web muestra "datos no actualizados" aunque haya red.
  - Nadie puede entrar.
- **Arreglo:** abrir el panel de Supabase → *Restore project*. Tarda unos minutos. Después, abrir `/api/salud` hasta que diga `ok`.
- **Causa probable:** el keep-alive dejó de correr. Hay dos motivos posibles:
  - El repo es público, y GitHub desactiva sus workflows programados tras 60 días sin actividad. Se reactiva desde *Actions → Keep-alive → Enable workflow*.
  - Falta la variable `API_URL`: en ese caso el job no hace nada, aunque salga en verde.

### 3.5 La API no responde
- La primera petición tras una siesta tarda cerca de un minuto (Render Free). El keep-alive lo evita.
- Si `/api/salud` no responde nunca: *Render → Logs*. Errores típicos:
  - `DATABASE_URL` mal pegada: la API la valida al arrancar y dice cuál falla.
  - Se usó el puerto 5432 en vez del 6543 ([`despliegue.md`](despliegue.md) §1.5).
- Las variables de Render están en [`despliegue.md`](despliegue.md) §3. Al guardar un cambio, elige la opción de guardar y desplegar, para que la API arranque con el valor nuevo.

### 3.6 La web
- **Las `VITE_*` de Vercel nunca se marcan como *Sensitive*.** `desplegar-web` hace `vercel pull`, que no puede leer esos valores, y el bundle compilaría el texto `[SENSITIVE]` (incidente del 27-oct: la web en blanco con "Invalid supabaseUrl"). Son públicas de todos modos: van en el JS.
- Si cambias la URL de la web, ponla también en `CORS_ORIGINS` (Render) y en la *Site URL* de Supabase Auth.

### 3.7 Cuentas de vecinos
- **No hay panel de administración**, a propósito. Las cuentas se ven en Supabase → *Authentication → Users*.
- **Privacidad (NF-06):** el pin de cada vecino está en `residentes.ubicacion`. Ningún endpoint lo devuelve, y tampoco se exporta ni se comparte desde el panel o el editor SQL. Para cualquier análisis, usa solo datos por sector.
- **Si un vecino pide que borren su cuenta, todavía no hay un procedimiento.** Borrar el usuario en Auth **no** borra su fila de `residentes` (no hay clave foránea a `auth.users`), así que el pin seguiría guardado. Y `reportes` apunta a `residentes` sin cascada. Antes de la primera baja hay que decidir qué pasa con sus reportes y registrarlo como una decisión nueva.
- **Reportes falsos:** no se moderan. Un aviso aislado no cambia el mapa, porque hacen falta N vecinos distintos. Las cuentas falsas en masa (Sybil) son una limitación conocida y están fuera del alcance (`CLAUDE.md` §2).
- **Cortes:** el mantenedor no los confirma ni los cierra a mano. Lo hacen el consenso y el vencimiento programado de la API.

### 3.8 Rotar claves
- **Contraseña de la base:** en Supabase → *Project Settings → Database → Reset database password*. Después, actualizar `DATABASE_URL` en Render y en tu `.env`. Al mostrarla o revisarla, nunca enseñes parte del valor.
- **Claves JWT de Supabase:** la API lee el JWKS (con caché de 10 min como máximo), así que no hay que cambiar nada en Render.
  - Supabase deja la clave anterior en el JWKS hasta que la revocas, así que los tokens ya emitidos valen hasta que vencen.
  - Si la revocas, cada vecino tiene que volver a entrar.
  - La clave tiene que seguir siendo ES256 ([`despliegue.md`](despliegue.md) §1.3).
- **`RENDER_API_KEY` y `VERCEL_TOKEN`:** se crean de nuevo en cada panel y se reemplazan en los environments `prod-api` y `prod-web` de GitHub.

---

## 4. Si algo falla

| Síntoma | Causa probable | Dónde se arregla |
|---|---|---|
| El mapa sale gris y dice "datos no actualizados" aunque haya red | La API está dormida o caída, o Supabase está pausado | §3.4 y §3.5 |
| Todo lo que pide sesión da 401 | La clave JWT en uso es la HS256 heredada | [`despliegue.md`](despliegue.md) §1.3 |
| Nadie puede crear cuenta | *Confirm email* está activado (`mailer_autoconfirm: false`) | [`despliegue.md`](despliegue.md) §1.4 y §6 |
| Errores de CORS en la consola | Falta la URL de la web en `CORS_ORIGINS` | Render, §3.6 |
| La web en blanco con "Invalid supabaseUrl" | Hay `VITE_*` marcadas como *Sensitive* | Vercel, §3.6 |
| El mapa no cambia sin recargar | `estado_sector` salió de la publicación `supabase_realtime` | §3.2, paso 3 |
| El registro rechaza un pin dentro de la ciudad (`PIN_FUERA_DE_ZONA`) | La zona no está sembrada | `pnpm db:seed` (§3.3) |
| `desplegar-api` o `desplegar-web` se saltan | Falta `RENDER_SERVICE_ID` o `VERCEL_PROJECT_ID` en las variables del repo | [`despliegue.md`](despliegue.md) §5 |
