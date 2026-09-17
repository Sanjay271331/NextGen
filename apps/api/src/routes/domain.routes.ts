import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as domainService from '../services/domain.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/domains — List all domains
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const domains = await domainService.listDomains();
    res.json({ success: true, data: domains });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/domains — Create a new domain
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }

    const domain = await domainService.createDomain(req.body);
    res.status(201).json({ success: true, data: domain });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/domains/:id — Get domain by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = await domainService.getDomain(req.params.id);
    res.json({ success: true, data: domain });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/domains/:id — Update a domain
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = await domainService.updateDomain(req.params.id, req.body);
    res.json({ success: true, data: domain });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/domains/:id/status — Toggle domain active/inactive status
 */
router.post('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be ACTIVE or INACTIVE' });
    }

    const domain = await domainService.updateDomain(req.params.id, { status });
    res.json({ success: true, data: domain });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/domains/:id — Archive/delete domain
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await domainService.softDeleteDomain(req.params.id);
    res.json({ success: true, message: 'Domain archived successfully' });
  } catch (err) {
    next(err);
  }
});

export { router as domainRoutes };
