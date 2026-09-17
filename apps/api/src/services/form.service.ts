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
    conditionalOn?: Record<string, unknown>;
  }>;
}) {
  const form = await prisma.form.create({
    data: {
      title: data.title,
      description: data.description,
      status: 'DRAFT',
      versions: {
        create: {
          version: 1,
          fields: {
            create: data.fields.map((field, index) => ({
              type: field.type,
              label: field.label,
              name: field.name,
              description: field.description,
              placeholder: field.placeholder,
              required: field.required,
              order: field.order ?? index,
              options: (field.options as any) ?? undefined,
              validation: (field.validation as any) ?? undefined,
              conditionalOn: (field.conditionalOn as any) ?? undefined,
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

  // Link to domain if provided
  if (data.domainId) {
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
 * Get form by ID with latest version
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
  if (!form) throw new AppError('Form not found', 404);
  return form;
}

/**
 * Update form (creates new version if fields changed)
 */
export async function updateForm(id: string, data: {
  title?: string;
  description?: string;
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
    conditionalOn?: Record<string, unknown>;
  }>;
}) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!form) throw new AppError('Form not found', 404);

  const updates: Record<string, unknown> = {};
  if (data.title) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;

  // If fields changed, create new version
  if (data.fields) {
    const latestVersion = form.versions[0];
    const newVersionNum = (latestVersion?.version || 0) + 1;

    const newVersion = await prisma.formVersion.create({
      data: {
        formId: id,
        version: newVersionNum,
        fields: {
          create: data.fields.map((field, index) => ({
            type: field.type,
            label: field.label,
            name: field.name,
            description: field.description,
            placeholder: field.placeholder,
            required: field.required,
            order: field.order ?? index,
            options: (field.options as any) ?? undefined,
            validation: (field.validation as any) ?? undefined,
            conditionalOn: (field.conditionalOn as any) ?? undefined,
          })),
        },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    updates.currentVersionId = newVersion.id;
  }

  const updated = await prisma.form.update({
    where: { id },
    data: updates,
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { fields: { orderBy: { order: 'asc' } } },
      },
    },
  });

  logger.info('Form updated', { id, version: updated.versions[0]?.version });
  return updated;
}

/**
 * Publish form — makes the current version public
 */
export async function publishForm(id: string) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!form) throw new AppError('Form not found', 404);

  const latestVersion = form.versions[0];
  if (!latestVersion) throw new AppError('Form has no versions', 400);

  await prisma.$transaction([
    prisma.formVersion.update({
      where: { id: latestVersion.id },
      data: { publishedAt: new Date() },
    }),
    prisma.form.update({
      where: { id },
      data: { status: 'PUBLISHED', currentVersionId: latestVersion.id },
    }),
  ]);

  logger.info('Form published', { id, version: latestVersion.version });
  return { success: true, version: latestVersion.version };
}

/**
 * Unpublish form
 */
export async function unpublishForm(id: string) {
  await prisma.form.update({
    where: { id },
    data: { status: 'DRAFT' },
  });
  return { success: true };
}

/**
 * Clone form
 */
export async function cloneForm(id: string) {
  const original = await getForm(id);
  const latestVersion = original.versions[0];

  return createForm({
    title: `${original.title} (Copy)`,
    description: original.description || undefined,
    fields: latestVersion.fields.map(f => ({
      type: f.type,
      label: f.label,
      name: f.name,
      description: f.description || undefined,
      placeholder: f.placeholder || undefined,
      required: f.required,
      order: f.order,
      options: (f.options as string[]) || undefined,
      validation: (f.validation as Record<string, unknown>) || undefined,
      conditionalOn: (f.conditionalOn as Record<string, unknown>) || undefined,
    })),
  });
}

/**
 * Soft delete form
 */
export async function softDeleteForm(id: string) {
  return prisma.form.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
}
