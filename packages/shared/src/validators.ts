import { z } from 'zod';
import { FieldType, RegistrationStatus, DomainStatus } from './constants.js';

// ── Common Validators ────────────────────────────────

export const emailSchema = z.string().email('Invalid email address').max(255);
export const phoneSchema = z.string().regex(/^[\+]?[\d\s\-\(\)]{7,20}$/, 'Invalid phone number').optional();
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').min(2).max(100);
export const uuidSchema = z.string().uuid();

// ── Admin Auth Validators ────────────────────────────

export const adminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

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
});

export const createFormSchema = z.object({
  title: z.string().min(2).max(300).trim(),
  description: z.string().max(2000).optional(),
  domainId: z.string().uuid().optional(),
  applyToAllDomains: z.boolean().optional().default(false),
  fields: z.array(formFieldSchema).min(1).max(100),
});

export const updateFormSchema = z.object({
  title: z.string().min(2).max(300).trim().optional(),
  description: z.string().max(2000).optional(),
  applyToAllDomains: z.boolean().optional(),
  fields: z.array(formFieldSchema).min(1).max(100).optional(),
});

// ── Registration Validators ──────────────────────────

export const publicRegistrationSchema = z.object({
  domainSlug: z.string(),
  captchaToken: z.string().optional(),
  values: z.record(z.unknown()),
});

export const updateRegistrationSchema = z.object({
  status: z.nativeEnum(RegistrationStatus).optional(),
  values: z.record(z.unknown()).optional(),
});
