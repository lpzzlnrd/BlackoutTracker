# Casos de prueba — BlackoutTracker

Resumen del documento original *Plan de Pruebas - BlackoutTracker.docx* (27-sep-2026, basado en ISO/IEC/IEEE 29119-3), que está en la carpeta SISTEMAS_INFORMACION.

- Prioridad: **A** = alta (función esencial), **M** = media, **B** = baja.
- Umbral de consenso **N = 3**.

## Niveles de prueba
| Nivel | Qué se prueba | Responsable |
|---|---|---|
| Unitarias | Point-in-polygon, regla de consenso, mediana y cola local (caja blanca: cobertura de ramas) | Leonardo (back) / Freddy (front) |
| Integración | PWA ↔ BD ↔ auth ↔ realtime | Leonardo |
| Sistema | Flujos de extremo a extremo (partición de equivalencia, valores límite) | Freddy |
| No funcionales | Red lenta, offline, compatibilidad, privacidad, usabilidad | Ambos |
| Aceptación | 8–10 residentes de Guaparo + SUS | Ambos |

Técnicas: partición de equivalencia, valores límite (N−1 / N / N+1 y pin sobre el borde), escenarios reales (corte de luz que también tumba los datos móviles) y cobertura de ramas en consenso y mediana.

Datos de prueba:
- El polígono real, con coordenadas de control dentro, fuera y sobre el borde.
- 10–15 usuarios ficticios repartidos en varios sectores.
- El historial de la campaña de campo más registros sintéticos para los casos límite.
- **Ningún dato personal real.**

## REG — Registro y validación geográfica
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| REG-01 | Pin dentro del polígono | Correo válido, pin en una calle de la Gran Valencia | Se crea la cuenta asociada al sector (hexágono H3) del pin | A |
| REG-02 | Pin fuera del polígono | Pin en un municipio vecino (Guacara) o en otra ciudad | Se rechaza con un mensaje claro y no se crea la cuenta | A |
| REG-03 | Pin sobre el borde | Pin exactamente en el límite | La regla se aplica de forma consistente (siempre igual) | M |
| REG-04 | Correo ya existente | Correo registrado | Aviso de cuenta existente, sin duplicar | A |
| REG-05 | Campos vacíos | Sin correo, contraseña o pin | No se envía y se marca cada campo faltante | M |
| REG-06 | Permiso de ubicación denegado | Se rechaza la geolocalización | El pin se puede colocar a mano, sin bloqueo | M |
| REG-07 | Login y logout | Credenciales correctas e incorrectas | Accede, o error **sin revelar qué campo falló** | A |

## REP — Ciclo de reportes
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| REP-01 | Inicio de un corte de luz | Autenticado, sin reportes abiertos | Se guarda con hora, sector y tipo correctos | A |
| REP-02 | Inicio de un corte de agua | Tipo: agua | Tipo "agua", sin mezclarse con luz | A |
| REP-03 | Cierre (regreso del servicio) | Hay un reporte abierto | Se cierra, se calcula la duración y pasa al historial | A |
| REP-04 | Cierre sin inicio | No hay reportes abiertos | Se bloquea o queda como aviso sin duración (por decidir) | M |
| REP-05 | Duplicado del mismo usuario | Corte de agua ya abierto y abre otro de agua | Se impide e indica que ya existe uno abierto | A |
| REP-06 | Agua y luz a la vez | Abre uno de agua y otro de luz | Ambos coexisten | M |
| REP-07 | Fin anterior al inicio | Hora manipulada | Se rechaza o se corrige; nunca duración negativa | M |

## CON — Consenso estructural
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| CON-01 | N − 1 | 2 usuarios del mismo sector reportan luz | Sin cambio (puede mostrar "sin confirmar") | A |
| CON-02 | N | 3 usuarios distintos dentro de la ventana | El sector pasa a "sin electricidad" | A |
| CON-03 | N + 1 | 4 usuarios | Sigue igual, sin eventos duplicados | M |
| CON-04 | Mismo usuario ×3 | 1 usuario envía 3 reportes | Cuenta como 1 y no cambia el estado | A |
| CON-05 | Sectores distintos | 3 usuarios de 3 sectores | Ningún sector cambia | A |
| CON-06 | Restablecimiento | Sector "sin agua" y 3 reportan regreso | Vuelve a "con servicio" y se cierra el evento | A |
| CON-07 | Fuera de la ventana | 3 reportes más separados que la ventana | No hay consenso; los antiguos no suman | M |

