#!/usr/bin/env bash
# Provisioning de la VM víctima. Replica los pasos del despliegue real (ver docs/01).
# Idempotente: se puede re-ejecutar (vagrant provision) sin romper datos existentes.
set -euo pipefail

LAB_IP="${LAB_IP:-192.168.56.10}"
LAB_ADMIN_EMAIL="${LAB_ADMIN_EMAIL:-admin@rsi.local}"
LAB_ADMIN_PASSWORD="${LAB_ADMIN_PASSWORD:-CambiaEstaClave12+}"
SRC=/vagrant/sistema-rsi
APP=/opt/sistema-rsi

echo "==> [0/7] Verificar que el código de sistema-rsi esté presente"
if [ ! -f "$SRC/docker-compose.yml" ]; then
  echo "ERROR: no se encontró $SRC/docker-compose.yml"
  echo "Colocá el código de sistema-rsi en  lab/sistema-rsi/  en el host y reintentá."
  exit 1
fi

echo "==> [1/7] Dependencias del sistema (Docker, Node 24, openssl)"
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg openssl rsync
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi

echo "==> [2/7] Copiar el código a $APP (fuera del synced folder)"
mkdir -p "$APP"
rsync -a --delete --exclude node_modules --exclude .git "$SRC"/ "$APP"/
cd "$APP"

echo "==> [3/7] Generar .env y certificados (solo si no existen)"
if [ ! -f .env ]; then
  cp .env.example .env
  TOTP_KEY=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 16)
  sed -i "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$TOTP_KEY|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASS|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://rsi:$PG_PASS@localhost:5432/rsi|" .env
  sed -i "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://$LAB_IP:8443|" .env
  sed -i "s|^SESSION_ALLOWED_ORIGINS=.*|SESSION_ALLOWED_ORIGINS=https://$LAB_IP:8443|" .env
  sed -i "s|^FRONTEND_BIND_ADDRESS=.*|FRONTEND_BIND_ADDRESS=0.0.0.0|" .env
  {
    echo ""
    echo "BOOTSTRAP_ADMIN_EMAIL=$LAB_ADMIN_EMAIL"
    echo "BOOTSTRAP_ADMIN_PASSWORD=$LAB_ADMIN_PASSWORD"
  } >> .env
fi
cp -f .env backend/.env
mkdir -p infrastructure/nginx/certs
if [ ! -f infrastructure/nginx/certs/server.crt ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout infrastructure/nginx/certs/server.key \
    -out infrastructure/nginx/certs/server.crt \
    -subj "/CN=$LAB_IP" -addext "subjectAltName=IP:$LAB_IP,DNS:localhost" >/dev/null 2>&1
fi

echo "==> [4/7] Levantar PostgreSQL"
docker compose up -d postgres
# Esperar a que el healthcheck de postgres esté 'healthy'
for i in $(seq 1 30); do
  st=$(docker inspect -f '{{.State.Health.Status}}' sistema-rsi-postgres 2>/dev/null || echo starting)
  [ "$st" = "healthy" ] && break
  sleep 2
done

echo "==> [5/7] Dependencias del backend + migraciones + datos demo"
set -a; . ./.env; set +a
pushd backend >/dev/null
npm ci --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
# crear-admin se autoprotege si ya existen usuarios; no fallar en re-provision
node scripts/crear-admin.mjs || echo "   (admin ya existe, se omite)"
node scripts/seed-demo.mjs || echo "   (seed ya aplicado, se omite)"
popd >/dev/null

echo "==> [6/7] Construir y levantar el stack completo"
docker compose up -d --build

echo "==> [7/7] Estado"
docker compose ps
cat <<EOF

================================================================
 Laboratorio sistema-rsi listo.
   URL:   https://$LAB_IP:8443   (aceptar el certificado autofirmado)
   Admin: $LAB_ADMIN_EMAIL  /  (la contraseña LAB_ADMIN_PASSWORD del Vagrantfile)

 El admin tiene MFA obligatorio: en el primer login se configura el TOTP.
 Para los usuarios de rol bajo (DUENO_UNIDAD, RSI, LECTOR) usados en los PoC,
 crearlos desde el panel de administración vinculándolos a los trabajadores del
 seed demo (ver docs/02-credenciales.md y docs/05-reproduccion.md).
================================================================
EOF
