import { describe, expect, it } from 'vitest';
import { Request, Response } from 'express';
import { applyCorsHeaders } from '../../src/configs/cors.config';
import { errorHandler } from '../../src/middleware/error-handler.middleware';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';

describe('CORS and error response headers', () => {
  it('applies Access-Control-Allow-Origin for dashboard origin', () => {
    const req = {
      headers: { origin: 'https://dashboard.hostelghar.com' },
    } as unknown as Request;

    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
    } as unknown as Response;

    applyCorsHeaders(req, res);

    expect(headers['access-control-allow-origin']).toBe('https://dashboard.hostelghar.com');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(headers['vary']).toBe('Origin');
  });

  it('does not apply Access-Control-Allow-Origin for untrusted origin', () => {
    const req = {
      headers: { origin: 'https://malicious-site.com' },
    } as unknown as Request;

    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
    } as unknown as Response;

    applyCorsHeaders(req, res);

    expect(headers['access-control-allow-origin']).toBeUndefined();
  });

  it('guarantees CORS headers on errorHandler execution', () => {
    const req = {
      headers: { origin: 'https://dashboard.hostelghar.com' },
    } as unknown as Request;

    const headers: Record<string, string> = {};
    let responseStatus = 0;
    let responseBody: any = null;

    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as unknown as Response;

    errorHandler(new Error('Test internal error'), req, res, () => {});

    expect(responseStatus).toBe(500);
    expect(headers['access-control-allow-origin']).toBe('https://dashboard.hostelghar.com');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(responseBody).toMatchObject({ success: false, message: 'Test internal error' });
  });

  it('guarantees CORS headers on notFoundHandler execution', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/hostel-ghar/unknown-route',
      headers: { origin: 'https://dashboard.hostelghar.com' },
    } as unknown as Request;

    const headers: Record<string, string> = {};
    let responseStatus = 0;
    let responseBody: any = null;

    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as unknown as Response;

    notFoundHandler(req, res);

    expect(responseStatus).toBe(404);
    expect(headers['access-control-allow-origin']).toBe('https://dashboard.hostelghar.com');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(responseBody.success).toBe(false);
  });
});
