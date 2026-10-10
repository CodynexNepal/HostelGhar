# HostelGhar API Documentation

Base URL: `/api/v1/hostel-ghar`

All protected endpoints accept `Authorization: Bearer <accessToken>` or the configured auth cookie. Mutating booking creation requires `Idempotency-Key`.

## Security

- Helmet security headers are applied globally.
- CORS is centralized in `src/configs/cors.config.ts`.
- Global rate limiting applies before routes.
- Auth routes use strict brute-force rate limiting.
- Booking creation uses user-scoped rate limiting and idempotency.
- Sensitive password and fee actions use the sensitive action limiter.

## Response Compression

Responses are compressed with **Brotli** (`Content-Encoding: br`) when the client sends `Accept-Encoding: br`, and fall back to `gzip`/`deflate` otherwise. Clients that send no `Accept-Encoding` (or `identity`) receive uncompressed bodies, so no client changes are required — browsers and `fetch`/`axios` decompress automatically. Send `x-no-compression: 1` to opt out for a single request.

Large cached values are also stored Brotli-compressed in Redis via the `brotli` npm package (`src/utils/brotli.util.ts`), cutting Redis memory and fetch bandwidth. The asynchronous resident CSV import job carries its parsed rows Brotli-packed through BullMQ the same way — transparent to clients, and the import endpoints/contracts are unchanged.

## Auth

### POST `/auth/register`

Creates a user account.

### POST `/auth/login`

Authenticates a user and sets auth cookies.

### POST `/auth/forgot-password`

Queues a password reset email. Response is intentionally generic.

### PATCH `/auth/reset-password`

Resets password using the emailed token.

### PUT `/auth/change-password`

Authenticated password change.

### GET `/auth/me`

Returns the currently-authenticated user including `role`. Requires a valid
access token (`Authorization: Bearer <token>` OR `access_token` cookie).

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "firstName": "...", "lastName": "...", "role": "owner" }
  }
}
```

Frontend role redirect: after login/register, either use
`data.user.role` from the login response OR call `GET /auth/me` on app boot,
then redirect: `admin → /admin/dashboard`, `owner → /owner/dashboard`,
`resident → /resident/dashboard`, `user → /dashboard`.

### POST `/auth/refresh`

Rotates tokens using the `refresh_token` cookie (or `refreshToken` body field).

### POST `/auth/logout`

Clears auth cookies and revokes the stored refresh token. Requires auth.

## Admin

Requires role: `admin`.

### GET `/admin/dashboard`

Single-call bootstrap for the admin dashboard page — stats cards, pending
approvals, hostels spotlight and platform health. `?refresh=1` (or
`?refresh=true`) bypasses L1/L2 and re-reads the database, which is what the
dashboard's **Refresh** button should send.

Cached (L1 30s / L2 120s) and served from `isCached` + `cacheLevel`. Blocks:

- `stats`: `totalHostels`, `totalResidents`, `mrr` (ACTIVE plans, yearly plans
  amortized over 12 months; lapsed `endDate` rows excluded) and `occupancy`
  (`totalBeds`, `occupiedBeds`, `availableBeds`, `rate`). Occupancy uses the bed
  inventory and falls back to `rooms.capacity` when no beds exist yet — same
  rule as `GET /analytics/owner/summary`.

  MRR ships with diagnostics so a zero card explains itself instead of showing a
  bare `Rs. 0`:

  | Field            | Meaning                                                   |
  | ---------------- | --------------------------------------------------------- |
  | `mrr`            | Monthly recurring revenue from active owner subscriptions |
  | `mrrBasis`       | Always `activeSubscriptions`                              |
  | `mrrCurrency`    | `NPR`                                                     |
  | `mrrPaidPlans`   | ACTIVE plans actually contributing to `mrr`               |
  | `mrrFreePlans`   | ACTIVE plans priced 0 (the FREE tier)                     |
  | `mrrLapsedPlans` | ACTIVE rows whose `endDate` already passed                |

  `mrr: 0` with `mrrFreePlans > 0` means every owner is on FREE — MRR starts
  moving once a paid upgrade request in `pendingApprovals` is approved.

- `pendingApprovals`: `count` of `PENDING` subscription payment proofs awaiting
  review, plus the `reviewUrl` for the review queue.
- `recentHostels`: newest hostels with their assigned `owner` (`null` when
  unassigned).
- `health`: `monthlyRevenue` (current billing month collected), `totalRevenue`,
  `pendingDues`, `rooms`, `bedsOccupied`, `activePlans`, `currency` and
  `collectionRate` for the month.

```json
{
  "success": true,
  "isCached": false,
  "cacheLevel": "L3",
  "data": {
    "users": 5,
    "hostels": 4,
    "activeResidents": 37,
    "pendingBookings": 1,
    "pendingLeaves": 0,
    "unpaidFees": 2,
    "paidAmount": 50000,
    "outstandingAmount": 2500,
    "generatedAt": "2026-05-10T00:00:00.000Z",
    "stats": {
      "totalHostels": 4,
      "totalResidents": 37,
      "mrr": 3199,
      "occupancy": { "totalBeds": 10, "occupiedBeds": 4, "availableBeds": 6, "rate": 40 }
    },
    "pendingApprovals": { "count": 0, "reviewUrl": "/admin/subscriptions" },
    "recentHostels": [
      {
        "id": "…",
        "name": "IBInfinity Boys Hostel",
        "type": "BOYS",
        "city": "Kathmandu",
        "logoUrl": null,
        "createdAt": "2026-05-01T00:00:00.000Z",
        "owner": null
      }
    ],
    "health": {
      "monthlyRevenue": 12000,
      "totalRevenue": 50000,
      "pendingDues": 2500,
      "rooms": 9,
      "bedsOccupied": 4,
      "activePlans": 2,
      "currency": "NPR",
      "collectionRate": 80
    }
  }
}
```

The legacy summary fields (`users`, `hostels`, `activeResidents`,
`pendingBookings`, `pendingLeaves`, `unpaidFees`, `paidAmount`,
`outstandingAmount`) stay at the top level of `data` for existing clients.

### GET `/admin/dashboard/summary`

Legacy alias — returns the **exact same payload** as `/admin/dashboard`,
`stats.mrr` included, and honours `?refresh=1`. It delegates to the same service
call, so all three admin dashboard routes share one cache entry and can never
disagree with each other.

### GET `/admin/hostels`

Lists hostels with pagination.

### POST `/admin/hostels`

Creates a hostel.

### PUT `/admin/hostels/:id/owner`

Assigns an owner to a hostel.

### POST `/admin/hostels/:id/suspend`

Suspends a hostel (admin only). Body is optional: `{ "reason": "..." }` (max 500
chars). Sending no body suspends without a reason. Idempotent — re-suspending a
suspended hostel just refreshes `suspendedAt` / `reason`. Suspended hostels are
hidden from the public `GET /hostels` listing but no data is deleted.

### POST `/admin/hostels/:id/reactivate`

Reactivates a suspended hostel (admin only). No body. Clears `suspendedAt` /
`suspendReason` and restores the hostel to the public listing.

### GET `/admin/settings`

Returns all platform settings sections (`general`, `billing`, `access`,
`alerts`, `system`) with persisted values merged over built-in defaults.

### GET `/admin/settings/:section`

Returns one section (`general | billing | access | alerts | system`).
Unknown section → `400`. Example `GET /admin/settings/general`:

```json
{
  "success": true,
  "data": {
    "platformName": "Hostel Ghar",
    "tagline": "Nepal's Leading Smart Hostel Management System",
    "currency": "NPR",
    "timezone": "Asia/Kathmandu (UTC+5:45)",
    "supportEmail": "support@hostelghar.com",
    "supportPhone": "+977-1-4445555",
    "officeAddress": "Putalisadak, Kathmandu, Bagmati, Nepal"
  }
}
```

### PUT `/admin/settings/general`

Partial update — any subset of `platformName`, `tagline`, `currency`,
`timezone`, `supportEmail`, `supportPhone`, `officeAddress`. Returns the
merged section. Example:

```bash
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"platformName":"Hostel Ghar","currency":"NPR"}' \
  $BASE/admin/settings/general
