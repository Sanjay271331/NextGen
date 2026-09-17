export interface StoredRegistration {
  id: string;
  registrationId: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  phone: string;
  status: 'REGISTERED' | 'SHORTLISTED' | 'REJECTED' | 'UNDER_REVIEW';
  syncStatus: 'SYNCED' | 'PENDING_SYNC' | 'SYNC_FAILED';
  createdAt: string;
  domainId: string;
  domainName: string;
  values?: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
}

// Clean initial state: 0 dummy teams!
export function getStoredRegistrations(): StoredRegistration[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('ngb_registrations');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out any dummy team names
        const DUMMY_TEAMS = new Set([
          'Neural Navigators', 'Deep Think', 'Code Crushers',
          'AI Pioneers', 'ByteForce', 'Quantum Coders', 'TechTitans', 'InnoVerse'
        ]);
        return parsed.filter(r => !DUMMY_TEAMS.has(r.teamName));
      }
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function saveStoredRegistrations(registrations: StoredRegistration[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ngb_registrations', JSON.stringify(registrations));
    window.dispatchEvent(new Event('registrations_updated'));
  } catch (e) {
    console.error(e);
  }
}

export function addRegistration(reg: Omit<StoredRegistration, 'id' | 'createdAt' | 'status' | 'syncStatus'>): StoredRegistration {
  const newReg: StoredRegistration = {
    ...reg,
    id: `reg-${Date.now()}`,
    status: 'REGISTERED',
    syncStatus: 'SYNCED',
    createdAt: new Date().toISOString(),
  };

  const existing = getStoredRegistrations();
  const updated = [newReg, ...existing];
  saveStoredRegistrations(updated);
  return newReg;
}
