'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Domain {
  id: string; name: string; slug: string; description: string | null;
  status: string; eventDate: string | null;
  registrationStart: string | null; registrationEnd: string | null;
  maxRegistrations: number | null; registrationCount: number; shortlistedCount: number;
  spreadsheetId: string | null; worksheetName: string | null; driveFolderId: string | null;
  formId: string | null; registrationEmailTemplateId: string | null;
  shortlistEmailTemplateId: string | null;
  form: { id: string; title: string; status: string; versions: any[] } | null;
  createdAt: string; updatedAt: string; deletedAt: string | null;
}

interface DomainStats {
  registrationsByStatus: { status: string; count: number }[];
  recentRegistrations: Array<{ id: string; registrationId: string; teamName: string; email: string; status: string; createdAt: string }>;
}

const statusBadge: Record<string, string> = {
  REGISTERED: 'badge-registered', SHORTLISTED: 'badge-shortlisted',
  REJECTED: 'badge-rejected', UNDER_REVIEW: 'badge-under-review',
};

export default function DomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Edit form state
  const [form, setForm] = useState({
    name: '', slug: '', description: '', eventDate: '', registrationStart: '',
    registrationEnd: '', maxRegistrations: '', status: 'ACTIVE',
    spreadsheetId: '', worksheetName: '', driveFolderId: '',
    formId: '', registrationEmailTemplateId: '', shortlistEmailTemplateId: '',
  });

  // Available forms & templates
  const [forms, setForms] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showDelete, setShowDelete] = useState(false);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDomain = useCallback(async () => {
    try {
      const [domRes, statsRes] = await Promise.all([
        api.get<{ data: Domain }>(`/api/domains/${id}`),
        api.get<{ data: DomainStats }>(`/api/domains/${id}/stats`),
      ]);
      setDomain(domRes.data);
      setStats(statsRes.data);
      populateForm(domRes.data);
    } catch {
      setDomain(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const populateForm = (d: Domain) => {
    const toLocal = (iso: string | null) => {
      if (!iso) return '';
      const dt = new Date(iso);
      return dt.toISOString().slice(0, 16);
    };
    setForm({
      name: d.name, slug: d.slug, description: d.description || '',
      eventDate: d.eventDate ? new Date(d.eventDate).toISOString().split('T')[0] : '',
      registrationStart: toLocal(d.registrationStart),
      registrationEnd: toLocal(d.registrationEnd),
      maxRegistrations: d.maxRegistrations?.toString() || '',
      status: d.status,
      spreadsheetId: d.spreadsheetId || '', worksheetName: d.worksheetName || '',
      driveFolderId: d.driveFolderId || '', formId: d.formId || '',
      registrationEmailTemplateId: d.registrationEmailTemplateId || '',
      shortlistEmailTemplateId: d.shortlistEmailTemplateId || '',
    });
  };

  useEffect(() => {
    loadDomain();
    api.get<{ data: any[] }>('/api/forms').then(r => setForms(r.data)).catch(() => {});
    api.get<{ data: any[] }>('/api/emails/templates').then(r => setTemplates(r.data)).catch(() => {});
  }, [loadDomain]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/domains/${id}`, {
        ...form,
        maxRegistrations: form.maxRegistrations ? parseInt(form.maxRegistrations) : undefined,
        eventDate: form.eventDate || undefined,
        registrationStart: form.registrationStart ? new Date(form.registrationStart).toISOString() : undefined,
        registrationEnd: form.registrationEnd ? new Date(form.registrationEnd).toISOString() : undefined,
        formId: form.formId || undefined,
        registrationEmailTemplateId: form.registrationEmailTemplateId || undefined,
        shortlistEmailTemplateId: form.shortlistEmailTemplateId || undefined,
      });
      showToast('success', 'Domain updated successfully');
      setEditing(false);
      loadDomain();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update domain');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/domains/${id}`);
      showToast('success', 'Domain archived');
      setTimeout(() => router.push('/dashboard/domains'), 1500);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const copyPublicUrl = () => {
    const url = `${window.location.origin}/register/${domain?.slug}`;
    navigator.clipboard.writeText(url);
    showToast('info', 'Public URL copied to clipboard!');
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /><span className="loading-text">Loading domain...</span></div>;
  }

  if (!domain) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Domain not found</div>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/domains')}>← Back to Domains</button>
      </div>
    );
  }

  const registrationTemplates = templates.filter(t => t.type === 'REGISTRATION_CONFIRMATION');
  const shortlistTemplates = templates.filter(t => t.type === 'SHORTLIST_NOTIFICATION');

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : toast.type === 'info' ? 'ℹ️' : '❌'} {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/domains')}>← Back</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">{domain.name}</h1>
            <span className={`badge ${domain.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>{domain.status}</span>
          </div>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>/register/{domain.slug}</span>
            <button className="btn btn-ghost btn-sm" onClick={copyPublicUrl} style={{ padding: '2px 8px', fontSize: 12 }}>📋 Copy URL</button>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ Edit</button>
              <a href={`/dashboard/registrations?domainId=${id}`} className="btn btn-secondary btn-sm">📝 Registrations</a>
              <a href={`/dashboard/exports?domainId=${id}`} className="btn btn-secondary btn-sm">📥 Export</a>
              <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>🗑 Archive</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); populateForm(domain); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr' : '2fr 1fr', gap: 20 }}>
        {/* Main Content */}
        <div>
          {editing ? (
            /* Edit Form */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h2 className="card-title" style={{ marginBottom: 20 }}>General</h2>
                <div className="form-group">
                  <label className="form-label form-required">Domain Name</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Slug</label>
                  <input className="form-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
                  <div className="form-hint">URL: /register/{form.slug}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="card" style={{ marginBottom: 20 }}>
                  <h2 className="card-title" style={{ marginBottom: 20 }}>Schedule</h2>
                  <div className="form-group">
                    <label className="form-label">Event Date</label>
                    <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registration Start</label>
                    <input type="datetime-local" className="form-input" value={form.registrationStart} onChange={e => setForm({ ...form, registrationStart: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registration End</label>
                    <input type="datetime-local" className="form-input" value={form.registrationEnd} onChange={e => setForm({ ...form, registrationEnd: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max Registrations</label>
                    <input type="number" className="form-input" value={form.maxRegistrations} onChange={e => setForm({ ...form, maxRegistrations: e.target.value })} placeholder="Unlimited" />
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                  <h2 className="card-title" style={{ marginBottom: 20 }}>Google Integration</h2>
                  <div className="form-group">
                    <label className="form-label">Google Spreadsheet ID</label>
                    <input className="form-input" value={form.spreadsheetId} onChange={e => setForm({ ...form, spreadsheetId: e.target.value })} placeholder="1BxiMVs0XRA5nFMd..." style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Worksheet Name</label>
                    <input className="form-input" value={form.worksheetName} onChange={e => setForm({ ...form, worksheetName: e.target.value })} placeholder="Registrations" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Drive Folder ID</label>
                    <input className="form-input" value={form.driveFolderId} onChange={e => setForm({ ...form, driveFolderId: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title" style={{ marginBottom: 20 }}>Linking</h2>
                  <div className="form-group">
                    <label className="form-label">Registration Form</label>
                    <select className="form-input form-select" value={form.formId} onChange={e => setForm({ ...form, formId: e.target.value })}>
                      <option value="">— No form linked —</option>
                      {forms.map(f => <option key={f.id} value={f.id}>{f.title} ({f.status})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registration Email Template</label>
                    <select className="form-input form-select" value={form.registrationEmailTemplateId} onChange={e => setForm({ ...form, registrationEmailTemplateId: e.target.value })}>
                      <option value="">— No template —</option>
                      {registrationTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Shortlist Email Template</label>
                    <select className="form-input form-select" value={form.shortlistEmailTemplateId} onChange={e => setForm({ ...form, shortlistEmailTemplateId: e.target.value })}>
                      <option value="">— No template —</option>
                      {shortlistTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <MiniStat label="Total" value={domain.registrationCount} color="var(--accent-cyan)" />
                <MiniStat label="Shortlisted" value={domain.shortlistedCount} color="var(--accent-emerald)" />
                <MiniStat label="Max" value={domain.maxRegistrations ?? '∞'} color="var(--accent-amber)" />
                <MiniStat label="Form" value={domain.form ? '✅' : '❌'} color="var(--accent-purple)" />
              </div>

              {/* Domain Details */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 className="card-title" style={{ marginBottom: 16 }}>Details</h2>
                {domain.description && <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>{domain.description}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InfoRow label="Event Date" value={domain.eventDate ? new Date(domain.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'} />
                  <InfoRow label="Registration Start" value={domain.registrationStart ? new Date(domain.registrationStart).toLocaleString() : 'Not set'} />
                  <InfoRow label="Registration End" value={domain.registrationEnd ? new Date(domain.registrationEnd).toLocaleString() : 'Not set'} />
                  <InfoRow label="Form" value={domain.form ? `${domain.form.title} (${domain.form.status})` : 'None linked'} />
                  <InfoRow label="Spreadsheet ID" value={domain.spreadsheetId || 'Not configured'} mono />
                  <InfoRow label="Worksheet" value={domain.worksheetName || 'Registrations'} />
                </div>
              </div>

              {/* Registration Status Breakdown */}
              {stats && stats.registrationsByStatus.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <h2 className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</h2>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {stats.registrationsByStatus.map(s => (
                      <div key={s.status} style={{
                        padding: '10px 16px', background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span className={`badge ${statusBadge[s.status] || ''}`}>{s.status.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 700, fontSize: 18 }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Registrations */}
              {stats && stats.recentRegistrations.length > 0 && (
                <div className="table-container">
                  <div className="table-toolbar">
                    <h2 className="card-title">Recent Registrations</h2>
                    <a href={`/dashboard/registrations?domainId=${id}`} className="btn btn-ghost btn-sm">View All →</a>
                  </div>
                  <table>
                    <thead>
                      <tr><th>ID</th><th>Team</th><th>Email</th><th>Status</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {stats.recentRegistrations.map(r => (
                        <tr key={r.id}>
                          <td><a href={`/dashboard/registrations/${r.id}`} className="reg-id">{r.registrationId}</a></td>
                          <td style={{ fontWeight: 600 }}>{r.teamName || '—'}</td>
                          <td style={{ fontSize: 13 }}>{r.email}</td>
                          <td><span className={`badge ${statusBadge[r.status] || ''}`}>{r.status}</span></td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right sidebar — only in view mode */}
        {!editing && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 className="card-title" style={{ marginBottom: 16 }}>Quick Links</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={copyPublicUrl}>📋 Copy Public URL</button>
                {domain.formId && <a href={`/dashboard/forms/${domain.formId}`} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>📋 Edit Form</a>}
                <a href={`/dashboard/registrations?domainId=${id}`} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>📝 All Registrations</a>
                <a href={`/dashboard/shortlist?domainId=${id}`} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>🏆 Shortlist</a>
                <a href={`/dashboard/exports?domainId=${id}`} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>📥 Export Data</a>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title" style={{ marginBottom: 16 }}>Timestamps</h2>
              <InfoRow label="Created" value={new Date(domain.createdAt).toLocaleString()} />
              <div style={{ marginTop: 8 }} />
              <InfoRow label="Updated" value={new Date(domain.updatedAt).toLocaleString()} />
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Archive Domain?</h2>
              <button className="modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px',
              }}>
                <div style={{ color: '#f43f5e', fontWeight: 600, marginBottom: 8 }}>⚠️ This will archive the domain and disable registrations</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Registrations: <strong>{domain.registrationCount}</strong> · Shortlisted: <strong>{domain.shortlistedCount}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  The linked Google Sheet will not be deleted.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Archive Domain</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: mono ? 12 : 14, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : undefined, wordBreak: mono ? 'break-all' : undefined }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', background: 'var(--bg-card)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}