```

### PUT `/admin/settings/billing`

Partial update — `standardPlanPrice`, `enterprisePlanPrice`,
`freeTierResidentCap`, `gracePeriodDays`, `allowQrCheckout`,
`autoRemindRenewals`.

### PUT `/admin/settings/access`

Partial update — `allowPublicHostelSignup`, `requireHostelApproval`,
`allowResidentSelfInvite`, `requireAdmin2FA`, `sessionLifetimeDays`.

### PUT `/admin/settings/alerts`

Partial update — `overdueAlertThreshold`, `notifyOnSubscriptionProof`,
`dailyDigestEmail`, `smsGatewayProvider`.

### PUT `/admin/settings/system`

Partial update — `maintenanceMode`, `maintenanceMessage`.

Settings persist in the `platform_settings` table (one row per section,
`migration 1795000000000`) and are cached L1 30s / L2 120s.

## Analytics

### GET `/analytics/admin/summary`

Requires role: `admin`. Returns system counts and fee totals — now the full
admin dashboard payload (identical to `GET /admin/dashboard`, MRR included).

### GET `/analytics/admin/dashboard`

Alias of `GET /admin/dashboard` for analytics clients on this router — same
payload, same `?refresh=1` cache bypass.

### GET `/analytics/owner/summary`

Requires role: `owner` or `admin`. Returns an owner-scoped analytics payload.

The response includes the legacy summary fields (`hostels`, `activeResidents`,
`pendingBookings`, `pendingLeaves`, and `outstandingAmount`) plus these UI-ready
sections:

- `hostelOptions`: hostels for the **All hostels** selector.
- `totals` and `occupancy`: room/bed inventory, occupancy rate, current-month
  collected and pending amounts.
- `paymentStatus`: current-month billed, collected, pending, collection rate,
  and a breakdown for every fee status.
- `roomOccupancy`: full/partial/available/maintenance room counts (the
  per-room `capacityByRoom` rows were dropped to keep the payload lean).
- `mrr` and `planMix`: owner-scoped subscription revenue (yearly plans are
  amortized over 12 months; ACTIVE rows whose endDate already passed are
  reported as lapsed, not counted as revenue) plus paid/free/lapsed counts,
  share percentages and the hostels covered by an active plan.
- `finance.allTime`: all-time `collected` (SUM paidAmount) and `outstanding`
  (SUM totalPayable - paidAmount) across every fee.
- `feeLifecycle`: fee counts per payment status (paid / pending / overdue /
  partiallyPaid) and the total.
- `occupancyByHostel`: per-hostel bed occupancy (bed inventory first, room
  capacity fallback) plus active residents — powers the occupancy chart.
- `topHostelsByResidents`: top 5 hostels by active residents.
- `trends.revenue` and `trends.residentGrowth`: rolling 12-month chart series.

`monthlyExpenses`, `netRevenue`, and metrics named in `unavailableMetrics` are
`null` or unavailable until expense, maintenance-ticket, and resident-profile
data are stored by the API. The endpoint never returns fabricated values for
those cards.

## Booking

### POST `/bookings`

Requires role: `user`. Creates a booking request.

Required header:

```http
Idempotency-Key: unique-client-request-id
```

Body:

```json
{
  "hostelId": "hostel-uuid",
  "checkInDate": "2026-09-01",
  "remarks": "Need single room"
}
```

### GET `/bookings/my-bookings`

Requires role: `user`. Lists authenticated user's bookings.

### GET `/bookings/hostels/:hostelId`

Requires role: `owner` or `admin`. Lists booking requests for a hostel.

### PATCH `/bookings/:id/status`

Requires role: `owner` or `admin`. Updates booking status.

### DELETE `/bookings/:id`

Requires role: `user`. Cancels the authenticated user's booking.

## Hostels

### GET `/hostels`

Lists hostels.

### GET `/hostels/:id`

Gets hostel detail.

### GET `/hostels/:id/residents`

Requires role: `admin`, `owner`, or `resident`.

- `admin`/`owner`: lists ALL active residents (owner must own the hostel).
- `resident`: self-scoped — returns ONLY your own row (`scope: "self"`) when
  you are an active resident of that hostel; otherwise 403. Use this for
  "My Room" instead of `GET /resident/me` if you already have the hostelId.
  Each row answers: which HOSTEL → which RESIDENT lives in which FLAT/FLOOR,
  which ROOM number and which BED number.
  (`flat` is an alias of `Room.floor` — no separate flat column exists.)

```json
{
  "success": true,
  "data": [
    {
      "id": "resident-uuid",
      "fullName": "Ram Sharma",
      "email": "ram@mail.com",
      "hostelId": "hostel-uuid",
      "hostelName": "Sunrise Hostel",
      "hostel": {
        "id": "hostel-uuid",
        "name": "Sunrise Hostel",
        "type": "BOYS",
        "city": "Ktm",
        "address": "..."
      },
      "roomNumber": "101",
      "bedNumber": "B2",
      "roomType": "DOUBLE",
      "floor": 1,
      "flat": 1
    }
  ]
}
```

### GET `/hostels/:id/leave-types`

Lists leave policies for a hostel.

### GET `/hostels/:hostelId/facilities`

Lists normalized facilities for a hostel. `hostelId` comes from the URL param.

```json
{
  "success": true,
  "data": [
    {
      "id": "junction-uuid",
      "title": "Security",
      "slug": "security",
      "facilityId": "catalog-uuid",
      "description": "24 security with guards",
      "tag": "Included",
      "clientKey": "security-mu5ofghs"
    }
  ]
}
```

### PUT `/hostels/:hostelId/facilities`

Full sync (replace) — send the whole frontend editor list; DB ends matching it.
Requires role: `owner` or `admin`. Frontend `id` maps to `clientKey`.

```json
{
  "facilities": [
    {
      "id": "security-mu5ofghs",
      "title": "Security",
      "description": "24 security with guards",
      "tag": "Included"
    }
  ]
}
```

### POST `/hostels/:hostelId/facilities`

Add (or update) one facility. Body: `{ "id?", "title", "description?", "tag?" }`.

### DELETE `/hostels/:hostelId/facilities/:facilityKey`

Removes a facility. `:facilityKey` accepts the junction UUID **or** the frontend
`clientKey` (e.g. `security-mu5ofghs`).

## Bed

Requires role: `owner` or `admin`.

### POST `/beds`

Creates a bed inside the selected room in a hostel. In the owner workflow, the room is identified by its room number such as `2011`, and the selected room is validated against the hostel before the bed is created. Duplicate bed numbers in the same hostel + room are rejected.

Body:

```json
{
  "hostelId": "<hostel-uuid>",
  "floor": 2,
  "roomNumber": "2011",
  "bedNumber": "B1",
  "status": "AVAILABLE",
  "rentAmount": 12000
}
```

| Field        | Type   | Required | Description                                                     |
| ------------ | ------ | -------- | --------------------------------------------------------------- |
| `hostelId`   | string | Yes      | Hostel UUID where the room belongs.                             |
| `floor`      | number | Yes      | Floor number for the room.                                      |
| `roomNumber` | string | Yes      | Room number inside the hostel, such as `2011`.                  |
| `bedNumber`  | string | Yes      | Bed identifier inside the room, such as `B1`.                   |
| `status`     | string | No       | Bed status: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`. |
| `rentAmount` | number | No       | Optional monthly rent amount for the bed.                       |

