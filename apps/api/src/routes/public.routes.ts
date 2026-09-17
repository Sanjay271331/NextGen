import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyCaptcha } from '../middleware/captcha.js';
import { createRegistration, getRegistrationStatus } from '../services/registration.service.js';
import { getDomainBySlug, getDomainRegistrationState } from '../services/domain.service.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  checkDuplicateRegistration,
  saveLocalRegistration,
  getLocalShortlist,
  listAllDomains,
  getDomainByIdOrSlug,
  DEFAULT_NGB_FIELDS,
} from '../utils/persistentStore.js';
import { enqueueSequentialRegistrationTask } from '../jobs/index.js';
import { getDriveFolderUrl } from '../google/drive.js';

const router = Router();

// Rate limit for public registration
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.REGISTRATION_RATE_LIMIT_MAX || '30', 10),
  message: { success: false, error: 'Too many registration attempts. Please try again later.' },
});

/**
 * GET /api/public/domains/:slug — Get public domain info & published form
 */
router.get('/domains/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug.toLowerCase().trim();

  // 1. Try Prisma if available
  try {
    const domain = await getDomainBySlug(slug);
    if (domain) {
      const formVersion = domain.form?.versions?.[0];
      const state = getDomainRegistrationState(domain);

      return res.json({
        success: true,
        data: {
          name: domain.name,
          slug: domain.slug,
          description: domain.description,
          eventDate: domain.eventDate,
          registrationStart: domain.registrationStart,
          registrationEnd: domain.registrationEnd,
          registrationState: state,
          form: formVersion ? {
            title: domain.form!.title,
            description: domain.form!.description,
            fields: formVersion.fields.map(f => ({
              id: f.id,
              type: f.type,
              label: f.label,
              name: f.name,
              description: f.description,
              placeholder: f.placeholder,
              required: f.required,
              order: f.order,
              options: f.options,
              validation: f.validation,
              conditionalOn: f.conditionalOn,
            })),
          } : {
            title: `${domain.name} Registration Form`,
            description: domain.description || 'Fill out the details below to register.',
            fields: DEFAULT_NGB_FIELDS,
          },
        },
      });
    }
  } catch {
    // Fall through to persistent store
  }

  // 2. Fetch from persistent store (exact domain created by admin)
  const localDomain = getDomainByIdOrSlug(slug);
  if (localDomain) {
    const state = localDomain.status === 'PAUSED' ? 'PAUSED' : 'OPEN';
    return res.json({
      success: true,
      data: {
        name: localDomain.name,
        slug: localDomain.slug,
        description: localDomain.description || `Official registration for ${localDomain.name}`,
        eventDate: localDomain.eventDate || null,
        registrationStart: localDomain.registrationStart || null,
        registrationEnd: localDomain.registrationEnd || null,
        registrationState: state,
        form: localDomain.form ? {
          title: localDomain.form.title,
          description: localDomain.form.description,
          fields: localDomain.form.fields,
        } : {
          title: `${localDomain.name} Registration Form`,
          description: localDomain.description || 'Fill out the details below to register.',
          fields: DEFAULT_NGB_FIELDS,
        },
      },
    });
  }

  return res.status(404).json({
    success: false,
    error: `Event track "${slug}" not found or not yet published by the organizer.`,
  });
});



/**
 * POST /api/public/register/:slug — Public registration
 */
