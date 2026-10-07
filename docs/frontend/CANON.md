# Canon del frontend · fundamentos comunes

> Valen para las tres propuestas (A, B y C). Si algo de este documento contradice una referencia HTML, **manda la referencia**: es el diseño, y esto es su explicación.
> Cómo se usa todo el conjunto: [`README.md`](README.md). Lo propio de cada propuesta: [`propuesta-a.md`](propuesta-a.md), [`propuesta-b.md`](propuesta-b.md), [`propuesta-c.md`](propuesta-c.md).

---

## 1. Principios

1. **El color solo significa estado.** Azul, bermellón, ámbar y gris están reservados para los estados del sector. El acento de la interfaz (azul en A, verde en B, ninguno en C) nunca se usa para comunicar un estado.
2. **Nunca solo color.** Cada estado lleva color, icono y texto; en el mapa, además, trama o trazo.
3. **El mapa no muestra personas.** Solo polígonos de sector. Ningún pin, ni siquiera el del propio vecino (NF-06).
4. **Honestidad sin conexión.** Siempre se muestra la última información guardada con el aviso "datos no actualizados (HH:mm)". Lo que el vecino hace sin red aparece al instante como _pendiente_.
5. **Estimación estadística, nunca "predicción".** Siempre acompañada de su n: "aprox. 4 h, según 12 cortes registrados". Con n menor que el mínimo: "Datos insuficientes", sin cifra.
6. **Todo lo tocable mide al menos 44 × 44 px**, también en escritorio.
7. **Móvil primero.** Se diseñó a 390 px de ancho; el escritorio es la ampliación.
8. **Español, tuteo ("Tu sector"), hora de 24 h, zona `America/Caracas`.**

---

## 2. Base de estilos y responsive

### Base de estilos (obligatoria)

Las referencias se dibujaron sobre estos valores base, y **todas las medidas de los documentos dependen de ellos**. Con el preflight de Tailwind v4 se cumplen solos, **salvo el interlineado**, que hay que devolver a su valor normal:

| Valor base                                                              | Tailwind v4 (preflight)         | Qué hacer                                          |
| ----------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `box-sizing: border-box` en todo (por eso "alto 44" es 44 con borde)    | Ya lo hace                      | Nada                                               |
| Márgenes en 0; `h1`–`h6` sin tamaño ni peso propios                     | Ya lo hace                      | Nada                                               |
| `button`, `input`: `font: inherit`; `a`: sin color ni subrayado propios | Ya lo hace                      | Nada                                               |
| **`line-height: normal`** (el del navegador) salvo donde una tabla indica otro | **Pone `1.5`**           | **Sobrescribirlo** en la hoja global (abajo)       |

```css
@layer base {
  html {
    line-height: normal; /* las referencias usan el interlineado normal; Tailwind pone 1.5 */
  }
  body {
    background: var(--fondo);
    color: var(--texto);
    font-family: var(--fuente-ui);
  }
}
```

**Medido, no supuesto:** se reprodujeron las seis pantallas (teléfono y escritorio de A, B y C) escribiendo el código **solo a partir de los documentos y de los tokens**, sin copiar de las referencias, y se compararon con ellas en Chromium con el mapa oculto: **0,00 % de píxeles distintos en todas**, también a 1024 y a 1100 px en las de escritorio. Con el `line-height: 1.5` del preflight, la pantalla A de teléfono sube a **1,66 %** de diferencia, y sin `border-box`, a **1,56 %**: más del 1 % que tolera la prueba de fidelidad (§11).

Dos cosas que ese ejercicio descubrió y que **ya están corregidas en las referencias**, pero conviene tener presentes al escribir CSS propio: (1) `min-height` o `height` suman el borde y el relleno si la caja no es `border-box`; (2) un espacio en blanco entre dos `<span>` en línea ocupa unos 4 px que en JSX no existen: la separación se define con `margin` o `gap`, nunca con espacios.

### Responsive

| Ancho de pantalla | Diseño                 | Referencia                          | Verificado                          |
| ----------------- | ---------------------- | ----------------------------------- | ----------------------------------- |
| 320 a 1023 px     | Teléfono, fluido       | `*-telefono.html` (dibujada a 390)  | 390 px                              |
| 1024 px o más     | Escritorio, fluido     | `*-escritorio.html` (dibujada a 1280) | 1024, 1100 y 1280 px              |

**Un solo punto de quiebre estructural: 1024 px** (`lg` de Tailwind). Por debajo de unos 990 px la barra lateral, el mapa y el panel de A no caben juntos, y la tabla de C necesita cerca de 800 px de ancho útil; el diseño de teléfono, ampliado, funciona bien en todo ese rango. Se fija un solo quiebre, en el valor de Tailwind más cercano, para tener solo dos diseños que mantener: las tabletas en vertical usan el de teléfono.

### Teléfono (320 a 1023 px)

