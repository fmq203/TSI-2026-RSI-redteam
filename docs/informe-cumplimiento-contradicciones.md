# Informe de cumplimiento — afirmaciones del Blue Team contradichas por la evaluación

> Entregable #5 del Red Team (letra 7.4). Confronta lo que el grupo Blue Team (**DieAndres**)
> **declaró** en su documentación de seguridad contra lo **observado** en la evaluación técnica.
> Fuentes de las afirmaciones: `docs/01-Politica-Seguridad.md`, `docs/09-gestion-accesos.md`,
> `docs/07-Monitoreo-Logs.md`, `docs/11-SoA-Plan-Tratamiento.md` del repositorio objetivo.
> Hallazgos: ver [informe-red-team.md](informe-red-team.md) y [07-inventario-cvss.md](07-inventario-cvss.md).

---

## Encabezado de mapeo normativo

| Marco | Ítem | Aporte |
|---|---|---|
| **COBIT 2019** | MEA02 — Evaluación del sistema de control interno | Contraste independiente entre control declarado y control efectivo. |
| **ISO/IEC 27001:2022** | Cláusula 6.1.3 / Anexo A | Verificación de la aplicabilidad real de los controles de la SoA. |
| **MCU 5.0** | Proteger / Detectar | Las brechas se concentran en estas dos funciones. |

**Criterio de veredicto.**

- 🔴 **Contradicha** — la afirmación se presenta como control efectivo y la evaluación la rompe.
- 🟠 **Parcialmente contradicha** — el control existe pero no cubre el caso demostrado.
- 🟡 **Brecha ya declarada** — el Blue Team la reconoce como pendiente/parcial; la evaluación la confirma (no es una contradicción, pero sí un riesgo abierto).
- 🟢 **Sostenida** — la afirmación se verificó como cierta.

> **Nota de justicia.** La documentación del Blue Team es, en general, prudente: marca muchos
> controles como "pendiente" o "parcial" y admite que *"aplicable no significa implementado"*. Este
> informe separa deliberadamente las **contradicciones** (dijeron que algo protege y no protege) de
> las **brechas que ellos mismos ya reconocieron**.

---

## 1. Tabla de contraste

| # | Afirmación declarada (fuente) | Observado en la evaluación | Veredicto |
|---|---|---|---|
| C1 | **"Mínimo privilegio: asignar únicamente los permisos necesarios"** y *"aplicar permisos por rol y ámbito"* (`01-Politica-Seguridad.md` §3/§4; `09-gestion-accesos.md` §2) | Un `DUENO_UNIDAD` lee/modifica unidades, procesos, RACI y organización **fuera de su ámbito** (H1, 8.1); crea riesgos/incidentes sobre activos ajenos (H2/H2b); edita/borra hitos de otra organización (H2c, 7.1); crea procesos huérfanos (H10). El "ámbito" no se aplica en creación ni cuando el id viaja por IDOR. | 🔴 **Contradicha** |
| C2 | El rol **RSI** es *"Gestión de seguridad y cumplimiento, búsqueda y KPI"* con permisos **por rol y ámbito** (`09` §2; `01` §4) | El rol `RSI` **no tiene alcance organizativo alguno**: lee/edita datos personales URCDP (Ley 18.331) de **cualquier** organización (H2d, 8.1) y los KPIs de dirección se calculan sin segmentar por organización (RT05). | 🔴 **Contradicha** |
| C3 | *"Los permisos se comprueban en el backend mediante AuthGuard, RolesGuard, ReadOnlyGuard, **UnitScopeGuard** y filtros de los servicios"* (`09` §2) — presentado como el mecanismo de autorización | `UnitScopeGuard` resuelve el alcance **por substring del path** (no por el recurso real) y **solo** restringe `DUENO_UNIDAD`/`LECTOR`; `RSI`/`ADMINISTRADOR` quedan exentos. El mecanismo existe pero su cobertura es parcial (raíz de C1 y C2). | 🟠 **Parcialmente contradicha** |
| C4 | *"Exigir MFA para Administrador y RSI"* como control de acceso (`01` §4; `09` §1) | Falta `ValidationPipe` global → **mass assignment** (H3): un `ADMINISTRADOR` planta `mfaSecret`/`mfaConfirmado`/`passwordHash` en cualquier cuenta, instalando un **backdoor de MFA/contraseña** sobre cualquier usuario (incluido otro admin), sin el flujo real de enrolamiento. El "exigir MFA" deja de ser una garantía de identidad. | 🔴 **Contradicha** |
| C5 | *"Separación de funciones… revisión de cambios por otra persona"* — declarada **parcial** (`11-SoA` A.5.3) | `DUENO_UNIDAD` **crea y auto-aprueba/acepta** sus propios riesgos sin segunda persona (H11). La "parcialidad" declarada es, en el flujo de aprobación de riesgos, **inexistente**. | 🟠 **Parcialmente contradicha** |
| C6 | **Trazabilidad**: *"asociar los accesos y cambios relevantes a un actor, fecha y resultado verificables"* (`01` §3) y *"cambios de gestión cubiertos por el interceptor de auditoría"* (`07` §) | El interceptor registra **cambios de gestión** (altas/bajas/modificaciones), pero la propia doc admite que *"no se registra automáticamente toda lectura, solicitud fallida o cambio directo en la BD"*. Las **lecturas/enumeraciones cross-org** (H1-GET, H9, H2d-GET) no dejan traza, y durante la explotación **no se generó ninguna alerta ni bloqueo**. | 🟡 **Brecha ya declarada** (confirmada) |
| C7 | SIEM/detección: Wazuh *"se prevé integrar… hasta completar esas pruebas no se considera implementado el SIEM"* (`07` §) | Confirmado: no hay detección/alerta activa. Función **Detectar** del MCU inefectiva ante los ataques de autorización. | 🟡 **Brecha ya declarada** (confirmada) |
| C8 | El alcance de la política protege *"los documentos exportados"* y la **minimización** pide *"evitar datos… en exportaciones"* (`01` §2/§3) | Los exportadores no escapan sintaxis Markdown de links/imágenes (RT03-MD, 5.4): un documento normativo exportado (SoA, política, MCU) puede portar un **beacon de exfiltración** o **phishing** → tampering de exportación (RT-06). | 🟠 **Parcialmente contradicha** |