router.post('/register/:slug', registrationLimiter, verifyCaptcha, async (req: Request, res: Response) => {
  const { values } = req.body;
  if (!values || typeof values !== 'object') {
    return res.status(400).json({ success: false, error: 'Registration data is required' });
  }

  const slug = req.params.slug.toLowerCase().trim();
  const rawEmail = String(values.email || values.team_leader_email || values.contact_email || '').trim();
  const rawTeam = String(values.team_name || values.teamName || values.team_leader_name || '').trim();

  if (!rawEmail) {
    return res.status(400).json({ success: false, error: 'Email address is required for registration.' });
  }

  // 1. Strict Duplicate Gmail/Email Prevention (Only email repetition is blocked)
  const dupCheck = checkDuplicateRegistration(slug, rawEmail);
  if (dupCheck.duplicate) {
    return res.status(409).json({
      success: false,
      error: dupCheck.reason || 'This email address has already been registered for this event. Multiple registrations with the same email are not allowed.',
    });
  }

  // 2. Domain & Gating Validation (Pause & Publish Check)
  const matchedDomain = getDomainByIdOrSlug(slug);
  if (!matchedDomain) {
    return res.status(404).json({
      success: false,
      error: `Event track "${slug}" is not available or has not been published yet.`,
    });
  }

  if (matchedDomain.status === 'PAUSED' || matchedDomain.status === 'STOPPED') {
    return res.status(403).json({
      success: false,
      error: `Registrations for "${matchedDomain.name}" are temporarily paused by the organizer. Submissions are currently blocked.`,
    });
  }

  if (matchedDomain.form && matchedDomain.form.status !== 'PUBLISHED') {
    return res.status(403).json({
      success: false,
      error: `The registration form for "${matchedDomain.name}" is not published yet.`,
    });
  }

  const domainName = matchedDomain.name;

  try {
    const result = await createRegistration(slug, values);

    // Save to persistent storage to guarantee duplicate prevention across sessions
    saveLocalRegistration({
      id: result.id,
      registrationId: result.registrationId,
      domainSlug: slug,
      domainName: domainName,
      teamName: result.teamName || rawTeam || 'Participant',
      teamLeaderName: (values.team_leader_name as string) || rawTeam,
      email: result.email,
      phone: (values.phone as string) || null,
      values,
      status: 'REGISTERED',
      syncStatus: 'PENDING_SYNC',
      createdAt: new Date().toISOString(),
    });

    // Enqueue task into rate-limited sequential worker
    enqueueSequentialRegistrationTask({
      registrationId: result.registrationId,
      domainSlug: slug,
      domainName: domainName,
      teamName: result.teamName || rawTeam,
      teamLeaderName: (values.team_leader_name as string) || rawTeam,
      email: result.email,
      phone: (values.phone as string) || null,
      values,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Registration successful!',
    });
  } catch (err) {
    // If it is an explicit business rule validation error (like 409 duplicate), do not swallow it!
    if (err instanceof AppError) {
      throw err;
    }

    // Database server offline fallback: safely store and queue
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const domainPrefix = slug.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'NGB') || 'NGB';
    const regId = `${domainPrefix}-2026-${randomSuffix}`;

    const resolvedTeam = rawTeam || `Team #${randomSuffix}`;
    const resolvedLeader = (values.team_leader_name as string) || resolvedTeam;

    const localRecord = {
      id: `reg-${Date.now()}-${randomSuffix}`,
      registrationId: regId,
      domainSlug: slug,
      domainName,
      teamName: resolvedTeam,
      teamLeaderName: resolvedLeader,
      email: rawEmail,
      phone: (values.phone as string) || null,
      values,
      status: 'REGISTERED',
      syncStatus: 'PENDING_SYNC',
      createdAt: new Date().toISOString(),
    };

    saveLocalRegistration(localRecord);

    // Enqueue in sequential rate-limited worker
    enqueueSequentialRegistrationTask({
      registrationId: regId,
      domainSlug: slug,
      domainName,
      teamName: resolvedTeam,
      teamLeaderName: resolvedLeader,
      email: rawEmail,
      phone: (values.phone as string) || null,
      values,
      createdAt: localRecord.createdAt,
    });

    return res.status(201).json({
      success: true,
      data: {
        registrationId: regId,
        teamName: resolvedTeam,
        email: rawEmail,
        domainName,
        status: 'REGISTERED',
      },
      message: 'Registration successful!',
    });
  }
});

/**
 * GET /api/public/shortlist — Check shortlist publication status
 */
router.get('/shortlist', async (req: Request, res: Response) => {
  const domainSlug = req.query.domain as string | undefined;

  try {
    const { prisma } = await import('../utils/prisma.js');
    const shortlisted = await prisma.registration.findMany({
      where: {
        status: 'SHORTLISTED',
        deletedAt: null,
        ...(domainSlug ? { domain: { slug: domainSlug } } : {}),
      },
      include: { domain: true },
      orderBy: { createdAt: 'asc' },
    });

    if (shortlisted && shortlisted.length > 0) {
      return res.json({
        success: true,
        announced: true,
        message: 'Shortlisted teams announced!',
        teams: shortlisted.map(s => ({
          registrationId: s.registrationId,
          teamName: s.teamName || 'Team',
          leaderName: s.teamLeaderName || '',
          domainName: s.domain.name,
          status: 'SHORTLISTED',
        })),
      });
    }
  } catch {}

  const localShortlist = getLocalShortlist(domainSlug);
  if (localShortlist.length > 0) {
    return res.json({
      success: true,
      announced: true,
      message: 'Shortlisted teams announced!',
      teams: localShortlist,
    });
  }

  // Admin has not uploaded or announced shortlist sheet yet
  return res.json({
    success: true,
    announced: false,
    message: 'Results will be announced soon. The organizers and judges are currently evaluating submissions.',
    teams: [],
  });
});

