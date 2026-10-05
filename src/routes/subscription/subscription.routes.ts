// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.routes.ts
// PURPOSE: Routes for subscription plans, current tier status, upgrades, and limits.
// ──────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { SubscriptionFactory } from '../../factory/subscription/subscription.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { SubscribeDto } from '../../dto/subscription/subscribe.dto';
import { ReviewSubscriptionDto } from '../../dto/subscription/review-subscription.dto';
import { resolveHostelId } from '../../middleware/hostel-context.middleware';
import { stripFileFields, uploadSubscriptionProof } from '../../middleware/upload.middleware';
import { requireParam } from '../../decorators/http.decorator';
import { JwtTokenService } from '../../utils/jwt-token.util';

const subscriptionRouter: Router = Router();
const subscriptionController = SubscriptionFactory.create();

/**
 * Optional authentication middleware for public/hybrid endpoints like /plans
 */
const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (token) {
    try {
      const payload = JwtTokenService.verifyAccessToken(token);
      if (payload) {
        req.user = payload as unknown as import('../../utils/jwt-token.util').ITokenPayload;
      }
    } catch {
      // Ignore invalid token on optional auth endpoints
    }
  }
  next();
};

// Public/Optional Auth: View all subscription plans with features & pricing
subscriptionRouter.get('/plans', optionalAuthenticate, subscriptionController.getPlans);

// Protected routes (Owner & Admin)
subscriptionRouter.get(
  '/current',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  resolveHostelId,
  subscriptionController.getCurrentSubscription,
);

subscriptionRouter.post(
  '/subscribe',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  // Multipart must run BEFORE resolveHostelId so `hostelId` sent as a form
  // field is already parsed into req.body; JSON bodies pass straight through.
  uploadSubscriptionProof,
  stripFileFields('proof', 'screenshot', 'receipt', 'image', 'file'),
  resolveHostelId,
  validateDto(SubscribeDto),
  subscriptionController.subscribe,
);

// Admin review queue: owner payment proofs awaiting approval
subscriptionRouter.get(
  '/requests',
  authenticate,
  requireRoles(IROLES.ADMIN),
  subscriptionController.getRequests,
);

// Admin approves (activates) or rejects a PENDING subscription request
subscriptionRouter.post(
  '/requests/:id/review',
  authenticate,
  requireRoles(IROLES.ADMIN),
  requireParam('id'),
  validateDto(ReviewSubscriptionDto),
  subscriptionController.reviewRequest,
);

subscriptionRouter.post(
  '/cancel',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  resolveHostelId,
  subscriptionController.cancel,
);

subscriptionRouter.get(
  '/history',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  subscriptionController.getHistory,
);

subscriptionRouter.get(
  '/check-limit',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  resolveHostelId,
  subscriptionController.checkResidentLimit,
);

export { subscriptionRouter };
