import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new form
 */
export async function createForm(data: {
  title: string;
  description?: string;
  domainId?: string;
  applyToAllDomains?: boolean;
  fields: Array<{
    type: string;
    label: string;
    name: string;
    description?: string;
    placeholder?: string;
    required: boolean;
    order: number;
    options?: string[];
    validation?: Record<string, unknown>;
  }>;
}) {
  const form = await prisma.form.create({
    data: {
      title: data.title.trim(),
      description: data.description,
      status: 'DRAFT',
      isGlobal: Boolean(data.applyToAllDomains),
      versions: {
        create: {
          version: 1,
          fields: {
            create: data.fields.map((field, index) => ({
              type: field.type,
              label: field.label.trim(),
              name: field.name.trim(),
              description: field.description,
              placeholder: field.placeholder,
              required: field.required || false,
              order: field.order ?? index,
              options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : null,
              validation: field.validation ? (typeof field.validation === 'string' ? field.validation : JSON.stringify(field.validation)) : null,
            })),
          },
        },
      },
    },
    include: {
      versions: {
        include: { fields: { orderBy: { order: 'asc' } } },
      },
    },
  });

  // Set current version
  const version = (form as any).versions?.[0];
  if (version) {
    await prisma.form.update({
      where: { id: form.id },
      data: { currentVersionId: version.id },
    });
  }

  // Handle Domain Association
  if (data.applyToAllDomains) {
    await prisma.domain.updateMany({
      where: { deletedAt: null },
      data: { formId: form.id },
    });
    logger.info('Form applied to all domains', { formId: form.id });
  } else if (data.domainId) {
    await prisma.domain.update({
      where: { id: data.domainId },
      data: { formId: form.id },
    });
  }

  logger.info('Form created', { id: form.id, title: form.title });
  return form;
}

/**
 * List all forms
 */
export async function listForms() {
  return prisma.form.findMany({
    where: { deletedAt: null },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          publishedAt: true,
          _count: { select: { fields: true } },
        },
      },
      domains: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get form by ID with latest fields
 */
export async function getForm(id: string) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        include: { fields: { orderBy: { order: 'asc' } } },
      },
      domains: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!form || form.deletedAt) throw new AppError('Form not found', 404);

  return {
    ...form,
    versions: form.versions.map((v) => ({
      ...v,
      fields: v.fields.map((f) => ({
        ...f,
        options: f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : [],
        validation: f.validation ? (typeof f.validation === 'string' ? JSON.parse(f.validation) : f.validation) : null,
      })),
    })),
  };
}

/**
 * Update a form
 */
export async function updateForm(
  id: string,
  data: {
    title?: string;
    description?: string;
    applyToAllDomains?: boolean;
    domainId?: string;
    fields?: Array<{
      type: string;
      label: string;
      name: string;
      description?: string;
      placeholder?: string;
      required: boolean;
      order: number;
      options?: string[];
      validation?: Record<string, unknown>;
    }>;
  },
) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { fields: true },
      },
    },
  });

  if (!form || form.deletedAt) throw new AppError('Form not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.title) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.applyToAllDomains !== undefined) updateData.isGlobal = data.applyToAllDomains;

  // If fields are modified, create a new version snapshot
  if (data.fields && data.fields.length > 0) {
    const latestVersion = form.versions[0]?.version || 0;
    const newVersionNumber = latestVersion + 1;

    const newVersion = await prisma.formVersion.create({
      data: {
        formId: id,
        version: newVersionNumber,
        publishedAt: form.status === 'PUBLISHED' ? new Date() : null,
        fields: {
          create: data.fields.map((field, index) => ({
            type: field.type,
            label: field.label.trim(),
            name: field.name.trim(),
            description: field.description,
            placeholder: field.placeholder,
            required: field.required || false,
            order: field.order ?? index,
            options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : null,
            validation: field.validation ? (typeof field.validation === 'string' ? field.validation : JSON.stringify(field.validation)) : null,
          })),
        },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    updateData.currentVersionId = newVersion.id;
  }

  const updatedForm = await prisma.form.update({
    where: { id },
    data: updateData,
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { fields: { orderBy: { order: 'asc' } } },
      },
      domains: true,
    },
  });

  // Apply to all domains if requested
  if (data.applyToAllDomains) {
    await prisma.domain.updateMany({
      where: { deletedAt: null },
      data: { formId: id },
    });
    logger.info('Form updated and applied to all domains', { formId: id });
  } else if (data.domainId) {
    await prisma.domain.update({
      where: { id: data.domainId },
      data: { formId: id },
    });
  }

  logger.info('Form updated', { id });
  return updatedForm;
}

/**
 * Publish form
 */
export async function publishForm(id: string, applyToAllDomains = false) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!form || form.deletedAt) throw new AppError('Form not found', 404);

  const latestVersion = form.versions[0];
  if (!latestVersion) throw new AppError('Cannot publish a form with no fields', 400);

  // Mark latest version as published
  await prisma.formVersion.update({
    where: { id: latestVersion.id },
    data: { publishedAt: new Date() },
  });

  const isGlobal = applyToAllDomains || form.isGlobal;

  const updated = await prisma.form.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      currentVersionId: latestVersion.id,
      isGlobal,
    },
  });

  if (isGlobal) {
    await prisma.domain.updateMany({
      where: { deletedAt: null },
      data: { formId: id },
    });
    logger.info('Published form applied to all domains', { formId: id });
  }

  logger.info('Form published', { id, version: latestVersion.version });
  return updated;
}

/**
 * Delete form
 */
export async function deleteForm(id: string) {
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) throw new AppError('Form not found', 404);

  await prisma.form.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  logger.info('Form archived', { id });
  return { success: true };
}
