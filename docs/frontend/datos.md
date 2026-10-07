# Canon del frontend · datos

> Qué datos necesita cada pantalla de las maquetas, de dónde salen según [`PLAN.md`](../PLAN.md) §4 y §5, y **qué le falta hoy a la API planificada** para mostrar exactamente lo que dibujan los diseños.
> La forma de los datos es **provisional** hasta que exista `packages/shared` (T-002): los nombres siguen el plan (`tipoServicio`, `inicioEn`, `sectorId`…).

## 1. Datos de ejemplo

[`datos-ejemplo.json`](datos-ejemplo.json) contiene **exactamente** los datos que muestran las maquetas. Se comprobó cadena por cadena: con los formateadores de [`CANON.md`](CANON.md) §7.1, el JSON produce todas las horas, duraciones, recuentos, barras de rango y el orden de "Cortes recientes" de las referencias.

- `ahora` = `2026-10-07T19:06:00Z`, las **15:06 en Caracas** (UTC−4). Todo el reloj de la app en modo demostración se fija ahí.
- Dos escenarios, que cambian solo la conexión y la cola:

  | Escenario        | `enLinea` | Última sincronización | Cola                                         | Lo usan                          |
  | ---------------- | --------- | --------------------- | -------------------------------------------- | -------------------------------- |
  | `sin-conexion`   | no        | 14:32                 | 1 aviso: cierre de luz de las 15:04, _pendiente_ | Los **teléfonos** de A, B y C |
  | `en-linea`       | sí        | 15:06                 | vacía                                        | Los **escritorios** de A, B y C  |

- Los cuatro sectores son de ejemplo (`Sector 1` … `Sector 4`): los reales dependen de D-005. La geometría no está en el JSON: viene de `GET /sectores`.

## 2. Qué necesita cada pantalla

La columna "Estado" dice si la API del plan ya lo da (**sí**), si hay que calcularlo en el cliente (**cliente**) o si es un **hueco** (§3).

### A · Mapa

| Dato                                                    | Fuente                                                          | Estado     |
| ------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| Geometría de los sectores                               | `GET /sectores` (T-014)                                         | sí         |
| Estado de cada sector y servicio (color del mapa, chips) | `estado_sector`, lectura directa por Supabase (REST y Realtime) | sí         |
| Sector del residente ("Tu sector")                      | `GET /residentes/me`                                            | sí         |
| Estimación del sector seleccionado                      | `GET /estimaciones?sectorId&tipoServicio` (T-042)               | sí         |
| Últimos cortes del sector (5 como máximo)               | El evento en curso (de `estado_sector`) más los cerrados de `GET /sectores/:id/historial?tipoServicio` (primera página; solo trae eventos cerrados, T-034) | sí |
| "Confirmado por **3** vecinos"                          | —                                                               | **hueco P2** |
| "**2 de 3** reportes" (leyenda y chips)                 | N = umbral de consenso                                          | **hueco P1** |
| "**3 de 5** cortes" (datos insuficientes)               | `nMin` = mínimo para dar cifra                                  | **hueco P1** |
| Cola de avisos y hora de la última sincronización       | Dexie y el cliente                                              | cliente    |

### B · Inicio

| Dato                                                          | Fuente                                                          | Estado     |
| ------------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| Estado y estimación de **ambos servicios** del sector propio  | `GET /sectores/:id/resumen` (T-043)                             | sí         |
| Historial del sector propio, ambos servicios (tabla)          | `resumen` (últimos 5 eventos) o `historial` sin filtrar servicio | sí (ver nota) |
| "Última interrupción: hace 2 días, duró 5 h"                  | El último evento cerrado del servicio, de `resumen`/`historial` | sí         |
| Otros sectores: **peor estado entre servicios**               | Las filas de `estado_sector` (orden: sin servicio, sin confirmar, con servicio) | cliente |
| Geometría y estados del minimapa                              | `GET /sectores` y `estado_sector`                               | sí         |
| "{n} vecinos lo confirmaron", "{k} de {N} reportes", "{n} de {nMin} cortes" | —                                                  | **huecos P1 y P2** |

_Nota:_ la tabla de B mezcla servicios y la lista de A está filtrada por servicio. Conviene que `resumen` devuelva los eventos de **cada servicio** (5 por servicio) y que el cliente los mezcle y ordene; así B y A salen del mismo dato.

### C · Panel

