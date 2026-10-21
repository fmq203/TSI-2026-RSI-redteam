# Hallazgos

Repositorio: [sistema-rsi](https://github.com/DieAndres/sistema-rsi) (backend NestJS + Prisma,
frontend React detrás de nginx).

Metodología: cada hallazgo partió de una revisión del código fuente y luego se **confirmó
dinámicamente** con una prueba de concepto contra una instancia real desplegada en el
laboratorio (datos sintéticos, red aislada). Los pasos para reproducir cada hallazgo como
usuario común están en [05-reproduccion.md](05-reproduccion.md); la evidencia textual de cada
PoC ejecutado está en [evidencia/](evidencia/).

Guards activos globalmente (`app.module.ts`), en orden de ejecución: `AuthGuard` → `RolesGuard`
→ `ReadOnlyGuard` → `UnitScopeGuard`. El origen de la mayoría de los fallos de autorización es
`UnitScopeGuard`: resuelve el alcance organizativo comparando **substrings del path** y solo lo
aplica a los roles `DUENO_UNIDAD` y `LECTOR`.

## 1. Control de acceso roto en `/organizaciones/*` (crítico — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-1-organizaciones.txt](evidencia/poc-hallazgo-1-organizaciones.txt)

- Archivo: `backend/src/organizacion/organizacion.controller.ts`
- No tiene ningún `@Roles(...)` a nivel de controller ni de método.
- `UnitScopeGuard` (`backend/src/auth/unit-scope.guard.ts`) solo mira parámetros/body llamados
  `organizacionId`, `unidadId` y `unidadOrganizativaId`. Las rutas de este controller usan
  `:id` genérico (`PATCH /organizaciones/:id`, `PATCH /organizaciones/unidades/:id`,
  `PATCH /organizaciones/procesos/:id`, `PATCH /organizaciones/asignaciones-raci/:id`, etc.).
- `validarRegistro()` dentro del guard solo resuelve el alcance para rutas que contengan
  `/trabajadores/`, `/activos/`, `/vulnerabilidades/`, `/riesgos/`, `/incidentes/`,
  `/politicas/`, `/evidencias/`, `/planes/`, `/procedimientos/`. No contempla `/unidades/`,
  `/procesos/`, `/asignaciones-raci/` ni `organizaciones/:id` directo.
- **Impacto esperado:** un usuario `DUENO_UNIDAD` (o `LECTOR` en las rutas GET) podría crear
  organizaciones, editar cualquier organización (`PATCH /organizaciones/:id`), y editar/borrar
  unidades, procesos y asignaciones RACI de **otras** unidades, no solo la propia.
- **Confirmado contra la instancia desplegada** (2026-10-19) con `dueno@rsi.local`: pudo leer y
  modificar la unidad "Tecnología y seguridad" (ajena), modificar el `alcanceSgsi` de toda la
  organización, crear una unidad nueva colgada directo de la organización, y leer el listado
  completo de asignaciones RACI de toda la empresa sin filtro de alcance. Ver PoC enlazado arriba.

## 2. IDOR por IDs en el body (alto — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-2-idor-activoid.txt](evidencia/poc-hallazgo-2-idor-activoid.txt)

- `POST /seguridad/vulnerabilidades`, `riesgos`, `incidentes` reciben `activoId` en el body.
  `UnitScopeGuard` solo valida `organizacionId`/`unidadId`/`unidadOrganizativaId` del body, no
  `activoId`. Un `DUENO_UNIDAD` podría crear un riesgo/vulnerabilidad/incidente apuntando a un
  activo de **otra** unidad.
- `GET /organizaciones/asignaciones-raci` no filtra por alcance en absoluto (a diferencia de
  `listarTrabajadores`/`listarProcesos`/`listarActivos` que sí filtran cuando el rol es
  `DUENO_UNIDAD`/`LECTOR`). Confirmado en el PoC del hallazgo #1.
