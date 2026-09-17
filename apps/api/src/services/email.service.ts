import Handlebars from 'handlebars';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import sanitizeHtml from 'sanitize-html';

/**
 * Create email template
 */
export async function createEmailTemplate(data: {
  name: string;
  type: string;
  domainId?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  senderName?: string;
  replyTo?: string;
  isActive?: boolean;
}) {
  // Sanitize HTML — allow safe tags only, no scripts
  const cleanHtml = sanitizeHtml(data.htmlBody, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style', 'div', 'span', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height', 'bgcolor', 'color'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      a: ['href', 'target', 'style'],
      td: ['colspan', 'rowspan', 'style', 'align', 'valign', 'width', 'bgcolor'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });

  // Extract variables from template
  const variables = extractTemplateVariables(cleanHtml);

  const template = await prisma.emailTemplate.create({
    data: {
      name: data.name,
      type: data.type,
      domainId: data.domainId,
      subject: data.subject,
      htmlBody: cleanHtml,
      textBody: data.textBody,
      senderName: data.senderName,
      replyTo: data.replyTo,
      isActive: data.isActive ?? true,
      variables,
    },
  });

  logger.info('Email template created', { id: template.id, name: template.name });
  return template;
}

/**
 * List email templates
 */
export async function listEmailTemplates(domainId?: string, type?: string) {
  const where: Record<string, unknown> = {};
  if (domainId) where.domainId = domainId;
  if (type) where.type = type;

  return prisma.emailTemplate.findMany({
    where,
    include: {
      domain: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get email template
 */
export async function getEmailTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    include: { domain: { select: { name: true } } },
  });
  if (!template) throw new AppError('Email template not found', 404);
  return template;
}

/**
 * Update email template
 */
export async function updateEmailTemplate(id: string, data: Record<string, unknown>) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError('Email template not found', 404);

  const updateData: Record<string, unknown> = {};
  const allowedFields = ['name', 'subject', 'textBody', 'senderName', 'replyTo', 'isActive', 'type', 'domainId'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (data.htmlBody) {
    updateData.htmlBody = sanitizeHtml(data.htmlBody as string, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style', 'div', 'span', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height', 'bgcolor', 'color'],
        img: ['src', 'alt', 'width', 'height', 'style'],
        a: ['href', 'target', 'style'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
    updateData.variables = extractTemplateVariables(updateData.htmlBody as string);
  }

  return prisma.emailTemplate.update({ where: { id }, data: updateData });
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(id: string) {
  return prisma.emailTemplate.delete({ where: { id } });
}

/**
 * Render template with data
 */
export function renderTemplate(
  template: { subject: string; htmlBody: string; textBody?: string | null },
  data: Record<string, unknown>,
): { subject: string; htmlBody: string; textBody: string } {
  // Escape data values to prevent XSS in emails
  const safeData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    safeData[key] = String(value || '');
  }

  const subjectTemplate = Handlebars.compile(template.subject);
  const htmlTemplate = Handlebars.compile(template.htmlBody);
  const textTemplate = template.textBody ? Handlebars.compile(template.textBody) : null;

  return {
    subject: subjectTemplate(safeData),
    htmlBody: htmlTemplate(safeData),
    textBody: textTemplate ? textTemplate(safeData) : stripHtml(htmlTemplate(safeData)),
  };
}

/**
 * Extract {{variable}} names from template
 */
function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1].trim());
  }
  return Array.from(variables);
}

/**
 * Strip HTML for plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Get available template variables for a domain's form
 */
export async function getAvailableVariables(domainId?: string) {
  const systemVars = [
    'registration_id', 'event_name', 'registration_date',
    'status', 'team_name', 'participant_name', 'email',
  ];

  if (!domainId) return systemVars;

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: {
      form: {
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { fields: true },
          },
        },
      },
    },
  });

  if (!domain?.form?.versions[0]) return systemVars;

  const fieldVars = domain.form.versions[0].fields
    .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT')
    .map(f => f.name);

  return [...new Set([...systemVars, ...fieldVars])];
}
