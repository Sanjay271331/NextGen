import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { domainRoutes } from './routes/domain.routes.js';
import { formRoutes } from './routes/form.routes.js';
import { registrationRoutes } from './routes/registration.routes.js';
import { teamRoutes } from './routes/team.routes.js';
import { shortlistRoutes } from './routes/shortlist.routes.js';
import { emailRoutes } from './routes/email.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { googleRoutes } from './routes/google.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { initializeWorkers } from './jobs/index.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '4000', 10);

// ── Request ID ───────────────────────────────────────
app.use((req, _res, next) => {
  req.id = uuidv4();
  next();
});

// ── Security Headers ─────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────────────
const allowedOrigins = [
  process.env.APP_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

// ── Sessions ─────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  name: 'ngb.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ── Global Rate Limiting ─────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: isDev ? 10000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  skip: () => isDev,
});
app.use(globalLimiter);

// ── Request Logging ──────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// ── Health Check ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Next Gen Buildathon API is running', timestamp: new Date().toISOString() });
});

// ── Public Routes (No Auth) ──────────────────────────
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);

// ── Admin Routes (Auth Required) ─────────────────────
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/audit', auditRoutes);

// ── 404 Handler ──────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ── Error Handler ────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Next Gen Buildathon API running on port ${PORT}`);
  logger.info(`Public URL: ${process.env.APP_URL || 'http://localhost:3000'}`);
  logger.info(`Admin URL: ${process.env.ADMIN_URL || 'http://localhost:3001'}`);
  logger.info(`API URL: http://localhost:${PORT}`);

  // Initialize background workers
  initializeWorkers().catch((err) => {
    logger.error('Failed to initialize workers', { error: err.message });
  });
});

// ── Process Error Handlers ────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason instanceof Error ? reason.message : reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error?.message, stack: error?.stack });
});

// ── Graceful Shutdown ────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});


// Augment express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
      admin?: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    }
  }
}

export default app;
