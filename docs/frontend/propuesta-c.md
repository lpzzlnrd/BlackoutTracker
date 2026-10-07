# Propuesta C · Datos primero · «Grafito»

> **Referencias:** [`c-telefono.html`](referencia/c-telefono.html) (390 × 844) y [`c-escritorio.html`](referencia/c-escritorio.html) (1280 × 860).
> **Tokens:** [`tokens/comun.css`](tokens/comun.css) + [`tokens/c.css`](tokens/c.css). Si una tabla de este documento y un token difieren, manda el token; si el token y la referencia difieren, manda la referencia.
> **Fundamentos que no se repiten aquí:** [`CANON.md`](CANON.md) (responsive, estados, mapa, iconos, textos, accesibilidad).

## 1. Qué es

El **Panel** es la pantalla de entrada: un resumen por estado, un minimapa y la lista de todos los sectores con su estimación, el rango habitual y el n. En escritorio es una tabla completa con el rango intercuartílico dibujado; el mapa y los cortes recientes acompañan a un lado.

- **Para qué sirve:** es la más densa y precisa. Muestra mediana, cuartiles y n, que es lo que sostiene la estimación estadística del proyecto; sirve también como alternativa accesible al mapa.
- **Su costo:** es la más fría y técnica para un vecino que solo mira de pasada; "cuartiles" es jerga; el texto es más pequeño (desde 12 px); suma dos fuentes web.
- **Carácter visual:** **la interfaz no tiene color de marca**: negros, grises y blancos. El único color que aparece es el de los estados, así que en el mapa y en los chips nada compite con él. El botón principal es negro; el foco, el único azul de la interfaz.

## 2. Tokens, tipografía y formas

### Color

| Token             | Claro     | Oscuro    | Dónde se usa en C                                                                                       |
| ----------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `--fondo`         | `#fafafa` | `#09090b` | Fondo de la página y del teléfono                                                                       |
| `--superficie`    | `#ffffff` | `#131316` | Tarjetas, barras, filas de la lista (la del sector propio), navegación inferior                         |
| `--superficie-2`  | `#f4f4f5` | `#1c1c21` | Franja de conexión, fondo del selector, encabezados de lista y de tabla, chip "Sincronizado", pestaña activa de escritorio |
| `--borde`         | `#e4e4e7` | `#27272a` | **Todas las líneas finas** (separadores, bordes de tarjetas, pista de la barra de rango); píldora de la pestaña activa del teléfono |
| `--borde-2`       | `#d4d4d8` | `#3f3f46` | Borde de la franja de conexión y del selector                                                           |
| `--borde-control` | `#8e8e98` | `#6b6b76` | Reservado para campos de formulario (no hay ninguno dibujado)                                           |
| `--texto`         | `#18181b` | `#fafafa` | Texto principal; borde de la etiqueta "Tu sector"; marca de la mediana; contorno de "tu sector" |
| `--texto-2`       | `#3f3f46` | `#d4d4d8` | Navegación inactiva, botón inactivo del selector, chip "Sincronizado"                                   |
| `--secundario`    | `#52525b` | `#a1a1aa` | Texto de apoyo, encabezados, notas                                                                      |
| `--acento`        | `#18181b` | `#fafafa` | Botón activo del selector, píldora de "Reportar" del teléfono, insignia numérica del botón de pendientes, logo |
| `--sobre-acento`  | `#fafafa` | `#09090b` | Texto e icono sobre el acento                                                                           |
| `--foco`          | `#2563eb` | `#60a5fa` | Anillo de foco                                                                                          |
| `--barra-rango`   | `#a1a1aa` | `#71717a` | Tramo del rango intercuartílico (_extrapolado en oscuro_)                                               |
| `--mapa-base`     | `#eeeeef` | `#1a1f29` | Fondo del mapa                                                                                          |

`--acento-suave` y `--tinta-acento` existen por compatibilidad (valen lo mismo que `--superficie-2` y `--texto`); C no usa un acento de color. Los estados (azul, ámbar, bermellón, gris) son los de [`CANON.md`](CANON.md) §3.

