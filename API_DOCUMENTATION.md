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

### GET `/admin/hostels`

Lists hostels with pagination.

### POST `/admin/hostels`

Creates a hostel.

### PUT `/admin/hostels/:id/owner`

Assigns an owner to a hostel.

## Analytics

### GET `/analytics/admin/summary`

Requires role: `admin`. Returns system counts and fee totals.

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
- `roomOccupancy` and `capacityByRoom`: full/partial/available room counts and
  bed capacity by room/floor.
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

## Socket Events

Authenticated clients join `user:<userId>`, `role:<ROLE>`, and `hostel:<hostelId>` rooms. Domain events include `hostel:updated`, `booking:confirmed`, `leave:status_changed`, and `payment:processed`.
