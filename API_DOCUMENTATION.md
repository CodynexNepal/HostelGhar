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

Requires role: `owner` or `admin`. Returns owner-scoped summary.

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

## Owner

Requires role: `owner` or `admin`.

### GET `/owner/dashboard`

Returns owner hostel dashboard.

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

## Socket Events

Authenticated clients join `user:<userId>`, `role:<ROLE>`, and `hostel:<hostelId>` rooms. Domain events include `hostel:updated`, `booking:confirmed`, `leave:status_changed`, and `payment:processed`.
