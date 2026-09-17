import { google } from 'googleapis';
import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

// Scopes required solely for Google Sheets synchronization
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Create OAuth2 client with optional custom redirect URI
 */
export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || getSheetsRedirectUri(),
  );
}

/**
 * Get Google Sheets redirect URI
 */
export function getSheetsRedirectUri(): string {
  return process.env.GOOGLE_INTEGRATE_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/auth/google/sheets/callback`;
}

/**
 * Generate Google OAuth authorization URL for Google Sheets integration
 */
export function getSheetsAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
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
  };
}

/**
 * Get authenticated OAuth2 client for Google Sheets operations
 */
export async function getAuthenticatedClient() {
  const integration = await prisma.googleIntegration.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!integration) {
    throw new Error('Google Sheets is not configured. Please connect a Google account from the admin settings.');
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

    // Auto-refresh token listener
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
    throw new Error('Google Sheets integration authentication failed. Please reconnect your account.');
  }
}

/**
 * Store Google Sheets integration tokens
 */
export async function storeSheetsTokens(
  adminId: string,
  email: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
) {
  if (!tokens.access_token) {
    throw new Error('Missing required OAuth access token');
  }

  // Ensure only one active Google account is held
  await prisma.googleIntegration.updateMany({
    data: { isActive: false },
  });

  const refreshToken = tokens.refresh_token || tokens.access_token;

  const data = {
    email,
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(refreshToken),
    tokenExpiry: new Date(tokens.expiry_date || Date.now() + 3600000),
    scopes: JSON.stringify(SCOPES),
    isActive: true,
    sheetsConnected: true,
  };

  await prisma.googleIntegration.upsert({
    where: { adminId },
    create: { adminId, ...data },
    update: data,
  });

  logger.info('Google Sheets account connected successfully', { adminId, email });
}