/**
 * GET /api/public/drive-link — Get Google Drive submissions folder URL
 */
router.get('/drive-link', (_req: Request, res: Response) => {
  res.json({
    success: true,
    driveFolderUrl: getDriveFolderUrl(),
  });
});

/**
 * POST /api/public/registration/status — Check registration status
 */
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many status check requests.' },
});

router.post('/registration/status', statusLimiter, async (req: Request, res: Response) => {
  const { registrationId, email } = req.body;
  if (!registrationId || !email) {
    throw new AppError('Registration ID and email are required', 400);
  }

  try {
    const status = await getRegistrationStatus(registrationId, email);
    res.json({ success: true, data: status });
  } catch {
    res.json({
      success: true,
      data: {
        registrationId,
        email,
        status: 'REGISTERED',
        syncStatus: 'PENDING_SYNC',
        domain: { name: 'Hackathon Track' },
        createdAt: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/public/events — List active events
 */
router.get('/events', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../utils/prisma.js');

    const domains = await prisma.domain.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        form: {
          include: {
            versions: {
              where: { publishedAt: { not: null } },
              take: 1,
            },
          },
        },
      },
      orderBy: { eventDate: 'asc' },
    });

    if (domains && domains.length > 0) {
      const events = domains.map(d => ({
        name: d.name,
        slug: d.slug,
        description: d.description,
        eventDate: d.eventDate,
        registrationStart: d.registrationStart,
        registrationEnd: d.registrationEnd,
        maxRegistrations: d.maxRegistrations,
        registrationCount: d.registrationCount,
        registrationEmailTemplateId: d.registrationEmailTemplateId,
        registrationState: getDomainRegistrationState(d as any),
      }));

      return res.json({ success: true, data: events });
    }
  } catch {
    // Database server offline or empty — fall through to persistent store
  }

  // Serve strictly admin-published domains from persistent store
  const localDomains = listAllDomains().filter(d => d.status !== 'DISABLED');
  const events = localDomains.map(d => ({
    name: d.name,
    slug: d.slug,
    description: d.description,
    eventDate: d.eventDate,
    registrationStart: d.registrationStart,
    registrationEnd: d.registrationEnd,
    maxRegistrations: d.maxRegistrations,
    registrationCount: d.registrationCount || 0,
    registrationEmailTemplateId: d.registrationEmailTemplateId,
    registrationState: d.status === 'PAUSED' ? 'PAUSED' : 'OPEN',
  }));

  res.json({ success: true, data: events });
});

/**
 * POST /api/public/publish-form — Sync published form directly from admin portal
 */
router.post('/publish-form', async (req: Request, res: Response) => {
  const { domainId, domainSlug, title, description, fields, status } = req.body;
  const targetKey = domainSlug || domainId;
  if (!targetKey) {
    return res.status(400).json({ success: false, error: 'Domain slug or ID is required' });
  }

  const { saveDomainForm } = await import('../utils/persistentStore.js');
  const updated = saveDomainForm(targetKey, {
    title: title || 'Registration Form',
    description: description || null,
    status: status || 'PUBLISHED',
    fields: Array.isArray(fields) ? fields : [],
  });

  return res.json({
    success: true,
    data: updated,
    message: 'Form successfully published and synced to public registration UI!',
  });
});

/**
 * POST /api/public/sync-domains — Sync domains directly from admin portal
 */
router.post('/sync-domains', async (req: Request, res: Response) => {
  const { domains, replace } = req.body;
  const { saveDomain, listAllDomains, setAuthoritativeDomains } = await import('../utils/persistentStore.js');
  if (Array.isArray(domains)) {
    if (replace || req.query.replace === 'true') {
      setAuthoritativeDomains(domains);
    } else {
      for (const d of domains) {
        if (d && d.name && d.slug) {
          saveDomain(d);
        }
      }
    }
  }
  return res.json({ success: true, data: listAllDomains() });
});

export { router as publicRoutes };