| Dato                                                           | Fuente                                                      | Estado        |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ------------- |
| Estados de todos los sectores (tabla, recuento, mapa)          | `estado_sector`                                             | sí            |
| **Estimación de todos los sectores** de un servicio (mediana, cuartiles, n) | `GET /estimaciones?sectorId&tipoServicio` por sector | **hueco P3** (4 llamadas) |
| **Cortes recientes de todos los sectores** (los 4 de inicio más reciente) | —                                              | **hueco P4**  |
| "{k} de {N} reportes", "{n} de {nMin} cortes"                  | —                                                           | **huecos P1** |

## 3. Peticiones al backend

Son **propuestas para que decidas tú** (no están en `PLAN.md` ni en `DECISIONES.md`). Cada una es aditiva: no cambia nada de lo ya planificado. Si las aceptas, pasan a `DECISIONES.md` y a la tarea que las implementa.

### P1 · Los umbrales, visibles para el cliente

**Falta:** el diseño dice "2 de **3** reportes" y "3 de **5** cortes". Esos números son `CONSENSO_N` y `ESTIMACION_N_MIN`, que son variables de entorno (D-006): el front no los conoce.
**Propuesta mínima:** un `GET /configuracion` público (con `Cache-Control` de una hora) que devuelva `{ "consensoN": 3, "estimacionNMin": 5 }`. Es lo que usa `datos-ejemplo.json` (`config`). _Encaja en:_ T-003 (esqueleto) o T-042.
**Alternativa:** incluir `nMin` en cada respuesta de estimación y `consensoN` en cada fila de `estado_sector`. Duplica el dato y obliga a tocar el esquema; no se recomienda.

### P2 · Cuántos vecinos confirmaron el corte

**Falta:** A y C muestran "confirmado por **3** vecinos" y B "**3** vecinos lo confirmaron". El modelo guarda que se alcanzó el umbral, no cuántos residentes distintos reportaron.
**Propuesta mínima:** una columna `confirmaciones smallint` en `eventos_sector`, con el número de residentes distintos de la ventana que lo confirmó, y que `estado_sector` y `resumen` la expongan junto a `desde`. No revela quiénes son. _Encaja en:_ T-010 (esquema) y T-032 (consenso).
**Si no se acepta:** el texto cambia a "confirmado por vecinos" (sin número) en las tres propuestas. Mostrar el umbral N como si fuera el recuento sería inexacto: pueden haber reportado más de N.

### P3 · Estimaciones de todos los sectores en una llamada

**Falta:** el Panel de C necesita la estimación (mediana, q1, q3, n) de **todos** los sectores de un servicio. El plan la da por sector.
**Propuesta mínima:** que `GET /estimaciones?tipoServicio=…` **sin** `sectorId` devuelva la lista, una entrada por sector con su `sectorId`. Con 4 sectores, 4 llamadas también funcionan, pero no escalan. _Encaja en:_ T-042 (es un `GROUP BY sector_id` sobre la misma consulta).

### P4 · Cortes recientes de todos los sectores

**Falta:** "Cortes recientes" de C lista los 4 eventos con inicio más reciente de **todos** los sectores y servicios. El plan solo da el historial por sector.
**Propuesta mínima:** `GET /eventos/recientes?limite=4`, que devuelva `{ sectorId, tipoServicio, inicioEn, finEn | null }`, ordenado por `inicioEn` descendente. Son datos agregados por sector, sin información personal (NF-06). _Encaja en:_ T-034.

## 4. Tareas del plan que alimentan al frontend

| Tarea del plan | Qué habilita en las maquetas                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| T-014          | La geometría del mapa                                                              |
| T-015          | "Tu sector" (`GET /residentes/me`)                                                 |
| T-021, T-022   | Enviar los avisos de la cola (inicio y cierre idempotentes)                        |
| T-023          | Recuperar los avisos propios en otro dispositivo (`GET /reportes/mios`)            |
| T-032, T-035   | El estado por consenso en `estado_sector` y su llegada por Realtime                |
| T-034          | Últimos cortes (A) e historial (B)                                                 |
| T-042, T-043   | La estimación con su n y el resumen del sector                                     |
| T-002          | Los tipos y los códigos de error (`CodigoError`): con ellos se completa la tabla código → mensaje en español, que aquí queda pendiente |

Mientras esas tareas no existan, el frontend se construye contra `datos-ejemplo.json` en modo demostración ([`CANON.md`](CANON.md) §11).
