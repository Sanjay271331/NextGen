import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminRole } from '@ngb/shared';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditLog } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (_req, res: Response) => {
  const admins = await prisma.admin.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, isVerified: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: admins });
});

router.post('/', requireRole(AdminRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const { email, role } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) throw new AppError('Admin with this email already exists', 409);

  const admin = await prisma.admin.create({
    data: {
      email,
      name: email.split('@')[0],
      role: role || 'VIEWER',
      isActive: true,
      isVerified: false, // Must login via Google OAuth to verify Gmail ownership
    },
  });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'ADD_ADMIN', resource: 'admin', resourceId: admin.id,
    newValue: { email, role },
  });

  res.status(201).json({ success: true, data: admin });
});

router.put('/:id', requireRole(AdminRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  const { role, isActive } = req.body;
  const updateData: Record<string, unknown> = {};
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;

  const admin = await prisma.admin.update({ where: { id: req.params.id }, data: updateData });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UPDATE_ADMIN', resource: 'admin', resourceId: req.params.id,
    newValue: { role, isActive },
  });

  res.json({ success: true, data: admin });
});

router.delete('/:id', requireRole(AdminRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  if (req.params.id === req.admin!.id) throw new AppError('Cannot delete your own account', 400);

  await prisma.admin.update({ where: { id: req.params.id }, data: { isActive: false } });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'DEACTIVATE_ADMIN', resource: 'admin', resourceId: req.params.id,
  });

  res.json({ success: true, message: 'Admin deactivated' });
});

export { router as adminRoutes };
