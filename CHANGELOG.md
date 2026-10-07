# Changelog

Todos los cambios relevantes de BlackoutTracker se anotan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen [SemVer](https://semver.org/lang/es/): `0.x` durante el desarrollo y una versión menor por fase (ver `docs/PLAN.md` §9).

Secciones por versión: **Añadido**, **Cambiado**, **Corregido**, **Eliminado**, **Seguridad**. Cada línea lleva el ID de la tarea (`T-0XX`) y, si aplica, los de los casos de prueba.

## [Sin publicar]

### Añadido
- `packages/shared` (`@blackout/shared`): enums del dominio (`TipoServicio`, `EstadoServicio`, `OrigenEvento`), `CodigoError` con el estado HTTP de cada código, interfaces de los DTO de la API, la fila de `estado_sector` y los valores por defecto (N = 3, n_min = 5, ventanas de consenso por servicio y límites de la hora del evento). Se compila con `tsup` a ESM y CJS con sus tipos, para Vite y Nest. Con tests de valores y de consumo (CJS, ESM y `bundler`) (T-002, D-016 a D-018).
- Monorepo pnpm: workspaces `apps/*` y `packages/*`, `tsconfig.base.json`, ESLint 10 (flat config) con Prettier, `.editorconfig`, `.gitattributes` y los scripts raíz `dev`, `build`, `lint`, `format`, `typecheck`, `test` y `test:int` (T-001).
- Canon del frontend (`docs/frontend/`): tres diseños completos de la PWA (A mapa primero, B estado primero, C datos primero) con sus referencias HTML, tokens CSS, receta de construcción por pantalla, datos de ejemplo y guía de la PWA. Incluye `herramientas/verificar-tokens.mjs`, que comprueba contraste, daltonismo y cobertura de los colores.
- `CLAUDE.md` con el contexto del proyecto y el stack definitivo (D-001).
- `docs/casos-de-prueba.md` (resumen del plan de pruebas ISO/IEC/IEEE 29119-3) y `docs/contexto-academico.md`.
- `docs/PLAN.md` (plan de implementación), `docs/TAREAS.md` (lista de tareas y protocolo de las sesiones), `docs/DECISIONES.md` (registro de decisiones) y este changelog.

### Cambiado
- `docs/frontend/datos.md` deja de marcar la forma de los datos como provisional, apunta a `@blackout/shared`, lista las diferencias con `datos-ejemplo.json` y completa la tabla código de error → mensaje en español (T-002).
- La rama principal ahora se llama `main` (antes `master`).
