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

---

## Pendientes declarados (para la entrega final 09/11)

- Objetivos de la letra aún no cubiertos: **RT-03** (inyección/SSTI en exportadores), **RT-07**
  (log injection), **RT-11** (OSINT/gitleaks sobre el repo), **RT-12** (DoS del exportador).
- **RT-04** (XSS persistente) revisado estáticamente; falta fuzzing activo.
- Entregables de forma: plantilla oficial `informe-red-team.md`, presentación ejecutiva (10 min),
  registro de incidentes en plantilla `04`/`10`.
- **Limpieza de laboratorio** pendiente (supervisada): datos de prueba de RT05 y de los PoC.
