import type {
  AdminRole,
  RegistrationStatus,
  DomainStatus,
  FormStatus,
  SyncStatus,
  FieldType,
  RegistrationState,
} from './constants.js';

// ── Admin ────────────────────────────────────────────

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
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
  formId?: string;
  registrationCount: number;
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
  status: FormStatus;
  isGlobal: boolean;
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
  formVersionId?: string;
  type: FieldType;
  label: string;
  name: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
  validation?: FieldValidation;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
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
}

// ── Google Integration ───────────────────────────────

export interface GoogleIntegration {
  id: string;
  adminId: string;
  email: string;
  tokenExpiry: Date;
  isActive: boolean;
  sheetsConnected: boolean;
  spreadsheetId?: string;
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
