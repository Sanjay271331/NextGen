import { api } from './api';

export interface DomainItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  registrationCount: number;
  shortlistedCount: number;
  maxRegistrations: number | null;
  eventDate: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  registrationEmailTemplateId?: string | null;
  spreadsheetId?: string | null;
}

// Clean initial state: No dummy domains
export const INITIAL_DOMAINS: DomainItem[] = [];

const DUMMY_SLUGS = new Set([
  'ai-innovation-buildathon-2026',
  'web3-decentralized-2026',
  'open-innovation-sprint',
  'ai-ml-buildathon-2026',
  'web3-hackathon-2026',
  'open-innovation-2026',
]);

export async function fetchAllDomains(): Promise<DomainItem[]> {
  try {
    const res = await api.get<{ data: DomainItem[] }>('/api/domains');
    if (res.data && Array.isArray(res.data)) {
      const filtered = res.data.filter(d => !DUMMY_SLUGS.has(d.slug));
      const local = getStoredLocalDomains();
      const merged = [...filtered];
      local.forEach(loc => {
        if (!merged.some(m => m.id === loc.id || m.slug === loc.slug)) {
          merged.push(loc);
        }
      });
      return merged;
    }
  } catch {
    // API offline
  }
  return getStoredLocalDomains();
}

export function getStoredLocalDomains(): DomainItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('ngb_demo_domains');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out any dummy domains
        const clean = parsed.filter((d: DomainItem) => !DUMMY_SLUGS.has(d.slug) && !d.id.startsWith('demo-domain-'));
        return clean;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function saveLocalDomains(domains: DomainItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Filter out dummy domains
    const clean = domains.filter(d => !DUMMY_SLUGS.has(d.slug) && !d.id.startsWith('demo-domain-'));
    localStorage.setItem('ngb_demo_domains', JSON.stringify(clean));
    window.dispatchEvent(new Event('domains_updated'));

    // Automatically sync domains to backend persistent store with full authoritative replacement
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/sync-domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: clean, replace: true }),
    }).catch(e => console.warn('Domain sync warning:', e));
  } catch (e) {
    console.error(e);
  }
}