### Tipografía

**IBM Plex Sans** (400, 500 y 600) para el texto e **IBM Plex Mono** (400 y 500) para los números que se comparan: horas, duraciones, recuentos. `--fuente-ui: 'IBM Plex Sans', system-ui, sans-serif` y `--fuente-mono: 'IBM Plex Mono', ui-monospace, monospace`, autoalojadas ([`PWA.md`](PWA.md) §8).

| Rol                                        | Tamaño / peso                   | Notas                                                                  |
| ------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------- |
| Franja de conexión                         | 13 / 500                        | La hora, en mono                                                       |
| Título del sector (teléfono, `h1`)         | 18 / 600                        |                                                                        |
| Marca (escritorio)                         | 16 / 600                        | Logo de 26                                                             |
| Botones del selector                       | 14 / 600                        | Icono de 16                                                            |
| Resumen por estado (chips)                 | 13 / 600                        | El número, en mono                                                     |
| Encabezado de la lista (teléfono)          | 12 / 600 `--secundario`         |                                                                        |
| Nombre de sector (lista)                   | 15 / 600                        |                                                                        |
| Etiqueta "Tu sector"                       | 12 / 600                        | Borde 1 px `--texto`, radio 4, `padding: 0 6px`                        |
| Chip de estado (lista y tabla)             | 13 / 600                        | Icono compacto de 14, trazo 2,6                                        |
| Texto de apoyo de la lista                 | 13 `--secundario` ("desde 14:20", "2 de 3 reportes") | Los numerales, en mono                         |
| Estimación (lista)                         | mono 15 / 500, alineada a la derecha | "aprox. 4 h"; debajo, 12 `--secundario` ("12 cortes")             |
| "Datos insuficientes" (lista)              | 14 / 500                        | Debajo, "3 de 5 cortes" (12, `--secundario`)                           |
| Fila de pendiente (lista)                  | 13 / 500                        | La hora, en mono                                                       |
| Etiquetas de la navegación inferior        | 12 / 600                        |                                                                        |
| Navegación de escritorio                   | 14 / 600 activa, 14 / 500 el resto |                                                                     |
| Tabla: título (`h1`)                       | 20 / 600                        | Apoyo "4 sectores · actualizado a las {hora}" en 13 `--secundario`     |
| Tabla: encabezados                         | 12 / 600 `--secundario`         |                                                                        |
| Tabla: celdas                              | 14; sector 600; estimación mono 500; hora y cortes mono |                                                          |
| Tabla: texto del rango                     | mono 12 `--secundario`          |                                                                        |
| Nota de la tabla                           | 12 `--secundario`, `line-height: 1.5` |                                                                  |
| Tarjetas laterales (`h2`)                  | 16 / 600                        | Filas: nombre 14 / 600, apoyo 12 `--secundario`, duración mono 13      |
| Atribución                                 | 12 `--secundario`               |                                                                        |

### Formas

| Token                | Valor     | Dónde                                                                                                |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `--radio-etiqueta`   | 4 px      | Etiqueta "Tu sector"; tramos de la barra de rango                                                    |
| `--radio-chip`       | 6 px      | Chips de estado, chip "Sincronizado", chip "En curso"                                                |
| `--radio-control`    | 8 px      | Botones del selector, botón de pendientes (icono), elementos de la navegación, píldora de la pestaña |
| `--radio-boton`      | 8 px      | Botón principal                                                                                      |
| `--radio-bloque`     | 6 px      | Fila de pendiente de la lista                                                                        |
| `--radio-tarjeta`    | 10 px     | Tarjetas de escritorio, contenedor del selector                                                      |
| `--sombra-tarjeta`   | `none`    | **Sin sombras**: la separación la dan las líneas finas                                               |

Otros radios sueltos: contenedor del selector 10 (`--radio-tarjeta`); minimapa de escritorio 8; insignia numérica 9.

