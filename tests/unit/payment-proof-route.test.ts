import 'reflect-metadata';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { feeRouter } from '../../src/routes/fee/fee.routes';
import { paymentProofRouter } from '../../src/routes/payment-proof/payment-proof.routes';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { JwtTokenService } from '../../src/utils/jwt-token.util';
import { IROLES } from '../../src/enum/roles.enum';

// Mirrors index.routes.ts ordering: paymentProofRouter mounts at '/' BEFORE
// feeRouter at '/fees', so its longer '/fees/...' paths are matched first.
const app = express();
app.use(express.json());
const routes = express.Router();
routes.use('/', paymentProofRouter);
routes.use('/fees', feeRouter);
app.use('/api/v1/hostel-ghar', routes);
app.use(notFoundHandler);

const HOSTEL_ID = 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a';
// A valid token passes `authenticate`; a RESIDENT then fails the owner/admin
// `requireRoles` gate with 403 — which only happens when a route MATCHED.
// This proves routing without touching the database.
const residentToken = JwtTokenService.generateAccessToken({
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'resident@test.local',
  role: IROLES.RESIDENT,
});

let server: Server;
let baseUrl: string;

const get = async (path: string): Promise<{ status: number; body: { message?: string } }> => {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${residentToken}` } });
  return { status: res.status, body: (await res.json()) as { message?: string } };
};

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe('GET /fees/hostels/:hostelId/payment-proofs', () => {
  it('resolves on paymentProofRouter (403 role gate, not the 404 Route-not-found)', async () => {
    const { status } = await get(`/api/v1/hostel-ghar/fees/hostels/${HOSTEL_ID}/payment-proofs`);
    expect(status).toBe(403);
  });

  it('keeps the canonical GET /payment-proofs/hostels/:hostelId working', async () => {
    const { status } = await get(`/api/v1/hostel-ghar/payment-proofs/hostels/${HOSTEL_ID}`);
    expect(status).toBe(403);
  });

  it('does not shadow feeRouter GET /fees/hostels/:hostelId', async () => {
    const { status } = await get(`/api/v1/hostel-ghar/fees/hostels/${HOSTEL_ID}`);
    expect(status).toBe(403);
  });

  it('still 404s genuinely unknown routes', async () => {
    const { status, body } = await get('/api/v1/hostel-ghar/fees/hostels/unknown/does-not-exist');
    expect(status).toBe(404);
    expect(body.message).toContain('Route not found');
  });
});