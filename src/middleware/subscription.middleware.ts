// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.middleware.ts
// PURPOSE: Middleware for enforcing subscription plan limits and feature access.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { IROLES } from '../enum/roles.enum';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { SubscriptionFactory } from '../factory/subscription/subscription.factory';
import { PlanFeatureDetails } from '../constant/subscription.constant';

const subscriptionService = SubscriptionFactory.createService();

/**
 * Middleware that verifies if the current user (owner) has access to a specific subscription feature.
 * Admin users automatically bypass this check.
 */
export const requirePlanFeature = (feature: keyof PlanFeatureDetails) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(STATUS_CODE.UNAUTHORIZED).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Admins bypass subscription feature restrictions
      if (req.user.role?.toUpperCase() === IROLES.ADMIN.toUpperCase()) {
        next();
        return;
      }

      // Owners are restricted by subscription tier
      if (req.user.role?.toUpperCase() === IROLES.OWNER.toUpperCase()) {
        const ownerId = req.user.userId;
        const hostelId =
          req.hostelId ||
          (typeof req.query?.hostelId === 'string' ? req.query.hostelId : undefined) ||
          (typeof req.body?.hostelId === 'string' ? req.body.hostelId : undefined);

        const check = await subscriptionService.checkFeatureAccess(ownerId, feature, hostelId);
        if (!check.allowed) {
          res.status(STATUS_CODE.FORBIDDEN).json({
            success: false,
            message: check.message,
            feature,
            currentPlan: check.currentPlan,
          });
          return;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
