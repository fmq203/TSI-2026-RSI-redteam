# Bitácora Red Team

**Proyecto:** TSI 2026 — Red Team sobre `sistema-rsi` (equipo DieAndres)
**Ventana activa:** 28/10/2026 → 09/11/2026 (reconocimiento previo desde el 14/10 con el código entregado).
**Reglas:** entorno de laboratorio aislado, datos sintéticos; no se registran contraseñas, cookies, tokens ni secretos. Horas en **UTC**. No se omiten los fallos.

**Integrantes / firmas:**
- **FMQ** — Felipe (fmq203)
- **RR** — Renzo Rampoldi

> Nota: bitácora consolidada a partir del trabajo realizado. Cada entrada indica fase
> (Reconocimiento / Explotación / Post-explotación / Documentación), herramienta y resultado.

---

## 2026-10-14 — Reconocimiento y revisión estática

| Hora (UTC) | Firma | Fase | Acción | Herramienta | Resultado |
|---|---|---|---|---|---|
| 11:10 | FMQ | Recon | Clonado del repositorio objetivo `sistema-rsi` | git | OK (commit base `9810260`). Posteriormente el repo pasó a privado/404; se trabajó con el clon y, más tarde, con acceso de colaborador. |
| 11:30 | FMQ | Recon | Revisión de arquitectura: NestJS + Prisma/Postgres + nginx/TLS; guards globales (`AuthGuard`→`RolesGuard`→`ReadOnlyGuard`→`UnitScopeGuard`) | lectura de código | Se identifica `UnitScopeGuard` como punto central de autorización |
| 12:15 | FMQ | Recon | Análisis de `unit-scope.guard.ts` | lectura de código | Hallazgo preliminar: el guard resuelve alcance por **substring del path** y solo aplica a `DUENO_UNIDAD`/`LECTOR` → base de H1/H2/H2c/H2d |
| 12:40 | FMQ | Recon | Revisión de `auth.service.ts`, `main.ts`, `totp.ts`, `session-http.ts`, nginx | lectura de código | Preliminares: sin `ValidationPipe` global (H3), login corta antes de hashear (H4), `epochTolerance` TOTP sin anti-replay (H4b), cookies `__Host-` correctas |

## 2026-10-19 — Montaje del laboratorio y confirmación inicial

| Hora (UTC) | Firma | Fase | Acción | Herramienta | Resultado |
|---|---|---|---|---|---|
| 12:10 | FMQ | Recon | Despliegue de instancia propia (VM Ubuntu 24.04 + Docker) para pasar a caja de cristal | Proxmox, Docker Compose | VM operativa; demoras por storage lento y por un clon con contenedores ajenos que llenaban el disco (se limpió) |
| 13:20 | FMQ | Recon | Carga de datos demo y usuarios de los 4 roles | prisma migrate/seed, API | Org "Logística del Ceibo", 60 registros; usuarios admin/RSI/dueño/lector |
| 13:35 | FMQ | Explotación | **H1** — `DUENO_UNIDAD` modifica unidad y organización ajenas | curl | **Confirmado** (HTTP 200/201). Revertido |
| 13:45 | FMQ | Explotación | **H2** — crear riesgo/incidente sobre activo de otra unidad | curl | **Confirmado** (201). `DELETE` del mismo sí da 403 → el agujero es la creación |
| 13:55 | FMQ | Explotación | **H3** — mass assignment en `PATCH /auth/usuarios/:id` (`mfaConfirmado`, `mfaSecret`, `passwordHash`) | curl + verificación en DB | **Confirmado**: campos persistidos. Estado restaurado |
| 14:05 | FMQ | Explotación | Controles negativos: `LECTOR` escritura, `DUENO` auto-promoción de rol | curl | 403 correctos (controles que funcionan) |

## 2026-10-21 — Re-verificación, hallazgos nuevos y evidencia

| Hora (UTC) | Firma | Fase | Acción | Herramienta | Resultado |
|---|---|---|---|---|---|
| 13:30 | FMQ | Explotación | Re-verificación integral de H1/H2/H3 + controles | curl (script) | Todo sigue presente |
| 13:50 | FMQ | Explotación | **H4** — enumeración de usuarios por timing | curl (medición) | **Confirmado** (~0.5 s existe vs ~0.1 s no existe); rate-limit nginx mitiga |
| 14:00 | FMQ | Explotación | **H4b** — replay de código TOTP | curl + oathtool | **Confirmado**: mismo código, 2 sesiones |
| 14:20 | FMQ | Explotación | **H2c** — `PATCH`/`DELETE /cumplimiento/hitos/:id` cross-org | curl | **Confirmado** (200); `POST` por ruta `/planes/` sí da 403 |
| 14:40 | FMQ | Explotación | **H2d** — `RSI` lee/edita datos personales URCDP de otra org | curl | **Confirmado** (200 GET/PUT) |
| 15:00 | FMQ | Explotación | **H9** (enum orgs), **H10** (proceso huérfano), **H11** (auto-aprobación de riesgo) | curl | **Confirmados** |
| 15:20 | FMQ | Explotación | Descartes: CSV injection (escape RFC4180 + JSON) y XSS almacenado (sin `dangerouslySetInnerHTML`, CSP estricta) | lectura de código | No explotables con lo revisado |
| 16:30 | FMQ | Documentación | Capturas de evidencia desde Kali como `DUENO_UNIDAD` (H1, H2, H9, H11) | Firefox DevTools, curl | Evidencia en `docs/evidencia/capturas/`. Se registran fallos: body sin `Content-Type` (500), typo de id (400), JSON con `ture`/comillas curvas (400) — corregidos |

