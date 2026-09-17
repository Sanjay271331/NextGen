import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as domainService from '../services/domain.service.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  listAllDomains,
  saveDomain,
  getDomainByIdOrSlug,
  updateDomainRecord,
  deleteDomainRecord,
} from '../utils/persistentStore.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/domains
 */
router.get('/', requirePermission('domains:read'), async (_req: Request, res: Response) => {
  try {
    const domains = await domainService.listDomains();
    if (domains && domains.length > 0) {
      return res.json({ success: true, data: domains });
    }
  } catch {
    // Database offline fallback
  }

  const localDomains = listAllDomains();
  res.json({ success: true, data: localDomains });
});

/**
 * POST /api/domains
 */
router.post('/', requirePermission('domains:write'), async (req: Request, res: Response) => {
  const { name, slug } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ success: false, error: 'Name and slug are required' });
  }

  let domain: any = null;
  try {
    domain = await domainService.createDomain(req.body);
  } catch {
    // Database offline fallback
  }

  // Persist into store
  const saved = saveDomain({
    ...req.body,
    id: domain?.id,
  });

  try {
    await createAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: 'CREATE_DOMAIN',
      resource: 'domain',
      resourceId: saved.id,
      newValue: { name: saved.name, slug: saved.slug },
      ipAddress: req.ip,
    });
  } catch {}

  res.status(201).json({ success: true, data: saved });
});

/**
 * POST /api/domains/sync — Sync domains from admin UI to persistent store
 */
router.post('/sync', requirePermission('domains:write'), async (req: Request, res: Response) => {
  const { domains } = req.body;
  if (Array.isArray(domains)) {
    for (const d of domains) {
      if (d && d.name && d.slug) {
        saveDomain(d);
      }
    }
  }
  res.json({ success: true, data: listAllDomains() });
});

/**
 * GET /api/domains/:id
 */
router.get('/:id', requirePermission('domains:read'), async (req: Request, res: Response) => {
  try {
    const domain = await domainService.getDomain(req.params.id);
    if (domain) return res.json({ success: true, data: domain });
  } catch {}

  const local = getDomainByIdOrSlug(req.params.id);
  if (local) return res.json({ success: true, data: local });

  res.status(404).json({ success: false, error: 'Domain not found' });
});

/**
 * PUT /api/domains/:id
 */
router.put('/:id', requirePermission('domains:write'), async (req: Request, res: Response) => {
  let domain: any = null;
  try {
    domain = await domainService.updateDomain(req.params.id, req.body);
  } catch {}

  const updated = updateDomainRecord(req.params.id, req.body);

  try {
    await createAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: 'UPDATE_DOMAIN',
      resource: 'domain',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
  } catch {}

  res.json({ success: true, data: domain || updated });
});

/**
 * DELETE /api/domains/:id
 */
router.delete('/:id', requirePermission('domains:write'), async (req: Request, res: Response) => {
  try {
    await domainService.softDeleteDomain(req.params.id);
  } catch {}

  deleteDomainRecord(req.params.id);

  try {
    await createAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: 'DELETE_DOMAIN',
      resource: 'domain',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
  } catch {}

  res.json({ success: true, message: 'Domain archived' });
});

/**
 * GET /api/domains/:id/stats
 */
router.get('/:id/stats', requirePermission('domains:read'), async (req: Request, res: Response) => {
  try {
    const stats = await domainService.getDomainStats(req.params.id);
    return res.json({ success: true, data: stats });
  } catch {}

  const local = getDomainByIdOrSlug(req.params.id);
  res.json({
    success: true,
    data: {
      total: local?.registrationCount || 0,
      shortlisted: local?.shortlistedCount || 0,
      confirmed: 0,
      rejected: 0,
      byTrack: {},
    },
  });
});

export { router as domainRoutes };