- **Fijos:** el aviso de conexión (arriba), la barra superior y la navegación inferior. **Lo demás hace scroll** (`overflow-y: auto` en el contenedor central) y sus secciones llevan `flex: none`; si no, se encogen y se pisan. Las referencias miden justo 844 px y por eso no lo muestran.
- **Alto:** `100dvh`, no `100vh` (en móvil `vh` incluye la barra del navegador).
- **Zona segura inferior:** la navegación de las referencias deja un relleno abajo (A: 20 px; B: 18 px; C: 14 px) que representa el indicador de inicio del teléfono. En producción: `padding-bottom: max(<relleno de la referencia>, env(safe-area-inset-bottom))` junto con `viewport-fit=cover` ([`PWA.md`](PWA.md) §5).
- **Por encima de 640 px** _(regla del canon, no dibujada)_: B y C centran la columna de contenido con `max-width: 640px`; A mantiene el mapa y la hoja inferior a todo el ancho, con el contenido de la hoja en `max-width: 640px` centrado.
- **Por debajo de 360 px** _(regla del canon)_: en A, el botón "1 pendiente" pasa a ser solo el reloj con una insignia numérica, como el de C. La leyenda de A ya hace `flex-wrap`.
- Nunca scroll horizontal a ningún ancho desde 320 px.

### Escritorio (1024 px o más)

- Se construye con las **reglas flex de las referencias**, no con media queries: `flex: <crece> <encoge> <base>` con `flex-wrap: wrap` y `min-width: 0`; las rejillas, con `repeat(auto-fit, minmax(min(<mínimo>px, 100%), 1fr))`. Así los bloques se acomodan solos al cambiar el ancho. Las bases de cada propuesta están en su documento.
- Las **tablas** viven en un contenedor `overflow-x: auto` y sus celdas son `white-space: nowrap`: si no caben, se desplazan dentro de su tarjeta; nunca se parten ni se aprietan.
- Los **chips y etiquetas** nunca parten su texto (`white-space: nowrap`).
- Los avisos tipo _toast_ van `position: fixed` en la esquina inferior derecha. Las referencias los dibujan con `absolute` dentro de la página solo porque son páginas estáticas.

### Interacción

- `:hover` solo dentro de `@media (hover: hover)`; nada depende del hover.
- `touch-action: manipulation` en botones y enlaces.
- Foco visible: `outline: 2px solid var(--foco); outline-offset: 2px` en todo lo interactivo.

---

## 3. Color y estados

Los colores están en [`tokens/`](tokens/). **No escribas un hex en un componente**: todos los colores de las referencias tienen token.

| Archivo                | Qué define                                                                   |
| ---------------------- | ---------------------------------------------------------------------------- |
| `tokens/comun.css`     | Estados del sector y apoyo del mapa (iguales en A, B y C), claro y oscuro    |
| `tokens/a.css` `b.css` `c.css` | Neutros, acento, formas, tipografía y sombras de cada propuesta, claro y oscuro |
| `tokens/tailwind.css`  | Puente a Tailwind v4: `bg-fondo`, `text-estado-sin-servicio-tinta`, `rounded-tarjeta`… |

**Modo oscuro:** clase `dark` en `<html>`. Las maquetas de pantalla solo existen en claro; el modo oscuro se obtiene intercambiando tokens. [`referencia/paletas-oscuro.html`](referencia/paletas-oscuro.html) muestra la paleta y los componentes principales en oscuro. Los valores del modo oscuro que no están dibujados en ninguna maqueta se marcan como _extrapolado_ en cada archivo de tokens.

### Los cuatro estados del sector

| Estado            | De dónde sale                                                  | Chip (corto)    | Texto largo               | Icono del chip | Relleno del mapa (claro) | Trazo (claro) | Chip: fondo / tinta (claro) |
| ----------------- | -------------------------------------------------------------- | --------------- | ------------------------- | -------------- | ------------------------ | ------------- | --------------------------- |
| **Con servicio**  | `estado = con_servicio` y `reportesSinConfirmar = 0`           | Con servicio    | Con servicio              | `check-circle` | `#5b9bd5` al 60 %        | `#235c94`     | `#e3eef9` / `#18486f`       |
| **Sin confirmar** | `estado = con_servicio` y `reportesSinConfirmar > 0`           | Sin confirmar   | Reportes sin confirmar    | `help-circle`  | trama diagonal ámbar     | `#946200`     | `#fdf0ce` / `#6a4700`       |
| **Sin servicio**  | `estado = sin_servicio`                                        | Sin servicio    | Sin servicio              | `x-circle`     | `#c0391a` al 78 %        | `#8f2a12`     | `#fbe6df` / `#8a2b10`       |
| **Sin datos**     | Estado del cliente: primera carga sin red y sin caché          | Sin datos       | Sin datos                 | `minus-circle` | `#9ca3af` al 38 %, trazo punteado | `#6f7782` | `#edeff2` / `#474f5c`  |