## 2026-10-25 / 26 — Aislamiento de KPIs (RT05)

| Hora (UTC) | Firma | Fase | Acción | Herramienta | Resultado |
|---|---|---|---|---|---|
| 25/10 | RR | Explotación | **RT05-P04** — `GET /kpis/resumen` no segmenta por organización | API, Vagrant lab | **Confirmado**: RSI de A ve métricas influidas por un activo de B (5→6 activos, 100 %→83 %) |
| 26/10 | RR | Documentación | Informe RT05 + 7 capturas | — | En `docs/evidencia/rt05-kpis/`. Deja datos de prueba para limpieza supervisada |

## 2026-10-28 — Integración y pre-entrega

| Hora (UTC) | Firma | Fase | Acción | Herramienta | Resultado |
|---|---|---|---|---|---|
| mañana | FMQ | Documentación | Integración de RT05 como manifestación de H2d; actualización de matriz OWASP/CWE/MITRE | — | Commit de integración |
| mañana | FMQ | Documentación | Inventario de hallazgos con CVSS 3.1 y esta bitácora | — | `07-inventario-cvss.md`, `08-bitacora-red-team.md` |
| 13:00 | FMQ | Explotación | **RT-11** — OSINT del repositorio: `gitleaks detect` sobre el historial completo + verificación manual (claves PEM/SSH, AWS keys, JWT, `.env` trackeados) | gitleaks, grep | Sin secretos reales filtrados. 5 hallazgos de gitleaks, los 5 falsos positivos (secreto RFC 6238 de prueba, ejemplos de doc, texto que menciona "secretos"); autocrítica sobre password de ejemplo en nuestro propio `lab/Vagrantfile` |
| 13:15 | FMQ | Explotación | **RT-03** — revisión de SQLi (`$queryRaw`/`$executeRaw`: 0 resultados) y SSTI/RCE (sin motor de templates en exportadores) | lectura de código | Descartados: sin superficie |
| 13:25 | FMQ | Explotación | **RT-03** — PoC de Markdown injection: política con `descripcion` conteniendo `![x](url)`/`[link](url)`, exportada vía `GET .../politica-seguridad` | curl | **Confirmado**: payload sin escapar en el documento exportado. Dato de prueba eliminado tras verificar |
| 13:35 | FMQ | Explotación | **RT-07** — CRLF injection (`%0d%0a`) en query string contra `GET /seguridad/riesgos?estado=...`, inspección de `docker logs` del frontend (nginx) | curl, `cat -A` sobre logs crudos | Descartado: nginx no decodifica antes de loguear `$request` (queda en una sola línea); sin sink de logging de aplicación en el backend |
| 13:45 | FMQ | Explotación | **RT-12** — línea base de timing del export `inventario-activos` (5 activos) | curl timing | ~0.08 s |
| 13:50 | FMQ | Explotación | **RT-12** — alta de 150 activos sintéticos en unidad temporal, re-medición del export (155 activos) | curl, API loop | ~0.13 s; sin explosión cuadrática a esta escala |
| 14:00 | FMQ | Explotación | **RT-12** — 10 exports concurrentes al mismo endpoint (sin sostener la carga) | curl en paralelo | Latencia por request ~10× (0.1 s → ~1 s); confirma contención de recursos sin necesidad de forzar una caída real. **Acotado a propósito**: no se escaló más para no degradar el laboratorio compartido |
| 14:05 | FMQ | Post-explotación | Limpieza de datos de prueba (150 activos RT12, unidad temporal, política RT-03) | curl/API | Inventario vuelto a 5 activos (estado original) |
| 14:15 | FMQ | Documentación | `docs/10-rt03-rt07-rt12.md`, CVSS de RT03-MD y RT12-DoS, actualización de matriz MITRE | — | Commit |

---

## Pendientes declarados (para la entrega final 09/11)

- **RT-04** (XSS persistente) revisado estáticamente; falta fuzzing activo.
- Entregables de forma: plantilla oficial `informe-red-team.md`, presentación ejecutiva (10 min),
  registro de incidentes en plantilla `04`/`10`.
- **Limpieza de laboratorio** pendiente (supervisada): datos de prueba de RT05 (Org B/unidad/
  activo de Renzo) y la unidad accidental "Tecnología RT05" en la Org A. Lo generado hoy (RT12,
  RT03-MD) ya se limpió en el momento.

## Objetivos de la letra (7.2) — estado al cierre de esta bitácora

| ID | Objetivo | Estado |
|---|---|---|
| RT-01 | Romper autenticación | Parcial (H3, H4, H4b) |
| RT-02 | Abuso de rol/permisos, IDOR | Cubierto (núcleo del informe) |
| RT-03 | Inyecciones / SSTI en exportadores | Cerrado hoy — SQLi/SSTI descartados, Markdown injection confirmado |
| RT-04 | XSS persistente | Revisado estáticamente, sin fuzzing activo |
| RT-05 | Manipular KPIs/dashboard | Cubierto (RT05 + H11) |
| RT-06 | Tampering de exportaciones | Parcial |
| RT-07 | Log injection | Cerrado hoy — descartado, sin sink explotable |
| RT-08 | Secuestro de sesión | Cubierto — control verificado como correcto |
| RT-09 | Abuso de API de exportación para enumerar | Parcial (H2d) |
| RT-10 | Exposición URCDP por fail-open | Cubierto (H2d) |
| RT-11 | OSINT del repositorio | Cerrado hoy — sin secretos filtrados |
| RT-12 | DoS acotado del exportador | Cerrado hoy — confirmado estructuralmente, acotado a propósito |
