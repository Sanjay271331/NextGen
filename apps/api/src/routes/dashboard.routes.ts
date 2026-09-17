import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { isFirebaseConfigured } from '../services/firebase.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard — Minimal administrator overview counts
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [
      totalRegistrations,
      activeDomains,
      totalDomains,
      totalForms,
      googleIntegration,
    ] = await Promise.all([
      prisma.registration.count({ where: { deletedAt: null } }),
      prisma.domain.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.domain.count({ where: { deletedAt: null } }),
      prisma.form.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      prisma.googleIntegration.findFirst({ where: { isActive: true } }),
    ]);

    res.json({
      success: true,
      data: {
        totalRegistrations,
        activeDomains,
        totalDomains,
        totalForms,
        sheetsConnected: Boolean(googleIntegration?.sheetsConnected),
        connectedGoogleEmail: googleIntegration?.email || null,
        firebaseConnected: isFirebaseConfigured(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Unable to query database for dashboard statistics.',
    });
  }
});

export { router as dashboardRoutes };