- **Confirmado contra la instancia desplegada:** `dueno@rsi.local` (alcance = Operaciones) creó
  un riesgo (`POST /seguridad/riesgos`, HTTP 201) apuntando a un activo CRÍTICO/CONFIDENCIAL de
  otra unidad que ni siquiera aparece en su propio listado de activos. Dato curioso: el `DELETE`
  del mismo registro sí quedó bloqueado (403) porque `UnitScopeGuard.validarRegistro` resuelve el
  alcance a partir del `:id` de la ruta — confirma que el agujero es específicamente la
  **creación**, no una falla general del guard.

## 2b. Mismo IDOR confirmado también en `/seguridad/incidentes` (alto — **CONFIRMADO**)

- Mismo patrón que el riesgo del hallazgo #2: `dueno@rsi.local` creó un incidente
  (`POST /seguridad/incidentes`, HTTP 201) apuntando al mismo activo ajeno
  (`Base de datos de clientes y entregas`, Tecnología). Más sensible que un riesgo porque
  el módulo de incidentes alimenta el flujo de notificación URCDP — un actor malicioso con
  `DUENO_UNIDAD` podría fabricar ruido/incidentes falsos sobre activos de otras unidades.

## 2c. IDOR cross-organización en `/cumplimiento/hitos/:id` (alto — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-6-hitos-cross-org.txt](evidencia/poc-hallazgo-6-hitos-cross-org.txt)

- `UnitScopeGuard.validarRegistro()` resuelve el alcance solo si el path contiene uno de estos
  substrings: `/trabajadores/`, `/activos/`, `/vulnerabilidades/`, `/riesgos/`, `/incidentes/`,
  `/politicas/`, `/evidencias/`, `/planes/`, `/procedimientos/`. **`/hitos/` no está en la
  lista.**
- `POST /cumplimiento/planes/:planId/hitos` y `GET /cumplimiento/planes/:planId/hitos` quedan
  protegidos "por accidente" porque la URL contiene `/planes/` como substring.
- `PATCH /cumplimiento/hitos/:id` y `DELETE /cumplimiento/hitos/:id` **no** contienen `/planes/`
  en el path → quedan completamente sin chequeo de alcance.
- **Confirmado contra la instancia:** se creó una segunda organización de prueba ("Org B"),
  con un plan y un hito dentro. `dueno@rsi.local` (que pertenece a la Org A del seed demo) pudo
  `PATCH` y `DELETE` ese hito de la Org B ajena, HTTP 200 en ambos casos, mientras que crear o
  listar hitos vía la ruta anidada sí fue bloqueado correctamente (403).
- Confirma, por tercera vez, el mismo patrón estructural: el guard de alcance depende de
  coincidencias de substring en el path en vez de resolver el tipo de recurso real a partir de
  metadata explícita (decorador, tabla de rutas, o `request.route.path`).

## 2d. Rol `RSI` sin alcance organizativo — acceso cross-org a datos personales URCDP (crítico — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-7-rsi-cross-org-urcdp.txt](evidencia/poc-hallazgo-7-rsi-cross-org-urcdp.txt)

- `UnitScopeGuard` solo restringe a los roles `DUENO_UNIDAD` y `LECTOR`. El rol `RSI` no
  requiere `trabajadorId` y por lo tanto el guard lo deja pasar sin ningún chequeo de alcance,
  igual que `ADMINISTRADOR`.
- `exportaciones/urcdp.controller.ts` (datos personales para notificaciones URCDP) solo exige
  `@Roles('ADMINISTRADOR', 'RSI')` a nivel de controller, sin un `validarAlcance()` propio como
  sí tiene `exportaciones.controller.ts`.
- **Confirmado contra la instancia:** se creó una organización nueva ("Org C") con una base de
  datos personales marcada con un dato "secreto". `rsi@rsi.local` (vinculado a la Org A del seed
  demo) pudo **leer** (`GET`, HTTP 200) y **modificar** (`PUT`, HTTP 200) esa base de Org C sin
  ninguna relación con ella.
- Impacto elevado porque el módulo URCDP existe específicamente para cumplir la normativa
  uruguaya de protección de datos personales, que exige que cada responsable de tratamiento
  controle el acceso a sus propios datos — una cuenta RSI de una organización pudo ver y alterar
  los de otra.
