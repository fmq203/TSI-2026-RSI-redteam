# Capturas de evidencia

Capturas tomadas desde Kali contra la instancia de laboratorio (`10.10.10.87`), reproduciendo
los hallazgos como **usuario de rol bajo** (`DUENO_UNIDAD`), salvo las de contexto. La IP que
aparece es la de la red de laboratorio aislada (no enrutable desde internet).

> Las capturas se toman como `DUENO_UNIDAD` a propósito: demuestran que un usuario **sin
> privilegios** realiza acciones fuera de su alcance. En cada una, arriba a la derecha se ve
> `dueno@rsi.local / DUENO UNIDAD`.

## Contexto

| Archivo | Qué muestra |
|---|---|
| `00-contexto-setup-kali.png` | Preparación de herramientas en Kali (curl, jq, oathtool). |
| `00-contexto-login-app.png` | Pantalla de login de la aplicación. |
| `00-contexto-dashboard-admin.png` | Dashboard del sistema (estado normal). |
| `00-contexto-conectividad-healthz.png` | Conectividad Kali → víctima (`/healthz` = ok). |
| `00-contexto-helper-consola-dueno.png` | Helper `api()` cargado en la consola, sesión `DUENO_UNIDAD`. |

## Evidencia por hallazgo

| Archivo | Hallazgo |
|---|---|
| `h01-terminal-patch-unidad-ajena.png` | **H1** — `DUENO_UNIDAD` modifica una unidad ajena (`PATCH`, HTTP 200). |
| `h01-console-patch-unidad-ajena-dueno.png` | **H1** — ídem, desde la consola del navegador. |
| `h01-console-detalle-revert-dueno.png` | **H1** — detalle de la respuesta y reversión del cambio. |
| `h01-terminal-revert-unidad.png` | **H1** — reversión del dato de prueba. |
| `h02-terminal-idor-riesgo-activo-ajeno.png` | **H2** — crea un riesgo sobre un activo CRÍTICO de otra unidad (HTTP 201). |
| `h02-console-idor-riesgo-dueno.png` | **H2** — el más claro: el inventario muestra "0 activos" para esa unidad, pero el `POST` igual crea el riesgo. |
| `h09-console-listar-orgs-dueno.png` | **H9** — `DUENO_UNIDAD` lista 2 organizaciones, incluida una ajena. |
| `h11-console-autoaprobar-riesgo-dueno.png` | **H11** — auto-aprueba y acepta su propio riesgo (estado `APROBADA`). |

Ver la descripción de cada hallazgo en [../../03-hallazgos-analisis-estatico.md](../../03-hallazgos-analisis-estatico.md)
y los pasos en [../../05-reproduccion.md](../../05-reproduccion.md).