- Si el sector está `sin_servicio`, se muestra "Sin servicio" aunque haya reportes sin confirmar.
- "Sin datos" no lo envía la API: lo decide el cliente cuando no tiene nada guardado.
- Los valores oscuros están en `tokens/comun.css`.
- El texto corto va en los chips; el largo, en las leyendas con espacio. Los **chips de sincronización** reutilizan estos colores: _Pendiente_ usa los de "Sin confirmar"; _Error_, los de "Sin servicio"; _Enviado_ es neutro (`--texto-2` sobre `--superficie-2`).

### Por qué estos colores

- **Azul y no verde para "con servicio".** Con un verde azulado, el par con/sin servicio se separaba solo ΔE 12 simulando protanopía; con azul, 34. El par azul/bermellón es el clásico seguro para daltónicos, y además varía en luminosidad, no solo en tono.
- **En oscuro, el rojo es más profundo y el ámbar más claro.** Con los primeros valores oscuros, "sin servicio" y "sin confirmar" se separaban ΔE 4,3 bajo deuteranopía. Ahora el peor par de todo el sistema (4 estados × 3 propuestas × claro y oscuro × 4 tipos de visión) queda en ΔE 15,5.
- **Se verifica con una herramienta, no a ojo:**

  ```
  node docs/frontend/herramientas/verificar-tokens.mjs
  ```

  Comprueba contraste WCAG, que cada token claro tenga su par oscuro, que todo color de las maquetas tenga token, y la distinción por daltonismo (simulación de Machado et al., 2009; ΔE de CIELAB al menos 15). Estos son los mínimos reales de hoy:

  | Par                                        | Mínimo | Exigido |
  | ------------------------------------------ | ------ | ------- |
  | Texto principal sobre fondos               | 14,1:1 | 4,5:1   |
  | Texto secundario sobre fondos              | 6,3:1  | 4,5:1   |
  | Texto sobre el acento (botón principal)    | 6,7:1  | 4,5:1   |
  | Chips de estado (tinta sobre fondo)        | 7,2:1  | 4,5:1   |
  | Borde de controles (interfaz)              | 3,2:1  | 3:1     |
  | Anillo de foco (interfaz)                  | 5,0:1  | 3:1     |
  | Trazo de estado sobre el mapa (interfaz)   | 3,9:1  | 3:1     |
  | Estados del mapa entre sí, con daltonismo  | ΔE 15,5 | ΔE 15  |

  **Si cambias un color de estado o del acento, corre la herramienta antes de abrir el PR.**

---

## 4. El mapa

Se construye con **react-leaflet** y teselas de OpenStreetMap ([`CLAUDE.md`](../../CLAUDE.md) §4). Es una **coropleta**: se colorea cada polígono de sector según su estado, y no se dibuja nada más.

> Las teselas reales nunca serán idénticas al arte plano de las maquetas (calles blancas sobre gris). **Lo que debe coincidir 1:1 es todo lo que va encima**: polígonos, trazos, tramas, etiquetas, insignias, leyenda, atribución y controles. La geometría de los sectores viene de `GET /sectores` (T-014), no del dibujo.

### 4.1 Capas y atribución

- `<MapContainer zoomControl={false} attributionControl={false}>`; el fondo del contenedor es `var(--mapa-base)`, para que no parpadee en blanco mientras cargan las teselas.
- Teselas: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom={19}`, `className="teselas"`.
- **Atribución obligatoria y siempre visible:** el texto "© OpenStreetMap contributors" con enlace a `https://www.openstreetmap.org/copyright`. Es un elemento propio (hermano del mapa, no hijo), de 12 px. En **A** va sobre el mapa, en la esquina inferior derecha, con fondo `rgba(255, 255, 255, 0.85)` en claro; **en su teléfono va por encima de la hoja inferior** (unos 6 px sobre su borde superior), si no, la hoja la tapa. En **B y C** va justo debajo de la tarjeta del minimapa, en `--secundario`; en el teléfono de C, a la derecha de la fila de recuentos.
- Para acercar las teselas a un fondo sobrio, filtra solo la capa base (valores de partida; ajústalos mirando el mapa real):

  ```css
  .teselas {
    filter: grayscale(0.85) contrast(0.92) brightness(1.06);
  }
  .dark .teselas {
    filter: invert(1) hue-rotate(180deg) grayscale(0.6) brightness(0.8) contrast(0.9);
  }
  ```

- Política de uso de las teselas de OSM (válida para un piloto pequeño; revisar si crece el tráfico): <https://operations.osmfoundation.org/policies/tiles/>. Cambiar de proveedor de teselas requiere decisión de Leonardo.

### 4.2 Estilo de cada estado