## 3. Teléfono (`c-telefono.html`, 390 × 844)

Raíz: `display: flex; flex-direction: column; width: 390px; height: 844px; overflow: hidden; background: var(--fondo)`. Bandas apiladas; en producción `min-height: 100dvh`.

| Banda (comentario en la referencia) | Caja                                                                             | Contenido                                                                                                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aviso de PWA: sin conexión**      | `flex: none`; alto 36; `padding: 0 16px`                                         | `role="status"`; `--superficie-2`; borde inferior 1 px `--borde-2`; `gap: 8px`; 13 / 500; icono `wifi-off` de 16. "Sin conexión · datos no actualizados ({hora en mono})".                                                                                                       |
| **Barra superior**                  | `flex: none`; alto 60; `padding: 0 16px`; `space-between`; `gap: 8px`            | **Izquierda** (`gap: 8px`): botón de pendientes + `h1` con el nombre (18 / 600). **Derecha:** selector de servicio. Ver abajo.                                                                                                                                                  |
| **Mini mapa**                       | `flex: none`; 390 × 220; borde superior e inferior 1 px `--borde`                | Coropleta a escala 0,47 ([`CANON.md`](CANON.md) §4.4). **Sin insignias ni la palabra "Sector"**: etiquetas con los **números 1 a 4**, IBM Plex Mono 700 de 18 px, con halo; trazo 1,4 px, contorno de "tu sector" 3,3 px. El mapa va centrado y entero (`meet`), con las calles continuando a los lados. |
| **Resumen por estado**              | `flex: none`; `flex-wrap: wrap`; `gap: 6px`; `padding: 10px 16px`                | Chips de recuento: `padding: 4px 8px`, radio 6, 13 / 600, `gap: 6px`, `nowrap`, icono compacto de 14. Cada uno: icono + **número en mono** + texto: "1 Sin servicio", "1 Sin confirmar", "2 Con servicio". Al final, `margin-left: auto`, la atribución de OSM (12, `--secundario`). |
| **Lista de sectores**               | `flex: 1; min-height: 0`                                                         | Encabezado y filas. **Hace scroll**; las filas llevan `flex: none` ([`CANON.md`](CANON.md) §2). Ver abajo.                                                                                                                                                                       |
| **Navegación inferior**             | `flex: none`; alto 72; `padding: 6px 8px 14px`; `space-around`                   | `--superficie`; borde superior 1 px `--borde`. Panel · Mapa · Reportar · Cuenta. Ver abajo.                                                                                                                                                                                      |

### Barra superior

- **Botón de pendientes** (solo icono): 44 × 44, radio 8, fondo `--estado-sin-confirmar-chip`, borde 1 px `--estado-sin-confirmar-trazo`, icono `clock` de 20 (trazo 2,2) en `--estado-sin-confirmar-tinta`. `aria-label="{n} aviso(s) pendiente(s) de envío"`. **Insignia numérica:** `position: absolute; right: -6px; top: -6px`, `min-width: 18px`, alto 18, `padding: 0 4px`, radio 9, fondo `--acento`, texto `--sobre-acento`, mono 11 / 500, `line-height: 18px`. Solo se muestra si hay pendientes.
- **Selector de servicio:** contenedor con `padding: 3px`, `gap: 2px`, radio 10, fondo `--superficie-2`, borde 1 px `--borde-2`. Dos botones de **70 × 44**, radio 8, 14 / 600, `gap: 6px`, icono de 16. Activo: fondo `--acento`, texto `--sobre-acento`. Inactivo: transparente, texto `--texto-2`. `aria-pressed`.

### Lista de sectores

Encabezado: alto 32, `padding: 0 16px`, fondo `--superficie-2`, bordes superior e inferior de 1 px `--borde`, 12 / 600 `--secundario`; a la izquierda "Sector" (`h2`), a la derecha "Duración típica". Después, una `ul` sin viñetas con una `li` por sector: `padding: 10px 16px`, borde inferior 1 px `--borde`. **La fila del sector propio** va sobre fondo `--superficie` y lleva su aviso en cola.

