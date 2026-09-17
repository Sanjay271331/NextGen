import { Request, Response, NextFunction } from 'express';
import { CAPTCHA_SCORE_THRESHOLD } from '@ngb/shared';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Verify Google reCAPTCHA v3 token server-side
 */
export async function verifyCaptcha(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const captchaEnabled = process.env.RECAPTCHA_SECRET_KEY && process.env.RECAPTCHA_SECRET_KEY !== 'your-recaptcha-secret-key';

  if (!captchaEnabled) {
    logger.warn('reCAPTCHA is not configured, skipping verification');
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

    if (!data.success) {
      logger.warn('reCAPTCHA verification failed', { errors: data['error-codes'] });
      throw new AppError('CAPTCHA verification failed. Please try again.', 400);
    }

    const threshold = parseFloat(process.env.CAPTCHA_SCORE_THRESHOLD || String(CAPTCHA_SCORE_THRESHOLD));
    if (data.score !== undefined && data.score < threshold) {
      logger.warn('reCAPTCHA score too low', { score: data.score, threshold });
      throw new AppError('Request blocked due to suspicious activity.', 403);
    }

    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('reCAPTCHA verification error', { error: (err as Error).message });
    throw new AppError('CAPTCHA verification service unavailable. Please try again.', 503);
  }
}
