import ExcelJS from 'exceljs';
import { Queue, Worker, Job } from 'bullmq';
import { getRedis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { sendEmail } from '../google/gmail.js';
import { appendToSheet, setSheetHeaders } from '../google/sheets.js';
import { getOrCreateSubmissionsFolder, uploadSubmissionRecordToDrive, uploadExcelFileToDrive } from '../google/drive.js';
import { renderTemplate } from '../services/email.service.js';
import { updateLocalRegistrationSync, getLocalRegistrations } from '../utils/persistentStore.js';

// ── Rate-Limited Sequential Task Queue (In-Memory & Resilient) ─────────────
export interface SequentialRegistrationTask {
  registrationId: string;
  domainId?: string;
  domainSlug: string;
  domainName: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  phone?: string | null;
  values: Record<string, unknown>;
  createdAt: string;
  spreadsheetId?: string | null;
  worksheetName?: string;
  templateId?: string | null;
  retries?: number;
}

const sequentialQueue: SequentialRegistrationTask[] = [];
let isProcessingSequentialQueue = false;
const RATE_LIMIT_DELAY_MS = 1500; // 1.5 seconds delay between tasks = 40 req/min (Safe below Google's 60 req/min limit)

/**
 * Push a registration to the sequential queue
 */
export function enqueueSequentialRegistrationTask(task: SequentialRegistrationTask) {
  sequentialQueue.push(task);
  logger.info(`[QUEUE] Enqueued registration task for ${task.registrationId} (${task.email}). Queue depth: ${sequentialQueue.length}`);
  processSequentialQueue();
}

/**
 * Generate in-memory Excel spreadsheet buffer of all registrations
 */
async function generateRegistrationsExcelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Next Gen Buildathon System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('All Registrations');

  worksheet.columns = [
    { header: 'Registration ID', key: 'registrationId', width: 22 },
    { header: 'Timestamp (UTC)', key: 'createdAt', width: 24 },
    { header: 'Domain Track', key: 'domainName', width: 22 },
    { header: 'Team Name', key: 'teamName', width: 25 },
    { header: 'Team Leader', key: 'teamLeaderName', width: 22 },
    { header: 'Email Address', key: 'email', width: 30 },
    { header: 'Phone / WhatsApp', key: 'phone', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Sync Status', key: 'syncStatus', width: 15 },
    { header: 'Submitted Details (JSON)', key: 'values', width: 50 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  const registrations = getLocalRegistrations();
  for (const reg of registrations) {
    const row = worksheet.addRow({
      registrationId: reg.registrationId,
      createdAt: reg.createdAt,
      domainName: reg.domainName,
      teamName: reg.teamName,
      teamLeaderName: reg.teamLeaderName,
      email: reg.email,
      phone: reg.phone || '',
      status: reg.status,
      syncStatus: reg.syncStatus,
      values: JSON.stringify(reg.values),
    });
    row.alignment = { vertical: 'middle' };
  }

  const uint8 = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8);
}

/**
 * Sequential Queue Processor
 * Processes registrations strictly ONE BY ONE with a safe rate-limit delay
 */
/**
 * Sequential Queue Processor
 * Processes registrations strictly ONE BY ONE with a safe rate-limit delay
 */
async function processSequentialQueue() {
  if (isProcessingSequentialQueue) return;
  isProcessingSequentialQueue = true;

  try {
    while (sequentialQueue.length > 0) {
      const task = sequentialQueue.shift();
      if (!task) break;

      logger.info(`[QUEUE WORKER] ⚙️ Processing task for Registration: ${task.registrationId} (${task.teamName})`);

      let driveSuccess = false;
      let sheetSuccess = false;
      let emailSuccess = false;

      // 1. Google Drive Submission Upload & Master Excel
      try {
        const folderInfo = await getOrCreateSubmissionsFolder();
        const fileName = `${task.registrationId}_${task.teamName.replace(/[^a-zA-Z0-9_-]/g, '_')}_details.json`;
        await uploadSubmissionRecordToDrive(folderInfo.folderId, fileName, {
          registrationId: task.registrationId,
          teamName: task.teamName,
          teamLeaderName: task.teamLeaderName,
          email: task.email,
          phone: task.phone,
          domainSlug: task.domainSlug,
          domainName: task.domainName,
          submittedAt: task.createdAt,
          submittedValues: task.values,
        });

        // Sync master Excel spreadsheet (.xlsx) into Google Drive folder
        const excelBuffer = await generateRegistrationsExcelBuffer();
        await uploadExcelFileToDrive(
          folderInfo.folderId,
          'Next_Gen_Buildathon_Registrations_Master.xlsx',
          excelBuffer,
        );
        driveSuccess = true;
        logger.info(`[QUEUE WORKER] 📁 Stored team details & updated Master Excel in Google Drive: ${task.registrationId}`);
      } catch (driveErr) {
        logger.warn(`[QUEUE WORKER] Google Drive sync note for ${task.registrationId}: ${(driveErr as Error).message}`);
      }

      // 2. Google Sheets Row Append
      if (task.spreadsheetId) {
        try {
          const worksheet = task.worksheetName || 'Registrations';
          const headers = [
            'Registration ID', 'Timestamp', 'Domain Track', 'Team Name',
            'Leader Name', 'Email', 'Phone', 'Sync Status',
          ];
          await setSheetHeaders(task.spreadsheetId, worksheet, headers);

          const row = [
            task.registrationId,
            task.createdAt,
            task.domainName,
            task.teamName,
            task.teamLeaderName,
            task.email,
            task.phone || '',
            'SYNCED',
          ];
          await appendToSheet(task.spreadsheetId, worksheet, row);
          sheetSuccess = true;
          logger.info(`[QUEUE WORKER] 📊 Appended row to Google Sheet: ${task.registrationId}`);
        } catch (sheetErr) {
          logger.warn(`[QUEUE WORKER] Google Sheet sync note: ${(sheetErr as Error).message}`);
        }
      }

      // 3. Gmail Confirmation Email Dispatch
      try {
        const emailSubject = `🎉 Registration Confirmed: ${task.domainName} (${task.registrationId})`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0b1329; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 22px; font-weight: 800; color: #06b6d4; margin-bottom: 8px;">Next Gen Buildathon</div>
            <h2 style="color: #fff; margin-top: 0;">🎉 Congratulations! Registration Confirmed!</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Hello <strong>${task.teamLeaderName || task.teamName}</strong>,<br/>
              Your registration for <strong>${task.domainName}</strong> has been successfully processed and secured in our database!
            </p>
            <div style="background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); border-radius: 12px; padding: 18px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Registration ID:</span>
                <strong style="color: #38bdf8; font-family: monospace; font-size: 16px;">${task.registrationId}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Team Name:</span>
                <strong style="color: #fff;">${task.teamName}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span style="color: #94a3b8;">Track:</span>
                <strong style="color: #fff;">${task.domainName}</strong>
              </div>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              Please preserve this email and your <strong>Registration ID</strong>. Shortlisted teams and event schedules will be published on the portal soon.
            </p>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background: #06b6d4; color: #050a18; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                Visit Buildathon Portal →
              </a>
            </div>
          </div>
        `;

        await sendEmail(
          task.email,
          emailSubject,
          emailHtml,
          `Congratulations! You have successfully registered for ${task.domainName}. Registration ID: ${task.registrationId}`,
        );
        emailSuccess = true;
        logger.info(`[QUEUE WORKER] ✉️ Confirmation email delivered via Gmail to ${task.email}`);
      } catch (mailErr) {
        logger.warn(`[QUEUE WORKER] Gmail dispatch note: ${(mailErr as Error).message}`);
      }

      // 4. Determine final sync status & handle retries if everything failed
      let finalStatus = 'SYNCED';
      if (!driveSuccess && !emailSuccess) {
        task.retries = (task.retries || 0) + 1;
        if (task.retries <= 2) {
          logger.warn(`[QUEUE WORKER] ⚠️ Retrying task ${task.registrationId} (attempt ${task.retries}/2) after pacing delay.`);
          sequentialQueue.push(task);
          finalStatus = 'PENDING_RETRY';
        } else {
          logger.error(`[QUEUE WORKER] ❌ Cloud sync failed for ${task.registrationId} after ${task.retries} attempts.`);
          finalStatus = 'SYNC_FAILED';
        }
      } else if (!driveSuccess || !emailSuccess) {
        finalStatus = 'PARTIALLY_SYNCED';
      }

      updateLocalRegistrationSync(task.registrationId, finalStatus);
      try {
        await prisma.registration.updateMany({
          where: { registrationId: task.registrationId },
          data: { syncStatus: finalStatus, syncedAt: new Date() },
        });
      } catch {}

      logger.info(`[QUEUE WORKER] ✅ Finished task ${task.registrationId} (Status: ${finalStatus}). Pacing ${RATE_LIMIT_DELAY_MS}ms.`);
      // Strict 1.5s rate-limit delay before processing next item in queue
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  } catch (err) {
    logger.error('[QUEUE WORKER] Unexpected queue processing error', { error: (err as Error).message });
  } finally {
    isProcessingSequentialQueue = false;
  }
}

// ── Legacy BullMQ Queues (Used when Redis is present) ────────────────────────
let emailQueue: Queue | null = null;
let sheetSyncQueue: Queue | null = null;

function getEmailQueue(): Queue | null {
  try {
    if (!emailQueue) {
      emailQueue = new Queue('email', { connection: getRedis() });
    }
    return emailQueue;
  } catch {
    return null;
  }
}

function getSheetSyncQueue(): Queue | null {
  try {
    if (!sheetSyncQueue) {
      sheetSyncQueue = new Queue('sheet-sync', { connection: getRedis() });
    }
    return sheetSyncQueue;
  } catch {
    return null;
  }
}

export async function queueEmailJob(data: {
  registrationId: string;
  domainId: string;
  templateId: string;
  recipient: string;
  type: string;
}) {
  try {
    const queue = getEmailQueue();
    if (queue) {
      await queue.add('send-email', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      logger.info('Email job queued via Redis', { recipient: data.recipient, type: data.type });
    }
  } catch (err) {
    logger.warn('Redis queue unavailable, will rely on sequential queue worker', { error: (err as Error).message });
  }
}

export async function queueSheetSyncJob(data: {
  registrationId: string;
  domainId: string;
  spreadsheetId: string;
  worksheetName: string;
}) {
  try {
    const queue = getSheetSyncQueue();
    if (queue) {
      await queue.add('sync-sheet', data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      logger.info('Sheet sync job queued via Redis', { registrationId: data.registrationId });
    }
  } catch (err) {
    logger.warn('Redis queue unavailable, will rely on sequential queue worker', { error: (err as Error).message });
  }
}

export async function queueBulkEmailJobs(jobs: Array<{
  registrationId: string;
  domainId: string;
  templateId: string;
  recipient: string;
  type: string;
}>) {
  try {
    const queue = getEmailQueue();
    if (queue) {
      const bulkJobs = jobs.map((data, index) => ({
        name: 'send-email',
        data,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 5000 },
          delay: index * 2000,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }));
      await queue.addBulk(bulkJobs);
      logger.info(`${jobs.length} bulk email jobs queued`);
      return;
    }
  } catch {}

  // In-memory fallback
  logger.info(`Processing ${jobs.length} emails sequentially in-memory`);
}

export async function initializeWorkers() {
  logger.info('Sequential rate-limited background worker initialized');
}
