import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth.js';
import { logger } from '../utils/logger.js';

/**
 * Append a row to a Google Sheet
 */
export async function appendToSheet(
  spreadsheetId: string,
  worksheetName: string,
  values: (string | number | boolean | null)[]
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${worksheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [values],
      },
    });

    logger.info('Row appended to Google Sheet', { spreadsheetId, worksheetName });
  } catch (err) {
    logger.error('Failed to append to Google Sheet', {
      error: (err as Error).message,
      spreadsheetId,
      worksheetName,
    });
    throw err;
  }
}

/**
 * Set headers in a Google Sheet
 */
export async function setSheetHeaders(
  spreadsheetId: string,
  worksheetName: string,
  headers: string[]
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Check if headers already exist
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${worksheetName}!1:1`,
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${worksheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
      logger.info('Sheet headers set', { spreadsheetId, worksheetName });
    }
  } catch (err) {
    logger.error('Failed to set sheet headers', { error: (err as Error).message });
    throw err;
  }
}

/**
 * Read all data from a Google Sheet
 */
export async function readSheetData(
  spreadsheetId: string,
  worksheetName: string
): Promise<string[][]> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: worksheetName,
    });

    return (response.data.values as string[][]) || [];
  } catch (err) {
    logger.error('Failed to read Google Sheet', { error: (err as Error).message });
    throw err;
  }
}

/**
 * Update a specific row in a Google Sheet
 */
export async function updateSheetRow(
  spreadsheetId: string,
  worksheetName: string,
  rowIndex: number,
  values: (string | number | boolean | null)[]
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${worksheetName}!A${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    logger.info('Sheet row updated', { spreadsheetId, rowIndex });
  } catch (err) {
    logger.error('Failed to update sheet row', { error: (err as Error).message });
    throw err;
  }
}

/**
 * Create a new worksheet in an existing spreadsheet
 */
export async function createWorksheet(
  spreadsheetId: string,
  title: string
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title },
          },
        }],
      },
    });

    logger.info('Worksheet created', { spreadsheetId, title });
  } catch (err) {
    logger.error('Failed to create worksheet', { error: (err as Error).message });
    throw err;
  }
}

/**
 * Update Mail Sent Status for a specific registration in Google Sheets
 */
export async function updateRegistrationMailStatus(
  spreadsheetId: string,
  worksheetName: string,
  registrationId: string,
  mailStatus: string,
): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read existing rows to find header and registration row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: worksheetName,
    });

    const rows = (res.data.values as string[][]) || [];
    if (rows.length === 0) return false;

    // Header row
    const headers = rows[0] || [];
    let mailStatusColIndex = headers.findIndex(h => h && h.toLowerCase().includes('mail sent status'));
    if (mailStatusColIndex === -1) {
      mailStatusColIndex = headers.findIndex(h => h && (h.toLowerCase().includes('mail status') || h.toLowerCase().includes('email status')));
    }

    // Default to column D (index 3) if column was placed right after Status
    if (mailStatusColIndex === -1) {
      mailStatusColIndex = 3;
    }

    // Find row index by matching registration ID in column 0 (1-based index is rowIdx + 1)
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && row[0] === registrationId);
    if (rowIdx === -1) {
      logger.warn('Registration ID not found in sheet for mail status update', { registrationId, spreadsheetId });
      return false;
    }

    // Convert col index to letter (0 -> A, 1 -> B, 3 -> D, etc.)
    const colLetter = String.fromCharCode(65 + mailStatusColIndex);
    const cellRange = `${worksheetName}!${colLetter}${rowIdx + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[mailStatus]],
      },
    });

    logger.info('Updated mail status in Google Sheet', { registrationId, mailStatus, cellRange });
    return true;
  } catch (err) {
    logger.error('Failed to update mail status in Google Sheet', {
      error: (err as Error).message,
      spreadsheetId,
      registrationId,
    });
    return false;
  }
}

