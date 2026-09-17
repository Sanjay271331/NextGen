'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [search, setSearch] = useState('');

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), pageSize: '25' };
    if (search) params.search = search;
    api.get<{ data: any[]; total: number }>('/api/audit', params).then(r => { setLogs(r.data); setTotal(r.total); }).catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">Security and activity records</p></div>
      <div className="table-container">
        <div className="table-toolbar"><div className="table-search"><span>🔍</span><input placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
        <table><thead><tr><th>Admin</th><th>Action</th><th>Resource</th><th>Resource ID</th><th>Result</th><th>Timestamp</th></tr></thead>
          <tbody>{logs.map(l => (<tr key={l.id}><td style={{ fontSize: 13 }}>{l.adminEmail}</td><td><span className="badge badge-published" style={{ fontSize: 11 }}>{l.action}</span></td><td style={{ color: '#94a3b8' }}>{l.resource}</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{l.resourceId || '—'}</td><td><span className={`badge ${l.result === 'SUCCESS' ? 'badge-synced' : 'badge-failed'}`}>{l.result}</span></td><td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td></tr>))}
            {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>No audit logs</td></tr>}
          </tbody></table>
        <div className="table-pagination"><span>{total} entries</span><div className="table-pagination-buttons"><button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button><button className="btn btn-ghost btn-sm" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next →</button></div></div>
      </div>
    </div>
  );
}