Valid values for `status`:

- `AVAILABLE`
- `OCCUPIED`
- `RESERVED`
- `MAINTENANCE`

Validation rules:

- `hostelId` must be a valid UUID
- `floor` is required and should match the floor number for the room
- `roomNumber` is required and should match the room number in the hostel, such as `2011`
- `bedNumber` is required and limited to 20 characters
- `rentAmount` must be a non-negative number if supplied

Example success response:

```json
{
  "success": true,
  "message": "Bed added successfully",
  "data": {
    "id": "<bed-uuid>",
    "hostelId": "<hostel-uuid>",
    "roomId": "<room-uuid>",
    "bedNumber": "B1",
    "status": "AVAILABLE",
    "rentAmount": 12000,
    "ownerId": "<owner-uuid>",
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": "2026-09-22T10:00:00.000Z"
  }
}
```

Common error responses:

- `404` — room not found or does not belong to the logged-in owner
- `400` — selected room does not match the selected hostel
- `409` — bed number already exists in that hostel and room

## Owner

Requires role: `owner` or `admin`.

### GET `/owner/dashboard`

Single-call bootstrap for the owner dashboard (hostel list + every KPI card,
gauge, chart and table). Backend uses 3-level cache (L1 30s / L2 60s) and shares
one aggregated query per table — never fan out to `/rooms`, `/fees` or
`/analytics` for the dashboard.

Response (top-level blocks):

