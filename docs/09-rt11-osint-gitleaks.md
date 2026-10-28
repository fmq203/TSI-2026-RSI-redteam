# RT-11 — OSINT del repositorio (secretos commiteados)

**Objetivo de la letra:** "OSINT del repositorio (secretos commiteados)".
**Alcance:** historial completo de `sistema-rsi` (3 commits, `981026016a79` → `4c655f0`, más
la branch `red-team`), no solo el HEAD.
**Resultado: sin secretos reales filtrados.**

## Metodología

1. `gitleaks detect` sobre el repo con `--source .` (incluye todo el historial de git, no solo
   el working tree) y las reglas por defecto.
2. Búsqueda manual complementaria sobre `git log --all -p` de patrones que las reglas genéricas
   de gitleaks a veces no cubren bien: claves privadas PEM, claves SSH, access keys AKIA de AWS,
   JWT con estructura `xxx.yyy.zzz`.
3. Revisión de qué archivos `.env*` quedaron trackeados en algún punto del historial.

## Resultados

### gitleaks: 5 hallazgos, los 5 falsos positivos

| Archivo | Commit | Veredicto |
|---|---|---|
| `backend/README.md:234` | `981026016a79` (DieAndres) | Ejemplo de documentación: `'Una-clave-temporal-de-12'`, instructivo de uso del script `crear-admin`. No es una credencial real. |
| `backend/src/auth/totp.spec.ts:5` | `981026016a79` (DieAndres) | `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` — es el **secreto de prueba público de RFC 6238** (estándar TOTP), usado en cualquier test de TOTP del mundo. No es secreto de nadie. |
| `backend/src/auth/totp-secret.spec.ts:17` | `981026016a79` (DieAndres) | Mismo secreto RFC 6238 que el anterior, en otro test. |
| `docs/.qa-riesgos/crear_soa_md.py:22` | `981026016a79` (DieAndres) | Texto de análisis de riesgos que *menciona* la palabra "secretos" como tema de gestión; no contiene ningún secreto. Falso positivo por entropía del texto en español. |
| `red-team/lab/Vagrantfile:49` | `1bc382f8` (fmq203 — **nuestro commit**) | Password de ejemplo documentado del laboratorio propio (`CambiaEstaClave12+`), con comentario explícito "Cambiala si querés". Ver observación abajo. |

### Verificaciones manuales adicionales

- **Archivos `.env*` trackeados en algún commit del historial:** solo `.env.example` (correcto
  y esperado — es la plantilla sin valores reales).
- **Archivos de clave/certificado (`*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `*.p12`, `*.pfx`):**
  ninguno trackeado en ningún commit.
- **Bloques `BEGIN ... PRIVATE KEY` en todo el historial (`git log --all -p`):** 0 coincidencias.
- **Patrones de AWS Access Key (`AKIA[0-9A-Z]{16}`) o JWT (`xxx.yyy.zzz`) en todo el historial:**
  0 coincidencias.

## Conclusión

No se encontró ningún secreto real commiteado en `sistema-rsi` (historial completo, no solo
HEAD). Es un resultado **positivo para el Blue Team**: buena higiene de repositorio respecto a
credenciales.

**Observación menor (no vulnerabilidad del Blue Team, autocrítica del propio Red Team):**
nuestro `red-team/lab/Vagrantfile` incluye un password de ejemplo hardcodeado
(`CambiaEstaClave12+`) para el laboratorio local. Es intencional y está documentado (comentario
"cambiala si querés"), pero como buena práctica de IaC conviene moverlo a una variable de
entorno no versionada en una futura revisión del lab, para no establecer un hábito de passwords
en texto plano dentro de archivos de infraestructura, aunque sean de un entorno descartable.

## Herramientas usadas

- [`gitleaks`](https://github.com/gitleaks/gitleaks) v8.x, reglas por defecto, `--source .`
  sobre el repo completo (no solo el working tree).
- `git log --all -p` + `grep`/patrones regex para la verificación manual complementaria.
