# Demo y checklist de la defensa

> T-061. Cómo dejar el sistema listo para mostrarlo y qué enseñar, en el orden de la Teoría General de Sistemas: entrada → proceso → salida → retroalimentación. La arquitectura está en [`arquitectura.md`](arquitectura.md); las decisiones, en [`DECISIONES.md`](DECISIONES.md).

## 1. El seed de demo

```bash
pnpm db:seed:demo               # sectores + historial + reportes en vivo
pnpm db:seed:demo --sin-corte   # solo sectores e historial (no levanta la app: basta con DATABASE_URL)
```

Deja la base así (D-027):

| Sector | Agua | Luz |
|---|---|---|
| Guaparo Noroeste | n = 7 → cifra | n = 11 → cifra, con un corte atípico de 30 h (EST-03) |
| Guaparo Noreste | n = 5 → cifra (justo n_min) · **2 reportes sin confirmar** | n = 3 → "datos insuficientes" (EST-04) |
| Guaparo Suroeste | n = 2 → "datos insuficientes" | n = 8 → cifra · **corte confirmado en curso** |
| Guaparo Sureste | n = 9 → cifra, con un corte atípico de 40 h | n = 6 → cifra |

- El **historial** sale de [`data/demo.csv`](../data/demo.csv): 51 ciclos sintéticos con fechas fijas de agosto a octubre de 2026. Se cargan con el importador del dataset de campo (T-044, `origen = 'campo'`). La estimación no filtra por antigüedad, así que estos ciclos no caducan.
- Los **reportes en vivo** pasan por el consenso real (`ReportesService.iniciar`). Son 3 vecinos de Suroeste reportando que se fue la luz dentro de la ventana de 30 min, lo que confirma el corte (CON-02), y 2 de Noreste reportando agua (CON-01: N − 1, sin confirmar). Los residentes de demo tienen ids fijos (`00000000-0000-4000-8000-00000000de0X`) y su ubicación es un punto interior del sector, no la de nadie.
- Es **idempotente**: correrlo de nuevo no duplica nada. El aviso "sin confirmar" de Noreste se ve unas 3 h, lo que dura la ventana del agua. El corte de Suroeste dura hasta que los reportes vencen a las 48 h (D-015); después queda como ciclo incompleto (D-024). Por eso conviene **correrlo la mañana de la defensa**: volver a correrlo arma un corte nuevo.
- Se niega a correr con `NODE_ENV=production` o con una URL de base que contenga "prod", salvo con `--forzar`. Una base local siempre se acepta. **No se siembra en producción si ya tiene datos de campo reales**, porque la demo los mezclaría en la mediana.

## 2. Guion

Con la API en Swagger (`https://<api>/api/docs`), autorizada con el JWT de una cuenta de demo (§3.3), y la PWA abierta en un teléfono.

### Entrada: los reportes
1. **Registro con validación geográfica (REG).** Poner el pin en la PWA: `POST /api/registro/validar-pin` responde con el sector, y `POST /api/residentes/me` crea el perfil. Si el pin cae fuera de Guaparo, la respuesta es 422.
   - Privacidad (NF-06): `GET /api/residentes/me` devuelve el sector, nunca las coordenadas.
2. **Reporte de inicio (REP).** Desde la PWA, "se fue la luz". En la API es `PUT /api/reportes/{id}` con el UUID que genera el cliente y la hora real `ocurridoEn` (OFF-03).
   - Repetir el mismo PUT devuelve el mismo reporte (OFF-05).
   - Abrir otro reporte del mismo servicio devuelve 409 (REP-05).

### Proceso: validación, consenso y estadística
3. **Consenso sin administrador (CON).** En Noreste hay 2 reportes de agua sin confirmar (`GET /api/sectores/{id}/resumen` → `reportesSinConfirmar: 2`). El estado no cambia con N − 1. Si un tercer vecino reporta agua, el sector pasa a "sin agua". Es la **homeostasis**: el sistema se regula sin nadie que modere.
4. **Estimación estadística (EST).** `GET /api/estimaciones?sectorId=…&tipoServicio=…`
   - Noroeste, luz: hay cifra con su n. El corte de 30 h no arrastra la mediana: por eso se usa la mediana y no el promedio.
   - Noreste, luz: con n = 3 < n_min = 5 responde "datos insuficientes".
   - Agua y luz nunca se mezclan (EST-05). Es el **isomorfismo**: la misma estructura de entrada, proceso y salida para los dos servicios.

