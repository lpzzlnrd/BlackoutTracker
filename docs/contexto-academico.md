# Contexto académico — BlackoutTracker

Léelo solo para tareas de documentación o de la tesis. Para programar, basta con `CLAUDE.md`.

- **Cátedra:** Sistemas de Información, Escuela de Computación, Facultad de Ingeniería, UJAP. Año 2026. Profesora: Oneida Jimenez.
- **Equipo:** Leonardo Correa (backend e integración) y Freddy Parra (frontend y testing). 12 h/semana cada uno, unas 360 horas-persona en total.
- **Nombres previos del proyecto:** WaterTracker / AquaComunidad.
- **Carpeta de entregables:** `C:\Users\leoco\OneDrive\Desktop\SISTEMAS_INFORMACION`. **Regla permanente:** todo entregable se guarda en esa carpeta, no solo en el chat.

## Título y triángulo de coherencia
Título recomendado, con un solo verbo en infinitivo y sin la palabra "predicción":
> Desarrollar un sistema web de monitoreo colaborativo de las interrupciones del servicio de agua potable y electricidad en la urbanización Guaparo, Valencia, estado Carabobo

**Formulación (1.1.1):**
> ¿Cómo desarrollar un sistema web de monitoreo colaborativo que estructure y valide la información que los residentes de la urbanización Guaparo generan sobre las interrupciones del servicio de agua potable y electricidad?

**Objetivo general:**
> Desarrollar un sistema web de monitoreo colaborativo de las interrupciones del servicio de agua potable y electricidad en la urbanización Guaparo, municipio Valencia, estado Carabobo, que estructure y valide mediante consenso comunitario la información reportada por los residentes.

El título, la pregunta y el objetivo general deben compartir las mismas palabras clave: *monitoreo colaborativo · interrupciones · agua potable y electricidad · Guaparo*.

## Objetivos específicos (reformulados en sep. 2026)
Los 7 objetivos de la propuesta (§4.2) estaban redactados como tareas de desarrollo. Se consolidaron en 5:
1. **Diagnosticar** el manejo actual de la información comunitaria (campaña de campo de 15 días).
2. **Diseñar** el modelo de datos y la arquitectura según la TGS, incluidos el registro con validación geográfica y el consenso estructural.
3. **Formular** la estimación estadística (mediana por sector y servicio) y la relación entre n y la precisión.
4. **Implementar** los módulos: registro, ciclo de reporte, offline y visualización.
5. **Evaluar** el sistema con residentes en condiciones reales.

Reglas para redactarlos:
- El verbo del objetivo general (*Desarrollar*) no se repite en los específicos.
- No se nombra tecnología en los objetivos.
- Cada objetivo debe dejar una evidencia que se pueda mostrar en la defensa.

## Criterios de redacción de la cátedra
- **Ámbito: solo nacional → regional → local** (Venezuela → Valencia/Carabobo → Guaparo). **No usar casos internacionales** (Ghana, Sudáfrica, Perú, etc.): el usuario los descartó.
- **Máximo 2 citas textuales en todo el capítulo.** El resto se parafrasea y se atribuye.
- Párrafos de 6 a 10 líneas (6 sugerido). Formato: Times New Roman 12, interlineado 1,5, sangría de 1,27 cm, márgenes de 2,54 cm, texto justificado.
- El planteamiento va en 2 o 3 párrafos. Incluye el origen de la idea, el público objetivo, la causa, las consecuencias y el pronóstico, y **no muestra la solución** (no nombra BlackoutTracker, ni "aplicación", ni "PWA").
- **Hechos delicados:** se describe el hecho y su efecto, sin culpables ni adjetivos políticos, y siempre atribuido a una fuente. No citar funcionarios ni polémicas políticas.
- Numeración pedida: 1.1, 1.1.1 (formulación), 1.2 (1.2.1, 1.2.2), 1.4, 1.5. El 1.3 se salta; está pendiente confirmarlo con la profesora.
- Alcance = lo que se decide incluir o excluir. Limitación = lo que condiciona sin poder evitarse, y siempre va con su mitigación.
- Leonardo prefiere **guía y andamio** ("dame sugerencias de cómo redactarlo yo") antes que prosa terminada para copiar.
- A veces quiere que los documentos académicos tengan imperfecciones intencionales de nivel estudiante.

