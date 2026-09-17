import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as emailService from '../services/email.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { queueEmailJob, queueBulkEmailJobs } from '../jobs/index.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(requireAuth);

// ── Templates ────────────────────────────────────────

router.get('/templates', requirePermission('emails:read'), async (req: Request, res: Response) => {
  const { domainId, type } = req.query;
  const templates = await emailService.listEmailTemplates(domainId as string, type as string);
  res.json({ success: true, data: templates });
});

router.post('/templates', requirePermission('emails:write'), async (req: Request, res: Response) => {
  const template = await emailService.createEmailTemplate(req.body);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'CREATE_EMAIL_TEMPLATE', resource: 'email_template', resourceId: template.id,
  });
  res.status(201).json({ success: true, data: template });
});

router.get('/templates/:id', requirePermission('emails:read'), async (req, res: Response) => {
  const template = await emailService.getEmailTemplate(req.params.id);
  res.json({ success: true, data: template });
});

router.put('/templates/:id', requirePermission('emails:write'), async (req: Request, res: Response) => {
  const template = await emailService.updateEmailTemplate(req.params.id, req.body);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UPDATE_EMAIL_TEMPLATE', resource: 'email_template', resourceId: req.params.id,
  });
  res.json({ success: true, data: template });
});

router.delete('/templates/:id', requirePermission('emails:write'), async (req: Request, res: Response) => {
  await emailService.deleteEmailTemplate(req.params.id);
  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'DELETE_EMAIL_TEMPLATE', resource: 'email_template', resourceId: req.params.id,
  });
  res.json({ success: true, message: 'Template deleted' });
});

// ── Variables ────────────────────────────────────────

router.get('/variables', requirePermission('emails:read'), async (req: Request, res: Response) => {
  const variables = await emailService.getAvailableVariables(req.query.domainId as string);
  res.json({ success: true, data: variables });
});

// ── Preview ──────────────────────────────────────────

router.post('/preview', requirePermission('emails:read'), async (req: Request, res: Response) => {
  const { templateId, sampleData } = req.body;
  const template = await emailService.getEmailTemplate(templateId);
  const rendered = emailService.renderTemplate(template, sampleData || {});
  res.json({ success: true, data: rendered });
});

// ── Test Email ───────────────────────────────────────

router.post('/test', requirePermission('emails:write'), async (req: Request, res: Response) => {
  const { templateId, recipientEmail, sampleData } = req.body;
  const template = await emailService.getEmailTemplate(templateId);
  const rendered = emailService.renderTemplate(template, sampleData || {});

  const { sendEmail } = await import('../google/gmail.js');
  await sendEmail(recipientEmail, rendered.subject, rendered.htmlBody, rendered.textBody, template.senderName || undefined, template.replyTo || undefined);

  res.json({ success: true, message: 'Test email sent' });
});

// ── Send Custom Email ────────────────────────────────

router.post('/send', requirePermission('emails:write'), async (req: Request, res: Response) => {
  const { templateId, domainId, recipientIds, confirmationToken } = req.body;

  if (!confirmationToken) {
    // First call: return count for confirmation
    const count = recipientIds.length;
    res.json({
      success: true,
      data: { recipientCount: count, confirmationRequired: true },
      message: `You are about to send this email to ${count} recipients.`,
    });
    return;
  }

  // Build email jobs
  const registrations = await prisma.registration.findMany({
    where: { id: { in: recipientIds }, deletedAt: null },
    select: { id: true, email: true, domainId: true },
  });

  const jobs = registrations.map(r => ({
    registrationId: r.id,
    domainId: r.domainId,
    templateId,
    recipient: r.email,
    type: 'CUSTOM',
  }));

  await queueBulkEmailJobs(jobs);

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'SEND_BULK_EMAIL', resource: 'email',
    newValue: { count: jobs.length, templateId },
  });

  res.json({ success: true, data: { queued: jobs.length }, message: `${jobs.length} emails queued` });
});

// ── Email Logs ───────────────────────────────────────

router.get('/logs', requirePermission('emails:read'), async (req: Request, res: Response) => {
  const { page = '1', pageSize = '25', type, status, search } = req.query;
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { recipient: { contains: search as string, mode: 'insensitive' } },
      { templateName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailLog.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)),
  });
});

export { router as emailRoutes };
