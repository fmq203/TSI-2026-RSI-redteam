# Informe de Evaluación Red Team — sistema-rsi

> Informe de la Parte 2 (Red Team) de la Tarea 2, materia **Seguridad de la Información (TSI 2026)**.
> Objetivo evaluado: **`sistema-rsi`** (grupo Blue Team **DieAndres**) — sistema de gestión para el
> Responsable de Seguridad de la Información (RSI). Estructura según `plantilla/informe-red-team.md`.

---

## Encabezado de mapeo normativo

| Marco | Ítem | Detalle / aporte |
|---|---|---|
| **MCU 5.0** | **Detectar** (DE-03) / **Responder** (RS-01) | El informe evidencia la eficacia real de los controles de detección/respuesta: no se observó alerta ni bloqueo ante la explotación (el modelo `AuditEvent` existe pero no hay sink de logging de aplicación cableado). |
| **BCU — GSI** | Evaluación de controles / gestión de incidentes | Insumo para la gestión de incidentes del Blue Team y la mejora de madurez. |
| **ISO/IEC 27001:2022** | A.5.15 (control de acceso), A.5.18 (derechos de acceso), A.8.3 (restricción de acceso a la información), A.8.5 (autenticación segura), A.5.24–A.5.28 (gestión de incidentes) | La mayoría de los hallazgos son fallas de control de acceso / autorización. |
| **ISO/IEC 27005 / 31000** | Riesgo | Hallazgos priorizados por CVSS v3.1 y riesgo de negocio. |
| **COBIT 2019** | MEA02 (evaluación del sistema de control interno) | Evaluación independiente de la eficacia de los controles declarados. |
| **URCDP — Ley 18.331** | Medidas de seguridad sobre datos personales | H2d demuestra acceso cross-organización a datos personales del módulo URCDP. |

---

## Control del documento

| Campo | Valor |
|---|---|
| Título | Informe de evaluación técnica — Red Team |
| Código | `RT-T2-2026` |
| Cliente/cátedra | Seguridad de la Información (TSI 2026) |
| Objetivo evaluado | `sistema-rsi` — grupo Blue Team DieAndres |
| Periodo de evaluación | 14/10/2026 → 09/11/2026 |
| Equipo Red Team | Felipe M. Queirolo (FMQ), Renzo Rampoldi (RR) |
| Sistemas evaluados | Backend NestJS + Prisma/PostgreSQL, frontend React tras nginx/TLS |
| Alcance autorizado | VM de laboratorio `rsi-victim` (10.10.10.87:8443) en red aislada `vmbr11`; pruebas desde Kali (10.10.10.0/24) |
| Versión | 1.0 |
| Fecha | 02/11/2026 |

---

## 1. Resumen ejecutivo

**Contexto.** `sistema-rsi` es una aplicación web (SGSI) para el RSI de una organización: modela
organigrama/RACI, activos, riesgos, incidentes, vulnerabilidades, políticas/procedimientos/planes,
exportadores normativos (MCU 5.0, BCU, URCDP, ISO 27001, COBIT), KPIs y autenticación con TOTP.
La evaluación se hizo en modo caja negra inicial y luego caja de cristal (código entregado en GIT),
confirmando cada hallazgo con PoC reproducible contra una instancia propia desplegada en laboratorio.

**Principales hallazgos.**

| Severidad (CVSS v3.1) | Cantidad | Hallazgos |
|---|---|---|
| **Alta (7.0–8.9)** | 3 | H1 (8.1), H2d (8.1), H2c (7.1) |
| **Media (4.0–6.9)** | 7 | H3 (6.0), RT03-MD (5.4), H2/H2b (5.4), H9 (4.3), H10 (4.3), H11 (4.3), H4b (4.2) |
| **Baja (0.1–3.9)** | 2 | H4 (3.7), RT12-DoS (3.5) |
| **Descartados** (revisados, no explotables) | 4 | SQLi/SSTI (RT-03), XSS persistente (RT-04), CSV injection, log injection (RT-07) |

