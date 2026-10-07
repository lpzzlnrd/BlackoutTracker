# Changelog

Todos los cambios relevantes de BlackoutTracker se anotan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen [SemVer](https://semver.org/lang/es/): `0.x` durante el desarrollo y una versión menor por fase (ver `docs/PLAN.md` §9).

Secciones por versión: **Añadido**, **Cambiado**, **Corregido**, **Eliminado**, **Seguridad**. Cada línea lleva el ID de la tarea (`T-0XX`) y, si aplica, los de los casos de prueba.

## [Sin publicar]

### Añadido
- Canon del frontend (`docs/frontend/`): tres diseños completos de la PWA (A mapa primero, B estado primero, C datos primero) con sus referencias HTML, tokens CSS, receta de construcción por pantalla, datos de ejemplo y guía de la PWA. Incluye `herramientas/verificar-tokens.mjs`, que comprueba contraste, daltonismo y cobertura de los colores.
- `CLAUDE.md` con el contexto del proyecto y el stack definitivo (D-001).
- `docs/casos-de-prueba.md` (resumen del plan de pruebas ISO/IEC/IEEE 29119-3) y `docs/contexto-academico.md`.
- `docs/PLAN.md` (plan de implementación), `docs/TAREAS.md` (lista de tareas y protocolo de las sesiones), `docs/DECISIONES.md` (registro de decisiones) y este changelog.

### Cambiado
- La rama principal ahora se llama `main` (antes `master`).
