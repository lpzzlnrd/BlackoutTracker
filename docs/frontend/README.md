# Canon del frontend · BlackoutTracker

> Para quien implemente `apps/web`. Este directorio contiene tres diseños completos de la PWA y todo lo necesario para **replicarlos idénticos**: los diseños en HTML, sus colores en CSS, las medidas y la receta de cada pantalla, y la manera de comprobar que el código coincide con el diseño.
> Lo escribió el backend (Leonardo) para que quien haga el frontend no tenga que adivinar. El backend no toca `apps/web`.

## 1. Qué hay aquí

Tres propuestas de diseño, cada una con **paleta neutra, tipografía y formas propias**, en teléfono y en escritorio, en claro y en oscuro:

| Propuesta                    | Pantalla de entrada                                   | Estilo                                       | Fuente                                  | Documento                              |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------- | --------------------------------------- | -------------------------------------- |
| **A · Mapa primero**         | El mapa, con el sector en una hoja o panel            | Pizarra y azul, bordes finos                 | La del sistema                          | [`propuesta-a.md`](propuesta-a.md)     |
| **B · Estado primero**       | "¿Qué pasa en mi sector?", una tarjeta por servicio   | Piedra y verde, radios grandes, sombras suaves | Atkinson Hyperlegible                 | [`propuesta-b.md`](propuesta-b.md)     |
| **C · Datos primero**        | El Panel: lista y tabla de todos los sectores, con n  | Grafito, sin color de marca, líneas finas    | IBM Plex Sans y Mono                    | [`propuesta-c.md`](propuesta-c.md)     |

Son tres diseños completos, **no temas intercambiables** de las mismas pantallas: cada uno tiene su propia estructura. Comparten los estados del sector (azul, ámbar, bermellón, gris), el mapa, los iconos, los textos, los datos y la PWA, que están en los documentos comunes.

El origen de los diseños es un lienzo de Claude Design (privado, hay que pedir acceso): <https://claude.ai/artifact/R1oScZR9sCphSuDmrcvAS9>. **La fuente de verdad en el repo es la carpeta [`referencia/`](referencia/).**

## 2. Orden de trabajo: A → B → C

1. **A primero**, porque construye lo que los otros reutilizan: los primitivos (`EstadoChip`, `ChipSync`, `AvisoConexion`, `SelectorServicio`, `BloqueEstimacion`), el mapa de sectores con su leyenda y atribución, la navegación inferior y las hojas. B y C usan el mapa de A en su pestaña "Mapa" y al tocar un sector.
2. **B después**: añade la `TarjetaServicio` (la pieza central de su inicio) y la tabla de historial.
3. **C al final**: añade la tabla de sectores, la `BarraRango` del rango intercuartílico y el minimapa numerado. Es la que más datos del backend necesita ([`datos.md`](datos.md) §3).

Cada documento de propuesta termina con una **receta de construcción** ordenada y una **lista de comprobación**.

## 3. Cómo replicar "igualito"

"Igualito" aquí es verificable, no una impresión:

1. **Abre la referencia** (`referencia/a-telefono.html`, etc.) en el navegador. Son páginas estáticas: basta hacer doble clic. B y C necesitan internet solo para cargar sus fuentes. Con las herramientas de desarrollo del navegador se ve el CSS exacto de cada elemento: **está escrito en línea en el propio HTML**.
2. **Carga los tokens** ([`tokens/`](tokens/)) y no escribas ningún color ni valor de forma suelto.
3. **Construye los primitivos y las pantallas** siguiendo la receta del documento de la propuesta. Las regiones principales de cada referencia llevan un comentario HTML con su nombre (`<!-- Hoja inferior con el sector del vecino -->`); los documentos usan esos mismos nombres.
4. **Usa el modo demostración** con [`datos-ejemplo.json`](datos-ejemplo.json): los mismos datos y la misma hora (15:06 de Caracas) que muestran las referencias.
5. **Compara automáticamente** la app con la referencia a 390 × 844 y a 1280 × 860 (y 1024), con un máximo del 1 % de píxeles distintos, el mapa oculto: ver [`CANON.md`](CANON.md) §11.

Si algo de un documento contradice una referencia, **manda la referencia**.

**Los documentos bastan, y está medido:** las seis pantallas (teléfono y escritorio de A, B y C) se reconstruyeron escribiendo el código solo a partir de estos documentos y de los tokens, y dieron **0,00 % de píxeles distintos** frente a las referencias. Eso sí: hace falta la **base de estilos** de [`CANON.md`](CANON.md) §2 (sobre todo `line-height: normal`); sin ella, la diferencia pasa del 1 %.

## 4. Qué cubre y qué no

**Cubre** (todo dibujado y comprobado):

- La pantalla de entrada de cada propuesta, en teléfono (390 × 844) y escritorio (1280 × 860, verificada también a 1024 y 1100).
- La navegación, el selector de servicio, los estados del sector, el mapa, la estimación con su n, el aviso de conexión, la cola de avisos pendientes, "Instalar" y "Hay una versión nueva".
- Las paletas en claro y en oscuro de las tres propuestas.