**Postura de seguridad.** La solución presenta una **exposición media-alta concentrada en el
control de acceso/autorización**. La causa raíz de la mayoría de los hallazgos de impacto es única:
el `UnitScopeGuard` resuelve el alcance organizativo **por coincidencia de substring en la ruta** —
no por el tipo/identidad real del recurso— y **solo restringe a los roles `DUENO_UNIDAD` y `LECTOR`**,
dejando a `RSI` y `ADMINISTRADOR` sin acotar. A esto se suma la ausencia de un `ValidationPipe`
global con whitelist (mass assignment, H3). Los controles de autenticación de sesión (cookies
`__Host-`, no escalada de rol, solo-lectura del `LECTOR`) **funcionan correctamente**.

**Madurez MCU 5.0 observada.** Buena cobertura funcional (Gobernar/Identificar) pero **debilidad en
Proteger (control de acceso) y Detectar** (no se evidenció registro/alerta ante los ataques). Varias
afirmaciones de cumplimiento del Blue Team se contradicen con lo observado (ver §7).

## 2. Alcance y reglas de compromiso

- **Objetivos evaluados:** instancia propia de `sistema-rsi` desplegada por el Red Team en la VM
  `rsi-victim` (Docker Compose: PostgreSQL + backend NestJS + nginx/React), con datos 100%
  sintéticos (organización ficticia "Logística del Ceibo" y usuarios de los 4 roles).
- **Técnicas autorizadas:** análisis estático de código, pruebas de autorización/IDOR, enumeración,
  inyección en exportadores, DoS **acotado** (sin sostener la carga), OSINT del repositorio.
- **Vetos respetados:** no se atacó ningún entorno de producción ni de terceros; no se exfiltraron
  datos reales (todo sintético); no se realizó DoS destructivo (RT-12 se acotó deliberadamente a
  10 requests concurrentes); todo cambio de prueba en la base se revirtió o eliminó al finalizar.
- **Entorno:** red de laboratorio aislada `vmbr11`, sin salida pública. Topología y despliegue en
  [01-entorno-despliegue.md](01-entorno-despliegue.md).

### 2.1 Cobertura de objetivos de la letra (7.2)

| ID | Objetivo | Estado | Hallazgo(s) |
|---|---|---|---|
| RT-01 | Romper autenticación | Parcial | H3, H4, H4b |
| RT-02 | Abuso de rol/permisos, IDOR | **Cubierto** (núcleo) | H1, H2/2b/2c/2d, H9, H10, H11 |
| RT-03 | Inyecciones / SSTI en exportadores | Cerrado | SQLi/SSTI descartados; **RT03-MD** confirmado |
| RT-04 | XSS persistente | Cerrado | Descartado con fuzzing activo (React escapa + CSP) |
| RT-05 | Manipular KPIs/dashboard | **Cubierto** | RT05 (KPIs sin segmentar) + H11 |
| RT-06 | Tampering de exportaciones | Parcial | RT03-MD (contenido del documento) |
| RT-07 | Log injection | Cerrado | Descartado — sin sink explotable |
| RT-08 | Secuestro de sesión | **Cubierto** | Control verificado como **correcto** |
| RT-09 | Abuso de API de exportación para enumerar | Parcial | H2d |
| RT-10 | Exposición URCDP por fail-open | **Cubierto** | H2d |
| RT-11 | OSINT del repositorio | Cerrado | Sin secretos reales filtrados |
| RT-12 | DoS acotado del exportador | Cerrado | RT12-DoS (estructural, acotado) |

## 3. Metodología

- **Referencias:** PTES, OWASP Testing Guide / OWASP Top 10 (2021), MITRE ATT&CK (Enterprise),
  NIST SP 800-115. Clasificación primaria de debilidades por **OWASP + CWE**; mapeo complementario
  a ATT&CK para alineación con SOC/Blue Team.
