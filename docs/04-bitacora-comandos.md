# Bitácora de comandos — referencia para reconectar

Todas las rutas de claves son relativas al scratchpad de esta sesión de Claude Code:
`/tmp/claude-1000/-home-fqueirolo-TECNOLOGO/b42c7168-aacd-444d-99ec-0bad3c1bdac0/scratchpad/`.

> ⚠️ Ese directorio es temporal (`/tmp`), puede no sobrevivir un reinicio de la máquina WSL.
> Si las claves ya no están ahí, hay que regenerarlas y volver a agregar la pública
> correspondiente (host Proxmox o VM) a mano.

## Variables usadas

```bash
HOSTKEY=.../scratchpad/proxmox-host-key/id_ed25519     # clave al host Proxmox
VMKEY=.../scratchpad/rsi-vm-key/id_ed25519              # clave a la VM rsi-victim
PROXMOX_HOST=<IP_HOST_PROXMOX>
VM_IP=<IP_VM_LABORATORIO>
```

## Conectarse al host Proxmox

```bash
ssh -i $HOSTKEY -o StrictHostKeyChecking=no root@<IP_HOST_PROXMOX>
```

## Conectarse a la VM rsi-victim (jump a través del host)

```bash
ssh -i $VMKEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  -o ProxyCommand="ssh -i $HOSTKEY -o StrictHostKeyChecking=no -W %h:%p root@<IP_HOST_PROXMOX>" \
  root@<IP_VM_LABORATORIO>
```

Helper guardado en `scratchpad/rsi-ssh.sh` (si sigue ahí):

```bash
rsi-ssh.sh 'comando a correr en la VM'
```

## Requisito de red: IP temporal en el host

El host Proxmox no tiene IP propia en `vmbr11` por defecto (es un bridge L2 puro). Para poder
rutear desde el host hacia `<RED_LABORATORIO>/24` (y por lo tanto, para que el jump SSH funcione) hace
falta:

```bash
ssh -i $HOSTKEY root@<IP_HOST_PROXMOX> 'ip addr add <IP_TEMPORAL_HOST>/24 dev vmbr11'
```

Esto **no es persistente** — se pierde al reiniciar el host Proxmox. Si el jump SSH deja de
funcionar, repetir este comando primero (verificar con `ip -br addr show vmbr11`).

## Probar la aplicación vía curl (desde el host Proxmox, no desde esta sesión directamente)

```bash
ssh -i $HOSTKEY root@<IP_HOST_PROXMOX> '
curl -sk https://<IP_VM_LABORATORIO>:8443/healthz
curl -sk -X POST https://<IP_VM_LABORATORIO>:8443/api/v1/auth/login \
  -H "Content-Type: application/json" -H "Origin: https://<IP_VM_LABORATORIO>:8443" \
  -d "{\"correo\":\"admin@rsi.local\",\"password\":\"<PASSWORD_ADMIN>\"}"
'
```

La cookie de sesión (`__Host-rsi_session=...`) viene en el header `Set-Cookie` de la respuesta
de login. Para llamadas autenticadas posteriores, pasarla con `-H "Cookie: __Host-rsi_session=..."`.

## Generar un código TOTP a partir de un secreto (para pasar MFA)

```bash
python3 -c "
import base64, hmac, hashlib, struct, time
def totp(secret_b32, t=None, digits=6, period=30):
    key = base64.b32decode(secret_b32.upper())
    if t is None: t = int(time.time())
    counter = struct.pack('>Q', t // period)
    h = hmac.new(key, counter, hashlib.sha1).digest()
    o = h[-1] & 0x0F
    code = (struct.unpack('>I', h[o:o+4])[0] & 0x7fffffff) % (10 ** digits)
    return str(code).zfill(digits)
print(totp('SECRETO_AQUI'))
"
```

## Gestión de la VM en Proxmox (vmid 118)

```bash
# Estado
qm status 118          # (desde consola/SSH del host; o vía MCP: get_vm_config / get_vms)

# Arrancar / parar
qm start 118
qm shutdown 118

# Ver IP sin depender del guest-agent (cloud-init la imprime al boot)
qm terminal 118         # consola serie, buscar bloque "ci-info"
```

El guest-agent de QEMU no respondía en esta VM pese a tener `agent: 1` en la config — no se
investigó la causa raíz (probablemente no viene preinstalado/habilitado en la plantilla). Por
eso todo el acceso se hizo por SSH directo en vez de `get_vm_ip_addresses` / `execute_vm_command`
del MCP de Proxmox (que además bloquea por política cualquier comando, no solo en esta VM).

## Repo original

El código fuente se subió a la VM como tarball (sin `.git`) porque para cuando se desplegó, el
repo público había pasado a dar 404 en GitHub:

```bash
cd /home/fqueirolo/TECNOLOGO/redteam-rsi/repo
tar --exclude='.git' -czf /tmp/.../scratchpad/sistema-rsi.tar.gz .
scp -i $VMKEY -o ProxyCommand="ssh -i $HOSTKEY -W %h:%p root@<IP_HOST_PROXMOX>" \
  /tmp/.../scratchpad/sistema-rsi.tar.gz root@<IP_VM_LABORATORIO>:/root/sistema-rsi.tar.gz
```

El clon local con historia de git completa (hasta el commit `981026016a79`, 2026-10-14) sigue
en `/home/fqueirolo/TECNOLOGO/redteam-rsi/repo`.
