'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DomainItem, fetchAllDomains, saveLocalDomains, getStoredLocalDomains } from '@/lib/domainsStore';
import { createOrUpdateDomainForm, deleteFormForDomain, MINIMAL_STARTER_FIELDS } from '@/lib/formsStore';

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    maxRegistrations: '',
    eventDate: '',
    registrationStart: '',
    registrationEnd: '',
  });

  const loadDomains = async () => {
    setLoading(true);
    const data = await fetchAllDomains();
    setDomains(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      setNotification({ type: 'error', message: 'Domain name and slug are required.' });
      return;
    }

    setCreating(true);
    setNotification(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      maxRegistrations: form.maxRegistrations ? parseInt(form.maxRegistrations) : null,
      eventDate: form.eventDate || null,
      registrationStart: form.registrationStart ? new Date(form.registrationStart).toISOString() : null,
      registrationEnd: form.registrationEnd ? new Date(form.registrationEnd).toISOString() : null,
    };

    let newDomainObj: DomainItem | null = null;

    try {
      const res = await api.post<{ success: boolean; data: DomainItem }>('/api/domains', payload);
      if (res.data) newDomainObj = res.data;
    } catch {
      // API offline — fallback to local storage domain creation
    }

    if (!newDomainObj) {
      newDomainObj = {
        id: `domain-${Date.now()}`,
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        status: 'ACTIVE',
        registrationCount: 0,
        shortlistedCount: 0,
        maxRegistrations: payload.maxRegistrations,
        eventDate: payload.eventDate,
        registrationStart: payload.registrationStart,
        registrationEnd: payload.registrationEnd,
      };
    }

    const current = getStoredLocalDomains();
    const updated = [newDomainObj, ...current.filter(d => d.id !== newDomainObj!.id)];
    saveLocalDomains(updated);
    setDomains(updated);

    // Initialize clean starter form for this domain
    createOrUpdateDomainForm({
      domainId: newDomainObj.id,
      domainName: newDomainObj.name,
      domainSlug: newDomainObj.slug,
      title: `${newDomainObj.name} Registration Form`,
      description: newDomainObj.description || 'Fill out the details below to register.',
      fields: MINIMAL_STARTER_FIELDS,
      status: 'PUBLISHED',
    });

    setNotification({ type: 'success', message: `✅ Domain "${payload.name}" created successfully!` });
    setCreating(false);
    setShowCreate(false);
    setForm({ name: '', slug: '', description: '', maxRegistrations: '', eventDate: '', registrationStart: '', registrationEnd: '' });
  };

  const handleDelete = async (domainId: string) => {
    try {
      await api.delete(`/api/domains/${domainId}`);
    } catch {
      // Offline mode
    }
    const current = getStoredLocalDomains();
    const target = current.find(d => d.id === domainId);
    if (target) deleteFormForDomain(domainId, target.slug);
    const updated = current.filter(d => d.id !== domainId);
    saveLocalDomains(updated);
    setDomains(updated);
    setShowDelete(null);
    setNotification({ type: 'success', message: 'Domain and its registration form deleted successfully.' });
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleToggleStatus = (domainId: string) => {
    const current = getStoredLocalDomains();
    const updated = current.map(d => {
      if (d.id === domainId) {
        return { ...d, status: d.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' };
      }
      return d;
    });
    saveLocalDomains(updated);
    setDomains(updated);
    setNotification({ type: 'success', message: 'Domain status updated.' });
  };

  const filteredDomains = domains.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.slug.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span className="loading-text">Loading domains...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>Event Domains</h1>
          <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
            Create, configure, and manage buildathon domains reflected across all dashboard tools
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowCreate(true);
            setNotification(null);
          }}
          style={{
            padding: '12px 20px', fontSize: 14, fontWeight: 700, borderRadius: 12,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
          }}
        >
          + Create Domain
        </button>
      </div>

      {/* Notification */}
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

      {/* Search */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search domain by title, slug, or keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 44, height: 46, borderRadius: 12 }}
          />
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Total: {filteredDomains.length} domains
        </div>
      </div>

      {/* Empty State */}
      {filteredDomains.length === 0 ? (
        <div className="empty-state" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            No domains found
          </div>
          <div className="empty-state-text" style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            Create your first buildathon domain to start hosting events.
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 12 }}>
            + Create New Domain
          </button>
        </div>
      ) : (
        /* Domain Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
          {filteredDomains.map(domain => (
            <div key={domain.id} className="card" style={{
              background: 'linear-gradient(160deg, rgba(17,28,51,0.9) 0%, rgba(12,20,38,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>
                      {domain.name}
                    </h3>
                    <div style={{ fontSize: 12, color: '#06b6d4', fontFamily: 'monospace', fontWeight: 600 }}>
                      /register/{domain.slug}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleStatus(domain.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                        background: domain.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                        color: domain.status === 'ACTIVE' ? '#34d399' : '#94a3b8',
                      }}
                    >
                      {domain.status}
                    </button>
                    <button
                      onClick={() => setShowDelete(domain.id)}
                      title="Delete Domain"
                      style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 12 }}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {domain.description && (
                  <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {domain.description}
                  </p>
                )}

                {/* Stats */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{domain.registrationCount || 0}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Registrations</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{domain.shortlistedCount || 0}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Shortlisted</div>
                  </div>
                </div>

                {domain.eventDate && (
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 16 }}>
                    📅 Event Date: <strong>{new Date(domain.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <a href={`/register/${domain.slug}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontWeight: 700, borderRadius: 10, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
                  🚀 Register Form
                </a>
                <a href={`/dashboard/registrations?domainId=${domain.id}`} className="btn btn-secondary btn-sm" style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontWeight: 600, borderRadius: 10 }}>
                  📋 Teams
                </a>
                <a href={`/dashboard/forms?domainId=${domain.id}`} className="btn btn-secondary btn-sm" style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontWeight: 600, borderRadius: 10 }}>
                  📝 Form Editor
                </a>
                <a href={`/dashboard/emails?domainId=${domain.id}`} className="btn btn-secondary btn-sm" style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontWeight: 600, borderRadius: 10 }}>
                  ✉️ Emails
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE MODAL ─────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Create Hackathon Domain</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Domain / Event Title *</label>
                <input type="text" className="form-input" placeholder="e.g. Next Gen Web3 Buildathon 2026" value={form.name} required onChange={e => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>URL Slug *</label>
                <input type="text" className="form-input" placeholder="e.g. next-gen-web3-2026" value={form.slug} required onChange={e => setForm({ ...form, slug: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                <div style={{ fontSize: 11, color: '#06b6d4', marginTop: 4, fontFamily: 'monospace' }}>Public Registration URL: /register/{form.slug || 'your-slug'}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" placeholder="Brief summary of track, rules, themes..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Event Date</label>
                  <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Max Capacity</label>
                  <input type="number" className="form-input" placeholder="500" value={form.maxRegistrations} onChange={e => setForm({ ...form, maxRegistrations: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={!form.name.trim() || !form.slug.trim() || creating} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: form.name.trim() && form.slug.trim() ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : 'rgba(255,255,255,0.1)', color: form.name.trim() && form.slug.trim() ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}>
                  {creating ? 'Creating...' : 'Create Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────────────── */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowDelete(null)}>
          <div style={{ background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)', border: '1px solid rgba(254,202,202,0.2)', borderRadius: 24, padding: 32, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginBottom: 12 }}>Delete Domain?</h2>
            <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 24 }}>
              Are you sure you want to delete this domain? This will remove its configurations and disconnect it from templates.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDelete(null)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(showDelete)} style={{ padding: '10px 20px', borderRadius: 10, background: '#f43f5e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Delete Domain</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
