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
  set +u
  export CL_VIRTUAL_ENV="${CL_VIRTUAL_ENV:-}"
  # shellcheck source=/dev/null
  source "$HOME/nodevenv/hostelghar_api/20/bin/activate"
  set -u
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
if [ -f "$STAGING_DIR/app.js" ]; then
  cp "$STAGING_DIR/app.js" "$APP_DIR/app.js.new"
fi
if [ -f "$STAGING_DIR/ecosystem.config.cjs" ]; then
  cp "$STAGING_DIR/ecosystem.config.cjs" "$APP_DIR/ecosystem.config.cjs.new"
fi
if [ -d "$STAGING_DIR/node_modules" ]; then
  cp -r "$STAGING_DIR/node_modules" "$APP_DIR/node_modules.new"
fi

# Atomic swap
rm -rf "$APP_DIR/dist.old"
if [ -d "$APP_DIR/dist" ]; then
  mv "$APP_DIR/dist" "$APP_DIR/dist.old"
fi
mv "$APP_DIR/dist.new" "$APP_DIR/dist"
mv "$APP_DIR/package.json.new" "$APP_DIR/package.json"
mv "$APP_DIR/package-lock.json.new" "$APP_DIR/package-lock.json"
if [ -f "$APP_DIR/app.js.new" ]; then
  mv "$APP_DIR/app.js.new" "$APP_DIR/app.js"
fi
if [ -f "$APP_DIR/ecosystem.config.cjs.new" ]; then
  mv "$APP_DIR/ecosystem.config.cjs.new" "$APP_DIR/ecosystem.config.cjs"
fi
if [ -d "$APP_DIR/node_modules.new" ]; then
  rm -rf "$APP_DIR/node_modules.old"
  if [ -d "$APP_DIR/node_modules" ]; then
    mv "$APP_DIR/node_modules" "$APP_DIR/node_modules.old"
  fi
  mv "$APP_DIR/node_modules.new" "$APP_DIR/node_modules"
  rm -rf "$APP_DIR/node_modules.old" 2>/dev/null || true
fi

# 5. Install production dependencies (if not pre-packaged)
echo "Verifying production dependencies..."
cd "$APP_DIR"
if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "Installing production dependencies on server..."
  npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund || true
else
  echo "Production node_modules verified in place."
fi

# 6. Restart PM2 Process & Passenger / cPanel Application
echo "Triggering application restart..."
mkdir -p "$APP_DIR/logs" "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

# If PM2 is available (global or in local node_modules), manage process with PM2
PM2_CMD=""
if command -v pm2 >/dev/null 2>&1; then
  PM2_CMD="pm2"
elif [ -x "$APP_DIR/node_modules/.bin/pm2" ]; then
  PM2_CMD="$APP_DIR/node_modules/.bin/pm2"
fi

if [ -n "$PM2_CMD" ] && [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
  echo "Found PM2 ($PM2_CMD); reloading/starting hostelghar-api..."
  cd "$APP_DIR"
  if "$PM2_CMD" describe hostelghar-api >/dev/null 2>&1; then
    echo "Reloading existing hostelghar-api process under PM2..."
    "$PM2_CMD" reload ecosystem.config.cjs --env production --update-env || "$PM2_CMD" restart ecosystem.config.cjs --env production || true
  else
    echo "Starting hostelghar-api under PM2..."
    "$PM2_CMD" start ecosystem.config.cjs --env production || true
  fi
  "$PM2_CMD" save 2>/dev/null || true
fi

# CloudLinux selectorctl fallback if present on server
if command -v cloudlinux-selector >/dev/null 2>&1; then
  cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" || true
elif [ -x /usr/sbin/cloudlinux-selector ]; then
  /usr/sbin/cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" || true
fi

# 7. Cleanup staging artifacts
rm -rf "$STAGING_DIR"
rm -f "$TMP_DIR/deploy-bundle.tar.gz"
rm -f "$TMP_DIR/remote-deploy.sh"

echo "=== Backend Deployment Successfully Completed ==="

