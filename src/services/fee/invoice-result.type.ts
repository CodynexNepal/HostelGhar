// ─────────────────────────────────────────────────────────────
// FILE: invoice-result.type.ts
// PURPOSE: Shared result type for manual invoice creation.
// ─────────────────────────────────────────────────────────────

import { Fee } from '../../entities/fee/fee.entity';

export interface CreateInvoiceResult {
  fee: Fee;
  emailSent: boolean;
  emailQueuedTo: string | null;
  sendMode: 'DRAFT' | 'SEND_NOW';
}
