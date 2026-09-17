'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: any[]; total: number }>('/api/emails/logs', { page: String(page), pageSize: '25' }).then(r => { setLogs(r.data); setTotal(r.total); }).catch(console.error).finally(() => setLoading(false));
  }, [page]);

  const statusBadge: Record<string, string> = { SENT: 'badge-synced', FAILED: 'badge-failed', QUEUED: 'badge-pending', SENDING: 'badge-pending' };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Email Logs</h1></div>
      <div className="table-container">
        <table><thead><tr><th>Recipient</th><th>Type</th><th>Template</th><th>Status</th><th>Retries</th><th>Sent At</th><th>Error</th></tr></thead>
          <tbody>{logs.map(l => (<tr key={l.id}><td style={{ fontSize: 13 }}>{l.recipient}</td><td style={{ fontSize: 12, color: '#94a3b8' }}>{l.type.replace(/_/g, ' ')}</td><td>{l.templateName || '—'}</td><td><span className={`badge ${statusBadge[l.status] || ''}`}>{l.status}</span></td><td>{l.retryCount}</td><td style={{ fontSize: 13, color: '#64748b' }}>{l.sentAt ? new Date(l.sentAt).toLocaleString() : '—'}</td><td style={{ fontSize: 12, color: '#f43f5e', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.error || '—'}</td></tr>))}
            {logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>No email logs</td></tr>}
          </tbody></table>
        <div className="table-pagination"><span>{total} total</span><div className="table-pagination-buttons"><button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button><button className="btn btn-ghost btn-sm" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next →</button></div></div>
      </div>
    </div>
  );
}
