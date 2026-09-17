import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { appendToSheet, setSheetHeaders } from '../google/sheets.js';

/**
 * Retry pending or failed Google Sheets sync records from PostgreSQL
 */
export async function syncPendingRegistrationsToSheets(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  try {
    const pending = await prisma.registration.findMany({
      where: {
        syncStatus: { in: ['PENDING_SYNC', 'SYNC_FAILED'] },
        deletedAt: null,
      },
      include: {
        domain: true,
        formVersion: {
          include: { fields: { orderBy: { order: 'asc' } } },
        },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const reg of pending) {
      const spreadsheetId = reg.domain.spreadsheetId || process.env.GOOGLE_DEFAULT_SPREADSHEET_ID;
      if (!spreadsheetId) continue;

      try {
        const worksheet = reg.domain.worksheetName || 'Registrations';
        const headers = ['Registration ID', 'Timestamp (UTC)', 'Domain Track', 'Team Name', 'Team Leader', 'Email', 'Phone'];
        for (const field of reg.formVersion.fields) {
          if (!headers.includes(field.label)) headers.push(field.label);
        }

        await setSheetHeaders(spreadsheetId, worksheet, headers);

        const values = (typeof reg.values === 'string' ? JSON.parse(reg.values || '{}') : reg.values) as Record<string, unknown>;
        const rowData = [
          reg.registrationId,
          reg.createdAt.toISOString(),
          reg.domain.name,
          reg.teamName || '',
          reg.teamLeaderName || '',
          reg.email,
          reg.phone || '',
        ];

        for (const field of reg.formVersion.fields) {
          const val = values[field.name];
          rowData.push(val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '');
        }

        await appendToSheet(spreadsheetId, worksheet, rowData);

        await prisma.registration.update({
          where: { id: reg.id },
          data: { syncStatus: 'SYNCED', syncedAt: new Date() },
        });

        synced++;
      } catch (err) {
        failed++;
        logger.warn('Failed retry sync for registration', { id: reg.registrationId, error: (err as Error).message });
      }
    }
  } catch (err) {
    logger.error('Error in syncPendingRegistrationsToSheets', { error: (err as Error).message });
  }

  return { synced, failed };
}

/**
 * Initialize background workers (streamlined to periodic Google Sheets sync retry)
 */
export async function initializeWorkers() {
  logger.info('Background sync initialized: direct database-first storage active.');

  // Run periodic retry check every 5 minutes
  setInterval(() => {
    syncPendingRegistrationsToSheets().catch(() => {});
  }, 5 * 60 * 1000);
}
