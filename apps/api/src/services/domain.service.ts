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
  form?: {
    versions?: Array<{ publishedAt?: Date | null }>;
  } | null;
}): RegistrationState {
  if (domain.status !== 'ACTIVE') return RegistrationState.DISABLED;

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
  status?: string;
}) {
  const normalizedSlug = data.slug.toLowerCase().trim();

  // Check slug uniqueness
  const existing = await prisma.domain.findUnique({ where: { slug: normalizedSlug } });
  if (existing) throw new AppError('A domain with this slug already exists', 409);

  // Check if a global form is published to link automatically
  const globalForm = await prisma.form.findFirst({
    where: { isGlobal: true, status: 'PUBLISHED', deletedAt: null },
  });

  const domain = await prisma.domain.create({
    data: {
      name: data.name.trim(),
      slug: normalizedSlug,
      description: data.description,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      registrationStart: data.registrationStart ? new Date(data.registrationStart) : null,
      registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : null,
      maxRegistrations: data.maxRegistrations,
      spreadsheetId: data.spreadsheetId,
      worksheetName: data.worksheetName || 'Registrations',
      formId: globalForm?.id || null,
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
      form: { select: { id: true, title: true, status: true, isGlobal: true } },
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
            where: { publishedAt: { not: null } },
            orderBy: { version: 'desc' },
            take: 1,
            include: { fields: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });

  if (!domain || domain.deletedAt) throw new AppError('Domain not found', 404);
  return domain;
}

/**
 * Get domain by slug (for public registration)
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

  if (!domain || domain.deletedAt) return null;

  // If domain has no form or no version, fallback to global form
  if (!domain.form?.versions?.[0]) {
    const globalForm = await prisma.form.findFirst({
      where: { isGlobal: true, status: 'PUBLISHED', deletedAt: null },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: 'desc' },
          take: 1,
          include: { fields: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (globalForm?.versions?.[0]) {
      return { ...domain, form: globalForm };
    }
  }

  return domain;
}

/**
 * Update domain
 */
export async function updateDomain(id: string, data: {
  name?: string;
  slug?: string;
  description?: string;
  eventDate?: string;
  registrationStart?: string;
  registrationEnd?: string;
  maxRegistrations?: number;
  spreadsheetId?: string;
  worksheetName?: string;
  status?: string;
  formId?: string | null;
}) {
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain || domain.deletedAt) throw new AppError('Domain not found', 404);

  if (data.slug && data.slug !== domain.slug) {
    const existing = await prisma.domain.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('A domain with this slug already exists', 409);
  }

  const updated = await prisma.domain.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name.trim() : undefined,
      slug: data.slug !== undefined ? data.slug.toLowerCase().trim() : undefined,
      description: data.description !== undefined ? data.description : undefined,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      registrationStart: data.registrationStart ? new Date(data.registrationStart) : undefined,
      registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : undefined,
      maxRegistrations: data.maxRegistrations !== undefined ? data.maxRegistrations : undefined,
      spreadsheetId: data.spreadsheetId !== undefined ? data.spreadsheetId : undefined,
      worksheetName: data.worksheetName !== undefined ? data.worksheetName : undefined,
      status: data.status !== undefined ? data.status : undefined,
      formId: data.formId !== undefined ? data.formId : undefined,
    },
  });

  logger.info('Domain updated', { id });
  return updated;
}

/**
 * Soft delete domain
 */
export async function softDeleteDomain(id: string) {
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) throw new AppError('Domain not found', 404);

  await prisma.domain.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  logger.info('Domain archived', { id });
  return { success: true };
}
