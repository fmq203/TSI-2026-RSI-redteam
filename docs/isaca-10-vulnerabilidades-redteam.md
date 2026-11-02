# Gestión de Vulnerabilidades — Registro del Red Team (plantilla ISACA/COBIT `10`)

> Entregable #4 (letra 7.4 / 8.3: "cada hallazgo → plantilla `04`/`10`"). Registro de las
> vulnerabilidades confirmadas por el Red Team sobre `sistema-rsi` (grupo DieAndres), en el formato
> de `plantilla/isaca/10-gestion-vulnerabilidades.md`. Detalle técnico y PoC en
> [informe-red-team.md](informe-red-team.md); vectores CVSS en [07-inventario-cvss.md](07-inventario-cvss.md).

---

## Encabezado de mapeo normativo

| Marco | Ítem | Detalle / aporte |
|---|---|---|
| **MCU 5.0 (función)** | **Identificar** + **Proteger** | Gestión de vulnerabilidades y remediación. |
| **MCU 5.0 (categorías)** | ID-03 Vulnerabilidades, PR-01 | Detección/remediación de vulnerabilidades. |
| **COBIT 2019** | APO12, DSS05 | Proceso de gestión de vulnerabilidades y parches. |
| **ISO/IEC 27001:2022** | A.8.8 Gestión de vulnerabilidades técnicas | Pruebas, priorización, parcheo. |
| **ISO/IEC 27002** | 8.8 | Guía de gestión de vulnerabilidades. |
| **BCU — GSI** | Gestión de vulnerabilidades/parches | Gestionar vulnerabilidades críticas. |
| **URCDP — Ley 18.331, Art. 9** | Seguridad de datos personales | V03 afecta datos personales (URCDP). |
| **OWASP / MITRE ATT&CK** | Pruebas de seguridad | Marco técnico de pruebas y técnicas. |

---

## Control del documento

| Campo | Valor |
|---|---|
| Código | SI-VUL-10 (registro Red Team) |
| Versión | 1.0 |
| Responsable | Felipe M. Queirolo (FMQ) — Red Team; Renzo Rampoldi (RR) |
| Fecha | 02/11/2026 |

---

## 1. Herramientas utilizadas (Red Team)

| Herramienta | Rol | Alcance |
|---|---|---|
| `curl` / `jq` | Pruebas de API, PoC de autorización/IDOR, timing | Backend REST |
| Firefox DevTools | Verificación de render (XSS), inspección de DOM/CSP | Frontend |
| `oathtool` / script TOTP | Generación/replay de códigos TOTP | Autenticación |
| `gitleaks` + `grep` | OSINT de secretos sobre el historial git (RT-11) | Código |
| Revisión manual (SAST) | Lectura de guards, DTOs, exportadores | Código |
| Docker Compose / Proxmox | Despliegue del objetivo en laboratorio aislado | Infraestructura |

> No se usó OpenVAS/Nmap masivo: el objetivo es una app web conocida en caja de cristal; la
> superficie relevante son autorización, autenticación y exportadores, evaluados por PoC dirigido.

## 2. Registro de vulnerabilidades

| ID | CVSS v3.1 | Activo / endpoint | Herramienta | Descripción | Estado | Fecha detect | Fecha rem | Responsable |
|---|---|---|---|---|---|---|---|---|
| V01 | 8.1 Alta | `/organizaciones/*` | curl | Broken access control: `DUENO_UNIDAD` lee/modifica unidades, procesos, RACI y org ajenas (H1) | Abierta | 2026-10-19 | — | FMQ |
| V02 | 8.1 Alta | módulo URCDP / `GET /kpis/resumen` | curl | Rol `RSI` sin alcance → datos personales de otra org + KPIs sin segmentar (H2d/RT05) | Abierta | 2026-10-21 | — | FMQ/RR |
| V03 | 7.1 Alta | `PATCH`/`DELETE /cumplimiento/hitos/:id` | curl | IDOR cross-organización en hitos de plan (H2c) | Abierta | 2026-10-21 | — | FMQ |
| V04 | 6.0 Media | `PATCH /auth/usuarios/:id` | curl + DB | Mass assignment → backdoor de MFA/contraseña (H3) | Abierta | 2026-10-19 | — | FMQ |
| V05 | 5.4 Media | exportadores (SoA/política/MCU…) | curl | Markdown/HTML injection: links/imágenes sin escapar (RT03-MD) | Abierta | 2026-10-28 | — | FMQ |
| V06 | 5.4 Media | `POST /seguridad/riesgos`,`/incidentes` | curl | IDOR por `activoId` sobre activo de otra unidad (H2/H2b) | Abierta | 2026-10-19 | — | FMQ |
| V07 | 4.3 Media | `GET /organizaciones` | curl | Enumeración cross-organización de inquilinos (H9) | Abierta | 2026-10-21 | — | FMQ |
| V08 | 4.3 Media | `POST /organizaciones/procesos` | curl | Creación de procesos sin alcance (H10) | Abierta | 2026-10-21 | — | FMQ |
| V09 | 4.3 Media | aprobación/aceptación de riesgos | curl | Falta de segregación de funciones: auto-aprobación (H11) | Abierta | 2026-10-21 | — | FMQ |
| V10 | 4.2 Media | `/auth/login` (TOTP) | oathtool | Replay de código TOTP dentro de la ventana (H4b) | Abierta | 2026-10-21 | — | FMQ |
| V11 | 3.7 Baja | `/auth/login` | curl (timing) | Enumeración de usuarios por discrepancia de tiempo (H4) | Abierta | 2026-10-21 | — | FMQ |
| V12 | 3.5 Baja | exportadores (sin paginación) | curl | Consumo de recursos no controlado / DoS acotado (RT12-DoS) | Abierta | 2026-10-28 | — | FMQ |

