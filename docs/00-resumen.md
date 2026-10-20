# Red Team — sistema-rsi (grupo DieAndres)

Documentación del ejercicio de red team sobre el repositorio
[sistema-rsi](https://github.com/DieAndres/sistema-rsi) (backend NestJS + Prisma/Postgres,
frontend React detrás de nginx con TLS), correspondiente a la tarea de otro grupo.

**Estado:** entorno de pruebas desplegado y funcionando. Pendiente la fase de explotación activa.

## Índice

1. [00-resumen.md](00-resumen.md) — este archivo.
2. [01-entorno-despliegue.md](01-entorno-despliegue.md) — topología de red, VM, cómo se desplegó.
3. [02-credenciales.md](02-credenciales.md) — usuarios y claves del entorno de pruebas.
4. [03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md) — hallazgos de revisión de código (sin ejecutar nada).
5. [04-bitacora-comandos.md](04-bitacora-comandos.md) — comandos de referencia para reconectar y reproducir cada paso.

## Resumen ejecutivo (hasta ahora)

- Se clonó el repo (estaba público el 2026-10-14, pasó a privado/404 después).
- Se revisó el código de forma estática: autenticación, autorización por rol (`RolesGuard`),
  autorización por alcance organizativo (`UnitScopeGuard`), sesiones, TOTP, nginx.
- Se encontraron varios hallazgos, el más importante es un **control de acceso roto** en
  `/organizaciones/*` (ver [03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md)).
- Se desplegó una instancia real en una VM de Proxmox (clon de una VM `ubuntu` existente) para
  pasar de hallazgos teóricos a pruebas de explotación con PoC reproducibles.
- El stack corre en Docker Compose: Postgres + backend + frontend/nginx con TLS autofirmado.
- Se cargaron datos demo (organización ficticia "Logística del Ceibo") y se crearon usuarios
  de los 4 roles del sistema para poder probar cruces de permisos.

## Próximos pasos

- Explotar activamente el hallazgo de `UnitScopeGuard` (IDOR / escalamiento horizontal entre
  unidades organizativas) con usuarios `DUENO_UNIDAD` / `LECTOR` reales contra la instancia.
- Probar mass assignment en `PATCH /auth/usuarios/:id` (falta `ValidationPipe` global).
- Probar enumeración de usuarios por timing en login.
- Revisar CSV injection en exportaciones/importaciones.
- Armar el informe final con PoC, severidad y mitigaciones.