## OFF — Sin conexión
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| OFF-01 | Reporte en modo avión | Reporta un corte de luz | Va a la cola local con estado "pendiente de envío" | A |
| OFF-02 | Sincronizar al volver la red | Pendiente en cola, vuelve la red | Se envía solo y sale de la cola | A |
| OFF-03 | Hora real del evento | Creado a las 10:30, enviado a las 12:00 | El servidor guarda 10:30 | A |
| OFF-04 | Varios en cola | Inicio y cierre offline | Se sincronizan en orden y el ciclo queda completo | M |
| OFF-05 | Reintento sin duplicado | La red cae a mitad del envío | Queda guardado una sola vez | A |
| OFF-06 | Cerrar con cola pendiente | Cerrar y reabrir la app | La cola persiste y se sincroniza | A |
| OFF-07 | Consultar sin red | Abrir sin red | Muestra la última info con el aviso "datos no actualizados" | M |

## EST — Estimación estadística
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| EST-01 | Cantidad impar | 2, 4, 5, 6, 7 h | 5 h | A |
| EST-02 | Cantidad par | 2, 4, 6, 8 h | 5 h | A |
| EST-03 | Valor atípico | 4, 5, 5, 6, 30 h | 5 h | M |
| EST-04 | Sin historial | 0 ciclos cerrados | "Datos insuficientes" | A |
| EST-05 | Separación por servicio | Historial de agua y de luz | Una mediana por servicio, sin mezclarse | A |
| EST-06 | Nuevo ciclo | Se cierra un corte | La mediana se recalcula | M |

> El umbral n_min = 5 (ver CLAUDE.md) choca con EST-01/02/03, que usan 4–5 datos. Los tests de la función de mediana pura deben probar el cálculo sin umbral, y aparte se prueba la regla de "datos insuficientes".

## VIS — Visualización
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| VIS-01 | Mapa de calor | 2 sectores confirmados | Solo esos 2 aparecen resaltados | A |
| VIS-02 | Filtro por servicio | Cortes de agua y de luz, filtro "agua" | Solo los sectores sin agua | A |
| VIS-03 | Tiempo real | 2 dispositivos; en uno se llega al consenso | El otro se actualiza sin recargar | M |
| VIS-04 | Panel del sector | Abrir el detalle | Estado, estimación y cortes recientes | M |
| VIS-05 | Pantalla pequeña | Teléfono de 5–6" | Sin desbordes ni elementos superpuestos | B |

## NOT — Notificaciones (T-072, D-042)
Casos nuevos, añadidos después del plan original. Los de la API están en `apps/api/test/notificaciones.e2e-spec.ts` y `src/notificaciones/*.spec.ts`, y los de la web, en Vitest (`apps/web/src`).

| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| NOT-01 | Aviso de corte confirmado | 3 vecinos confirman; en el sector hay otro suscrito, uno sin suscribir y otro de otro sector | Solo los suscritos del sector reciben «Se fue la luz en {sector}» con su n; quien confirmó lee «Tu reporte y el de 2 vecinos más»; se dice cuántos sectores vecinos están igual | A |
| NOT-02 | N + 1 | 4.º reporte tras el consenso | Ningún aviso duplicado | A |
| NOT-03 | Restablecimiento | 3 vecinos cierran / todos los reportes vencen | «¡Volvió la luz!» con la duración; el ciclo incompleto no avisa | A |
| NOT-04 | Horas silenciosas | Corte confirmado a las 23:10 | Sale a las 07:00 si sigue vigente; a las 21:59 todavía suena | A |
| NOT-05 | Agua de noche | «Llegó el agua» a las 23:30; un vecino lo pidió y otro no | Solo le suena al que lo pidió («Perdón la hora…»); al otro, a las 07:00 | M |
| NOT-06 | Recordatorio a quien no entró | A las 19:00, un vecino no abrió la app hoy y en su sector hubo cortes | Recibe «Hoy en {sector}»; quien entró no recibe nada | A |
| NOT-07 | Nada que contar | Sin cortes, reportes abiertos ni preguntas | No se envía ningún recordatorio | A |
| NOT-08 | Tope diario | Segunda pasada de la franja y una pregunta el mismo día | A lo sumo uno por día (`RECORDATORIOS_HORAS`) | A |
| NOT-09 | Pausa | 3 recordatorios seguidos sin abrir | Uno por semana hasta que abra alguno | M |
| NOT-10 | ¿Ya volvió? | Reporte abierto más que la mediana del sector (o 12 h sin estimación) | Se pregunta una sola vez por reporte | M |
| NOT-11 | Pregunta neutral | Primer reporte sin confirmar del sector | «¿Y la luz por tu casa?» a quien no reportó, con dos botones simétricos; se descarta si el corte ya se confirmó | M |
| NOT-12 | Redacción | Cualquier notificación | Voz B; «aprox.» con su n; sin cifra con datos insuficientes; nunca «predicción» | A |
| NOT-13 | Anti-SSRF | Suscripción con una URL que no es de un servicio push | 400 y no se guarda | A |
| NOT-14 | Suscripción caducada | El servicio push responde 410 | Se borra la suscripción | M |
| NOT-15 | Privacidad | Cualquier mensaje o imagen | Sin coordenadas: solo el nombre del sector y hexágonos | A |
| NOT-16 | Apertura | Abrir la app desde la notificación (`?n=`) | Se anota `abierta_en`, solo si la notificación es propia | B |
| NOT-17 | Corte ya terminado | Se confirma y se restablece antes de enviar | Solo sale «volvió» (la misma tarjeta) | M |
| NOT-18 | Permiso en el momento justo | Abrir la app; guardar un reporte; «Ahora no» | Nunca al abrir; se ofrece tras reportar; tras «Ahora no», una semana; sin claves en el servidor no se pide | A |
| NOT-19 | Alta y baja del dispositivo | Activar, desactivar, cerrar sesión, otra cuenta en el mismo teléfono | Se da de alta y de baja; al cerrar sesión se borra; el teléfono pasa a la cuenta nueva | A |
| NOT-20 | iPhone sin instalar | Safari iOS sin la app en la pantalla de inicio | Explica que hay que instalarla para recibirlas | M |
| NOT-21 | Service worker | Llega un push | Una tarjeta por corte (`tag`), vibración por servicio, imagen y botones; un push ilegible muestra un aviso genérico | A |
| NOT-22 | Clic | Tocar / «Se fue» / «Aquí sí hay» | Abre su ruta de la app; «Se fue» deja listo el aviso sin enviarlo; «Aquí sí hay» solo cierra | A |
| NOT-23 | Aviso dentro de la app | Cambia el estado confirmado del sector con la app abierta | Banner; los reportes sin confirmar no interrumpen | M |
| NOT-24 | Preferencias | Apagar los recordatorios / activar el agua de noche | Sin recordatorios ni preguntas; los avisos de corte siguen | M |

