# Propuesta B · Estado primero · «Piedra y verde»

> **Referencias:** [`b-telefono.html`](referencia/b-telefono.html) (390 × 844) y [`b-escritorio.html`](referencia/b-escritorio.html) (1280 × 860).
> **Tokens:** [`tokens/comun.css`](tokens/comun.css) + [`tokens/b.css`](tokens/b.css). Si una tabla de este documento y un token difieren, manda el token; si el token y la referencia difieren, manda la referencia.
> **Fundamentos que no se repiten aquí:** [`CANON.md`](CANON.md) (responsive, estados, mapa, iconos, textos, accesibilidad).

## 1. Qué es

La pantalla de inicio responde directamente "¿qué pasa en **mi sector**?": una tarjeta por servicio (Luz y Agua, lado a lado en escritorio) con el estado, la estimación y la acción de reportar en el mismo lugar. El mapa pasa a segundo plano: es una tarjeta pequeña en escritorio y una pestaña en el teléfono.

- **Para qué sirve:** no necesita teselas para lo esencial, así que funciona bien sin conexión; los botones son grandes (52 px) y la letra es la más legible de las tres propuestas.
- **Su costo:** el mapa (requisito VIS-01) queda a un toque; hay más scroll en el teléfono; suma una fuente web.
- **Carácter visual:** cálido y amable: neutros de piedra, un verde apagado de acento, radios grandes (22 px en tarjetas) y sombras suaves. Atkinson Hyperlegible, diseñada para ser legible con poca visión y con distintas edades.

## 2. Tokens, tipografía y formas

### Color

| Token             | Claro     | Oscuro    | Dónde se usa en B                                                                          |
| ----------------- | --------- | --------- | ------------------------------------------------------------------------------------------ |
| `--fondo`         | `#f7f5f2` | `#12100e` | Fondo de la página y del teléfono                                                          |
| `--superficie`    | `#ffffff` | `#1c1916` | Tarjetas, barras superiores y navegación inferior                                          |
| `--superficie-2`  | `#f0ede8` | `#26221e` | Círculos de icono, bloques de estimación, franja de conexión                               |
| `--borde`         | `#e4e0d9` | `#34302a` | Bordes de tarjetas, borde superior de la navegación, líneas de la tabla y de las listas    |
| `--borde-2`       | `#cfc9bf` | `#4a443b` | Borde de la franja de conexión, línea bajo los encabezados de la tabla                     |
| `--borde-control` | `#968f83` | `#6f685d` | Borde del botón secundario ("Se fue el agua")                                              |
| `--texto`         | `#1f1b16` | `#f5f2ee` | Texto principal; contorno de "tu sector" en el minimapa                                    |
| `--texto-2`       | `#3d372f` | `#d9d2c7` | Navegación inactiva de escritorio                                                          |
| `--secundario`    | `#5c554c` | `#b0a89c` | Texto de apoyo, etiquetas, iconos de navegación inactivos                                  |
| `--acento`        | `#2f5d46` | `#86c09c` | Botón principal, logo, enlaces ("Ver mapa", "Ver completo")                                |
| `--sobre-acento`  | `#ffffff` | `#12100e` | Texto sobre el acento                                                                      |
| `--acento-suave`  | `#e4efe8` | `#1f2e25` | Fondo de la pestaña o enlace activo de navegación                                          |
| `--tinta-acento`  | `#244a37` | `#b0dac0` | Texto de la pestaña o enlace activo                                                        |
| `--inverso-*`     | ver `b.css` | ver `b.css` | Aviso "Hay una versión nueva de la app": fondo, texto, botón y texto del botón        |
| `--mapa-base`     | `#efede9` | `#1a1f29` | Fondo del minimapa                                                                         |

Los estados (azul, ámbar, bermellón, gris) son los de [`CANON.md`](CANON.md) §3.

### Tipografía

**Atkinson Hyperlegible**, pesos **400 y 700** (no tiene otros). `--fuente-ui: 'Atkinson Hyperlegible', system-ui, sans-serif`, autoalojada ([`PWA.md`](PWA.md) §8). Todo el énfasis es 700.

