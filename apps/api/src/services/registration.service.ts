import { prisma } from '../utils/prisma.js';
import { generateRegistrationId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { RegistrationState } from '@ngb/shared';
import { getDomainRegistrationState } from './domain.service.js';
import { appendToSheet, setSheetHeaders } from '../google/sheets.js';
import { syncRegistrationToFirebase } from './firebase.service.js';

/**
 * Register a new team/participant
 * Atomic transaction with PostgreSQL duplicate prevention and Google Sheets append.
 */
export async function createRegistration(
  domainSlug: string,
  values: Record<string, unknown>,
) {
  // 1. Find domain
  const domain = await prisma.domain.findUnique({
    where: { slug: domainSlug.toLowerCase().trim() },
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

  if (!domain || domain.deletedAt) {
    throw new AppError('Event track not found or inactive.', 404);
  }

  // 2. Check registration state
  const state = getDomainRegistrationState(domain);
  if (state === RegistrationState.NOT_STARTED) throw new AppError('Registration has not started yet.', 400);
  if (state === RegistrationState.CLOSED) throw new AppError('Registration is closed for this event.', 400);
  if (state === RegistrationState.FULL) throw new AppError('Registration limit has been reached for this event.', 400);
  if (state === RegistrationState.DISABLED) throw new AppError('Registration is currently disabled.', 400);

  // 3. Get published form version (domain-specific or global)
  let formVersion = domain.form?.versions?.[0];
  if (!formVersion) {
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
    formVersion = globalForm?.versions?.[0];
  }

  if (!formVersion) {
    throw new AppError('Registration form is not yet published for this track.', 400);
  }

  // 4. Validate form fields
  const fields = formVersion.fields;
  const validationErrors: { field: string; message: string }[] = [];

  for (const field of fields) {
    const val = values[field.name];

    if (field.required && (val === undefined || val === null || val === '')) {
      validationErrors.push({ field: field.name, message: `${field.label} is required.` });
      continue;
    }

    if (val !== undefined && val !== null && val !== '') {
      if (field.type === 'EMAIL' && typeof val === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
          validationErrors.push({ field: field.name, message: 'Invalid email address format.' });
        }
      }
      if (field.type === 'PHONE' && typeof val === 'string') {
        if (!/^[\+]?[\d\s\-\(\)]{7,20}$/.test(val.trim())) {
          validationErrors.push({ field: field.name, message: 'Invalid phone number format.' });
        }
      }
    }
  }

  if (validationErrors.length > 0) {
    throw new AppError(validationErrors[0].message, 400);
  }

  // 5. Extract and normalize participant email
  let rawEmail = String(
    values.email || values.team_leader_email || values.contact_email || ''
  ).trim();

  // If not found in standard keys, search form fields by type or label
  if (!rawEmail) {
    for (const field of formVersion.fields) {
      if (field.type === 'EMAIL' && values[field.name]) {
        rawEmail = String(values[field.name]).trim();
        break;
      }
      if (field.name.toLowerCase().includes('email') && values[field.name]) {
        rawEmail = String(values[field.name]).trim();
        break;
      }
      if (field.label.toLowerCase().includes('email') && values[field.name]) {
        rawEmail = String(values[field.name]).trim();
        break;
      }
    }
  }

  // If still not found, scan any value that looks like an email
  if (!rawEmail) {
    for (const val of Object.values(values)) {
      if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        rawEmail = val.trim();
        break;
      }
    }
  }

  if (!rawEmail) {
    throw new AppError('Email address is required for registration.', 400);
  }

  const normalizedEmail = rawEmail.toLowerCase();

  // Extract phone
  let phone = values.phone ? String(values.phone).trim() : null;
  if (!phone) {
    for (const field of formVersion.fields) {
      const lower = field.label.toLowerCase();
      if ((field.type === 'PHONE' || lower.includes('phone') || lower.includes('number') || lower.includes('mobile')) && values[field.name]) {
        phone = String(values[field.name]).trim();
        break;
      }
    }
  }

  // Extract team metadata
  let teamName = String(values.team_name || values.teamName || '').trim();
  let teamLeaderName = String(values.team_leader_name || values.leader_name || '').trim();

  if (!teamName || !teamLeaderName) {
    for (const field of formVersion.fields) {
      const lower = field.label.toLowerCase();
      if (!teamLeaderName && (lower.includes('leader') || lower.includes('name'))) {
        teamLeaderName = String(values[field.name] || '').trim();
      }
      if (!teamName && (lower.includes('team') || lower.includes('project'))) {
        teamName = String(values[field.name] || '').trim();
      }
    }
  }

  teamName = teamName || teamLeaderName || 'Participant';
  teamLeaderName = teamLeaderName || teamName;

  // 6. Strict Duplicate Gmail / Email Prevention
  const existingReg = await prisma.registration.findFirst({
    where: {
      domainId: domain.id,
      email: normalizedEmail,
      deletedAt: null,
    },
  });

  if (existingReg) {
    throw new AppError('This email address has already been used for registration in this track.', 409);
  }

  // 7. Atomic Database Transaction
  const regId = generateRegistrationId();

  const registration = await prisma.$transaction(async (tx) => {
    // Concurrent check inside transaction
    const duplicateInsideTx = await tx.registration.findFirst({
      where: {
        domainId: domain.id,
        email: normalizedEmail,
        deletedAt: null,
      },
    });

    if (duplicateInsideTx) {
      throw new AppError('This email address has already been used for registration in this track.', 409);
    }

    const created = await tx.registration.create({
      data: {
        registrationId: regId,
        domainId: domain.id,
        formVersionId: formVersion.id,
        teamName,
        teamLeaderName,
        email: normalizedEmail,
        phone,
        values: JSON.stringify(values),
        status: 'REGISTERED',
        syncStatus: 'PENDING_SYNC',
      },
    });

    await tx.domain.update({
      where: { id: domain.id },
      data: { registrationCount: { increment: 1 } },
    });

    return created;
  });

  logger.info('Registration created in PostgreSQL', {
    registrationId: registration.registrationId,
    domain: domain.slug,
    email: normalizedEmail,
  });

  // 8. Automatic Google Sheets Storage
  const spreadsheetId = domain.spreadsheetId || process.env.GOOGLE_DEFAULT_SPREADSHEET_ID;
  if (spreadsheetId) {
    try {
      const worksheet = domain.worksheetName || 'Registrations';

      // Build header row dynamically from standard info + form fields
      const standardHeaders = ['Registration ID', 'Timestamp (UTC)', 'Domain Track', 'Team Name', 'Team Leader', 'Email', 'Phone'];
      const fieldHeaders = formVersion.fields.map(f => f.label);
      const allHeaders = Array.from(new Set([...standardHeaders, ...fieldHeaders]));

      await setSheetHeaders(spreadsheetId, worksheet, allHeaders);

      // Construct values row aligned with headers
      const rowData = [
        registration.registrationId,
        registration.createdAt.toISOString(),
        domain.name,
        registration.teamName || '',
        registration.teamLeaderName || '',
        registration.email,
        registration.phone || '',
      ];

      for (const field of formVersion.fields) {
        const val = values[field.name];
        rowData.push(val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '');
      }

      await appendToSheet(spreadsheetId, worksheet, rowData);

      await prisma.registration.update({
        where: { id: registration.id },
        data: { syncStatus: 'SYNCED', syncedAt: new Date() },
      });

      logger.info('Registration row appended to Google Sheet', {
        registrationId: registration.registrationId,
        spreadsheetId,
      });
    } catch (sheetErr) {
      logger.warn('Google Sheet synchronization failed, registration safely kept in PostgreSQL', {
        registrationId: registration.registrationId,
        error: (sheetErr as Error).message,
      });

      await prisma.registration.update({
        where: { id: registration.id },
        data: { syncStatus: 'SYNC_FAILED' },
      });
    }
  }

  // 9. Real-Time Firebase Firestore Synchronization (Cloud Backup)
  syncRegistrationToFirebase({
    registrationId: registration.registrationId,
    domainSlug: domain.slug,
    domainName: domain.name,
    teamName: registration.teamName || 'Participant',
    teamLeaderName: registration.teamLeaderName || '',
    email: registration.email,
    phone: registration.phone,
    values,
    createdAt: registration.createdAt,
  }).catch((err) => {
    logger.warn('Non-blocking Firebase sync error', { error: (err as Error).message });
  });

  return {
    registrationId: registration.registrationId,
    teamName: registration.teamName,
    domainName: domain.name,
  };
}
