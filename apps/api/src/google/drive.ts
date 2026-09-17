import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth.js';
import { logger } from '../utils/logger.js';
import { Readable } from 'stream';

let cachedFolderId: string | null = process.env.GOOGLE_DEFAULT_DRIVE_FOLDER_ID || null;

/**
 * Get or create the official Google Drive folder for Next Gen Buildathon submissions
 */
export async function getOrCreateSubmissionsFolder(): Promise<{ folderId: string; folderUrl: string }> {
  if (cachedFolderId) {
    return {
      folderId: cachedFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${cachedFolderId}`,
    };
  }

  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    // Search for existing folder
    const searchRes = await drive.files.list({
      q: "name = 'Next Gen Buildathon 2026 - Submissions' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      const folder = searchRes.data.files[0];
      cachedFolderId = folder.id!;
      logger.info('Found existing Google Drive folder', { folderId: folder.id });
      return {
        folderId: folder.id!,
        folderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
      };
    }

    // Create new folder
    const fileMetadata = {
      name: 'Next Gen Buildathon 2026 - Submissions',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official repository folder for Next Gen Buildathon 2026 participant registrations and project submissions.',
    };

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, webViewLink',
    });

    const folderId = createRes.data.id!;
    cachedFolderId = folderId;

    logger.info('Created new Google Drive folder for submissions', { folderId });
    return {
      folderId,
      folderUrl: createRes.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    };
  } catch (err) {
    logger.warn('Google Drive folder lookup fallback', { error: (err as Error).message });
    const fallbackId = '1NGB-Submissions-Drive-Folder';
    return {
      folderId: fallbackId,
      folderUrl: `https://drive.google.com/drive/folders/${fallbackId}`,
    };
  }
}

/**
 * Upload team registration & submission summary record to Google Drive
 */
export async function uploadSubmissionRecordToDrive(
  folderId: string,
  fileName: string,
  data: Record<string, unknown>,
): Promise<{ fileId: string; fileUrl: string } | null> {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const fileContent = JSON.stringify(data, null, 2);
    const stream = new Readable();
    stream.push(fileContent);
    stream.push(null); // EOF

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    logger.info('Uploaded submission record to Google Drive', {
      fileId: response.data.id,
      fileName,
    });

    return {
      fileId: response.data.id || '',
      fileUrl: response.data.webViewLink || '',
    };
  } catch (err) {
    logger.error('Failed to upload submission to Google Drive', { error: (err as Error).message, fileName });
    return null;
  }
}

/**
 * Upload an Excel (.xlsx) file buffer to Google Drive
 */
export async function uploadExcelFileToDrive(
  folderId: string,
  fileName: string,
  buffer: Buffer,
): Promise<{ fileId: string; fileUrl: string } | null> {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    // Check if an Excel file with this name already exists in the folder
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: stream,
    };

    if (existing.data.files && existing.data.files.length > 0) {
      const fileId = existing.data.files[0].id!;
      const updateRes = await drive.files.update({
        fileId,
        media,
        fields: 'id, webViewLink',
      });
      logger.info('Updated Excel registrations workbook in Google Drive', { fileId, fileName });
      return {
        fileId: updateRes.data.id || fileId,
        fileUrl: updateRes.data.webViewLink || '',
      };
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        media,
        fields: 'id, webViewLink',
      });
      logger.info('Created new Excel registrations workbook in Google Drive', { fileId: createRes.data.id, fileName });
      return {
        fileId: createRes.data.id || '',
        fileUrl: createRes.data.webViewLink || '',
      };
    }
  } catch (err) {
    logger.error('Failed to upload Excel file to Google Drive', { error: (err as Error).message, fileName });
    return null;
  }
}

/**
 * Get current Google Drive folder URL
 */
export function getDriveFolderUrl(): string {
  const folderId = cachedFolderId || process.env.GOOGLE_DEFAULT_DRIVE_FOLDER_ID || '1NGB-Submissions-Drive-Folder';
  return `https://drive.google.com/drive/folders/${folderId}`;
}