## No funcionales
| ID | Atributo | Criterio |
|---|---|---|
| NF-01 | Red lenta | Con "3G lenta", usable en ≤ 8 s |
| NF-02 | Caché | Segunda apertura en ≤ 3 s |
| NF-03 | PWA | Pasa Lighthouse PWA y funciona sin instalar |
| NF-04 | Intermitencia | 10 min alternando la red: 0 pérdidas, 0 duplicados |
| NF-05 | Compatibilidad | Los casos A pasan en Chrome Android, Firefox y Safari iOS |
| NF-06 | Privacidad | Otro usuario no puede leer coordenadas exactas, solo agregados. Lo garantiza la API de Nest (nunca devuelve coordenadas) + RLS en deny-all en Supabase |
| NF-07 | Sin admin | Todo funciona con cuentas de residente |
| NF-08 | Usabilidad | SUS ≥ 68 |

## Aceptación (8–10 residentes, sin instrucciones paso a paso)
| ID | Tarea | Éxito |
|---|---|---|
| ACE-01 | Registrarse marcando su vivienda | ≥ 80 % sin ayuda |
| ACE-02 | Reportar que se fue la luz | ≥ 90 % en < 1 min |
| ACE-03 | Reportar el regreso | ≥ 90 % sin ayuda |
| ACE-04 | Ver qué sectores están sin agua | ≥ 80 % usa bien el filtro |
| ACE-05 | Leer la estimación de regreso de la luz | ≥ 80 % la encuentra e interpreta |
| ACE-06 | Reportar en modo avión y luego volver | ≥ 80 % entiende "pendiente → enviado" |

## Criterios de salida
- 100 % de los casos A aprobados y ≥ 90 % del total.
- 0 defectos críticos o altos abiertos.
- Cobertura ≥ 70 % en consenso y estimación.
- SUS ≥ 68.

## Severidad de los defectos
- **Crítica:** pérdida de datos o una función esencial inutilizable. Se atiende de inmediato y se suspenden las pruebas del módulo.
- **Alta:** resultado incorrecto en una función esencial (p. ej., el sector cambia con 1 solo reporte). Se corrige en la semana.
- **Media:** se corrige antes de la aceptación.
- **Baja:** se corrige si hay tiempo.

Ciclo de un defecto: Abierto → En corrección → Corregido → Verificado → Cerrado.

Después de corregir un defecto crítico o alto, se repite todo el módulo afectado y los casos A de los demás módulos (regresión).

## Cronograma de pruebas
- **Semanas 2–9:** tests unitarios junto al código.
- **Semana 10:** entorno de pruebas e integración.
- **Semana 11:** casos funcionales.
- **Semana 12:** no funcionales y regresión.
- **Semana 13:** aceptación e informe final.
