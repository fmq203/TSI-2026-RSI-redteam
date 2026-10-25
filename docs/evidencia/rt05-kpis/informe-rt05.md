# RT05-P04 — Aislamiento de KPIs entre organizaciones

**Proyecto:** TSI 2026 — Red Team sobre `sistema-rsi`  
**Fecha de ejecución:** 25/10/2026  
**Entorno:** laboratorio local Vagrant + VirtualBox; Ubuntu 24.04, backend NestJS, PostgreSQL y frontend React/nginx. Datos sintéticos.  
**Estado:** comportamiento técnico reproducido; clasificación como vulnerabilidad **pendiente de validar con el alcance funcional definido por Blue Team**.  
**Relación con trabajo previo:** complemento del hallazgo documentado de alcance inter-organizativo para rol `RSI` (sección 2d del informe existente). No reemplaza ni reenumera el hallazgo anterior.

## Objetivo

Verificar si el resumen de indicadores del dashboard consultado por una cuenta `RSI` vinculada a la organización A incorpora datos de activos de una organización B, utilizando un registro sintético controlado. La prueba observa exposición de **datos agregados** y no demuestra, por sí sola, lectura de fichas detalladas de activos ni modificación indebida de fórmulas KPI.

## Alcance y cuentas

- **Organización A:** `Logística del Ceibo — Demo` (organización original).
- **Organización B:** `Organización RT05 — Pruebas Red Team` (creada para esta prueba).
- **Cuenta de comparación autorizada:** `admin@rsi.local` (ADMINISTRADOR).
- **Cuenta evaluada:** `rsi-rt05@rsi.local` (RSI, vinculada a la organización A, MFA configurado).
- **Control negativo adicional:** `lector-rt05@rsi.local` (LECTOR).
- No se registran contraseñas, cookies, tokens, secretos TOTP ni códigos MFA en esta evidencia.

## Prerrequisitos y preparación

1. La instancia inició con **una organización** y **cinco activos** en el resumen.
2. Se creó la organización B para la prueba.
3. Al crear una unidad desde la interfaz, `Tecnología RT05` quedó por error bajo la organización A. **No se empleó esa unidad en el caso de prueba; está pendiente de limpieza supervisada**.
4. Se creó correctamente otra unidad `Tecnología RT05` bajo la organización B mediante la API:
   - `POST /api/v1/organizaciones/6f9ab57f-6277-4f3f-80d5-467d7b9c4587/unidades` → HTTP **201**.
   - ID de la unidad B: `92b4ad99-7783-470d-8968-08310f7a30e0`.
5. Se creó un activo sintético en la unidad B con la ruta confirmada en el controlador:
   - `POST /api/v1/seguridad/unidades/92b4ad99-7783-470d-8968-08310f7a30e0/activos` → HTTP **201**.
   - Nombre: `Servidor RT05 - Prueba de aislamiento`.
   - ID: `57ba5b10-4875-43cf-bd5d-f8de9f92b76f`.
   - `tipo: HW`, `criticidad: MEDIA`, `clasificacion: INTERNO`, sin responsable.
   - Una solicitud inicial con tipo `HARDWARE` devolvió HTTP 400; no creó activo. El código correcto `HW` permitió crearlo.

## Procedimiento y resultados

| Verificación | Cuenta | Acción | Resultado observado |
|---|---|---|---|
| RT05-P01 | ADMINISTRADOR | `GET /api/v1/kpis/resumen` | HTTP **200**, 5 activos, 5 con responsable, 100 %. |
| RT05-P02 | LECTOR | `GET /api/v1/kpis/resumen` | HTTP **403 Forbidden**; restricción de rol correcta. |
| RT05-P03 | RSI | `GET /api/v1/kpis/resumen`, antes del nuevo activo | HTTP **200**, 5 activos, 5 con responsable, 100 %. |
| RT05-P04 | ADMINISTRADOR | Crear organización/unidad B y activo sintético en B | HTTP **201** en las creaciones confirmadas. |
| RT05-P04 | RSI de A | Volver a ingresar con MFA y consultar el dashboard, luego de crear el activo B | **6 activos**, **83 % con responsable**. |

