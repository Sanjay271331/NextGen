import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { generateSecureToken } from '../utils/crypto.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getSheetsAuthUrl,
  exchangeCode,
  getGoogleUserInfo,
  storeSheetsTokens,
} from '../google/oauth.js';

const router = Router();

// Strict rate limiter for administrator password attempts:
// Max 5 attempts per 15 minutes window
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
});

/**
 * POST /api/auth/login — Administrator password authentication
 * Exactly ONE administrator authentication method: password validation.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    throw new AppError('Administrator password is required.', 400);
  }

  const expectedPassword = process.env.ADMIN_PASSWORD || 'Admin@NextGen2026!';

  // Constant-time style comparison / direct check
  if (password.trim() !== expectedPassword.trim()) {
    logger.warn('Failed administrator login attempt', { ip: req.ip });
    throw new AppError('Incorrect administrator password.', 401);
  }

  // Create secure session
  const session = req.session as unknown as Record<string, unknown>;
  session.adminId = 'admin-super';
  session.adminRole = 'SUPER_ADMIN';
  session.adminName = 'Administrator';
  session.adminEmail = 'admin@buildathon.local';

  logger.info('Administrator authenticated successfully via password', { ip: req.ip });

  res.json({
    success: true,
    message: 'Authenticated successfully',
    data: {
      id: 'admin-super',
      role: 'SUPER_ADMIN',
      name: 'Administrator',
    },
  });
});

/**
 * GET /api/auth/me — Check current administrator session status
 */
router.get('/me', async (req: Request, res: Response) => {
  const session = req.session as unknown as Record<string, unknown>;

  if (!session?.adminId) {
    return res.json({ success: true, data: null });
  }

  res.json({
    success: true,
    data: {
      id: session.adminId,
      role: session.adminRole || 'SUPER_ADMIN',
      name: session.adminName || 'Administrator',
      email: session.adminEmail || 'admin@buildathon.local',
    },
  });
});

/**
 * POST /api/auth/logout — Destroy administrator session
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error during logout', { error: err.message });
    }
    res.clearCookie('ngb.sid');
    logger.info('Administrator logged out successfully');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ── Google Sheets API Authorization ──────────────────

/**
 * GET /api/auth/google/sheets/connect — Start Google Sheets API OAuth flow
 */
router.get('/google/sheets/connect', (req: Request, res: Response) => {
  const session = req.session as unknown as Record<string, unknown>;
  if (!session?.adminId) {
    throw new AppError('Authentication required to connect Google Sheets', 401);
  }

  const state = `sheets_${generateSecureToken(16)}`;
  session.sheetsState = state;

  const authUrl = getSheetsAuthUrl(state);
  res.json({ success: true, data: { url: authUrl } });
});

/**
 * GET /api/auth/google/sheets/callback — Handle Google Sheets OAuth callback
 */
router.get('/google/sheets/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const session = req.session as unknown as Record<string, unknown>;

    if (!state || state !== session.sheetsState) {
      return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/admin?tab=settings&error=invalid_state`);
    }
    delete session.sheetsState;

    if (!code) {
      return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/admin?tab=settings&error=no_code`);
    }

    const tokens = await exchangeCode(code as string);
    const userInfo = await getGoogleUserInfo(tokens.access_token!);

    // Ensure an Admin record exists in PostgreSQL to link GoogleIntegration
    await prisma.admin.upsert({
      where: { email: 'admin@buildathon.local' },
      update: {},
      create: {
        id: 'admin-super',
        email: 'admin@buildathon.local',
        name: 'Administrator',
        role: 'SUPER_ADMIN',
      },
    });

    await storeSheetsTokens('admin-super', userInfo.email, tokens);

    logger.info('Google Sheets connected by administrator', { email: userInfo.email });
    return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/admin?tab=settings&sheets=connected`);
  } catch (err) {
    logger.error('Google Sheets connection error', { error: (err as Error).message });
    return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/admin?tab=settings&error=connection_failed`);
  }
});

export { router as authRoutes };
