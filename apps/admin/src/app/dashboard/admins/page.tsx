'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AdminUser {
  id: string; email: string; name: string; role: string;
  isActive: boolean; isVerified: boolean; lastLoginAt: string | null; createdAt: string;
}

const roleInfo: Record<string, { label: string; color: string; badge: string; description: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin', color: 'var(--accent-purple)', badge: 'badge-published',
    description: 'Full access — can manage admins, settings, and all features',
  },
  ADMIN: {
    label: 'Admin', color: 'var(--accent-cyan)', badge: 'badge-published',
    description: 'Full CRUD on domains, forms, registrations, emails, exports',
  },
  EDITOR: {
    label: 'Editor', color: 'var(--accent-emerald)', badge: 'badge-shortlisted',
    description: 'Can read & edit forms, registrations, teams, and send emails',
  },
  VIEWER: {
    label: 'Viewer', color: 'var(--accent-amber)', badge: 'badge-under-review',
    description: 'Read-only access to all data — cannot modify anything',
  },
};

const permissionMatrix = [
  { feature: 'Domains', viewer: '👁️', editor: '👁️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Forms', viewer: '👁️', editor: '✏️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Registrations', viewer: '👁️', editor: '✏️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Teams', viewer: '👁️', editor: '✏️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Shortlist', viewer: '👁️', editor: '👁️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Emails', viewer: '👁️', editor: '✏️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Exports', viewer: '👁️', editor: '👁️', admin: '✏️', superAdmin: '✏️' },
  { feature: 'Settings', viewer: '❌', editor: '❌', admin: '👁️', superAdmin: '✏️' },
  { feature: 'Admin Access', viewer: '❌', editor: '❌', admin: '👁️', superAdmin: '✏️' },
  { feature: 'Audit Logs', viewer: '❌', editor: '❌', admin: '👁️', superAdmin: '✏️' },
];

