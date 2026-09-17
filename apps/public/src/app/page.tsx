'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

interface Event {
  name: string;
  slug: string;
  description: string | null;
  eventDate: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  registrationState: string;
  maxRegistrations: number | null;
  registrationCount: number;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Login Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const loadEvents = useCallback(() => {
    fetch(`${API_BASE}/api/public/events`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setEvents(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      setAdminError('Please enter administrator password.');
      return;
    }

    setAdminLoading(true);
    setAdminError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
        credentials: 'include',
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = '/admin';
      } else {
        setAdminError(data.error || 'Incorrect administrator password.');
      }
    } catch {
      setAdminError('Unable to reach server. Please check your connection.');
    } finally {
      setAdminLoading(false);
    }
  };

  const statusClass: Record<string, string> = {
    OPEN: 'status-open',
    CLOSED: 'status-closed',
    NOT_STARTED: 'status-not-started',
    FULL: 'status-closed',
    DISABLED: 'status-closed',
    PAUSED: 'status-closed',
  };

  const statusLabel: Record<string, string> = {
    OPEN: '🟢 Open',
    CLOSED: '🔴 Closed',
    NOT_STARTED: '🟡 Coming Soon',
    FULL: '🔴 Full',
    DISABLED: '🔴 Disabled',
    PAUSED: '⏸️ Paused',
  };

  return (
    <>
      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="nav">
        <a href="/" className="nav-logo">
          <Image
            src="/logo.png"
            alt="NextGen Build-a-thon Logo"
            width={40}
            height={40}
            className="nav-logo-img"
            priority
          />
          <span className="nav-logo-text">Next Gen Buildathon</span>
        </a>

        <div className="nav-links">
          <a href="#events" className="nav-link">Tracks &amp; Events</a>
          <button
            type="button"
            onClick={() => {
              setShowAdminModal(true);
              setAdminError('');
              setAdminPassword('');
            }}
            className="nav-admin-btn"
            title="Unlock Management Console"
          >
            <span>🛡️</span> ADMIN
          </button>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────── */}
      <section className="hero">
        <div className="hero-badge">🚀 Official Registration Portal 2026</div>

        <div className="hero-logo-box">
          <Image
            src="/logo.png"
            alt="NextGen Buildathon Logo"
            width={130}
            height={130}
            className="hero-logo-display"
            priority
          />
        </div>

        <h1 className="hero-title">
          Build the <span className="gradient">Future</span> Today
        </h1>

        <p className="hero-subtitle">
          Join thousands of innovators, developers, and creators at the biggest buildathon of the year.
          Select your track below, register your team, and start building.
        </p>

        <div className="hero-actions">
          <a href="#events" className="btn btn-primary btn-lg">
            Explore Tracks &amp; Register →
          </a>
        </div>
      </section>

      {/* ── Active Events / Tracks Section ──────────────── */}
      <section className="events" id="events">
        <div className="events-header">
          <span className="events-tag">Registrations Open</span>
          <h2 className="events-title">Active Tracks &amp; Events</h2>
          <p className="events-subtitle">
            Select a hackathon track below to open the official registration form.
          </p>
        </div>

        {loading ? (
          <div className="events-grid">
            {[1, 2].map(i => (
              <div key={i} className="event-card loading-shimmer" style={{ height: 260 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 18, color: '#94a3b8' }}>No active events open right now. Check back soon!</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map(event => (
              <div key={event.slug} className="event-card">
                <div className="event-card-content">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <h3 className="event-card-name">{event.name}</h3>
                      <span className={`event-card-status ${statusClass[event.registrationState] || ''}`}>
                        {statusLabel[event.registrationState] || event.registrationState}
                      </span>
                    </div>

                    <p className="event-card-desc">
                      {event.description || 'Official track registration for Next Gen Buildathon.'}
                    </p>
                  </div>

                  <div>
                    <div className="event-card-meta">
                      {event.eventDate && (
                        <span>📅 {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      )}
                      {event.registrationEnd && (
                        <span>⏰ Deadline: {new Date(event.registrationEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                      {event.maxRegistrations && (
                        <span>👥 {event.registrationCount}/{event.maxRegistrations} spots filled</span>
                      )}
                    </div>

                    {event.registrationState === 'OPEN' ? (
                      <a
                        href={`/register/${event.slug}`}
                        className="btn btn-primary btn-md"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Register Now →
                      </a>
                    ) : (
                      <div
                        className="btn btn-outline btn-md"
                        style={{ width: '100%', justifyContent: 'center', cursor: 'not-allowed', opacity: 0.5 }}
                      >
                        {event.registrationState === 'NOT_STARTED' ? 'Opening Soon' : 'Registration Closed'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Admin Password Modal ────────────────────────── */}
      {showAdminModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 5, 10, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowAdminModal(false)}
        >
          <div
            style={{
              background: '#061121',
              border: '1px solid rgba(232, 78, 27, 0.4)',
              borderRadius: 20,
              padding: 36,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(232, 78, 27, 0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
                  Administrator Access
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 22, lineHeight: 1.5 }}>
              Enter the administrator password to access the NextGen management console.
            </p>

            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                  Master Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    background: 'rgba(2, 5, 10, 0.85)',
                    border: '1px solid rgba(22, 59, 110, 0.6)',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {adminError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {adminError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '12px', fontSize: 13, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '12px', fontSize: 13, justifyContent: 'center' }}
                >
                  {adminLoading ? 'Verifying...' : 'Unlock Admin →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Next Gen Buildathon. All rights reserved.</p>
      </footer>
    </>
  );
}