### Salida: el mapa y el panel
5. **Mapa (VIS).** La coropleta muestra Suroeste sin luz y el resto con servicio. El mapa colorea polígonos, no puntos, así que nunca expone una vivienda.
6. **Panel del sector (VIS-04).** `GET /api/sectores/{id}/resumen` de Suroeste: el estado, "aprox. X h, según 8 cortes registrados" y los últimos cortes, con el de ahora en curso.
7. **Tiempo real (VIS-03).** Con dos teléfonos, cuando uno completa el consenso, el otro cambia de color sin recargar. Funciona porque Supabase Realtime publica `estado_sector`.

### Retroalimentación
8. **Cierre del ciclo (CON-06, EST-06).** Los vecinos de Suroeste reportan que volvió la luz (`PATCH /api/reportes/{id}/cierre`). El evento se cierra con la mediana de los cierres y la estimación de Suroeste pasa a n = 9. Cada ciclo cerrado mejora la estimación: esa es la retroalimentación.
9. **Conexión intermitente (OFF, NF-04).** En modo avión, reportar; la cola guarda el reporte en IndexedDB. Al volver la red, se sincroniza sin duplicados. El respaldo es la simulación de `pnpm test:int` (`red-intermitente.e2e-spec.ts`): unas 1000 peticiones con cortes, 0 pérdidas y 0 duplicados.

## 3. Checklist previo a la defensa

### Una semana antes
- [ ] **Supabase no pausado.** El plan gratuito pausa el proyecto tras unos 7 días sin actividad. Entrar al panel de staging (y de producción, si se usa) y, si está pausado, *Restore project*. El restablecimiento puede tardar unos minutos.
- [ ] **Cuentas de demo en Supabase Auth.** Las crea Leonardo en *Authentication → Users → Add user*, con correo y contraseña y *Auto confirm user*. Hacen falta dos cuentas, una por teléfono.
- [ ] Registrar cada cuenta en la PWA con un pin dentro de Guaparo (o con los dos POST del §2.1).
- [ ] Ensayar el guion completo una vez, de punta a punta.

### El día de la defensa
- [ ] **Despertar la API.** Render gratis se duerme sin tráfico. Abrir `https://<api>/api/salud` unos minutos antes y esperar `{"estado":"ok", …}` con la base conectada. El workflow `keepalive.yml` la mantiene despierta si la variable `API_URL` está configurada en el repo.
- [ ] **Sembrar la demo** contra staging, desde una máquina con el `.env` de staging:
  ```bash
  DATABASE_URL=<url de staging> pnpm db:seed:demo
  ```
  Antes, si hay migraciones nuevas: `pnpm db:migrate`.
- [ ] **JWT para Swagger:**
  ```bash
  curl -s -X POST 'https://<ref>.supabase.co/auth/v1/token?grant_type=password' \
    -H 'apikey: <anon key>' -H 'Content-Type: application/json' \
    -d '{"email":"<cuenta de demo>","password":"<clave>"}'
  ```
  Copiar `access_token` en *Authorize* de `/api/docs`. Dura 1 h por defecto: pedirlo justo antes.
- [ ] **Realtime.** Con dos teléfonos en la PWA, provocar un cambio y verificar que el otro lo ve sin recargar.
- [ ] **Plan B sin red.** Llevar capturas o un video del guion. La PWA instalada abre sin red y muestra "datos no actualizados" (OFF-07). Si falla Internet, se puede correr todo en local: `pnpm db:up && pnpm db:migrate && pnpm db:seed:demo && pnpm dev`.
- [ ] Tener a mano `docs/trazabilidad.md` (casos ↔ tests) y `docs/openapi.json`.

### Al cerrar la versión
- [ ] Tag de la versión. Lo pone Leonardo, sobre `main` y después de pasar `staging` a `main`:
  ```bash
  git switch main && git pull
  git tag -a v1.0.0 -m "BlackoutTracker v1.0.0 (defensa)"
  git push origin v1.0.0
  ```
