# Hostel Ghar — Production CI/CD & Architecture Documentation

## 1. System Architecture Overview

Hostel Ghar is an enterprise Node.js/TypeScript backend powered by Express, TypeORM, PostgreSQL, Redis, BullMQ, and Socket.io.

```
┌─────────────────────────────────────────────────────────────┐
│                    API Client Requests                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             3-Level Caching Architecture                    │
│                                                             │
│  [Level 1: Local In-Memory LRU Cache] (< 0.1ms)            │
│         │ (Miss)                                            │
│         ▼                                                   │
│  [Level 2: Distributed Redis Cache]   (~1-3ms)              │
│         │ (Miss)                                            │
│         ▼                                                   │
│  [Level 3: PostgreSQL Database]       (~10-50ms)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 3-Level Caching Layer

The application implements a 3-tier caching hierarchy in `src/utils/cache.util.ts`:

1. **Level 1 (L1) — In-Memory LRU Cache (`src/utils/lru-cache.util.ts`)**:
   - In-process `Map`-based LRU cache with $O(1)$ read/write/evict.
   - Max 2,000 items in memory with TTL support to prevent memory leaks in Node.js.
   - Sub-millisecond response time ($< 0.1$ms).

2. **Level 2 (L2) — Distributed Redis Cache (`src/configs/redis.config.ts`)**:
   - Shared caching across distributed instances and workers.
   - Preserves cached state across container restarts and horizontal scale-outs.

3. **Level 3 (L3) — Database Loader (PostgreSQL / TypeORM)**:
   - Queries executed on cache misses and automatically backfills L2 (Redis) and L1 (LRU RAM).

### Response Cache Indicators

Every cached endpoint returns cache telemetry:

```json
{
  "success": true,
  "isCached": true,
  "cacheLevel": "L1",
  "data": [ ... ]
}
```

---

## 3. Standardized Pagination Architecture

Implemented in `src/utils/pagination.util.ts`:

- **Input Normalization**:
  `normalizePagination({ page: req.query.page, limit: req.query.limit })` clamps `limit` between 1 and 100 (default: 20) and calculates `skip` and `take`.
- **Response Builder**:
  `createPaginatedResponse(items, totalCount, { page, limit }, { isCached, cacheLevel })` produces:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "totalItems": 150,
    "currentPage": 1,
    "totalPages": 8,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "isCached": true,
  "cacheLevel": "L2"
}
```

---

## 4. Production CI/CD Pipeline Flow

GitHub Actions workflows are organized into `.github/workflows/`:

```
Developer Push / PR
       │
       ├─── PR: ci.yml ─────────────────────────────────────┐
       │    ├── Parallel Checks: ESLint + Prettier + TSC   │
       │    ├── Test: Vitest + Postgres & Redis services    │
       │    └── Build: TypeScript compilation to dist/      │
       │                                                    │
       ├─── PR: security.yml ───────────────────────────────┤
       │    ├── npm audit (high/critical)                   │
       │    ├── Lockfile integrity check                    │
       │    └── TruffleHog secret scanning                  │
       │                                                    │
       └─── Merge to main: docker.yml ──────────────────────┘
            ├── Multi-stage Docker Build (Alpine, non-root)
            ├── Tag with immutable Git SHA: ghcr.io/org/hostelghar:<sha>
            ├── Push to GitHub Container Registry (GHCR)
            ├── Trivy Container Vulnerability Scan (SARIF output)
            └── Ready for Deployment (deploy.yml)
```

---

## 5. Deployment & Rollback Strategy

- **Immutable Image Tagging**: Every production release runs the exact immutable Docker image tagged with the Git commit SHA (e.g. `ghcr.io/codynexnepal/hostelghar:8f31c7a...`).
- **Health Verification**: Post-deployment executes an active HTTP health probe against `/health` (HTTP 200 required).
- **Automated Rollback**: If health checks fail after 10 retries, `scripts/rollback.sh` immediately restores the previous known-good image ID without rebuilding.

---

## 6. Required GitHub Secrets & Environment Configuration

Configure the following secrets in GitHub Repository Settings (`Settings -> Secrets and variables -> Actions`):

| Secret Name                                      | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| `DATABASE_URL`                                   | PostgreSQL connection string              |
| `REDIS_URL`                                      | Redis connection URL                      |
| `ACCESS_TOKEN_SECRET`                            | 64-byte hex JWT access token secret       |
| `REFRESH_TOKEN_SECRET`                           | 64-byte hex JWT refresh token secret      |
| `CLOUDINARY_CLOUD_NAME`                          | Cloudinary storage                        |
| `CLOUDINARY_API_KEY`                             | Cloudinary storage API Key                |
| `CLOUDINARY_API_SECRET`                          | Cloudinary storage API Secret             |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`          | SMTP email dispatch                       |
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` | VPS Deployment credentials (if using SSH) |
