'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { fetchAllDomains } from '@/lib/domainsStore';
import { getStoredRegistrations } from '@/lib/registrationsStore';

interface ShortlistReg {
  id: string; registrationId: string; teamName: string | null;
  email: string; status: string; updatedAt: string;
  domain: { name: string };
}

// Import flow steps
type ImportStep = 'idle' | 'upload' | 'mapping' | 'validating' | 'preview' | 'confirming' | 'done';

interface ImportState {
  step: ImportStep;
  importId: string;
  domainId: string;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  mapping: Record<string, string>;
  validationResult: { valid: number; invalid: number; duplicate: number; unmatched: number } | null;
}

const SYSTEM_FIELDS = [
  { key: 'email', label: 'Email', required: true },
  { key: 'team_name', label: 'Team Name', required: false },
  { key: 'registration_id', label: 'Registration ID', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'team_leader_name', label: 'Team Leader Name', required: false },
  { key: '_skip', label: '— Skip this column —', required: false },
];

const statusBadge: Record<string, string> = {
  SHORTLISTED: 'badge-shortlisted', UNDER_REVIEW: 'badge-under-review',
  REGISTERED: 'badge-registered', REJECTED: 'badge-rejected',
};

export default function ShortlistPage() {
  const [shortlisted, setShortlisted] = useState<ShortlistReg[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<any[]>([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Import state
  const [importState, setImportState] = useState<ImportState>({
    step: 'idle', importId: '', domainId: '', headers: [],
    sampleRows: [], totalRows: 0, mapping: {}, validationResult: null,
  });
  const [sendEmails, setSendEmails] = useState(true);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadShortlisted = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '25' };
      if (search) params.search = search;
      if (filterDomain) params.domainId = filterDomain;
      const res = await api.get<{ data: ShortlistReg[]; total: number }>('/api/shortlist', params);
      if (res.data && res.data.length > 0) {
        setShortlisted(res.data);
        setTotal(res.total);
      } else {
        loadFromStore();
      }
    } catch {
      loadFromStore();
    }
    setLoading(false);
  }, [page, search, filterDomain]);

  const loadFromStore = () => {
    const stored = getStoredRegistrations();
    let list = stored.filter(r => r.status === 'SHORTLISTED');
    if (filterDomain) list = list.filter(r => r.domainId === filterDomain);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.teamName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.registrationId.toLowerCase().includes(q));
    }
    setShortlisted(list.map(r => ({
      id: r.id,
      registrationId: r.registrationId,
      teamName: r.teamName,
      email: r.email,
      status: r.status,
      updatedAt: r.createdAt,
      domain: { name: r.domainName },
    })));
    setTotal(list.length);
  };

  useEffect(() => { loadShortlisted(); }, [loadShortlisted]);

  useEffect(() => {
    fetchAllDomains().then(setDomains);
  }, []);

  // ── Step 1: Upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!importState.domainId) {
      showToast('error', 'Please select a domain first');
      return;
    }

    setImportState(prev => ({ ...prev, step: 'upload' }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('domainId', importState.domainId);

      const res = await api.upload<{
        data: {
          importId: string; headers: string[];
          sampleRows: Record<string, unknown>[]; totalRows: number;
        };
      }>('/api/shortlist/upload', formData);

      setImportState(prev => ({
        ...prev,
        step: 'mapping',
        importId: res.data.importId,
        headers: res.data.headers,
        sampleRows: res.data.sampleRows,
        totalRows: res.data.totalRows,
        // Auto-map if header names match system fields
        mapping: autoMap(res.data.headers),
      }));
    } catch (err: any) {
      showToast('error', err.message || 'Upload failed');
      setImportState(prev => ({ ...prev, step: 'idle' }));
    }

    // Reset input
    e.target.value = '';
  };

  const autoMap = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const emailKeywords = ['email', 'e-mail', 'mail'];
    const teamKeywords = ['team', 'team_name', 'team name', 'teamname'];
    const phoneKeywords = ['phone', 'mobile', 'contact', 'phone_number'];
    const idKeywords = ['registration', 'reg_id', 'registration_id', 'id'];
    const leaderKeywords = ['leader', 'team_leader', 'leader_name', 'captain'];

    for (const header of headers) {
      const lower = header.toLowerCase().trim();
      if (emailKeywords.some(k => lower.includes(k))) mapping[header] = 'email';
      else if (teamKeywords.some(k => lower.includes(k))) mapping[header] = 'team_name';
      else if (phoneKeywords.some(k => lower.includes(k))) mapping[header] = 'phone';
      else if (leaderKeywords.some(k => lower.includes(k))) mapping[header] = 'team_leader_name';
      else if (idKeywords.some(k => lower.includes(k) && lower !== 'domain')) mapping[header] = 'registration_id';
      else mapping[header] = '_skip';
    }
    return mapping;
  };

  // ── Step 2: Map Columns ──
  const handleMapping = (header: string, value: string) => {
    setImportState(prev => ({
      ...prev,
      mapping: { ...prev.mapping, [header]: value },
    }));
  };

  const submitMapping = async () => {
    // Ensure at least email is mapped
    const mappedEmail = Object.values(importState.mapping).includes('email');
    if (!mappedEmail) {
      showToast('error', 'You must map at least the Email column');
      return;
    }

    setImportState(prev => ({ ...prev, step: 'validating' }));

    try {
      await api.post('/api/shortlist/map', {
        importId: importState.importId,
        mapping: importState.mapping,
      });

      const res = await api.post<{
        data: { valid: number; invalid: number; duplicate: number; unmatched: number };
      }>('/api/shortlist/validate', {
        importId: importState.importId,
      });

      setImportState(prev => ({
        ...prev,
        step: 'preview',
        validationResult: res.data,
      }));
    } catch (err: any) {
      showToast('error', err.message || 'Validation failed');
      setImportState(prev => ({ ...prev, step: 'mapping' }));
    }
  };

  // ── Step 3: Confirm ──
  const handleConfirm = async () => {
    setImportState(prev => ({ ...prev, step: 'confirming' }));

    try {
      await api.post('/api/shortlist/confirm', {
        importId: importState.importId,
        sendEmails,
      });

      setImportState({
        step: 'done', importId: '', domainId: '', headers: [],
        sampleRows: [], totalRows: 0, mapping: {}, validationResult: null,
      });
      showToast('success', 'Shortlist import completed successfully!');
      loadShortlisted();
    } catch (err: any) {
      showToast('error', err.message || 'Confirm failed');
      setImportState(prev => ({ ...prev, step: 'preview' }));
    }
  };

  const resetImport = () => {
    setImportState({
      step: 'idle', importId: '', domainId: '', headers: [],
      sampleRows: [], totalRows: 0, mapping: {}, validationResult: null,
    });
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : toast.type === 'info' ? 'ℹ️' : '❌'} {toast.message}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Shortlist</h1>
          <p className="page-subtitle">Manage shortlisted teams and import shortlists from Excel</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {importState.step === 'idle' ? (
            <button className="btn btn-primary" onClick={() => setImportState(prev => ({ ...prev, step: 'upload' }))}>
              📤 Import Shortlist
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={resetImport}>✕ Cancel Import</button>
          )}
        </div>
      </div>

      {/* ═══════ IMPORT FLOW ═══════ */}
      {importState.step !== 'idle' && importState.step !== 'done' && (
        <div className="card" style={{ marginBottom: 24 }}>
          {/* Step Indicator */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
            {['Upload', 'Map Columns', 'Validate', 'Confirm'].map((label, i) => {
              const steps: ImportStep[] = ['upload', 'mapping', 'preview', 'confirming'];
              const idx = steps.indexOf(importState.step);
              const isActive = i <= (idx >= 0 ? idx : 0);
              return (
                <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 4, borderRadius: 99, marginBottom: 8,
                    background: isActive ? 'var(--accent-cyan)' : 'var(--border-primary)',
                    transition: 'background 300ms',
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Step: Upload */}
          {importState.step === 'upload' && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 1: Select Domain & Upload File</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label form-required">Domain</label>
                  <select className="form-input form-select"
                    value={importState.domainId}
                    onChange={e => setImportState(prev => ({ ...prev, domainId: e.target.value }))}>
                    <option value="">Select a domain...</option>
                    {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label form-required">Excel File</label>
                  <label className="btn btn-secondary" style={{
                    cursor: importState.domainId ? 'pointer' : 'not-allowed',
                    opacity: importState.domainId ? 1 : 0.5,
                    width: '100%', justifyContent: 'center',
                  }}>
                    📁 Choose File (.xlsx, .csv)
                    <input type="file" accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      disabled={!importState.domainId}
                      style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
              <div className="form-hint">
                Upload an Excel file containing the shortlisted teams. The first row should contain column headers.
              </div>
            </div>
          )}

          {/* Step: Column Mapping */}
          {importState.step === 'mapping' && (
            <div>
              <h3 style={{ marginBottom: 4 }}>Step 2: Map Columns</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Found <strong style={{ color: 'var(--accent-cyan)' }}>{importState.totalRows}</strong> rows
                with <strong>{importState.headers.length}</strong> columns.
                Map your file columns to system fields.
              </p>

              {/* Mapping Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {importState.headers.map(header => (
                  <div key={header} style={{
                    display: 'grid', gridTemplateColumns: '1fr 12px 1fr', gap: 12,
                    alignItems: 'center', padding: '10px 14px',
                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-glass)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{header}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {importState.sampleRows[0]?.[header] != null ? String(importState.sampleRows[0][header]) : '(empty)'}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <select className="form-input form-select" style={{ padding: '6px 12px' }}
                      value={importState.mapping[header] || '_skip'}
                      onChange={e => handleMapping(header, e.target.value)}>
                      {SYSTEM_FIELDS.map(sf => (
                        <option key={sf.key} value={sf.key}>
                          {sf.label} {sf.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Sample Data */}
              {importState.sampleRows.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Preview (first {importState.sampleRows.length} rows)</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          {importState.headers.map(h => (
                            <th key={h} style={{ fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importState.sampleRows.map((row, i) => (
                          <tr key={i}>
                            {importState.headers.map(h => (
                              <td key={h} style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row[h] != null ? String(row[h]) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={resetImport}>Cancel</button>
                <button className="btn btn-primary" onClick={submitMapping}>Validate & Preview →</button>
              </div>
            </div>
          )}

          {/* Step: Validating */}
          {importState.step === 'validating' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
              <div style={{ color: 'var(--text-secondary)' }}>Validating {importState.totalRows} rows against registrations...</div>
            </div>
          )}

          {/* Step: Preview / Confirm */}
          {importState.step === 'preview' && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 3: Validation Results</h3>

              {/* Validation Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ padding: '16px', background: 'var(--accent-emerald-glow)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-emerald)' }}>{importState.validationResult?.valid || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-emerald)' }}>Valid</div>
                </div>
                <div style={{ padding: '16px', background: 'var(--accent-amber-glow)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-amber)' }}>{importState.validationResult?.duplicate || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-amber)' }}>Duplicate</div>
                </div>
                <div style={{ padding: '16px', background: 'var(--accent-rose-glow)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-rose)' }}>{importState.validationResult?.unmatched || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-rose)' }}>Unmatched</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(100,116,139,0.1)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{importState.totalRows}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Rows</div>
                </div>
              </div>

              {/* Options */}
              <div style={{
                padding: '16px 20px', background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                marginBottom: 20,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sendEmails} onChange={e => setSendEmails(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Send shortlist notification emails</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Matched registrations will receive the shortlist email template configured for this domain.
                    </div>
                  </div>
                </label>
              </div>

              <div style={{
                background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 20,
              }}>
                <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: 4 }}>ℹ️ What will happen</div>
                <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, listStyle: 'disc' }}>
                  <li>Matched registrations will be updated to <strong>SHORTLISTED</strong> status</li>
                  {sendEmails && <li>Shortlist notification emails will be queued for all matched registrations</li>}
                  <li>Unmatched rows will be skipped (no registrations affected)</li>
                  <li>This action is logged in the audit trail</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setImportState(prev => ({ ...prev, step: 'mapping' }))}>← Back to Mapping</button>
                <button className="btn btn-primary" onClick={handleConfirm}>✅ Confirm & Import</button>
              </div>
            </div>
          )}

          {/* Step: Confirming */}
          {importState.step === 'confirming' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
              <div style={{ color: 'var(--text-secondary)' }}>Committing shortlist import...</div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ SHORTLISTED TABLE ═══════ */}
      <div className="table-container">
        <div className="table-toolbar">
          <div className="table-search">
            <span>🔍</span>
            <input placeholder="Search by ID, team, email..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-input form-select" style={{ width: 180, padding: '6px 12px' }}
              value={filterDomain} onChange={e => { setFilterDomain(e.target.value); setPage(1); }}>
              <option value="">All Domains</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reg ID</th><th>Team</th><th>Email</th><th>Domain</th><th>Status</th><th>Updated</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shortlisted.map(s => (
                <tr key={s.id}>
                  <td><a href={`/dashboard/registrations/${s.id}`} className="reg-id">{s.registrationId}</a></td>
                  <td style={{ fontWeight: 600 }}>{s.teamName || '—'}</td>
                  <td style={{ fontSize: 13 }}>{s.email}</td>
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{s.domain?.name}</td>
                  <td><span className={`badge ${statusBadge[s.status] || ''}`}>{s.status.replace(/_/g, ' ')}</span></td>
                  <td style={{ color: '#64748b', fontSize: 13 }}>{new Date(s.updatedAt).toLocaleDateString()}</td>
                  <td className="table-actions">
                    <a href={`/dashboard/registrations/${s.id}`} className="btn btn-ghost btn-sm">View</a>
                  </td>
                </tr>
              ))}
              {shortlisted.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>No shortlisted teams yet</td></tr>
              )}
            </tbody>
          </table>
        )}

        <div className="table-pagination">
          <span>{total} total shortlisted</span>
          <div className="table-pagination-buttons">
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ padding: '4px 12px', fontSize: 13 }}>Page {page} of {totalPages || 1}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
