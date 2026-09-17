import { Request, Response, NextFunction } from 'express';
import { ROLE_PERMISSIONS, AdminRole } from '@ngb/shared';
import { prisma } from '../utils/prisma.js';
import { AppError } from './errorHandler.js';

/**
 * Require authenticated admin session
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const session = req.session as unknown as Record<string, unknown>;

  if (!session?.adminId || !session?.adminEmail) {
    throw new AppError('Authentication required', 401);
  }

  req.admin = {
    id: session.adminId as string,
    email: session.adminEmail as string,
    name: session.adminName as string || '',
    role: session.adminRole as string || 'VIEWER',
  };

  next();
}

/**
 * Require specific permission
 */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      throw new AppError('Authentication required', 401);
    }

    const role = req.admin.role as AdminRole;
    const rolePerms = ROLE_PERMISSIONS[role] || [];

    // SUPER_ADMIN has wildcard access
    if (rolePerms.includes('*')) {
      next();
      return;
    }

    const hasPermission = permissions.some(perm => rolePerms.includes(perm));
    if (!hasPermission) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
}

/**
 * Require specific role level
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      throw new AppError('Authentication required', 401);
    }

    if (!roles.includes(req.admin.role as AdminRole)) {
      throw new AppError('Insufficient role privileges', 403);
    }

    next();
  };
}

/**
 * Verify admin is still active in DB (for sensitive ops)
 */
export async function verifyAdminActive(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.admin) {
    throw new AppError('Authentication required', 401);
  }

  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: { isActive: true, role: true },
  });

  if (!admin || !admin.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  // Update role from DB in case it changed
  req.admin.role = admin.role;
  next();
}
