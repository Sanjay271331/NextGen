// ── Status Enums ─────────────────────────────────────

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SHORTLISTED = 'SHORTLISTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
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

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

// ── Simplified Field Types ───────────────────────────
// Limited to practical types required by hackathon forms
export enum FieldType {
  SHORT_TEXT = 'SHORT_TEXT',
  LONG_TEXT = 'LONG_TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NUMBER = 'NUMBER',
  DROPDOWN = 'DROPDOWN',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
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

export const PERMISSIONS = {
  ALL: '*',
  DOMAINS_READ: 'domains:read',
  DOMAINS_WRITE: 'domains:write',
  FORMS_READ: 'forms:read',
  FORMS_WRITE: 'forms:write',
  REGISTRATIONS_READ: 'registrations:read',
  EXPORTS_DOWNLOAD: 'exports:download',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  [AdminRole.SUPER_ADMIN]: ['*'],
  [AdminRole.ADMIN]: [
    PERMISSIONS.DOMAINS_READ,
    PERMISSIONS.DOMAINS_WRITE,
    PERMISSIONS.FORMS_READ,
    PERMISSIONS.FORMS_WRITE,
    PERMISSIONS.REGISTRATIONS_READ,
    PERMISSIONS.EXPORTS_DOWNLOAD,
    PERMISSIONS.SETTINGS_MANAGE,
  ],
  [AdminRole.VIEWER]: [
    PERMISSIONS.DOMAINS_READ,
    PERMISSIONS.FORMS_READ,
    PERMISSIONS.REGISTRATIONS_READ,
  ],
};
