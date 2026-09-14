# ──────────────────────────────────────────────────────────────────────────────
# Hostel Ghar — Production Dockerfile
# Multi-stage build: deps → build → runtime
# Produces a minimal, non-root, health-checked production image.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install production dependencies only ────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy dependency manifests first for layer caching — only re-installs when
# package.json or package-lock.json change, not on every source edit.
COPY package.json package-lock.json ./

# --omit=dev excludes devDependencies (typescript, eslint, prettier, etc.)
# --ignore-scripts prevents arbitrary postinstall scripts from running during build
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: Build the TypeScript source ─────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts

# Copy source code after deps are installed (better layer caching)
COPY src/ ./src/

RUN npm run build

# ── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Build-time metadata for deployment traceability:
#   docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) ...
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.source="https://github.com/CodynexNepal/HostelGhar"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

# Security: install only what's needed, remove caches
RUN apk add --no-cache curl tini \
    && rm -rf /var/cache/apk/*

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from deps stage (no devDependencies)
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy compiled JavaScript from build stage
COPY --from=build --chown=appuser:appgroup /app/dist ./dist

# Copy package.json for the start script
COPY --chown=appuser:appgroup package.json ./

# Embed build metadata as environment variables for runtime traceability
ENV GIT_COMMIT=${GIT_COMMIT}
ENV BUILD_TIME=${BUILD_TIME}
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user before exposing ports or setting entrypoint
USER appuser

EXPOSE 3000

# Health check uses the existing /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# tini handles PID 1 correctly: forwards signals, reaps zombies.
# Without it, Node.js as PID 1 won't handle SIGTERM from Docker gracefully.
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "dist/index.js"]
