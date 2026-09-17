import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]${metaStr}: ${message}`;
});

// Sensitive fields that must never be logged
const REDACTED_FIELDS = [
  'accessToken', 'refreshToken', 'clientSecret',
  'password', 'verificationCode', 'codeHash',
  'sessionSecret', 'encryptionKey',
];

const redactSensitive = winston.format((info) => {
  for (const field of REDACTED_FIELDS) {
    if (info[field]) info[field] = '[REDACTED]';
  }
  if (info.meta && typeof info.meta === 'object') {
    for (const field of REDACTED_FIELDS) {
      if ((info.meta as Record<string, unknown>)[field]) {
        (info.meta as Record<string, unknown>)[field] = '[REDACTED]';
      }
    }
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    redactSensitive(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
  defaultMeta: { service: 'ngb-api' },
});
