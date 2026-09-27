import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { bedRouter } from '../../src/routes/bed/bed.routes';

describe('bed routes', () => {
  it('registers a GET list endpoint for hostelId filtering', () => {
    const hasListRoute = bedRouter.stack.some(
      (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get,
    );

    expect(hasListRoute).toBe(true);
  });
});
