'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface FormField {
  id?: string; type: string; label: string; name: string;
  description?: string; placeholder?: string; required: boolean;
  order: number; options?: string[]; validation?: Record<string, unknown>;
}

interface FormVersion {
  id: string; version: number; publishedAt: string | null;
  fields: FormField[];
}

interface FormData {
  id: string; title: string; description: string | null; status: string;
  currentVersionId: string | null;
  versions: FormVersion[];
  domains: Array<{ id: string; name: string; slug: string }>;
  createdAt: string; updatedAt: string;
}

const fieldTypes = [
  { value: 'SHORT_TEXT', label: '📝 Short Text' },
  { value: 'LONG_TEXT', label: '📄 Long Text' },
  { value: 'EMAIL', label: '✉️ Email' },
  { value: 'PHONE', label: '📱 Phone' },
  { value: 'NUMBER', label: '🔢 Number' },
  { value: 'DATE', label: '📅 Date' },
  { value: 'TIME', label: '🕐 Time' },
  { value: 'DROPDOWN', label: '📋 Dropdown' },
  { value: 'RADIO', label: '🔘 Radio' },
  { value: 'CHECKBOX', label: '☑️ Checkbox' },
  { value: 'MULTIPLE_CHOICE', label: '✅ Multiple Choice' },
  { value: 'URL', label: '🔗 URL' },
  { value: 'SECTION', label: '📌 Section' },
  { value: 'INFO_TEXT', label: '💡 Info Text' },
];

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Editor state
  const [editing, setEditing] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [showClone, setShowClone] = useState(false);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadForm = useCallback(async () => {
    try {
      const res = await api.get<{ data: FormData }>(`/api/forms/${id}`);
      setFormData(res.data);
      const latest = res.data.versions[0];
      if (latest) {
        setFormTitle(res.data.title);
        setFormDesc(res.data.description || '');
        setFields(latest.fields.map(f => ({ ...f })));
        setSelectedVersion(latest.id);
      }
    } catch {
      setFormData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadForm(); }, [loadForm]);

  const switchVersion = (versionId: string) => {
    const version = formData?.versions.find(v => v.id === versionId);
    if (version) {
      setFields(version.fields.map(f => ({ ...f })));
      setSelectedVersion(versionId);
      setEditingField(null);
    }
  };

  const addField = (type: string) => {
    const name = `field_${fields.length + 1}`;
    const newField: FormField = {
      type, label: `New ${type.replace(/_/g, ' ').toLowerCase()} field`,
      name, required: false, order: fields.length,
    };
    if (['DROPDOWN', 'RADIO', 'MULTIPLE_CHOICE', 'CHECKBOX'].includes(type)) {
      newField.options = ['Option 1', 'Option 2'];
    }
    setFields([...fields, newField]);
    setEditingField(fields.length);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
    setEditingField(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setFields(next.map((f, i) => ({ ...f, order: i })));
  };

  const duplicateField = (index: number) => {
    const copy = { ...fields[index], name: `${fields[index].name}_copy`, order: fields.length, id: undefined };
    setFields([...fields, copy]);
  };

  const handleSave = async () => {
    if (!formTitle || fields.length === 0) {
      showToast('error', 'Title and at least one field required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/forms/${id}`, {
        title: formTitle,
        description: formDesc || undefined,
        fields: fields.map(f => ({
          type: f.type, label: f.label, name: f.name,
          description: f.description, placeholder: f.placeholder,
          required: f.required, order: f.order,
          options: f.options, validation: f.validation,
        })),
      });
      showToast('success', 'Form updated — new version created!');
      setEditing(false);
      loadForm();
    } catch (err: any) {
      showToast('error', err.message);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    try {
      await api.post(`/api/forms/${id}/publish`);
      showToast('success', 'Form published!');
      loadForm();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleUnpublish = async () => {
    try {
      await api.post(`/api/forms/${id}/unpublish`);
      showToast('success', 'Form unpublished');
      loadForm();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleClone = async () => {
    try {
      const res = await api.post<{ data: { id: string } }>(`/api/forms/${id}/clone`);
      showToast('success', 'Form cloned!');
      router.push(`/dashboard/forms/${res.data.id}`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/forms/${id}`);
      showToast('success', 'Form archived');
      setTimeout(() => router.push('/dashboard/forms'), 1500);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /><span className="loading-text">Loading form...</span></div>;
  }

  if (!formData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">Form not found</div>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/forms')}>← Back to Forms</button>
      </div>
    );
  }

  const latestVersion = formData.versions[0];

  if (editing) {
    return (
      <div>
        {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.message}</div></div>}

        <div className="page-header">
          <div>
            <h1 className="page-title">Edit Form</h1>
            <p className="page-subtitle">Changes will create a new version (v{(latestVersion?.version || 0) + 1})</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); loadForm(); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save as New Version'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <input className="form-input" style={{ fontSize: 24, fontWeight: 700, border: 'none', background: 'transparent', padding: 0, marginBottom: 8 }}
                placeholder="Form Title" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              <input className="form-input" style={{ border: 'none', background: 'transparent', padding: 0, color: '#94a3b8' }}
                placeholder="Form description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
            </div>

            {fields.map((field, i) => (
              <div key={i} className="card" style={{
                marginBottom: 12, cursor: 'pointer',
                borderColor: editingField === i ? 'rgba(6,182,212,0.5)' : undefined,
                boxShadow: editingField === i ? '0 0 0 2px rgba(6,182,212,0.15)' : undefined,
              }} onClick={() => setEditingField(i)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingField === i ? 16 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ cursor: 'grab', color: '#64748b' }}>⣿</span>
                    <span>{fieldTypes.find(t => t.value === field.type)?.label?.split(' ')[0]}</span>
                    <span style={{ fontWeight: 600 }}>{field.label}</span>
                    {field.required && <span style={{ color: '#f43f5e', fontSize: 12 }}>Required</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); moveField(i, 'up'); }} disabled={i === 0}>↑</button>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); moveField(i, 'down'); }} disabled={i === fields.length - 1}>↓</button>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); duplicateField(i); }}>📋</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#f43f5e' }} onClick={e => { e.stopPropagation(); removeField(i); }}>🗑</button>
                  </div>
                </div>

                {editingField === i && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Label</label>
                        <input className="form-input" value={field.label} onChange={e => updateField(i, { label: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Field Name</label>
                        <input className="form-input" value={field.name}
                          onChange={e => updateField(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input className="form-input" placeholder="Help text" value={field.description || ''} onChange={e => updateField(i, { description: e.target.value })} />
                    </div>
                    {['DROPDOWN', 'RADIO', 'MULTIPLE_CHOICE', 'CHECKBOX'].includes(field.type) && (
                      <div className="form-group">
                        <label className="form-label">Options (one per line)</label>
                        <textarea className="form-input form-textarea" value={(field.options || []).join('\n')}
                          onChange={e => updateField(i, { options: e.target.value.split('\n').filter(Boolean) })} />
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })} />
                      Required field
                    </label>
                  </div>
                )}
              </div>
            ))}

            {fields.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No fields yet</div>
                <div className="empty-state-text">Add fields from the panel on the right.</div>
              </div>
            )}
          </div>

          <div className="card" style={{ position: 'sticky', top: 92, height: 'fit-content' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add Field</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {fieldTypes.map(type => (
                <button key={type.value} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 13 }}
                  onClick={() => addField(type.value)}>{type.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View Mode
  return (
    <div>
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.message}</div></div>}

      <div className="page-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/forms')}>← Back</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">{formData.title}</h1>
            <span className={`badge ${formData.status === 'PUBLISHED' ? 'badge-published' : 'badge-draft'}`}>{formData.status}</span>
          </div>
          {formData.description && <p className="page-subtitle">{formData.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ Edit Fields</button>
          {formData.status === 'PUBLISHED' ? (
            <button className="btn btn-secondary btn-sm" onClick={handleUnpublish}>📤 Unpublish</button>
          ) : (
            <button className="btn btn-success btn-sm" onClick={handlePublish}>🚀 Publish</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleClone}>📋 Clone</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 Archive</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          {/* Version selector */}
          {formData.versions.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 className="card-title" style={{ marginBottom: 12 }}>Version History</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {formData.versions.map(v => (
                  <button key={v.id}
                    className={`btn btn-sm ${selectedVersion === v.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => switchVersion(v.id)}
                    style={{ minWidth: 80 }}>
                    v{v.version}
                    {v.publishedAt && <span style={{ marginLeft: 4, fontSize: 10 }}>📢</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fields Preview */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                Fields ({fields.length})
                {selectedVersion && formData.versions.find(v => v.id === selectedVersion) && (
                  <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    v{formData.versions.find(v => v.id === selectedVersion)?.version}
                    {formData.versions.find(v => v.id === selectedVersion)?.publishedAt && ' (Published)'}
                  </span>
                )}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map((field, i) => (
                <div key={i} style={{
                  padding: '12px 16px', background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 24 }}>{i + 1}.</span>
                    <span>{fieldTypes.find(t => t.value === field.type)?.label?.split(' ')[0]}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{field.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{field.name}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {field.required && <span className="badge badge-under-review" style={{ fontSize: 10 }}>REQ</span>}
                    <span className="badge badge-draft" style={{ fontSize: 10 }}>{field.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {/* Info */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 16 }}>Details</h2>
            <InfoRow label="Versions" value={`${formData.versions.length} version${formData.versions.length !== 1 ? 's' : ''}`} />
            <div style={{ marginTop: 8 }} />
            <InfoRow label="Fields" value={`${latestVersion?.fields.length || 0} fields`} />
            <div style={{ marginTop: 8 }} />
            <InfoRow label="Created" value={new Date(formData.createdAt).toLocaleString()} />
            <div style={{ marginTop: 8 }} />
            <InfoRow label="Updated" value={new Date(formData.updatedAt).toLocaleString()} />
          </div>

          {/* Linked Domains */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 16 }}>Linked Domains</h2>
            {formData.domains.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {formData.domains.map(d => (
                  <a key={d.id} href={`/dashboard/domains/${d.id}`} style={{
                    padding: '10px 14px', background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/{d.slug}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                No domains linked to this form
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
