// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.routes.ts
// PURPOSE: Global search route mounted on the API.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { searchController } from '../../controller/search/search.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', searchController.search);

export const searchRouter = router;
