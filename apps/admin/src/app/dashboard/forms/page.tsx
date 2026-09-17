'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { fetchAllDomains, DomainItem, getStoredLocalDomains, saveLocalDomains } from '@/lib/domainsStore';
import {
  FormFieldItem,
  DomainFormItem,
  getFormForDomain,
  createOrUpdateDomainForm,
  deleteFormForDomain,
  MINIMAL_STARTER_FIELDS,
} from '@/lib/formsStore';

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  domainId?: string;
  subject: string;
}

const DEFAULT_TEMPLATES: TemplateItem[] = [
  { id: 'tmpl-1', name: 'Registration Confirmation Email', type: 'REGISTRATION_CONFIRMATION', subject: '🎉 Registration Confirmed — {{event_name}}' },
  { id: 'tmpl-2', name: 'Shortlist Announcement Email', type: 'SHORTLIST_NOTIFICATION', subject: '🌟 Congratulations! Your team {{team_name}} has been shortlisted!' },
];

const fieldTypes = [
  { value: 'SHORT_TEXT', label: '📝 Short Text', desc: 'Single line text (Name, Title, etc.)' },
  { value: 'LONG_TEXT', label: '📄 Long Text / Paragraph', desc: 'Multi-line text (Project summary, etc.)' },
  { value: 'EMAIL', label: '✉️ Email Address', desc: 'Validated email input' },
  { value: 'PHONE', label: '📱 Phone Number', desc: 'Mobile or phone number' },
  { value: 'NUMBER', label: '🔢 Number', desc: 'Numeric values only' },
  { value: 'DATE', label: '📅 Date Picker', desc: 'Calendar date selection' },
  { value: 'DROPDOWN', label: '📋 Dropdown Menu', desc: 'Select one from multiple options' },
  { value: 'RADIO', label: '🔘 Radio Buttons', desc: 'Single choice radio options' },
  { value: 'CHECKBOX', label: '☑️ Checkbox', desc: 'Multiple selectable options' },
  { value: 'URL', label: '🔗 Web Link / Portfolio', desc: 'URL to GitHub, Portfolio, Resume' },
  { value: 'SECTION', label: '📌 Section Divider', desc: 'Organize form with headers' },
  { value: 'INFO_TEXT', label: '💡 Note / Instruction', desc: 'Guidance text for registrants' },
];

