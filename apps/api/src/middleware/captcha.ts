import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

const CAPTCHA_SCORE_THRESHOLD = 0.5;

/**
 * Verify Google reCAPTCHA v3 token server-side
 */
export async function verifyCaptcha(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const captchaEnabled = process.env.RECAPTCHA_SECRET_KEY && process.env.RECAPTCHA_SECRET_KEY !== 'your-recaptcha-secret-key';

  if (!captchaEnabled) {
    next();
    return;
  }

  const token = req.body.captchaToken;
  if (!token) {
    throw new AppError('CAPTCHA verification required', 400);
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY!,
        response: token,
        remoteip: req.ip || '',
      }),
    });

    const data = await response.json() as {
      success: boolean;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };

    if (!data.success || (data.score !== undefined && data.score < CAPTCHA_SCORE_THRESHOLD)) {
      logger.warn('reCAPTCHA verification failed', { score: data.score });
      throw new AppError('Security check failed. Please try again.', 403);
    }

    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('reCAPTCHA verification error', { error: (err as Error).message });
    // In case of captcha service network outage, allow registration rather than blocking users
    next();
  }
}
