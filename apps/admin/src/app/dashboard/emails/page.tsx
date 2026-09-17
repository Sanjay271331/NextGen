'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DomainItem, fetchAllDomains } from '@/lib/domainsStore';

interface Template {
  id: string;
  name: string;
  type: string;
  domainId?: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  senderEmail: string;
  senderName: string | null;
  replyTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tmpl-1',
    name: 'Registration Confirmation Email',
    type: 'REGISTRATION_CONFIRMATION',
    domainId: 'demo-domain-1',
    subject: '🎉 Registration Confirmed — {{event_name}}',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #06b6d4; margin-top: 0;">Welcome to {{event_name}}!</h2>
        <p>Dear <strong>{{participant_name}}</strong>,</p>
        <p>Thank you for registering for <strong>{{event_name}}</strong>. Your registration has been successfully received.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #06b6d4;">
          <p style="margin: 4px 0;"><strong>Registration ID:</strong> {{registration_id}}</p>
          <p style="margin: 4px 0;"><strong>Team Name:</strong> {{team_name}}</p>
          <p style="margin: 4px 0;"><strong>Date Registered:</strong> {{registration_date}}</p>
        </div>
        <p>We look forward to seeing your amazing project!</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Next Gen Buildathon Team
        </p>
      </div>
    `.trim(),
    textBody: 'Hi {{participant_name}}, your registration for {{event_name}} (ID: {{registration_id}}) is confirmed.',
    senderEmail: 'annapparhaihole@gmail.com',
    senderName: 'Next Gen Buildathon Team',
    replyTo: 'annapparhaihole@gmail.com',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-2',
    name: 'Shortlist Announcement Email',
    type: 'SHORTLIST_NOTIFICATION',
    domainId: 'demo-domain-1',
    subject: '🌟 Congratulations! Your team {{team_name}} has been shortlisted!',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #10b981; margin-top: 0;">Congratulations {{participant_name}}!</h2>
        <p>We are thrilled to inform you that team <strong>{{team_name}}</strong> has been shortlisted for the final phase of <strong>{{event_name}}</strong>.</p>
        <p>Please log in to your participant portal for next steps and presentation guidelines.</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Next Gen Buildathon Organizing Team
        </p>
      </div>
    `.trim(),
    textBody: 'Congratulations {{participant_name}}! Team {{team_name}} has been shortlisted for {{event_name}}.',
    senderEmail: 'annapparhaihole@gmail.com',
    senderName: 'Next Gen Buildathon Team',
    replyTo: 'annapparhaihole@gmail.com',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const templateTypes = [
  { value: 'REGISTRATION_CONFIRMATION', label: 'Registration Confirmation' },
  { value: 'SHORTLIST_NOTIFICATION', label: 'Shortlist Notification' },
  { value: 'REJECTION_NOTIFICATION', label: 'Rejection Notification' },
  { value: 'CUSTOM', label: 'Custom Broadcast' },
];

const availableVars = [
  'participant_name', 'team_name', 'registration_id', 'event_name',
  'email', 'registration_date', 'status', 'domain_name',
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    type: 'REGISTRATION_CONFIRMATION',
    domainId: '',
    subject: '',
    htmlBody: '',
    textBody: '',
    senderEmail: 'annapparhaihole@gmail.com',
    senderName: 'Sanjay A (Buildathon Admin)',
    replyTo: 'annapparhaihole@gmail.com',
  });

  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('annapparhaihole@gmail.com');
  const [testingId, setTestingId] = useState('');
  const [showDelete, setShowDelete] = useState<string | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Domains and Templates
  const loadData = async () => {
    setLoading(true);

    // Fetch synced domains
    const domainList = await fetchAllDomains();
    setDomains(domainList);

    // Fetch templates with fallback
    try {
      const res = await api.get<{ data: Template[] }>('/api/emails/templates');
      if (res.data && res.data.length > 0) {
        setTemplates(res.data);
      } else {
        loadLocalTemplates();
      }
    } catch {
      loadLocalTemplates();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalTemplates = () => {
    try {
      const saved = localStorage.getItem('ngb_demo_templates');
      if (saved) {
        setTemplates(JSON.parse(saved));
      } else {
        setTemplates(DEFAULT_TEMPLATES);
        localStorage.setItem('ngb_demo_templates', JSON.stringify(DEFAULT_TEMPLATES));
      }
    } catch {
      setTemplates(DEFAULT_TEMPLATES);
    }
  };

  const saveLocalTemplates = (newList: Template[]) => {
    setTemplates(newList);
    try {
      localStorage.setItem('ngb_demo_templates', JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      type: 'REGISTRATION_CONFIRMATION',
      domainId: domains[0]?.id || '',
      subject: '',
      htmlBody: '',
      textBody: '',
      senderEmail: 'annapparhaihole@gmail.com',
      senderName: 'Sanjay A (Buildathon Admin)',
      replyTo: 'annapparhaihole@gmail.com',
    });
    setEditingId(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  const handleEdit = (template: Template) => {
    setForm({
      name: template.name,
      type: template.type,
      domainId: template.domainId || domains[0]?.id || '',
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody || '',
      senderEmail: template.senderEmail || 'annapparhaihole@gmail.com',
      senderName: template.senderName || 'Sanjay A (Buildathon Admin)',
      replyTo: template.replyTo || 'annapparhaihole@gmail.com',
    });
    setEditingId(template.id);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.htmlBody.trim()) {
      showToast('error', 'Template Name, Subject, and HTML Body are required.');
      return;
    }

    setSaving(true);
    let updatedTemplate: Template | null = null;

    try {
      if (editingId) {
        const res = await api.put<{ data: Template }>(`/api/emails/templates/${editingId}`, form);
        if (res.data) updatedTemplate = res.data;
      } else {
        const res = await api.post<{ data: Template }>('/api/emails/templates', form);
        if (res.data) updatedTemplate = res.data;
      }
    } catch {
      // Offline / demo fallback
    }

    if (!updatedTemplate) {
      updatedTemplate = {
        id: editingId || `tmpl-${Date.now()}`,
        name: form.name.trim(),
        type: form.type,
        domainId: form.domainId,
        subject: form.subject.trim(),
        htmlBody: form.htmlBody.trim(),
        textBody: form.textBody ? form.textBody.trim() : null,
        senderEmail: form.senderEmail || 'annapparhaihole@gmail.com',
        senderName: form.senderName || 'Sanjay A',
        replyTo: form.replyTo || 'annapparhaihole@gmail.com',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const current = templates.filter(t => t.id !== updatedTemplate!.id);
    const newList = [updatedTemplate, ...current];
    saveLocalTemplates(newList);

    showToast('success', editingId ? '✅ Email Template Updated!' : '✅ Email Template Created!');
    setShowEditor(false);
    resetForm();
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    api.delete(`/api/emails/templates/${id}`).catch(() => {});
    const newList = templates.filter(t => t.id !== id);
    saveLocalTemplates(newList);
    showToast('success', 'Email template deleted.');
    setShowDelete(null);
  };

  const handleSendTest = (template: Template) => {
    if (!testEmail || !testEmail.includes('@')) {
      showToast('error', 'Enter a valid test Gmail address.');
      return;
    }
    showToast('success', `🚀 Gmail Dispatch Simulated to ${testEmail}! (Sender: ${template.senderEmail})`);
    setTestingId('');
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span className="loading-text">Loading email templates...</span>
      </div>
    );
  }

  // ── EDITOR VIEW ──────────────────────────────────────────────────────────
  if (showEditor) {
    const selectedDomain = domains.find(d => d.id === form.domainId) || domains[0];

    return (
      <div>
        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>
              {toast.type === 'success' ? '✅' : '❌'} {toast.message}
            </div>
          </div>
        )}

        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 26, fontWeight: 800 }}>
              {editingId ? 'Edit Email Template' : 'Create Email Template'}
            </h1>
            <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
              Design clean Gmail templates with automatic receiver targeting for registered participants
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => { setShowEditor(false); resetForm(); }} style={{ borderRadius: 10, padding: '10px 18px' }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{
                borderRadius: 10, padding: '10px 22px', fontWeight: 700,
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              }}
            >
              {saving ? 'Saving...' : editingId ? '💾 Save Template' : '💾 Create Template'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left Column: Config & Code */}
          <div>
            {/* Automatic Receiver Info Card */}
            <div style={{
              background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 16, padding: '16px 20px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚡ Automatic Recipient Handling</span>
              </div>
              <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                Recipient emails are <strong>automatically resolved</strong> to all users who have registered and submitted forms for the selected domain! No manual email typing required.
              </p>
            </div>

            {/* Template Settings Card */}
            <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Template Name *
                  </label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Registration Confirmation"
                    style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>
                <div>
                  <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Template Purpose / Category
                  </label>
                  <select
                    className="form-input"
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {templateTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Domain Link */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Target Hackathon Domain *
                </label>
                <select
                  className="form-input"
                  value={form.domainId}
                  onChange={e => setForm({ ...form, domainId: e.target.value })}
                  style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#06b6d4', fontWeight: 700, border: '1px solid rgba(6,182,212,0.3)' }}
                >
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>🌐 {d.name} (/register/{d.slug})</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  This template will be sent to all participants registered under <strong>{selectedDomain?.name || 'All Domains'}</strong>.
                </div>
              </div>

              {/* Sender Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Sender Email *
                  </label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.senderEmail}
                    onChange={e => setForm({ ...form, senderEmail: e.target.value })}
                    placeholder="annapparhaihole@gmail.com"
                    style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                    Sender Name
                  </label>
                  <input
                    className="form-input"
                    value={form.senderName}
                    onChange={e => setForm({ ...form, senderName: e.target.value })}
                    placeholder="Sanjay A (Buildathon Admin)"
                    style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: 0 }}>
                <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Email Subject Line *
                </label>
                <input
                  className="form-input"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="🎉 Registration Confirmed — {{event_name}}"
                  style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>
            </div>

            {/* HTML Code Editor */}
            <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <label className="form-label form-required" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                HTML Body Content *
              </label>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: 260, fontFamily: 'monospace', fontSize: 13, padding: 12, borderRadius: 10, background: '#090d16', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)' }}
                value={form.htmlBody}
                onChange={e => setForm({ ...form, htmlBody: e.target.value })}
                placeholder="<div style='font-family: Arial;'>Hello {{participant_name}}...</div>"
              />

              {/* Variables helper */}
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(15,23,42,0.8)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Click to Insert Dynamic Variable:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availableVars.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, htmlBody: form.htmlBody + `{{${v}}}` })}
                      style={{
                        background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                      }}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Gmail Format Preview Window */}
          <div>
            <div style={{ position: 'sticky', top: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Gmail Inbox Preview</h3>
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>● Live Render</span>
              </div>

              {/* Gmail Window Mockup */}
              <div style={{
                background: '#ffffff', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)', border: '1px solid #e2e8f0', color: '#1f2937',
              }}>
                {/* Gmail Top Bar */}
                <div style={{ background: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginLeft: 8 }}>Gmail — Message View</span>
                </div>

                {/* Email Metadata */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12, lineHeight: 1.3 }}
                    dangerouslySetInnerHTML={{ __html: form.subject.replace(/\{\{(\w+)\}\}/g, '<span style="color:#0284c7">[$1]</span>') || 'Untitled Subject' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#06b6d4', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      SA
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>
                        {form.senderName || 'Sanjay A'} <span style={{ fontWeight: 400, color: '#64748b' }}>&lt;{form.senderEmail}&gt;</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        to <strong>[All Registered & Submitted Participants for {selectedDomain?.name}]</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Body Rendering */}
                <div style={{ padding: 24, minHeight: 320, maxHeight: '55vh', overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{
                    __html: form.htmlBody.replace(/\{\{(\w+)\}\}/g, '<span style="color:#0284c7;background:#e0f2fe;padding:2px 6px;border-radius:4px;font-weight:600">[$1]</span>') || '<p style="color:#94a3b8;text-align:center;padding:40px 0;">Enter HTML content to preview your email...</p>'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── TEMPLATES LIST VIEW ──────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>Email Templates</h1>
          <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
            Create automated Gmail templates sent directly to registered buildathon participants
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <a
            href="/dashboard/emails/send"
            className="btn btn-secondary"
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 700, borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            📤 Send Bulk Emails
          </a>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 700, borderRadius: 12,
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
            }}
          >
            + Create Email Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state" style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Email Templates Created</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            Create custom templates to automate registration confirmations, shortlist notifications, and event broadcasts.
          </p>
          <button className="btn btn-primary" onClick={handleCreate} style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 12 }}>
            + Create First Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
          {templates.map(t => {
            const domainObj = domains.find(d => d.id === t.domainId);
            return (
              <div key={t.id} className="card" style={{
                background: 'linear-gradient(160deg, rgba(17,28,51,0.9) 0%, rgba(12,20,38,0.9) 100%)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, marginBottom: 4 }}>
                        {t.name}
                      </h3>
                      <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 700 }}>
                        {t.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: t.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                      color: t.isActive ? '#34d399' : '#94a3b8',
                    }}>
                      {t.isActive ? 'Active' : 'Draft'}
                    </span>
                  </div>

                  {/* Connected Domain Badge */}
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 12, background: 'rgba(15,23,42,0.8)', padding: '6px 10px', borderRadius: 8 }}>
                    🌐 Domain: <strong style={{ color: '#38bdf8' }}>{domainObj ? domainObj.name : 'All Domains'}</strong>
                  </div>

                  {/* Automatic Receivers Badge */}
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', padding: '6px 10px', borderRadius: 8 }}>
                    📩 Receivers: <strong>Auto-sent to all registered submitted teams</strong>
                  </div>

                  {/* Subject Line */}
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace', marginBottom: 16, padding: '10px 12px', background: '#0f172a', borderRadius: 10 }}>
                    {t.subject}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(t)} style={{ borderRadius: 8 }}>
                    ✏️ Edit Template
                  </button>

                  {testingId === t.id ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, flex: 1 }}
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => handleSendTest(t)} style={{ borderRadius: 8 }}>
                        Send Test
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setTestingId(t.id)} style={{ borderRadius: 8 }}>
                      🚀 Test Dispatch
                    </button>
                  )}

                  <button
                    onClick={() => setShowDelete(t.id)}
                    style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14 }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowDelete(null)}>
          <div style={{ background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)', border: '1px solid rgba(254,202,202,0.2)', borderRadius: 24, padding: 32, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginBottom: 12 }}>Delete Template?</h2>
            <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 24 }}>
              Are you sure you want to delete this email template? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDelete(null)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(showDelete)} style={{ padding: '10px 20px', borderRadius: 10, background: '#f43f5e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Delete Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