Cada fila, con `display: flex; justify-content: space-between; align-items: flex-start; gap: 12px`:

- **Izquierda:** nombre (15 / 600) y, para el sector propio, la etiqueta "Tu sector" a su lado (`gap: 8px`). Debajo (margen 6): el **chip de estado** compacto (`padding: 2px 8px`, radio 6) y, a su lado (`gap: 8px`), el apoyo en 13 `--secundario`: "desde {hora}" si hay corte; "{k} de {N} reportes" si hay reportes sin confirmar.
- **Derecha** (alineada a la derecha): la estimación en mono 15 / 500 ("aprox. 4 h", "aprox. 3 h 40 min") y debajo, margen 2, "{n} cortes" (12, `--secundario`). Si no hay cifra: "Datos insuficientes" (14 / 500) y "{n} de {nMin} cortes".
- **Fila de pendiente** (solo si hay un aviso en cola; ocupa todo el ancho bajo la fila, margen superior 8): `padding: 6px 8px`, radio 6, fondo `--estado-sin-confirmar-chip`, texto `--estado-sin-confirmar-tinta` 13 / 500, `gap: 8px`; icono `clock` de 14 (trazo 2,2). "Tu aviso «Volvió la luz» ({hora en mono}) · pendiente".

### Navegación inferior

Elementos `<a>`: columna centrada, `gap: 2px`, `min-width: 72px`, `min-height: 52px`, 12 / 600; píldora de **56 × 30** con radio **8** y icono de 22. Activo (Panel): píldora `--borde`, icono y etiqueta `--texto`, `aria-current="page"`. Inactivos (Mapa, Cuenta): `--secundario`, sin píldora. **Reportar:** píldora `--acento`, icono `--sobre-acento` (`plus`, trazo 2,4), etiqueta `--texto`. Iconos: `grid`, `map`, `plus`, `user`.

## 4. Escritorio (`c-escritorio.html`, ≥ 1024 px)

Raíz: `min-height: 860px; background: var(--fondo)`.

| Bloque                  | Regla y caja                                                                                                              | Contenido                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Barra superior**      | `padding: 6px 24px`; `flex-wrap: wrap`; `align-items: center`; `space-between`; `gap: 12px`; `--superficie`; borde inferior 1 px `--borde` | Izquierda (`gap: 24px`, con `flex-wrap`): marca y navegación. Derecha (`gap: 16px`): estado de sincronización y selector.                  |
| **Contenido** (`main`)  | `padding: 24px`; `flex-wrap: wrap`; `gap: 24px`; `align-items: flex-start`                                                | Tabla y columna derecha                                                                                                                            |
| **Tabla de sectores**   | `flex: 999 1 800px; min-width: 0`; `--superficie`; borde 1 px `--borde`; radio 10                                         | Ver abajo                                                                                                                                          |
| **Columna derecha**     | `flex: 1 1 340px; min-width: 0`; **rejilla** `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`, `gap: 24px`, `align-items: start` | Mapa y cortes recientes. Apilados en una columna estrecha; **lado a lado** cuando la columna ocupa todo el ancho.                         |

**Cómo se reparten (verificado):** a 1280 px, tabla 868 y columna 340, lado a lado. Por debajo de unos 1212 px la base de 800 de la tabla no cabe junto a la columna: **la tabla pasa a todo el ancho y las dos tarjetas laterales quedan debajo, una junto a la otra**. A 1024 px la tabla muestra todas sus columnas sin desplazarse.