- `data` — **legacy** flat array of per-hostel rows
  (`hostelId`, `hostelName`, `hostelType`, `totalActiveResidents`,
  `residentsOnLeaveToday`). Unchanged shape, so older clients keep working.
- `summary` — every KPI number:
  `totalResidents`, `residentsOnLeaveToday`, `totalBeds`, `occupiedBeds`,
  `availableBeds`, `occupancyRate` (%, 1 decimal), `totalRooms`,
  `availableRooms`, `occupiedRooms`, `monthlyRevenue` (collected this AD
  month/year), `pendingPayments` (`SUM(totalPayable - paidAmount)` where
  `status != PAID`), `pendingCount`, `totalHostels`.
- `floorOverview` — `[{ floor: number | null, label, roomCount }]` sorted by
  floor; rooms without an alias come back as `floor: null`, `label: "Unassigned"`.
- `roomMix` — `[{ type, roomCount }]` (rooms grouped by `type`, most rooms first).
- `revenueTrend` — last 6 billing periods, oldest → newest:
  `[{ billingYear, billingMonth, label: "Apr", collected, outstanding }]`.
- `recentPayments` — 5 most recently updated fees, each shaped as
  `{ feeId, residentId, residentName, hostelId, hostelName, roomNumber,
paidAmount, totalPayable, status, billingMonth, billingYear, updatedAt }`.

Notes:

- `occupiedBeds` = `max(active residents, sum(rooms.occupied))` — same occupancy
  rule as `GET /owner/residents/form-options/rooms`, so the dashboard gauge and
  the Add-Resident dropdowns never disagree.
- `availableRooms` counts rooms with `status === AVAILABLE` **and** at least one
  free bed (`capacity - occupied > 0`).
- Rooms are scoped by `ownerId` (includes rooms whose `hostelId` is still NULL).
- Beds are counted from the `rooms` table (`capacity`/`occupied`), the same
  convention as the Add-Resident form options — the separate `beds` table is
  intentional bed-level inventory and does not feed these cards.
- Cache key `owner:dashboard:<ownerId>`, busted by resident/room/fee/
  payment-proof mutations.

### GET `/owner/residents`

Requires role: `owner` or `admin`. Lists ALL active residents across every
hostel owned by the logged-in owner. Same hostel/room/bed/flat shape as
`GET /hostels/:id/residents`. Optional query: `?hostelId=<uuid>&page=&limit=`.

### GET `/owner/residents/form-options/hostels`

Requires role: `owner` or `admin`. Hostel dropdown for the Add-Resident form.
Owner sees only own hostels; admin sees all. Response: `[{ id, name, type, city, address }]`.

### GET `/owner/residents/form-options/flats?hostelId=<uuid>`

Requires role: `owner` or `admin`. Flat dropdown once a hostel is picked.
`flat` is an alias of `Room.floor` — no separate flat column exists.
Response: `[{ flat, floor, roomCount }]` ordered ASC.

### GET `/owner/residents/form-options/rooms?hostelId=<uuid>&flat=<number>`

Requires role: `owner` or `admin`. Room-number dropdown once hostel (+ optional flat) is picked.
100% dynamic from the `rooms` table + active residents — the frontend renders `label`
directly, no hardcoding. Available rooms sort first, then Full/unavailable (like the UI).
Each item:
`{ id, roomNumber, flat/floor, type, capacity, occupiedBeds, freeBeds, freeBedsText, monthlyRent, status, available, disabled, group, reason, label, takenBeds, suggestedBeds, suggestedBed, beds }`.
Labels: available → `"Room 103 · double · 1/2 beds · Rs. 11000"`; full → `"Room 101 · full (2/2)"`; blocked → `"Room 206 · maintenance (1/2)"`.
Each room's `beds` array drives the Bed dropdown: `{ value: "B1", label: "B1 · Room 103", taken, disabled }`.
Example: `GET /owner/residents/form-options/rooms?hostelId=<uuid>&flat=2` →
room `204` returns `{ roomNumber: "204", monthlyRent: 12000, flat: 2, suggestedBed: "B2", takenBeds: ["B1"] }`.

### GET `/owner/residents/form-options/rooms/detail?hostelId=<uuid>&roomNumber=103`

Requires role: `owner` or `admin`. Same room-option object as above but for ONE room.
Call it on Room-dropdown change to refresh the Bed dropdown + "X of Y bed(s) free." text + Monthly rent.

### POST `/owner/residents`

Creates and assigns a resident.
Body accepts the dynamic form fields: `hostelId`, optional `flat` (int, alias of floor),
`roomNumber` (e.g. `204`), `bedNumber` (e.g. `B1`), optional `monthlyRent` (e.g. `12000`).
If `monthlyRent` is omitted it is inherited from the selected room inventory.
The room + bed are validated LIVE against the `rooms` table: unknown room → 400,
`MAINTENANCE`/`RESERVED` → 400, full room → 409, taken bed → 409.
On success `rooms.occupied` is incremented (auto-flips to `OCCUPIED` when full)
so the dropdown counts update immediately.
TIP — why the rooms dropdown was `[]`: `POST /rooms` accepts an OPTIONAL `hostelId`,
so rooms created without it have `hostelId = NULL` and a strict hostel filter hides them.
The form-options endpoints now ALSO return the owner's unlinked rooms
(`hostelLinked: false`) so the dropdown shows every room the owner added.
Assigning a resident to an unlinked room auto-links it (`rooms.hostelId` set);
or link manually via `PATCH /rooms/:id { "hostelId": "<uuid>" }` (new field).

### GET `/owner/resident-imports/template`

Requires role: `owner` or `admin`. Downloads the CSV template with header
`name,email,phone,room,bed,rent` + 3 sample rows. Maps to the
"Download template" button in the Import Residents screenshot.

