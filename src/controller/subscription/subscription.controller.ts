// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.controller.ts
// PURPOSE: HTTP handlers for subscription plans, current tier status, and upgrades.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../../services/subscription/subscription.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { MESSAGES } from '../../constant/message.interface';
import { SubscribeDto } from '../../dto/subscription/subscribe.dto';
import { ReviewSubscriptionDto } from '../../dto/subscription/review-subscription.dto';
import {
  SubscriptionPlan,
  SubscriptionReviewAction,
  SubscriptionStatus,
} from '../../enum/subscription.enum';
import { pickSubscriptionProofFile } from '../../middleware/upload.middleware';
import { normalizePagination } from '../../utils/pagination.util';
import { getRequiredParam } from '../../decorators/http.decorator';

export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * GET /subscriptions/plans
   * Public or authenticated: Lists all subscription tiers with features, pricing, limits, and CTAs.
   */
  public getPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let currentPlan: SubscriptionPlan | undefined;

      if (req.user?.userId) {
        const currentSub = await this.subscriptionService.getCurrentSubscription({
          ownerId: req.user.userId,
          hostelId: req.hostelId ?? undefined,
        });
        currentPlan = currentSub.plan.id;
      }

      const plans = this.subscriptionService.getAllPlans(currentPlan);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SUBSCRIPTION_PLANS_FETCHED,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /subscriptions/current
   * Returns the logged-in owner's current subscription, features, limits, and live usage.
   */
  public getCurrentSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const hostelId = req.hostelId || (req.query.hostelId as string | undefined);

      const result = await this.subscriptionService.getCurrentSubscription({
        ownerId,
        hostelId: hostelId ?? undefined,
      });

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SUBSCRIPTION_CURRENT_FETCHED,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /subscriptions/subscribe
   * Requests a plan change (FREE = instant downgrade; BASIC/PRO/ENTERPRISE =
   * owner uploads a payment proof → PENDING until an admin approves it).
   */
  public subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const dto = req.body as SubscribeDto;

      if (!dto.hostelId && req.hostelId) {
        dto.hostelId = req.hostelId;
      }

      const file = pickSubscriptionProofFile(req);
      const result = await this.subscriptionService.subscribe(ownerId, dto, file);

      res.status(result.requiresApproval ? STATUS_CODE.CREATED : STATUS_CODE.OK).json({
        success: true,
        message: result.requiresApproval
          ? `Payment proof submitted for ${result.plan.name} plan. Your subscription changes after admin verification.`
          : `Successfully subscribed to ${result.plan.name} plan`,
        data: {
          subscription: result.subscription,
          plan: result.plan,
          requiresApproval: result.requiresApproval,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /subscriptions/requests
   * Admin: review queue of owner payment-proof requests (default PENDING).
   */
  public getRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });

      const raw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'PENDING';
      const isKnown = Object.values(SubscriptionStatus).includes(raw as SubscriptionStatus);
      const status = isKnown ? (raw as SubscriptionStatus) : SubscriptionStatus.PENDING;

      const result = await this.subscriptionService.listRequests({ status, page, limit });

      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /subscriptions/requests/:id/review
   * Admin: APPROVE (activates the plan) or REJECT (owner keeps current plan).
   */
  public reviewRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredParam(req, 'id');
      const dto = req.body as ReviewSubscriptionDto;

      const result = await this.subscriptionService.reviewRequest(
        req.user!.userId,
        req.user!.role,
        id,
        dto,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message:
          dto.action === SubscriptionReviewAction.APPROVE
            ? `Subscription approved — ${result.plan.name} plan is now active.`
            : 'Subscription request rejected. The owner stays on their current plan.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /subscriptions/cancel
   * Cancels the active subscription and reverts back to the FREE plan.
   */
  public cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const hostelId = req.hostelId || (req.body.hostelId as string | undefined);

      await this.subscriptionService.cancelSubscription(ownerId, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SUBSCRIPTION_CANCELLED,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /subscriptions/history
   * Returns past and active subscription records.
   */
  public getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const history = await this.subscriptionService.getHistory(ownerId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SUBSCRIPTION_HISTORY_FETCHED,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /subscriptions/check-limit
   * Checks if current hostel has capacity to add more residents under current plan.
   */
  public checkResidentLimit = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = req.hostelId || (req.query.hostelId as string);
      if (!hostelId) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'hostelId is required',
        });
        return;
      }

      const count = req.query.count ? parseInt(req.query.count as string, 10) : 1;
      const result = await this.subscriptionService.checkResidentLimit(hostelId, count);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
