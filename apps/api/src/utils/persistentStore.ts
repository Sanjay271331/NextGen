import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export interface FormFieldRecord {
  id: string;
  type: string;
  label: string;
  name: string;
  description?: string | null;
  placeholder?: string | null;
  required: boolean;
  order: number;
  options?: string[] | null;
  validation?: Record<string, unknown> | null;
}

export interface DomainRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string; // 'ACTIVE', 'PAUSED'
  registrationCount: number;
  shortlistedCount: number;
  maxRegistrations?: number | null;
  eventDate?: string | null;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  registrationEmailTemplateId?: string | null;
  spreadsheetId?: string | null;
  worksheetName?: string | null;
  driveFolderId?: string | null;
  createdAt: string;
  updatedAt: string;
  form?: {
    id?: string;
    title: string;
    description?: string | null;
    status: 'PUBLISHED' | 'DRAFT';
    publishedAt?: string | null;
    fields: FormFieldRecord[];
  };
}

export interface RegistrationRecord {
  id: string;
  registrationId: string;
  domainSlug: string;
  domainName: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  phone: string | null;
  values: Record<string, unknown>;
  status: string;
  syncStatus: string;
  createdAt: string;
}

export interface ShortlistRecord {
  id: string;
  domainSlug: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  status: 'SHORTLISTED' | 'WAITLISTED';
  publishedAt: string;
}

interface StoreData {
  domains: DomainRecord[];
  registrations: RegistrationRecord[];
  shortlists: ShortlistRecord[];
  driveFolderId?: string;
  driveFolderUrl?: string;
}

function getStorePaths(): string[] {
  const paths = [
    path.resolve(process.cwd(), 'data', 'ngb_store.json'),
    path.resolve(process.cwd(), 'apps', 'api', 'data', 'ngb_store.json'),
    path.resolve('d:/fusion x website/apps/api/data/ngb_store.json'),
    path.resolve('d:/fusion x website/data/ngb_store.json'),
  ];
  return Array.from(new Set(paths));
}

function getActiveStorePath(): string {
  const allPaths = getStorePaths();
  for (const p of allPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.domains) && parsed.domains.length > 0) {
          return p;
        }
      } catch {}
    }
  }
  for (const p of allPaths) {
    if (fs.existsSync(p)) return p;
  }
  return allPaths[0];
}

// Default initial fields for any newly organized form
export const DEFAULT_NGB_FIELDS: FormFieldRecord[] = [
  { id: 'f-1', type: 'SHORT_TEXT', label: 'Participant / Team Name', name: 'team_name', description: null, placeholder: 'e.g. Neural Pioneers', required: true, order: 0, options: null, validation: null },
  { id: 'f-2', type: 'SHORT_TEXT', label: 'Team Leader Full Name', name: 'team_leader_name', description: null, placeholder: 'Full Name', required: true, order: 1, options: null, validation: null },
  { id: 'f-3', type: 'EMAIL', label: 'Email Address', name: 'email', description: 'Automated confirmation email will be sent here', placeholder: 'leader@example.com', required: true, order: 2, options: null, validation: null },
  { id: 'f-4', type: 'PHONE', label: 'Phone / WhatsApp Number', name: 'phone', description: null, placeholder: '+91 98765 43210', required: true, order: 3, options: null, validation: null },
  { id: 'f-5', type: 'DROPDOWN', label: 'Team Size', name: 'team_size', description: null, placeholder: 'Select Team Size', required: true, order: 4, options: ['1 (Solo)', '2 Members', '3 Members', '4 Members'], validation: null },
  { id: 'f-6', type: 'RADIO', label: 'Problem Statement Track', name: 'track', description: null, placeholder: null, required: true, order: 5, options: ['FinTech & Digital Banking', 'Decentralized Finance (DeFi)', 'Open Innovation & AI'], validation: null },
  { id: 'f-7', type: 'LONG_TEXT', label: 'Project Idea / Submission Summary', name: 'project_idea', description: 'Brief description of what your team plans to build', placeholder: 'Explain your idea, tech stack, and goals...', required: true, order: 6, options: null, validation: null },
  { id: 'f-8', type: 'URL', label: 'GitHub / Portfolio Link', name: 'github_link', description: null, placeholder: 'https://github.com/...', required: false, order: 7, options: null, validation: null },
  { id: 'f-9', type: 'CHECKBOX', label: 'I agree to the Hackathon Rules and Code of Conduct', name: 'agree_terms', description: null, placeholder: null, required: true, order: 8, options: null, validation: null },
];

function readStore(): StoreData {
  const filePath = getActiveStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    const initial: StoreData = { domains: [], registrations: [], shortlists: [] };
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    if (!parsed.domains) parsed.domains = [];
    if (!parsed.registrations) parsed.registrations = [];
    if (!parsed.shortlists) parsed.shortlists = [];
    return parsed;
  } catch (err) {
    logger.error('Failed to read persistent store, returning empty', { error: (err as Error).message });
    return { domains: [], registrations: [], shortlists: [] };
  }
}

