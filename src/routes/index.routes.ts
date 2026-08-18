import { authRouter } from './auth/auth.routes';
import { Router } from 'express';

const routes = Router();

//
routes.use('/auth', authRouter);

export default routes;
