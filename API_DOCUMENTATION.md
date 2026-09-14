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

Requires role: `admin` or `owner`. Lists active residents.

### GET `/hostels/:id/leave-types`

Lists leave policies for a hostel.

## Owner

Requires role: `owner` or `admin`.

### GET `/owner/dashboard`

Returns owner hostel dashboard.

### POST `/owner/residents`

Creates and assigns a resident.

### POST `/owner/leave-types`

Creates a leave type policy.

### POST `/owner/fees/generate-now`

Triggers monthly fee generation.

## Resident

Requires role: `resident` or `admin`.

### POST `/resident/leaves/apply`

Applies for leave.

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
