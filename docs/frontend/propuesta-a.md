# Propuesta A · Mapa primero · «Pizarra y azul»

> **Referencias:** [`a-telefono.html`](referencia/a-telefono.html) (390 × 844) y [`a-escritorio.html`](referencia/a-escritorio.html) (1280 × 860).
> **Tokens:** [`tokens/comun.css`](tokens/comun.css) + [`tokens/a.css`](tokens/a.css). Si una tabla de este documento y un token difieren, manda el token; si el token y la referencia difieren, manda la referencia.
> **Fundamentos que no se repiten aquí:** [`CANON.md`](CANON.md) (responsive, estados, mapa, iconos, textos, accesibilidad).
>
> **D-038 (27-oct-2026), flat con carácter:** la app de A se rediseñó sobre esta base. Las secciones 2 a 7 describen las maquetas originales; lo que D-038 cambia está en el **§8** y manda sobre ellas.

## 1. Qué es

El mapa ocupa toda la pantalla y es la puerta de entrada. El estado del sector del vecino vive en una **hoja inferior** (teléfono) o en un **panel lateral** (escritorio). Reportar es una pestaña de la navegación.

- **Para qué sirve:** da la vista espacial de un vistazo y cubre el mapa de calor (VIS-01) desde el primer momento.
- **Su costo:** el mapa depende de las teselas (pesadas con 3G y sin red), y la respuesta clave ("mi sector") queda a un toque de la hoja.
- **Carácter visual:** frío y conocido, con fuente del sistema (no descarga nada), bordes finos y un acento azul. El azul del acento es deliberadamente más oscuro y saturado que el azul de "con servicio" (`#5b9bd5`, translúcido sobre el mapa), para que no se confundan.

## 2. Tokens, tipografía y formas

### Color

| Token             | Claro     | Oscuro    | Dónde se usa en A                                                       |
| ----------------- | --------- | --------- | ----------------------------------------------------------------------- |
| `--fondo`         | `#f8fafc` | `#0b1220` | Fondo de la página de escritorio                                        |
| `--superficie`    | `#ffffff` | `#111a2c` | Hoja, panel, barra lateral, píldoras y selector sobre el mapa           |
| `--superficie-2`  | `#f1f5f9` | `#1a2438` | Franja de conexión, bloque de estimación del panel, tarjeta de instalar |
| `--borde`         | `#e2e8f0` | `#243049` | Bordes de píldoras, tarjetas, separadores, borde superior de la navegación |
| `--borde-2`       | `#cbd5e1` | `#334463` | Borde de la franja de conexión, tirador de la hoja                      |
| `--borde-control` | `#7d8ea8` | `#5b6b88` | Borde del botón "Instalar"                                              |
| `--texto`         | `#0f172a` | `#f1f5f9` | Texto principal; contorno de "tu sector"                                |
| `--texto-2`       | `#334155` | `#c9d5e6` | Navegación inactiva, botón inactivo del selector, atribución            |
| `--secundario`    | `#475569` | `#a3b1c6` | Texto de apoyo, etiquetas, iconos de navegación inactivos               |
| `--acento`        | `#1d4ed8` | `#7aa2ff` | Botón principal, servicio elegido, navegación activa, marca             |
| `--sobre-acento`  | `#ffffff` | `#0b1220` | Texto e icono sobre el acento                                           |
| `--acento-suave`  | `#e8eefc` | `#16264a` | Fondo de la pestaña activa y de la etiqueta "Tu sector" del panel       |
| `--tinta-acento`  | `#1e3a8a` | `#b4cbff` | Texto sobre `--acento-suave`                                            |
| `--mapa-base`     | `#edeff2` | `#1a1f29` | Fondo del mapa y de la pantalla del teléfono                            |

Los estados (azul, ámbar, bermellón, gris) son los de [`CANON.md`](CANON.md) §3.

### Tipografía

