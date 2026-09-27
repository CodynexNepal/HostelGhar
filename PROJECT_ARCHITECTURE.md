# HostelGhar Project Architecture

HostelGhar is an Express, TypeScript, TypeORM, PostgreSQL, Redis, BullMQ, and Socket.io backend. The codebase follows a layered architecture with factory composition and event-driven side effects.

## Request Flow

`HTTP request -> route -> middleware/decorator -> controller -> service -> repository -> TypeORM/PostgreSQL`

Side effects use:

`service/controller -> eventDispatcher -> BullMQ queues + Socket.io broadcasts + audit jobs`

## Layers

### Routes

Routes live in `src/routes/**`. They define URL shape and middleware order only.

### Decorators

Request decorators live in `src/decorators/**`.

Current decorators:

- `requireParam`: rejects missing or invalid route params before controller logic.
- `getRequiredParam`: gives controllers a strict `string` after validation.
- `idempotencyKey`: caches successful responses for retried POST requests using `Idempotency-Key`.

### Controllers

Controllers live in `src/controller/**`. They translate HTTP to service calls and return JSON. They should not contain TypeORM queries.

### Services

Services live in `src/services/**`. They own business rules, event dispatching, cache invalidation, and orchestration across repositories.

### Repositories

Repositories live in `src/repository/**`. They are the only layer that should talk directly to TypeORM repositories or query builders.

### Factories

Factories live in `src/factory/**`. They compose dependencies so routes do not instantiate repositories/services manually.

## Security Architecture

- `helmet` sets HTTP security headers.
- `corsConfig` centralizes allowed origins, methods, credentials, and headers.
- `app.disable('x-powered-by')` hides Express from response headers.
- `app.set('trust proxy', 1)` supports proxy-aware client IP detection.
- `globalRateLimiter` protects the whole API.
- `authRateLimiter` protects login/register.
- `sensitiveActionLimiter` protects reset/password/payment actions.
- `bookingCreationLimiter` protects booking creation by user/IP.
- JWT auth middleware supports Bearer token and cookie token.
- RBAC middleware restricts endpoints by role.

## Response Compression

`src/performance/http/compression.ts` compresses eligible HTTP responses with **Brotli** (`Content-Encoding: br`) and falls back to gzip/deflate. It is registered by `registerPerformanceMiddleware` before the routes, so every handler benefits.

- Negotiation: `Accept-Encoding` quality values decide first; the server preference `br` → `gzip` → `deflate` breaks ties.
- Encoding runs on the libuv threadpool (async `zlib.brotliCompress`), so large JSON bodies never block the event loop.
- Only worthwhile responses are encoded: body ≥ `COMPRESSION_THRESHOLD_BYTES`, compressible content type, no `Cache-Control: no-transform`, status not 1xx/204/205/304, method not `HEAD`.
- Negotiated responses carry `Vary: Accept-Encoding` (caches keep variants apart) and a `Content-Length` that matches the bytes actually sent.
- A client can opt out per request with `x-no-compression: 1`.
- Failures are silent: if compression errors or does not shrink the body, the original bytes are sent.

| Env var                        |   Default | Purpose                                              |
| ------------------------------ | --------: | ---------------------------------------------------- |
| `COMPRESSION_ENABLED`          |    `true` | Master switch                                        |
| `COMPRESSION_BROTLI_QUALITY`   |       `5` | Brotli quality 0-11 (dynamic-content sweet spot)     |
| `COMPRESSION_GZIP_LEVEL`       |       `6` | gzip/deflate zlib level 0-9                          |
| `COMPRESSION_THRESHOLD_BYTES`  |    `1024` | Bodies smaller than this stay uncompressed           |
| `COMPRESSION_MAX_BUFFER_BYTES` | `2097152` | Above this the response streams through uncompressed |

Bandwidth savings are visible in `/metrics` as `http_responses_compressed_total{encoding}` and `http_compression_saved_bytes_total{encoding}`.

## Event-Driven Architecture

The `eventDispatcher` bridges synchronous domain logic with asynchronous work:

- Emits local domain events.
- Broadcasts Socket.io events to user, role, or hostel rooms.
- Queues audit events.
- Queues email jobs.

Queues are created in `src/queue/queue.factory.ts` with BullMQ retry/backoff defaults.

## Email Architecture

Email templates live in `src/templates/email.template.ts`.

Flow:

`AuthService -> eventDispatcher.queueEmail -> emailQueue -> EmailWorker -> EmailSenderService`

`EmailSenderService` is the adapter boundary. It currently uses `smtpConfig` and provides a safe disabled-SMTP fallback for development.

## Database Architecture

TypeORM entities are normalized around core domain tables:

- `users`
- `hostels`
- `residents`
- `bookings`
- `leave_types`
- `leave_requests`
- `fees`

PostgreSQL pooling is configured in `src/configs/psqlDb.config.ts` through TypeORM `extra`.

## API Surface By HTTP Verb

- `GET`: list/read hostels, bookings, analytics, fees, leaves.
- `POST`: create users, login, create hostel, create booking, apply leave, generate fees.
- `PUT`: assign hostel owner, change password.
- `PATCH`: reset password, update booking status, update leave status, record fee payment.
- `DELETE`: cancel booking.

## Engineering Rules

- Keep TypeORM in repositories.
- Keep business rules in services.
- Keep controllers thin.
- Keep routes declarative.
- Use DTOs for request bodies.
- Use decorators/middleware for cross-cutting request guards.
- Emit domain events for async work and real-time updates.
- Use idempotency for retryable unsafe POST operations.