| Rol                                       | Tamaño / peso                      | Notas                                                      |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Franja de conexión                        | 13 / 700                           |                                                            |
| "Tu sector" (cabecera)                    | 13 / 400 `--secundario` (teléfono), 15 / 400 (escritorio) |                                     |
| Nombre del sector (cabecera)              | 22 / 700 (teléfono), 34 / 700 (escritorio, `h1`, `line-height: 1.15`) | `line-height: 1.1` en el teléfono |
| Marca                                     | 19 / 700                           | Logo de 32                                                 |
| Título de tarjeta de servicio (`h2`)      | 18 / 700 (teléfono), 19 / 700 (escritorio) |                                                    |
| Chip de estado                            | 14 / 700                           | Icono de 16, trazo 2,2                                     |
| Titular del servicio                      | 22 / 700 (teléfono), 24 / 700 (escritorio) | `line-height: 1.2`; `text-wrap: balance` en escritorio |
| Línea de apoyo                            | 15 (teléfono), 16 (escritorio), `--secundario` |                                                        |
| Etiqueta "Estimación estadística"         | 13 / 400 `--secundario`            |                                                            |
| Valor de la estimación                    | 22 / 700 (teléfono), 24 / 700 (escritorio) |                                                    |
| "Datos insuficientes"                     | 18 / 700 (teléfono), 19 / 700 (escritorio) |                                                    |
| "según …" y "3 de 5 cortes …"             | 14 (teléfono), 15 (escritorio), `--secundario` |                                                        |
| Botones principal y secundario            | 17 / 700                           | Alto 52                                                    |
| Fila de pendiente                         | 15 / 700 el título; 13 / 400 el apoyo |                                                         |
| "Otros sectores" (teléfono)               | 14 / 700 `--secundario` el título; 14 / 700 los chips |                                                    |
| Etiquetas de la navegación inferior       | 13 / 700                           |                                                            |
| Navegación de escritorio                  | 16 / 700                           |                                                            |
| Tabla de historial                        | 15; encabezados 13 / 700 `--secundario`; primera columna 700 |                                                  |
| Atribución                                | 12 / 400 `--secundario`            |                                                            |

### Formas

| Token                | Valor      | Dónde                                                                              |
| -------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `--radio-chip`       | 999 px     | Chips, botón de pendientes                                                         |
| `--radio-control`    | 12 px      | Elementos de la navegación de escritorio; botón del aviso de versión               |
| `--radio-boton`      | 16 px      | Botones principal y secundario; contenedor del aviso de versión; píldora de la pestaña activa (64 × 32) |
| `--radio-bloque`     | 14 px      | Bloques de estimación, fila de pendiente, chips de "Otros sectores", minimapa      |
| `--radio-tarjeta`    | 22 px      | Todas las tarjetas                                                                 |
| `--radio-icono`      | 20 px      | Círculo de icono de 40 × 40 de cada tarjeta de servicio                            |
| `--sombra-tarjeta`   | `0 1px 2px rgba(31, 27, 22, 0.06), 0 6px 18px rgba(31, 27, 22, 0.07)` | Todas las tarjetas |
| `--sombra-aviso`     | `0 8px 24px rgba(31, 27, 22, 0.3)` | Aviso de versión nueva                                                 |

## 3. Teléfono (`b-telefono.html`, 390 × 844)

Raíz: `display: flex; flex-direction: column; width: 390px; height: 844px; overflow: hidden; background: var(--fondo)`. Cuatro bandas apiladas; en producción `min-height: 100dvh`.

| Banda (comentario en la referencia) | Caja                                                              | Contenido                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aviso de PWA: sin conexión**      | `flex: none`; alto 36; `padding: 0 16px`                          | `role="status"`; `--superficie-2`; borde inferior 1 px `--borde-2`; `gap: 8px`; 13 / 700; icono `wifi-off` de 16. "Sin conexión · datos no actualizados ({hora})". Solo sin conexión.                                                                                                                       |
| **Barra superior**                  | `flex: none`; alto 64; `padding: 0 16px`; `space-between`; `gap: 8px` | **Izquierda:** logo de 32 (`--acento`) y, en columna, "Tu sector" (13, `--secundario`, `line-height: 1.1`) y el nombre del sector (22 / 700, `line-height: 1.1`); `gap: 10px`. **Derecha:** botón de pendientes: alto 44, `padding: 0 14px`, radio 999, fondo `--estado-sin-confirmar-chip`, borde 1 px `--estado-sin-confirmar-trazo`, texto `--estado-sin-confirmar-tinta` 14 / 700, icono `clock` de 16 (trazo 2,2) + "{n} pendiente(s)". |
| **Contenido** (`main`)              | `flex: 1; min-height: 0`; `padding: 4px 16px 0`; columna; `gap: 14px` | Las secciones Luz, Agua y Otros sectores. **Hace scroll** (`overflow-y: auto`) y sus secciones llevan `flex: none` ([`CANON.md`](CANON.md) §2). La referencia llena justo las 668 px disponibles.                                                                                                           |
| **Navegación inferior**             | `flex: none`; alto 76; `padding: 6px 16px 18px`; `space-around`  | `--superficie`; borde superior 1 px `--borde`. Tres elementos: Inicio · Mapa · Cuenta.                                                                                                                                                                                                                       |