Fuente del sistema, sin descargar nada: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` (`--fuente-ui`). Pesos 500, 600 y 700.

| Rol                                   | Tamaño / peso      | Notas                                             |
| ------------------------------------- | ------------------ | ------------------------------------------------- |
| Marca (nombre de la app)              | 15 / 700 (teléfono), 17 / 700 (barra lateral) |                                |
| Franja de conexión                    | 13 / 500           |                                                   |
| Botón de pendientes                   | 14 / 600           |                                                   |
| Selector de servicio                  | 15 / 600           |                                                   |
| Chips de la leyenda (teléfono)        | 12 / 600           | Icono de 13 px, trazo 2,6                         |
| Atribución                            | 12 / 400           |                                                   |
| Título de la hoja                     | 20 / 700           | `line-height: 1.2`                                |
| Chip de estado                        | 13 / 600           | Icono de 16 px, trazo 2                           |
| Línea de estado ("Desde las 14:20 …") | 14 / 400           | `--secundario`                                    |
| Etiqueta "Estimación estadística"     | 12 / 400           | `--secundario`                                    |
| Valor de la estimación                | 26 / 700 (hoja), 32 / 700 (panel) | `font-variant-numeric: tabular-nums` |
| Texto de la fila de pendiente         | 14 / 400           | `line-height: 1.35`                               |
| Etiquetas de la navegación inferior   | 12 / 700 activa y Reportar, 12 / 600 el resto |                         |
| Navegación lateral                    | 15 / 700 activa, 15 / 600 el resto |                                   |
| Panel: título / filas de cortes       | 24 / 700; 14 / 600 con apoyo 13 / 400 | "Últimos cortes" en 16 / 700   |

### Formas

| Token                | Valor      | Dónde                                                                         |
| -------------------- | ---------- | ----------------------------------------------------------------------------- |
| `--radio-chip`       | 999 px     | Chips, píldoras, botón de pendientes                                          |
| `--radio-etiqueta`   | 6 px       | Etiqueta "Tu sector" del panel                                                |
| `--radio-control`    | 10 px      | Botones del selector, elementos de la navegación lateral, botón "Instalar"    |
| `--radio-boton`      | 12 px      | Botón principal ("Ya volvió la luz")                                          |
| `--radio-bloque`     | 12 px      | Bloque de estimación del panel, fila de pendiente, tarjeta de leyenda         |
| `--radio-tarjeta`    | 14 px      | Contenedor del selector, tarjeta de instalar                                  |
| `--radio-hoja`       | 20 px      | Esquinas superiores de la hoja inferior                                       |
| `--sombra-flotante`  | `0 1px 3px rgba(15, 23, 42, 0.14)` | Píldoras, selector y leyenda sobre el mapa            |
| `--sombra-hoja`      | `0 -6px 24px rgba(15, 23, 42, 0.14)` | Hoja inferior                                       |

Otros radios sueltos: píldora de la pestaña activa 15 px (56 × 30); atribución 4 px; tirador 2 px.

## 3. Teléfono (`a-telefono.html`, 390 × 844)

Raíz: `position: relative; width: 390px; height: 844px; overflow: hidden; background: var(--mapa-base); color: var(--texto)`. Todo lo siguiente va sobre el mapa con `position: absolute`, de atrás hacia delante. En producción la raíz es `min-height: 100dvh` y el mapa llena el fondo.

| Bloque (comentario en la referencia)          | Geometría                                                                | Contenido y valores                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mapa**                                      | 0,0 · 390 × 560 (llena el fondo)                                         | Coropleta ([`CANON.md`](CANON.md) §4), escala 0,75. Encuadre: `fitBounds` con `paddingTopLeft: [35, 184]` y `paddingBottomRight: [35, 344]`: los sectores quedan entre y = 184 y y = 500, sin tocar la hoja.                                                                                         |
| **Aviso de PWA: sin conexión**                | `top: 0`; alto 36; `padding: 0 16px`; ancho completo                     | `role="status"`; fondo `--superficie-2`; borde inferior 1 px `--borde-2`; `gap: 8px`; 13 / 500. Icono `wifi-off` 16. Texto: "Sin conexión · datos no actualizados ({hora})". Solo se muestra sin conexión.                                                                                          |
| **Barra superior flotante**                   | `top: 44`; `left/right: 16`; alto 44; `justify-content: space-between`; `gap: 8px` | **Izquierda, marca:** píldora de alto 44, `padding: 0 14px 0 10px`, `--superficie`, borde 1 px `--borde`, `--sombra-flotante`; logo de 24 + "BlackoutTracker" 15 / 700, `gap: 8px`. **Derecha, pendientes:** botón de alto 44, `padding: 0 14px`, fondo `--estado-sin-confirmar-chip`, borde 1 px `--estado-sin-confirmar-trazo`, texto `--estado-sin-confirmar-tinta` 14 / 600; icono `clock` 16 (trazo 2,2) + "{n} pendiente(s)". Si no hay pendientes, no se muestra. |
| **Selector de servicio**                      | `top: 96`; centrado horizontalmente                                      | Contenedor: `padding: 4px`, `gap: 4px`, radio 14, `--superficie`, borde 1 px `--borde`, `--sombra-flotante`. Dos botones de **120 × 44**, radio 10, 15 / 600, `gap: 8px`, icono de 18 (`zap` / `droplet`). Elegido: fondo `--acento`, texto `--sobre-acento`. No elegido: transparente, texto `--texto-2`. `aria-pressed`. |
| **Leyenda**                                   | `top: 150`; `left/right: 16`; `flex-wrap: wrap`; `gap: 6px`              | Tres chips de alto 28, `padding: 0 10px`, radio 999, 12 / 600, `gap: 5px`, `white-space: nowrap`; icono compacto de 13 (trazo 2,6): `check`, `interrogacion`, `x`. Colores `--estado-*-chip` / `--estado-*-tinta`. Orden: Con servicio · Sin confirmar · Sin servicio.                              |
| **Atribución obligatoria de OpenStreetMap**   | `right: 8`; `top: 484` (su borde inferior queda unos 6 px sobre la hoja) | `padding: 2px 6px`; radio 4; fondo `rgba(255, 255, 255, 0.85)`; texto `--texto-2` 12. Se mueve con la altura de la hoja: siempre por encima de ella.                                                                                                                                              |
| **Hoja inferior con el sector del vecino**    | `top: 510`; alto 250; `padding: 8px 20px 0`; esquinas superiores 20      | `--superficie`; `--sombra-hoja`. Ver el detalle abajo.                                                                                                                                                                                                                                            |
| **Navegación inferior**                       | `bottom: 0`; alto 84; `padding: 8px 8px 20px`; `justify-content: space-around` | `--superficie`; borde superior 1 px `--borde`. Cinco elementos (D-037): Mapa · Panel · Reportar · Avisos · Cuenta. Ver el detalle abajo.                                                                                                                                                                            |

### Hoja inferior

Contenido de arriba abajo (`section` con `aria-label` = nombre del sector):

1. **Tirador:** 40 × 4, radio 2, `--borde-2`, centrado, margen inferior 12.
2. **Fila de título** (`justify-content: space-between`, `gap: 8px`): `h2` "Sector 1" 20 / 700 + **chip de estado** (`padding: 4px 10px`, radio 999, 13 / 600, icono completo de 16: `x-circle` / `check-circle` / `help-circle`).
3. **Línea de estado**, margen superior 4: "Desde las {hora} · confirmado por {n} vecinos", 14, `--secundario`.
4. **Estimación**, margen superior 12: etiqueta "Estimación estadística" (12, `--secundario`); debajo, en línea (`align-items: baseline`, `gap: 8px`, `flex-wrap: wrap`): "aprox. {duración}" 26 / 700 tabular + "según {n} cortes registrados" 14 `--secundario`. Con datos insuficientes: ver [`CANON.md`](CANON.md) §7.1.
5. **Fila de pendiente**, margen superior 12 (solo si hay un aviso en cola): `padding: 10px 12px`, radio 12, fondo `--estado-sin-confirmar-chip`, texto `--estado-sin-confirmar-tinta` 14 / `line-height: 1.35`, `gap: 10px`; icono `clock` de 18 (trazo 2,2) que no se encoge. Texto: "Tu aviso «Volvió la luz» ({hora}) está pendiente de envío".

### Navegación inferior

_(D-037: la maqueta dibuja cuatro; la app usa cinco con Reportar al centro.)_ La barra es una rejilla de **cinco columnas iguales** (`padding: 8px 4px 20px`, con la zona segura). Cada elemento es un `<a>`: columna centrada, `gap: 4px`, `min-height: 56px`, `padding-top: 2px`, 12 px. Dentro, una **píldora de 56 × 30** (radio 15; 48 × 30 por debajo de 360 px) con el icono de 22 px.

| Elemento     | Píldora y color                                                                                           | Icono                       |
| ------------ | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Activo** (Mapa) | Fondo `--acento-suave`; icono y etiqueta `--acento`, etiqueta 700; `aria-current="page"`             | `map`, trazo 2              |
| **Inactivo** (Panel, Cuenta) | Sin fondo; icono y etiqueta `--secundario`, etiqueta 600                                      | `grid`, `user`, trazo 2     |
| **Reportar** (centro, D-037) | **Círculo de 56 px** de `--acento` con el icono `--sobre-acento`, dentro de un anillo de 4 px de `--superficie` (64 px en total; `--acento-suave` si es la pantalla actual). Sobresale **24 px** por encima de la barra y el anillo corta su borde superior; plano, sin sombra (D-028). En el flujo ocupa lo mismo que una píldora (`margin-top: -34px`), así la etiqueta queda alineada con las demás. Etiqueta `--acento` 700 | `plus` de 26, trazo 2,4 |
| **Avisos** (D-037) | Como un inactivo o activo, con una **insignia** arriba a la derecha de la píldora (20 px de alto, radio 999, 12 / 700 tabular): el número de avisos sin enviar, con los colores invertidos de _Pendiente_ (`--estado-sin-confirmar-tinta` de fondo) o de _Error_ si alguno se rechazó. El número va en `aria-hidden` y el enlace se llama "Avisos, {n} avisos sin enviar" | `clock`, trazo 2 |

La nav va por encima de las capas del mapa (`z-index` 1050) para que el círculo se vea entero sobre la hoja inferior, y el aviso de versión nueva sube a `bottom: 116px` para no taparlo.

## 4. Escritorio (`a-escritorio.html`, ≥ 1024 px)

Raíz: `display: flex; flex-wrap: wrap; min-height: 860px; background: var(--fondo)`. Tres columnas que se reparten el ancho con las reglas flex de la referencia (a 1280 px: barra 232, mapa 709, panel 339; verificado también a 1024 y a 1100).

| Bloque                  | Regla flex y caja                                                                                                  | Contenido                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Barra lateral**       | `flex: 1 1 232px; min-width: 0`; `padding: 20px 16px`; `--superficie`; borde derecho 1 px; columna, `gap: 24px`    | Marca (logo 28 + 17 / 700, `padding: 0 8px`) · navegación · pie con `margin-top: auto`                                                                                                                                                                                     |
| **Mapa**                | `flex: 999 1 420px; min-width: 0; min-height: 640px`; `position: relative; overflow: hidden`; fondo `--mapa-base`  | El mapa a todo el bloque, con tres superposiciones: selector (arriba a la izquierda), leyenda (abajo a la izquierda), atribución (abajo a la derecha)                                                                                                                       |
| **Detalle del sector**  | `flex: 1 1 340px`; `padding: 24px`; `--superficie`; borde izquierdo 1 px; columna, `gap: 20px`                     | Cabecera · estimación · botón · últimos cortes                                                                                                                                                                                                                             |

`main` (el contenedor de mapa y detalle) es `flex: 999 1 560px; min-width: 0; display: flex; flex-wrap: wrap; min-height: 860px`.

### Barra lateral

- **Navegación:** columna, `gap: 4px`. Cada elemento: `min-height: 44px`, `padding: 0 12px`, radio 10, `gap: 12px`, icono de 20, 15 px. Activo (Mapa): fondo `--acento-suave`, texto `--acento`, 700. Inactivo: texto `--texto-2`, 600. Iconos: `map`, `grid`, **`plus-circle`** (Reportar), `clock` (Avisos, con la misma insignia a la derecha, D-037), `user`.
- **Pie:** columna, `gap: 14px`.
  - **Tarjeta de instalar:** `padding: 14px`, radio 14, `--superficie-2`, borde 1 px `--borde`, columna, `gap: 10px`. Título "Instalar BlackoutTracker" 14 / 700; texto "Se abre como una app y sigue funcionando sin conexión." 13 `--secundario`, `line-height: 1.4`; botón de alto 44, borde 1 px `--borde-control`, radio 10, `--superficie`, texto `--texto` 14 / 600, icono `download` de 16, `gap: 8px`. Se muestra solo si el navegador permite instalar y no se descartó.
  - **Estado de conexión:** `role="status"`, `padding: 0 8px`, `gap: 10px`, 13 `--secundario`, icono `wifi` de 18: "En línea · actualizado a las {hora}".

### Mapa y sus superposiciones

- **Selector:** `left: 16px; top: 16px`. Mismo contenedor que en el teléfono, con botones de **112 × 44**.
- **Leyenda** (tarjeta): `left: 16px; bottom: 16px`; columna, `gap: 8px`; `padding: 12px`; radio 12; `--superficie`; borde 1 px `--borde`; `--sombra-flotante`. Título "Leyenda" (12 / 700, mayúsculas, `letter-spacing: .05em`, `--secundario`) y tres chips (`padding: 3px 10px`, radio 999, 13 / 600, `gap: 6px`, `align-self: flex-start`, `nowrap`) con iconos compactos de 14 (trazo 2,6). El texto largo del segundo: **"Reportes sin confirmar"**.
- **Atribución:** `right: 8px; bottom: 8px`, como en el teléfono.
- **Escala del mapa:** la grande de [`CANON.md`](CANON.md) §4.4.

### Detalle del sector

1. **Cabecera:** etiqueta "Tu sector" (`inline-block`, `padding: 2px 8px`, radio 6, `--acento-suave`, texto `--tinta-acento` 12 / 700); debajo (margen 8) la fila `h2` "Sector 1" 24 / 700 `line-height: 1.2` + chip de estado; después "Desde las {hora} · confirmado por {n} vecinos" (14, `--secundario`, margen 6).
2. **Estimación:** `padding: 16px`, radio 12, `--superficie-2`. Etiqueta 12 `--secundario`; valor "aprox. 4 h" 32 / 700 tabular (margen 2); "según 12 cortes registrados" 14 `--secundario`.
3. **Botón principal:** alto 48, radio 12, `--acento` / `--sobre-acento`, 16 / 600, ancho completo.
4. **Últimos cortes:** `h3` 16 / 700 (margen inferior 4). Hasta 5 filas (VIS-04; la maqueta dibuja 3): `justify-content: space-between`, `gap: 12px`, `padding: 12px 0`, borde superior 1 px `--borde`. Izquierda: día (14 / 600) y debajo el intervalo "09:10 a 12:40" (13, `--secundario`). Derecha: chip "En curso" (`padding: 3px 10px`, radio 999, 13 / 600, colores de "sin servicio") o la duración (14 / 600, tabular).

## 5. Lo que las maquetas no dibujan (definido aquí)

- **Hoja inferior arrastrable:** tres posiciones: _asomada_ (la maqueta, 250 px), _media_ (la mitad de la pantalla) y _completa_ (hasta debajo de la franja de conexión y la barra). Al expandirse muestra, tras la estimación, la lista "Últimos cortes" (como en el panel de escritorio) y el botón principal. Se mueve con un gesto vertical y con un botón accesible en el tirador (`role="button"`, `aria-label="Expandir detalle"`). La atribución sigue al borde superior de la hoja.
- **Elegir otro sector:** tocar un polígono lo selecciona: el contorno grueso pasa a él, la hoja o el panel muestran su estado, y el título deja de llevar "Tu sector". Con una sola pulsación en el sector propio, vuelve a la vista por defecto.
- **Servicio sin corte** (con servicio): la línea de estado pasa a "Última interrupción: hace {n} días, duró {duración}" y la estimación se muestra igual.
- **Cargando:** bloques `--superficie-2` del tamaño del contenido, sin animación si `prefers-reduced-motion`.
- **Sin datos** (sin red y sin caché): polígonos de "sin datos", la hoja con el chip "Sin datos" y el aviso de conexión.
- **Botón de pendientes:** lleva a la pantalla Avisos (`/avisos`, D-037), que muestra la cola: por cada aviso, el servicio, la acción ("Se fue la luz" / "Volvió la luz"), la hora y su chip _Pendiente_ / _Enviado_ / _Error_; un _Error_ ofrece "Reintentar" y "Descartar". Los avisos que el servidor rechaza con 400, 409 o 422 son errores permanentes ([`PLAN.md`](../PLAN.md) §5).
- **Reportar, Panel y Cuenta:** el diseño de teléfono dibuja solo el mapa. Las otras pestañas se construyen con los mismos primitivos; Panel es la lista de sectores (la alternativa accesible al mapa).
- **Modo oscuro:** se obtiene con los tokens oscuros.

## 6. Receta de construcción

1. Importa `tokens/comun.css`, `tokens/a.css` y `tokens/tailwind.css`; pon `data-diseno="a"` en `<html>`. No hay fuente que cargar.
2. Crea `Icono` con los trazos de [`CANON.md`](CANON.md) §5.
3. Primitivos, en este orden: `EstadoChip` (iconos completo y compacto) → `ChipSync` → `AvisoConexion` → `SelectorServicio` (tamaños 120 y 112) → `BloqueEstimacion`.
4. `MapaSectores` según [`CANON.md`](CANON.md) §4, con `LeyendaMapa` (chips y tarjeta) y `AtribucionOSM`.
5. Teléfono: `HojaSector`, `NavInferior`, la barra flotante y el ensamblado absoluto de la tabla de §3.
6. Escritorio: `BarraLateral` (con `AvisoInstalacion`) y `PanelSector`; el ensamblado flex de §4.
7. Conecta los datos ([`datos.md`](datos.md)): primero con `datos-ejemplo.json` (modo demostración), después con la API.
8. Pruebas de fidelidad ([`CANON.md`](CANON.md) §11) en 390 × 844 y en 1280 × 860 (y 1024).

## 7. Lista de comprobación

- [ ] `node docs/frontend/herramientas/verificar-tokens.mjs` sin problemas.
- [ ] Ningún hex ni px suelto que no esté en las tablas de este documento o en la referencia.
- [ ] Teléfono a 390 × 844 con `?demo=sin-conexion`: ≤ 1 % de diferencia con `a-telefono.html`, mapa oculto.
- [ ] Escritorio a 1280 × 860 y a 1024 con `?demo=en-linea`: ≤ 1 % de diferencia con `a-escritorio.html`.
- [ ] A 320 px de ancho: sin scroll horizontal; el botón de pendientes pasa a icono con insignia.
- [ ] La atribución de OSM se ve con la hoja asomada, media y completa.
- [ ] Todo lo tocable mide al menos 44 × 44.
- [ ] axe sin violaciones graves; navegación completa por teclado.

## 8. Flat con carácter (D-038)

Lo aprobó Leonardo el 27-oct-2026 sobre un lienzo de Claude Design que compara la app de entonces con la propuesta, con los mismos datos de ejemplo (privado, hay que pedir acceso): <https://claude.ai/artifact/TxiRcKrAmb59GgHNFQ5krd>. Sigue siendo flat (D-028): sin sombras ni degradados. Los tokens del canon no se tocan: se sobrescriben en `apps/web/src/estilos/globales.css`.

### Tokens

| Token             | Claro                         | Oscuro    | Dónde                                                                    |
| ----------------- | ----------------------------- | --------- | ------------------------------------------------------------------------ |
| `--acento`        | `#0b1220` (tinta)             | `#f1f5f9` | Botones principales, servicio elegido, navegación activa, marca          |
| `--sobre-acento`  | `#ffffff`                     | `#0b1220` | Texto sobre el acento                                                    |
| `--acento-suave`  | `#e5e7eb`                     | `#243049` | Pestaña activa, etiqueta "Tu sector"                                     |
| `--tinta-acento`  | `#0b1220`                     | `#f1f5f9` | Texto sobre `--acento-suave`                                             |
| `--fondo`         | `#f4f6f9`                     | `#0b1220` | Fondo de las pantallas                                                   |
| `--barra`         | `#0b1220`                     | `#111a2c` | Barra superior del teléfono; `theme-color` y `theme_color` del manifest  |
| `--barra-texto`   | `#ffffff`                     | `#f1f5f9` | Marca sobre la barra                                                     |
| `--barra-apoyo`   | `#a3b1c6`                     | `#a3b1c6` | "En línea · 15:06"                                                       |
| `--sobre-estado`  | `#ffffff`                     | `#ffffff` | Texto sobre un estado sólido (bloque "Sin luz", insignias)               |
| `--fuente-display` | Bricolage Grotesque variable | igual     | Títulos, marca, cifras (solo latín, ~77 KB, servida por la app)          |

