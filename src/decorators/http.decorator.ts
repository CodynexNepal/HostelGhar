import { NextFunction, Request, RequestHandler, Response } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';

export const requireParam = (name: string): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[name];

    if (typeof value !== 'string' || value.trim() === '') {
      res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: `Missing or invalid route parameter: ${name}`,
      });
      return;
    }

    next();
  };
};

export const getRequiredParam = (req: Request, name: string): string => {
  const value = req.params[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required route parameter after validation: ${name}`);
  }
  return value;
};
