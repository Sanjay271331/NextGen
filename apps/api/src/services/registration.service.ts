import { prisma } from '../utils/prisma.js';
import { generateRegistrationId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { RegistrationState } from '@ngb/shared';
import { queueEmailJob, queueSheetSyncJob } from '../jobs/index.js';
import { getDomainRegistrationState } from './domain.service.js';

/**
 * Register a new team/participant
 * Atomic transaction with duplicate detection
 */
export async function createRegistration(
  domainSlug: string,
  values: Record<string, unknown>,
) {
  // 1. Find domain
  const domain = await prisma.domain.findUnique({
    where: { slug: domainSlug },
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

  // 2. Check registration state
  const state = getDomainRegistrationState(domain);
  if (state === RegistrationState.NOT_STARTED) throw new AppError('Registration has not started yet', 400);
  if (state === RegistrationState.CLOSED) throw new AppError('Registration is closed', 400);
  if (state === RegistrationState.FULL) throw new AppError('Registration is full', 400);
  if (state === RegistrationState.PAUSED) {
    throw new AppError('Registration is currently paused. Both a published form and an assigned email template are required before registrations can open.', 403);
  }
  if (state === RegistrationState.DISABLED) throw new AppError('Registration is disabled', 400);

  // Email template assignment is strictly mandatory
  if (!domain.registrationEmailTemplateId) {
    throw new AppError('Registration cannot be accepted: An automated confirmation email template must be assigned to this event by an admin first.', 400);
  }

  // 3. Get published form version
  const formVersion = domain.form?.versions?.[0];
  if (!formVersion) throw new AppError('No published registration form available', 400);

  // 4. Validate required fields
  const fields = formVersion.fields;
  const validationErrors: { field: string; message: string }[] = [];

  for (const field of fields) {
    if (field.type === 'SECTION' || field.type === 'INFO_TEXT') continue;

    const value = values[field.name];
    if (field.required && (value === undefined || value === null || value === '')) {
      validationErrors.push({ field: field.name, message: `${field.label} is required` });
      continue;
    }

    // Type-specific validation
    if (value !== undefined && value !== null && value !== '') {
      const validation = field.validation as Record<string, unknown> | null;

      if (field.type === 'EMAIL' && typeof value === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          validationErrors.push({ field: field.name, message: 'Invalid email address' });
        }
      }

      if (field.type === 'PHONE' && typeof value === 'string') {
        if (!/^[\+]?[\d\s\-\(\)]{7,20}$/.test(value)) {
          validationErrors.push({ field: field.name, message: 'Invalid phone number' });
        }
      }

      if (validation?.minLength && typeof value === 'string' && value.length < (validation.minLength as number)) {
        validationErrors.push({ field: field.name, message: `Minimum ${validation.minLength} characters required` });
      }

      if (validation?.maxLength && typeof value === 'string' && value.length > (validation.maxLength as number)) {
        validationErrors.push({ field: field.name, message: `Maximum ${validation.maxLength} characters allowed` });
      }

      if (validation?.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern as string);
        if (!regex.test(value)) {
          validationErrors.push({
            field: field.name,
            message: (validation.patternMessage as string) || 'Invalid format',
          });
        }
      }
    }
  }

  if (validationErrors.length > 0) {
    throw new AppError(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`, 400);
  }

  // 5. Intelligent email search across submitted values
  const email = extractEmailFromSubmission(values, fields);
  const teamName = String(values.team_name || values.teamName || '').trim();
  const teamLeaderName = String(values.team_leader_name || values.teamLeaderName || values.participant_name || values.name || '').trim();
  const phone = String(values.phone || values.phone_number || '').trim() || null;

  if (!email) throw new AppError('A valid email address is required to register and receive confirmation', 400);

  // 6. Atomic transaction with duplicate check
  const result = await prisma.$transaction(async (tx) => {
    // Check duplicate email in this domain
    const existingEmail = await tx.registration.findFirst({
      where: {
        domainId: domain.id,
        email,
        deletedAt: null,
      },
    });

    if (existingEmail) {
      throw new AppError('A registration with this email already exists for this event', 409);
    }



    // Get sequence number atomically
    const count = await tx.registration.count({ where: { domainId: domain.id } });
    const registrationId = generateRegistrationId(count + 1);

    // Create registration
    const registration = await tx.registration.create({
      data: {
        registrationId,
        domainId: domain.id,
        formVersionId: formVersion.id,
        teamName: teamName || null,
        teamLeaderName: teamLeaderName || null,
        email,
        phone,
        status: 'REGISTERED',
        syncStatus: 'PENDING_SYNC',
        values: values as object,
      },
    });

    // Increment domain registration count
    await tx.domain.update({
      where: { id: domain.id },
      data: { registrationCount: { increment: 1 } },
    });

    return registration;
  });

  // 7. Queue background jobs (non-blocking)
  try {
    // Queue Google Sheet sync
    if (domain.spreadsheetId) {
      await queueSheetSyncJob({
        registrationId: result.id,
        domainId: domain.id,
        spreadsheetId: domain.spreadsheetId,
        worksheetName: domain.worksheetName || 'Registrations',
      });
    }

    // Queue confirmation email
    if (domain.registrationEmailTemplateId) {
      await queueEmailJob({
        registrationId: result.id,
        domainId: domain.id,
        templateId: domain.registrationEmailTemplateId,
        recipient: email,
        type: 'REGISTRATION_CONFIRMATION',
      });
    }
  } catch (err) {
    logger.error('Failed to queue background jobs', { error: (err as Error).message });
    // Don't fail the registration — jobs can be retried
  }

  logger.info('Registration created', {
    registrationId: result.registrationId,
    domain: domain.slug,
    email,
  });

  return {
    id: result.id,
    registrationId: result.registrationId,
    teamName: result.teamName,
    email: result.email,
    domainName: domain.name,
    status: result.status,
    createdAt: result.createdAt,
  };
}

/**
 * Get registration by ID for status lookup
 */
export async function getRegistrationStatus(registrationId: string, email: string) {
  const registration = await prisma.registration.findFirst({
    where: {
      registrationId,
      email: email.toLowerCase().trim(),
      deletedAt: null,
    },
    include: {
      domain: { select: { name: true, slug: true } },
    },
  });

  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  return {
    registrationId: registration.registrationId,
    teamName: registration.teamName,
    email: registration.email,
    status: registration.status,
    domainName: registration.domain.name,
    createdAt: registration.createdAt,
  };
}

/**
 * List registrations with filters (admin)
 */
export async function listRegistrations(filters: {
  domainId?: string;
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.domainId) where.domainId = filters.domainId;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { registrationId: { contains: filters.search, mode: 'insensitive' } },
      { teamName: { contains: filters.search, mode: 'insensitive' } },
      { teamLeaderName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: {
        domain: { select: { name: true, slug: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  return {
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

/**
 * Get single registration detail (admin)
 */
export async function getRegistration(id: string) {
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      domain: { select: { name: true, slug: true } },
      formVersion: {
        include: { fields: { orderBy: { order: 'asc' } } },
      },
      emailJobs: {
        select: { id: true, type: true, status: true, sentAt: true, error: true },
        orderBy: { createdAt: 'desc' },
      },
      sheetSyncJobs: {
        select: { id: true, status: true, syncedAt: true, error: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!registration) throw new AppError('Registration not found', 404);
  return registration;
}

/**
 * Update registration status (admin)
 */
export async function updateRegistrationStatus(
  id: string,
  status: string,
  adminId: string,
) {
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) throw new AppError('Registration not found', 404);

  const updated = await prisma.registration.update({
    where: { id },
    data: { status },
  });

  // Update domain shortlist count if status changed to/from SHORTLISTED
  if (status === 'SHORTLISTED' && registration.status !== 'SHORTLISTED') {
    await prisma.domain.update({
      where: { id: registration.domainId },
      data: { shortlistedCount: { increment: 1 } },
    });
  } else if (registration.status === 'SHORTLISTED' && status !== 'SHORTLISTED') {
    await prisma.domain.update({
      where: { id: registration.domainId },
      data: { shortlistedCount: { decrement: 1 } },
    });
  }

  return updated;
}

/**
 * Soft delete registration (admin)
 */
export async function softDeleteRegistration(
  id: string,
  adminId: string,
  reason?: string,
) {
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) throw new AppError('Registration not found', 404);

  await prisma.$transaction([
    prisma.registration.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: adminId,
        deletionReason: reason || 'Deleted by admin',
      },
    }),
    prisma.domain.update({
      where: { id: registration.domainId },
      data: { registrationCount: { decrement: 1 } },
    }),
  ]);

  return { success: true };
}

/**
 * Restore soft-deleted registration
 */
export async function restoreRegistration(id: string) {
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) throw new AppError('Registration not found', 404);
  if (!registration.deletedAt) throw new AppError('Registration is not deleted', 400);

  await prisma.$transaction([
    prisma.registration.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null, deletionReason: null },
    }),
    prisma.domain.update({
      where: { id: registration.domainId },
      data: { registrationCount: { increment: 1 } },
    }),
  ]);

  return { success: true };
}

/**
 * Intelligently search for the participant email across submitted values
 */
export function extractEmailFromSubmission(
  values: Record<string, unknown>,
  fields: Array<{ type: string; name: string }>,
): string {
  // 1. Direct check on common field keys
  const priorityKeys = [
    'email', 'mail', 'email_address', 'team_leader_email', 'leader_email',
    'participant_email', 'contact_email', 'user_email', 'primary_email',
  ];
  for (const key of priorityKeys) {
    const val = values[key];
    if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      return val.toLowerCase().trim();
    }
  }

  // 2. Search by form field definition where type is EMAIL
  for (const field of fields) {
    if (field.type === 'EMAIL') {
      const val = values[field.name];
      if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        return val.toLowerCase().trim();
      }
    }
  }

  // 3. Search by field name matching email / mail
  for (const field of fields) {
    if (/email|mail/i.test(field.name)) {
      const val = values[field.name];
      if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        return val.toLowerCase().trim();
      }
    }
  }

  // 4. Scan all string values for a valid email format
  for (const [_, val] of Object.entries(values)) {
    if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      return val.toLowerCase().trim();
    }
  }

  return '';
}

