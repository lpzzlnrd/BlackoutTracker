# Dataset de campo

Los ciclos de corte que se recogen en las entrevistas de la campaña de campo (fase 1) se cargan como
eventos de sector **cerrados** con `origen = 'campo'`. Entran a la mediana igual que los confirmados por
consenso (D-008), así la estimación tiene datos desde el primer día. Lo implementa T-044 (D-025).

## Formato del CSV

```csv
sector,tipo_servicio,inicio,fin
Guaparo Noroeste,electricidad,2026-09-02T14:10:00-04:00,2026-09-02T17:40:00-04:00
Guaparo Sureste,agua,2026-09-05T05:00:00-04:00,2026-09-05T21:00:00-04:00
```

- **Cabecera obligatoria** `sector,tipo_servicio,inicio,fin`, en ese orden (sin distinguir mayúsculas).
- **`sector`:** el nombre del sector tal como está en `sectores.nombre` (el `properties.nombre` del
  GeoJSON). No distingue mayúsculas ni espacios de más.
- **`tipo_servicio`:** `agua` o `electricidad`.
- **`inicio` y `fin`:** ISO 8601 con fecha, hora y **zona** (`-04:00` para Venezuela, o `Z`). Sin zona
  la hora sería ambigua y la fila se rechaza.
- Solo **ciclos completos**: `fin` es obligatorio y debe ser **posterior** a `inicio`. Ninguno puede estar
  en el futuro.
- Separador `,`. Un campo con coma va entre comillas dobles. Las líneas vacías y las que empiezan por
  `#` se ignoran (sirven de comentario).

## Cargarlo

```bash
pnpm db:seed                          # los sectores tienen que existir antes
pnpm db:seed:campo ruta/al/archivo.csv
```

- Las filas inválidas se informan con su número de línea y su motivo, y **no** se insertan; las válidas
  sí. Si hubo alguna inválida, el script sale con código 1.
- Es **idempotente**: una fila con el mismo sector, servicio, inicio y fin que un evento de campo ya
  cargado se cuenta como "ya cargada". Se puede volver a correr con el CSV ampliado.
- Se rechaza una fila que se solapa con otro ciclo del mismo sector y servicio (en el archivo o ya
  guardado, de campo o de consenso): un sector no puede tener dos cortes a la vez.

`data/campo.ejemplo.csv` es un **ejemplo sintético**, no datos reales: sirve para probar el script y como
base del seed de la demo (T-061).
