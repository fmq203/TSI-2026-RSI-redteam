# Laboratorio reproducible con Vagrant + VirtualBox

Para quien **no** tiene Proxmox: levanta la misma "víctima" (sistema-rsi sobre Docker) en una
VM local de VirtualBox, equivalente a la desplegada en el informe.

## Requisitos (en tu máquina)

- [VirtualBox](https://www.virtualbox.org/) 7.x
- [Vagrant](https://developer.hashicorp.com/vagrant) 2.4+
- ~5 GB de RAM libre y ~10 GB de disco para la VM.

## Código de la aplicación (lo tenés que aportar vos)

El código de `sistema-rsi` pertenece a otro grupo y **no se incluye** en este repositorio.
Colocá una copia del proyecto en `lab/sistema-rsi/` antes de arrancar:

```
lab/
├── Vagrantfile
├── provision.sh
├── README.md
└── sistema-rsi/            <-- acá va el código (docker-compose.yml, backend/, frontend/, infrastructure/)
```

`lab/sistema-rsi/` está ignorado por git (ver `.gitignore`), así que no se sube.

## Levantar

```bash
cd lab
vagrant up           # primera vez: tarda (descarga box, build de imágenes)
```

Cuando termine el provisioning, abrí en el navegador del host:

```
https://192.168.56.10:8443
```

(aceptá la excepción del certificado autofirmado).

- **Admin:** `admin@rsi.local` con la contraseña `LAB_ADMIN_PASSWORD` definida en el `Vagrantfile`
  (por defecto `CambiaEstaClave12+`). En el primer login configura el segundo factor (TOTP).
- Los usuarios de rol bajo (`DUENO_UNIDAD`, `RSI`, `LECTOR`) que usan los PoC se crean desde el
  panel de administración, vinculados a los trabajadores del seed demo. Ver
  [../docs/02-credenciales.md](../docs/02-credenciales.md) y
  [../docs/05-reproduccion.md](../docs/05-reproduccion.md).

## Comandos útiles

```bash
vagrant provision     # re-ejecutar el provisioning (idempotente)
vagrant ssh           # entrar a la VM
vagrant halt          # apagar
vagrant destroy       # borrar la VM
```

Dentro de la VM el stack está en `/opt/sistema-rsi`:

```bash
vagrant ssh -c 'cd /opt/sistema-rsi && sudo docker compose ps'
```

## Notas

- La red es *host-only* (`192.168.56.10`), aislada de tu LAN. Si querés enfrentarla a una
  Kali, agregá una segunda VM en la misma red privada de VirtualBox (host-only
  `vboxnet`), replicando el escenario atacante↔víctima del informe.
- El provisioning genera credenciales propias (clave TOTP, password de Postgres) con
  `openssl rand`; no se reutilizan las del laboratorio original.
- Es un entorno de pruebas con datos sintéticos. No lo expongas a redes no confiables.