Los polígonos se estilan **con clases CSS**, no con colores en línea, para que el modo oscuro cambie solo con la clase `dark`. Leaflet acepta `className` en las opciones de cada capa:

```ts
const clase = (estado: EstadoVisual) => `sector sector--${estado}`; // 'con-servicio' | 'sin-confirmar' | 'sin-servicio' | 'sin-datos'

<GeoJSON data={sectores} style={(f) => ({ className: clase(estadoVisual(f)), weight: 2.5 })} />
```

```css
.sector {
  stroke-width: 2.5px;
  stroke-linejoin: round;
}
.sector--con-servicio {
  fill: var(--estado-con-servicio-relleno);
  fill-opacity: var(--estado-con-servicio-opacidad);
  stroke: var(--estado-con-servicio-trazo);
}
.sector--sin-servicio {
  fill: var(--estado-sin-servicio-relleno);
  fill-opacity: var(--estado-sin-servicio-opacidad);
  stroke: var(--estado-sin-servicio-trazo);
}
.sector--sin-confirmar {
  fill: url(#trama);
  fill-opacity: 1;
  stroke: var(--estado-sin-confirmar-trazo);
}
.sector--sin-datos {
  fill: var(--estado-sin-datos-relleno);
  fill-opacity: var(--estado-sin-datos-opacidad);
  stroke: var(--estado-sin-datos-trazo);
  stroke-dasharray: 6 5;
}
```

La **trama** de "sin confirmar" se define una sola vez en un `<svg>` oculto al inicio de la página (la referencia lo hace igual) y las capas la usan con `fill: url(#trama)`; sus colores salen de los tokens, así que cambian con el modo oscuro:

```html
<svg width="0" height="0" style="position: absolute" aria-hidden="true">
  <defs>
    <pattern id="trama" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="9" height="9" class="trama-fondo" />
      <line x1="0" y1="0" x2="0" y2="9" stroke-width="3" class="trama-linea" />
    </pattern>
  </defs>
</svg>
```

```css
.trama-fondo {
  fill: var(--estado-sin-confirmar-relleno);
  fill-opacity: var(--estado-sin-confirmar-opacidad);
}
.trama-linea {
  stroke: var(--estado-sin-confirmar-trazo);
}
```

### 4.3 Tu sector, etiquetas e insignias

- **Contorno de "tu sector"**: una segunda capa con la misma geometría solo del sector del residente, `fill: none; stroke: var(--texto); stroke-linejoin: round`, sin interacción (`interactive: false`). Por encima de la capa de estados.
- **Etiqueta de sector**: texto `700` con un halo del color del fondo, para leerse sobre cualquier relleno. Se dibuja como `L.divIcon` con un `<svg>` interior, para poder usar `paint-order`:

  ```html
  <svg ...><text style="paint-order: stroke; stroke: var(--mapa-halo); stroke-width: 5px; stroke-linejoin: round; fill: var(--texto)">Sector 1</text></svg>
  ```

- **Insignia de estado**: círculo de `--mapa-insignia` con borde de 1 px y el glifo del estado dentro, en la tinta del estado. Glifos: `check-insignia`, `x-insignia`, `interrogacion` (§5).
- **Etiqueta "Tu sector"** (solo en el mapa de A): píldora de `--texto` con texto `--superficie`, 700, sobre el sector del residente. B y C marcan "tu sector" solo con el contorno grueso.
- **Dónde va cada cosa**: en el punto de `@turf/center-of-mass` de cada sector; si ese punto cae fuera del polígono (sectores cóncavos), en `@turf/point-on-feature`.
- **Sector seleccionado** _(no dibujado)_: lleva el mismo contorno grueso que "tu sector". Por defecto está seleccionado el del residente.

### 4.4 Tamaños: dos escalas

Las maquetas dibujan el mapa como un SVG que se amplía o reduce con su contenedor; en producción esos tamaños son **fijos en píxeles** y no cambian con el zoom del mapa. Estas son las tres escalas que aparecen en las referencias, medidas a su tamaño de dibujo (a 1280 px de ancho para las de escritorio):

| Elemento                                | Teléfono de A (escala 0,75) | Minimapas de B y C en escritorio (0,65) | Mapa grande de A en escritorio (1,42) |
| --------------------------------------- | --------------------------- | --------------------------------------- | ------------------------------------- |
| Trazo del sector                        | 2 px                        | 1,6 px                                  | 3,5 px                                |
| Contorno de "tu sector"                 | 4 px                        | 3,2 px                                  | 7 px                                  |
| Etiqueta de sector                      | 14 px / 700                 | 13 px / 700                             | 24 px / 700                           |
| Halo de la etiqueta (grosor del trazo)  | 4 px                        | 3,2 px                                  | 7 px                                  |
| Insignia (diámetro)                     | 22 px                       | 20 px                                   | 43 px                                 |
| Etiqueta "Tu sector"                    | 75 × 20 px, texto 10 px     | no lleva                                | 142 × 37 px, texto 18 px              |
| Trama (período / grosor de línea)       | 7 px / 2 px                 | 6 px / 2 px                             | 13 px / 4 px                          |
| Trazo punteado de "sin datos"           | 4,5 / 3,8 px                | 3,9 / 3,2 px                            | 8,5 / 7 px                            |