La variación observada es consistente con incorporar al conteo global el activo sin responsable de B: 5/6 × 100 = 83,33 %, presentado por la aplicación como **83 %**.

## Fundamento técnico

En el código revisado de `backend/src/kpi/kpi.service.ts`, el método `resumen()` utiliza consultas globales de Prisma, por ejemplo `this.prisma.activo.count()`, sin condiciones visibles de `organizacionId` o unidad. `KpiController` restringe sus endpoints mediante `@Roles('ADMINISTRADOR', 'RSI')`, por lo que el 200 para RSI y el 403 para LECTOR son coherentes con la configuración de rol. La cuestión a evaluar es **el alcance del conjunto de datos**, no el bypass del decorador de roles.

## Evaluación

**Comportamiento confirmado:** un usuario RSI vinculado a A ve métricas agregadas influenciadas por un activo de B. El resumen no aparece segmentado por organización en la prueba.

**Riesgo condicional:** en un despliegue multi-organización cuyo modelo de seguridad exija aislamiento por organización, la métrica global puede revelar existencia o cambios en registros ajenos y alterar los indicadores que el RSI usa para tomar decisiones. Si el dashboard es, por diseño, global para RSI, el resultado puede ser legítimo.

**No demostrado:** acceso al detalle del activo B a través del KPI, manipulación directa de fórmulas KPI, evasión de MFA, modificación de datos de B por RSI ni impacto en un entorno de producción.

**Conclusión:** registrar como **observación RT05-P04, pendiente de validación del requisito de aislamiento y del modelo multi-tenant**. Complementa, sin duplicar, la evidencia previa sobre aislamiento del rol RSI.

## Evidencias adjuntas

- [`capturas/rt05-01-admin-kpis.png`](capturas/rt05-01-admin-kpis.png): consulta autorizada del administrador, línea de base de 5 activos.
- [`capturas/rt05-02-lector-403.png`](capturas/rt05-02-lector-403.png): restricción HTTP 403 para LECTOR.
- [`capturas/rt05-03-rsi-antes.png`](capturas/rt05-03-rsi-antes.png): respuesta RSI previa al activo B, 5 activos.
- [`capturas/rt05-04-organizacion-unidad-original.png`](capturas/rt05-04-organizacion-unidad-original.png): verificación de unidades y detección de unidad RT05 accidental en A.
- [`capturas/rt05-05-unidad-rt05-creada.png`](capturas/rt05-05-unidad-rt05-creada.png): creación HTTP 201 de unidad bajo B.
- [`capturas/rt05-06-activo-creado.png`](capturas/rt05-06-activo-creado.png): alta HTTP 201 del activo sintético B.
- [`capturas/rt05-07-rsi-despues.png`](capturas/rt05-07-rsi-despues.png): dashboard RSI con 6 activos y 83 % con responsable.

## Recomendaciones para evaluación del Blue Team

1. Confirmar si RSI representa un supervisor global o un responsable restringido a una organización por despliegue.
2. Si hay aislamiento por organización, filtrar el cálculo de `resumen()` por el conjunto de organizaciones autorizadas derivado de la identidad autenticada (no confiar en un ID proporcionado por el cliente).
3. Crear pruebas automatizadas con al menos dos organizaciones y cuentas RSI de distintos alcances.
4. Conservar registros de auditoría sobre accesos y cambios que alimenten los indicadores.

## Limpieza pendiente del laboratorio

Antes de eliminar, confirmar IDs y dependencias. Eliminar **solo** los datos RT05 generados para esta prueba: activo `57ba5b10-4875-43cf-bd5d-f8de9f92b76f`, unidad B `92b4ad99-7783-470d-8968-08310f7a30e0`, organización B `6f9ab57f-6277-4f3f-80d5-467d7b9c4587`, y la unidad accidental `Tecnología RT05` en la organización A. **Ninguna limpieza se ejecutó durante la preparación de este informe.** Conservar cuentas de prueba hasta terminar RT05 o decidir su eliminación explícitamente.
