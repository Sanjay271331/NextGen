import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminRole } from '@ngb/shared';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) {
      settingsMap[s.key] = typeof s.value === 'string' ? JSON.parse(s.value || '{}') : s.value;
    }
    res.json({ success: true, data: settingsMap });
  } catch (err) {
    next(err);
  }
});

router.put('/', requireRole(AdminRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: valStr },
        update: { value: valStr },
      });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
});

export { router as settingsRoutes };