- **Para producción:** usa la columna del teléfono de A como escala base de los mapas pequeños (teléfono y minimapas) y la del mapa grande de A para el mapa de escritorio. Las diferencias de los minimapas de B y C (13 % menores) se pueden respetar o no; no se notan.
- El texto de una etiqueta **no baja de 11 px** aunque la maqueta, por su escala, lo dibuje más pequeño (es el caso del "Tu sector" de 10 px).
- En el minimapa de **C** del teléfono (escala 0,47) no hay insignias ni la palabra "Sector": las etiquetas son los números 1 a 4 en monoespaciada de 18 px, con trazo de 1,4 px y contorno de 3,3 px (ver [`propuesta-c.md`](propuesta-c.md)).

### 4.5 Leyenda

Tres chips de estado (con servicio, sin confirmar, sin servicio), en el orden de la maqueta. No incluye "sin datos". El formato (chips en fila, tarjeta con título "Leyenda", recuento por estado) es propio de cada propuesta.

### 4.6 Accesibilidad del mapa

- El contenedor del mapa lleva `role="img"` y `aria-label` como el de las maquetas: `Mapa de sectores: Sector 1 sin servicio, Sector 2 con servicio, Sector 3 con reportes sin confirmar, Sector 4 con servicio` (se arma con el estado de cada sector).
- **El mapa nunca es la única vía.** Toda su información está también en una lista navegable por teclado y lector de pantalla: el Panel (A y C) y el Inicio (B). Los polígonos no necesitan ser enfocables.
- Los cambios de estado que llegan por Realtime se anuncian en una región `aria-live="polite"` (una frase por cambio: "Sector 2: sin servicio eléctrico"), sin repetir el anuncio de lo que no cambió.

---

## 5. Iconos

Los iconos de las maquetas son de [Feather](https://feathericons.com) (licencia MIT) con tres glifos propios para las insignias. Para ser idénticos, **usa estos trazos** (no Lucide: sus formas difieren ligeramente). Todos van en un `viewBox="0 0 24 24"` con `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, y `aria-hidden="true"` salvo que sean el único contenido de un control (entonces el control lleva `aria-label`).

| Nombre            | Uso                                               | Contenido del `<svg>`                                                                                                                                                              |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zap`             | Servicio Luz                                      | `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`                                                                                                                       |
| `droplet`         | Servicio Agua                                     | `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`                                                                                                                                |
| `map`             | Mapa                                              | `<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>`                                       |
| `grid`            | Panel                                             | `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`           |
| `home`            | Inicio (B)                                        | `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`                                                                             |
| `plus`            | Reportar (pestaña del teléfono)                   | `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`                                                                                                     |
| `plus-circle`     | Reportar (navegación de escritorio)               | `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`                                                                     |
| `user`            | Cuenta                                            | `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`                                                                                              |
| `wifi`            | En línea                                          | `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`             |
| `wifi-off`        | Sin conexión                                      | `<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>` |
| `clock`           | Pendiente                                         | `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`                                                                                                            |
| `check`           | Enviado; "con servicio" en chips compactos        | `<polyline points="20 6 9 17 4 12"/>`                                                                                                                                              |
| `check-circle`    | "Con servicio" en chips con icono                 | `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`                                                                                         |
| `x`               | "Sin servicio" en chips compactos                 | `<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>`                                                                                                       |
| `x-circle`        | "Sin servicio" en chips con icono                 | `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`                                                                       |
| `help-circle`     | "Sin confirmar" en chips con icono                | `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>`                                                        |
| `interrogacion`   | "Sin confirmar" en chips compactos e insignias    | `<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>`                                                                                       |
| `minus-circle`    | "Sin datos"                                       | `<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>`                                                                                                           |
| `alert-triangle`  | Error de sincronización                           | `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>` |
| `download`        | Instalar la app                                   | `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`                                                 |
| `check-insignia`  | Glifo de la insignia "con servicio" (mapa)        | `<polyline points="6 12.5 10.5 17 18 8"/>`                                                                                                                                         |
| `x-insignia`      | Glifo de la insignia "sin servicio" (mapa)        | `<line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/>`                                                                                                       |

**Grosor del trazo** (`stroke-width`): 2 en navegación, controles y chips con icono de A; 2,2 en los chips con icono de B y en los chips de sincronización; 2,4 en el `plus` de la pestaña Reportar y en el check de "Sincronizado" de C; 2,6 en los glifos compactos (`check`, `x`, `interrogacion` dentro de chips de 13 a 14 px). Los tamaños de cada uso están en el documento de cada propuesta.

**Marca (logo):** un pin con un rayo recortado. Se dibuja así, en el color de acento de la propuesta (o `--texto` en C), con el rayo del color del fondo:

```html
<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.2c-3.9 0-7 3-7 6.9 0 5.2 7 12.7 7 12.7s7-7.5 7-12.7c0-3.9-3.1-6.9-7-6.9z" fill="var(--acento)" />
  <path d="M12.9 5.6 8.9 10.6h2.7l-.6 3.8 4.1-5.1h-2.7z" fill="var(--superficie)" />
</svg>
```

Un componente mínimo para todo lo anterior:

```tsx
// componentes/ui/Icono.tsx
const TRAZOS = {
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  // … el resto de la tabla anterior
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tamano = 20, grosor = 2 }: { nombre: NombreIcono; tamano?: number; grosor?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS[nombre]}
    </svg>
  );
}
```

El icono de la app para la PWA está en [`referencia/icono-a.svg`](referencia/icono-a.svg), `icono-b.svg` e `icono-c.svg` (ver [`PWA.md`](PWA.md) §3).

---

## 6. Tipografía y números

- La familia, los tamaños y los pesos de cada propuesta están en su documento. Reglas comunes:
  - **Nada por debajo de 12 px** en la interfaz (la única excepción es la etiqueta del mapa, §4.4, con mínimo de 11 px).
  - Los títulos de bloque llevan `line-height: 1.2`; el texto, el normal.
  - Las cifras que se comparan (duraciones, horas, recuentos) usan numerales **tabulares**: `font-variant-numeric: tabular-nums` (A y B) o la fuente monoespaciada (C).
  - Los titulares de B llevan `text-wrap: balance`, para no dejar "14:20" suelto en una línea.
- Las fuentes se **autoalojan** (no se cargan de Google en producción): ver [`PWA.md`](PWA.md) §8. Las referencias de B y C las cargan de Google Fonts solo para que se vean al abrirlas.

---

## 7. Textos y formatos

### 7.1 Formatos

Estos tres formateadores reproducen, con los datos de `datos-ejemplo.json`, todas las cadenas de las referencias (se comprobó una por una). Úsalos tal cual:

```ts
const ZONA = 'America/Caracas';
const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "14:20": 24 h, hora de Caracas. Se usa 'en-GB' solo porque garantiza HH:mm sin a. m./p. m. */
export const hora = (iso: string) => formatoHora.format(new Date(iso));