### Tarjeta de servicio (Luz y Agua)

La misma tarjeta, dos veces: `section` con `aria-labelledby` del `h2`, `--superficie`, borde 1 px `--borde`, radio 22, `padding: 16px` (20 en escritorio), `--sombra-tarjeta`. De arriba abajo:

1. **Fila de cabecera** (`space-between`, `gap: 8px`): a la izquierda, círculo de **40 × 40** (`--radio-icono`, `--superficie-2`) con el icono del servicio de 22 (`zap` / `droplet`, trazo 2) + `h2` ("Luz" / "Agua"), `gap: 10px`; a la derecha, el **chip de estado** (`padding: 5px 12px`, radio 999, 14 / 700, `gap: 6px`, icono completo de 16, `white-space: nowrap`).
2. **Titular**, margen superior 12 (16 en escritorio): "Sin luz desde las {hora}" o "Hay agua", 22 / 700.
3. **Línea de apoyo**, margen superior 2: "{n} vecinos lo confirmaron" (si hay corte) o "Última interrupción: hace {n} días, duró {duración}" (si no).
4. **Bloque de estimación**, margen superior 10 (14 en escritorio): `padding: 10px 12px` (12 / 14), radio 14, `--superficie-2`.
   - Con cifra: etiqueta "Estimación estadística"; valor "aprox. 4 h" (22 / 700) y "según 12 cortes registrados" (14) en una fila con `gap: 8px` y `flex-wrap: wrap`.
   - Sin cifra: etiqueta; "Datos insuficientes" (18 / 700) y "3 de 5 cortes registrados" (14).
5. **Acción**, margen superior 12 (16 en escritorio): una de las tres, según el estado:
   - **Sin servicio, sin aviso en cola:** botón principal: ancho completo, alto 52, radio 16, `--acento` / `--sobre-acento`, 17 / 700. "Ya volvió la luz".
   - **Con servicio:** botón secundario: igual, con fondo `--superficie`, borde 1,5 px `--borde-control`, texto `--texto`. "Se fue el agua".
   - **Aviso en cola:** en lugar del botón, un bloque (`gap: 10px`, `padding: 10px 14px`, radio 14, fondo `--estado-sin-confirmar-chip`, texto `--estado-sin-confirmar-tinta`) con el icono `clock` de 20 (trazo 2,2) y dos líneas: "Aviso «Volvió la luz» pendiente" (15 / 700) y "Se enviará al reconectar" (13).

### Otros sectores (teléfono)

`section` sin caja propia. Fila de título (`space-between`, margen inferior 8): `h2` "Otros sectores" (14 / 700, `--secundario`) y enlace "Ver mapa" (14 / 700, `--acento`, subrayado; `min-height: 44px` con `margin: -12px 0` para no agrandar la fila). Debajo, tres chips en fila (`gap: 8px`), cada uno `flex: 1`, `min-height: 44px`, radio 14, 14 / 700, `gap: 6px`, icono compacto de 14 (trazo 2,6), con los colores de su estado: "Sector 2", "Sector 3", "Sector 4". **Regla:** cada chip muestra el **peor estado entre los dos servicios** (orden: sin servicio, sin confirmar, con servicio).

### Navegación inferior

Elementos `<a>`: columna centrada, `gap: 2px`, `min-width: 88px`, `min-height: 52px`, 13 / 700. Píldora de **64 × 32** (radio 16) con icono de 22. Activo (Inicio): píldora `--acento-suave`, icono y etiqueta `--tinta-acento`, `aria-current="page"`. Inactivos (Mapa, Cuenta): sin píldora, `--secundario`. Iconos: `home`, `map`, `user`.

## 4. Escritorio (`b-escritorio.html`, ≥ 1024 px)

Raíz: `position: relative; min-height: 860px; background: var(--fondo)`.