- **Marca y navegación:** logo de 26 + "BlackoutTracker" 16 / 600; elementos de navegación de `min-height: 44px`, `padding: 0 12px`, radio 8, 14, `gap: 8px`, icono de 18. Activo (Panel): fondo `--superficie-2`, texto `--texto`, 600. Inactivos: `--texto-2`, 500. Iconos: `grid`, `map`, `plus-circle`, `user`.
- **Estado de sincronización** (`role="status"`): chip de `padding: 4px 8px`, radio 6, `--superficie-2`, `--texto-2`, 13 / 500, `white-space: nowrap`, icono `check` de 14 (trazo 2,4) + "Sincronizado · {hora en mono}". Sin conexión, se reemplaza por "Sin conexión · datos no actualizados ({hora})" con `wifi-off`.
- **Selector de servicio:** el de §3 con botones de **84 × 44**.

### Tabla de sectores

- **Cabecera de la tarjeta:** `padding: 16px 16px 12px`, `flex-wrap: wrap`, `align-items: baseline`, `space-between`. `h1` "Sectores · Luz" (20 / 600; el servicio cambia con el selector) y "4 sectores · actualizado a las {hora}" (13, `--secundario`).
- **Tabla:** ancho completo dentro de un contenedor `overflow-x: auto`; `font-size: 14px`; `white-space: nowrap`. Encabezado con fondo `--superficie-2`, `th` de 12 / 600 `--secundario`, `padding: 8px 12px` (8 16 en la primera y la última), bordes superior e inferior de 1 px `--borde`. Columnas, en orden: **Sector** (`th scope="row"`, `padding: 12px 16px`, 600; el propio lleva la etiqueta "Tu sector" pegada al nombre, sin espacio en blanco entre ambos, con `margin-left: 12px`) · **Estado** (chip compacto; con reportes sin confirmar, debajo "{k} de {N} reportes" en 12 `--secundario`) · **Desde** (mono) · **Estimación (mediana)** (mono 500) · **Rango habitual (cuartiles)** · **Cortes** (mono, alineada a la derecha, `padding: 12px 16px`). Celdas con `padding: 12px` y borde inferior 1 px `--borde` (la última fila, sin él). Sin dato: "—" en `--secundario`.
- **Rango habitual:** una barra de **140 × 8** (`position: relative`, radio 4, fondo `--borde`) con un tramo (`position: absolute; top: 0; bottom: 0`, radio 4, `--barra-rango`) de `left = q1/480` y `width = (q3 − q1)/480`, y la **marca de la mediana**: `position: absolute; top: -4px; width: 2px; height: 16px; background: var(--texto)` en `left = mediana/480` (porcentajes de un eje de 0 a 8 h). Debajo (margen 6): "2 h 30 min – 6 h" en mono 12 `--secundario`. Sin cifra suficiente, solo "—".
- **Nota al pie:** `padding: 12px 16px 16px`, 12 `--secundario`, `line-height: 1.5`: "La estimación es la mediana de los cortes cerrados del sector. Con menos de {nMin} cortes no se muestra una cifra."

### Columna derecha

- **Mapa:** tarjeta de `padding: 16px`, radio 10; `h2` "Mapa" (16 / 600, margen inferior 12); el mapa cuadrado (`aspect-ratio: 1 / 1`), con borde 1 px `--borde` y radio 8; escala 0,65 ([`CANON.md`](CANON.md) §4.4), etiquetas con la palabra "Sector" y las insignias; debajo (margen 8) la atribución de OSM.
- **Cortes recientes:** tarjeta de `padding: 16px`; `h2` 16 / 600 (margen inferior 4). **Los 4 cortes con inicio más reciente de todos los sectores y servicios.** Filas de `padding: 10px 0`, `space-between`, `gap: 12px`, línea inferior 1 px `--borde` (la última, sin línea). Izquierda (`gap: 10px`): icono del servicio de 18 (`zap` / `droplet`, `role="img"` con `aria-label` "Luz" / "Agua") y, en columna, "Sector {n}" (14 / 600) y el apoyo (12, `--secundario`): "En curso desde las {hora}" o "{día}, {inicio} – {fin}" (las horas en mono). Derecha: el chip "En curso" (`white-space: nowrap`, `padding: 2px 8px`, radio 6, colores de "sin servicio", 13 / 600) o la duración (mono 13).