- **Fases ejecutadas:** Planificación → Reconocimiento (revisión de arquitectura y código) →
  Montaje del laboratorio y despliegue del objetivo → Explotación (PoC con cuentas de cada rol) →
  Post-explotación (verificación en base de datos, limpieza) → Reporte.
- **Herramientas (todas open source):** `curl`/`jq`, Firefox DevTools, `oathtool` (TOTP),
  `gitleaks`, `grep`/`semgrep`-style sobre el código, Docker/Proxmox para el laboratorio. No se
  requirió sqlmap (sin SQLi: Prisma parametriza) ni fuzzers de alto volumen.
- **Scoring:** CVSS v3.1 base, con vector explícito por hallazgo (ver §4 e
  [07-inventario-cvss.md](07-inventario-cvss.md)).

## 4. Inventario de hallazgos (resumen)

| ID | Activo / Endpoint | Tipo | Severidad (CVSS) | Estado | Repro | Técnica MITRE |
|---|---|---|---|---|---|---|
| H1 | `/organizaciones/*` (unidades, procesos, RACI, org) | Broken Access Control (A01) | **8.1** Alta | Confirmado | S | T1190 → T1565.001 |
| H2d | Rol `RSI` → URCDP/KPIs de otra org | Broken Access Control / exposición datos personales (A01) | **8.1** Alta | Confirmado | S | T1213 → T1565.001 |
| H2c | `PATCH`/`DELETE /cumplimiento/hitos/:id` | IDOR cross-org (A01) | **7.1** Alta | Confirmado | S | T1190 → T1565.001 |
| H3 | `PATCH /auth/usuarios/:id` | Mass assignment → backdoor MFA/password (A08/A04) | **6.0** Media | Confirmado | S | T1098 + T1556.006 |
| RT03-MD | Exportadores (política/SoA/MCU…) | Markdown/HTML injection (A03) | **5.4** Media | Confirmado | S | T1566 (vector secundario) |
| H2/H2b | `activoId` en crear riesgos/incidentes | IDOR por objeto (A01) | **5.4** Media | Confirmado | S | T1190 → T1565.001 |
| H9 | `GET /organizaciones` | Enumeración cross-org (A01) | **4.3** Media | Confirmado | S | T1087 |
| H10 | `POST /organizaciones/procesos` | Creación sin alcance (A01/A04) | **4.3** Media | Confirmado | S | T1565.001 |
| H11 | Aprobación/aceptación de riesgos | Falta de segregación de funciones (A04/A01) | **4.3** Media | Confirmado | S | T1565.001 |
| H4b | Código TOTP en `/auth/login` | Replay de MFA (A07) | **4.2** Media | Confirmado | S | T1111 (afín) |
| H4 | `/auth/login` (timing) | Enumeración de usuarios (A07) | **3.7** Baja | Confirmado | S | T1087.001 |
| RT12-DoS | Exportadores sin paginación | Consumo de recursos no controlado (A04) | **3.5** Baja | Confirmado (acotado) | S | T1499 |

*Repro: S = reproducible, con PoC y pasos documentados en [05-reproduccion.md](05-reproduccion.md) y evidencia en `docs/evidencia/`.*

**Descartados tras revisión:** SQLi/SSTI (Prisma parametriza; exportadores sin motor de templates),
**XSS persistente (RT-04)** (backend guarda verbatim pero React escapa todo + CSP `script-src 'self'`
— probado con fuzzing activo, ver [evidencia/rt04-xss/](evidencia/rt04-xss/)), CSV injection
(escape RFC 4180 + JSON), log injection (nginx no decodifica antes de loguear; sin sink de
aplicación en el backend).

## 5. Detalle de hallazgos

> Causa raíz común de H1/H2/H2c/H2d/H10/H11: `backend/src/auth/unit-scope.guard.ts` resuelve el
> alcance por **substring del path** y **solo** restringe `DUENO_UNIDAD`/`LECTOR`. PoC y salidas
> completas en `docs/evidencia/`; pasos como usuario común en [05-reproduccion.md](05-reproduccion.md).

