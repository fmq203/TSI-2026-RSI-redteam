# Red Team — sistema-rsi (grupo DieAndres)

Documentación del ejercicio de red team sobre el repositorio
[sistema-rsi](https://github.com/DieAndres/sistema-rsi) (backend NestJS + Prisma/Postgres,
frontend React detrás de nginx con TLS), correspondiente a la tarea de otro grupo.

**Estado:** ejercicio completo. Hallazgos confirmados con PoC contra una instancia real y
documentados con pasos de reproducción.

## Índice

1. [00-resumen.md](00-resumen.md) — este archivo.
2. [01-entorno-despliegue.md](01-entorno-despliegue.md) — topología de red, VM, cómo se desplegó.
3. [02-credenciales.md](02-credenciales.md) — usuarios del entorno de pruebas (credenciales redactadas).
4. [03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md) — informe de hallazgos, severidad y PoC.
5. [04-bitacora-comandos.md](04-bitacora-comandos.md) — comandos de referencia para reconstruir el entorno.
6. [05-reproduccion.md](05-reproduccion.md) — cómo reproducir cada hallazgo como usuario común (navegador).
7. [evidencia/](evidencia/) — salida textual de cada PoC ejecutado.

## Resumen ejecutivo

- Se clonó el repo (estaba público el 2026-10-14, pasó a privado/404 después).
- Se revisó el código fuente (autenticación, autorización por rol `RolesGuard`, alcance
  organizativo `UnitScopeGuard`, sesiones, TOTP, nginx) y se desplegó una instancia real en una
  VM de Proxmox para confirmar cada hallazgo con PoC reproducibles (datos sintéticos, red
  aislada).
- Se cargaron datos demo (organización ficticia "Logística del Ceibo") y se crearon usuarios de
  los 4 roles del sistema para probar cruces de permisos.

### Hallazgos confirmados

Todos re-verificados contra la instancia viva el 2026-10-21.

- **Críticos:** (1) control de acceso roto en `/organizaciones/*`; (2) mass assignment en
  `PATCH /auth/usuarios/:id` que permite plantar un backdoor de MFA/contraseña; (3) el rol
  `RSI` no tiene alcance organizativo y accede a datos personales (URCDP) de otras
  organizaciones (condicionado a despliegue multi-organización).
- **Alto:** IDOR por referencia directa a objetos, con 3 variantes del mismo patrón estructural
  en `UnitScopeGuard` (`activoId` en creación de riesgos/incidentes, RACI sin filtro, hitos de
  plan cross-organización).
- **Medios:** enumeración de usuarios por timing en el login; replay de código TOTP;
  enumeración cross-organización vía `GET /organizaciones`; creación de procesos sin alcance;
  falta de segregación de funciones al aprobar/aceptar riesgos (sujeto a diseño).
- **Descartados** (revisados, no explotables con lo analizado): CSV injection, XSS almacenado.
- **Controles que sí funcionan:** solo-lectura del `LECTOR`, no escalada de rol, bloqueo de
  escritura/lectura fuera de alcance cuando el id viaja en ruta/body, validación de escala de
  riesgo. (Detalle en el informe de hallazgos.)

El detalle, la severidad y la causa raíz de cada uno están en
[03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md); los pasos para
reproducirlos, en [05-reproduccion.md](05-reproduccion.md).
