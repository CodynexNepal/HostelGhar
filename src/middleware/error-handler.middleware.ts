import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { dotEnvConfig } from '../configs/envConfig';

interface HttpError extends Error {
  statusCode?: number;
  errors?: unknown;
}

export const errorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(dotEnvConfig.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
