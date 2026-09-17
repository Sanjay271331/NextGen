// ── Status Enums ─────────────────────────────────────

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SHORTLISTED = 'SHORTLISTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  DISQUALIFIED = 'DISQUALIFIED',
}

export enum DomainStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum SyncStatus {
  PENDING_SYNC = 'PENDING_SYNC',
  SYNCED = 'SYNCED',
  SYNC_FAILED = 'SYNC_FAILED',
}

export enum EmailStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

export enum EmailType {
  REGISTRATION_CONFIRMATION = 'REGISTRATION_CONFIRMATION',
  SHORTLIST_NOTIFICATION = 'SHORTLIST_NOTIFICATION',
  ADMIN_VERIFICATION = 'ADMIN_VERIFICATION',
  CUSTOM = 'CUSTOM',
  TEST = 'TEST',
}

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum FieldType {
  SHORT_TEXT = 'SHORT_TEXT',
  LONG_TEXT = 'LONG_TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  TIME = 'TIME',
  DROPDOWN = 'DROPDOWN',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  FILE_UPLOAD = 'FILE_UPLOAD',
  URL = 'URL',
  SECTION = 'SECTION',
  INFO_TEXT = 'INFO_TEXT',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PREVIEW = 'PREVIEW',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ImportRowStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  DUPLICATE = 'DUPLICATE',
  UNMATCHED = 'UNMATCHED',
  MISSING_EMAIL = 'MISSING_EMAIL',
  COMMITTED = 'COMMITTED',
  SKIPPED = 'SKIPPED',
}

export enum RegistrationState {
  NOT_STARTED = 'NOT_STARTED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  FULL = 'FULL',
  DISABLED = 'DISABLED',
  PAUSED = 'PAUSED',
}

// ── Permission Constants ─────────────────────────────

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  [AdminRole.SUPER_ADMIN]: ['*'],
  [AdminRole.ADMIN]: [
    'domains:read', 'domains:write',
    'forms:read', 'forms:write',
    'registrations:read', 'registrations:write',
    'teams:read', 'teams:write',
    'shortlist:read', 'shortlist:write',
    'emails:read', 'emails:write',
    'exports:read', 'exports:write',
    'settings:read',
  ],
  [AdminRole.EDITOR]: [
    'domains:read',
    'forms:read', 'forms:write',
    'registrations:read', 'registrations:write',
    'teams:read', 'teams:write',
    'shortlist:read',
    'emails:read', 'emails:write',
    'exports:read',
  ],
  [AdminRole.VIEWER]: [
    'domains:read',
    'forms:read',
    'registrations:read',
    'teams:read',
    'shortlist:read',
    'emails:read',
    'exports:read',
  ],
};

// ── Application Constants ────────────────────────────

export const REGISTRATION_ID_PREFIX = 'NGB';

export const MAX_TEAM_SIZE = 10;
export const MIN_TEAM_SIZE = 1;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
export const VERIFICATION_MAX_ATTEMPTS = 5;

export const EMAIL_BATCH_SIZE = 50;
export const EMAIL_RETRY_MAX = 3;
export const EMAIL_RATE_LIMIT_PER_MINUTE = 30;

export const CAPTCHA_SCORE_THRESHOLD = 0.5;
