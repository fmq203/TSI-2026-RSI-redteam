# TSI 2026 — Red Team sobre sistema-rsi

Ejercicio de red team (materia TSI, 2026) sobre el proyecto
[sistema-rsi](https://github.com/DieAndres/sistema-rsi) de otro grupo: un sistema de gestión
de seguridad de la información (SGSI) con backend NestJS + Prisma/Postgres y frontend React
detrás de nginx con TLS.

Se desplegó una instancia completa del sistema en un entorno de laboratorio aislado (VM en
Proxmox, red separada), con datos 100% sintéticos, y se confirmaron los hallazgos con pruebas
de concepto reales contra esa instancia (no solo lectura de código).

## Resultado

- **3 hallazgos críticos** confirmados con PoC: control de acceso roto entre unidades/organizaciones,
  mass assignment que permite plantar un backdoor de MFA/contraseña, y acceso cross-organización
  a datos personales (módulo URCDP) desde el rol RSI.
- **1 hallazgo alto** (con 3 variantes del mismo patrón estructural): IDOR por referencia directa
  a objetos (`activoId`, hitos de plan) que evade el control de alcance organizativo.
- **2 hallazgos medios**: enumeración de usuarios por timing en el login, y replay de código TOTP.
- 2 vectores revisados y descartados (CSV injection, XSS almacenado) con su justificación.

## Índice

- [docs/00-resumen.md](docs/00-resumen.md) — resumen ejecutivo del ejercicio.
- [docs/01-entorno-despliegue.md](docs/01-entorno-despliegue.md) — cómo se desplegó el entorno de pruebas.
- [docs/02-credenciales.md](docs/02-credenciales.md) — credenciales del entorno de laboratorio (red interna aislada, sin exposición real).
- **[docs/03-hallazgos-analisis-estatico.md](docs/03-hallazgos-analisis-estatico.md) — informe de hallazgos, con severidad y PoC.**
- [docs/04-bitacora-comandos.md](docs/04-bitacora-comandos.md) — comandos de referencia para reproducir el entorno.
- **[docs/05-reproduccion.md](docs/05-reproduccion.md) — cómo reproducir cada hallazgo como usuario común (navegador).**
- [docs/06-mapeo-mitre-attack.md](docs/06-mapeo-mitre-attack.md) — mapeo de hallazgos a OWASP Top 10, CWE y MITRE ATT&CK (+ capa para ATT&CK Navigator).
- [docs/07-inventario-cvss.md](docs/07-inventario-cvss.md) — inventario de hallazgos con puntajes CVSS 3.1.
- [docs/08-bitacora-red-team.md](docs/08-bitacora-red-team.md) — bitácora diaria del equipo Red Team.
- [docs/09-rt11-osint-gitleaks.md](docs/09-rt11-osint-gitleaks.md) — RT-11: OSINT del repositorio (gitleaks).
- [docs/evidencia/](docs/evidencia/) — evidencia textual de cada PoC ejecutado contra la instancia real.
- [lab/](lab/) — laboratorio reproducible con Vagrant + VirtualBox para levantar el entorno sin Proxmox.

## Alcance y método

Todo lo reportado se probó contra una instancia propia, levantada específicamente para este
ejercicio en una red de laboratorio sin salida pública, con datos sintéticos. No se atacó
ningún entorno de producción ni ningún sistema de terceros. Todos los cambios de prueba hechos
sobre la base de datos (ediciones, registros creados) fueron revertidos o eliminados al
finalizar cada prueba.
