import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { exportRegistrations } from '../services/export.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/exports/registrations — Export registration records to XLSX
 * Optional query parameter: ?domainId=...
 */
router.get('/registrations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domainId } = req.query;

    const buffer = await exportRegistrations({
      domainId: domainId as string | undefined,
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = domainId ? `registrations_${domainId}_${timestamp}.xlsx` : `all_registrations_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export { router as exportRoutes };

