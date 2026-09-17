import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth.js';
import { logger } from '../utils/logger.js';

/**
 * Send an email using Gmail API
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
  senderName?: string,
  replyTo?: string,
): Promise<{ messageId: string }> {
  try {
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    // Build MIME message
    const boundary = `boundary_${Date.now()}`;
    const senderNameStr = senderName || process.env.DEFAULT_SENDER_NAME || 'Next Gen Buildathon';
    const replyToStr = replyTo || process.env.DEFAULT_REPLY_TO || '';

    let mimeMessage = [
      `From: "${senderNameStr}" <me>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      replyToStr ? `Reply-To: ${replyToStr}` : '',
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      textBody || stripHtml(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ].filter(Boolean).join('\r\n');

    // Base64url encode
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    logger.info('Email sent via Gmail', { to, subject, messageId: result.data.id });
    return { messageId: result.data.id || '' };
  } catch (err) {
    logger.error('Failed to send email via Gmail', {
      error: (err as Error).message,
      to,
      subject,
    });
    throw err;
  }
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
