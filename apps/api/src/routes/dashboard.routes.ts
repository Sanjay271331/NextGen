import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard — Dashboard stats
 */
router.get('/', requirePermission('domains:read'), async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalRegistrations,
    registrationsToday,
    registrationsThisWeek,
    totalDomains,
    activeDomains,
    registrationsByStatus,
    registrationsByDomain,
    emailsSent,
    emailsFailed,
    syncPending,
    syncFailed,
    emailQueuePending,
    recentRegistrations,
    activeForms,
  ] = await Promise.all([
    prisma.registration.count({ where: { deletedAt: null } }),
    prisma.registration.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
    prisma.registration.count({ where: { deletedAt: null, createdAt: { gte: weekStart } } }),
    prisma.domain.count({ where: { deletedAt: null } }),
    prisma.domain.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.registration.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    }),
    prisma.registration.groupBy({
      by: ['domainId'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.emailLog.count({ where: { status: 'SENT' } }),
    prisma.emailLog.count({ where: { status: 'FAILED' } }),
    prisma.registration.count({ where: { syncStatus: 'PENDING_SYNC' } }),
    prisma.registration.count({ where: { syncStatus: 'SYNC_FAILED' } }),
    prisma.emailJob.count({ where: { status: { in: ['QUEUED', 'SENDING'] } } }),
    prisma.registration.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, registrationId: true, teamName: true,
        email: true, status: true, createdAt: true,
        domain: { select: { name: true } },
      },
    }),
    prisma.form.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
  ]);

  // Get domain names for the domain breakdown
  const domainIds = registrationsByDomain.map(r => r.domainId);
  const domains = await prisma.domain.findMany({
    where: { id: { in: domainIds } },
    select: { id: true, name: true },
  });
  const domainMap = new Map(domains.map(d => [d.id, d.name]));

  const statusMap: Record<string, number> = {};
  for (const s of registrationsByStatus) {
    statusMap[s.status] = s._count.id;
  }

  res.json({
    success: true,
    data: {
      totalRegistrations,
      registrationsToday,
      registrationsThisWeek,
      totalDomains,
      activeDomains,
      shortlistedTeams: statusMap['SHORTLISTED'] || 0,
      rejectedTeams: statusMap['REJECTED'] || 0,
      pendingTeams: statusMap['UNDER_REVIEW'] || 0,
      emailsSent,
      emailsFailed,
      activeForms,
      syncPending,
      syncFailed,
      emailQueuePending,
      emailQueueFailed: emailsFailed,
      registrationsByDomain: registrationsByDomain.map(r => ({
        domain: domainMap.get(r.domainId) || 'Unknown',
        count: r._count.id,
      })),
      recentRegistrations,
    },
  });
});

export { router as dashboardRoutes };