function writeStore(data: StoreData): void {
  const content = JSON.stringify(data, null, 2);
  const allPaths = getStorePaths();
  for (const filePath of allPaths) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tempFile = `${filePath}.tmp`;
      fs.writeFileSync(tempFile, content, 'utf-8');
      fs.renameSync(tempFile, filePath);
    } catch (err) {
      // Continue to next path
    }
  }
}

// ── Domain Management ────────────────────────────────────────────────────────

/**
 * List all domains created and published by admin
 */
export function listAllDomains(): DomainRecord[] {
  const store = readStore();
  return store.domains;
}

/**
 * Get domain by ID or Slug
 */
export function getDomainByIdOrSlug(idOrSlug: string): DomainRecord | undefined {
  const store = readStore();
  const normalized = idOrSlug.toLowerCase().trim();
  return store.domains.find(d => d.id === idOrSlug || d.slug.toLowerCase().trim() === normalized);
}

/**
 * Save or create a new domain
 */
export function saveDomain(domainInput: {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  status?: string;
  maxRegistrations?: number | null;
  eventDate?: string | null;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  registrationEmailTemplateId?: string | null;
  spreadsheetId?: string | null;
  worksheetName?: string | null;
  driveFolderId?: string | null;
  form?: DomainRecord['form'];
}): DomainRecord {
  const store = readStore();
  const normalizedSlug = domainInput.slug.toLowerCase().trim();

  let existingIndex = store.domains.findIndex(d => d.id === domainInput.id || d.slug.toLowerCase().trim() === normalizedSlug);

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = store.domains[existingIndex];
    const updated: DomainRecord = {
      ...existing,
      ...domainInput,
      id: existing.id,
      slug: normalizedSlug,
      updatedAt: now,
      form: domainInput.form || existing.form || {
        title: `${domainInput.name} Registration Form`,
        description: domainInput.description || 'Fill out the details below to register.',
        status: 'PUBLISHED',
        publishedAt: now,
        fields: DEFAULT_NGB_FIELDS,
      },
    };
    store.domains[existingIndex] = updated;
    writeStore(store);
    logger.info(`[STORE] Domain updated: ${updated.name} (${updated.slug})`);
    return updated;
  } else {
    const newDomain: DomainRecord = {
      id: domainInput.id || `domain-${Date.now()}`,
      name: domainInput.name,
      slug: normalizedSlug,
      description: domainInput.description || `Official registration for ${domainInput.name}`,
      status: domainInput.status || 'ACTIVE',
      registrationCount: 0,
      shortlistedCount: 0,
      maxRegistrations: domainInput.maxRegistrations || 500,
      eventDate: domainInput.eventDate || null,
      registrationStart: domainInput.registrationStart || null,
      registrationEnd: domainInput.registrationEnd || null,
      registrationEmailTemplateId: domainInput.registrationEmailTemplateId || 'tmpl-1',
      spreadsheetId: domainInput.spreadsheetId || null,
      worksheetName: domainInput.worksheetName || 'Registrations',
      driveFolderId: domainInput.driveFolderId || null,
      createdAt: now,
      updatedAt: now,
      form: domainInput.form || {
        title: `${domainInput.name} Registration Form`,
        description: domainInput.description || 'Fill out the details below to register.',
        status: 'PUBLISHED',
        publishedAt: now,
        fields: DEFAULT_NGB_FIELDS,
      },
    };
    store.domains.push(newDomain);
    writeStore(store);
    logger.info(`[STORE] Domain created: ${newDomain.name} (${newDomain.slug})`);
    return newDomain;
  }
}

/**
 * Replace entire domain list with authoritative admin list (handling deletes, additions, and status changes)
 */
