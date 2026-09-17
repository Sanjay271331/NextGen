'use client';

import { useCallback, useEffect, useState } from 'react';

interface Event {
  name: string; slug: string; description: string;
  eventDate: string | null; registrationStart: string | null;
  registrationEnd: string | null; registrationState: string;
  maxRegistrations: number | null; registrationCount: number;
}
interface ShortlistedTeam {
  registrationId: string;
  teamName: string;
  leaderName?: string;
  domainName: string;
  status: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortlistState, setShortlistState] = useState<{
    announced: boolean;
    message: string;
    teams: ShortlistedTeam[];
  }>({
    announced: false,
    message: 'Results will be announced soon. The organizers and judges are currently evaluating submissions.',
    teams: [],
  });

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

  const loadShortlist = useCallback(() => {
    fetch(`${API_BASE}/api/public/shortlist`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setShortlistState({
            announced: data.announced,
            message: data.message || 'Results will be announced soon',
            teams: data.teams || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEvents();
    loadShortlist();
  }, [loadEvents, loadShortlist]);

  const [adminLinkGenerated, setAdminLinkGenerated] = useState(false);
  const [participantLinkGenerated, setParticipantLinkGenerated] = useState(false);
  const [adminCopied, setAdminCopied] = useState(false);
  const [participantCopied, setParticipantCopied] = useState(false);

  const statusClass: Record<string, string> = {
    OPEN: 'status-open', CLOSED: 'status-closed',
    NOT_STARTED: 'status-not-started', FULL: 'status-closed',
    DISABLED: 'status-closed', PAUSED: 'status-closed',
  };

  const statusLabel: Record<string, string> = {
    OPEN: '🟢 Open', CLOSED: '🔴 Closed',
    NOT_STARTED: '🟡 Coming Soon', FULL: '🔴 Full',
    DISABLED: '🔴 Disabled', PAUSED: '⏸️ Paused (Pending Setup)',
  };

  const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
  const PARTICIPANT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const participantUrl = `${PARTICIPANT_BASE_URL.replace(/\/$/, '')}/register`;

  const handleCopyAdmin = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ADMIN_BASE_URL);
      setAdminCopied(true);
      setTimeout(() => setAdminCopied(false), 2000);
    }
  };

  const handleCopyParticipant = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(participantUrl);
      setParticipantCopied(true);
      setTimeout(() => setParticipantCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">NGB</div>
          <span className="nav-logo-text">Next Gen Buildathon</span>
        </div>
        <div className="nav-links">
          <a href="#events" className="nav-link">Events</a>
          <a href="#shortlist" className="nav-link">🏆 Shortlisted Teams</a>
          <a href="/register" className="nav-link">Participant Portal</a>
          <a href="/status" className="nav-link">Check Status</a>
          <a
            href={ADMIN_BASE_URL}
            className="nav-link"
            style={{
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 8,
              padding: '6px 14px',
              color: '#38bdf8',
              fontWeight: 700,
            }}
          >
            🛡️ Admin Dashboard
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">🚀 Registrations Open for 2026</div>
        <h1 className="hero-title">
          Build the <span className="gradient">Future</span> Today
        </h1>
        <p className="hero-subtitle">
          Join thousands of innovators, developers, and creators at the biggest buildathon of the year.
          Push boundaries. Ship products. Win prizes.
        </p>

        {/* Two "Generate Link" Action Blocks */}
        <div className="hero-actions" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {/* Participant Link Generator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 280, maxWidth: 380, width: '100%' }}>
            <button
              type="button"
              id="generate-participant-btn"
              onClick={() => setParticipantLinkGenerated(true)}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', minWidth: 260, cursor: 'pointer', justifyContent: 'center' }}
            >
              🚀 Generate Participant Link
            </button>
            {participantLinkGenerated && (
              <div
                id="participant-link-output"
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                }}
              >
                <span
                  id="participant-link-text"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: '#34d399',
                    userSelect: 'all',
                    wordBreak: 'break-all',
                    textAlign: 'left',
                  }}
                >
                  {participantUrl}
                </span>
                <button
                  type="button"
                  id="copy-participant-btn"
                  onClick={handleCopyParticipant}
                  style={{
                    background: participantCopied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                    color: participantCopied ? '#34d399' : '#fff',
                    border: participantCopied ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {participantCopied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Admin Link Generator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 280, maxWidth: 380, width: '100%' }}>
            <button
              type="button"
              id="generate-admin-btn"
              onClick={() => setAdminLinkGenerated(true)}
              className="btn btn-outline btn-lg"
              style={{
                width: '100%',
                minWidth: 260,
                borderColor: '#06b6d4',
                color: '#38bdf8',
                background: 'rgba(6,182,212,0.06)',
                cursor: 'pointer',
                justifyContent: 'center',
              }}
            >
              🛡️ Generate Admin Link
            </button>
            {adminLinkGenerated && (
              <div
                id="admin-link-output"
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                }}
              >
                <span
                  id="admin-link-text"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: '#38bdf8',
                    userSelect: 'all',
                    wordBreak: 'break-all',
                    textAlign: 'left',
                  }}
                >
                  {ADMIN_BASE_URL}
                </span>
                <button
                  type="button"
                  id="copy-admin-btn"
                  onClick={handleCopyAdmin}
                  style={{
                    background: adminCopied ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                    color: adminCopied ? '#38bdf8' : '#fff',
                    border: adminCopied ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {adminCopied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="events" id="events">
        <h2 className="events-title">Active Events</h2>

        {loading ? (
          <div className="events-grid">
            {[1, 2].map(i => (
              <div key={i} className="event-card loading-shimmer" style={{ height: 260 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 18 }}>No active events right now. Check back soon!</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map(event => (
              <div key={event.slug} className="event-card">
                <div className="event-card-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                    <h3 className="event-card-name">{event.name}</h3>
                    <span className={`event-card-status ${statusClass[event.registrationState] || ''}`}>
                      {statusLabel[event.registrationState] || event.registrationState}
                    </span>
                  </div>

                  <p className="event-card-desc">{event.description}</p>

                  <div className="event-card-meta">
                    {event.eventDate && (
                      <span>📅 {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    )}
                    {event.registrationEnd && (
                      <span>⏰ Deadline: {new Date(event.registrationEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                    {event.maxRegistrations && (
                      <span>👥 {event.registrationCount}/{event.maxRegistrations} spots</span>
                    )}
                  </div>

                  {event.registrationState === 'OPEN' ? (
                    <a href={`/register/${event.slug}`} className="btn btn-primary btn-md" style={{ width: '100%', justifyContent: 'center' }}>
                      Register Now →
                    </a>
                  ) : (
                    <div className="btn btn-outline btn-md" style={{ width: '100%', justifyContent: 'center', cursor: 'not-allowed', opacity: 0.5 }}>
                      {event.registrationState === 'NOT_STARTED' ? 'Opening Soon' : 'Registration Closed'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Shortlisted Teams Section ─────────────────────────────── */}
      <section className="events" id="shortlist" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 26 }}>🏆</span>
          <h2 className="events-title" style={{ margin: 0 }}>Shortlisted Teams</h2>
        </div>
        <p style={{ color: 'var(--text-gray)', marginBottom: 28 }}>
          Official results and shortlisted teams evaluated by the Next Gen Buildathon jury.
        </p>

        {!shortlistState.announced || shortlistState.teams.length === 0 ? (
          <div style={{
            background: 'linear-gradient(165deg, rgba(15,23,42,0.8) 0%, rgba(11,19,43,0.8) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '48px 32px', textAlign: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              Results will be announced soon
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.6 }}>
              The evaluation sheet is currently being reviewed by organizers and judges.
              Shortlisted teams will be posted here as soon as evaluation concludes.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', padding: '8px 18px', borderRadius: 24, fontSize: 13, color: '#38bdf8' }}>
              <span>📋</span>
              <span>Evaluation in Progress</span>
            </div>
          </div>
        ) : (
          <div className="events-grid">
            {shortlistState.teams.map((team, idx) => (
              <div key={idx} className="event-card" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="event-card-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                    <h3 className="event-card-name" style={{ color: '#fff' }}>{team.teamName}</h3>
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                      ⭐ Shortlisted
                    </span>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 12 }}>
                    Track: <strong style={{ color: '#38bdf8' }}>{team.domainName}</strong>
                  </p>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    Registration ID: <code style={{ color: '#38bdf8' }}>{team.registrationId}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Next Gen Buildathon. All rights reserved.</p>
      </footer>
    </>
  );
}