## 5. Lo que las maquetas no dibujan (definido aquí)

- **Orden de la tabla y de la lista:** por número de sector. Ordenar por columnas no es parte del MVP.
- **Tocar una fila (o un polígono del minimapa):** abre el Mapa con ese sector seleccionado ([`propuesta-a.md`](propuesta-a.md) §3 y §5).
- **Reportar:** la pestaña lleva a la pantalla de reporte, que no está dibujada. Se arma con los mismos primitivos; el botón principal es negro (`--acento`).
- **Botón de pendientes:** abre una hoja con la cola ([`propuesta-a.md`](propuesta-a.md) §5).
- **Cargando:** filas de `--superficie-2` con el alto de una fila real. **Sin datos:** chip gris en cada fila y el aviso de conexión; el minimapa con polígonos de "sin datos".
- **Filtro de servicio:** cambia el título de la tabla ("Sectores · Agua") y todas sus cifras; el mapa y los cortes recientes no se filtran por servicio (los cortes recientes muestran el icono de cada uno).
- **Teléfono entre 360 y 640 px:** la lista ocupa todo el ancho; por encima de 640, la columna se centra con `max-width: 640px`.
- **Modo oscuro:** con los tokens oscuros; la barra de rango usa `#71717a`.

## 6. Receta de construcción

1. Autoaloja IBM Plex Sans (400, 500, 600) e IBM Plex Mono (400, 500) ([`PWA.md`](PWA.md) §8). Importa `tokens/comun.css`, `tokens/c.css` y `tokens/tailwind.css`; `data-diseno="c"` en `<html>`.
2. `Icono` ([`CANON.md`](CANON.md) §5).
3. Primitivos: `EstadoChip` (siempre compacto) → `ChipSync` → `AvisoConexion` → `BotonPendientes` (variante icono con insignia) → `SelectorServicio` (70 y 84) → `Numero` (envuelve horas y cifras en la fuente mono).
4. Pieza nueva de esta propuesta: **`BarraRango`**, con los porcentajes de §4. Cuenta con una prueba unitaria: para `q1 = 150`, `q3 = 360` y `mediana = 240` debe dar `left 31 %`, `ancho 44 %`, marca en `50 %`.
5. Teléfono: `MinimapaSectores` (escala 0,47, números), `ResumenEstados`, `ListaSectores` y `NavInferior`; el apilado de §3.
6. Escritorio: `NavSuperior`, `TablaSectores`, `MinimapaSectores` (escala 0,65) y `CortesRecientes`; el ensamblado de §4.
7. Datos ([`datos.md`](datos.md)): el Panel necesita las estimaciones de **todos** los sectores y los cortes recientes de todos; esas dos peticiones están descritas ahí. Primero, con `datos-ejemplo.json`.
8. Pruebas de fidelidad ([`CANON.md`](CANON.md) §11) en 390 × 844 y en 1280 × 860 (y 1024).

## 7. Lista de comprobación

- [ ] `node docs/frontend/herramientas/verificar-tokens.mjs` sin problemas.
- [ ] Fuentes autoalojadas; las horas, duraciones y recuentos salen en mono.
- [ ] Teléfono a 390 × 844 con `?demo=sin-conexion`: ≤ 1 % de diferencia con `c-telefono.html`, mapa oculto.
- [ ] Escritorio a 1280 × 860 y a 1024 con `?demo=en-linea`: ≤ 1 % de diferencia con `c-escritorio.html`, mapa oculto.
- [ ] A 1024 px la tabla se ve completa, sin cortar ninguna columna ni partir ningún chip.
- [ ] La barra de rango de cada fila coincide con `datos-ejemplo.json` (31 / 44 / 50 %, 29 / 31 / 46 %, 25 / 21 / 35 %).
- [ ] "Cortes recientes" muestra los 4 de inicio más reciente, en el orden Sector 1, 3, 4, 2 con los datos de ejemplo.
- [ ] Todo lo tocable mide al menos 44 × 44; axe sin violaciones graves.