## 2. Contradicciones principales (detalle)

**C1 — "Mínimo privilegio / permisos por rol y ámbito" (🔴).** Es la afirmación más central de la
política y la que la evaluación contradice de forma más clara y repetida. El principio se enuncia
como regla efectiva, pero el alcance organizativo no se aplica en las operaciones de **creación** ni
cuando un identificador de objeto viaja por el cuerpo/ruta (IDOR). Un usuario de rol bajo
(`DUENO_UNIDAD`) alcanza confidencialidad e integridad sobre datos de toda la organización.

**C2 — Alcance del rol RSI (🔴).** La doc describe al `RSI` como un rol de gestión de seguridad
"por rol y ámbito", pero en el código `UnitScopeGuard` **exime** a `RSI` de todo control de alcance.
En un despliegue multi-organización esto expone **datos personales de terceros** (URCDP/Ley 18.331),
que la propia política dice proteger. Es, además, el caso de mayor sensibilidad regulatoria.

**C4 — "Exigir MFA" vs mass assignment (🔴).** El control de MFA se presenta como garantía de
identidad para las cuentas privilegiadas. El mass assignment (H3) permite **fabricar** el estado de
MFA (semilla conocida + `mfaConfirmado=true`) o plantar un hash de contraseña sobre cualquier cuenta.
El control declarado no solo se evade: se puede **instrumentar** para persistir acceso.

**C6/C7 — Trazabilidad y detección (🟡).** Aquí el Blue Team es honesto: declara que no registra
lecturas ni tiene SIEM implementado. La evaluación lo **confirma** (ninguna alerta ante la
explotación), por lo que no se computa como contradicción sino como **riesgo abierto declarado**.
Debe cerrarse para la función **Detectar** del MCU: cablear logging de accesos y alertar ante
escrituras donde `organizacionId` del recurso ≠ del actor.

## 3. Afirmaciones sostenidas (control verificado como cierto)

En aras de un contraste equilibrado, estos controles declarados **se verificaron como efectivos**:

- 🟢 **CSRF/Origin** — *"las solicitudes que modifican datos requieren un `Origin` autorizado; se
  rechazan ausentes/`null`/ajenos"* (`09` §): confirmado; sesión por cookie `__Host-` (RT-08 OK).
- 🟢 **Solo-lectura del LECTOR** y **no auto-escalada de rol** del `DUENO_UNIDAD`: 403 correctos.
- 🟢 **`UnitScopeGuard` donde está bien cableado** (id en ruta/body, GET de detalle ajeno): 403.
- 🟢 **Cifrado de semillas TOTP** (AES-256-GCM) y clave fuera de la BD: acorde a lo declarado.
- 🟢 **Sin SQLi** (Prisma parametriza) y **sin XSS persistente** (React escapa + CSP) — coherente
  con una defensa de aplicación razonable en esas superficies.

## 4. Conclusión

La brecha entre lo declarado y lo observado se concentra en **Proteger (control de acceso)**: cuatro
afirmaciones de cumplimiento quedan **contradichas** (C1, C2, C4) o **parcialmente contradichas**
(C3, C5, C8), todas con **una causa raíz común** —`UnitScopeGuard` por substring + exención de
`RSI`/`ADMINISTRADOR`, más la ausencia de `ValidationPipe` global—. Las debilidades de **Detectar**
(C6, C7) ya estaban declaradas como pendientes y se confirman. La remediación de la causa raíz
(ver §8 del [informe-red-team.md](informe-red-team.md)) realinea simultáneamente la mayoría de estas
afirmaciones con el estado real del sistema.

| Veredicto | Cantidad | Casos |
|---|---|---|
| 🔴 Contradicha | 3 | C1, C2, C4 |
| 🟠 Parcialmente contradicha | 3 | C3, C5, C8 |
| 🟡 Brecha ya declarada (confirmada) | 2 | C6, C7 |
| 🟢 Sostenida | 5 | CSRF/Origin, LECTOR, guard bien cableado, cifrado TOTP, sin SQLi/XSS |
