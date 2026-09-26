#!/usr/bin/env bash
# Despliegue a Azure App Service desde Azure Cloud Shell (bash).
# Uso:  bash deploy-azure.sh <nombre-webapp> [grupo-de-recursos]
set -euo pipefail
APP="${1:?Indica el nombre de la Web App}"
RG="${2:-rg-reto-api}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "1/4 Compilando frontend (React + Vite)…"
(cd "$DIR/frontend" && npm install --no-audit --no-fund && npm run build)

echo "2/4 Copiando SPA a backend/public…"
rm -rf "$DIR/backend/public" && cp -r "$DIR/frontend/dist" "$DIR/backend/public"

echo "3/4 Instalando dependencias de producción del backend…"
(cd "$DIR/backend" && npm install --omit=dev --no-audit --no-fund)

echo "4/4 Subiendo a Azure App Service ($APP)…"
(cd "$DIR/backend" && rm -f /tmp/app.zip && zip -qr /tmp/app.zip . -x '.env')
az webapp deploy -g "$RG" -n "$APP" --src-path /tmp/app.zip --type zip --clean true -o none
echo "Listo: https://$APP.azurewebsites.net"