/** "Hoy", "Ayer", "Hace 3 días": por día calendario de Caracas, no por bloques de 24 h. */
export function diaRelativo(iso: string, ahora: string): string {
  const dias = Math.round((Date.parse(`${formatoDia.format(new Date(ahora))}T00:00:00Z`) - Date.parse(`${formatoDia.format(new Date(iso))}T00:00:00Z`)) / 86_400_000);
  return dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

/** 240 → "4 h"; 220 → "3 h 40 min"; 305 → "5 h 5 min"; 45 → "45 min". Minutos enteros. */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
```

Reglas:

- **Estimación:** `aprox. ` + `duracion(medianaMin)`, siempre con ese prefijo, también en las tablas. Debajo o al lado, el n: "según 12 cortes registrados" (singular: "según 1 corte registrado"). Con `suficiente = false`: **no hay cifra**; se muestra "Datos insuficientes" y "{n} de {nMin} cortes registrados" (en C, "{n} de {nMin} cortes").
- **Rango intercuartílico** (solo C): "`duracion(q1Min)` – `duracion(q3Min)`" con raya (–). La barra usa un eje de 0 a 8 h: `left = q1/480`, `ancho = (q3 − q1)/480`, marca de la mediana en `mediana/480`, en porcentajes.
- **Intervalos de horas:** A escribe "09:10 a 12:40"; B separa Inicio y Fin en columnas; C escribe "Ayer, 15:00 – 19:35" con raya.
- **Sin confirmar:** "{k} de {N} reportes", con `N = consensoN` ([`datos.md`](datos.md)).
- **Botón de reportar**, según el estado del servicio: sin servicio → "Ya volvió la luz" / "Ya volvió el agua"; con servicio → "Se fue la luz" / "Se fue el agua". (Las maquetas dibujan "Ya volvió la luz" y "Se fue el agua"; las otras dos salen de la misma regla.)
- **Nombre del servicio:** `electricidad` → "Luz"; `agua` → "Agua".

### 7.2 Catálogo de textos de las maquetas

`{…}` es un dato. Una celda con A, B o C indica que el texto es solo de esa propuesta.

| Dónde                          | Texto                                                                                                   | Propuesta |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | --------- |
| Navegación                     | Mapa · Panel · Reportar · Cuenta                                                                        | A, C      |
| Navegación                     | Inicio · Mapa · Cuenta                                                                                  | B         |
| Marca                          | BlackoutTracker                                                                                         | todas     |
| Selector de servicio           | Luz · Agua (grupo con `aria-label="Servicio"`)                                                          | A, C      |
| Sector propio                  | Tu sector                                                                                               | todas     |
| Aviso sin conexión             | Sin conexión · datos no actualizados ({hora})                                                           | todas     |
| Aviso en línea                 | En línea · actualizado a las {hora}                                                                     | A, B      |
| Aviso en línea                 | Sincronizado · {hora}                                                                                   | C         |
| Cola                           | {n} pendiente(s) (botón); `aria-label`: "{n} aviso pendiente de envío"                                  | A, B / C  |
| Cola, detalle                  | Tu aviso «Volvió la luz» ({hora}) está pendiente de envío                                               | A         |
| Cola, detalle                  | Aviso «Volvió la luz» pendiente · Se enviará al reconectar                                              | B         |
| Cola, detalle                  | Tu aviso «Volvió la luz» ({hora}) · pendiente                                                           | C         |
| Chips de sincronización        | Pendiente · Enviado · Error                                                                             | todas     |
| Estados (chips)                | Con servicio · Sin confirmar · Sin servicio · Sin datos                                                 | todas     |
| Leyenda                        | Leyenda · Con servicio · Reportes sin confirmar · Sin servicio                                          | A         |
| Detalle del sector             | Desde las {hora} · confirmado por {n} vecinos                                                           | A         |
| Detalle del sector             | Sin luz desde las {hora} · {n} vecinos lo confirmaron                                                   | B         |
| Detalle del sector             | desde {hora}                                                                                            | C         |
| Servicio sin corte             | Hay agua · Última interrupción: hace {n} días, duró {duración}                                          | B         |
| Estimación                     | Estimación estadística · aprox. {duración} · según {n} cortes registrados                               | A, B      |
| Estimación insuficiente        | Datos insuficientes · {n} de {nMin} cortes registrados                                                  | B         |
| Estimación (C)                 | Estimación (mediana) · Rango habitual (cuartiles) · Cortes · Duración típica · {n} cortes · {n} de {nMin} cortes | C  |
| Nota de la tabla               | La estimación es la mediana de los cortes cerrados del sector. Con menos de {nMin} cortes no se muestra una cifra. | C |
| Acciones                       | Ya volvió la luz · Se fue el agua · Ver mapa · Ver completo                                             | A, B      |
| Historial                      | Últimos cortes (A) · Últimos cortes en tu sector (B) · Cortes recientes (C) · En curso · En curso desde las {hora} | A, B, C |
| Historial                      | Hoy · Ayer · Hace {n} días                                                                              | A, B, C   |
| Tabla de historial             | Servicio · Inicio · Fin · Duración                                                                      | B         |
| Otros sectores                 | Otros sectores · {k} de {N} reportes                                                                    | B         |
| Tabla de sectores              | Sectores · Luz · Sector · Estado · Desde · {n} sectores · actualizado a las {hora}                      | C         |
| Instalar la app                | Instalar BlackoutTracker · Se abre como una app y sigue funcionando sin conexión. · Instalar            | A         |
| Versión nueva                  | Hay una versión nueva de la app · Actualizar                                                            | B         |
| Mapa                           | `aria-label` "Mapa de sectores: …" · © OpenStreetMap contributors                                       | todas     |

---

## 8. Accesibilidad

Las maquetas ya están dibujadas con elementos reales; el código debe conservar esa semántica:

- **Contraste AA** en todo (ver §3). Los bordes de controles y el anillo de foco, 3:1.
- Controles con `<button>`, `<a href>`, `<input>` + `<label>`. Nunca `div` con `onClick`.
- `<nav aria-label="Principal">` con `aria-current="page"` en la sección activa.
- El selector de servicio es un grupo (`role="group"`, `aria-label="Servicio"`) con botones `aria-pressed`.
- Los avisos de conexión y de cola usan `role="status"`.
- Botones solo con icono llevan `aria-label` (por ejemplo, el reloj de C).
- Jerarquía de títulos: un `h1` por pantalla; los bloques, `h2`; sus partes, `h3`.
- `lang="es"` en `<html>`.
- Texto al 200 % sin perder contenido; nada con alto fijo que recorte texto.
- `@media (prefers-reduced-motion: reduce)`: sin animaciones de desplazamiento ni de entrada.
- Se prueba con `@axe-core/playwright`: cero violaciones graves o críticas en cada pantalla.

---

## 9. Primitivos comunes

Los tres diseños comparten estas piezas. Se construyen una vez con los tokens y se parametrizan por propuesta (la forma de cada una, en su documento):

| Primitivo           | Qué hace                                                                | Entradas principales                        |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| `Icono`             | Un icono de §5                                                          | `nombre`, `tamano`, `grosor`                |
| `EstadoChip`        | Chip de estado (§3), con icono completo o compacto                      | `estado`, `variante`, `texto`               |
| `ChipSync`          | Chip _Pendiente_ / _Enviado_ / _Error_                                  | `estado`                                    |
| `AvisoConexion`     | Franja "Sin conexión · datos no actualizados (HH:mm)"                   | `ultimaSincronizacion`                      |
| `BotonPendientes`   | Botón de la cola, con texto o solo icono con insignia                   | `cantidad`, `variante`                      |
| `SelectorServicio`  | Luz / Agua                                                              | `valor`, `onChange`                         |
| `BloqueEstimacion`  | Estimación con su n, o "Datos insuficientes"                            | `estimacion`, `nMin`                        |
| `MapaSectores`      | La coropleta de §4                                                      | `sectores`, `estados`, `escala`             |
| `LeyendaMapa`       | Leyenda de estados                                                      | `variante`                                  |
| `AtribucionOSM`     | Atribución obligatoria                                                  | —                                           |
| Navegación          | Inferior (teléfono), lateral (A) o superior (B y C)                     | `items`, `activo`                           |
| `AvisoInstalacion`, `AvisoVersion` | Instalar la app; "Hay una versión nueva"                 | `onAceptar`                                 |

---

## 10. Estructura sugerida de `apps/web/src`

Los nombres siguen la convención del plan ([`PLAN.md`](../PLAN.md) §3): el dominio en español, sin tildes; el framework, en inglés.

```
src/
├─ main.tsx · App.tsx
├─ estilos/              tokens (los de docs/frontend/tokens), globales.css, mapa.css
├─ componentes/ui/       los primitivos de §9 (sin lógica de negocio)
├─ mapa/                 MapaSectores y todo lo de Leaflet
├─ inicio/ · panel/      las pantallas de cada propuesta
├─ reportes/ · registro/ pantallas y formularios que las maquetas no cubren
├─ datos/                cliente de la API, TanStack Query, cola en Dexie
├─ pwa/                  sw.ts (injectManifest), registro, instalación
└─ utils/formato.ts      hora, diaRelativo, duracion (§7.1)
```

---

## 11. Pruebas de fidelidad

"Igualito" se demuestra comparando la app con la referencia, en el mismo navegador y a los mismos tamaños. Cada pantalla de las maquetas es un caso:

1. **Modo demostración.** La app acepta `/?demo=en-linea` y `/?demo=sin-conexion`: carga [`datos-ejemplo.json`](datos-ejemplo.json), fija el reloj en `2026-10-07T19:06:00Z` (las 15:06 de Caracas) y aplica el escenario. **Los teléfonos de las referencias son `sin-conexion`; los escritorios, `en-linea`.**
2. **Misma condición de captura:** `deviceScaleFactor: 1`, `locale: 'es-VE'`, `timezoneId: 'America/Caracas'`, `colorScheme: 'light'`, `reducedMotion: 'reduce'`, y esperar a `document.fonts.ready`.
3. **Se oculta solo el mapa** en ambas páginas (`visibility: hidden` en el contenedor de Leaflet y en el `<svg role="img">` de la referencia) y se deja visible todo lo que va encima. Por eso las superposiciones (barra, selector, leyenda, atribución, hoja) son **hermanas** del `MapContainer`, no hijas.
4. **Comparación con `pixelmatch`** entre la captura de la app y la de la referencia (`file://…/referencia/a-telefono.html`), a 390 × 844 para teléfono y 1280 × 860 para escritorio (A también a 1024). Se acepta como máximo el **1 %** de píxeles distintos; el antialiasing de las fuentes explica la diferencia residual.
5. **`axe`** sin violaciones graves ni críticas, y **Lighthouse** con los objetivos de [`CLAUDE.md`](../../CLAUDE.md) §7 (PWA, y usable en 8 s con 3G lenta y en 3 s con caché).

```ts
// Esquema (Playwright + pixelmatch + pngjs)
const ref = await paginaReferencia.screenshot();   // file:///…/referencia/a-telefono.html
const app = await paginaApp.screenshot();          // /?demo=sin-conexion
const diff = pixelmatch(PNG.sync.read(ref).data, PNG.sync.read(app).data, null, 390, 844, { threshold: 0.1 });
expect(diff / (390 * 844)).toBeLessThan(0.01);
```

La referencia se renderiza en el mismo Chromium y con las mismas fuentes que la app. Con las fuentes autoalojadas (que pueden ser otra versión de los archivos que sirve Google) es normal una diferencia residual por el trazado de los glifos; **mientras no pase del 1 %, está bien**. Con las mismas fuentes que las referencias, el resultado esperado es 0,00 %. Si cambia el diseño, se vuelve a exportar desde el lienzo y se regeneran estas comparaciones; no se editan las referencias a mano.
