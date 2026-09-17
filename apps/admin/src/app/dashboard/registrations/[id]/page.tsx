'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface FormField {
  id: string; type: string; label: string; name: string;
  description: string | null; required: boolean; order: number;
  options: string[] | null;
}

interface Registration {
  id: string; registrationId: string; domainId: string;
  formVersionId: string; teamName: string | null;
  teamLeaderName: string | null; email: string; phone: string | null;
  status: string; syncStatus: string; syncedAt: string | null;
  values: Record<string, unknown>;
  createdAt: string; updatedAt: string;
  deletedAt: string | null; deletedBy: string | null; deletionReason: string | null;
  domain: { name: string; slug: string };
  formVersion: { version: number; fields: FormField[] };
  emailJobs: Array<{
    id: string; type: string; status: string;
    sentAt: string | null; error: string | null;
  }>;
  sheetSyncJobs: Array<{
    id: string; status: string; syncedAt: string | null; error: string | null;
  }>;
}

const statusOptions = [
  { value: 'REGISTERED', label: 'Registered', badge: 'badge-registered' },
  { value: 'UNDER_REVIEW', label: 'Under Review', badge: 'badge-under-review' },
  { value: 'SHORTLISTED', label: 'Shortlisted', badge: 'badge-shortlisted' },
  { value: 'REJECTED', label: 'Rejected', badge: 'badge-rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn', badge: 'badge-inactive' },
  { value: 'DISQUALIFIED', label: 'Disqualified', badge: 'badge-failed' },
];

const syncBadgeClass: Record<string, string> = {
  SYNCED: 'badge-synced', PENDING_SYNC: 'badge-pending', SYNC_FAILED: 'badge-failed',
};