- El mismo mecanismo de exención (`UnitScopeGuard` solo filtra `DUENO_UNIDAD`/`LECTOR`) aplicaría
  también a `/datos/.../exportar`, `/exportaciones/.../mcu`, `/bcu`, `/cobit` y en general a
  `/seguridad`, `/cumplimiento`, `/organizaciones` para cuentas RSI — no se probó cada endpoint
  individualmente, pero el mecanismo subyacente es el mismo.
- **Pregunta abierta para el grupo:** si el sistema está pensado para una sola organización por
  despliegue, este hallazgo no aplica en la práctica. Si está pensado multi-tenant (varias
  organizaciones en el mismo backend, como sugiere el modelo de datos y el propio seed), es un
  fallo crítico de aislamiento entre inquilinos.

## 3. Sin `ValidationPipe` global → mass assignment (alto — **CONFIRMADO, más grave de lo esperado**)

> PoC completo: [evidencia/poc-hallazgo-3-mass-assignment.txt](evidencia/poc-hallazgo-3-mass-assignment.txt)

- `backend/src/main.ts` no configura `ValidationPipe` ni `whitelist: true`. Los DTO
  (`CrearUsuarioDto`, `ActualizarUsuarioDto`, etc.) son solo tipos TypeScript; no hay
  enforcement en runtime.
- `AuthService.actualizarUsuario()` hace `tx.usuario.update({ where: { id }, data: datos })`
  pasando el body completo a Prisma. Si el body incluye campos no declarados en el DTO pero que
  existen en el modelo `Usuario` (`passwordHash`, `mfaSecret`, `mfaConfirmado`, `correo`...),
  Prisma los va a persistir igual.
- **Confirmado contra la instancia desplegada:** como `admin@rsi.local`, `PATCH
  /auth/usuarios/<id lector>` con `{"mfaConfirmado": true, "mfaSecret": "AAAA..."}` quedó
  persistido en Postgres (verificado con `SELECT`), bypaseando por completo el flujo real de
  enrolamiento MFA (QR + código TOTP válido). Lo mismo con `{"passwordHash": "..."}`: se pudo
  escribir un hash arbitrario sin pasar por `hashPassword()` ni ninguna validación de formato.
  Esto significa que cualquier sesión con rol `ADMINISTRADOR` puede plantar un backdoor de
  autenticación persistente en cualquier cuenta, incluyendo otros administradores.
- **Revisado y descartado como patrón repetido:** se revisaron todos los demás `update()` del
  backend (`activo`, `riesgo`, `vulnerabilidad`, `incidente`, `organizacion`, `unidadOrganizativa`,
  `proceso`, `asignacionRaci`, `politica`, `procedimiento`, `plan`, `evidencia`). Todos construyen
  un objeto `datosActualizados` campo por campo explícito antes de pasarlo a Prisma — el problema
  está **aislado en `AuthService.actualizarUsuario()`**, no es un patrón generalizado en el código.

## 4. Enumeración de usuarios por timing en login (medio — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-5-enumeracion-timing.txt](evidencia/poc-hallazgo-5-enumeracion-timing.txt)

- El login no ejecuta `verifyPassword` cuando el usuario no existe (devuelve temprano).
- **Medido contra la instancia:** ~0.45-0.55s de respuesta cuando el usuario existe (corre
  argon2) vs. ~0.02s cuando no existe (corta antes de hashear). Diferencia de ~20x, trivial de
  distinguir.
- El rate-limit de nginx (`5r/m` por IP, burst=4) sí mitiga la velocidad de explotación: se
  confirmó que tras 1-2 intentos la misma IP ya recibe `429` por ~60s. Enumeración sigue siendo
  posible pero lenta, o requiere múltiples IPs/proxies.
- Nota: ese mismo rate-limit puede producir "fail shared" entre usuarios detrás del mismo
  NAT/proxy corporativo.

## 4b. Replay de código TOTP (medio — **CONFIRMADO**)

> PoC completo: [evidencia/poc-hallazgo-4-totp-replay.txt](evidencia/poc-hallazgo-4-totp-replay.txt)

- `backend/src/auth/totp.ts` usa `epochTolerance: 30` (ventanas anterior/actual/siguiente
  aceptadas) y no registra ningún "último código usado" por usuario.
- **Confirmado:** el mismo código TOTP válido se usó dos veces consecutivas para loguear al
  admin y generó dos sesiones independientes sin invalidar la primera ni generar ninguna alerta.
