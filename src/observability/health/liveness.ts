import { Request, Response } from 'express';

export const livenessHandler = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
};
