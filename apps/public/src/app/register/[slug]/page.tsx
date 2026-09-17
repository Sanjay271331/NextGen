'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface FormField {
  id: string; type: string; label: string; name: string;
  description: string | null; placeholder: string | null;
  required: boolean; order: number; options: string[] | null;
  validation: Record<string, unknown> | null;
}

interface DomainData {
  name: string; slug: string; description: string;
  registrationState: string;
  form: {
    title: string; description: string | null;
    fields: FormField[];
  } | null;
}

declare global {
  interface Window { grecaptcha: any; }
}

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [domain, setDomain] = useState<DomainData | null>(null);
  const [allEvents, setAllEvents] = useState<Array<{ name: string; slug: string; registrationState: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [submitError, setSubmitError] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(7);

  // Auto redirect countdown when registered successfully
  useEffect(() => {
    if (!success) return;
    const timer = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [success]);

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

  useEffect(() => {
    const loadDomain = () => {
      fetch(`${API_BASE}/api/public/domains/${slug}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data) {
            setDomain(data.data);
          } else {
            setDomain(null);
          }
        })
        .catch(() => {
          setDomain(null);
        })
        .finally(() => setLoading(false));
    };

    const loadAllEvents = () => {
      fetch(`${API_BASE}/api/public/events`)
        .then(r => r.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setAllEvents(data.data);
          }
        })
        .catch(() => {});
    };

    loadDomain();
    loadAllEvents();

    const interval = setInterval(() => {
      loadDomain();
      loadAllEvents();
    }, 5000);

    const handleFocus = () => {
      loadDomain();
      loadAllEvents();
    };

    window.addEventListener('focus', handleFocus);

    // 3. Load reCAPTCHA
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      document.body.appendChild(script);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [slug]);

  const updateValue = (name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
  };

  const validate = (): boolean => {
    if (!domain?.form) return false;
    const newErrors: Record<string, string> = {};

    for (const field of domain.form.fields) {
      if (field.type === 'SECTION' || field.type === 'INFO_TEXT') continue;
      const val = values[field.name];
      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.type === 'EMAIL' && val && typeof val === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          newErrors[field.name] = 'Please enter a valid email address';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');

    // Build submitted form fields breakdown
    const summaryList = (domain?.form?.fields || [])
      .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT' && values[f.name] !== undefined && values[f.name] !== '')
      .map(f => ({
        label: f.label,
        value: Array.isArray(values[f.name]) ? (values[f.name] as string[]).join(', ') : String(values[f.name]),
      }));

    try {
      let captchaToken = '';
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (siteKey && window.grecaptcha) {
        captchaToken = await window.grecaptcha.execute(siteKey, { action: 'register' });
      }

      const res = await fetch(`${API_BASE}/api/public/register/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, captchaToken }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setSuccess({
          ...data.data,
          submittedFields: summaryList,
        });
      } else {
        const errorMsg = data?.error || data?.message || 'Registration failed. Multiple registrations are not allowed or validation failed.';
        setSubmitError(errorMsg);
      }
    } catch {
      setSubmitError('Connection error. Unable to reach server to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case 'SECTION':
        return <div className="field-section">{field.label}</div>;

      case 'INFO_TEXT':
        return <div className="field-info">{field.description || field.label}</div>;

      case 'SHORT_TEXT': case 'EMAIL': case 'PHONE': case 'URL': case 'NUMBER':
        const inputType = ({ EMAIL: 'email', PHONE: 'tel', URL: 'url', NUMBER: 'number' } as Record<string, string>)[field.type] || 'text';
        return (
          <input className="field-input" type={inputType}
            placeholder={field.placeholder || ''} value={String(values[field.name] || '')}
            onChange={e => updateValue(field.name, e.target.value)} />
        );

      case 'LONG_TEXT':
        return (
          <textarea className="field-input field-textarea"
            placeholder={field.placeholder || ''} value={String(values[field.name] || '')}
            onChange={e => updateValue(field.name, e.target.value)} />
        );

      case 'DATE':
        return <input className="field-input" type="date" value={String(values[field.name] || '')} onChange={e => updateValue(field.name, e.target.value)} />;

      case 'TIME':
        return <input className="field-input" type="time" value={String(values[field.name] || '')} onChange={e => updateValue(field.name, e.target.value)} />;

      case 'DROPDOWN':
        return (
          <select className="field-input field-select" value={String(values[field.name] || '')} onChange={e => updateValue(field.name, e.target.value)}>
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );

      case 'RADIO':
        return (
          <div className="field-radio-group">
            {(field.options || []).map(opt => (
              <label key={opt} className="field-radio-label">
                <input type="radio" name={field.name} value={opt}
                  checked={values[field.name] === opt} onChange={() => updateValue(field.name, opt)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'CHECKBOX':
        if (field.options && field.options.length > 1) {
          return (
            <div className="field-checkbox-group">
              {field.options.map(opt => (
                <label key={opt} className="field-checkbox-label">
                  <input type="checkbox" checked={Array.isArray(values[field.name]) && (values[field.name] as string[]).includes(opt)}
                    onChange={e => {
                      const current = Array.isArray(values[field.name]) ? [...(values[field.name] as string[])] : [];
                      if (e.target.checked) current.push(opt); else current.splice(current.indexOf(opt), 1);
                      updateValue(field.name, current);
                    }} />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          );
        }
        return (
          <label className="field-checkbox-label">
            <input type="checkbox" checked={!!values[field.name]} onChange={e => updateValue(field.name, e.target.checked)} />
            <span>{field.label}</span>
          </label>
        );

      case 'MULTIPLE_CHOICE':
        return (
          <div className="field-checkbox-group">
            {(field.options || []).map(opt => (
              <label key={opt} className="field-checkbox-label">
                <input type="checkbox" checked={Array.isArray(values[field.name]) && (values[field.name] as string[]).includes(opt)}
                  onChange={e => {
                    const current = Array.isArray(values[field.name]) ? [...(values[field.name] as string[])] : [];
                    if (e.target.checked) current.push(opt); else current.splice(current.indexOf(opt), 1);
                    updateValue(field.name, current);
                  }} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );

      default:
        return <input className="field-input" type="text" value={String(values[field.name] || '')} onChange={e => updateValue(field.name, e.target.value)} />;
    }
  };

  if (loading) {
    return (
      <div className="register-page">
        <div style={{ textAlign: 'center', padding: 80 }}><div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} /><p style={{ color: 'var(--text-dim)', marginTop: 16 }}>Loading registration form...</p></div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="register-page" style={{ textAlign: 'center', paddingTop: 160 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Event Not Found</h1>
        <p style={{ color: 'var(--text-gray)', marginBottom: 24 }}>The event you're looking for doesn't exist or has been removed.</p>
        <a href="/" className="btn btn-primary btn-md">← Back to Home</a>
      </div>
    );
  }

  if (domain.registrationState !== 'OPEN') {
    const messages: Record<string, { icon: string; title: string; text: string }> = {
      NOT_STARTED: { icon: '🕐', title: 'Registration Not Started', text: 'Registration hasn\'t opened yet. Check back soon!' },
      CLOSED: { icon: '🔒', title: 'Registration Closed', text: 'Registration for this event has ended.' },
      FULL: { icon: '🔴', title: 'Registration Full', text: 'All spots have been filled.' },
      DISABLED: { icon: '⚠️', title: 'Registration Disabled', text: 'Registration is currently disabled.' },
      PAUSED: { icon: '⏸️', title: 'Registration Paused', text: 'Registration is temporarily paused pending organizer setup. Please check back soon!' },
    };
    const msg = messages[domain.registrationState] || messages.DISABLED;
    return (
      <div className="register-page" style={{ textAlign: 'center', paddingTop: 160 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{msg.icon}</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{msg.title}</h1>
        <p style={{ color: 'var(--text-gray)', marginBottom: 24 }}>{msg.text}</p>
        <a href="/" className="btn btn-outline btn-md">← Back to Events</a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="success-page" style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5,10,24,0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div className="success-card" style={{
          maxWidth: 540, width: '100%',
          background: 'linear-gradient(165deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: 24, padding: '36px 32px', textAlign: 'center',
          boxShadow: '0 24px 70px rgba(0,0,0,0.8), 0 0 40px rgba(6,182,212,0.15)',
        }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, boxShadow: '0 0 30px rgba(16,185,129,0.4)',
          }}>
            🎉
          </div>

          <h1 style={{
            fontSize: 24, fontWeight: 800, marginBottom: 8,
            background: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Congratulations! Registered Successfully!
          </h1>

          <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 20 }}>
            Your registration for <strong style={{ color: '#38bdf8' }}>{success.domainName}</strong> has been confirmed!
          </p>

          <div style={{
            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '18px 20px', marginBottom: 20, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Registration ID</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                {success.registrationId}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Team / Participant:</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {success.teamName || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Email:</span>
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                {success.email}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Status:</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px',
                borderRadius: 20, background: 'rgba(16,185,129,0.2)', color: '#34d399',
                border: '1px solid rgba(16,185,129,0.4)',
              }}>
                {success.status || 'REGISTERED'}
              </span>
            </div>

            {/* Submitted Form Responses Breakdown */}
            {success.submittedFields && success.submittedFields.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                  Summary of Submission:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                  {success.submittedFields.map((sf: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                      <span style={{ color: '#94a3b8', flexShrink: 0 }}>{sf.label}:</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600, maxWidth: 240, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sf.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24, lineHeight: 1.5 }}>
            ✅ Details securely stored in database and queued for Google Drive sync.<br />
            📧 Confirmation email dispatched to your inbox.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href="/"
              style={{
                width: '100%', padding: '14px 20px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700,
                textAlign: 'center', textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              🏠 Return to Home Page ({redirectCountdown}s)
            </a>
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              Redirecting to main home page automatically in {redirectCountdown}s...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">
          <div className="nav-logo-icon">NGB</div>
          <span className="nav-logo-text">Next Gen Buildathon</span>
        </a>
        <div className="nav-links">
          <a href="/" className="nav-link">Home</a>
          <a href="/status" className="nav-link">Check Status</a>
        </div>
      </nav>

      <div className="register-page">
        {/* Track Switcher if multiple active events */}
        {allEvents.length > 1 && (
          <div style={{
            background: 'rgba(15,23,42,0.85)', border: '1px solid var(--border-glass)',
            borderRadius: 16, padding: '12px 16px', marginBottom: 28,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>🌐 Select Buildathon Track:</span>
              <span>{allEvents.length} Tracks Available</span>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {allEvents.map(evt => {
                const isSelected = domain?.slug.toLowerCase() === evt.slug.toLowerCase();
                return (
                  <button
                    key={evt.slug}
                    type="button"
                    onClick={() => router.push(`/register/${evt.slug}`)}
                    style={{
                      padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: isSelected ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : 'rgba(255,255,255,0.06)',
                      color: '#fff', border: isSelected ? 'none' : '1px solid var(--border-glass)',
                      cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span>{evt.name}</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="register-header">
          <h1>{domain.name}</h1>
          <p>{domain.form?.description || domain.description}</p>
        </div>

        {errors._form && (
          <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, color: '#f43f5e', fontSize: 14 }}>
            {errors._form}
          </div>
        )}

        {submitError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 24,
            color: '#fca5a5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.1)',
          }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>🚫</span>
            <div>
              <div style={{ fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                Registration Request Blocked
              </div>
              <div style={{ lineHeight: 1.4 }}>{submitError}</div>
            </div>
          </div>
        )}

        <form className="register-form" onSubmit={handleSubmit}>
          {domain.form?.fields.map(field => (
            <div key={field.id} className="field-group">
              {field.type !== 'SECTION' && field.type !== 'INFO_TEXT' && field.type !== 'CHECKBOX' && (
                <label className={`field-label ${field.required ? 'field-required' : ''}`}>
                  {field.label}
                </label>
              )}
              {field.description && field.type !== 'INFO_TEXT' && field.type !== 'SECTION' && (
                <span className="field-description">{field.description}</span>
              )}
              {renderField(field)}
              {errors[field.name] && <span className="field-error">{errors[field.name]}</span>}
            </div>
          ))}

          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}
            style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            {submitting ? (
              <>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Registering...
              </>
            ) : 'Submit Registration →'}
          </button>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            By submitting this form, you agree to our Terms and Conditions.
            This site is protected by reCAPTCHA.
          </p>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
