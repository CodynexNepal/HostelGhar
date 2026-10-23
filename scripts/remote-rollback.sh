#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/hostelgh/hostelghar_api"
BACKUP_DIR="/home/hostelgh/hostelghar_api_backups"

echo "=== Starting Hostel Ghar Backend Rollback on cPanel ==="

LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -n 1 || echo "")

if [ -z "$LATEST_BACKUP" ] || [ ! -f "$LATEST_BACKUP" ]; then
  echo "::error::No backup archive found in $BACKUP_DIR to rollback to!"
  exit 1
fi

echo "Restoring from $LATEST_BACKUP into $APP_DIR..."
tar -xzf "$LATEST_BACKUP" -C "$APP_DIR"

if [ -f "$HOME/nodevenv/hostelghar_api/20/bin/activate" ]; then
  set +u
  export CL_VIRTUAL_ENV="${CL_VIRTUAL_ENV:-}"
  # shellcheck source=/dev/null
  source "$HOME/nodevenv/hostelghar_api/20/bin/activate"
  set -u
fi

cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund || true

mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

echo "=== Backend Rollback Successfully Completed ==="