### POST `/owner/resident-imports?hostelId=<uuid>` (multipart `file`)

Requires role: `owner` or `admin`. Queues a background CSV import and returns
`200` with the `resident_imports` history row (`QUEUED`). The `hostelId` may
also come from body/header (`resolveHostelId`). Every row is validated
(name/email/phone/room/bed/rent) before enqueue — same room/bed rules as
single-create (unknown room → row error, full → row error, taken bed →
row error). Plan limits: max 2000 rows/file, 5MB, 3 concurrent imports.
Optional `Idempotency-Key` header replays the same history row instead of
double-queueing. Processing happens in the `resident-import-queue` BullMQ
worker (2 concurrency, per-row transaction, welcome emails, socket progress
`resident:import_progress` → completion `resident:import_completed`).

### GET `/owner/resident-imports?hostelId=<uuid>&page=&limit=`

Requires role: `owner` or `admin`. Import history for the "No imports yet /
Your import history will appear here" panel (3-tier cached, paginated,
newest first). Each row: `status` (`QUEUED/PROCESSING/COMPLETED/
COMPLETED_WITH_ERRORS/FAILED`), `totalRows/validRows/successCount/
failedCount`, `rowErrors[≤100]`, `fileName`, `createdAt/completedAt`.

### GET `/owner/resident-imports/:id`

Requires role: `owner` or `admin` (owner-scoped). Single import detail
including per-row errors for the history drill-down.

### GET `/owner/resident-imports/plan-limits`

Requires role: `owner` or `admin`. Powers the "View plan limits" button:
`{ maxRowsPerFile, maxFileBytes, maxConcurrentImports, monthlyRowBudget, columns }`.

### POST `/owner/leave-types`

Creates a leave type policy.

### POST `/owner/fees/generate-now`

Triggers monthly fee generation.

## Resident

Requires role: `resident` or `admin`.

### GET `/resident/me`

Dashboard bootstrap for the logged-in resident. Returns resident profile +
hostel + assigned room inventory row (matched by `hostelId` + `roomNumber`) +
hostel facilities. Use this for "My Room" / "Facilities at ..." — never call
owner/admin-only `GET /hostels/:id/residents` or `GET /rooms` as resident.

### POST `/resident/leaves/apply`

Applies for leave. Accepts EITHER naming (canonical wins if both sent):

```json
{
  "leaveTypeId": "<uuid-from-GET-/hostels/:id/leave-types>",
  "startDate": "2026-09-25",
  "endDate": "2026-09-27",
  "reason": "..."
}
```

legacy UI shape also accepted:

```json
{ "leaveTypeId": "<uuid>", "fromDate": "2026-09-25", "toDate": "2026-09-27", "remarks": "..." }
```

### GET `/resident/leaves`

Lists authenticated resident leave history.

### GET `/resident/fees`

Lists authenticated resident fee bills and dues.

## Leave

Requires role: `owner` or `admin`.

### GET `/leaves/hostels/:hostelId/requests`

Lists leave requests for a hostel. Optional query: `status`.

### PATCH `/leaves/requests/:id/status`

Updates leave request status.

## Fee

Requires role: `owner` or `admin`.

### POST `/fees/generate-monthly`

Generates monthly fee records.

### GET `/fees/hostels/:hostelId`

Lists hostel fees.

### PATCH `/fees/:id/payment`

Records payment against a fee.

### PATCH `/fees/:id/status`

Updates fee status (`PENDING | PAID | OVERDUE | PARTIALLY_PAID`).
Optional `paidAmount` applies a payment alongside the status change.
Marking `PAID` settles the bill in full (same settlement rule as proof approval).

## Expense

Requires role: `owner` or `admin`. Every row belongs to one hostel
(`hostelId` FK → `hostels.id`, cascade on hostel delete).

Table `expenses`: `id` (uuid), `hostelId` (uuid FK), `title` (≤150),
`category` (`STAFF|FOOD|MAINTENANCE|UTILITIES|ELECTRICITY|WATER|SUPPLIES|INTERNET|OTHER`),
`amount` (numeric 12,2, ≥ 0.01), `expenseDate` (ISO `YYYY-MM-DD`),
`notes` (nullable text ≤ 2000), `status` (`PENDING|PAID|CANCELLED`, default `PAID`),
`createdById` (uuid FK → `users.id`), `createdAt`/`updatedAt`.

Compression: HTTP responses use global Brotli/gzip (`Accept-Encoding`),
and paginated list + detail reads go through the 3-tier cache whose Redis
(L2) values are Brotli-packed (`br1:`) when it saves bytes; writes
invalidate `expenses:list`, `expenses:hostel`, the detail key, and analytics.

### POST `/expenses`

```json
{
  "hostelId": "a38bf07a-b7b1-49dc-85c8-dd5542a8e90a",
  "title": "Electricity Bill",
  "category": "UTILITIES",
  "amount": 12000,
  "expenseDate": "2026-09-30",
  "notes": "Expenses to electricity bill",
  "status": "PAID"
}
```

→ `201 { success, message: "Expense created", data }`.

### GET `/expenses?page=1&limit=20&hostelId=&category=&status=`

Paginated (`page`/`limit` normalized, max 100). Optional filters:
`hostelId` (uuid), `category`, `status`. Owners without `hostelId` get
only their own hostels; admins get everything.

→ `200 { success, data[], pagination: { totalItems, currentPage, totalPages, itemsPerPage, hasNextPage, hasPrevPage }, isCached, cacheLevel }`.

### GET `/expenses/:id`

→ `200 { success, data }` (404 when missing/forbidden hostel).

### PUT `/expenses/:id` and PATCH `/expenses/:id`