export default function FormsPage() {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [currentForm, setCurrentForm] = useState<DomainFormItem | null>(null);

  const [templates, setTemplates] = useState<TemplateItem[]>(DEFAULT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [fields, setFields] = useState<FormFieldItem[]>([]);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Domains with Real-Time Event Sync
  const loadDomainsList = useCallback(() => {
    fetchAllDomains().then(doms => {
      setDomains(doms);
      if (doms.length > 0) {
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const dParam = urlParams.get('domainId');
          setSelectedDomainId(prev => {
            if (prev && doms.some(d => d.id === prev || d.slug.toLowerCase() === prev.toLowerCase())) return prev;
            if (dParam && doms.some(d => d.id === dParam || d.slug.toLowerCase() === dParam.toLowerCase())) return dParam;
            return doms[0].id;
          });
        } else {
          setSelectedDomainId(doms[0].id);
        }
      }
    });
  }, []);

  useEffect(() => {
    loadDomainsList();
    window.addEventListener('domains_updated', loadDomainsList);
    window.addEventListener('storage', loadDomainsList);
    return () => {
      window.removeEventListener('domains_updated', loadDomainsList);
      window.removeEventListener('storage', loadDomainsList);
    };
  }, [loadDomainsList]);

  // Load Templates
  useEffect(() => {
    api.get<{ data: TemplateItem[] }>('/api/emails/templates')
      .then(res => {
        if (res.data && res.data.length > 0) setTemplates(res.data);
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem('ngb_demo_templates');
          if (saved) setTemplates(JSON.parse(saved));
        } catch {}
      });
  }, []);

  // When selected domain changes, load its form and assigned template
  useEffect(() => {
    if (!selectedDomainId) return;

    const domainObj = domains.find(d => d.id === selectedDomainId || d.slug.toLowerCase() === selectedDomainId.toLowerCase());
    const existing = getFormForDomain(selectedDomainId, domainObj?.slug);

    if (existing) {
      setCurrentForm(existing);
      setFormTitle(existing.title);
      setFormDesc(existing.description);
      setFields(existing.fields || []);
    } else {
      // Clean starter template for this domain
      const title = domainObj ? `${domainObj.name} Registration Form` : 'Hackathon Registration Form';
      const desc = domainObj?.description || 'Fill out the form below to register.';
      setFormTitle(title);
      setFormDesc(desc);
      setFields(MINIMAL_STARTER_FIELDS);
      setCurrentForm(null);
    }
    setSelectedTemplateId(domainObj?.registrationEmailTemplateId || '');
    setEditingFieldIndex(null);
  }, [selectedDomainId, domains]);

  const selectedDomain = domains.find(d => d.id === selectedDomainId || d.slug.toLowerCase() === selectedDomainId.toLowerCase());

  // Assign Email Template to Domain
  const handleAssignTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!selectedDomain) return;

    try {
      await api.put(`/api/domains/${selectedDomain.id}`, {
        registrationEmailTemplateId: templateId || null,
      });
    } catch {
      // offline fallback
    }

    const currentLocal = getStoredLocalDomains();
    const updated = currentLocal.map(d => {
      if (d.id === selectedDomain.id) {
        return { ...d, registrationEmailTemplateId: templateId || null };
      }
      return d;
    });
    saveLocalDomains(updated);
    setDomains(prev => prev.map(d => d.id === selectedDomain.id ? { ...d, registrationEmailTemplateId: templateId || null } : d));

    if (templateId) {
      setNotification({
        type: 'success',
        message: '✅ Automated confirmation email template assigned! If form is also published, registration is now UNPAUSED.',
      });
    } else {
      setNotification({
        type: 'error',
        message: '⚠️ Email template unassigned. Registration is now PAUSED until an email template is selected.',
      });
    }
  };

  // Add field
  const addField = (type: string) => {
    const order = fields.length;
    const name = `field_${Date.now()}`;
    const newField: FormFieldItem = {
      id: `f-${Date.now()}`,
      type,
      label: type === 'SECTION' ? 'Section Header' : `Custom ${type.replace('_', ' ').toLowerCase()} field`,
      name,
      required: type !== 'SECTION' && type !== 'INFO_TEXT',
      order,
    };

    if (['DROPDOWN', 'RADIO', 'CHECKBOX'].includes(type)) {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    const updated = [...fields, newField];
    setFields(updated);
    setEditingFieldIndex(updated.length - 1);
  };

  // Update field
  const updateField = (index: number, updates: Partial<FormFieldItem>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  // Delete field
  const removeField = (index: number) => {
    const next = fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i }));
    setFields(next);
    setEditingFieldIndex(null);
  };

  // Clear all fields
  const handleClearAllFields = () => {
    if (confirm('Are you sure you want to clear all fields and start with a blank form?')) {
      setFields([]);
      setEditingFieldIndex(null);
    }
  };

  // Load starter fields
  const handleLoadStarterFields = () => {
    setFields(MINIMAL_STARTER_FIELDS);
    setEditingFieldIndex(null);
  };

  // Move field
  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setFields(next.map((f, i) => ({ ...f, order: i })));
    setEditingFieldIndex(newIndex);
  };

  // Duplicate field
  const duplicateField = (index: number) => {
    const source = fields[index];
    const copy: FormFieldItem = {
      ...source,
      id: `f-${Date.now()}`,
      name: `${source.name}_copy`,
      label: `${source.label} (Copy)`,
      order: fields.length,
    };
    setFields([...fields, copy]);
  };

  // Toggle Pause/Resume Registration for this Domain
  const handleToggleRegistrationPause = () => {
    if (!selectedDomain) return;
    const current = getStoredLocalDomains();
    const newStatus = selectedDomain.status === 'PAUSED' || selectedDomain.status === 'STOPPED' ? 'ACTIVE' : 'PAUSED';
    const updated = current.map(d => {
      if (d.id === selectedDomain.id || d.slug.toLowerCase() === selectedDomain.slug.toLowerCase()) {
        return { ...d, status: newStatus };
      }
      return d;
    });
    saveLocalDomains(updated);
    setDomains(updated);
    setNotification({
      type: 'success',
      message: newStatus === 'PAUSED'
        ? `⏸️ Registrations Paused for "${selectedDomain.name}". The registration portal at /register/${selectedDomain.slug} will now show a paused banner and block submissions.`
        : `▶️ Registrations Resumed for "${selectedDomain.name}". The registration portal at /register/${selectedDomain.slug} is now live and accepting submissions!`,
    });
  };

  // Delete/Reset this Form
  const handleDeleteForm = () => {
    if (!selectedDomain) return;
    if (confirm(`Are you sure you want to delete and reset the registration form for "${selectedDomain.name}"?`)) {
      deleteFormForDomain(selectedDomain.id, selectedDomain.slug);
      setFields(MINIMAL_STARTER_FIELDS);
      setCurrentForm(null);
      setFormTitle(`${selectedDomain.name} Registration Form`);
      setFormDesc(selectedDomain.description || 'Fill out the details below to register.');
      setNotification({
        type: 'success',
        message: `🗑️ Form for "${selectedDomain.name}" has been deleted. Public portal will reflect the change.`,
      });
    }
  };

  // Publish Form & Upload to Public Registration UI (or save draft)
  const handlePublishToPublicUI = (statusOverride?: 'PUBLISHED' | 'DRAFT') => {
    if (!selectedDomain) {
      setNotification({ type: 'error', message: 'Please select a domain first.' });
      return;
    }
    if (!formTitle.trim()) {
      setNotification({ type: 'error', message: 'Form Title is required.' });
      return;
    }
    if (fields.length === 0) {
      setNotification({ type: 'error', message: 'At least one field is required in the form.' });
      return;
    }

    const formStatus = statusOverride || 'PUBLISHED';
    const isTemplateAssigned = Boolean(selectedDomain.registrationEmailTemplateId || selectedTemplateId);

    setSaving(true);
    const published = createOrUpdateDomainForm({
      domainId: selectedDomain.id,
      domainName: selectedDomain.name,
      domainSlug: selectedDomain.slug,
      title: formTitle.trim(),
      description: formDesc.trim(),
      fields,
      status: formStatus,
    });

    setCurrentForm(published);
    setSaving(false);

    if (formStatus === 'PUBLISHED') {
      if (isTemplateAssigned) {
        setNotification({
          type: 'success',
          message: `🎉 Form Uploaded & Published! Both published form and assigned email template are active — Registration at /register/${selectedDomain.slug} is now UNPAUSED and live!`,
        });
      } else {
        setNotification({
          type: 'error',
          message: `⚠️ Form Uploaded & Published, BUT Registration is PAUSED! You must assign an automated confirmation email template below before the public website will open.`,
        });
      }
    } else {
      setNotification({
        type: 'success',
        message: `💾 Form Saved as DRAFT! The form is saved internally, but will show as unpublished on /register/${selectedDomain.slug}.`,
      });
    }
  };

  if (domains.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>No Domains Found</h2>
        <p style={{ maxWidth: 460, margin: '0 auto 24px', fontSize: 14 }}>
          Please create a hackathon domain first so you can organize its custom registration form.
        </p>
        <a href="/dashboard/domains" className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 10 }}>
          + Go to Domains & Create One
        </a>
      </div>
    );
  }

  const livePublicUrl = selectedDomain ? `/register/${selectedDomain.slug}` : '/register';
  const isDomainPaused = selectedDomain?.status === 'PAUSED' || selectedDomain?.status === 'STOPPED';

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>Registration Form Builder</h1>
          <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
            Design and organize the registration questions that participants will enter for each domain
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selectedDomain && (
            <button
              onClick={handleToggleRegistrationPause}
              style={{
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700,
                background: isDomainPaused ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                color: isDomainPaused ? '#34d399' : '#facc15',
                border: isDomainPaused ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(234,179,8,0.4)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {isDomainPaused ? '▶️ Resume Registration' : '⏸️ Pause Registration'}
            </button>
          )}

          {selectedDomain && (
            <button
              onClick={() => handlePublishToPublicUI('DRAFT')}
              disabled={saving}
              style={{
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
              }}
            >
              💾 Save Draft
            </button>
          )}

          {selectedDomain && (
            <a
              href={livePublicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              👁 Open Public UI ↗
            </a>
          )}

          <button
            className="btn btn-primary"
            onClick={() => handlePublishToPublicUI('PUBLISHED')}
            disabled={saving}
            style={{
              borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700,
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {saving ? 'Uploading...' : '🚀 Upload Form to Registration UI'}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          background: notification.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          color: notification.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>{notification.message}</div>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Domain Selection Bar */}
      <div className="card" style={{
        background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)',
        border: '1px solid rgba(6,182,212,0.3)', borderRadius: 20, padding: '20px 24px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <div style={{ fontSize: 28 }}>🌐</div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
              Select Domain to Organize Registration Form:
            </label>
            <select
              value={selectedDomainId}
              onChange={e => setSelectedDomainId(e.target.value)}
              style={{
                width: '100%', maxWidth: 440, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(15,23,42,0.9)', color: '#06b6d4', fontWeight: 800, fontSize: 16,
                border: '1px solid rgba(6,182,212,0.4)', outline: 'none',
              }}
            >
              {domains.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} (/register/{d.slug}) {d.status === 'PAUSED' ? '— [PAUSED]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: currentForm?.status === 'PUBLISHED' ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                color: currentForm?.status === 'PUBLISHED' ? '#34d399' : '#eab308',
              }}>
                ● Form: {currentForm?.status || 'UNPUBLISHED DRAFT'}
              </span>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: isDomainPaused ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
                color: isDomainPaused ? '#facc15' : '#34d399',
              }}>
                ● Track: {isDomainPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Public Route: <a href={livePublicUrl} target="_blank" rel="noreferrer" style={{ color: '#06b6d4', fontWeight: 700 }}>/register/{selectedDomain?.slug} ↗</a>
            </div>
          </div>

          <button
            onClick={handleDeleteForm}
            title="Delete this domain form"
            style={{
              background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
              color: '#fb7185', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🗑 Delete Form
          </button>
        </div>
      </div>

      {/* Registration Gating & Email Template Assignment Card */}
      {selectedDomain && (() => {
        const isFormPublished = currentForm?.status === 'PUBLISHED';
        const isTemplateAssigned = Boolean(selectedDomain?.registrationEmailTemplateId || selectedTemplateId);
        const isUnpausedAndLive = isFormPublished && isTemplateAssigned && !isDomainPaused;

        return (
          <div className="card" style={{
            background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)',
            border: isUnpausedAndLive ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(234,179,8,0.35)',
            borderRadius: 20, padding: '20px 24px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    Automated Registration Gating
                  </h3>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800,
                    background: isUnpausedAndLive ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                    color: isUnpausedAndLive ? '#34d399' : '#facc15',
                    border: isUnpausedAndLive ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(234,179,8,0.4)',
                  }}>
                    {isUnpausedAndLive ? '🟢 UNPAUSED (LIVE & ACCEPTING REGISTRATIONS)' : '⏸️ REGISTRATION PAUSED'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  Both a <strong>Published Form</strong> and an <strong>Assigned Email Template</strong> are strictly mandatory before public submissions can be accepted.
                </p>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: isFormPublished ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                  border: `1px solid ${isFormPublished ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                  fontSize: 12, fontWeight: 700,
                  color: isFormPublished ? '#34d399' : '#fb7185',
                }}>
                  {isFormPublished ? '✅ 1. Form Published' : '❌ 1. Form Draft (Unpublished)'}
                </div>

                <div style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: isTemplateAssigned ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                  border: `1px solid ${isTemplateAssigned ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                  fontSize: 12, fontWeight: 700,
                  color: isTemplateAssigned ? '#34d399' : '#fb7185',
                }}>
                  {isTemplateAssigned ? '✅ 2. Email Template Assigned' : '❌ 2. Template Missing'}
                </div>
              </div>
            </div>

            {/* Email Template Assignment Dropdown */}
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                  ✉️ Confirmation Email Template:
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => handleAssignTemplate(e.target.value)}
                  style={{
                    flex: 1, maxWidth: 440, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(15,23,42,0.9)', color: '#06b6d4', fontWeight: 700, fontSize: 13,
                    border: '1px solid rgba(6,182,212,0.4)', outline: 'none',
                  }}
                >
                  <option value="">-- Select Template to Unpause Registration --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a
                  href="/dashboard/emails"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, textDecoration: 'none' }}
                >
                  ⚙️ Manage Templates
                </a>
                <a
                  href="/dashboard/settings"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, textDecoration: 'none' }}
                >
                  📮 Sender Gmail Settings
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main Builder Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left Column: Form Fields Canvas */}
        <div>
          {/* Form Title & Description Card */}
          <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Registration Form Title *
              </label>
              <input
                className="form-input"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Software Hackathon Registration"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: 15, border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Form Description / Instructions for Registrants
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Instructions shown at the top of the registration portal..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: 13, border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
          </div>

          {/* Form Fields Canvas */}
          <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
                  Form Questions Canvas ({fields.length} questions)
                </h2>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  These exact questions will be rendered on the registration portal for <strong>{selectedDomain?.name}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleClearAllFields}
                  style={{
                    background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🧹 Clear All Fields
                </button>
                <button
                  type="button"
                  onClick={handleLoadStarterFields}
                  style={{
                    background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📋 Reset to Starter
                </button>
              </div>
            </div>

            {fields.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: 'rgba(15,23,42,0.6)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                  Canvas is empty
                </div>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                  Click any question type on the right panel to add it to this form.
                </p>
                <button
                  type="button"
                  onClick={() => addField('SHORT_TEXT')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, background: '#06b6d4', color: '#050a18',
                    fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  + Add First Question
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fields.map((field, idx) => {
                  const isEditing = editingFieldIndex === idx;
                  const isSection = field.type === 'SECTION';

                  return (
                    <div
                      key={field.id || idx}
                      style={{
                        background: isSection ? 'rgba(6,182,212,0.08)' : 'rgba(15,23,42,0.85)',
                        border: isEditing ? '2px solid #06b6d4' : isSection ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: '16px 20px', transition: 'all 150ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>#{idx + 1}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#06b6d4', fontFamily: 'monospace' }}>
                            {field.type}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                            {field.label}
                          </span>
                          {field.required && (
                            <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700 }} title="Required question">*</span>
                          )}
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => moveField(idx, 'up')}
                            disabled={idx === 0}
                            style={{ background: 'none', border: 'none', color: idx === 0 ? '#334155' : '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(idx, 'down')}
                            disabled={idx === fields.length - 1}
                            style={{ background: 'none', border: 'none', color: idx === fields.length - 1 ? '#334155' : '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFieldIndex(isEditing ? null : idx)}
                            style={{
                              background: isEditing ? '#06b6d4' : 'rgba(255,255,255,0.08)',
                              color: isEditing ? '#050a18' : '#fff', border: 'none',
                              borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {isEditing ? 'Done' : '⚙️ Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateField(idx)}
                            title="Duplicate"
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                          >
                            📋
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(idx)}
                            title="Delete Question"
                            style={{
                              background: 'rgba(244,63,94,0.15)', border: 'none', color: '#fb7185',
                              borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            }}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </div>

                      {/* Inline Field Config Editor */}
                      {isEditing && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>
                                Question Label (shown to registrants)
                              </label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={e => updateField(idx, { label: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#090d16', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13 }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>
                                Database Field Key
                              </label>
                              <input
                                type="text"
                                value={field.name}
                                onChange={e => updateField(idx, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#090d16', color: '#06b6d4', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13 }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>
                                Placeholder Text
                              </label>
                              <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={e => updateField(idx, { placeholder: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#090d16', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13 }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
                              <input
                                type="checkbox"
                                id={`req-${idx}`}
                                checked={field.required}
                                onChange={e => updateField(idx, { required: e.target.checked })}
                              />
                              <label htmlFor={`req-${idx}`} style={{ fontSize: 13, color: '#cbd5e1', cursor: 'pointer' }}>
                                Required Question
                              </label>
                            </div>
                          </div>

                          {/* Options for dropdown / radio / checkbox */}
                          {['DROPDOWN', 'RADIO', 'CHECKBOX'].includes(field.type) && (
                            <div style={{ marginTop: 8 }}>
                              <label style={{ display: 'block', fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>
                                Options (comma-separated):
                              </label>
                              <input
                                type="text"
                                value={(field.options || []).join(', ')}
                                onChange={e => {
                                  const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  updateField(idx, { options: opts });
                                }}
                                placeholder="Option 1, Option 2, Option 3"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#090d16', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13 }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Toolbox */}
        <div>
          <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ➕ Add Question Type
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              Click any question type to add it to the registration form for <strong>{selectedDomain?.name}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fieldTypes.map(ft => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => addField(ft.value)}
                  style={{
                    background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                    color: '#fff', transition: 'all 120ms ease', display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#06b6d4')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ft.label}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{ft.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
