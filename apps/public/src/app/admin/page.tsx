'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

interface AdminUser {
  id: string;
  role: string;
  name: string;
}

interface DomainItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  registrationCount: number;
  maxRegistrations?: number | null;
  eventDate?: string | null;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  spreadsheetId?: string | null;
  worksheetName?: string | null;
  formId?: string | null;
}

interface FormFieldItem {
  id?: string;
  type: string;
  label: string;
  name: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
}

interface FormItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  isGlobal: boolean;
  versions?: Array<{
    id: string;
    version: number;
    publishedAt?: string | null;
    fields: FormFieldItem[];
  }>;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Login form state
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'domains' | 'forms' | 'export' | 'settings'>('dashboard');

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Dashboard state
  const [stats, setStats] = useState<{
    totalRegistrations: number;
    activeDomains: number;
    totalDomains: number;
    totalForms: number;
    sheetsConnected: boolean;
    connectedGoogleEmail?: string | null;
  } | null>(null);

  // Domains state
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainItem | null>(null);
  const [domainFormData, setDomainFormData] = useState({
    name: '',
    slug: '',
    description: '',
    maxRegistrations: '',
    spreadsheetId: '',
    worksheetName: 'Registrations',
    status: 'ACTIVE',
  });

  // Forms state
  const [forms, setForms] = useState<FormItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFields, setFormFields] = useState<FormFieldItem[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Export state
  const [exportDomainId, setExportDomainId] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Settings / Google state
  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    email?: string;
    sheetsConnected: boolean;
    spreadsheetId?: string;
  }>({ connected: false, sheetsConnected: false });

  // 1. Check Authentication Status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setAdmin(data.data);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLoginError('Password is required.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (data.success) {
        setAdmin(data.data);
        setPassword('');
        loadAllData();
      } else {
        setLoginError(data.error || 'Incorrect administrator password.');
      }
    } catch {
      setLoginError('Server unreachable. Please check connection.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setAdmin(null);
    window.location.href = '/';
  };

  // Load Data for Admin Panel
  const loadAllData = useCallback(() => {
    // Stats
    fetch(`${API_BASE}/api/dashboard`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => d.success && setStats(d.data))
      .catch(() => {});

    // Domains
    setDomainsLoading(true);
    fetch(`${API_BASE}/api/domains`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => d.success && setDomains(d.data || []))
      .catch(() => {})
      .finally(() => setDomainsLoading(false));

    // Forms
    setFormsLoading(true);
    fetch(`${API_BASE}/api/forms`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setForms(d.data);
          if (d.data.length > 0 && !selectedForm) {
            loadFormDetails(d.data[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setFormsLoading(false));

    // Google Status
    fetch(`${API_BASE}/api/google/status`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => d.success && setGoogleStatus(d.data))
      .catch(() => {});
  }, [selectedForm]);

  useEffect(() => {
    if (admin) {
      loadAllData();
    }
  }, [admin, loadAllData]);

  // Load Form Details for Form Builder
  const loadFormDetails = async (formId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/forms/${formId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        const f = data.data;
        setSelectedForm(f);
        setFormTitle(f.title);
        setFormDesc(f.description || '');
        setApplyToAll(f.isGlobal ?? true);
        const latestFields = f.versions?.[0]?.fields || [];
        setFormFields(
          latestFields.map((field: any, idx: number) => ({
            id: field.id || `f-${idx}`,
            type: field.type || 'SHORT_TEXT',
            label: field.label,
            name: field.name,
            description: field.description || '',
            placeholder: field.placeholder || '',
            required: Boolean(field.required),
            order: field.order ?? idx,
            options: field.options || [],
          }))
        );
      }
    } catch {
      showToast('error', 'Failed to load form details.');
    }
  };

  // ── Domain Management Actions ────────────────────────
  const handleOpenCreateDomain = () => {
    setEditingDomain(null);
    setDomainFormData({
      name: '',
      slug: '',
      description: '',
      maxRegistrations: '',
      spreadsheetId: googleStatus.spreadsheetId || '',
      worksheetName: 'Registrations',
      status: 'ACTIVE',
    });
    setShowDomainModal(true);
  };

  const handleOpenEditDomain = (dom: DomainItem) => {
    setEditingDomain(dom);
    setDomainFormData({
      name: dom.name,
      slug: dom.slug,
      description: dom.description || '',
      maxRegistrations: dom.maxRegistrations ? String(dom.maxRegistrations) : '',
      spreadsheetId: dom.spreadsheetId || '',
      worksheetName: dom.worksheetName || 'Registrations',
      status: dom.status,
    });
    setShowDomainModal(true);
  };

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainFormData.name || !domainFormData.slug) {
      showToast('error', 'Domain name and slug are required.');
      return;
    }

    try {
      const payload: any = {
        name: domainFormData.name,
        slug: domainFormData.slug,
        description: domainFormData.description || undefined,
        maxRegistrations: domainFormData.maxRegistrations ? parseInt(domainFormData.maxRegistrations, 10) : undefined,
        spreadsheetId: domainFormData.spreadsheetId || undefined,
        worksheetName: domainFormData.worksheetName || undefined,
        status: domainFormData.status,
      };

      let res;
      if (editingDomain) {
        res = await fetch(`${API_BASE}/api/domains/${editingDomain.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      } else {
        res = await fetch(`${API_BASE}/api/domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      }

      const data = await res.json();
      if (data.success) {
        showToast('success', editingDomain ? 'Domain updated successfully!' : 'Domain created successfully!');
        setShowDomainModal(false);
        loadAllData();
      } else {
        showToast('error', data.error || 'Failed to save domain.');
      }
    } catch {
      showToast('error', 'Network error. Failed to save domain.');
    }
  };

  const handleToggleDomainStatus = async (dom: DomainItem) => {
    const nextStatus = dom.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`${API_BASE}/api/domains/${dom.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Domain ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
        loadAllData();
      } else {
        showToast('error', data.error || 'Failed to change domain status.');
      }
    } catch {
      showToast('error', 'Error updating domain status.');
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/domains/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Domain archived.');
        loadAllData();
      } else {
        showToast('error', data.error || 'Failed to archive domain.');
      }
    } catch {
      showToast('error', 'Error archiving domain.');
    }
  };

  const copyPublicLink = (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/register/${slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('success', 'Registration link copied to clipboard!');
    }
  };

  // ── Form Builder Actions ─────────────────────────────
  const addField = (type: string) => {
    const count = formFields.length + 1;
    const labels: Record<string, string> = {
      SHORT_TEXT: 'Short Answer',
      LONG_TEXT: 'Paragraph Description',
      EMAIL: 'Email Address',
      PHONE: 'Phone Number',
      NUMBER: 'Number',
      DROPDOWN: 'Dropdown Selection',
      RADIO: 'Single Choice (Radio)',
      CHECKBOX: 'Checkbox',
    };

    const newField: FormFieldItem = {
      id: `field-${Date.now()}`,
      type,
      label: labels[type] || `Question ${count}`,
      name: `field_${Date.now().toString().slice(-6)}`,
      description: '',
      placeholder: '',
      required: false,
      order: formFields.length,
      options: ['DROPDOWN', 'RADIO', 'CHECKBOX'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
    };

    setFormFields([...formFields, newField]);
  };

  const updateFieldProp = (idx: number, prop: keyof FormFieldItem, val: any) => {
    const updated = [...formFields];
    updated[idx] = { ...updated[idx], [prop]: val };
    setFormFields(updated);
  };

  const removeField = (idx: number) => {
    const updated = formFields.filter((_, i) => i !== idx);
    setFormFields(updated);
  };

  const handleSaveForm = async (publish = false) => {
    if (!formTitle.trim()) {
      showToast('error', 'Form title is required.');
      return;
    }
    if (formFields.length === 0) {
      showToast('error', 'Add at least one field to the form.');
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        applyToAllDomains: applyToAll,
        fields: formFields.map((f, i) => ({
          type: f.type,
          label: f.label.trim(),
          name: f.name.trim() || `field_${i}`,
          description: f.description || undefined,
          placeholder: f.placeholder || undefined,
          required: Boolean(f.required),
          order: i,
          options: f.options,
        })),
      };

      let formId = selectedForm?.id;
      let res;

      if (formId) {
        res = await fetch(`${API_BASE}/api/forms/${formId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      } else {
        res = await fetch(`${API_BASE}/api/forms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      }

      const data = await res.json();
      if (!data.success) {
        showToast('error', data.error || 'Failed to save form.');
        return;
      }

      const savedForm = data.data;
      setSelectedForm(savedForm);

      if (publish) {
        const pubRes = await fetch(`${API_BASE}/api/forms/${savedForm.id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applyToAllDomains: applyToAll }),
          credentials: 'include',
        });
        const pubData = await pubRes.json();
        if (pubData.success) {
          showToast('success', applyToAll ? 'Form published and applied to ALL domains!' : 'Form published successfully!');
        }
      } else {
        showToast('success', 'Form draft saved successfully.');
      }

      loadAllData();
    } catch {
      showToast('error', 'Network error while saving form.');
    }
  };

  // ── Excel Export Action ──────────────────────────────
  const handleDownloadExcel = async (domainId?: string) => {
    setExportLoading(true);
    try {
      const params = domainId ? `?domainId=${domainId}` : '';
      const res = await fetch(`${API_BASE}/api/exports/registrations${params}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        showToast('error', errorData.error || 'No registrations found to export.');
        setExportLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = domainId ? `registrations_${domainId}.xlsx` : `all_registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('success', 'Excel file downloaded successfully!');
    } catch {
      showToast('error', 'Failed to generate Excel file.');
    } finally {
      setExportLoading(false);
    }
  };

  // ── Connect Google Sheets OAuth ──────────────────────
  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/sheets/connect`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        showToast('error', 'Unable to initiate Google authorization.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // ── Render Auth Check Loading ────────────────────────
  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p>Verifying administrator session...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render Password Prompt if Not Authenticated ──────
  if (!admin) {
    return (
      <div style={{ minHeight: '100vh', background: '#02050A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{
          maxWidth: 440, width: '100%', background: 'rgba(6, 17, 33, 0.95)',
          border: '1px solid rgba(232, 78, 27, 0.4)', borderRadius: 24, padding: 38,
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(232, 78, 27, 0.15)', textAlign: 'center',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ marginBottom: 16 }}>
            <img
              src="/logo.png"
              alt="NextGen Build-a-thon Logo"
              style={{ height: 68, width: 'auto', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 6, letterSpacing: '0.04em' }}>
            Administrator Access
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13.5, marginBottom: 26, lineHeight: 1.5 }}>
            Enter the administrator password to unlock the NextGen management console.
          </p>

          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                Administrator Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                required
                style={{
                  width: '100%', padding: '13px 16px', background: 'rgba(2, 5, 10, 0.85)',
                  border: '1px solid rgba(22, 59, 110, 0.6)', borderRadius: 12,
                  color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {loginError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 18,
              }}>
                ⚠️ {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-fire"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: 12 }}
            >
              {loginLoading ? 'Verifying...' : 'Unlock Admin Panel →'}
            </button>
          </form>

          <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            <a href="/" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}>
              ← Return to Public Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Administrator Panel ────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050a18', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: notification.type === 'success' ? '#065f46' : '#991b1b',
          color: '#fff', padding: '12px 24px', borderRadius: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontSize: 14, fontWeight: 700,
        }}>
          {notification.message}
        </div>
      )}

      {/* Admin Top Navigation */}
      <header style={{
        background: '#0b1329', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/logo.png"
              alt="NextGen Logo"
              style={{ height: 34, width: 'auto', borderRadius: 6, objectFit: 'contain' }}
            />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>
              NEXTGEN ADMIN
            </span>
          </a>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: 6, marginLeft: 24 }}>
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'domains', label: '🌐 Domains' },
              { id: 'forms', label: '📋 Forms' },
              { id: 'export', label: '📥 Export Excel' },
              { id: 'settings', label: '⚙️ Settings' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  border: activeTab === tab.id ? '1px solid rgba(6,182,212,0.3)' : '1px solid transparent',
                  borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#94a3b8', fontSize: 13, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ↗ Public Website
          </a>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', borderRadius: 8, padding: '6px 14px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* ── TAB 1: DASHBOARD ────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Overview Dashboard</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>High-level registration and operational metrics.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 36 }}>
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Registrations</span>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#38bdf8', marginTop: 8 }}>
                  {stats?.totalRegistrations ?? '...'}
                </div>
              </div>

              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Tracks / Domains</span>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#34d399', marginTop: 8 }}>
                  {stats?.activeDomains ?? '...'}
                </div>
              </div>

              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Published Forms</span>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#a78bfa', marginTop: 8 }}>
                  {stats?.totalForms ?? '...'}
                </div>
              </div>

              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Google Sheets Sync</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12, color: stats?.sheetsConnected ? '#34d399' : '#f59e0b' }}>
                  {stats?.sheetsConnected ? '🟢 Connected' : '🟡 Not configured'}
                </div>
                {stats?.connectedGoogleEmail && (
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{stats.connectedGoogleEmail}</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Quick Operations</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setActiveTab('domains')} className="btn btn-outline">
                  🌐 Manage Tracks
                </button>
                <button type="button" onClick={() => setActiveTab('forms')} className="btn btn-outline">
                  📋 Edit Form Questions
                </button>
                <button type="button" onClick={() => handleDownloadExcel()} className="btn btn-primary" disabled={exportLoading}>
                  📥 Export All to Excel (.xlsx)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: DOMAINS ──────────────────────────────── */}
        {activeTab === 'domains' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Tracks & Domains</h2>
                <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Create, activate, and manage your hackathon tracks.</p>
              </div>
              <button type="button" onClick={handleOpenCreateDomain} className="btn btn-primary">
                + Create Track
              </button>
            </div>

            {domainsLoading ? (
              <p style={{ color: '#94a3b8' }}>Loading tracks...</p>
            ) : domains.length === 0 ? (
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 16 }}>No tracks created yet.</p>
                <button type="button" onClick={handleOpenCreateDomain} className="btn btn-primary">
                  Create First Track
                </button>
              </div>
            ) : (
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700 }}>Track Name</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700 }}>Registrations</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700 }}>Limit</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700 }}>Public Link</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(dom => (
                      <tr key={dom.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#fff' }}>
                          {dom.name}
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>slug: {dom.slug}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: dom.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: dom.status === 'ACTIVE' ? '#34d399' : '#f87171',
                          }}>
                            {dom.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                          {dom.registrationCount}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#94a3b8' }}>
                          {dom.maxRegistrations ? `${dom.maxRegistrations} max` : 'Unlimited'}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            type="button"
                            onClick={() => copyPublicLink(dom.slug)}
                            style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#38bdf8',
                              cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            📋 Copy Link
                          </button>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleDomainStatus(dom)}
                              style={{
                                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6,
                                padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer',
                              }}
                            >
                              {dom.status === 'ACTIVE' ? 'Close' : 'Open'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadExcel(dom.id)}
                              style={{
                                background: 'rgba(6,182,212,0.1)', border: 'none', borderRadius: 6,
                                padding: '4px 10px', fontSize: 12, color: '#38bdf8', cursor: 'pointer',
                              }}
                            >
                              Export
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditDomain(dom)}
                              style={{
                                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6,
                                padding: '4px 10px', fontSize: 12, color: '#cbd5e1', cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDomain(dom.id, dom.name)}
                              style={{
                                background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6,
                                padding: '4px 10px', fontSize: 12, color: '#f87171', cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: FORMS ────────────────────────────────── */}
        {activeTab === 'forms' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Registration Form Builder</h2>
                <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
                  Customize the fields participants fill out when registering.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowPreviewModal(true)} className="btn btn-outline">
                  👁️ Preview Form
                </button>
                <button type="button" onClick={() => handleSaveForm(false)} className="btn btn-outline">
                  💾 Save Draft
                </button>
                <button type="button" onClick={() => handleSaveForm(true)} className="btn btn-primary">
                  🚀 Publish Form
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
              {/* Form Editor Canvas */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Form Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Participant Registration Form"
                    style={{
                      width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                      color: '#fff', fontSize: 16, fontWeight: 700, boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Form Description / Instructions
                  </label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Brief instructions for participants..."
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                      color: '#fff', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Apply to All Domains Checkbox (CRITICAL REQUIREMENT) */}
                <div style={{
                  background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 10, padding: '14px 18px', marginBottom: 24,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <input
                    type="checkbox"
                    id="apply-to-all-domains-checkbox"
                    checked={applyToAll}
                    onChange={e => setApplyToAll(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="apply-to-all-domains-checkbox" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
                    Apply this form to all tracks/domains
                  </label>
                </div>

                {/* Questions List */}
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Form Questions ({formFields.length})</h3>

                {formFields.map((field, idx) => (
                  <div
                    key={field.id || idx}
                    style={{
                      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, padding: 18, marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                        #{idx + 1} — {field.type.replace('_', ' ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        style={{
                          background: 'none', border: 'none', color: '#f87171',
                          fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 10 }}>
                      <div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={e => updateFieldProp(idx, 'label', e.target.value)}
                          placeholder="Question Label..."
                          style={{
                            width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            color: '#fff', fontSize: 14, boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <select
                          value={field.type}
                          onChange={e => updateFieldProp(idx, 'type', e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            color: '#cbd5e1', fontSize: 14, boxSizing: 'border-box',
                          }}
                        >
                          <option value="SHORT_TEXT">Short answer</option>
                          <option value="LONG_TEXT">Paragraph</option>
                          <option value="EMAIL">Email</option>
                          <option value="PHONE">Phone</option>
                          <option value="NUMBER">Number</option>
                          <option value="DROPDOWN">Dropdown</option>
                          <option value="RADIO">Radio choice</option>
                          <option value="CHECKBOX">Checkbox</option>
                        </select>
                      </div>
                    </div>

                    {/* Options for Dropdown/Radio/Checkbox */}
                    {['DROPDOWN', 'RADIO', 'CHECKBOX'].includes(field.type) && (
                      <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                          Options (comma-separated):
                        </label>
                        <input
                          type="text"
                          value={(field.options || []).join(', ')}
                          onChange={e => updateFieldProp(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="Option 1, Option 2, Option 3"
                          style={{
                            width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            color: '#fff', fontSize: 13, boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <input
                        type="checkbox"
                        id={`req-${idx}`}
                        checked={field.required}
                        onChange={e => updateFieldProp(idx, 'required', e.target.checked)}
                      />
                      <label htmlFor={`req-${idx}`} style={{ fontSize: 13, color: '#cbd5e1', cursor: 'pointer' }}>
                        Required field
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Field Palette */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 14px' }}>+ Add Question</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { type: 'SHORT_TEXT', label: 'Short answer' },
                    { type: 'LONG_TEXT', label: 'Paragraph' },
                    { type: 'EMAIL', label: 'Email' },
                    { type: 'PHONE', label: 'Phone' },
                    { type: 'NUMBER', label: 'Number' },
                    { type: 'DROPDOWN', label: 'Dropdown' },
                    { type: 'RADIO', label: 'Radio buttons' },
                    { type: 'CHECKBOX', label: 'Checkbox' },
                  ].map(item => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => addField(item.type)}
                      style={{
                        padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                        color: '#cbd5e1', fontSize: 13, fontWeight: 600,
                        textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: EXPORT EXCEL ─────────────────────────── */}
        {activeTab === 'export' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Export Registration Data</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
                Generate and download real spreadsheet records (.xlsx) with all form responses.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {/* Export All */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Export All Registrations</h3>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                  Download all participant submissions across every hackathon track in a single consolidated Excel (.xlsx) file.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadExcel()}
                  disabled={exportLoading}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {exportLoading ? 'Generating...' : '📥 Download All (.xlsx)'}
                </button>
              </div>

              {/* Export by Domain */}
              <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Export by Track</h3>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                  Download submissions belonging exclusively to a selected track.
                </p>

                <div style={{ marginBottom: 20 }}>
                  <select
                    value={exportDomainId}
                    onChange={e => setExportDomainId(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                      color: '#fff', fontSize: 14, boxSizing: 'border-box',
                    }}
                  >
                    <option value="">— Select a Track —</option>
                    {domains.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.registrationCount} registrations)</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadExcel(exportDomainId)}
                  disabled={exportLoading || !exportDomainId}
                  className="btn btn-outline btn-lg"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {exportLoading ? 'Generating...' : '📥 Download Track (.xlsx)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: SETTINGS ─────────────────────────────── */}
        {activeTab === 'settings' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Settings & Integrations</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Configure Google Sheets spreadsheet storage.</p>
            </div>

            <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, maxWidth: 640 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>📊</span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>Google Sheets Storage</h3>
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                    Registrations are stored in PostgreSQL first and automatically appended to your linked Google Sheet.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: 18, margin: '20px 0',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Status:</span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    background: googleStatus.sheetsConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: googleStatus.sheetsConnected ? '#34d399' : '#f59e0b',
                  }}>
                    {googleStatus.sheetsConnected ? '🟢 Connected' : '🟡 Not configured'}
                  </span>
                </div>

                {googleStatus.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                    <span style={{ color: '#94a3b8' }}>Account Email:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{googleStatus.email}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {!googleStatus.sheetsConnected ? (
                  <button type="button" onClick={handleConnectGoogle} className="btn btn-primary">
                    Connect Google Account for Sheets →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`${API_BASE}/api/google/disconnect`, { method: 'POST', credentials: 'include' });
                      showToast('success', 'Google account disconnected.');
                      loadAllData();
                    }}
                    className="btn btn-outline"
                    style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}
                  >
                    Disconnect Google Account
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── CREATE / EDIT DOMAIN MODAL ────────────────────── */}
      {showDomainModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(5,10,24,0.85)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
          onClick={() => setShowDomainModal(false)}
        >
          <div
            style={{
              background: '#0b1329', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 16, padding: 32, maxWidth: 500, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 20px' }}>
              {editingDomain ? 'Edit Track' : 'Create New Track'}
            </h3>

            <form onSubmit={handleSaveDomain}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Track Name *
                </label>
                <input
                  type="text"
                  required
                  value={domainFormData.name}
                  onChange={e => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    setDomainFormData(prev => ({ ...prev, name, slug: editingDomain ? prev.slug : slug }));
                  }}
                  placeholder="e.g. AI & Machine Learning"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={domainFormData.slug}
                  onChange={e => setDomainFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().trim() }))}
                  placeholder="e.g. ai-machine-learning"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  value={domainFormData.description}
                  onChange={e => setDomainFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this track..."
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    color: '#fff', fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                    Max Registrations
                  </label>
                  <input
                    type="number"
                    value={domainFormData.maxRegistrations}
                    onChange={e => setDomainFormData(prev => ({ ...prev, maxRegistrations: e.target.value }))}
                    placeholder="e.g. 100 (optional)"
                    style={{
                      width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                      color: '#fff', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    value={domainFormData.status}
                    onChange={e => setDomainFormData(prev => ({ ...prev, status: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                      color: '#fff', fontSize: 14, boxSizing: 'border-box',
                    }}
                  >
                    <option value="ACTIVE">ACTIVE (Open)</option>
                    <option value="INACTIVE">INACTIVE (Closed)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Google Spreadsheet ID (Optional)
                </label>
                <input
                  type="text"
                  value={domainFormData.spreadsheetId}
                  onChange={e => setDomainFormData(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    color: '#fff', fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowDomainModal(false)} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  {editingDomain ? 'Save Changes' : 'Create Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FORM PREVIEW MODAL ────────────────────────────── */}
      {showPreviewModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(5,10,24,0.85)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            style={{
              background: '#0b1329', border: '1px solid rgba(6,182,212,0.4)',
              borderRadius: 20, padding: 36, maxWidth: 580, width: '100%',
              maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  Form Preview (Participant View)
                </span>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>
                  {formTitle || 'Registration Form'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {formDesc && (
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                {formDesc}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {formFields.map((field, idx) => (
                <div key={idx}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    {field.label} {field.required && <span style={{ color: '#f87171' }}>*</span>}
                  </label>
                  {field.type === 'LONG_TEXT' ? (
                    <textarea
                      disabled
                      placeholder={field.placeholder || ''}
                      rows={3}
                      style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#cbd5e1', boxSizing: 'border-box' }}
                    />
                  ) : field.type === 'DROPDOWN' ? (
                    <select disabled style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#cbd5e1', boxSizing: 'border-box' }}>
                      <option>{field.placeholder || 'Select...'}</option>
                      {(field.options || []).map((o, i) => <option key={i}>{o}</option>)}
                    </select>
                  ) : field.type === 'RADIO' ? (
                    <div style={{ display: 'flex', gap: 14 }}>
                      {(field.options || []).map((o, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1', fontSize: 13 }}>
                          <input type="radio" disabled /> {o}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      disabled
                      placeholder={field.placeholder || ''}
                      style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#cbd5e1', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, textAlign: 'right' }}>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="btn btn-primary">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