const emailStatusBadge: Record<string, string> = {
  SENT: 'badge-synced', FAILED: 'badge-failed', QUEUED: 'badge-pending',
  SENDING: 'badge-pending', RETRYING: 'badge-under-review',
};

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reg, setReg] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const loadRegistration = useCallback(async () => {
    try {
      const res = await api.get<{ data: Registration }>(`/api/registrations/${id}`);
      setReg(res.data);
    } catch {
      setReg(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadRegistration(); }, [loadRegistration]);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!reg) return;
    setUpdating(true);
    try {
      await api.put(`/api/registrations/${id}/status`, { status: newStatus });
      showToast('success', `Status updated to ${newStatus}`);
      loadRegistration();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update status');
    }
    setUpdating(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/registrations/${id}`);
      showToast('success', 'Registration archived');
      setShowDelete(false);
      loadRegistration();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await api.post(`/api/registrations/${id}/restore`);
      showToast('success', 'Registration restored');
      loadRegistration();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleResendEmail = async () => {
    try {
      await api.post(`/api/registrations/${id}/resend-email`);
      showToast('success', 'Confirmation email resend queued');
      loadRegistration();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span className="loading-text">Loading registration...</span>
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Registration not found</div>
        <div className="empty-state-text">This registration may have been permanently removed.</div>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/registrations')}>← Back to Registrations</button>
      </div>
    );
  }

  const currentStatus = statusOptions.find(s => s.value === reg.status);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/registrations')}>← Back</button>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="reg-id" style={{ fontSize: 18 }}>{reg.registrationId}</span>
            {reg.teamName && <span style={{ fontWeight: 400, fontSize: 20 }}>— {reg.teamName}</span>}
          </h1>
          <p className="page-subtitle">
            {reg.domain.name} · Registered {new Date(reg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleResendEmail}>📧 Resend Email</button>
          {reg.deletedAt ? (
            <button className="btn btn-success btn-sm" onClick={handleRestore}>♻️ Restore</button>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>🗑 Archive</button>
          )}
        </div>
      </div>

      {/* Deleted banner */}
      {reg.deletedAt && (
        <div style={{
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ color: '#f43f5e', fontWeight: 600 }}>⚠️ This registration has been archived</span>
            {reg.deletionReason && <span style={{ color: '#94a3b8', marginLeft: 12 }}>Reason: {reg.deletionReason}</span>}
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Deleted on {new Date(reg.deletedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left Column — Registration Details */}
        <div>
          {/* Status & Core Info */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="card-title">Status</h2>
              <span className={`badge ${currentStatus?.badge || ''}`} style={{ fontSize: 13, padding: '6px 14px' }}>
                {reg.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Change Status</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {statusOptions.filter(s => s.value !== reg.status).map(s => (
                  <button
                    key={s.value}
                    className={`btn btn-sm ${s.value === 'SHORTLISTED' ? 'btn-success' : s.value === 'REJECTED' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => handleStatusChange(s.value)}
                    disabled={updating}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Core Information */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Core Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <InfoRow label="Team Name" value={reg.teamName || '—'} />
              <InfoRow label="Team Leader" value={reg.teamLeaderName || '—'} />
              <InfoRow label="Email" value={reg.email} />
              <InfoRow label="Phone" value={reg.phone || '—'} />
              <InfoRow label="Domain" value={reg.domain.name} />
              <InfoRow label="Form Version" value={`v${reg.formVersion.version}`} />
            </div>
          </div>

          {/* All Form Answers */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Form Responses</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reg.formVersion.fields
                .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT')
                .map(field => (
                  <div key={field.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      {field.label} {field.required && <span style={{ color: 'var(--accent-rose)' }}>*</span>}
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                      {formatValue(reg.values[field.name])}
                    </div>
                  </div>
                ))
              }
              {reg.formVersion.fields.filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT').length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No form fields found</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column — Meta & History */}
        <div>
          {/* Sync Status */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 16 }}>Google Sheet Sync</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className={`badge ${syncBadgeClass[reg.syncStatus] || ''}`}>
                {reg.syncStatus.replace(/_/g, ' ')}
              </span>
              {reg.syncedAt && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(reg.syncedAt).toLocaleString()}
                </span>
              )}
            </div>
            {reg.sheetSyncJobs.length > 0 && reg.sheetSyncJobs[0].error && (
              <div style={{ fontSize: 12, color: 'var(--accent-rose)', marginTop: 8, wordBreak: 'break-word' }}>
                {reg.sheetSyncJobs[0].error}
              </div>
            )}
          </div>

          {/* Email History */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 16 }}>Email History</h2>
            {reg.emailJobs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reg.emailJobs.map(job => (
                  <div key={job.id} style={{
                    padding: '10px 14px', background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {job.type.replace(/_/g, ' ')}
                      </span>
                      <span className={`badge ${emailStatusBadge[job.status] || ''}`}>
                        {job.status}
                      </span>
                    </div>
                    {job.sentAt && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Sent: {new Date(job.sentAt).toLocaleString()}
                      </div>
                    )}
                    {job.error && (
                      <div style={{ fontSize: 11, color: 'var(--accent-rose)', marginTop: 4, wordBreak: 'break-word' }}>
                        {job.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                No emails sent yet
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 16 }}>Timestamps</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label="Created" value={new Date(reg.createdAt).toLocaleString()} />
              <InfoRow label="Updated" value={new Date(reg.updatedAt).toLocaleString()} />
              {reg.syncedAt && <InfoRow label="Last Synced" value={new Date(reg.syncedAt).toLocaleString()} />}
            </div>
          </div>

          {/* Raw Values (for debugging) */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 16 }}>Raw Data</h2>
            <div style={{
              background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
              padding: 14, fontSize: 12, fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)', maxHeight: 300, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {JSON.stringify(reg.values, null, 2)}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Archive Registration</h2>
              <button className="modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 20,
              }}>
                <div style={{ color: '#f43f5e', fontWeight: 600, marginBottom: 4 }}>⚠️ This action will archive the registration</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Registration <strong>{reg.registrationId}</strong> for <strong>{reg.teamName || reg.email}</strong> will be archived.
                  It can be restored later by an authorized admin.
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason (optional)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Reason for archiving..."
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Archive Registration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