El azul queda para "con servicio" y para el foco (`--foco`, sin cambios), así que el único color con croma en pantalla es el de los estados (§1.1 del canon). Los contrastes están en D-038.

### Teléfono

- **Barra superior** fija (52 px, `--barra`): la marca (un rayo en un bloque redondeado, invertido sobre la tinta) y, a la derecha, el botón de pendientes o "En línea · hora". Sin conexión, la franja de §3 va encima. Sale la barra flotante del mapa.
- **Selector Luz/Agua** a todo el ancho, con una insignia bermellón con los sectores sin ese servicio (también en su nombre accesible). En el mapa va arriba; la leyenda, debajo, de más a menos grave.
- **Mapa:** los sectores se separan con una línea del color de `--mapa-halo`; el nombre va en una píldora de la superficie con la insignia del estado (sólida solo sin servicio) y "Tu sector" en mayúsculas encima.
- **Hoja del sector** (asomada: 368 px o el 52 % del mapa): título con "Tu sector"; el **bloque de estado** (sólido en bermellón para "Sin luz · desde las 14:20" con "Confirmado por al menos 3 vecinos" en barritas; en el tono del chip para los demás); la estimación con su **barra** (lo que lleva el corte, la mediana y el rango intercuartílico) y el texto "Llevas 46 min · lo habitual: entre 2 h 30 min y 6 h"; y el **botón de reportar**, que ya se ve asomada y queda por encima del círculo de Reportar.
- **Panel:** resumen "La luz ahora" con barra apilada y recuento; tarjetas con un cuadro de 44 px del estado, la línea de estado y la cifra a la derecha. El detalle usa el bloque de estado y la barra del mapa.
- **Reportar:** una tarjeta por servicio con el corte propio ("Corte abierto · Desde las 14:20" o "Sin cortes tuyos"), el aviso como pregunta ("¿Ya volvió la luz?"), "Ahora · 15:06 / Fue antes", el botón de 60 px y "Después de avisar" (cola, envío y consenso).
- El contenido de las pantallas deja 40 px abajo: el círculo de Reportar sobresale 24 px (D-037).

### Escritorio

Misma estructura de §4, con la marca nueva en la barra lateral, el acento de tinta, la fuente de títulos y el detalle del sector con el bloque de estado y la barra de la estimación.
