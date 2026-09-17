'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Domains', href: '/dashboard/domains', icon: '🌐' },
  { label: 'Forms', href: '/dashboard/forms', icon: '📋' },
  { label: 'Registrations', href: '/dashboard/registrations', icon: '📝' },
  { label: 'Registration Portal', href: '/register', icon: '🚀' },
  { label: 'Teams', href: '/dashboard/teams', icon: '👥' },
  { label: 'Shortlist', href: '/dashboard/shortlist', icon: '🏆' },
  { section: 'Communication' },
  { label: 'Email Templates', href: '/dashboard/emails', icon: '✉️' },
  { label: 'Send Emails', href: '/dashboard/emails/send', icon: '📤' },
  { label: 'Email Logs', href: '/dashboard/email-logs', icon: '📬' },
  { section: 'Data' },
  { label: 'Exports', href: '/dashboard/exports', icon: '📥' },
  { section: 'Administration' },
  { label: 'Admin Access', href: '/dashboard/admins', icon: '🔐' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  { label: 'Audit Logs', href: '/dashboard/audit-logs', icon: '📜' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

  useEffect(() => {
    // DEV-ONLY: Skip auth check if NEXT_PUBLIC_SKIP_AUTH is set to true
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
      setAdmin({ id: 'dev-admin', email: 'annapparhaihole@gmail.com', name: 'Sanjay A (Dev Bypass)', role: 'SUPER_ADMIN' });
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setAdmin(data.data);
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST', credentials: 'include',
      });
    } catch {
      // API unreachable — still proceed with logout
    }
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050a18' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">NGB</div>
          <span className="sidebar-logo-text">Next Gen Buildathon</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if ('section' in item) {
              return (
                <div key={i} className="sidebar-section">
                  <div className="sidebar-section-title">{item.section}</div>
                </div>
              );
            }
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname?.startsWith(item.href!);

            const isRegistrationPortal = item.label === 'Registration Portal';

            return (
              <a
                key={item.href}
                href={item.href}
                target={isRegistrationPortal ? '_blank' : undefined}
                rel={isRegistrationPortal ? 'noreferrer' : undefined}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
                {isRegistrationPortal && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>↗</span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Admin info at bottom */}
        <div style={{
          padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {admin.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {admin.name}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {admin.role}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{admin.email}</span>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