### H1 — Control de acceso roto en `/organizaciones/*` (Alta, CVSS 8.1)

| Campo | Contenido |
|---|---|
| **Descripción** | Un `DUENO_UNIDAD` lee y modifica unidades, procesos, RACI y datos de **organizaciones/unidades ajenas**. |
| **Vulnerabilidad** | CWE-284 / CWE-639 — `UnitScopeGuard` no resuelve el recurso real; alcance por substring del path. |
| **Severidad** | `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N` → **8.1**. |
| **Reproducción** | Login `dueno@rsi.local`; `PATCH`/`GET` sobre unidades y organización fuera de su alcance → 200/201. |
| **Impacto** | Lectura y alteración de datos de toda la organización desde una cuenta de rol bajo. |
| **Técnica** | T1190 Exploit Public-Facing Application → T1565.001 Stored Data Manipulation. |
| **Evidencia** | `docs/evidencia/poc-hallazgo-1-organizaciones.txt`. |
| **Recomendación** | Reescribir el guard para resolver el `organizacionId`/`unidadId` real del recurso y aplicarlo a **todos** los roles (ISO 27001 A.5.15/A.8.3). |

### H2d — Rol `RSI` sin alcance → datos personales URCDP / KPIs de otra org (Alta, CVSS 8.1)

| Campo | Contenido |
|---|---|
| **Descripción** | El rol `RSI` lee/edita registros de datos personales (módulo URCDP, Ley 18.331) de **cualquier** organización; los KPIs agregados (`GET /kpis/resumen`, RT05) no se segmentan por organización. |
| **Vulnerabilidad** | CWE-284 / CWE-863 / CWE-200 — el guard exime a `RSI` del control de alcance. |
| **Severidad** | `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N` → **8.1** (condicionado a despliegue multi-organización). |
| **Reproducción** | Login `rsi@rsi.local`; `GET/PUT` sobre bases personales e hitos de otra org → 200. |
| **Impacto** | Exposición y alteración de datos personales de terceros; falseo de métricas de dirección. |
| **Técnica** | T1213 Data from Information Repositories → T1565.001. |
| **Evidencia** | `docs/evidencia/poc-hallazgo-7-rsi-cross-org-urcdp.txt`, `docs/evidencia/rt05-kpis/`. |
| **Recomendación** | Extender el alcance organizativo al rol `RSI` y segmentar el cálculo de KPIs por la identidad autenticada (URCDP: medidas de seguridad sobre datos personales). |

### H2c — IDOR cross-organización en `/cumplimiento/hitos/:id` (Alta, CVSS 7.1)

