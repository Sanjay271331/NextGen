import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminRole } from '@ngb/shared';
import * as auditService from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN));

router.get('/', async (req: Request, res: Response) => {
  const { page = '1', pageSize = '25', action, resource, search } = req.query;
  const result = await auditService.listAuditLogs({
    action: action as string,
    resource: resource as string,
    search: search as string,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.json({ success: true, ...result });
});

export { router as auditRoutes };