export function setAuthoritativeDomains(domains: Array<Partial<DomainRecord> & { name: string; slug: string }>): DomainRecord[] {
  const store = readStore();
  const existingMap = new Map(store.domains.map(d => [d.slug.toLowerCase().trim(), d]));
  const existingIdMap = new Map(store.domains.map(d => [d.id, d]));

  const now = new Date().toISOString();
  const updatedList: DomainRecord[] = domains.map(d => {
    const normSlug = d.slug.toLowerCase().trim();
    const existing = existingMap.get(normSlug) || (d.id ? existingIdMap.get(d.id) : undefined);

    if (existing) {
      return {
        ...existing,
        ...d,
        id: existing.id,
        slug: normSlug,
        status: d.status || existing.status || 'ACTIVE',
        updatedAt: now,
        form: d.form || existing.form,
      };
    } else {
      return {
        id: d.id || `domain-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: d.name,
        slug: normSlug,
        description: d.description || `Official registration for ${d.name}`,
        status: d.status || 'ACTIVE',
        registrationCount: d.registrationCount || 0,
        shortlistedCount: d.shortlistedCount || 0,
        maxRegistrations: d.maxRegistrations || 500,
        eventDate: d.eventDate || null,
        registrationStart: d.registrationStart || null,
        registrationEnd: d.registrationEnd || null,
        registrationEmailTemplateId: d.registrationEmailTemplateId || 'tmpl-1',
        spreadsheetId: d.spreadsheetId || null,
        worksheetName: d.worksheetName || 'Registrations',
        driveFolderId: d.driveFolderId || null,
        createdAt: d.createdAt || now,
        updatedAt: now,
        form: d.form || {
          title: `${d.name} Registration Form`,
          description: d.description || 'Fill out the details below to register.',
          status: 'PUBLISHED',
          publishedAt: now,
          fields: DEFAULT_NGB_FIELDS,
        },
      };
    }
  });

  store.domains = updatedList;
  writeStore(store);
  logger.info(`[STORE] Authoritative domains updated: ${updatedList.length} domains active`);
  return store.domains;
}

/**
 * Update domain
 */
export function updateDomainRecord(idOrSlug: string, updates: Partial<DomainRecord>): DomainRecord | undefined {
  const store = readStore();
  const normalized = idOrSlug.toLowerCase().trim();
  const index = store.domains.findIndex(d => d.id === idOrSlug || d.slug.toLowerCase().trim() === normalized);

  if (index >= 0) {
    store.domains[index] = {
      ...store.domains[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);
    return store.domains[index];
  }
  return undefined;
}

/**
 * Delete domain
 */
export function deleteDomainRecord(idOrSlug: string): boolean {
  const store = readStore();
  const normalized = idOrSlug.toLowerCase().trim();
  const initialLen = store.domains.length;
  store.domains = store.domains.filter(d => d.id !== idOrSlug && d.slug.toLowerCase().trim() !== normalized);
  if (store.domains.length !== initialLen) {
    writeStore(store);
    return true;
  }
  return false;
}

/**
 * Publish / Save Form for Domain
 */
export function saveDomainForm(
  domainIdOrSlug: string,
  formData: {
    title: string;
    description?: string | null;
    status: 'PUBLISHED' | 'DRAFT';
    fields: FormFieldRecord[];
  }
): DomainRecord | undefined {
  const store = readStore();
  const normalized = domainIdOrSlug.toLowerCase().trim();
  const index = store.domains.findIndex(d => d.id === domainIdOrSlug || d.slug.toLowerCase().trim() === normalized);

  if (index >= 0) {
    const domain = store.domains[index];
    domain.form = {
      id: domain.form?.id || `form-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      status: formData.status,
      publishedAt: formData.status === 'PUBLISHED' ? new Date().toISOString() : null,
      fields: formData.fields,
    };
    domain.updatedAt = new Date().toISOString();
    store.domains[index] = domain;
    writeStore(store);
    logger.info(`[STORE] Form published for domain: ${domain.name} (${domain.slug}) with ${formData.fields.length} fields`);
    return domain;
  }
  return undefined;
}

// ── Duplicate Check & Registrations ──────────────────────────────────────────

/**
 * Check if a registration already exists with this email/Gmail address in the domain
 */
export function checkDuplicateRegistration(domainSlug: string, email: string): { duplicate: boolean; reason?: string } {
  const store = readStore();
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSlug = domainSlug.toLowerCase().trim();

  for (const reg of store.registrations) {
    if (reg.domainSlug.toLowerCase() === normalizedSlug) {
      if (reg.email.toLowerCase().trim() === normalizedEmail) {
        return {
          duplicate: true,
          reason: `A registration with email "${email}" has already been submitted for this track. Multiple registrations with the same email are not allowed.`,
        };
      }
    }
  }

  return { duplicate: false };
}

/**
 * Save a registration to persistent local storage
 */
export function saveLocalRegistration(record: RegistrationRecord): RegistrationRecord {
  const store = readStore();
  store.registrations.push(record);

  // Increment registration count for domain
  const domain = store.domains.find(d => d.slug.toLowerCase() === record.domainSlug.toLowerCase());
  if (domain) {
    domain.registrationCount = (domain.registrationCount || 0) + 1;
  }

  writeStore(store);
  logger.info('[STORE] Registration securely persisted to database file', {
    registrationId: record.registrationId,
    email: record.email,
  });
  return record;
}

/**
 * Get all registrations for a domain
 */
export function getLocalRegistrations(domainSlug?: string): RegistrationRecord[] {
  const store = readStore();
  if (!domainSlug) return store.registrations;
  return store.registrations.filter(r => r.domainSlug.toLowerCase() === domainSlug.toLowerCase());
}

/**
 * Update registration sync status
 */
export function updateLocalRegistrationSync(registrationId: string, syncStatus: string): void {
  const store = readStore();
  const reg = store.registrations.find(r => r.registrationId === registrationId || r.id === registrationId);
  if (reg) {
    reg.syncStatus = syncStatus;
    writeStore(store);
  }
}

/**
 * Get shortlisted teams
 */
export function getLocalShortlist(domainSlug?: string): ShortlistRecord[] {
  const store = readStore();
  if (!domainSlug) return store.shortlists;
  return store.shortlists.filter(s => s.domainSlug.toLowerCase() === domainSlug.toLowerCase());
}