| Bloque                         | Regla y caja                                                                                                          | Contenido                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Barra superior**             | `padding: 10px 32px`; `flex-wrap: wrap`; `align-items: center`; `space-between`; `gap: 12px`; `--superficie`; borde inferior 1 px `--borde` | Marca (logo de 32 + 19 / 700) · navegación (Inicio, Mapa, Cuenta) · estado de conexión                                                                                                                       |
| **Contenido** (`main`)         | `max-width: 1160px; margin: 0 auto; padding: 32px`; `flex-wrap: wrap`; `gap: 24px`; `align-items: flex-start`        | Dos columnas                                                                                                                                                                                                         |
| Columna izquierda              | `flex: 999 1 560px; min-width: 0`; columna, `gap: 24px`                                                               | Cabecera · tarjetas de servicio · historial                                                                                                                                                                          |
| Columna derecha                | `flex: 1 1 340px; min-width: 0`; **rejilla** `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`, `gap: 20px`, `align-items: start` | Minimapa · otros sectores. En una columna estrecha se apilan; si la columna pasa a ocupar todo el ancho, se ponen lado a lado.                                                                   |
| **Aviso de versión nueva**     | `position: fixed; right: 24px; bottom: 24px`                                                                          | Ver abajo                                                                                                                                                                                                             |

A 1280 px: columna izquierda 731, derecha 339. A 1024 px: se mantienen lado a lado (verificado).

- **Navegación:** elementos de `min-height: 44px`, `padding: 0 16px`, radio 12 (`--radio-control`), 16 / 700, `gap: 8px`, icono de 20. Activo (Inicio): fondo `--acento-suave`, texto `--tinta-acento`. Inactivos: `--texto-2`.
- **Estado de conexión:** `role="status"`, 14 `--secundario`, icono `wifi` de 18, `gap: 8px`: "En línea · actualizado a las {hora}".
- **Cabecera de la columna izquierda:** "Tu sector" (15, `--secundario`) y `h1` con el nombre (34 / 700).
- **Tarjetas de servicio:** rejilla `repeat(auto-fit, minmax(min(280px, 100%), 1fr))`, `gap: 20px`. Son las de §3 con `padding: 20px`, titular de 24 / 700 con `text-wrap: balance` y bloque de estimación de 24 / 700.
- **Historial** ("Últimos cortes en tu sector", `h2` 19 / 700, margen inferior 8): tarjeta con `padding: 20px` y una **tabla** de ancho completo en un contenedor `overflow-x: auto`, `font-size: 15px`, `white-space: nowrap`. Encabezados: Servicio · Inicio · Fin · Duración (13 / 700, `--secundario`, `padding: 10px 12px`, línea inferior 1 px `--borde-2`; Duración alineada a la derecha). Celdas: `padding: 12px`, línea inferior 1 px `--borde` (la última fila, sin línea); servicio en 700. Inicio: "{día}, {hora}". Fin: la hora, o el chip "En curso" (`inline-block`, `padding: 2px 10px`, radio 999, 13 / 700, colores de "sin servicio"). Duración: "3 h 30 min", o "—" (`--secundario`) si sigue en curso.
- **Minimapa:** tarjeta con `padding: 16px`. Fila de título (`space-between`, margen inferior 12): `h2` "Mapa de sectores" (19 / 700) y enlace "Ver completo" (15 / 700, `--acento`, subrayado, `min-height: 44px`, `margin: -8px 0`). El mapa, cuadrado (`aspect-ratio: 1 / 1`) y de radio 14; escala 0,65 ([`CANON.md`](CANON.md) §4.4); solo contorno grueso para "tu sector", sin la etiqueta "Tu sector". Debajo (margen 10) la atribución de OSM, 12 `--secundario`.
- **Otros sectores:** tarjeta con `padding: 16px 20px`; `h2` 19 / 700 (margen inferior 4). Una fila por sector: `min-height: 56px`, `space-between`, `gap: 12px`, línea inferior 1 px `--borde` (la última, sin línea). Izquierda: nombre (16 / 700) y, si hay reportes sin confirmar, "{k} de {N} reportes" (13, `--secundario`). Derecha: chip de estado (`padding: 4px 12px`, radio 999, 14 / 700, icono compacto de 14, `nowrap`). Peor estado entre servicios, como en el teléfono.
- **Aviso de versión nueva** (`role="status"`): `padding: 8px 8px 8px 20px`, `gap: 16px`, radio 16, fondo `--inverso-fondo`, texto `--inverso-texto` 15, `--sombra-aviso`, `max-width: calc(100% - 48px)`. Botón "Actualizar": alto 44, `padding: 0 18px`, radio 12, fondo `--inverso-acento`, texto `--inverso-sobre-acento`, 15 / 700. En la referencia está `absolute` para que se vea sobre la página estática.