Both map to full/partial update of `title/category/amount/expenseDate/notes/status`
(`hostelId` is immutable — create a new row to move hostels).

→ `200 { success, message: "Expense updated", data }`.

### DELETE `/expenses/:id`

→ `200 { success, message: "Expense deleted" }`.

## Subscription

Base: `/api/v1/hostel-ghar/subscriptions`. Owner-scoped, optionally
hostel-scoped. No `ACTIVE` non-expired row means `FREE` fallback.
Mount: `routes.use('/subscriptions', subscriptionRouter)`.

| Method                                    | Auth     | Roles       | Hostel   | Use                                          |
| ----------------------------------------- | -------- | ----------- | -------- | -------------------------------------------- |
| GET `/subscriptions/plans`                | optional | public      | no       | list 4 tiers + isCurrent                     |
| GET `/subscriptions/current`              | yes      | owner admin | required | plan + usage + daysRemaining                 |
| POST `/subscriptions/subscribe`           | yes      | owner admin | required | FREE instant; paid = upload proof → PENDING  |
| POST `/subscriptions/cancel`              | yes      | owner admin | required | expire to FREE                               |
| GET `/subscriptions/history`              | yes      | owner admin | no       | rows newest first (incl. PENDING requests)   |
| GET `/subscriptions/check-limit`          | yes      | owner admin | required | resident capacity                            |
| GET `/subscriptions/requests`             | yes      | admin       | no       | payment-proof review queue (default PENDING) |
| POST `/subscriptions/requests/:id/review` | yes      | admin       | no       | APPROVE (activate) / REJECT                  |

`GET /plans` uses `optionalAuthenticate`. Valid token personalizes
`isCurrent`. Anonymous uses `FREE`. Invalid token ignored.

### Plans and limits

File `src/constant/subscription.constant.ts`. Currency `NPR`.
`null` means unlimited.

`FREE` Free 0 Free/mo residents 10 hostels 1 CTA Current Plan badge Current.
`BASIC` Basic 999 Rs 999/mo residents 60 hostels 1 CTA Upgrade to Basic.
`PRO` Pro 1999 Rs 1,999/mo residents null hostels 1 CTA Upgrade to Pro badge Popular.
`ENTERPRISE` Enterprise 4999 Rs 4,999/mo residents null hostels null CTA Contact Sales.

Taglines: Free Get started with hostel basics. Basic For small hostels
getting organized. Pro For growing hostels that need automation.
Enterprise For groups and multi-hostel operators.

Features in order:
Free: Basic dashboard, Basic hostel profile, Up to 10 residents,
Room management, Staff management, Reports and analytics.
Basic: Up to 60 residents, Room management, Basic payments,
Expenses tracking, Reports and analytics.
Pro: Unlimited residents, Staff management, Advanced analytics,
Reports and exports, Invoices and reminders.
Enterprise: Multiple hostels, Advanced administration,
Advanced reporting, Priority support, Custom integrations.

Flags `PlanFeatureDetails`: basicDashboard basicHostelProfile
maxResidents maxHostels roomManagement staffManagement
reportsAndAnalytics basicPayments expensesTracking advancedAnalytics
reportsAndExports invoicesAndReminders multipleHostels
advancedAdministration advancedReporting prioritySupport
customIntegrations.
Free only basic room staff reports true.
Basic adds basicPayments expensesTracking, staff false.
Pro adds staff advancedAnalytics reportsAndExports invoicesAndReminders.
Enterprise all true.
Enforced resident Free 10 Basic 60 Pro Enterprise unlimited.
Hostel Free Basic Pro 1 Enterprise unlimited.
`checkHostelLimit` has no HTTP route.

### Auth hostel validation

Missing invalid token 401. Wrong role 403.
`resolveHostelId` runs before controller for current subscribe cancel
check-limit. Accepts UUIDv4 from params hostelId or id, query hostelId,
body hostelId, X-Hostel-Id. Missing invalid 400 valid hostelId required.
`POST /subscribe` validates `SubscribeDto`, unknown fields 422 Validation error.

### GET `/subscriptions/plans`

`GET /api/v1/hostel-ghar/subscriptions/plans`
200 Subscription plans fetched successfully.
Data array with id name tagline price currency billingPeriod
formattedPrice badge features buttonText limits featureFlags isCurrent.
When isCurrent true buttonText Current Plan.

### GET `/subscriptions/current`

`GET /api/v1/hostel-ghar/subscriptions/current?hostelId=uuid`
Auth owner admin hostel required.
200 Current subscription fetched successfully.
`data.subscription` nullable, `data.plan` definition, `data.limits`
residentCount residentLimit residentLimitReached hostelCount hostelLimit
hostelLimitReached, `data.daysRemaining` ceil endDate-now or null.
residentCount active residents for hostel else 0.

### POST `/subscriptions/subscribe`

`POST /api/v1/hostel-ghar/subscriptions/subscribe`
Auth owner admin hostel required. Accepts JSON or multipart/form-data
(multer field `proof` | `screenshot` | `receipt` | `image` | `file`,
image ≤ 4MB).
Body plan required FREE BASIC PRO ENTERPRISE.
hostelId UUID optional in DTO but required by middleware, falls back to
req hostelId. billingCycle optional MONTHLY YEARLY default MONTHLY.
paymentMethod optional ESEWA KHALTI BANK CASH. paymentReference optional
string ≤ 100. proofUrl optional string ≤ 500 (instead of an uploaded file).
notes optional string.

Flow FREE = self-serve downgrade: deactivate old ACTIVE to EXPIRED,
creates an ACTIVE FREE row, startDate now endDate null, busts cache,
200 `Successfully subscribed to Free plan`.