| Campo | Contenido |
|---|---|
| **Descripción** | `PATCH`/`DELETE` de hitos de planes de otra organización vía el id en la ruta. |
| **Vulnerabilidad** | CWE-639 IDOR. |
| **Severidad** | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N` → **7.1**. |
| **Reproducción** | `PATCH /cumplimiento/hitos/<id-ajeno>` → 200 (crear vía ruta `/planes/` sí da 403). |
| **Impacto** | Modificación/borrado de planes de acción ajenos. |
| **Técnica** | T1190 → T1565.001. |
| **Evidencia** | `docs/evidencia/poc-hallazgo-6-hitos-cross-org.txt`. |
| **Recomendación** | Validar pertenencia del hito a la organización del actor antes de operar. |

### H3 — Mass assignment en `PATCH /auth/usuarios/:id` → backdoor MFA/password (Media, CVSS 6.0)

| Campo | Contenido |
|---|---|
| **Descripción** | Sin `ValidationPipe`/whitelist, un `ADMINISTRADOR` puede escribir campos sensibles no previstos (`mfaSecret`, `mfaConfirmado`, `passwordHash`) en cualquier cuenta. |
| **Vulnerabilidad** | CWE-915 Mass Assignment / CWE-284. |
| **Severidad** | `AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N` → **6.0** (PR:H, pero **impacto de negocio alto**: backdoor de autenticación persistente). |
| **Reproducción** | `PATCH /auth/usuarios/<id>` con `{"mfaConfirmado":true,"mfaSecret":"…"}` → persistido en DB. |
| **Impacto** | Plantar una semilla TOTP conocida o un hash de contraseña sobre cualquier cuenta, incluidos otros admin. |
| **Técnica** | T1098 Account Manipulation + T1556.006 Modify Authentication Process (MFA). |
| **Evidencia** | `docs/evidencia/poc-hallazgo-3-mass-assignment.txt`. |
| **Recomendación** | `ValidationPipe` global con `whitelist:true, forbidNonWhitelisted:true`; DTO explícito; auditar cambios de campos sensibles (ISO A.8.5). |

### RT03-MD — Markdown/HTML injection en exportadores (Media, CVSS 5.4)

| Campo | Contenido |
|---|---|
| **Descripción** | Las funciones de escape de los exportadores neutralizan `&<>` y CRLF pero **no** `[]()`; un `descripcion` con `![x](url)`/`[link](url)` sobrevive al documento exportado (SoA, política, MCU…). |
| **Vulnerabilidad** | CWE-116 Improper Encoding / CWE-79-like (Markdown/HTML injection). |
| **Severidad** | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` → **5.4**. |
| **Reproducción** | Crear política con payload Markdown; exportar; el link/imagen remota queda activo en el documento. |
| **Impacto** | Beacon de exfiltración pasiva (imagen remota) y phishing dentro de un documento normativo oficial → **tampering de exportación (RT-06)**. |
| **Técnica** | T1566 Phishing (el documento exportado como señuelo). |
| **Evidencia** | [10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md). |
| **Recomendación** | Escapar también `[]()` (o renderizar como texto plano/escapado); CSP del visor de documentos. |

### H2 / H2b — IDOR por `activoId` al crear riesgos/incidentes (Media, CVSS 5.4)

