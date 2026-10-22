#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="$HOME/hostelghar-deploy-${DEPLOY_SHA}.tar.gz"
BACKUP="$HOME/hostelghar-backup-${DEPLOY_SHA}.tar.gz"
STAGING="$HOME/hostelghar-staging-${DEPLOY_SHA}"

test -s "$ARCHIVE"
test -d "$APP_DIR"
test -f "$APP_DIR/package.json"
test -f "$APP_DIR/package-lock.json"

# Use the cPanel-provided Node environment
source "$HOME/nodevenv/hostelghar_api/20/bin/activate"

node --version
npm --version

# Preserve the previous production build and manifests for rollback
tar -czf "$BACKUP" \
  -C "$APP_DIR" \
  dist package.json package-lock.json

rm -rf "$STAGING"
mkdir -p "$STAGING"
tar -xzf "$ARCHIVE" -C "$STAGING"

test -f "$STAGING/dist/index.js"
test -f "$STAGING/package.json"
test -f "$STAGING/package-lock.json"

# Do not replace the production .env file.
# Keep the existing cPanel app root and startup configuration.
cp -a "$STAGING/dist" "$APP_DIR/dist.new"
mv "$APP_DIR/dist" "$APP_DIR/dist.previous"
mv "$APP_DIR/dist.new" "$APP_DIR/dist"

cp "$STAGING/package.json" "$APP_DIR/package.json.new"
cp "$STAGING/package-lock.json" "$APP_DIR/package-lock.json.new"
mv "$APP_DIR/package.json.new" "$APP_DIR/package.json"
mv "$APP_DIR/package-lock.json.new" "$APP_DIR/package-lock.json"

if ! (
  cd "$APP_DIR"
  npm ci --omit=dev
); then
  echo "Production dependency installation failed. Restoring previous version..."
  mv "$APP_DIR/dist.previous" "$APP_DIR/dist"
  tar -xzf "$BACKUP" -C "$APP_DIR"
  exit 1
fi

# Passenger/cPanel monitors this restart marker
mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

echo "Deployment files installed successfully for $DEPLOY_SHA"

rm -rf "$STAGING"
rm -f "$ARCHIVE"

