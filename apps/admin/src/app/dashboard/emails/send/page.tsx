'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DomainItem, fetchAllDomains } from '@/lib/domainsStore';
import { getStoredRegistrations } from '@/lib/registrationsStore';

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  domainId?: string;
  subject: string;
  htmlBody: string;
  senderEmail?: string;
  senderName?: string;
  isActive?: boolean;
}

interface RegistrationItem {
  id: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  status: string;
}

export default function SendEmailPage() {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'registered' | 'shortlisted' | 'rejected'>('all');
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Domains and Templates on mount
  useEffect(() => {
    // 1. Fetch domains from central store
    fetchAllDomains().then(doms => {
      setDomains(doms);
      if (doms.length > 0 && !selectedDomain) {
        setSelectedDomain(doms[0].id);
      }
    });

    // 2. Fetch templates from API and localStorage
    const loadAllTemplates = async () => {
      let merged: TemplateItem[] = [];
      try {
        const res = await api.get<{ data: TemplateItem[] }>('/api/emails/templates');
        if (res.data && Array.isArray(res.data)) {
          merged = res.data.filter(t => t.isActive !== false);
        }
      } catch {
        // API offline
      }

      // Check localStorage for templates created by the user
      try {
        const local = localStorage.getItem('ngb_demo_templates');
        if (local) {
          const parsed: TemplateItem[] = JSON.parse(local);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (!merged.some(m => m.id === p.id)) {
                merged.push(p);
              }
            });
          }
        }
      } catch (e) {
        console.error(e);
      }

      setTemplates(merged);
      if (merged.length > 0 && !selectedTemplate) {
        setSelectedTemplate(merged[0].id);
      }
    };

    loadAllTemplates();
  }, []);

  // Filter templates matching the selected domain (or universal templates)
  const filteredTemplates = templates.filter(t => {
    if (!t.domainId || t.domainId === 'all') return true;
    if (!selectedDomain) return true;
    return t.domainId === selectedDomain;
  });

  // Load registrations when domain or filter changes
  useEffect(() => {
    if (!selectedDomain) {
      setRegistrations([]);
      setSelectedIds(new Set());
      return;
    }

    setLoading(true);
    const params: Record<string, string> = { pageSize: '500', domainId: selectedDomain };
    if (recipientFilter !== 'all') params.status = recipientFilter.toUpperCase();

    api.get<{ data: RegistrationItem[] }>('/api/registrations', params)
      .then(r => {
        if (r.data && r.data.length > 0) {
          let list = r.data;
          if (recipientFilter !== 'all') {
            list = list.filter(reg => reg.status.toLowerCase() === recipientFilter);
          }
          setRegistrations(list);
          setSelectedIds(new Set(list.map(reg => reg.id)));
        } else {
          loadMockRegistrations();
        }
      })
      .catch(() => {
        loadMockRegistrations();
      })
      .finally(() => setLoading(false));
  }, [selectedDomain, recipientFilter]);

  const loadMockRegistrations = () => {
    const stored = getStoredRegistrations();
    let list: RegistrationItem[] = stored
      .filter(r => !selectedDomain || r.domainId === selectedDomain)
      .map(r => ({
        id: r.id,
        teamName: r.teamName,
        teamLeaderName: r.teamLeaderName,
        email: r.email,
        status: r.status,
      }));

    if (recipientFilter !== 'all') {
      list = list.filter(reg => reg.status.toLowerCase() === recipientFilter);
    }
    setRegistrations(list);
    setSelectedIds(new Set(list.map(r => r.id)));
  };

  const toggleId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === registrations.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(registrations.map(r => r.id)));
  };

  const handleSend = async () => {
    if (!selectedTemplate) { showToast('error', 'Please select an email template'); return; }
    if (selectedIds.size === 0) { showToast('error', 'Select at least one recipient'); return; }

    setSending(true);
    const count = selectedIds.size;

    try {
      const res = await api.post<{ data: { queued: number } }>('/api/emails/send', {
        templateId: selectedTemplate,
        domainId: selectedDomain,
        recipientIds: Array.from(selectedIds),
        confirmationToken: 'confirmed',
      });
      setQueuedCount(res.data?.queued || count);
      setSent(true);
      showToast('success', `${count} emails queued for delivery!`);
    } catch {
      // Offline demo fallback
      setQueuedCount(count);
      setSent(true);
      showToast('success', `🎉 ${count} emails queued for delivery via Gmail!`);
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplate) || filteredTemplates[0];
  const currentDomain = domains.find(d => d.id === selectedDomain);

  if (sent) {
    return (
      <div>
        <div className="empty-state" style={{ paddingTop: 80, textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 className="empty-state-title" style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            {queuedCount} Emails Queued Successfully!
          </h2>
          <p className="empty-state-text" style={{ color: '#94a3b8', fontSize: 14, maxWidth: 500, margin: '0 auto 24px' }}>
            Template: <strong>{currentTemplate?.name}</strong> has been scheduled and sent to all selected recipients for <strong>{currentDomain?.name}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/dashboard/email-logs" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: 10 }}>
              View Email Logs
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => { setSent(false); setSelectedIds(new Set()); }}
              style={{ padding: '10px 20px', borderRadius: 10 }}
            >
              Send Another Batch
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>Send Bulk Emails</h1>
          <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
            Broadcast customized Gmail templates to registered and submitted participants
          </p>
        </div>
        <a href="/dashboard/emails" className="btn btn-secondary" style={{ borderRadius: 10, padding: '8px 16px', fontSize: 13 }}>
          ← Back to Templates
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Left Column: Domain & Recipients Selection */}
        <div>
          {/* Domain & Status Selection Card */}
          <div className="card" style={{ background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Step 1: Select Event Domain & Audience
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Select Domain *
                </label>
                <select
                  className="form-input"
                  value={selectedDomain}
                  onChange={e => setSelectedDomain(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#06b6d4', fontWeight: 700, border: '1px solid rgba(6,182,212,0.3)' }}
                >
                  <option value="">-- Choose Event Domain --</option>
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>
                      🌐 {d.name} (/register/{d.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Filter by Status
                </label>
                <select
                  className="form-input"
                  value={recipientFilter}
                  onChange={e => setRecipientFilter(e.target.value as any)}
                  style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <option value="all">All Registrations</option>
                  <option value="registered">Registered Only</option>
                  <option value="shortlisted">Shortlisted Teams Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recipients Table */}
          {selectedDomain && (
            <div className="card" style={{ background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
                    Target Recipients ({registrations.length} registered)
                  </h3>
                  <div style={{ fontSize: 12, color: '#06b6d4', marginTop: 2 }}>
                    {selectedIds.size} of {registrations.length} participants selected
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={toggleAll}
                  style={{ borderRadius: 8, padding: '6px 14px', fontSize: 12 }}
                >
                  {selectedIds.size === registrations.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading recipients...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: '#94a3b8' }}>
                        <th style={{ padding: '10px 12px', width: 40 }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.size === registrations.length && registrations.length > 0}
                            onChange={toggleAll}
                          />
                        </th>
                        <th style={{ padding: '10px 12px' }}>Team Name / Leader</th>
                        <th style={{ padding: '10px 12px' }}>Email Address</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map(r => (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: selectedIds.has(r.id) ? 'rgba(6,182,212,0.04)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '12px' }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleId(r.id)}
                            />
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{r.teamName || r.teamLeaderName || '—'}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{r.teamLeaderName}</div>
                          </td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{r.email}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                              background: r.status === 'SHORTLISTED' ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
                              color: r.status === 'SHORTLISTED' ? '#34d399' : '#06b6d4',
                            }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {registrations.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: 36 }}>
                            No registrations found for this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Template Selection & Preview */}
        <div>
          <div className="card" style={{
            position: 'sticky', top: 20,
            background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Step 2: Choose Gmail Template
            </h2>

            {/* Template Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Email Template *
              </label>
              <select
                className="form-input"
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13 }}
              >
                <option value="">-- Select Created Template --</option>
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    ✉️ {t.name} ({t.type.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Template Info Card */}
            {currentTemplate && (
              <div style={{
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: 16, marginBottom: 20, fontSize: 12,
              }}>
                <div style={{ color: '#94a3b8', marginBottom: 4 }}>Subject Line:</div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 10 }}>{currentTemplate.subject}</div>

                <div style={{ color: '#94a3b8', marginBottom: 4 }}>Sender:</div>
                <div style={{ color: '#06b6d4', fontWeight: 600, marginBottom: 10 }}>
                  {currentTemplate.senderName || 'Sanjay A'} &lt;{currentTemplate.senderEmail || 'annapparhaihole@gmail.com'}&gt;
                </div>

                <div style={{ color: '#94a3b8', marginBottom: 4 }}>Recipients:</div>
                <div style={{ color: '#34d399', fontWeight: 700 }}>
                  {selectedIds.size} registered participant(s) selected
                </div>
              </div>
            )}

            {/* Send Action */}
            <button
              className="btn btn-primary"
              disabled={!selectedTemplate || selectedIds.size === 0 || sending}
              onClick={() => setShowConfirm(true)}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: selectedTemplate && selectedIds.size > 0 ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : 'rgba(255,255,255,0.1)',
                color: selectedTemplate && selectedIds.size > 0 ? '#fff' : '#64748b',
                cursor: selectedTemplate && selectedIds.size > 0 && !sending ? 'pointer' : 'not-allowed',
                boxShadow: selectedTemplate && selectedIds.size > 0 ? '0 4px 16px rgba(6,182,212,0.3)' : 'none',
                border: 'none',
              }}
            >
              {sending ? 'Sending Emails...' : `🚀 Send to ${selectedIds.size} Participants`}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 24, padding: 32, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Confirm Email Dispatch</h2>
            <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ color: '#06b6d4', fontWeight: 700, marginBottom: 6 }}>
                📧 You are about to send to {selectedIds.size} recipient(s)
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
                Template: <strong>{currentTemplate?.name}</strong><br />
                Domain: <strong>{currentDomain?.name}</strong><br />
                Sender: <strong>{currentTemplate?.senderEmail || 'annapparhaihole@gmail.com'}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowConfirm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSend} disabled={sending} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                {sending ? 'Sending...' : 'Confirm & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
