import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyCaptcha } from '../middleware/captcha.js';
import { createRegistration } from '../services/registration.service.js';
import { getDomainBySlug, getDomainRegistrationState } from '../services/domain.service.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Rate limit for public registration submissions
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.REGISTRATION_RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please wait a few minutes before trying again.' },
});

/**
 * GET /api/public/events — List active hackathon tracks/domains
 */
router.get('/events', async (_req: Request, res: Response, next: NextFunction) => {
  try {
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

    const events = domains.map(d => ({
      name: d.name,
      slug: d.slug,
      description: d.description,
      eventDate: d.eventDate,
      registrationStart: d.registrationStart,
      registrationEnd: d.registrationEnd,
      maxRegistrations: d.maxRegistrations,
      registrationCount: d.registrationCount,
      registrationState: getDomainRegistrationState(d),
    }));

    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/public/domains/:slug — Get track details and published form
 */
router.get('/domains/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    const domain = await getDomainBySlug(slug);

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: `Event track "${slug}" not found or not published.`,
      });
    }

    const formVersion = domain.form?.versions?.[0];
    const state = getDomainRegistrationState(domain);

    res.json({
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
            options: f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : [],
            validation: f.validation ? (typeof f.validation === 'string' ? JSON.parse(f.validation) : f.validation) : null,
          })),
        } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/public/register/:slug — Participant public registration
 */
router.post('/register/:slug', registrationLimiter, verifyCaptcha, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { values } = req.body;
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ success: false, error: 'Registration data is required.' });
    }

    const slug = req.params.slug.toLowerCase().trim();
    const result = await createRegistration(slug, values);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Registration successful!',
    });
  } catch (err) {
    next(err);
  }
});

export { router as publicRoutes };
