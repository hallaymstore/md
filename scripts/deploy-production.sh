#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/md}"
REPO="${REPO:-https://github.com/hallaymstore/md.git}"

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git reset --hard origin/main
npm ci --omit=dev

if [ ! -f .env ]; then
  echo "ERROR: $APP_DIR/.env topilmadi. Production .env yarating." >&2
  exit 2
fi

npm run seed
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

echo "MD deploy completed"
curl -fsS http://127.0.0.1:3001/login >/dev/null
echo "Smoke test OK: http://127.0.0.1:3001/login"
