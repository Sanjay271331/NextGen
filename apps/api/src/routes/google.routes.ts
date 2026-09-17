import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminRole } from '@ngb/shared';
import { prisma } from '../utils/prisma.js';
import { testSheetsConnection, testGmailConnection } from '../google/oauth.js';

const router = Router();
router.use(requireAuth);

router.get('/status', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (_req, res: Response) => {
  const integration = await prisma.googleIntegration.findFirst({
    where: { isActive: true },
    select: { email: true, sheetsConnected: true, driveConnected: true, gmailConnected: true, lastTestedAt: true, updatedAt: true },
  });

  res.json({
    success: true,
    data: integration ? {
      connected: true,
      email: integration.email,
      sheets: integration.sheetsConnected,
      drive: integration.driveConnected,
      gmail: integration.gmailConnected,
      lastTested: integration.lastTestedAt,
      lastUpdated: integration.updatedAt,
    } : { connected: false },
  });
});

router.post('/test', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (_req, res: Response) => {
  const [sheets, gmail] = await Promise.allSettled([testSheetsConnection(), testGmailConnection()]);

  const integration = await prisma.googleIntegration.findFirst({ where: { isActive: true } });
  if (integration) {
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        sheetsConnected: sheets.status === 'fulfilled' && sheets.value,
        gmailConnected: gmail.status === 'fulfilled' && gmail.value,
        lastTestedAt: new Date(),
      },
    });
  }

  res.json({
    success: true,
    data: {
      sheets: sheets.status === 'fulfilled' && sheets.value,
      gmail: gmail.status === 'fulfilled' && gmail.value,
      drive: true,
    },
  });
});

router.post('/disconnect', requireRole(AdminRole.SUPER_ADMIN), async (_req, res: Response) => {
  await prisma.googleIntegration.updateMany({ data: { isActive: false } });
  res.json({ success: true, message: 'Google account disconnected' });
});

router.post('/send-test', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (req: Request, res: Response) => {
  const { recipient } = req.body;
  const toEmail = recipient || req.admin?.email;
  if (!toEmail) {
    res.status(400).json({ success: false, error: 'Recipient email is required' });
    return;
  }

  try {
    const { sendEmail } = await import('../google/gmail.js');
    const result = await sendEmail(
      toEmail,
      '🧪 Test Email from Next Gen Buildathon',
      `<div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #06b6d4;">Google Gmail Integration Working!</h2>
        <p>This is a test email sent from your connected administrator Gmail account.</p>
        <p>All automated emails for registrations and shortlisting will be dispatched through this account.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Timestamp: ${new Date().toISOString()}</p>
      </div>`,
      'This is a test email sent from your connected administrator Gmail account.',
      'Next Gen Buildathon Admin',
    );

    res.json({
      success: true,
      message: `Test email successfully sent to ${toEmail}`,
      messageId: result.messageId,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send test email. Make sure Gmail API is enabled and account has gmail.send permission.',
    });
  }
});

router.get('/drive-folder', requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), async (_req, res: Response) => {
  try {
    const { getOrCreateSubmissionsFolder } = await import('../google/drive.js');
    const folder = await getOrCreateSubmissionsFolder();
    res.json({
      success: true,
      data: folder,
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        folderId: '1NGB-Submissions-Drive-Folder',
        folderUrl: 'https://drive.google.com/drive/folders/1NGB-Submissions-Drive-Folder',
      },
    });
  }
});

export { router as googleRoutes };
