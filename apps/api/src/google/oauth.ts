import { google } from 'googleapis';
import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Create OAuth2 client with optional custom redirect URI
 */
export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Get Integration redirect URI
 */
export function getIntegrationRedirectUri(): string {
  return process.env.GOOGLE_INTEGRATE_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/auth/google/integrate/callback`;
}

/**
 * Generate Google OAuth authorization URL for admin login
 */
export function getAdminAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    prompt: 'consent',
  });
}

/**
 * Generate Google OAuth authorization URL for Google API integration
 */
export function getIntegrationAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client(getIntegrationRedirectUri());
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code: string, redirectUri?: string) {
  const oauth2Client = createOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return {
    email: data.email!,
    name: data.name || data.email!,
    picture: data.picture || undefined,
  };
}

/**
 * Get authenticated OAuth2 client for Google API operations
 */
export async function getAuthenticatedClient() {
  const integration = await prisma.googleIntegration.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!integration) {
    throw new Error('No active Google integration found. Please connect a Google account from the admin dashboard.');
  }

  const oauth2Client = createOAuth2Client();

  try {
    const accessToken = decrypt(integration.accessToken);
    const refreshToken = decrypt(integration.refreshToken);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: integration.tokenExpiry.getTime(),
    });

    // Token refresh is handled automatically by the googleapis library
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.googleIntegration.update({
          where: { id: integration.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            tokenExpiry: new Date(tokens.expiry_date || Date.now() + 3600000),
          },
        });
        logger.info('Google access token refreshed');
      }
    });

    return oauth2Client;
  } catch (err) {
    logger.error('Failed to create authenticated Google client', { error: (err as Error).message });
    throw new Error('Google integration authentication failed. Please reconnect your Google account.');
  }
}

/**
 * Store Google integration tokens
 */
export async function storeIntegrationTokens(
  adminId: string,
  email: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
) {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing required tokens');
  }

  // Deactivate all existing integrations to strictly hold ONLY ONE active sender account
  await prisma.googleIntegration.updateMany({
    data: { isActive: false },
  });

  const data = {
    email,
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiry: new Date(tokens.expiry_date || Date.now() + 3600000),
    scopes: SCOPES,
    isActive: true,
    sheetsConnected: true,
    driveConnected: true,
    gmailConnected: true,
  };

  await prisma.googleIntegration.upsert({
    where: { adminId },
    create: { adminId, ...data },
    update: data,
  });

  logger.info('Single active Google sender account stored', { adminId, email });
}

/**
 * Test Google Sheets connection
 */
export async function testSheetsConnection(): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });
    // Try to access a test spreadsheet
    await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_DEFAULT_SPREADSHEET_ID || 'test',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Test Gmail connection
 */
export async function testGmailConnection(): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.getProfile({ userId: 'me' });
    return true;
  } catch {
    return false;
  }
}
