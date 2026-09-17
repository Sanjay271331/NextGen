import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Export registrations as XLSX
 */
export async function exportRegistrations(options: {
  domainId?: string;
  status?: string;
  ids?: string[];
  type?: 'all' | 'shortlisted' | 'registered' | 'rejected';
}): Promise<Buffer> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (options.domainId) where.domainId = options.domainId;
  if (options.ids && options.ids.length > 0) where.id = { in: options.ids };

  if (options.type === 'shortlisted') where.status = 'SHORTLISTED';
  else if (options.type === 'registered') where.status = 'REGISTERED';
  else if (options.type === 'rejected') where.status = 'REJECTED';
  else if (options.status) where.status = options.status;

  const registrations = await prisma.registration.findMany({
    where,
    include: {
      domain: { select: { name: true } },
      formVersion: {
        include: { fields: { orderBy: { order: 'asc' } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (registrations.length === 0) {
    throw new AppError('No registrations found for export', 404);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Next Gen Buildathon';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Registrations');

  // Build columns from form fields
  const firstReg = registrations[0];
  const fields = firstReg.formVersion.fields;

  const columns: ExcelJS.Column[] = [
    { header: 'Registration ID', key: 'registrationId', width: 20 },
    { header: 'Domain', key: 'domain', width: 25 },
    { header: 'Team Name', key: 'teamName', width: 25 },
    { header: 'Team Leader', key: 'teamLeaderName', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Sync Status', key: 'syncStatus', width: 15 },
  ] as ExcelJS.Column[];

  // Add dynamic field columns
  for (const field of fields) {
    if (field.type !== 'SECTION' && field.type !== 'INFO_TEXT') {
      if (!['email', 'phone', 'team_name', 'teamName', 'team_leader_name', 'teamLeaderName'].includes(field.name)) {
        columns.push({
          header: field.label,
          key: field.name,
          width: 20,
        } as ExcelJS.Column);
      }
    }
  }

  columns.push(
    { header: 'Registered At', key: 'createdAt', width: 22 } as ExcelJS.Column,
    { header: 'Updated At', key: 'updatedAt', width: 22 } as ExcelJS.Column,
  );

  worksheet.columns = columns;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Add data rows
  for (const reg of registrations) {
    const values = (typeof reg.values === 'string' ? JSON.parse(reg.values || '{}') : reg.values) as Record<string, unknown>;
    const row: Record<string, unknown> = {
      registrationId: reg.registrationId,
      domain: reg.domain.name,
      teamName: reg.teamName,
      teamLeaderName: reg.teamLeaderName,
      email: reg.email,
      phone: reg.phone,
      status: reg.status,
      syncStatus: reg.syncStatus,
      createdAt: reg.createdAt.toISOString(),
      updatedAt: reg.updatedAt.toISOString(),
    };

    // Add dynamic field values
    for (const field of fields) {
      if (field.type !== 'SECTION' && field.type !== 'INFO_TEXT') {
        if (!['email', 'phone', 'team_name', 'teamName', 'team_leader_name', 'teamLeaderName'].includes(field.name)) {
          const val = values[field.name];
          row[field.name] = Array.isArray(val) ? val.join(', ') : String(val ?? '');
        }
      }
    }

    worksheet.addRow(row);
  }

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: registrations.length + 1, column: columns.length },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  logger.info('Excel export generated', { rows: registrations.length });
  return Buffer.from(buffer);
}

