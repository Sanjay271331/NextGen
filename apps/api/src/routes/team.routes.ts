import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { createAuditLog } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/teams
 */
router.get('/', requirePermission('teams:read'), async (req: Request, res: Response) => {
  const { domainId, status, search, page = '1', pageSize = '25' } = req.query;
  const where: Record<string, unknown> = { deletedAt: null };

  if (domainId) where.domainId = domainId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { teamName: { contains: search as string, mode: 'insensitive' } },
      { teamLeaderName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { registrationId: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: { domain: { select: { name: true } } },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  res.json({ success: true, data, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) });
});

/**
 * GET /api/teams/:id
 */
router.get('/:id', requirePermission('teams:read'), async (req, res: Response) => {
  const reg = await prisma.registration.findUnique({
    where: { id: req.params.id },
    include: {
      domain: true,
      formVersion: { include: { fields: { orderBy: { order: 'asc' } } } },
      emailJobs: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!reg) { res.status(404).json({ success: false, error: 'Team not found' }); return; }
  res.json({ success: true, data: reg });
});

/**
 * PUT /api/teams/:id
 */
router.put('/:id', requirePermission('teams:write'), async (req: Request, res: Response) => {
  const { teamName, teamLeaderName, email, phone, status, values } = req.body;
  const updateData: Record<string, unknown> = {};
  if (teamName !== undefined) updateData.teamName = teamName;
  if (teamLeaderName !== undefined) updateData.teamLeaderName = teamLeaderName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (status !== undefined) updateData.status = status;
  if (values !== undefined) updateData.values = values;

  const updated = await prisma.registration.update({
    where: { id: req.params.id },
    data: updateData,
  });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UPDATE_TEAM', resource: 'team', resourceId: req.params.id,
  });

  res.json({ success: true, data: updated });
});

export { router as teamRoutes };