## Fuentes nacionales verificadas (sep. 2026)
- **ENCOVI 2025** (IIES-UCAB, coord. Anitza Freitez), 11.352 hogares: 19 % recibe agua diaria continua; 10 % no tiene cortes eléctricos; 39 % tiene cortes diarios y 35 % semanales. Difundida por **El Impulso** (Jesús Dávila, 7-may-2026), que agrega que el 78 % tiene conexión formal a la red.
- **Diario Última Hora Digital** (1-ago-2026): en Carabobo, cortes de 6 h diarias (Hernán Domínguez); en Táchira, 2 cortes diarios de 5 h. **Cita textual 1:** "no son fijos. La gente no sabe y no se puede planificar".
- **El Pitazo** (9-abr-2026): en Valencia, cortes de 6–7 h; horario de 10:30 a. m. a 3:00 p. m. en el C.C. Guaparo. **Cita textual 2:** "En Valencia ya nadie pregunta por qué se fue la luz. Se informan entre ellos, por los grupos de WhatsApp: 'se fue', 'volvió', 'aquí seguimos sin luz'".
- **ACN** (6-ago-2026): la Cámara de Comercio de Valencia estima ~20 horas laborales perdidas por semana.
- **Infobae** (Pedro Pablo Peñaloza, 4-ago-2026): costo de un kit antiapagón doméstico (inversor ~600 USD, UPS, baterías); 5–6 h diarias en Zulia y Aragua. Tiene encuadre político: usar solo los testimonios y los costos.
- **Transparencia Venezuela** (Anzola, 22-mar-2024): el 71 % de los reportes de fallas de **agua** hechos por canales oficiales tuvo resolución mínima o nula. Aplica solo a agua; no extenderlo a electricidad.
- Otras fuentes citadas en la propuesta: GeoBlackout (mapa de fallas de Corpoelec), Maldita.es sobre VenApp (antecedente con carga política), OVSP 2021.
- **eldiario.com/2026/05/09/cortes-electricos-venezuela/:** NO se pudo verificar. Solo se puede usar si el usuario lo transcribe.

## Entregables existentes (en la carpeta SISTEMAS_INFORMACION)
- `PROPUESTA PROYECTO - BLACKOUTTRACKER.docx` / `.pdf`: propuesta formal con objetivos (§4), requerimientos (§5.2–5.3), TGS, metodología, cronograma, recursos, validación y 9 fuentes.
- `PROPUESTA PROYECTO VIEJA - BLACKOUTTRACKER.md`: versión corta. Su sección 2 dice "5 semanas" y debe decir 15; está pendiente corregirlo.
- `CAPITULO 1 - GUIA Y BORRADOR - BLACKOUTTRACKER.md`: guía y borrador del Capítulo 1. Cada sección tiene QUÉ DEBE CONTENER / BORRADOR / CÓMO REDACTARLO TÚ, más los anexos de citas, fuentes y checklist.
- `Plan de Pruebas - BlackoutTracker.docx`: resumido en `docs/casos-de-prueba.md`.
- `Instrumentos_Recoleccion_Datos_BlackoutTracker.docx`, en tres niveles:
  - Software/UX: entrevista semiestructurada, SUS, observación As-Is de WhatsApp, IEEE 830/ISO 29148.
  - Telemetría: Wireshark/tcpdump y JMeter/Prometheus/Grafana.
  - IoT (trabajo futuro): PZEM-004T/ACS712 + ESP32, sensor ultrasónico y de flujo, LoRa/RTC.
- `Diagrama Ishikawa - BlackoutTracker` (.html/.pdf).
- `Diagrama Casos de Uso - BlackoutTracker` (.html/.pdf). Actores: Residente y Sistema (motor automático). Las relaciones «include»/«extend» unen el reporte offline al reporte normal y la sincronización al consenso.
- `Cronograma BlackoutTracker - 15 Semanas.xlsx`: tarea por semana y por responsable (resumido en CLAUDE.md §5).

## Pendientes
- Pasar el Capítulo 1 a Word, cuando Leonardo lo pida.
- Datos que debe completar Leonardo: número de viviendas y habitantes de Guaparo, y el número de párrafo de las dos citas textuales.
- Confirmar con la profesora la numeración del capítulo (el salto del 1.3).
