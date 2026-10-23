#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/hostelgh/hostelghar_api"
BACKUP_DIR="/home/hostelgh/hostelghar_api_backups"
TMP_DIR="/home/hostelgh/tmp_api_deploy"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_ARCHIVE="$BACKUP_DIR/backup_${TIMESTAMP}.tar.gz"

echo "=== Starting Hostel Ghar Backend Deployment on cPanel ==="

# 1. Activate cPanel Node.js 20 virtual environment
if [ -f "$HOME/nodevenv/hostelghar_api/20/bin/activate" ]; then
  # shellcheck source=/dev/null
  source "$HOME/nodevenv/hostelghar_api/20/bin/activate"
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 2. Backup current running release
if [ -d "$APP_DIR/dist" ]; then
  echo "Backing up current release..."
  mkdir -p "$BACKUP_DIR"
  tar -czf "$BACKUP_ARCHIVE" -C "$APP_DIR" dist package.json package-lock.json 2>/dev/null || true
  # Keep only the latest 5 backups
  ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f 2>/dev/null || true
fi

# 3. Extract new bundle in isolated staging directory
STAGING_DIR="$TMP_DIR/staging_${TIMESTAMP}"
mkdir -p "$STAGING_DIR"
tar -xzf "$TMP_DIR/deploy-bundle.tar.gz" -C "$STAGING_DIR"

test -f "$STAGING_DIR/dist/index.js" || {
  echo "::error::Staging validation failed: dist/index.js missing in bundle"
  exit 1
}

# 4. Copy new artifacts to APP_DIR preserving .env
mkdir -p "$APP_DIR"
cp -r "$STAGING_DIR/dist" "$APP_DIR/dist.new"
cp "$STAGING_DIR/package.json" "$APP_DIR/package.json.new"
cp "$STAGING_DIR/package-lock.json" "$APP_DIR/package-lock.json.new"

# Atomic swap
rm -rf "$APP_DIR/dist.old"
if [ -d "$APP_DIR/dist" ]; then
  mv "$APP_DIR/dist" "$APP_DIR/dist.old"
fi
mv "$APP_DIR/dist.new" "$APP_DIR/dist"
mv "$APP_DIR/package.json.new" "$APP_DIR/package.json"
mv "$APP_DIR/package-lock.json.new" "$APP_DIR/package-lock.json"

# 5. Install production dependencies
echo "Installing production dependencies..."
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund

# 6. Restart Passenger / cPanel Application
mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

# 7. Cleanup staging artifacts
rm -rf "$STAGING_DIR"
rm -f "$TMP_DIR/deploy-bundle.tar.gz"
rm -f "$TMP_DIR/remote-deploy.sh"

echo "=== Backend Deployment Successfully Completed ==="

