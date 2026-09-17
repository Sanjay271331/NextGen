'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

interface FormField {
  id: string;
  type: string;
  label: string;
  name: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  order: number;
  options: string[] | null;
  validation: Record<string, unknown> | null;
}

interface DomainData {
  name: string;
  slug: string;
  description: string;
  registrationState: string;
  form: {
    title: string;
    description: string | null;
    fields: FormField[];
  } | null;
}

declare global {
  interface Window {
    grecaptcha: any;
  }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

export default function RegisterPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [domain, setDomain] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    registrationId: string;
    teamName: string;
    domainName: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    if (!successData) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [successData]);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/domains/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setDomain(data.data);
        } else {
          setDomain(null);
        }
      })
      .catch(() => setDomain(null))
      .finally(() => setLoading(false));

    // Load reCAPTCHA if configured
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey && siteKey !== 'your-recaptcha-site-key') {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      document.body.appendChild(script);
    }
  }, [slug]);

  const updateValue = (name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (submitError) setSubmitError('');
  };

  const validate = (): boolean => {
    if (!domain?.form?.fields) return true;
    const newErrors: Record<string, string> = {};

    for (const field of domain.form.fields) {
      const val = values[field.name];

      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.name] = `${field.label} is required.`;
        continue;
      }

      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'EMAIL' && typeof val === 'string') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
            newErrors[field.name] = 'Invalid email address format.';
          }
        }
        if (field.type === 'PHONE' && typeof val === 'string') {
          if (!/^[\+]?[\d\s\-\(\)]{7,20}$/.test(val.trim())) {
            newErrors[field.name] = 'Invalid phone number format.';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setSubmitError('Please correct the errors before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      let captchaToken = '';
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (typeof window !== 'undefined' && window.grecaptcha && siteKey && siteKey !== 'your-recaptcha-site-key') {
        try {
          captchaToken = await window.grecaptcha.execute(siteKey, { action: 'register' });
        } catch {
          // Continue if captcha execution fails
        }
      }

      const res = await fetch(`${API_BASE}/api/public/register/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, captchaToken }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        setSuccessData(data.data);
      } else {
        // Show exact error message (e.g. duplicate email rule)
        setSubmitError(data.error || 'Registration submission failed. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Unable to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (successData?.registrationId && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(successData.registrationId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const renderField = (field: FormField) => {
    const error = errors[field.name];

    return (
      <div key={field.id || field.name} className="field-group" style={{ marginBottom: 20 }}>
        <label className={`field-label ${field.required ? 'field-required' : ''}`}>
          {field.label}
        </label>
        {field.description && <p className="field-desc">{field.description}</p>}

        {(() => {
          switch (field.type) {
            case 'SHORT_TEXT':
              return (
                <input
                  className="field-input"
                  type="text"
                  placeholder={field.placeholder || ''}
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );

            case 'EMAIL':
              return (
                <input
                  className="field-input"
                  type="email"
                  placeholder={field.placeholder || 'your.email@example.com'}
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );

            case 'PHONE':
              return (
                <input
                  className="field-input"
                  type="tel"
                  placeholder={field.placeholder || '+1 (555) 000-0000'}
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );

            case 'NUMBER':
              return (
                <input
                  className="field-input"
                  type="number"
                  placeholder={field.placeholder || ''}
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );

            case 'LONG_TEXT':
              return (
                <textarea
                  className="field-input field-textarea"
                  placeholder={field.placeholder || ''}
                  value={String(values[field.name] || '')}
                  rows={4}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );

            case 'DROPDOWN':
              return (
                <select
                  className="field-input field-select"
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                >
                  <option value="">{field.placeholder || 'Select an option...'}</option>
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              );

            case 'RADIO':
              return (
                <div className="field-radio-group">
                  {(field.options || []).map(opt => (
                    <label key={opt} className="field-radio-label">
                      <input
                        type="radio"
                        name={field.name}
                        value={opt}
                        checked={values[field.name] === opt}
                        onChange={() => updateValue(field.name, opt)}
                      />
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
                        <input
                          type="checkbox"
                          checked={Array.isArray(values[field.name]) && (values[field.name] as string[]).includes(opt)}
                          onChange={e => {
                            const current = Array.isArray(values[field.name]) ? [...(values[field.name] as string[])] : [];
                            if (e.target.checked) current.push(opt);
                            else current.splice(current.indexOf(opt), 1);
                            updateValue(field.name, current);
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                );
              }
              return (
                <label className="field-checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!values[field.name]}
                    onChange={e => updateValue(field.name, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              );

            default:
              return (
                <input
                  className="field-input"
                  type="text"
                  placeholder={field.placeholder || ''}
                  value={String(values[field.name] || '')}
                  onChange={e => updateValue(field.name, e.target.value)}
                />
              );
          }
        })()}

        {error && <p className="field-error" style={{ color: '#f87171', fontSize: 13, marginTop: 4 }}>{error}</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="register-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--text-dim)', marginTop: 16 }}>Loading registration form...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="register-page" style={{ textAlign: 'center', paddingTop: 140 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Track Not Found</h1>
        <p style={{ color: 'var(--text-gray)', marginBottom: 24 }}>The hackathon track you are looking for does not exist or is inactive.</p>
        <a href="/" className="btn btn-primary btn-md">← Back to Homepage</a>
      </div>
    );
  }

  if (domain.registrationState !== 'OPEN') {
    const messages: Record<string, { icon: string; title: string; text: string }> = {
      NOT_STARTED: { icon: '🕐', title: 'Registration Not Started', text: 'Registration for this track has not opened yet.' },
      CLOSED: { icon: '🔒', title: 'Registration Closed', text: 'Registration for this track has concluded.' },
      FULL: { icon: '🔴', title: 'Registration Full', text: 'All available spots for this track have been filled.' },
      DISABLED: { icon: '⚠️', title: 'Registration Inactive', text: 'Registration is currently disabled.' },
      PAUSED: { icon: '⏸️', title: 'Registration Paused', text: 'Registration is temporarily paused.' },
    };
    const msg = messages[domain.registrationState] || messages.DISABLED;
    return (
      <div className="register-page" style={{ textAlign: 'center', paddingTop: 140 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{msg.icon}</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{msg.title}</h1>
        <p style={{ color: 'var(--text-gray)', marginBottom: 24 }}>{msg.text}</p>
        <a href="/" className="btn btn-outline btn-md">← Back to Tracks</a>
      </div>
    );
  }

  // ── Success Screen ──────────────────────────────────
  if (successData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#02050A' }}>
        <div style={{
          maxWidth: 540, width: '100%',
          background: 'rgba(6, 17, 33, 0.9)',
          border: '1px solid rgba(16, 185, 129, 0.45)',
          borderRadius: 24, padding: '40px 32px', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 35px rgba(16, 185, 129, 0.15)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            width: 70, height: 70, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34,
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
          }}>
            ✓
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
            🎉 Registered Successfully!
          </h1>
          <p style={{ color: '#34d399', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Thank you for registering!
          </p>
          <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            Your registration is confirmed. You will receive further updates and event schedules soon.
          </p>

          <div style={{
            background: 'rgba(2, 5, 10, 0.7)',
            border: '1px solid rgba(22, 59, 110, 0.4)',
            borderRadius: 16, padding: '20px', marginBottom: 20, textAlign: 'left',
          }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontWeight: 700 }}>
                Registration ID
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 19, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {successData.registrationId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  style={{
                    background: copiedId ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: copiedId ? '#34d399' : '#cbd5e1',
                    border: copiedId ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copiedId ? '✓ Copied' : '📋 Copy ID'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 12, borderTop: '1px solid rgba(22, 59, 110, 0.3)' }}>
              <span style={{ color: '#94a3b8' }}>Event Track:</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{successData.domainName}</span>
            </div>

            {successData.teamName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
                <span style={{ color: '#94a3b8' }}>Team Name:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{successData.teamName}</span>
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
            Please save your <strong>Registration ID</strong> for your records.
          </p>

          <p style={{ fontSize: 13, color: 'var(--accent-gold)', fontWeight: 700, marginBottom: 20 }}>
            Redirecting to homepage in {countdown}s...
          </p>

          <a href="/" className="btn-fire" style={{ width: '100%', justifyContent: 'center' }}>
            ← Return to Homepage Now
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="nav-header">
        <div className="nav-container">
          <a href="/" className="nav-brand">
            <Image
              src="/logo.png"
              alt="NextGen Build-a-thon Logo"
              width={42}
              height={42}
              className="nav-logo-img"
              priority
            />
            <span className="nav-brand-title">THE MIND MESH</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" className="nav-item">← Back to Overview</a>
          </div>
        </div>
      </header>

      <div className="register-container">
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-orange)', letterSpacing: 1.5 }}>
            Official Track Registration
          </span>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 900, color: '#fff', marginTop: 6, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {domain.name}
          </h1>
          <p style={{ color: 'var(--text-gray)', fontSize: 15, lineHeight: 1.6, maxWidth: 540, margin: '0 auto' }}>
            {domain.form?.description || domain.description || 'Fill out the details below to complete your official team registration.'}
          </p>
        </div>

        <div className="register-card">
          <form onSubmit={handleSubmit} noValidate>
            {domain.form?.fields && domain.form.fields.length > 0 ? (
              domain.form.fields
                .sort((a, b) => a.order - b.order)
                .map(field => renderField(field))
            ) : (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No fields configured for this form.</p>
            )}

            {submitError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 14,
                marginBottom: 20,
                fontWeight: 600,
              }}>
                ⚠️ {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-fire"
              style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            >
              {submitting ? 'Recording Registration...' : 'Submit Registration →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
