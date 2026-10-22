#!/usr/bin/env bash
set -euo pipefail

BACKUP="$HOME/hostelghar-backup-${DEPLOY_SHA}.tar.gz"

if [ ! -s "$BACKUP" ]; then
  echo "No backup found at $BACKUP; automatic rollback is unavailable."
  exit 1
fi

source "$HOME/nodevenv/hostelghar_api/20/bin/activate"

echo "Restoring previous release from $BACKUP into $APP_DIR..."
tar -xzf "$BACKUP" -C "$APP_DIR"

if ! (cd "$APP_DIR" && npm ci --omit=dev); then
  echo "Rollback restored files, but dependency installation failed."
  exit 1
fi

mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

echo "Previous application release restored successfully."
