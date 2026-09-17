import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { exportRegistrations } from '../services/export.service.js';
import { createAuditLog } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/exports/registrations — Export registrations as XLSX
 */
router.get('/registrations', requirePermission('exports:read'), async (req: Request, res: Response) => {
  const { domainId, status, type, ids } = req.query;

  const buffer = await exportRegistrations({
    domainId: domainId as string,
    status: status as string,
    type: (type as 'all' | 'shortlisted' | 'registered' | 'rejected') || 'all',
    ids: ids ? (ids as string).split(',') : undefined,
  });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'EXPORT_REGISTRATIONS', resource: 'export',
    newValue: { domainId, type, status },
  });

  const filename = `registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * GET /api/exports/shortlist — Export shortlisted teams as XLSX
 */
router.get('/shortlist', requirePermission('exports:read'), async (req: Request, res: Response) => {
  const { domainId } = req.query;

  const buffer = await exportRegistrations({
    domainId: domainId as string,
    type: 'shortlisted',
  });

  const filename = `shortlist_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

export { router as exportRoutes };
