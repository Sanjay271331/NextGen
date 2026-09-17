export interface FormFieldItem {
  id: string;
  type: string; // SHORT_TEXT | LONG_TEXT | EMAIL | PHONE | NUMBER | DATE | TIME | DROPDOWN | RADIO | CHECKBOX | MULTIPLE_CHOICE | URL | SECTION | INFO_TEXT
  label: string;
  name: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
  validation?: Record<string, unknown>;
}

export interface DomainFormItem {
  id: string;
  domainId: string;
  domainName: string;
  domainSlug: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED';
  version: number;
  fields: FormFieldItem[];
  updatedAt: string;
}

// Minimal starter fields (all can be deleted, edited, or expanded by the admin)
export const MINIMAL_STARTER_FIELDS: FormFieldItem[] = [
  {
    id: 'f-1',
    type: 'SHORT_TEXT',
    label: 'Participant / Team Name',
    name: 'team_name',
    placeholder: 'Enter name or team name',
    required: true,
    order: 0,
  },
  {
    id: 'f-2',
    type: 'EMAIL',
    label: 'Email Address',
    name: 'email',
    placeholder: 'name@example.com',
    required: true,
    order: 1,
  },
  {
    id: 'f-3',
    type: 'PHONE',
    label: 'Phone Number',
    name: 'phone',
    placeholder: '+91 98765 43210',
    required: true,
    order: 2,
  },
  {
    id: 'f-4',
    type: 'LONG_TEXT',
    label: 'Project Idea / Submission Summary',
    name: 'project_title',
    placeholder: 'Describe your idea, project details, or problem statement...',
    required: false,
    order: 3,
  },
];

export function getStoredForms(): DomainFormItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('ngb_domain_forms');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function saveStoredForms(forms: DomainFormItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ngb_domain_forms', JSON.stringify(forms));
    window.dispatchEvent(new Event('forms_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error(e);
  }
}

export function getFormForDomain(domainId?: string, domainSlug?: string): DomainFormItem | null {
  const forms = getStoredForms();
  if (!forms || forms.length === 0) return null;

  // 1. First priority: match by domainSlug (case-insensitive)
  if (domainSlug) {
    const cleanSlug = domainSlug.toLowerCase().trim();
    const bySlug = forms.find(f => f.domainSlug && f.domainSlug.toLowerCase().trim() === cleanSlug);
    if (bySlug) return bySlug;
  }

  // 2. Second priority: match by domainId
  if (domainId) {
    const byId = forms.find(f => f.domainId === domainId || f.id === domainId);
    if (byId) return byId;
  }

  return null;
}

export function createOrUpdateDomainForm(formData: {
  domainId: string;
  domainName: string;
  domainSlug: string;
  title: string;
  description: string;
  fields: FormFieldItem[];
  status?: 'DRAFT' | 'PUBLISHED';
}): DomainFormItem {
  const forms = getStoredForms();
  const cleanSlug = formData.domainSlug.toLowerCase().trim();

  // Filter out any existing entries for this domain to eliminate duplicates/stale data
  const remainingForms = forms.filter(f => {
    const slugMatch = f.domainSlug && f.domainSlug.toLowerCase().trim() === cleanSlug;
    const idMatch = f.domainId && f.domainId === formData.domainId;
    return !slugMatch && !idMatch;
  });

  const updatedForm: DomainFormItem = {
    id: `form-${cleanSlug}`,
    domainId: formData.domainId,
    domainName: formData.domainName,
    domainSlug: cleanSlug,
    title: formData.title,
    description: formData.description,
    status: formData.status || 'PUBLISHED',
    version: Date.now(),
    fields: formData.fields,
    updatedAt: new Date().toISOString(),
  };

  const newForms = [updatedForm, ...remainingForms];
  saveStoredForms(newForms);

  // Automatically sync to backend persistent store
  if (typeof window !== 'undefined') {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/publish-form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domainId: formData.domainId,
        domainSlug: cleanSlug,
        title: formData.title,
        description: formData.description,
        fields: formData.fields,
        status: formData.status || 'PUBLISHED',
      }),
    }).catch(e => console.warn('Form sync warning:', e));
  }

  return updatedForm;
}

export function deleteFormForDomain(domainId?: string, domainSlug?: string): void {
  const forms = getStoredForms();
  const cleanSlug = domainSlug ? domainSlug.toLowerCase().trim() : '';
  const remaining = forms.filter(f => {
    const slugMatch = cleanSlug && f.domainSlug && f.domainSlug.toLowerCase().trim() === cleanSlug;
    const idMatch = domainId && (f.domainId === domainId || f.id === domainId);
    return !slugMatch && !idMatch;
  });
  saveStoredForms(remaining);
}
