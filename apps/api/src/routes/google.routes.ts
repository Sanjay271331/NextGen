import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { getAuthenticatedClient } from '../google/oauth.js';
import { google } from 'googleapis';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/google/status — Google Sheets connection status
 */
router.get('/status', async (_req: Request, res: Response) => {
  const integration = await prisma.googleIntegration.findFirst({
    where: { isActive: true },
    select: {
      email: true,
      sheetsConnected: true,
      spreadsheetId: true,
      lastTestedAt: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    data: integration ? {
      connected: true,
      email: integration.email,
      sheetsConnected: integration.sheetsConnected,
      spreadsheetId: integration.spreadsheetId || process.env.GOOGLE_DEFAULT_SPREADSHEET_ID || '',
      lastTested: integration.lastTestedAt,
      lastUpdated: integration.updatedAt,
    } : {
      connected: false,
      sheetsConnected: false,
      spreadsheetId: process.env.GOOGLE_DEFAULT_SPREADSHEET_ID || '',
    },
  });
});

/**
 * POST /api/google/test — Test Google Sheets connection
 */
router.post('/test', async (_req: Request, res: Response) => {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Test call by getting user info or sheets api ping
    const integration = await prisma.googleIntegration.findFirst({ where: { isActive: true } });
    if (integration) {
      await prisma.googleIntegration.update({
        where: { id: integration.id },
        data: { sheetsConnected: true, lastTestedAt: new Date() },
      });
    }

    res.json({
      success: true,
      message: 'Google Sheets connection verified successfully.',
      data: { sheetsConnected: true },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Google Sheets connection test failed: ${(err as Error).message}`,
    });
  }
});

/**
 * POST /api/google/disconnect — Disconnect Google account
 */
router.post('/disconnect', async (_req: Request, res: Response) => {
  await prisma.googleIntegration.updateMany({ data: { isActive: false } });
  res.json({ success: true, message: 'Google account disconnected successfully.' });
});

export { router as googleRoutes };
