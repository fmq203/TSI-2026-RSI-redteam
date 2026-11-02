# Gestión de Incidentes — Registro del Red Team (plantilla ISACA/COBIT `04`)

> Entregable #4 (letra 7.4 / 8.3: "cada hallazgo → plantilla `04`/`10`"). Consolida las campañas de
> explotación del Red Team sobre `sistema-rsi` (grupo DieAndres) como **incidentes simulados** que el
> proceso de detección/respuesta del Blue Team debería haber registrado. Formato de
> `plantilla/isaca/04-gestion-incidentes.md`. Vulnerabilidades subyacentes en
> [isaca-10-vulnerabilidades-redteam.md](isaca-10-vulnerabilidades-redteam.md).

---

## Encabezado de mapeo normativo

| Marco | Ítem | Detalle / aporte |
|---|---|---|
| **MCU 5.0 (función)** | **Detectar** + **Responder** + **Recuperar** | Los ataques evalúan la eficacia de DE/RS/RC. |
| **MCU 5.0 (categorías)** | DE-01 a DE-03, RS-01 a RS-05 | Registro, análisis y respuesta. |
| **COBIT 2019** | DSS02, DSS04, APO12 | Operación de incidentes. |
| **ISO/IEC 27001:2022** | A.5.24–A.5.28 | Planificación y respuesta a incidentes. |
| **ISO/IEC 27035** | Todo el estándar | Marco de gestión de incidentes. |
| **BCU — GSI** | Notificación de incidentes relevantes | Escalamiento. |
| **URCDP — Ley 18.331** | Art. 20 (notificación de violaciones) | INC-2026-003 afecta datos personales. |

---

## Control del documento

| Campo | Valor |
|---|---|
| Código | SI-INC-04 (registro Red Team) |
| Versión | 1.0 |
| Responsable | Felipe M. Queirolo (FMQ) — Red Team |
| Fecha | 02/11/2026 |

### Historial de versiones

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 02/11/2026 | FMQ | Consolidación de las campañas Red Team como incidentes simulados. |

---

## 1. Definiciones y banda de severidad

- **Evento**: ocurrencia observable (p. ej., una petición 200 fuera de alcance).
- **Incidente**: evento que compromete C-I-A o viola la política.
- Mapeo de severidad desde CVSS del hallazgo subyacente:

| Severidad | Criterio | CVSS | Ejemplo de esta evaluación |
|---|---|---|---|
| S0 | Impacto catastrófico / fuga masiva | 9.0–10.0 | — |
| S1 | Compromiso de componente central / datos sensibles | 7.0–8.9 | Acceso cross-org a datos personales (INC-003) |
| S2 | Intrusión / abuso de privilegios demostrable | 4.0–6.9 | Alteración de datos ajenos (INC-001), backdoor MFA (INC-002) |
| S3 | Sospecha menor / reconocimiento | 0.1–3.9 | Enumeración, replay, DoS acotado |

> **Nota de detección.** En todos los incidentes el **medio de detección fue el propio Red Team**:
> no se observó alerta de SIEM/HIDS ni respuesta automática del sistema (función **Detectar**
> inefectiva; el SIEM Wazuh está declarado como no implementado por el Blue Team).

## 2. Registro de incidentes

| ID | Fecha (UTC) | Descripción | Severidad | Vector | Activo | Estado | Responsable |
|---|---|---|---|---|---|---|---|
| INC-2026-001 | 2026-10-19 | `DUENO_UNIDAD` lee/altera unidades, procesos, RACI, hitos y procesos huérfanos fuera de su alcance | S2 | Web/API | Organizaciones/unidades (V01, V03, V06, V08) | Contenido (revertido) | FMQ |
| INC-2026-002 | 2026-10-19 | Mass assignment en `PATCH /auth/usuarios/:id`: se planta semilla TOTP y hash → backdoor de cuenta | S2 | Web/API (sesión admin) | Cuentas de usuario (V04) | Contenido (restaurado) | FMQ |
| INC-2026-003 | 2026-10-21 | Rol `RSI` accede a datos personales URCDP de otra organización + KPIs sin segmentar | S1 | Web/API | Datos personales / KPIs (V02) | Contenido (revertido) | FMQ/RR |
| INC-2026-004 | 2026-10-21 | Enumeración de usuarios (timing) y de organizaciones (`GET /organizaciones`) | S3 | Web/API | Login / listado de inquilinos (V07, V11) | Cerrado | FMQ |
| INC-2026-005 | 2026-10-21 | Replay de un código TOTP válido en dos sesiones | S3 | Web/API | Autenticación MFA (V10) | Cerrado | FMQ |
| INC-2026-006 | 2026-10-28 | Markdown/HTML injection en documento exportado (beacon/phishing en SoA/política) | S2 | Documento exportado | Exportadores (V05) | Contenido (dato de prueba eliminado) | FMQ |
| INC-2026-007 | 2026-10-28 | DoS acotado del exportador: 10 requests concurrentes → ~10× latencia | S3 | Web/API | Exportadores (V12) | Cerrado (acotado a propósito) | FMQ |

