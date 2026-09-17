import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { createFormSchema, updateFormSchema } from '@ngb/shared';
import * as formService from '../services/form.service.js';
import { createAuditLog } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('forms:read'), async (_req, res: Response) => {
  const forms = await formService.listForms();
  res.json({ success: true, data: forms });
});

router.post('/', requirePermission('forms:write'), validateBody(createFormSchema), async (req: Request, res: Response) => {
  const form = await formService.createForm(req.body);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'CREATE_FORM', resource: 'form', resourceId: form.id,
  });
  res.status(201).json({ success: true, data: form });
});

router.get('/:id', requirePermission('forms:read'), async (req, res: Response) => {
  const form = await formService.getForm(req.params.id);
  res.json({ success: true, data: form });
});

router.put('/:id', requirePermission('forms:write'), validateBody(updateFormSchema), async (req: Request, res: Response) => {
  const form = await formService.updateForm(req.params.id, req.body);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UPDATE_FORM', resource: 'form', resourceId: req.params.id,
  });
  res.json({ success: true, data: form });
});

router.post('/publish', requirePermission('forms:write'), async (req: Request, res: Response) => {
  const { domainId, domainSlug, title, description, fields, status } = req.body;
  const targetKey = domainSlug || domainId;
  if (!targetKey) {
    return res.status(400).json({ success: false, error: 'Domain ID or Slug is required' });
  }

  const { saveDomainForm } = await import('../utils/persistentStore.js');
  const updated = saveDomainForm(targetKey, {
    title: title || 'Registration Form',
    description: description || null,
    status: status || 'PUBLISHED',
    fields: Array.isArray(fields) ? fields : [],
  });

  try {
    await createAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: 'PUBLISH_FORM',
      resource: 'form',
      resourceId: targetKey,
      newValue: { title, fieldCount: fields?.length },
    });
  } catch {}

  res.json({
    success: true,
    data: updated,
    message: 'Form successfully uploaded and published to public registration UI!',
  });
});

router.post('/:id/publish', requirePermission('forms:write'), async (req: Request, res: Response) => {
  const result = await formService.publishForm(req.params.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'PUBLISH_FORM', resource: 'form', resourceId: req.params.id,
  });
  res.json({ success: true, data: result });
});

router.post('/:id/unpublish', requirePermission('forms:write'), async (req: Request, res: Response) => {
  const result = await formService.unpublishForm(req.params.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UNPUBLISH_FORM', resource: 'form', resourceId: req.params.id,
  });
  res.json({ success: true, data: result });
});

router.post('/:id/clone', requirePermission('forms:write'), async (req: Request, res: Response) => {
  const form = await formService.cloneForm(req.params.id);
  res.status(201).json({ success: true, data: form });
});

router.delete('/:id', requirePermission('forms:write'), async (req: Request, res: Response) => {
  await formService.softDeleteForm(req.params.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'DELETE_FORM', resource: 'form', resourceId: req.params.id,
  });
  res.json({ success: true, message: 'Form archived' });
});

export { router as formRoutes };
