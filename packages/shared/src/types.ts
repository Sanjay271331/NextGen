import type {
  AdminRole,
  RegistrationStatus,
  DomainStatus,
  FormStatus,
  SyncStatus,
  EmailStatus,
  EmailType,
  FieldType,
  ImportStatus,
  ImportRowStatus,
  RegistrationState,
} from './constants.js';

// ── Admin ────────────────────────────────────────────

export interface Admin {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: AdminRole;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Domain ───────────────────────────────────────────

export interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string;
  eventDate?: Date;
  registrationStart?: Date;
  registrationEnd?: Date;
  maxRegistrations?: number;
  status: DomainStatus;
  spreadsheetId?: string;
  worksheetName?: string;
  driveFolderId?: string;
  formId?: string;
  registrationEmailTemplateId?: string;
  shortlistEmailTemplateId?: string;
  registrationCount: number;
  shortlistedCount: number;
  registrationState: RegistrationState;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ── Form ─────────────────────────────────────────────

export interface Form {
  id: string;
  title: string;
  description?: string;
  domainId?: string;
  status: FormStatus;
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface FormVersion {
  id: string;
  formId: string;
  version: number;
  fields: FormField[];
  publishedAt?: Date;
  createdAt: Date;
}

export interface FormField {
  id: string;
  formVersionId: string;
  type: FieldType;
  label: string;
  name: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
  validation?: FieldValidation;
  conditionalOn?: ConditionalRule;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

export interface ConditionalRule {
  fieldName: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains';
  value: string;
}

// ── Registration ─────────────────────────────────────

export interface Registration {
  id: string;
  registrationId: string;
  domainId: string;
  formVersionId: string;
  teamName?: string;
  teamLeaderName?: string;
  email: string;
  phone?: string;
  status: RegistrationStatus;
  syncStatus: SyncStatus;
  syncedAt?: Date;
  values: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
  deletionReason?: string;
}

export interface RegistrationValue {
  id: string;
  registrationId: string;
  fieldId: string;
  fieldName: string;
  value: unknown;
}

// ── Team ─────────────────────────────────────────────

export interface Team {
  id: string;
  registrationId: string;
  domainId: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  size: number;
  status: RegistrationStatus;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  order: number;
}

// ── Email ────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailType;
  domainId?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  senderName?: string;
  replyTo?: string;
  isActive: boolean;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailJob {
  id: string;
  templateId?: string;
  registrationId?: string;
  domainId?: string;
  type: EmailType;
  recipient: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  senderName?: string;
  replyTo?: string;
  status: EmailStatus;
  retryCount: number;
  maxRetries: number;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLog {
  id: string;
  jobId: string;
  recipient: string;
  type: EmailType;
  templateName?: string;
  domainId?: string;
  registrationId?: string;
  status: EmailStatus;
  sentAt?: Date;
  retryCount: number;
  error?: string;
  createdAt: Date;
}

// ── Google Integration ───────────────────────────────

export interface GoogleIntegration {
  id: string;
  adminId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  scopes: string[];
  isActive: boolean;
  sheetsConnected: boolean;
  driveConnected: boolean;
  gmailConnected: boolean;
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SheetSyncJob {
  id: string;
  registrationId: string;
  domainId: string;
  spreadsheetId: string;
  worksheetName: string;
  status: SyncStatus;
  retryCount: number;
  error?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Import ───────────────────────────────────────────

export interface ShortlistImport {
  id: string;
  domainId: string;
  adminId: string;
  filename: string;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  unmatchedRows: number;
  committedRows: number;
  columnMapping: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShortlistImportRow {
  id: string;
  importId: string;
  rowNumber: number;
  data: Record<string, unknown>;
  status: ImportRowStatus;
  matchedRegistrationId?: string;
  error?: string;
  createdAt: Date;
}

// ── Audit ────────────────────────────────────────────

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result: 'SUCCESS' | 'FAILURE';
  createdAt: Date;
}

// ── System Settings ──────────────────────────────────

export interface SystemSettings {
  organizationName: string;
  organizationLogo?: string;
  supportEmail?: string;
  defaultSenderName: string;
  defaultReplyTo?: string;
  timezone: string;
  dateFormat: string;
  captchaEnabled: boolean;
  captchaScoreThreshold: number;
  maxFileSize: number;
  retentionDays?: number;
}

// ── API Types ────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardStats {
  totalRegistrations: number;
  registrationsToday: number;
  registrationsThisWeek: number;
  totalDomains: number;
  activeDomains: number;
  shortlistedTeams: number;
  rejectedTeams: number;
  pendingTeams: number;
  emailsSent: number;
  emailsFailed: number;
  activeForms: number;
  registrationsByDomain: { domain: string; count: number }[];
  registrationsOverTime: { date: string; count: number }[];
  syncPending: number;
  syncFailed: number;
  emailQueuePending: number;
  emailQueueFailed: number;
}
