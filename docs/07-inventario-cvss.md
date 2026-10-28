# Inventario de hallazgos con CVSS 3.1

Puntajes **CVSS v3.1 (base)** estimados para cada hallazgo confirmado. Son estimaciones del
equipo Red Team; el vector está explícito para que puedan recalcularse/ajustarse. La severidad
cualitativa sigue la escala estándar (0.1–3.9 Baja · 4.0–6.9 Media · 7.0–8.9 Alta · 9.0–10.0 Crítica).

> Varios hallazgos de aislamiento (2d/H9/RT05) están **condicionados** a que el despliegue sea
> multi-organización. Si el sistema se usa con una sola organización por despliegue, su impacto
> real es menor; el CVSS indicado asume el escenario multi-tenant que sugieren el modelo de datos
> y el seed.

| # | Hallazgo | Vector CVSS 3.1 | Base | Severidad |
|---|---|---|---|---|
| H1 | Control de acceso roto en `/organizaciones/*` (lectura/escritura de unidades, procesos, RACI y organización ajenos) | `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N` | **8.1** | Alta |
| H3 | Mass assignment en `PATCH /auth/usuarios/:id` (plantar semilla TOTP / hash de contraseña → backdoor de cuenta) | `AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N` | **6.0** | Media |
| H2d | Rol `RSI` sin alcance → lectura/escritura de datos personales URCDP de otra organización (incluye RT05: KPIs) | `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N` | **8.1** | Alta |
| H2c | IDOR cross-organización en `PATCH`/`DELETE /cumplimiento/hitos/:id` | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N` | **7.1** | Alta |
| H2/H2b | IDOR por `activoId` al crear riesgos/incidentes sobre activos de otra unidad | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` | **5.4** | Media |
| H9 | Enumeración cross-organización vía `GET /organizaciones` | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N` | **4.3** | Media |
| H10 | Creación de procesos sin alcance (`POST /organizaciones/procesos` sin `organizacionId`) | `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` | **4.3** | Media |
| H11 | Falta de segregación de funciones: `DUENO_UNIDAD` auto-aprueba/acepta sus riesgos | `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` | **4.3** | Media |
| H4b | Replay de código TOTP dentro de la ventana de validez | `AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N` | **4.2** | Media |
| H4 | Enumeración de usuarios por timing en `/auth/login` | `AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N` | **3.7** | Baja |
| RT03-MD | Markdown injection en exportadores (links/imágenes sin escapar) | `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` | **5.4** | Media |
| RT12-DoS | Exportadores sin paginación → amplificación de latencia por concurrencia (estructural, extrapolado) | `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` | **3.5** | Baja |

## Notas por hallazgo

- **H1 (8.1):** `PR:L` porque requiere una cuenta de rol bajo autenticada (`DUENO_UNIDAD`). `C:H/I:H`
  por lectura y modificación de datos de toda la organización. No se evaluó `A` (borrado de
  unidades/procesos ajenos es posible; subiría el componente de disponibilidad).
- **H3 (6.0):** acotado por `PR:H` (requiere sesión `ADMINISTRADOR`). El **impacto de negocio es
  alto** pese al puntaje: permite un backdoor de autenticación persistente sobre cualquier cuenta,
  incluidos otros administradores. El riesgo real depende de la exposición de cuentas admin.
- **H2d (8.1):** datos personales (Ley 18.331 / URCDP) de otra organización, con lectura y
  escritura. Condicionado a multi-tenant. RT05-P04 (KPIs agregados sin segmentar) es la misma raíz.
- **H2c (7.1):** `I:H` por modificación/borrado de hitos de planes de otra organización.
- **H2/H2b (5.4):** la respuesta del `POST` además devuelve los datos del activo ajeno (`C:L`).
- **H4b (4.2) y H4 (3.7):** `AC:H` porque requieren, respectivamente, interceptar un código válido
  y realizar mediciones estadísticas; el rate-limit de nginx mitiga parcialmente H4.
- **RT03-MD (5.4):** sintaxis Markdown de links/imágenes sin escapar en los exportadores; habilita
  exfiltración pasiva (beacon vía imagen remota) y phishing dentro de documentos oficiales. `C:L`
  porque filtra solo metadata de quien abre el documento (no datos del sistema), `I:L` porque
  altera el contenido visual/confianza del documento.
- **RT12-DoS (3.5):** `AC:L` porque no requiere condiciones especiales, `A:L` porque el impacto
  observado (≈10× latencia con 10 requests concurrentes) es una degradación parcial, no una caída
  confirmada — el puntaje refleja que es una extrapolación razonada y no una demostración completa
  (ver limitación en [10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md)).

## Resumen por severidad

- **Alta (7.0–8.9):** H1 (8.1), H2d (8.1), H2c (7.1).
- **Media (4.0–6.9):** H3 (6.0), RT03-MD (5.4), H2/H2b (5.4), H9 (4.3), H10 (4.3), H11 (4.3), H4b (4.2).
- **Baja (0.1–3.9):** H4 (3.7), RT12-DoS (3.5).

La descripción técnica, causa raíz y PoC de cada hallazgo están en
[03-hallazgos-analisis-estatico.md](03-hallazgos-analisis-estatico.md) y
[10-rt03-rt07-rt12.md](10-rt03-rt07-rt12.md); los pasos de reproducción en
[05-reproduccion.md](05-reproduccion.md); el mapeo normativo en
[06-mapeo-mitre-attack.md](06-mapeo-mitre-attack.md).
