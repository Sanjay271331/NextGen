import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminRole } from '@ngb/shared';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (req: Request, res: Response) => {
  const settings = await prisma.systemSetting.findMany();
  const settingsMap: Record<string, unknown> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }
  res.json({ success: true, data: settingsMap });
});

router.put('/', requireRole(AdminRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }
  res.json({ success: true, message: 'Settings updated' });
});

export { router as settingsRoutes };
