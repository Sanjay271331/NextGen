import { z } from 'zod';
import { FieldType, AdminRole, RegistrationStatus, DomainStatus, FormStatus, EmailType } from './constants.js';

// ── Common Validators ────────────────────────────────

export const emailSchema = z.string().email('Invalid email address').max(255);
export const phoneSchema = z.string().regex(/^[\+]?[\d\s\-\(\)]{7,20}$/, 'Invalid phone number').optional();
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').min(2).max(100);
export const uuidSchema = z.string().uuid();

// ── Domain Validators ────────────────────────────────

export const createDomainSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  eventDate: z.string().datetime().optional(),
  registrationStart: z.string().datetime().optional(),
  registrationEnd: z.string().datetime().optional(),
  maxRegistrations: z.number().int().min(1).max(100000).optional(),
  spreadsheetId: z.string().max(500).optional(),
  worksheetName: z.string().max(200).optional(),
  driveFolderId: z.string().max(500).optional(),
  registrationEmailTemplateId: z.string().uuid().optional(),
  shortlistEmailTemplateId: z.string().uuid().optional(),
  status: z.nativeEnum(DomainStatus).optional().default(DomainStatus.ACTIVE),
});

export const updateDomainSchema = createDomainSchema.partial();

// ── Form Validators ──────────────────────────────────

export const fieldValidationSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().max(500).optional(),
  patternMessage: z.string().max(200).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().int().min(1).optional(),
});

export const conditionalRuleSchema = z.object({
  fieldName: z.string(),
  operator: z.enum(['equals', 'notEquals', 'contains', 'notContains']),
  value: z.string(),
});

export const formFieldSchema = z.object({
  id: z.string().optional(),
  type: z.nativeEnum(FieldType),
  label: z.string().min(1).max(500).trim(),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  description: z.string().max(1000).optional(),
  placeholder: z.string().max(500).optional(),
  required: z.boolean().default(false),
  order: z.number().int().min(0),
  options: z.array(z.string().max(500)).optional(),
  validation: fieldValidationSchema.optional(),
  conditionalOn: conditionalRuleSchema.optional(),
});

export const createFormSchema = z.object({
  title: z.string().min(2).max(300).trim(),
  description: z.string().max(2000).optional(),
  domainId: z.string().uuid().optional(),
  fields: z.array(formFieldSchema).min(1).max(100),
});

export const updateFormSchema = z.object({
  title: z.string().min(2).max(300).trim().optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(formFieldSchema).min(1).max(100).optional(),
});

// ── Registration Validators ──────────────────────────

export const publicRegistrationSchema = z.object({
  domainSlug: z.string(),
  captchaToken: z.string().min(1, 'CAPTCHA token is required'),
  values: z.record(z.unknown()),
});

export const updateRegistrationSchema = z.object({
  status: z.nativeEnum(RegistrationStatus).optional(),
  values: z.record(z.unknown()).optional(),
});

// ── Email Template Validators ────────────────────────

export const createEmailTemplateSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  type: z.nativeEnum(EmailType),
  domainId: z.string().uuid().optional(),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1).max(100000),
  textBody: z.string().max(50000).optional(),
  senderName: z.string().max(200).optional(),
  replyTo: emailSchema.optional(),
  isActive: z.boolean().default(true),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

// ── Send Email Validators ────────────────────────────

export const sendTestEmailSchema = z.object({
  templateId: z.string().uuid(),
  recipientEmail: emailSchema,
  sampleData: z.record(z.string()).optional(),
});

export const sendBulkEmailSchema = z.object({
  templateId: z.string().uuid(),
  domainId: z.string().uuid(),
  recipientIds: z.array(z.string().uuid()).min(1).max(5000),
  confirmationToken: z.string().optional(),
});

// ── Shortlist Import Validators ──────────────────────

export const shortlistColumnMappingSchema = z.object({
  importId: z.string().uuid(),
  mapping: z.record(z.string()),
});

export const shortlistConfirmSchema = z.object({
  importId: z.string().uuid(),
  sendEmails: z.boolean().default(false),
});

// ── Admin Validators ─────────────────────────────────

export const addAdminSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(AdminRole).default(AdminRole.VIEWER),
});

export const updateAdminSchema = z.object({
  role: z.nativeEnum(AdminRole).optional(),
  isActive: z.boolean().optional(),
});

// ── Query Validators ─────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(200).optional(),
});

export const registrationFilterSchema = paginationSchema.extend({
  domainId: z.string().uuid().optional(),
  status: z.nativeEnum(RegistrationStatus).optional(),
  syncStatus: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  email: z.string().optional(),
  teamName: z.string().optional(),
});

// ── Settings Validators ──────────────────────────────

export const systemSettingsSchema = z.object({
  organizationName: z.string().min(1).max(200).optional(),
  organizationLogo: z.string().url().max(1000).optional(),
  supportEmail: emailSchema.optional(),
  defaultSenderName: z.string().max(200).optional(),
  defaultReplyTo: emailSchema.optional(),
  timezone: z.string().max(100).optional(),
  dateFormat: z.string().max(50).optional(),
  captchaEnabled: z.boolean().optional(),
  captchaScoreThreshold: z.number().min(0).max(1).optional(),
  maxFileSize: z.number().int().min(1).max(100).optional(),
  retentionDays: z.number().int().min(0).optional(),
});

// ── Registration Status Lookup ───────────────────────

export const statusLookupSchema = z.object({
  registrationId: z.string().min(1).max(50),
  email: emailSchema,
});
