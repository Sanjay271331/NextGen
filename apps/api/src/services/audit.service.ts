import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: {
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: 'SUCCESS' | 'FAILURE';
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: data.adminId,
        adminEmail: data.adminEmail,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        oldValue: data.oldValue as object || undefined,
        newValue: data.newValue as object || undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        result: data.result || 'SUCCESS',
      },
    });
  } catch (err) {
    // Audit logging should never break the main operation
    logger.error('Failed to create audit log', { error: (err as Error).message, action: data.action });
  }
}

/**
 * List audit logs with filters
 */
export async function listAuditLogs(filters: {
  adminId?: string;
  action?: string;
  resource?: string;
  page: number;
  pageSize: number;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.action) where.action = filters.action;
  if (filters.resource) where.resource = filters.resource;
  if (filters.search) {
    where.OR = [
      { adminEmail: { contains: filters.search, mode: 'insensitive' } },
      { action: { contains: filters.search, mode: 'insensitive' } },
      { resource: { contains: filters.search, mode: 'insensitive' } },
      { resourceId: { contains: filters.search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { name: true, email: true } } },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}
