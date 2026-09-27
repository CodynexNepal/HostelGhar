import { describe, expect, it } from 'vitest';
import { feeRouter } from '../../src/routes/fee/fee.routes';
import { paymentProofRouter } from '../../src/routes/payment-proof/payment-proof.routes';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const routePaths = (router: unknown): string[] =>
  ((router as { stack: RouteLayer[] }).stack ?? [])
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route!.methods).join(',').toUpperCase()} ${l.route!.path}`);

describe('resident payment-proof access', () => {
  it('keeps POST /fees/:feeId/payment-proofs on paymentProofRouter, not blocked by feeRouter', () => {
    const feeRoutes = routePaths(feeRouter);
    const proofRoutes = routePaths(paymentProofRouter);
    expect(feeRoutes.some((r) => r.includes('payment-proofs'))).toBe(false);
    expect(proofRoutes).toContain('POST /fees/:feeId/payment-proofs');
  });

  it('exposes GET /fees/hostels/:hostelId/payment-proofs alias for /payment-proofs/hostels/:hostelId', () => {
    const proofRoutes = routePaths(paymentProofRouter);
    expect(proofRoutes).toContain('GET /fees/hostels/:hostelId/payment-proofs');
    expect(proofRoutes).toContain('GET /payment-proofs/hostels/:hostelId');
  });
});
