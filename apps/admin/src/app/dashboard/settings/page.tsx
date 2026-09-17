'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface GoogleStatus {
  connected: boolean;
  email?: string;
  sheets?: boolean;
  drive?: boolean;
  gmail?: boolean;
}

export default function SettingsPage() {
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // System settings state
  const [settings, setSettings] = useState({
    organizationName: 'Next Gen Buildathon',
    supportEmail: '',
    defaultSenderName: 'Next Gen Buildathon',
    defaultReplyTo: '',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    captchaEnabled: true,
    captchaScoreThreshold: '0.5',
    maxFileSize: '10',
    retentionDays: '365',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Load Google status
    api.get<{ data: GoogleStatus }>('/api/google/status')
      .then(r => setGoogleStatus(r.data))
      .catch(() => setGoogleStatus(null))
      .finally(() => setLoading(false));

    // Load system settings
    api.get<{ data: Record<string, unknown> }>('/api/settings')
      .then(r => {
        const data = r.data;
        setSettings(prev => ({
          organizationName: String(data.organizationName || prev.organizationName),
          supportEmail: String(data.supportEmail || prev.supportEmail),
          defaultSenderName: String(data.defaultSenderName || prev.defaultSenderName),
          defaultReplyTo: String(data.defaultReplyTo || prev.defaultReplyTo),
          timezone: String(data.timezone || prev.timezone),
          dateFormat: String(data.dateFormat || prev.dateFormat),
          captchaEnabled: data.captchaEnabled !== undefined ? Boolean(data.captchaEnabled) : prev.captchaEnabled,
          captchaScoreThreshold: String(data.captchaScoreThreshold || prev.captchaScoreThreshold),
          maxFileSize: String(data.maxFileSize || prev.maxFileSize),
          retentionDays: String(data.retentionDays || prev.retentionDays),
        }));
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));

    // Check URL for success message
    if (typeof window !== 'undefined' && window.location.search.includes('google=connected')) {
      showToast('success', 'Google account connected successfully!');
    }
  }, []);

  const handleConnect = async () => {
    try {
      const r = await api.get<{ data: { url: string } }>('/api/auth/google/integrate');
      window.location.href = r.data.url;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to initiate Google connection');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await api.post<{ data: GoogleStatus }>('/api/google/test');
      setGoogleStatus(r.data);
      const parts = [];
      if (r.data.sheets) parts.push('Sheets ✅');
      else parts.push('Sheets ❌');
      if (r.data.gmail) parts.push('Gmail ✅');
      else parts.push('Gmail ❌');
      if (r.data.drive) parts.push('Drive ✅');
      else parts.push('Drive ❌');
      showToast(r.data.sheets && r.data.gmail && r.data.drive ? 'success' : 'warning', parts.join(' · '));
    } catch (err: any) {
      showToast('error', err.message || 'Connection test failed');
    }
    setTesting(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', {
        organizationName: settings.organizationName,
        supportEmail: settings.supportEmail,
        defaultSenderName: settings.defaultSenderName,
        defaultReplyTo: settings.defaultReplyTo,
        timezone: settings.timezone,
        dateFormat: settings.dateFormat,
        captchaEnabled: settings.captchaEnabled,
        captchaScoreThreshold: parseFloat(settings.captchaScoreThreshold),
        maxFileSize: parseInt(settings.maxFileSize),
        retentionDays: parseInt(settings.retentionDays),
      });
      showToast('success', 'Settings saved successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient && !googleStatus?.email) {
      showToast('error', 'Please enter a recipient email address');
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/api/google/send-test', {
        recipient: testEmailRecipient || googleStatus?.email,
      });
      showToast('success', res.message || 'Test email dispatched successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send test email');
    }
    setSendingTestEmail(false);
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect this Google account? Automated email sending and sheets sync will pause.')) return;
    try {
      await api.post('/api/google/disconnect');
      setGoogleStatus({ connected: false });
      showToast('success', 'Google sender account disconnected');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to disconnect');
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /><span className="loading-text">Loading settings...</span></div>;

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'} {toast.message}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration, Gmail automated sender, and Google integration</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Column — System Settings */}
        <div>
          {/* Organization */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Organization</h2>
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input className="form-input" value={settings.organizationName}
                onChange={e => setSettings({ ...settings, organizationName: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Support Email</label>
              <input className="form-input" type="email" value={settings.supportEmail}
                onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                placeholder="support@yourdomain.com" />
            </div>
          </div>

          {/* Email Defaults */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Email Sender Defaults</h2>
            <div className="form-group">
              <label className="form-label">Default Sender Name</label>
              <input className="form-input" value={settings.defaultSenderName}
                onChange={e => setSettings({ ...settings, defaultSenderName: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Reply-To</label>
              <input className="form-input" type="email" value={settings.defaultReplyTo}
                onChange={e => setSettings({ ...settings, defaultReplyTo: e.target.value })}
                placeholder="noreply@yourdomain.com" />
            </div>
          </div>

          {/* Localization */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Localization</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Timezone</label>
                <select className="form-input form-select" value={settings.timezone}
                  onChange={e => setSettings({ ...settings, timezone: e.target.value })}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date Format</label>
                <select className="form-input form-select" value={settings.dateFormat}
                  onChange={e => setSettings({ ...settings, dateFormat: e.target.value })}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>

        {/* Right Column — Google + Security */}
        <div>
          {/* Google Integration */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="card-title" style={{ margin: 0 }}>Google Automated Sender</h2>
              <span className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                Single Sender Mode
              </span>
            </div>

            {googleStatus?.connected ? (
              <div>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', fontWeight: 600, marginBottom: 2 }}>
                      Active Sender Gmail Account
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                      ✉️ {googleStatus.email}
                    </div>
                  </div>
                  <span className="badge badge-active">● Active</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Gmail Send', ok: googleStatus.gmail, desc: 'Automated Emails' },
                    { label: 'Sheets Sync', ok: googleStatus.sheets, desc: 'Realtime Rows' },
                    { label: 'Drive Access', ok: googleStatus.drive, desc: 'Files & Folders' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>{s.ok ? '✅' : '❌'}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Send Live Test Email */}
                <div style={{
                  padding: '14px 16px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-glass)',
                  marginBottom: 16,
                }}>
                  <label className="form-label" style={{ marginBottom: 6 }}>🧪 Send Live Test Email</label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Dispatch a real test email through your connected Gmail account to confirm delivery.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      type="email"
                      placeholder={googleStatus.email || 'recipient@example.com'}
                      value={testEmailRecipient}
                      onChange={e => setTestEmailRecipient(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {sendingTestEmail ? 'Sending...' : '🚀 Send Test'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testing}>
                      {testing ? 'Testing...' : '🔄 Verify Permissions'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleConnect}>
                      🔄 Switch Account
                    </button>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={handleDisconnectGoogle}>
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
                  Connect your administrator Google account. This single account will be authorized to:
                </p>
                <ul style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, marginBottom: 20, paddingLeft: 20 }}>
                  <li>Automatically send <strong>Registration Confirmation emails</strong></li>
                  <li>Automatically send <strong>Shortlisting Announcement emails</strong></li>
                  <li>Sync rows and <strong>Mail Sent Status</strong> to Google Sheets</li>
                </ul>
                <button className="btn btn-primary" onClick={handleConnect} style={{ width: '100%', justifyContent: 'center' }}>
                  🔗 Login & Authorize Sender Gmail
                </button>
              </div>
            )}
          </div>

          {/* Security */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Security</h2>
            <div style={{
              padding: '14px 18px', background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
              marginBottom: 16,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>reCAPTCHA Protection</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Protects public registration forms from bots</div>
                </div>
                <div style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.captchaEnabled ? 'var(--accent-emerald)' : 'var(--border-primary)',
                  position: 'relative', transition: 'background 200ms', cursor: 'pointer',
                }}
                  onClick={() => setSettings({ ...settings, captchaEnabled: !settings.captchaEnabled })}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2,
                    left: settings.captchaEnabled ? 22 : 2,
                    transition: 'left 200ms',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </label>
            </div>

            {settings.captchaEnabled && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Score Threshold (0.0 - 1.0)</label>
                <input className="form-input" type="number" step="0.1" min="0" max="1"
                  value={settings.captchaScoreThreshold}
                  onChange={e => setSettings({ ...settings, captchaScoreThreshold: e.target.value })} />
                <div className="form-hint">Higher values = stricter (0.5 recommended)</div>
              </div>
            )}
          </div>

          {/* Data Management */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 20 }}>Data Management</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Max File Size (MB)</label>
                <input className="form-input" type="number" value={settings.maxFileSize}
                  onChange={e => setSettings({ ...settings, maxFileSize: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Log Retention (days)</label>
                <input className="form-input" type="number" value={settings.retentionDays}
                  onChange={e => setSettings({ ...settings, retentionDays: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