## 5. Lo que las maquetas no dibujan (definido aquí)

- **Servicio con reportes sin confirmar** (con servicio): el titular sigue siendo "Hay luz", el chip pasa a "Sin confirmar" y la línea de apoyo, a "{k} de {N} reportes". La acción es el botón secundario "Se fue la luz".
- **Cierre en cola con servicio sin corte / inicio en cola:** si el aviso en cola es "Se fue la luz", el bloque dice "Aviso «Se fue la luz» pendiente · Se enviará al reconectar" y reemplaza al botón, igual que el de cierre.
- **Otros sectores con un solo servicio afectado:** el chip no dice cuál. Si se quiere, se antepone el icono del servicio; es una mejora opcional.
- **Pantalla Mapa:** una pestaña con el mapa a pantalla completa. Su diseño no está dibujado: usa [`propuesta-a.md`](propuesta-a.md) §3 (mapa, hoja de detalle y leyenda) con los tokens y formas de B.
- **Cuenta, Reportar y Registro:** sin maqueta. Los avisos "Se fue…" y "Ya volvió…" de las tarjetas son el camino principal para reportar; abren una confirmación de una sola pantalla con la hora (editable, no futura).
- **Botón de pendientes:** abre una hoja con la cola, como en [`propuesta-a.md`](propuesta-a.md) §5.
- **Cargando y sin datos:** bloques `--superficie-2` del tamaño del contenido; con "Sin datos", el chip gris y el aviso de conexión.
- **Teléfono entre 360 y 640 px:** las tarjetas ocupan el ancho menos 32 px; por encima de 640, la columna de contenido se centra con `max-width: 640px`.
- **Modo oscuro:** con los tokens oscuros.

## 6. Receta de construcción

1. Autoaloja Atkinson Hyperlegible 400 y 700 ([`PWA.md`](PWA.md) §8). Importa `tokens/comun.css`, `tokens/b.css` y `tokens/tailwind.css`; `data-diseno="b"` en `<html>`.
2. `Icono` ([`CANON.md`](CANON.md) §5).
3. Primitivos: `EstadoChip` (siempre con icono completo, salvo "Otros sectores") → `ChipSync` → `AvisoConexion` → `BotonPendientes` → `BloqueEstimacion`.
4. **`TarjetaServicio`**: la pieza central. Recibe el servicio, el estado, la estimación y el aviso en cola, y decide su acción (§3).
5. Teléfono: `BarraSuperior`, `NavInferior` (tres elementos) y `OtrosSectores`; el apilado de §3.
6. Escritorio: `BarraSuperior` con navegación, `HistorialSector` (tabla), `MinimapaSectores` (con el mapa de [`CANON.md`](CANON.md) §4) y `AvisoVersion`; el ensamblado de §4.
7. Datos ([`datos.md`](datos.md)): primero con `datos-ejemplo.json`, después con la API.
8. Pruebas de fidelidad ([`CANON.md`](CANON.md) §11) en 390 × 844 y 1280 × 860 (y 1024).

## 7. Lista de comprobación

- [ ] `node docs/frontend/herramientas/verificar-tokens.mjs` sin problemas.
- [ ] Atkinson autoalojada (cero peticiones a Google Fonts) y con `font-display: swap`.
- [ ] Teléfono a 390 × 844 con `?demo=sin-conexion`: ≤ 1 % de diferencia con `b-telefono.html`. (No hay mapa en esta pantalla.)
- [ ] Escritorio a 1280 × 860 y a 1024 con `?demo=en-linea`: ≤ 1 % de diferencia con `b-escritorio.html`, mapa oculto.
- [ ] El contenido del teléfono hace scroll si la pantalla es más baja que 844 px, sin que las tarjetas se encojan.
- [ ] Los chips no parten su texto a ningún ancho; la tabla de historial se desplaza dentro de su tarjeta si no cabe.
- [ ] El aviso de versión nunca tapa datos (`position: fixed`, esquina inferior derecha).
- [ ] Todo lo tocable mide al menos 44 × 44; axe sin violaciones graves.
