// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.enum.ts
// PURPOSE: Central enums defining room classification types and availability status.
// ──────────────────────────────────────────────────────────────────────────────

export enum RoomType {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  DORMITORY = 'DORMITORY',
}

export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  MAINTENANCE = 'MAINTENANCE',
}