**No cubre** (sin maqueta; cada documento de propuesta dice cómo resolverlo con los mismos primitivos y tokens):

- Registro (pin en el mapa y cuenta), formulario de **Reportar** y **Cuenta**.
- La pantalla **Mapa** de B y de C (se reutiliza la de A).
- Las **tabletas**: entre 320 y 1023 px se usa el diseño de teléfono, ampliado ([`CANON.md`](CANON.md) §2).
- Las pantallas en **modo oscuro**: se obtienen con los tokens oscuros; solo las paletas y los componentes principales están dibujados en oscuro.

Si se necesita fidelidad exacta también en esas pantallas, hay que **diseñarlas primero**.

## 5. Mapa de archivos

```
docs/frontend/
├─ README.md             esta guía
├─ CANON.md              fundamentos comunes: responsive, color y estados, mapa, iconos, textos, accesibilidad, pruebas
├─ PWA.md                manifest, service worker, sin conexión y cola, instalación, fuentes, rendimiento
├─ datos.md              qué datos necesita cada pantalla y qué le falta hoy a la API
├─ propuesta-a.md        A: tokens, tipografía, formas, anatomía de teléfono y escritorio, receta
├─ propuesta-b.md        B: ídem
├─ propuesta-c.md        C: ídem
├─ datos-ejemplo.json    los datos exactos que muestran las referencias
├─ tokens/
│  ├─ comun.css          estados del sector y apoyo del mapa (claro y oscuro)
│  ├─ a.css  b.css  c.css  neutros, acento, formas y tipografía de cada propuesta (claro y oscuro)
│  └─ tailwind.css       puente a Tailwind v4
├─ herramientas/
│  └─ verificar-tokens.mjs   contraste, daltonismo, pares claro/oscuro y cobertura de colores
└─ referencia/           los diseños: HTML estático + los iconos de la app
   ├─ a-telefono.html  a-escritorio.html
   ├─ b-telefono.html  b-escritorio.html
   ├─ c-telefono.html  c-escritorio.html
   ├─ paletas-claro.html  paletas-oscuro.html
   └─ icono-a.svg  icono-b.svg  icono-c.svg
```

## 6. Cómo se comprueba que el canon está sano

```
node docs/frontend/herramientas/verificar-tokens.mjs
```

Comprueba el contraste de todos los pares de color en claro y oscuro (texto al menos 14,1:1 y el más débil 6,3:1; AA pide 4,5:1), que cada token tenga su par oscuro, que **todo color usado por las referencias exista como token**, y que los cuatro estados del mapa se distingan con visión normal y con los tres tipos de daltonismo. **Córrela antes de abrir un PR que toque un color.**

## 7. Reglas del repo que aplican

- Idioma: español en la interfaz, los comentarios y los commits. Los identificadores del dominio, en español y sin tildes; los del framework, en inglés ([`PLAN.md`](../PLAN.md) §3).
- Stack: React + Vite + TypeScript, Tailwind, `vite-plugin-pwa` (`injectManifest`), Dexie, TanStack Query, react-leaflet y Turf; `@supabase/supabase-js` solo para Auth y Realtime ([`CLAUDE.md`](../../CLAUDE.md) §4). Solo herramientas libres o de nivel gratuito. Las fuentes y los iconos de este canon son de licencia libre (OFL y MIT).
- Git: una rama por funcionalidad, PR a `main`, no se commitea a `main`; solo Leonardo fusiona ([`CLAUDE.md`](../../CLAUDE.md) §10).
- Los tipos, los enums, los códigos de error y los valores por defecto vienen de `@blackout/shared` (`packages/shared`, T-002): se importan por su nombre, no se copian. El texto de cada código de error está en [`datos.md`](datos.md) §5.

## 8. Si el diseño cambia

Las referencias son el diseño: si cambian, se actualizan **a la vez** los tokens, el documento de la propuesta y, si hace falta, `datos-ejemplo.json`; después se corre el verificador. Cuando se exportan del lienzo de Claude Design, se hace así: quitar `<script src="./support.js">`, desenvolver `<x-dc>`, pasar el contenido de `<helmet>` al `<head>`, borrar el bloque `<script type="text/x-dc">` y añadir `<meta name="viewport" content="width=device-width, initial-scale=1">`. No se les añade ningún otro cambio.

## 9. Lo que depende del backend

Cuatro peticiones, detalladas en [`datos.md`](datos.md) §3, necesarias para mostrar **exactamente** lo que dibujan los diseños. Las decide Leonardo:

- **P1:** que el cliente conozca `consensoN` y `estimacionNMin` (para "2 de **3** reportes" y "3 de **5** cortes").
- **P2:** cuántos vecinos confirmaron el corte (para "confirmado por **3** vecinos").
- **P3:** estimaciones de todos los sectores en una llamada (Panel de C).
- **P4:** cortes recientes de todos los sectores (Panel de C).
