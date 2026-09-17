import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { RegistrationState } from '@ngb/shared';

/**
 * Get domain registration state
 */
export function getDomainRegistrationState(domain: {
  status: string;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  maxRegistrations: number | null;
  registrationCount: number;
  registrationEmailTemplateId?: string | null;
  form?: {
    versions?: Array<{ publishedAt?: Date | null }>;
  } | null;
}): RegistrationState {
  if (domain.status !== 'ACTIVE') return RegistrationState.DISABLED;

  // Both published form AND assigned email template are strictly mandatory!
  // If either is missing, registration is paused.
  const hasPublishedForm = Boolean(
    domain.form?.versions &&
    domain.form.versions.some(v => v.publishedAt !== null && v.publishedAt !== undefined)
  );
  const hasAssignedEmail = Boolean(
    domain.registrationEmailTemplateId &&
    domain.registrationEmailTemplateId.trim().length > 0
  );

  if (!hasPublishedForm || !hasAssignedEmail) {
    return RegistrationState.PAUSED;
  }

  const now = new Date();
  if (domain.registrationStart && now < domain.registrationStart) return RegistrationState.NOT_STARTED;
  if (domain.registrationEnd && now > domain.registrationEnd) return RegistrationState.CLOSED;
  if (domain.maxRegistrations && domain.registrationCount >= domain.maxRegistrations) return RegistrationState.FULL;
  return RegistrationState.OPEN;
}

/**
 * Create a new domain/event
 */
export async function createDomain(data: {
  name: string;
  slug: string;
  description?: string;
  eventDate?: string;
  registrationStart?: string;
  registrationEnd?: string;
  maxRegistrations?: number;
  spreadsheetId?: string;
  worksheetName?: string;
  driveFolderId?: string;
  registrationEmailTemplateId?: string;
  shortlistEmailTemplateId?: string;
  status?: string;
}) {
  // Check slug uniqueness
  const existing = await prisma.domain.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError('A domain with this slug already exists', 409);

  const domain = await prisma.domain.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      registrationStart: data.registrationStart ? new Date(data.registrationStart) : null,
      registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : null,
      maxRegistrations: data.maxRegistrations,
      spreadsheetId: data.spreadsheetId,
      worksheetName: data.worksheetName || 'Registrations',
      driveFolderId: data.driveFolderId,
      registrationEmailTemplateId: data.registrationEmailTemplateId,
      shortlistEmailTemplateId: data.shortlistEmailTemplateId,
      status: data.status || 'ACTIVE',
    },
  });

  logger.info('Domain created', { id: domain.id, name: domain.name, slug: domain.slug });
  return domain;
}

/**
 * List all domains
 */
export async function listDomains(includeArchived = false) {
  const where = includeArchived ? {} : { deletedAt: null };
  return prisma.domain.findMany({
    where,
    include: {
      form: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get domain by ID
 */
export async function getDomain(id: string) {
  const domain = await prisma.domain.findUnique({
    where: { id },
    include: {
      form: {
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { fields: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
  if (!domain) throw new AppError('Domain not found', 404);
  return domain;
}

/**
 * Get domain by slug (public)
 */
export async function getDomainBySlug(slug: string) {
  const domain = await prisma.domain.findUnique({
    where: { slug },
    include: {
      form: {
        include: {
          versions: {
            where: { publishedAt: { not: null } },
            orderBy: { version: 'desc' },
            take: 1,
            include: { fields: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
  if (!domain) throw new AppError('Event not found', 404);
  return domain;
}

/**
 * Update domain
 */
export async function updateDomain(id: string, data: Record<string, unknown>) {
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) throw new AppError('Domain not found', 404);

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== domain.slug) {
    const existing = await prisma.domain.findUnique({ where: { slug: data.slug as string } });
    if (existing) throw new AppError('A domain with this slug already exists', 409);
  }

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'slug', 'description', 'maxRegistrations',
    'spreadsheetId', 'worksheetName', 'driveFolderId',
    'registrationEmailTemplateId', 'shortlistEmailTemplateId',
    'status', 'formId',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  // Handle date fields
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate as string) : null;
  if (data.registrationStart !== undefined) updateData.registrationStart = data.registrationStart ? new Date(data.registrationStart as string) : null;
  if (data.registrationEnd !== undefined) updateData.registrationEnd = data.registrationEnd ? new Date(data.registrationEnd as string) : null;

  return prisma.domain.update({ where: { id }, data: updateData });
}

/**
 * Soft delete domain
 */
export async function softDeleteDomain(id: string) {
  const domain = await prisma.domain.findUnique({
    where: { id },
    include: {
      _count: { select: { registrations: true } },
    },
  });
  if (!domain) throw new AppError('Domain not found', 404);

  return prisma.domain.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
}

/**
 * Get domain statistics
 */
export async function getDomainStats(id: string) {
  const [registrationsByStatus, recentRegistrations] = await Promise.all([
    prisma.registration.groupBy({
      by: ['status'],
      where: { domainId: id, deletedAt: null },
      _count: { id: true },
    }),
    prisma.registration.findMany({
      where: { domainId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, registrationId: true, teamName: true,
        email: true, status: true, createdAt: true,
      },
    }),
  ]);

  return {
    registrationsByStatus: registrationsByStatus.map(r => ({
      status: r.status,
      count: r._count.id,
    })),
    recentRegistrations,
  };
}