> **Estado "Abierta":** las vulnerabilidades se reportan al Blue Team; la remediación y el cierre
> (fecha rem / responsable de corrección) corresponden a su ciclo. Ninguna fue mitigada durante la
> evaluación. **Causa raíz dominante** de V01/V02/V03/V06/V08/V09: `UnitScopeGuard` (alcance por
> substring del path + exención de `RSI`/`ADMINISTRADOR`).

## 3. Priorización de remediación (SLA sugerido)

| Gravedad | CVSS | SLA de remediación | Vulnerabilidades |
|---|---|---|---|
| Crítica | 9.0–10.0 | 72 h | — |
| Alta | 7.0–8.9 | 7 días | V01, V02, V03 |
| Media | 4.0–6.9 | 30 días | V04, V05, V06, V07, V08, V09, V10 |
| Baja | 0.1–3.9 | 90 días | V11, V12 |

> **Observación crítica para la entrega:** el *check de aceptación* de la plantilla exige que, al
> entregar al Red Team, **no haya vulnerabilidades altas abiertas sin mitigación**. Se identificaron
> **3 altas (V01–V03)**; ese criterio **no se cumple**.

## 4. Ventana de parcheo

- Propuesta: remediar primero la causa raíz (reescritura de `UnitScopeGuard` + `ValidationPipe`
  global), que cierra V01–V04, V06, V08 y V09 de forma conjunta.
- Aplicar en entorno de prueba, re-ejecutar los PoC del Red Team como regresión, y recién promover.
- Revisión mensual de tendencias y re-test tras cada corrección.

## 5. Tratamiento de falsos positivos / vectores descartados

| ID | Hallazgo | Justificación | Aprobado por | Fecha |
|---|---|---|---|---|
| FP01 | 5 "secretos" de gitleaks (RT-11) | Secreto TOTP de prueba (RFC 6238), ejemplos de doc y texto que menciona "secretos"; sin credenciales reales | FMQ | 2026-10-28 |
| FP02 | SQL injection (RT-03) | Prisma parametriza; sin `$queryRaw`/`$executeRaw` con interpolación | FMQ | 2026-10-28 |
| FP03 | SSTI/RCE en exportadores (RT-03) | Sin motor de plantillas; concatenación de strings controlada | FMQ | 2026-10-28 |
| FP04 | XSS persistente (RT-04) | Backend guarda verbatim pero React escapa todo + CSP `script-src 'self'`; probado con fuzzing activo (payload inerte) | FMQ | 2026-11-02 |
| FP05 | CSV injection | Escape RFC 4180 + salida JSON; sin fórmula ejecutable | FMQ | 2026-10-21 |
| FP06 | Log injection (RT-07) | nginx no decodifica antes de loguear `$request`; sin sink de logging de aplicación | FMQ | 2026-10-28 |

---

## Check de aceptación

- [x] Registro con CVSS y SLA. **12 vulnerabilidades** registradas (V01–V12).
- [x] Evidencia de remediación o justificación de riesgo aceptado → PoC por hallazgo en `docs/evidencia/`.
- [x] SAST incorporado al ciclo (revisión manual de código + gitleaks).
- [ ] **Al inicio de la entrega a Red Team: sin vulnerabilidades críticas/altas abiertas sin mitigación → NO se cumple (V01–V03 altas abiertas).**