- Impacto: un código interceptado (phishing, pantalla compartida, etc.) puede reutilizarse
  durante toda su ventana de validez (~60-90s) sin que el dueño legítimo lo note.

## 4c. Otros puntos de autenticación/MFA (bajo, no explotados)

- Un `ADMINISTRADOR`/`RSI` sin MFA confirmado entra solo con contraseña a las rutas de setup;
  `iniciarMfa()` devuelve el secreto en claro (esperado por diseño, pero vale verificar que no
  quede en logs de auditoría — no se revisó).

## 5. CSRF / Origin (bajo)

- Defensa basada en cookie `__Host-` + `SameSite=Strict` + validación de header `Origin` en
  métodos no-GET (`session-http.ts`). Revisar que `SESSION_ALLOWED_ORIGINS` en producción no
  incluya orígenes de desarrollo (`http://localhost:5173`).

## 6. Infraestructura / configuración (bajo-medio)

- `.env.example` trae `POSTGRES_PASSWORD=change-me` — confirmar que el despliegue real del
  grupo lo haya cambiado.
- Postgres expuesto en `127.0.0.1:5432` en el `docker-compose.yml` (no es explotable desde
  fuera del host, pero vale mencionarlo).
- CSP en nginx permite `style-src 'unsafe-inline'`.
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` — el valor lo controla el
  cliente; si el backend confía en ese header para algo (rate limit, auditoría), es spoofeable.
- Revisar `backend/scripts/seed-demo.mjs` / `seed-soa-demo.mjs` por si el despliegue real del
  grupo los corrió con datos no sintéticos o credenciales reales (no debería, pero confirmar).

## 7. CSV injection — **revisado, NO explotable por esta vía**

- Único export CSV real del backend: `backend/src/datos/formato.ts` (`aCsv`), usado por
  `GET /datos/organizaciones/:id/exportar?formato=csv`.
- Cada celda se envuelve en comillas con escape RFC4180 (`"` → `""`) **y** el contenido es
  siempre `JSON.stringify(fila)`, por lo que el primer carácter de toda celda es `{` — nunca
  `=`, `+`, `-` ni `@`. Excel/Sheets no lo interpretaría como fórmula.
- No se encontró ningún otro punto del backend que genere CSV concatenando campos sin escapar.
- Queda pendiente (no revisado) si las exportaciones Markdown (`inventario-activos-borrador.md`,
  `politica-seguridad-borrador.md`, etc.) tienen algún riesgo de inyección si se abren con un
  conversor que ejecute macros/fórmulas, pero es un vector distinto y de menor probabilidad.

## 8. Revisado y descartado: XSS almacenado / renderizado inseguro

- Frontend React sin `dangerouslySetInnerHTML`, sin `innerHTML`, sin libs de markdown-a-HTML.
- Las exportaciones `.md` se descargan como adjunto (`text/markdown`), no se renderizan como
  HTML en el navegador.
- CSP de nginx usa `script-src 'self'` sin `unsafe-inline` para scripts.
- **Conclusión:** riesgo de XSS almacenado bajo con la superficie revisada; no se encontró un
  vector concreto para explotarlo. No se profundizó en el parser de importación CSV
  (`seguridad/importacion-csv.ts`) más allá de la revisión estructural.

## Severidad relativa (para el informe final)

1. Control de acceso roto en organizaciones (crítico) — confirmado
2. Mass assignment en `PATCH /auth/usuarios/:id` (crítico, permite backdoor MFA/password) — confirmado
3. Rol RSI sin alcance organizativo → acceso cross-org a datos personales URCDP (crítico, condicionado a despliegue multi-tenant) — confirmado
4. IDOR por `activoId` en riesgos/incidentes, RACI sin filtro, hitos cross-organización (alto) — confirmado (3 variantes del mismo patrón estructural)
5. Enumeración de usuarios por timing (medio) — confirmado
6. Replay de código TOTP (medio) — confirmado
7. CSRF/Origin, configuración de infraestructura (bajo-medio) — no explotado activamente
8. CSV injection / XSS almacenado — descartados, no explotables con lo revisado
