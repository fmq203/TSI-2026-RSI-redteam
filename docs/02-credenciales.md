# Credenciales del entorno de pruebas

> Entorno de laboratorio aislado (red interna sin salida pública), datos 100% sintéticos.
> Las contraseñas y claves reales usadas durante el ejercicio **no se publican** en este
> documento — se reemplazan por placeholders. Quien necesite reproducir el entorno debe generar
> sus propias credenciales siguiendo el mismo procedimiento (ver
> [01-entorno-despliegue.md](01-entorno-despliegue.md)).

## Acceso a la aplicación

URL de referencia: `https://<IP_VM_LABORATORIO>:8443` (certificado autofirmado).

| Rol | Correo | Password | Vinculado a | MFA |
|---|---|---|---|---|
| ADMINISTRADOR | `admin@rsi.local` | `<PASSWORD_ADMIN>` | — | Activado (TOTP) |
| RSI | `rsi@rsi.local` | `<PASSWORD_RSI>` | Lucía Fernández (Tecnología y seguridad) | Activado (TOTP) |
| DUENO_UNIDAD | `dueno@rsi.local` | `<PASSWORD_DUENO>` | Martín Pereira (Operaciones y distribución) | N/A |
| LECTOR | `lector@rsi.local` | `<PASSWORD_LECTOR>` | Nicolás Silva (Tecnología y seguridad) | N/A |

El rol RSI también requiere MFA obligatorio según `auth.guard.ts`. Se activa con el mismo
flujo que para el admin (`POST /auth/mfa/setup` → generar TOTP a partir del secreto devuelto →
`POST /auth/mfa/confirm`), salvo en las rutas permitidas sin MFA confirmado: `/auth/mfa/setup`,
`/auth/mfa/confirm`, `/auth/me`, `/auth/logout`, `/auth/sesiones/revocar`.

## IDs de referencia (seed demo)

Organización demo ("Logística del Ceibo — Demo") con 4 unidades (Dirección, Tecnología y
seguridad, Operaciones y distribución, Administración y finanzas) y 6 trabajadores, cada uno
vinculado a una unidad. Los IDs concretos (UUID) se omiten aquí por no aportar valor fuera del
entorno de laboratorio ya desmontado; en su momento se usaron para construir los PoC de IDOR
comparando el alcance de `dueno@rsi.local` (Operaciones) contra registros de otras unidades
(Tecnología, Administración).

## Acceso a infraestructura

| Recurso | Dato |
|---|---|
| Host Proxmox | IP de red local del laboratorio, acceso por clave SSH generada para el ejercicio |
| VM de pruebas (`rsi-victim`) | IP de la red de laboratorio aislada, alcanzable solo a través del host Proxmox (jump host) |
| Postgres (dentro de la VM) | usuario `rsi`, password generada con `openssl rand -hex 16`, local al `.env` de la VM |
| `TOTP_ENCRYPTION_KEY` | generada con `openssl rand -hex 32`, local al `.env` de la VM |

Ninguna de estas credenciales es reutilizable fuera del entorno de laboratorio, que ya fue
desmontado al finalizar el ejercicio.
