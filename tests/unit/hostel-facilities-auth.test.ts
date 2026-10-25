import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { hostelRouter } from '../../src/routes/hostel/hostel.routes';
import { facilityRouter } from '../../src/routes/facility/facility.routes';
import { authenticate } from '../../src/middleware/auth.middleware';

describe('hostel facility route authentication', () => {
  it('does not have authenticate middleware mounted at parent /:hostelId/facilities', () => {
    // Check all layers mounted on hostelRouter
    const authenticateLayers = hostelRouter.stack.filter(
      (layer: any) => layer.handle === authenticate,
    );
    // Authenticate is not applied as a top-level middleware across /:hostelId/facilities
    // It is only used on specific sub-routes like /:id/residents and /:id/leave-types
    expect(authenticateLayers.length).toBe(0);
  });

  it('GET / on facilityRouter is public (does not contain authenticate middleware)', () => {
    const getLayer = facilityRouter.stack.find(
      (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get,
    );

    expect(getLayer).toBeDefined();
    const handlers = getLayer.route.stack.map((s: any) => s.handle);
    expect(handlers).not.toContain(authenticate);
  });

  it('PUT, POST, DELETE on facilityRouter require authenticate middleware', () => {
    const putLayer = facilityRouter.stack.find(
      (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.put,
    );
    expect(putLayer).toBeDefined();
    expect(putLayer.route.stack.map((s: any) => s.handle)).toContain(authenticate);

    const postLayer = facilityRouter.stack.find(
      (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.post,
    );
    expect(postLayer).toBeDefined();
    expect(postLayer.route.stack.map((s: any) => s.handle)).toContain(authenticate);

    const deleteLayer = facilityRouter.stack.find(
      (layer: any) =>
        layer.route && layer.route.path === '/:facilityKey' && layer.route.methods.delete,
    );
    expect(deleteLayer).toBeDefined();
    expect(deleteLayer.route.stack.map((s: any) => s.handle)).toContain(authenticate);
  });
});