const DEFAULT_DEMO_ADMINS: AdminUser[] = [
  {
    id: 'adm-super',
    name: 'Sanjay A',
    email: 'annapparhaihole@gmail.com',
    role: 'SUPER_ADMIN',
    isActive: true,
    isVerified: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'adm-demo-2',
    name: 'Buildathon Admin Lead',
    email: 'lead@buildathon.org',
    role: 'ADMIN',
    isActive: true,
    isVerified: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'adm-demo-3',
    name: 'Track Reviewer',
    email: 'reviewer@buildathon.org',
    role: 'EDITOR',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: '2026-09-10T00:00:00.000Z',
  },
];

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('VIEWER');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showDelete, setShowDelete] = useState<AdminUser | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const getLocalAdmins = (): AdminUser[] => {
    if (typeof window === 'undefined') return DEFAULT_DEMO_ADMINS;
    try {
      const saved = localStorage.getItem('ngb_demo_admins');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_DEMO_ADMINS;
  };

  const saveLocalAdmins = (list: AdminUser[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('ngb_demo_admins', JSON.stringify(list));
    } catch {}
    setAdmins(list);
  };

  const load = () => {
    api.get<{ data: AdminUser[] }>('/api/admins')
      .then(r => {
        if (r.data && r.data.length > 0) {
          setAdmins(r.data);
        } else {
          setAdmins(getLocalAdmins());
        }
      })
      .catch(() => {
        setAdmins(getLocalAdmins());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newEmail) { showToast('error', 'Email is required'); return; }
    if (!newEmail.includes('@')) { showToast('error', 'Enter a valid email address'); return; }
    try {
      await api.post('/api/admins', { email: newEmail, role: newRole });
      showToast('success', `${newEmail} added as ${roleInfo[newRole]?.label}`);
      setShowAdd(false);
      setNewEmail('');
      setNewRole('VIEWER');
      load();
    } catch {
      // Offline fallback
      const current = getLocalAdmins();
      const newAdmin: AdminUser = {
        id: `adm-${Date.now()}`,
        name: newEmail.split('@')[0],
        email: newEmail,
        role: newRole,
        isActive: true,
        isVerified: true,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
      };
      saveLocalAdmins([...current, newAdmin]);
      showToast('success', `${newEmail} added as ${roleInfo[newRole]?.label}`);
      setShowAdd(false);
      setNewEmail('');
      setNewRole('VIEWER');
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await api.put(`/api/admins/${id}`, { role });
      showToast('success', `Role updated to ${roleInfo[role]?.label}`);
      setEditingRole(null);
      load();
    } catch {
      const current = getLocalAdmins();
      const updated = current.map(a => a.id === id ? { ...a, role } : a);
      saveLocalAdmins(updated);
      showToast('success', `Role updated to ${roleInfo[role]?.label}`);
      setEditingRole(null);
    }
  };

  const handleToggle = async (admin: AdminUser) => {
    try {
      await api.put(`/api/admins/${admin.id}`, { isActive: !admin.isActive });
      showToast('success', admin.isActive ? `${admin.email} deactivated` : `${admin.email} activated`);
      load();
    } catch {
      const current = getLocalAdmins();
      const updated = current.map(a => a.id === admin.id ? { ...a, isActive: !a.isActive } : a);
      saveLocalAdmins(updated);
      showToast('success', admin.isActive ? `${admin.email} deactivated` : `${admin.email} activated`);
    }
  };

  const handleDelete = async (admin: AdminUser) => {
    try {
      await api.delete(`/api/admins/${admin.id}`);
      showToast('success', `${admin.email} removed`);
      setShowDelete(null);
      load();
    } catch {
      const current = getLocalAdmins();
      const updated = current.filter(a => a.id !== admin.id);
      saveLocalAdmins(updated);
      showToast('success', `${admin.email} removed`);
      setShowDelete(null);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /><span className="loading-text">Loading admins...</span></div>;

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Access</h1>
          <p className="page-subtitle">Manage who can access the admin dashboard and their permissions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPerms(true)}>🔑 Permission Matrix</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Admin</button>
        </div>
      </div>

      {/* Role Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(roleInfo).map(([key, info]) => (
          <div key={key} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: info.color, fontSize: 14, marginBottom: 4 }}>{info.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{info.description}</div>
          </div>
        ))}
      </div>

      {/* Admin Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Last Login</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${roleInfo[a.role]?.color || '#64748b'}, var(--accent-purple))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {a.name?.charAt(0).toUpperCase() || a.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {editingRole === a.id ? (
                    <select className="form-input form-select" style={{ width: 150, padding: '4px 8px', fontSize: 13 }}
                      value={a.role} onChange={e => handleRoleChange(a.id, e.target.value)}
                      onBlur={() => setEditingRole(null)} autoFocus>
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="EDITOR">Editor (Edit Mode)</option>
                      <option value="VIEWER">Viewer (View Mode)</option>
                    </select>
                  ) : (
                    <span className={`badge ${roleInfo[a.role]?.badge || ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setEditingRole(a.id)}
                      title="Click to change role">
                      {roleInfo[a.role]?.label || a.role}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${a.isActive ? 'badge-active' : 'badge-inactive'}`}>
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <span style={{ color: a.isVerified ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                    {a.isVerified ? '✅' : '⏳'}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingRole(a.id)} title="Change Role">🔑</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(a)} title={a.isActive ? 'Deactivate' : 'Activate'}>
                      {a.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-rose)' }}
                      onClick={() => setShowDelete(a)} title="Remove">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>No admins found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Admin</h2>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Add a Gmail account to grant dashboard access. They'll be able to log in using Google OAuth.
              </p>
              <div className="form-group">
                <label className="form-label form-required">Gmail Address</label>
                <input className="form-input" type="email" value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="colleague@gmail.com" />
                <div className="form-hint">Must be a Google account for OAuth login</div>
              </div>
              <div className="form-group">
                <label className="form-label form-required">Access Level</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(roleInfo).map(([key, info]) => (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 14px', background: newRole === key ? 'var(--accent-cyan-glow)' : 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${newRole === key ? 'rgba(6,182,212,0.3)' : 'var(--border-glass)'}`,
                      cursor: 'pointer', transition: 'all 150ms',
                    }}>
                      <input type="radio" name="role" value={key}
                        checked={newRole === key} onChange={e => setNewRole(e.target.value)}
                        style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: info.color, fontSize: 14 }}>{info.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{info.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Admin</button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Matrix Modal */}
      {showPerms && (
        <div className="modal-overlay" onClick={() => setShowPerms(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Permission Matrix</h2>
              <button className="modal-close" onClick={() => setShowPerms(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ fontSize: 13, padding: '16px 24px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' }}>
                👁️ = View Mode &nbsp;&nbsp; ✏️ = Edit Mode &nbsp;&nbsp; ❌ = No Access
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent-amber)' }}>Viewer</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent-emerald)' }}>Editor</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>Admin</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent-purple)' }}>Super Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionMatrix.map(row => (
                    <tr key={row.feature}>
                      <td style={{ fontWeight: 600 }}>{row.feature}</td>
                      <td style={{ textAlign: 'center', fontSize: 16 }}>{row.viewer}</td>
                      <td style={{ textAlign: 'center', fontSize: 16 }}>{row.editor}</td>
                      <td style={{ textAlign: 'center', fontSize: 16 }}>{row.admin}</td>
                      <td style={{ textAlign: 'center', fontSize: 16 }}>{row.superAdmin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPerms(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Remove Admin?</h2>
              <button className="modal-close" onClick={() => setShowDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px',
              }}>
                <div style={{ color: '#f43f5e', fontWeight: 600, marginBottom: 8 }}>
                  ⚠️ Remove {showDelete.email}?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  This will deactivate their account. They won't be able to log in until re-activated.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(showDelete)}>Remove Admin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
