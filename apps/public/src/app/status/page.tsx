'use client';

import { useState } from 'react';

export default function StatusPage() {
  const [registrationId, setRegistrationId] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationId || !email) { setError('Both fields are required'); return; }

    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/registration/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, email }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error || 'Registration not found');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    REGISTERED: '#3b82f6', SHORTLISTED: '#10b981', REJECTED: '#f43f5e',
    UNDER_REVIEW: '#f59e0b', WITHDRAWN: '#64748b',
  };

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">
          <div className="nav-logo-icon">NGB</div>
          <span className="nav-logo-text">Next Gen Buildathon</span>
        </a>
      </nav>

      <div className="status-check">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Check Registration Status</h1>
          <p style={{ color: 'var(--text-gray)' }}>Enter your Registration ID and email to check your current status.</p>
        </div>

        <form onSubmit={handleCheck} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field-group">
            <label className="field-label field-required">Registration ID</label>
            <input className="field-input" placeholder="NGB-260916-00001" value={registrationId}
              onChange={e => setRegistrationId(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label field-required">Email Address</label>
            <input className="field-input" type="email" placeholder="your@email.com" value={email}
              onChange={e => setEmail(e.target.value)} />
          </div>

          {error && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f43f5e', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Checking...' : '🔍 Check Status'}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 32, animation: 'fadeSlideUp 0.4s ease forwards' }}>
            <div className="success-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 20, padding: 32 }}>
              <div style={{
                display: 'inline-flex', padding: '8px 20px', borderRadius: 999,
                background: `${statusColors[result.status] || '#64748b'}20`,
                color: statusColors[result.status] || '#64748b',
                fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 20,
              }}>
                {result.status.replace('_', ' ')}
              </div>

              <div className="success-detail">
                <div className="success-detail-row">
                  <span className="success-detail-label">Registration ID</span>
                  <span className="success-detail-value">{result.registrationId}</span>
                </div>
                <div className="success-detail-row">
                  <span className="success-detail-label">Event</span>
                  <span className="success-detail-value">{result.domainName}</span>
                </div>
                <div className="success-detail-row">
                  <span className="success-detail-label">Team</span>
                  <span className="success-detail-value">{result.teamName || '—'}</span>
                </div>
                <div className="success-detail-row">
                  <span className="success-detail-label">Email</span>
                  <span className="success-detail-value">{result.email}</span>
                </div>
                <div className="success-detail-row">
                  <span className="success-detail-label">Registered On</span>
                  <span className="success-detail-value">{new Date(result.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </>
  );
}
