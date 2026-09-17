'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchAllDomains, DomainItem } from '@/lib/domainsStore';
import { getStoredRegistrations, saveStoredRegistrations, StoredRegistration } from '@/lib/registrationsStore';
import * as XLSX from 'xlsx';

const statusColors: Record<string, { bg: string; color: string }> = {
  REGISTERED:   { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4' },
  SHORTLISTED:  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  REJECTED:     { bg: 'rgba(244,63,94,0.15)',    color: '#fb7185' },
  UNDER_REVIEW: { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24' },
};

export default function TeamsPage() {
  const [registrations, setRegistrations] = useState<StoredRegistration[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [domainId, setDomainId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [viewingReg, setViewingReg] = useState<StoredRegistration | null>(null);
  const pageSize = 25;

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load domains once
  useEffect(() => {
    fetchAllDomains().then(setDomains);
  }, []);

  // Load registrations from the same localStorage store
  const loadData = useCallback(() => {
    const stored = getStoredRegistrations();
    setRegistrations(stored);
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('registrations_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('registrations_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadData]);

  // Filter registrations
  const filtered = useMemo(() => {
    let list = registrations;

    if (domainId) {
      const dom = domains.find(d => d.id === domainId);
      list = list.filter(r =>
        r.domainId === domainId ||
        (dom && r.domainName === dom.name)
      );
    }

    if (statusFilter) {
      list = list.filter(r => r.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.teamName?.toLowerCase().includes(q) ||
        r.teamLeaderName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.registrationId?.toLowerCase().includes(q) ||
        r.domainName?.toLowerCase().includes(q) ||
        (r.values && Object.values(r.values).some(v => String(v).toLowerCase().includes(q)))
      );
    }

    return list;
  }, [registrations, domainId, statusFilter, search, domains]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(r => r.id)));
  };

  const handleBulkStatus = (newStatus: 'REGISTERED' | 'SHORTLISTED' | 'REJECTED' | 'UNDER_REVIEW') => {
    if (selected.size === 0) return;
    const stored = getStoredRegistrations();
    const updated = stored.map(r =>
      selected.has(r.id) ? { ...r, status: newStatus } : r
    );
    saveStoredRegistrations(updated);
    setSelected(new Set());
    loadData();
    showToast('success', `${selected.size} teams updated to ${newStatus}`);
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('error', 'No teams to export.');
      return;
    }

    const headers = ['Registration ID', 'Team Name', 'Leader', 'Email', 'Phone', 'Domain', 'Status', 'Date'];
    const rows = filtered.map(r => [
      r.registrationId,
      r.teamName || '',
      r.teamLeaderName || '',
      r.email || '',
      r.phone || '',
      r.domainName || '',
      r.status,
      new Date(r.createdAt).toLocaleDateString(),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(maxLen + 2, 50) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teams');
    XLSX.writeFile(wb, `teams_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('success', `Exported ${filtered.length} teams as Excel.`);
  };

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
          borderRadius: 12, padding: '12px 20px',
          color: toast.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: 14, fontWeight: 600, backdropFilter: 'blur(12px)',
        }}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle" style={{ color: '#94a3b8' }}>
            {total} total teams registered
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container" style={{
        background: 'rgba(17,28,51,0.9)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>🔍</span>
            <input
              className="form-input"
              placeholder="Search by team, leader, email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 36, height: 40, borderRadius: 10, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={domainId}
              onChange={e => { setDomainId(e.target.value); setPage(1); }}
              style={{ width: 180, height: 40, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#06b6d4', fontWeight: 700 }}
            >
              <option value="">All Domains</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              className="form-input"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ width: 150, height: 40, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff' }}
            >
              <option value="">All Status</option>
              <option value="REGISTERED">Registered</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
            {selected.size > 0 && (
              <>
                <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>{selected.size} selected</span>
                <button onClick={() => handleBulkStatus('SHORTLISTED')} style={{
                  padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)',
                }}>✅ Shortlist</button>
                <button onClick={() => handleBulkStatus('UNDER_REVIEW')} style={{
                  padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                }}>⏳ Review</button>
                <button onClick={() => handleBulkStatus('REJECTED')} style={{
                  padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(244,63,94,0.2)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)',
                }}>❌ Reject</button>
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="table-scroll-wrapper">
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.8)', color: '#94a3b8', textAlign: 'left',
              }}>
                <th style={{ padding: '12px 16px', width: 40 }}>
                  <input type="checkbox" checked={selected.size === paged.length && paged.length > 0} onChange={toggleAll} />
                </th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Reg ID</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Team</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Leader</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Email</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Phone</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Domain</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(reg => {
                const sc = statusColors[reg.status] || statusColors.REGISTERED;
                return (
                  <tr
                    key={reg.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selected.has(reg.id) ? 'rgba(6,182,212,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={selected.has(reg.id)} onChange={() => toggleSelect(reg.id)} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#06b6d4', fontWeight: 800, fontFamily: 'monospace' }}>
                      {reg.registrationId}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff' }}>
                      {reg.teamName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                      {reg.teamLeaderName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                      {reg.email || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                      {reg.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                      {reg.domainName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                        background: sc.bg, color: sc.color, whiteSpace: 'nowrap',
                      }}>
                        {reg.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(reg.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setViewingReg(reg)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12,
                          background: 'rgba(6,182,212,0.15)', color: '#06b6d4',
                          border: '1px solid rgba(6,182,212,0.3)', cursor: 'pointer',
                        }}
                      >
                        👁 View
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paged.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '64px 20px' }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                      No Teams Found
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
                      Teams will appear here once users register through the Registration Portal.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: '#94a3b8', fontSize: 13,
        }}>
          <span>Showing {total > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: page === 1 ? 'default' : 'pointer',
                background: 'rgba(255,255,255,0.05)', color: page === 1 ? '#334155' : '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              ← Prev
            </button>
            <span style={{ padding: '4px 12px' }}>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: page >= totalPages ? 'default' : 'pointer',
                background: 'rgba(255,255,255,0.05)', color: page >= totalPages ? '#334155' : '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── VIEW DETAILS MODAL ─────────────────────────── */}
      {viewingReg && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setViewingReg(null)}
        >
          <div
            style={{
              background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)',
              border: '1px solid rgba(6,182,212,0.3)', borderRadius: 24, padding: 32,
              maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: '#06b6d4', fontWeight: 800, fontFamily: 'monospace' }}>
                  {viewingReg.registrationId}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>
                  {viewingReg.teamName || 'Registration Details'}
                </h2>
              </div>
              <button onClick={() => setViewingReg(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{
              background: 'rgba(15,23,42,0.85)', borderRadius: 14, padding: 16,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13,
            }}>
              {[
                { label: 'Domain', value: viewingReg.domainName },
                { label: 'Status', value: viewingReg.status },
                { label: 'Leader', value: viewingReg.teamLeaderName || '—' },
                { label: 'Email', value: viewingReg.email || '—' },
                { label: 'Phone', value: viewingReg.phone || '—' },
                { label: 'Date', value: new Date(viewingReg.createdAt).toLocaleDateString() },
              ].map((item, i) => (
                <div key={i}>
                  <span style={{ color: '#64748b' }}>{item.label}:</span>
                  <div style={{ fontWeight: 700, color: item.label === 'Status' ? (statusColors[viewingReg.status]?.color || '#fff') : '#fff' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom field values */}
            {viewingReg.values && Object.keys(viewingReg.values).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  All Submitted Responses:
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(viewingReg.values).map(([key, val]) => {
                    const label = viewingReg.fieldLabels?.[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={key} style={{
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', fontSize: 13,
                      }}>
                        <span style={{ color: '#94a3b8', fontWeight: 600, maxWidth: '45%' }}>{label}:</span>
                        <span style={{ color: '#fff', fontWeight: 700, maxWidth: '52%', textAlign: 'right', wordBreak: 'break-word' }}>
                          {Array.isArray(val) ? val.join(', ') : String(val || '—')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingReg(null)}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
