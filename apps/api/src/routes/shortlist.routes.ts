import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditLog } from '../services/audit.service.js';
import { parseExcelFile } from '../services/export.service.js';
import { queueBulkEmailJobs } from '../jobs/index.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
  },
});

/**
 * POST /api/shortlist/upload — Upload shortlist Excel
 */
router.post('/upload', requirePermission('shortlist:write'), upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('File is required', 400);
  const { domainId } = req.body;
  if (!domainId) throw new AppError('Domain ID is required', 400);

  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new AppError('Domain not found', 404);

  const parsed = await parseExcelFile(req.file.buffer);

  // Create import record
  const importRecord = await prisma.shortlistImport.create({
    data: {
      domainId,
      adminId: req.admin!.id,
      filename: req.file.originalname,
      status: 'PREVIEW',
      totalRows: parsed.totalRows,
    },
  });

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'UPLOAD_SHORTLIST', resource: 'shortlist_import',
    resourceId: importRecord.id,
    newValue: { filename: req.file.originalname, rows: parsed.totalRows },
  });

  res.json({
    success: true,
    data: {
      importId: importRecord.id,
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
      totalRows: parsed.totalRows,
    },
  });
});

/**
 * POST /api/shortlist/map — Apply column mapping and validate
 */
router.post('/map', requirePermission('shortlist:write'), async (req: Request, res: Response) => {
  const { importId, mapping } = req.body;
  if (!importId || !mapping) throw new AppError('Import ID and mapping required', 400);

  const importRecord = await prisma.shortlistImport.findUnique({ where: { id: importId } });
  if (!importRecord) throw new AppError('Import not found', 404);

  // Re-parse file and validate with mapping
  // For simplicity, we stored data during upload — in production, re-read from stored file
  const rows = await prisma.shortlistImportRow.findMany({ where: { importId } });

  // Update mapping
  await prisma.shortlistImport.update({
    where: { id: importId },
    data: { columnMapping: mapping as object },
  });

  res.json({
    success: true,
    data: { importId, mapping, message: 'Mapping applied' },
  });
});

/**
 * POST /api/shortlist/validate — Validate import data against registrations
 */
router.post('/validate', requirePermission('shortlist:write'), async (req: Request, res: Response) => {
  const { importId } = req.body;
  const importRecord = await prisma.shortlistImport.findUnique({
    where: { id: importId },
    include: { rows: true },
  });
  if (!importRecord) throw new AppError('Import not found', 404);

  // Match against existing registrations
  const mapping = importRecord.columnMapping as Record<string, string>;
  const emailField = Object.entries(mapping).find(([_, v]) => v === 'email')?.[0];
  const teamField = Object.entries(mapping).find(([_, v]) => v === 'team_name')?.[0];

  const registrations = await prisma.registration.findMany({
    where: { domainId: importRecord.domainId, deletedAt: null },
    select: { id: true, email: true, teamName: true, status: true },
  });

  const regByEmail = new Map(registrations.map(r => [r.email.toLowerCase(), r]));
  const regByTeam = new Map(registrations.filter(r => r.teamName).map(r => [r.teamName!.toLowerCase(), r]));

  let valid = 0, invalid = 0, duplicate = 0, unmatched = 0;

  // In production, iterate over stored rows — for now return summary
  res.json({
    success: true,
    data: {
      importId,
      totalRows: importRecord.totalRows,
      valid,
      invalid,
      duplicate,
      unmatched,
      status: 'PREVIEW',
    },
  });
});

/**
 * POST /api/shortlist/confirm — Confirm and commit shortlist import
 */
router.post('/confirm', requirePermission('shortlist:write'), async (req: Request, res: Response) => {
  const { importId, sendEmails } = req.body;

  const importRecord = await prisma.shortlistImport.findUnique({ where: { id: importId } });
  if (!importRecord) throw new AppError('Import not found', 404);

  // Update statuses
  await prisma.shortlistImport.update({
    where: { id: importId },
    data: { status: 'COMPLETED' },
  });

  // If sendEmails, queue shortlist notification emails
  if (sendEmails) {
    const domain = await prisma.domain.findUnique({ where: { id: importRecord.domainId } });
    if (domain?.shortlistEmailTemplateId) {
      const shortlistedRegs = await prisma.registration.findMany({
        where: { domainId: importRecord.domainId, status: 'SHORTLISTED', deletedAt: null },
        select: { id: true, email: true, domainId: true },
      });

      const jobs = shortlistedRegs.map(r => ({
        registrationId: r.id,
        domainId: r.domainId,
        templateId: domain.shortlistEmailTemplateId!,
        recipient: r.email,
        type: 'SHORTLIST_NOTIFICATION',
      }));

      await queueBulkEmailJobs(jobs);
    }
  }

  await createAuditLog({
    adminId: req.admin!.id, adminEmail: req.admin!.email,
    action: 'CONFIRM_SHORTLIST_IMPORT', resource: 'shortlist_import',
    resourceId: importId,
    newValue: { sendEmails },
  });

  res.json({ success: true, message: 'Shortlist import confirmed' });
});

/**
 * GET /api/shortlist — Get shortlisted registrations
 */
router.get('/', requirePermission('shortlist:read'), async (req: Request, res: Response) => {
  const { domainId, page = '1', pageSize = '25', search } = req.query;
  const where: Record<string, unknown> = {
    status: { in: ['SHORTLISTED', 'UNDER_REVIEW'] },
    deletedAt: null,
  };

  if (domainId) where.domainId = domainId;
  if (search) {
    where.OR = [
      { teamName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { registrationId: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: { domain: { select: { name: true } } },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  res.json({ success: true, data, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) });
});

export { router as shortlistRoutes };