Paid (BASIC PRO ENTERPRISE) = payment-proof request, nothing activates:
payment proof screenshot required (uploaded file or proofUrl) else 400
`Payment proof screenshot is required for paid plans…`. A PENDING row for
the same owner+hostel already existing → 409 `A subscription request is
already awaiting admin review…`. Otherwise inserts a row with status
PENDING, endDate null, price snapshot 999 1999 4999 NPR, paymentMethod,
paymentReference, notes, proofUrl/proofPublicId. The ACTIVE plan is NOT
touched. 201 message `Payment proof submitted for Pro plan…` data
{ subscription, plan, requiresApproval true }.

### GET `/subscriptions/requests` (admin)

`GET /api/v1/hostel-ghar/subscriptions/requests?status=PENDING&page=1&limit=20`
Auth admin only (owner gets 403). `status` default PENDING, accepts
ACTIVE EXPIRED CANCELLED PENDING REJECTED; unknown values fall back to
PENDING. 200 `{ success, data: [...], meta }` newest first with owner
(id name email), hostel (id name), plan, status, billingCycle, price,
currency, paymentMethod, paymentReference, notes, proofUrl, reviewNote,
reviewedBy, reviewedAt, startDate, endDate, createdAt.

### POST `/subscriptions/requests/:id/review` (admin)

`POST /api/v1/hostel-ghar/subscriptions/requests/:id/review`
Auth admin only. Body action required APPROVE REJECT, note optional
string ≤ 500.
APPROVE deactivates the owner's ACTIVE rows to EXPIRED, flips the request
to ACTIVE with startDate now, endDate now + 30d monthly / + 1y yearly,
price/currency snapshot, records reviewedBy/At/Note, busts subscription and
owner caches. REJECT sets status REJECTED (owner keeps current plan).
Not found 404. Not PENDING 409 `Request has already been reviewed`.
200 message `Subscription approved — Pro plan is now active.` or
`Subscription request rejected. The owner stays on their current plan.`

### POST `/subscriptions/cancel`

`POST /api/v1/hostel-ghar/subscriptions/cancel` body hostelId uuid.
Auth owner admin hostel required. Deactivate ACTIVE to EXPIRED.
Next current FREE. Bust cache.
200 message Subscription cancelled successfully. No data.

### GET `/subscriptions/history`

`GET /api/v1/hostel-ghar/subscriptions/history`
Auth owner admin no hostel no pagination newest first with hostel.
200 Subscription history fetched successfully. Empty array if none.

### GET `/subscriptions/check-limit`

`GET /api/v1/hostel-ghar/subscriptions/check-limit?hostelId=uuid&count=1`
Auth owner admin hostel required count default 1.
Allowed 200 data allowed true currentPlan planName limit currentCount.
Blocked still 200 allowed false plus message.
FREE hint Upgrade to Basic or Pro. BASIC hint Upgrade to Pro.
Other hint Please upgrade. Pro Enterprise limit null allowed true.
Missing hostelId 400 hostelId is required.

### DTO enums entity

`SubscribeDto` plan enum required hostelId UUID optional billingCycle
enum optional paymentMethod enum optional paymentReference string ≤100
optional proofUrl string ≤500 optional notes string optional.
`ReviewSubscriptionDto` action enum required note string ≤500 optional.
Enums `SubscriptionPlan` FREE BASIC PRO ENTERPRISE.
`SubscriptionStatus` ACTIVE EXPIRED CANCELLED PENDING REJECTED.
`SubscriptionReviewAction` APPROVE REJECT.
paymentMethod reuses `ProofPaymentMethod` ESEWA KHALTI BANK CASH.
`BillingCycle` MONTHLY YEARLY.
Only ACTIVE with endDate null or future counts. Service writes ACTIVE
(cancel/subscribe FREE), PENDING (paid request) then ACTIVE or REJECTED
(admin review). CANCELLED unused by service.
Table subscriptions id uuid PK ownerId FK users cascade hostelId FK
hostels set null nullable plan default FREE status default ACTIVE
billingCycle default MONTHLY price numeric 10 2 currency NPR startDate
now endDate nullable autoRenew false cancelledAt nullable
paymentReference 255 nullable notes text nullable createdAt updatedAt
plus paymentMethod payment_proof_method_enum nullable proofUrl 500
proofPublicId 255 reviewedBy uuid FK users set null reviewedAt nullable
reviewNote text nullable (migration 1793000000000).
Indexes ownerId hostelId status plan ownerId+status.

### Lifecycle caching

FREE no row to ACTIVE via subscribe FREE downgrade. Paid plan rows enter
as PENDING with proof, become ACTIVE (+30d or +1y) on admin APPROVE or
REJECTED on REJECT. Cancel to EXPIRED. Current falls back FREE history
keeps row. `findActiveSubscription` latest ACTIVE matching hostelId OR
ownerId — PENDING REJECTED rows never grant limits.
subscribe review cancel bust subscription owner cache.
Flow plans to current to check-limit to subscribe to admin requests.

## Reports

No `/reports` mount in `src/routes/index.routes.ts`. Only auth admin
owner resident resident-imports bookings analytics hostels leaves fees
rooms beds payment-qrs payment-proofs expenses subscriptions.
No ReportController ReportService report routes. Only ReportRepository
and report-export util, both unwired never called outside util.
Use analytics owner dashboard fees expenses residents today.

### Live reporting endpoints

Prefix api v1 hostel-ghar auth Bearer or cookie.

`GET /analytics/admin/summary`. Roles admin plus apiReadLimiter.
Cache L1 30s L2 120s returns isCached cacheLevel. Fields users hostels
activeResidents pendingBookings pendingLeaves unpaidFees paidAmount SUM
paid outstanding SUM payable-paid.