| Campo | Contenido |
|---|---|
| **Descripción** | Al crear riesgo/incidente, el `activoId` de otra unidad no se valida contra el alcance; la respuesta además devuelve datos del activo ajeno. |
| **Vulnerabilidad** | CWE-639 IDOR / CWE-285. |
| **Severidad** | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` → **5.4**. |
| **Reproducción** | `POST /seguridad/riesgos` (y `/incidentes`) con `activoId` ajeno → 201. |
| **Impacto** | Contaminación de datos y fuga parcial de información de activos ajenos. |
| **Técnica** | T1190 → T1565.001. |
| **Evidencia** | `docs/evidencia/poc-hallazgo-2-idor-activoid.txt`. |
| **Recomendación** | Resolver la unidad/organización del `activoId` y validar contra el alcance del actor. |

### H9 — Enumeración cross-organización vía `GET /organizaciones` (Media, CVSS 4.3)

| Campo | Contenido |
|---|---|
| **Descripción** | Cualquier usuario autenticado lista todas las organizaciones (inquilinos). |
| **Vulnerabilidad** | CWE-285 / CWE-200. **Severidad** `…/C:L/I:N/A:N` → **4.3**. |
| **Reproducción / Evidencia** | `GET /organizaciones` → listado completo. `docs/evidencia/poc-hallazgo-1-organizaciones.txt`. |
| **Técnica / Recomendación** | T1087 Account/Tenant Discovery. Filtrar por las organizaciones autorizadas del actor. |

### H10 — Creación de procesos sin alcance (Media, CVSS 4.3)

| Campo | Contenido |
|---|---|
| **Descripción** | `POST /organizaciones/procesos` sin `organizacionId` crea procesos huérfanos fuera de control de alcance. |
| **Vulnerabilidad** | CWE-284. **Severidad** `…/C:N/I:L/A:N` → **4.3**. T1565.001. |
| **Recomendación** | Exigir y validar `organizacionId` contra el alcance del actor. |

### H11 — Falta de segregación de funciones al aprobar/aceptar riesgos (Media, CVSS 4.3)

| Campo | Contenido |
|---|---|
| **Descripción** | `DUENO_UNIDAD` crea y **auto-aprueba/acepta** sus propios riesgos (sin segunda persona). |
| **Vulnerabilidad** | CWE-862 Missing Authorization / diseño. **Severidad** `…/C:N/I:L/A:N` → **4.3**. T1565.001. |
| **Recomendación** | Separar roles de creación y aprobación (segregación de funciones, COBIT/ISO). |

### H4b — Replay de código TOTP (Media, CVSS 4.2)

| Campo | Contenido |
|---|---|
| **Descripción** | Un mismo código TOTP válido se acepta en dos sesiones dentro de la ventana (sin anti-replay). |
| **Vulnerabilidad** | CWE-294 Capture-replay. **Severidad** `AV:N/AC:H/PR:L/…` → **4.2**. T1111 (afín). |
| **Evidencia / Recomendación** | `docs/evidencia/poc-hallazgo-4-totp-replay.txt`. Invalidar el código usado (contador/última ventana). |

### H4 — Enumeración de usuarios por timing en login (Baja, CVSS 3.7)

| Campo | Contenido |
|---|---|
| **Descripción** | Diferencia de tiempo de respuesta entre correo existente (~0.5 s, hashea) y no existente (~0.1 s). |
| **Vulnerabilidad** | CWE-204 Observable Response Discrepancy. **Severidad** `AV:N/AC:H/PR:N/…` → **3.7**. T1087.001. |
| **Evidencia / Recomendación** | `docs/evidencia/poc-hallazgo-5-enumeracion-timing.txt`. Igualar tiempos (hash señuelo); rate-limit de nginx ya mitiga. |

### RT12-DoS — Exportadores sin paginación (Baja, CVSS 3.5)

| Campo | Contenido |
|---|---|
| **Descripción** | Los exportadores no usan `take`/`skip`; bajo concurrencia acotada (10 requests) la latencia se multiplica ~10×. |
| **Vulnerabilidad** | CWE-400 / CWE-770. **Severidad** `…/A:L` → **3.5** (acotado a propósito, no se forzó caída). |
| **Evidencia / Recomendación** | [10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md). Paginación/streaming y límites de tasa en los exportadores. |

## 6. Mapeo a MITRE ATT&CK

Tabla OWASP/CWE/ATT&CK por hallazgo, cadena de ataque y capa cargable para ATT&CK Navigator en
[06-mapeo-mitre-attack.md](06-mapeo-mitre-attack.md) y
[attack-navigator-layer.json](attack-navigator-layer.json). Resumen de la cadena: **T1087**
(descubrimiento por timing, H4) → **T1078** (cuenta válida de rol bajo) → **T1087** (enumeración de
inquilinos, H9) → lectura fuera de alcance (H1) → **T1213** (datos URCDP de otra org, H2d) →
**T1565.001** (manipulación de datos almacenados, H1/H2/H2c/H10/H11) → **T1098 + T1556.006**
(backdoor MFA con sesión admin, H3).

## 7. Evaluación de la respuesta del Blue Team

**Detección/respuesta observada.** Durante toda la explotación **no se observó alerta, bloqueo ni
aislamiento**. El modelo de datos incluye `AuditEvent`, pero no hay un sink de logging de aplicación
cableado en `backend/src`, y nginx usa el formato combinado por defecto. En términos MCU, la función
**Detectar** es la más débil: los ataques de autorización no dejan rastro accionable.

**Controles que SÍ funcionan (delimitan que el problema es específico, no general):**

- `ReadOnlyGuard`: un `LECTOR` no puede escribir → 403.
- `RolesGuard`: un `DUENO_UNIDAD` no puede auto-promoverse de rol → 403.
- `UnitScopeGuard` donde está bien cableado (id en ruta/body): bloquea crear activos/procesos/
  políticas/evidencias/procedimientos de otra organización → 403.
- Lectura de detalle fuera de alcance (`GET /seguridad/activos/:id` ajeno) → 403.
- `DELETE` de riesgos/incidentes ajenos (ruta con `:id`) → 403 (solo la **creación** evade el guard).
- Validación de escala de riesgo (probabilidad/impacto 1–5); cookies `__Host-` correctas (RT-08);
  sin SQLi (Prisma); sin XSS persistente (React + CSP).

**Contradicciones con afirmaciones de cumplimiento (insumo para el entregable #5).** El sistema
presenta "mínimo privilegio por rol" y segmentación por organización, pero: el rol `RSI` no tiene
alcance (H2d); el alcance se evade por creación/IDOR (H1/H2/H2c); los KPIs de dirección no se
segmentan (RT05); y no hay trazabilidad efectiva de los cambios no autorizados (Detectar). Estas
brechas deben confrontarse con lo declarado en la `SoA` del Blue Team.

## 8. Lecciones aprendidas y recomendaciones

**Acciones correctivas prioritarias (por riesgo):**

1. **Reescribir `UnitScopeGuard`** para resolver el `organizacionId`/`unidadId` **real del recurso**
   (no por substring del path) y aplicar el alcance a **todos** los roles, incluido `RSI`. Cierra
   H1, H2, H2b, H2c, H2d, H10 y RT05 de raíz. *(ISO A.5.15/A.5.18/A.8.3; MCU Proteger.)*
2. **`ValidationPipe` global** con whitelist + DTO explícitos → cierra H3 (mass assignment) y evita
   futuros. Auditar cambios de `passwordHash`/`mfaSecret`/`mfaConfirmado`. *(ISO A.8.5.)*
3. **Segregación de funciones** en la aprobación de riesgos (H11) y validación de pertenencia en
   hitos (H2c). *(COBIT MEA02; ISO A.5.3.)*
4. **Cablear el logging de aplicación** sobre `AuditEvent` (quién/qué/cuándo) y enviar a SIEM;
   alertar ante escrituras donde `organizacionId` del recurso ≠ del actor. *(MCU Detectar; ISO
   A.8.15/A.8.16.)*
5. **Endurecer autenticación:** anti-replay TOTP (H4b), igualar tiempos de login (H4), rate-limit
   por correo. *(ISO A.8.5.)*
6. **Exportadores:** escapar `[]()` (RT03-MD), paginar/streamear y limitar tasa (RT12-DoS); CSP en
   el visor de documentos. *(A03/A04.)*

**Mejoras de arquitectura/monitoreo:** centralizar la autorización por recurso (policy layer);
pruebas automatizadas de autorización por rol; observabilidad de accesos cross-tenant.

## 9. Anexos

- **Anexo A — Bitácora del Red Team:** [08-bitacora-red-team.md](08-bitacora-red-team.md)
  (entradas diarias firmadas, fases y resultados, incluye los fallos).
- **Anexo B — Evidencias:** índice en `docs/evidencia/` — PoC textual por hallazgo
  (`poc-hallazgo-1..7`), `rt04-xss/` (fuzzing XSS), `rt05-kpis/` (KPIs), capturas en
  `docs/evidencia/capturas/`. Reproducción como usuario común en
  [05-reproduccion.md](05-reproduccion.md); RT-03/07/12 en
  [10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md); OSINT/gitleaks en
  [09-rt11-osint-gitleaks.md](09-rt11-osint-gitleaks.md).
- **Anexo C — Conteo de resultados:** 12 hallazgos confirmados (3 altos, 7 medios, 2 bajos) +
  4 vectores descartados con justificación. Causa raíz dominante: 1 (`UnitScopeGuard`). Objetivos
  de la letra cubiertos/cerrados: 9/12; parciales: 3 (RT-01, RT-06, RT-09). Credenciales del
  laboratorio en [02-credenciales.md](02-credenciales.md); inventario CVSS en
  [07-inventario-cvss.md](07-inventario-cvss.md).
