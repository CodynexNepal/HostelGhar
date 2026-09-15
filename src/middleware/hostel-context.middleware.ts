import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getRequestedHostelId = (req: Request): unknown =>
  req.params.hostelId ||
  req.params.id ||
  req.body?.hostelId ||
  req.headers['x-hostel-id'];

export const resolveHostelId = (req: Request, res: Response, next: NextFunction): void => {
  const requestedHostelId = getRequestedHostelId(req);
  const hostelId = Array.isArray(requestedHostelId)
    ? requestedHostelId[0]
    : typeof requestedHostelId === 'string'
      ? requestedHostelId.trim()
      : undefined;

  if (!hostelId || !UUID_V4_PATTERN.test(hostelId)) {
    res.status(STATUS_CODE.BAD_REQUEST).json({
      success: false,
      message: 'A valid hostelId is required in the request body, route, or X-Hostel-Id header.',
    });
    return;
  }

  req.hostelId = hostelId;
  next();
};