`GET /analytics/owner/summary`. Roles owner admin plus limiter.
Cache owner id v3. Legacy hostels activeResidents pendingBookings
pendingLeaves outstandingAmount generatedAt plus hostelOptions totals
rooms beds occupancyRate monthlyRevenue pendingAmount monthlyExpenses
null netRevenue null occupancy paymentStatus billed collected pending
collectionRate breakdown per FeeStatus roomOccupancy mrr planMix
finance allTime collected outstanding feeLifecycle paid pending
overdue partiallyPaid occupancyByHostel topHostelsByResidents
trends revenue residentGrowth 12 YYYY-MM unavailableMetrics expenses
maintenance residentDemographics residentCheckOuts.

`GET /owner/dashboard`. Roles owner admin. Cache owner dashboard id.
Returns data legacy rows plus summary totalResidents occupiedBeds
availableBeds occupancyRate totalRooms availableRooms monthlyRevenue
pendingPayments pendingCount totalHostels floorOverview roomMix
revenueTrend 6 recentPayments 5.
occupiedBeds max active residents SUM rooms occupied.

Fee expense resident sources.
`GET /fees/hostels/:id` ledger. `PATCH /fees/:id/payment` and status
feed reports.
`GET /expenses?page=&limit=&hostelId=&category=&status=` paginated max
100 with pagination isCached cacheLevel owner own admin all.
`GET /hostels/:id/residents` and `GET /owner/residents` rosters hostel
room bed. Use analytics dashboard plus lists for Reports UI client CSV
for now.

### Internal blocks not HTTP

`ReportRepository` TypeORM only.
`findScopedHostels` userId role hostelId owners own admin all cross none.
`findRoomsByHostels` Room hostel roomNumber ASC.
`findBedsByHostels` Bed room bedNumber ASC.
`findResidentsByHostels` active user hostel roomNumber ASC.
`findFeesByHostels` Fee resident user hostel year month DESC.
`findOutstandingFees` status PENDING OVERDUE PARTIALLY_PAID dueDate ASC.
`findApprovedProofs` APPROVED resident user fee hostel createdAt ASC.
Flow scoped hostels ids parallel finds shape toCsv pdf.

`report-export.util` zero dep.
`escapeCsvCell` RFC4180. `toCsv` headers rows BOM CRLF Excel.
`safeFileSegment` slug fallback report.
`buildTabularPdf` title subtitle headers rows weights landscape Buffer
PDF1.4 Helvetica auto landscape if headers over 5 weighted zebra footer
Page X of Y HostelGhar date empty No records. Send Buffer pdf with
Content-Disposition attachment. No auth cache inside.

### Future reports contract NOT implemented

Do not call returns 404. Proposed mount `routes.use reports router`.
`GET /reports/rooms` hostelId format json csv pdf.
`GET /reports/beds` same.
`GET /reports/residents` same.
`GET /reports/fees` hostelId status outstanding all format.
`GET /reports/payments` hostelId format approved proofs.
Auth owner admin scoped `findScopedHostels` hostel via query body header.
json success data meta hostelId generatedAt count. csv text csv.
pdf application pdf. Columns rooms hostel roomNumber floor flat type
capacity occupied status. beds hostel room bedNumber status resident.
residents name email phone hostel room bed rent joinedAt.
fees resident hostel period YYYY-MM totalPayable paidAmount outstanding
status dueDate. payments resident fee period amount approvedAt reference.
Cache requester hostel report format L1 30s L2 120s bust on mutations.

### Codes and curl

200 subscription incl blocked analytics dashboard. 201 expense create.
400 hostelId. 401 token. 403 role cross owner. 404 unknown reports or
missing row. 422 DTO. 429 limiter.
Success success true message data. Cached adds isCached cacheLevel.
Error success false message. Validation adds errors field messages.
Messages PLANS_FETCHED CURRENT_FETCHED UPGRADED CANCELLED HISTORY_FETCHED
RESIDENT_LIMIT_REACHED.

```bash
BASE=http://localhost:3000/api/v1/hostel-ghar
curl $BASE/subscriptions/plans
curl -H "Authorization: Bearer $TOKEN" $BASE/subscriptions/plans
curl -H "Authorization: Bearer $TOKEN" "$BASE/subscriptions/current?hostelId=$HOSTEL"
curl -H "Authorization: Bearer $TOKEN" "$BASE/subscriptions/check-limit?hostelId=$HOSTEL&count=3"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"plan\":\"PRO\",\"hostelId\":\"$HOSTEL\",\"billingCycle\":\"MONTHLY\",\"paymentMethod\":\"ESEWA\"}" $BASE/subscriptions/subscribe
curl -H "Authorization: Bearer $TOKEN" $BASE/subscriptions/history
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"hostelId\":\"$HOSTEL\"}" $BASE/subscriptions/cancel
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/subscriptions/requests?status=PENDING"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"action\":\"APPROVE\",\"note\":\"Payment verified\"}" "$BASE/subscriptions/requests/$REQUEST_ID/review"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"action\":\"REJECT\"}" "$BASE/subscriptions/requests/$REQUEST_ID/review"
curl -H "Authorization: Bearer $TOKEN" $BASE/analytics/owner/summary
curl -H "Authorization: Bearer $TOKEN" $BASE/owner/dashboard
curl -H "Authorization: Bearer $TOKEN" "$BASE/expenses?hostelId=$HOSTEL&page=1&limit=20"
```

## Socket Events

Authenticated clients join `user:<userId>`, `role:<ROLE>`, and `hostel:<hostelId>` rooms. Domain events include `hostel:updated`, `booking:confirmed`, `leave:status_changed`, and `payment:processed`.