> **Vectores evaluados sin incidente** (controles efectivos / no explotables): XSS persistente
> (INC no aplica — payload inerte, 2026-11-02), SQLi/SSTI, CSV injection, log injection, secuestro
> de sesión (cookies `__Host-` correctas). Ver falsos positivos en
> [isaca-10-vulnerabilidades-redteam.md](isaca-10-vulnerabilidades-redteam.md) §5.

## 3. Procedimiento de respuesta aplicado (óptica Red Team)

Como equipo atacante, por cada incidente simulado se siguió el ciclo D→C→E→R→L **del lado del
laboratorio**, para no dejar residuos:

1. **Detección**: el Red Team ejecuta el PoC y confirma el impacto (no hubo detección del Blue Team).
2. **Registro**: entrada en la [bitácora](08-bitacora-red-team.md) con hora UTC, fase y resultado.
3. **Contención**: se operó solo sobre datos sintéticos, en red aislada, sin sostener cargas (DoS).
4. **Erradicación/Reversión**: se revirtió cada cambio de prueba (ediciones, registros, backdoor MFA).
5. **Recuperación**: verificación de que la base vuelve al estado original (p. ej. inventario de
   activos restaurado tras RT-12; política/procedimiento `[RT04]` eliminados).
6. **Lecciones aprendidas**: §5.

## 4. Notificación y escalamiento

| Escenario | Notificar a | Plazo | Plantilla |
|---|---|---|---|
| **INC-2026-003** — datos personales de otra org (URCDP) | URCDP (Ley 18.331, Art. 20) | Según plazo legal | `docs/12-Notificacion-Incidentes.md` del Blue Team |
| Incidente relevante de la plataforma (BCU/GSI) | BCU | Según GSI | `docs/12-Notificacion-Incidentes.md` del Blue Team |
| Hallazgos del ejercicio | Dirección de cátedra / RSI (Blue Team) | Entrega 09/11/2026 | Este registro + [informe-red-team.md](informe-red-team.md) |

> **INC-2026-003 es el de mayor relevancia regulatoria**: en un despliegue real multi-organización
> habilitaría una violación de datos personales notificable a la URCDP.

## 5. Lecciones aprendidas

| Campo | Valor |
|---|---|
| **Qué ocurrió** | Un atacante autenticado de rol bajo alcanza confidencialidad e integridad sobre datos de otras unidades/organizaciones, puede instalar un backdoor de MFA y operar sin ser detectado. |
| **Por qué ocurrió** | Causa raíz única de autorización: `UnitScopeGuard` por substring del path + exención de `RSI`/`ADMINISTRADOR`; falta de `ValidationPipe` global; ausencia de logging/alerta de accesos. |
| **Qué funcionó** | Solo-lectura del `LECTOR`, no auto-escalada de rol, control CSRF/Origin, cookies `__Host-`, cifrado de semillas TOTP, sin SQLi/XSS. El guard sí bloquea cuando el id viaja correctamente por ruta/body. |
| **Qué falló** | Detección (sin alerta ante ninguno de los 7 incidentes); autorización por alcance en creación/IDOR y para el rol RSI; integridad de cuentas (mass assignment). |
| **Acciones de mejora** | (1) Reescribir el guard para resolver el recurso real y aplicarlo a todos los roles; (2) `ValidationPipe` global + DTO; (3) cablear logging de accesos sobre `AuditEvent` y alertar cross-tenant; (4) anti-replay TOTP; (5) segregación de funciones en aprobación de riesgos; (6) escapar `[]()` en exportadores. |
| **Responsable y fecha** | Red Team (FMQ/RR), 02/11/2026. Remediación: Blue Team. |

---

## Check de aceptación

- [x] Definiciones de severidad y clasificación (mapeo CVSS→S0-S3).
- [x] Procedimiento de respuesta completo (D→C→E→R→L).
- [x] Registro de incidentes con los hallazgos del Red Team (INC-2026-001…007).
- [x] Procedimiento de notificación a BCU/URCDP (INC-2026-003 → URCDP).
