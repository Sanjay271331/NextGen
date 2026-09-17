import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';
import { registrationFilterSchema } from '@ngb/shared';
import * as regService from '../services/registration.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { queueEmailJob } from '../jobs/index.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('registrations:read'), validateQuery(registrationFilterSchema), async (req: Request, res: Response) => {
  const result = await regService.listRegistrations(req.query as any);
  res.json({ success: true, ...result });
});

router.get('/:id', requirePermission('registrations:read'), async (req, res: Response) => {
  const reg = await regService.getRegistration(req.params.id);
  res.json({ success: true, data: reg });
});

router.put('/:id/status', requirePermission('registrations:write'), async (req: Request, res: Response) => {
  const { status } = req.body;
  const reg = await regService.updateRegistrationStatus(req.params.id, status, req.admin!.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: `UPDATE_STATUS_${status}`, resource: 'registration', resourceId: req.params.id,
  });
  res.json({ success: true, data: reg });
});

router.delete('/:id', requirePermission('registrations:write'), async (req: Request, res: Response) => {
  await regService.softDeleteRegistration(req.params.id, req.admin!.id, req.body.reason);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'DELETE_REGISTRATION', resource: 'registration', resourceId: req.params.id,
  });
  res.json({ success: true, message: 'Registration archived' });
});

router.post('/:id/restore', requirePermission('registrations:write'), async (req: Request, res: Response) => {
  await regService.restoreRegistration(req.params.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'RESTORE_REGISTRATION', resource: 'registration', resourceId: req.params.id,
  });
  res.json({ success: true, message: 'Registration restored' });
});

router.post('/:id/resend-email', requirePermission('emails:write'), async (req: Request, res: Response) => {
  const reg = await regService.getRegistration(req.params.id);
  const domain = reg.domain as any;

  // Find the template and queue email
  const { prisma } = await import('../utils/prisma.js');
  const fullDomain = await prisma.domain.findUnique({ where: { id: reg.domainId } });

  if (fullDomain?.registrationEmailTemplateId) {
    await queueEmailJob({
      registrationId: reg.id,
      domainId: reg.domainId,
      templateId: fullDomain.registrationEmailTemplateId,
      recipient: reg.email,
      type: 'REGISTRATION_CONFIRMATION',
    });
  }

  res.json({ success: true, message: 'Email resend queued' });
});

// Bulk operations
router.post('/bulk/status', requirePermission('registrations:write'), async (req: Request, res: Response) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    res.status(400).json({ success: false, error: 'ids array and status required' });
    return;
  }

  let updated = 0;
  for (const id of ids) {
    try {
      await regService.updateRegistrationStatus(id, status, req.admin!.id);
      updated++;
    } catch { /* skip invalid */ }
  }

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: `BULK_STATUS_${status}`, resource: 'registration',
    newValue: { count: updated },
  });

  res.json({ success: true, data: { updated, total: ids.length } });
});

router.post('/bulk/delete', requirePermission('registrations:write'), async (req: Request, res: Response) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids)) {
    res.status(400).json({ success: false, error: 'ids array required' });
    return;
  }

  let deleted = 0;
  for (const id of ids) {
    try {
      await regService.softDeleteRegistration(id, req.admin!.id, reason);
      deleted++;
    } catch { /* skip invalid */ }
  }

  res.json({ success: true, data: { deleted, total: ids.length } });
});

export { router as registrationRoutes };
