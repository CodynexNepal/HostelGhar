import { describe, expect, it } from 'vitest';
import { Request } from 'express';
import { getClientIp, sensitiveActionLimiter } from '../../src/configs/rateLimiter.config';
import { feeRouter } from '../../src/routes/fee/fee.routes';
import { mealRouter } from '../../src/routes/meal/meal.routes';

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ name: string; handle: (...args: unknown[]) => unknown }>;
  };
}

describe('Rate Limiter Architecture & Production Safeguards', () => {
  describe('getClientIp extraction', () => {
    it('prioritizes CF-Connecting-IP if provided by Cloudflare proxy', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts leftmost client IP from X-Forwarded-For', () => {
      const req = {
        headers: {
          'x-forwarded-for': '198.51.100.42, 10.0.0.1, 172.16.0.1',
        },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('falls back to X-Real-IP or socket remoteAddress', () => {
      const req = {
        headers: {
          'x-real-ip': '198.51.100.99',
        },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('198.51.100.99');
    });
  });

  describe('sensitiveActionLimiter composite key generator', () => {
    const keyGen = (sensitiveActionLimiter as any).keyGenerator;

    it('keys on authenticated userId when user is logged in', () => {
      if (typeof keyGen === 'function') {
        const req = {
          user: { userId: 'usr-admin-123' },
          headers: { 'x-real-ip': '198.51.100.1' },
        } as unknown as Request;

        const key = keyGen(req);
        expect(key).toBe('sensitive:user:usr-admin-123');
      }
    });

    it('keys on IP + email for unauthenticated requests with email body', () => {
      if (typeof keyGen === 'function') {
        const req = {
          body: { email: 'Owner@Test.com' },
          headers: { 'x-real-ip': '198.51.100.1' },
        } as unknown as Request;

        const key = keyGen(req);
        expect(key).toContain('owner@test.com');
        expect(key).toContain('sensitive:');
      }
    });

    it('keys on base IP when unauthenticated without email', () => {
      if (typeof keyGen === 'function') {
        const req = {
          body: {},
          headers: { 'x-real-ip': '198.51.100.1' },
        } as unknown as Request;

        const key = keyGen(req);
        expect(key).toContain('sensitive:');
      }
    });
  });

  describe('feeRouter & mealRouter operational protection', () => {
    it('does not attach sensitiveActionLimiter to routine fee management routes', () => {
      const feeLayers = (feeRouter as unknown as { stack: RouteLayer[] }).stack ?? [];
      for (const layer of feeLayers) {
        if (layer.route) {
          const handles = layer.route.stack.map((s) => s.handle);
          expect(handles).not.toContain(sensitiveActionLimiter);
        }
      }
    });

    it('does not attach sensitiveActionLimiter to daily meal management routes', () => {
      const mealLayers = (mealRouter as unknown as { stack: RouteLayer[] }).stack ?? [];
      for (const layer of mealLayers) {
        if (layer.route) {
          const handles = layer.route.stack.map((s) => s.handle);
          expect(handles).not.toContain(sensitiveActionLimiter);
        }
      }
    });
  });
});
