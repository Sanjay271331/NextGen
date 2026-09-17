'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DashboardStats {
  totalRegistrations: number;
  registrationsToday: number;
  registrationsThisWeek: number;
  totalDomains: number;
  activeDomains: number;
  shortlistedTeams: number;
  rejectedTeams: number;
  pendingTeams: number;
  emailsSent: number;
  emailsFailed: number;
  activeForms: number;
  syncPending: number;
  syncFailed: number;
  emailQueuePending: number;
  registrationsByDomain: { domain: string; count: number }[];
  recentRegistrations: Array<{
    id: string; registrationId: string; teamName: string;
    email: string; status: string; createdAt: string;
    domain: { name: string };
  }>;
}

const statusBadgeClass: Record<string, string> = {
  REGISTERED: 'badge-registered',
  SHORTLISTED: 'badge-shortlisted',
  REJECTED: 'badge-rejected',
  UNDER_REVIEW: 'badge-under-review',
  WITHDRAWN: 'badge-inactive',
  DISQUALIFIED: 'badge-failed',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; data: DashboardStats }>('/api/dashboard')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span className="loading-text">Loading dashboard...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">Unable to load dashboard</div>
        <div className="empty-state-text">Please check your connection and try again.</div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's an overview of your platform.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card cyan">
          <div className="stat-card-icon">📝</div>
          <div className="stat-card-label">Total Registrations</div>
          <div className="stat-card-value">{stats.totalRegistrations.toLocaleString()}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-label">Registrations Today</div>
          <div className="stat-card-value">{stats.registrationsToday}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-icon">🏆</div>
          <div className="stat-card-label">Shortlisted Teams</div>
          <div className="stat-card-value">{stats.shortlistedTeams}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">Under Review</div>
          <div className="stat-card-value">{stats.pendingTeams}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-card-icon">✉️</div>
          <div className="stat-card-label">Emails Sent</div>
          <div className="stat-card-value">{stats.emailsSent.toLocaleString()}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon">❌</div>
          <div className="stat-card-label">Email Failures</div>
          <div className="stat-card-value">{stats.emailsFailed}</div>
        </div>
      </div>

      {/* System Health */}
      {(stats.syncPending > 0 || stats.syncFailed > 0 || stats.emailQueuePending > 0) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          {stats.syncPending > 0 && (
            <div className="card" style={{ flex: 1, minWidth: 200, borderColor: 'rgba(245,158,11,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-pending">Sync Pending</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{stats.syncPending}</span>
              </div>
            </div>
          )}
          {stats.syncFailed > 0 && (
            <div className="card" style={{ flex: 1, minWidth: 200, borderColor: 'rgba(244,63,94,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-failed">Sync Failed</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#f43f5e' }}>{stats.syncFailed}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Domain Breakdown + Recent Registrations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Domain Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Registrations by Domain</h2>
          </div>
          {stats.registrationsByDomain.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stats.registrationsByDomain.map((d, i) => {
                const maxCount = Math.max(...stats.registrationsByDomain.map(x => x.count));
                const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>{d.domain}</span>
                      <span style={{ fontWeight: 700, color: colors[i % colors.length] }}>{d.count}</span>
                    </div>
                    <div style={{ height: 6, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: colors[i % colors.length],
                        borderRadius: 99,
                        transition: 'width 600ms ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-text">No domains yet</div>
            </div>
          )}
        </div>

        {/* Recent Registrations */}
        <div className="table-container">
          <div className="table-toolbar">
            <h2 className="card-title">Recent Registrations</h2>
            <a href="/dashboard/registrations" className="btn btn-ghost btn-sm">View All →</a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Registration ID</th>
                <th>Team</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRegistrations.map(reg => (
                <tr key={reg.id}>
                  <td><span className="reg-id">{reg.registrationId}</span></td>
                  <td>{reg.teamName || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{reg.domain.name}</td>
                  <td><span className={`badge ${statusBadgeClass[reg.status] || ''}`}>{reg.status}</span></td>
                  <td style={{ color: '#64748b', fontSize: 13 }}>
                    {new Date(reg.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentRegistrations.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No registrations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
