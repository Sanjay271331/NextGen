'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStoredLocalDomains, DomainItem } from '@/lib/domainsStore';
import { getFormForDomain, getStoredForms, FormFieldItem, DomainFormItem, MINIMAL_STARTER_FIELDS } from '@/lib/formsStore';
import { addRegistration } from '@/lib/registrationsStore';

export default function DynamicPublicRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = (params?.slug as string) || '';

  const [allDomains, setAllDomains] = useState<DomainItem[]>([]);
  const [domain, setDomain] = useState<DomainItem | null>(null);
  const [currentForm, setCurrentForm] = useState<DomainFormItem | null>(null);
  const [formFields, setFormFields] = useState<FormFieldItem[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [loading, setLoading] = useState(true);

  // Dynamic values state mapped by field.name
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirmation state
  const [confirmedReg, setConfirmedReg] = useState<{
    registrationId: string;
    teamName: string;
    email: string;
    domainName: string;
    submittedFields: Array<{ label: string; value: any }>;
  } | null>(null);

  const loadDomainAndForm = useCallback(() => {
    const domains = getStoredLocalDomains();
    const storedForms = getStoredForms();

    // Combine domains from both stored local domains and all submitted/published forms
    const combinedDomains: DomainItem[] = [...domains];
    storedForms.forEach(f => {
      if (f.domainSlug && !combinedDomains.some(d => d.slug.toLowerCase().trim() === f.domainSlug.toLowerCase().trim())) {
        combinedDomains.push({
          id: f.domainId || `dom-${f.domainSlug}`,
          name: f.domainName || f.title || f.domainSlug,
          slug: f.domainSlug,
          description: f.description || 'Fill out the form below to register.',
          status: 'ACTIVE',
          registrationCount: 0,
          shortlistedCount: 0,
          maxRegistrations: null,
          eventDate: null,
          registrationStart: null,
          registrationEnd: null,
        });
      }
    });

    setAllDomains(combinedDomains);

    const slug = rawSlug.toLowerCase().trim();

    // 1. Try to find the domain in combined domains by slug or id
    let found = combinedDomains.find(d => d.slug.toLowerCase().trim() === slug || d.id === slug);

    // 2. If not found in domains, check if a form exists with this domainSlug
    if (!found) {
      const matchingForm = storedForms.find(
        f => f.domainSlug && f.domainSlug.toLowerCase().trim() === slug
      );
      if (matchingForm) {
        found = {
          id: matchingForm.domainId,
          name: matchingForm.domainName || matchingForm.title,
          slug: matchingForm.domainSlug,
          description: matchingForm.description,
          status: 'ACTIVE',
          registrationCount: 0,
          shortlistedCount: 0,
          maxRegistrations: null,
          eventDate: null,
          registrationStart: null,
          registrationEnd: null,
        };
      } else if (slug === 'portal' || slug === 'default' || slug === 'register' || !slug) {
        if (combinedDomains.length > 0) {
          found = combinedDomains[0];
        }
      }
 else {
        // Create an intuitive domain reference based on the slug
        const formattedName = slug
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
        found = {
          id: `dom-${slug}`,
          name: formattedName,
          slug: slug,
          description: `Registration for ${formattedName}`,
          status: 'ACTIVE',
          registrationCount: 0,
          shortlistedCount: 0,
          maxRegistrations: null,
          eventDate: null,
          registrationStart: null,
          registrationEnd: null,
        };
      }
    }

    setDomain(found || null);

    if (found) {
      // Fetch the published form template for this domain (strict matching by slug first!)
      const formConfig = getFormForDomain(found.id, found.slug);
      setCurrentForm(formConfig);

      if (formConfig && formConfig.fields && formConfig.fields.length > 0) {
        setFormFields(formConfig.fields);
        setFormTitle(formConfig.title || `${found.name} Registration Form`);
        setFormDesc(formConfig.description || found.description || 'Fill out the details below to register.');
      } else {
        // Fallback starter template
        setFormFields(MINIMAL_STARTER_FIELDS);
        setFormTitle(`${found.name} Registration Form`);
        setFormDesc(found.description || 'Fill out the details below to register.');
      }
    }

    setLoading(false);
  }, [rawSlug]);

  useEffect(() => {
    loadDomainAndForm();

    // Listen for form and domain updates across tabs or windows
    const handleUpdate = () => loadDomainAndForm();
    window.addEventListener('forms_updated', handleUpdate);
    window.addEventListener('domains_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('forms_updated', handleUpdate);
      window.removeEventListener('domains_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadDomainAndForm]);

  const handleValueChange = (name: string, val: any) => {
    setValues(prev => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    for (const field of formFields) {
      if (field.type === 'SECTION' || field.type === 'INFO_TEXT') continue;

      const val = values[field.name];
      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.type === 'EMAIL' && val) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          newErrors[field.name] = 'Please enter a valid email address';
        }
      }
      if (field.type === 'URL' && val) {
        if (!/^https?:\/\//i.test(String(val))) {
          newErrors[field.name] = 'URL must start with http:// or https://';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isRegistrationPaused = domain?.status === 'PAUSED' || domain?.status === 'STOPPED' || domain?.status === 'CLOSED';
  const isFormUnpublished = currentForm?.status === 'DRAFT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistrationPaused) {
      alert('Registration for this track is currently paused by the organizers.');
      return;
    }
    if (isFormUnpublished) {
      alert('This registration form has not been published yet.');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const domainPrefix = domain ? domain.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'NGB') : 'NGB';
    const regId = `${domainPrefix}-2026-${randomSuffix}`;

    // Look for best candidate for teamName, leaderName, email, phone
    let resolvedTeamName = '';
    let resolvedLeaderName = '';
    let resolvedEmail = '';
    let resolvedPhone = '';

    for (const [key, val] of Object.entries(values)) {
      const lowerKey = key.toLowerCase();
      const strVal = String(val).trim();
      if (!strVal) continue;

      if (!resolvedEmail && (lowerKey.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))) {
        resolvedEmail = strVal;
      }
      if (!resolvedPhone && (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact'))) {
        resolvedPhone = strVal;
      }
      if (!resolvedTeamName && (lowerKey.includes('team') || lowerKey.includes('name') || lowerKey.includes('title'))) {
        resolvedTeamName = strVal;
      }
      if (!resolvedLeaderName && (lowerKey.includes('leader') || lowerKey.includes('name') || lowerKey.includes('participant'))) {
        resolvedLeaderName = strVal;
      }
    }

    // Safe fallbacks
    if (!resolvedTeamName) resolvedTeamName = resolvedLeaderName || `Participant #${randomSuffix}`;
    if (!resolvedLeaderName) resolvedLeaderName = resolvedTeamName;
    if (!resolvedEmail) resolvedEmail = 'participant@buildathon.local';

    // Build field labels dictionary for nice display
    const labelsMap: Record<string, string> = {};
    formFields.forEach(f => {
      if (f.type !== 'SECTION' && f.type !== 'INFO_TEXT') {
        labelsMap[f.name] = f.label;
      }
    });

    // Add to real registrations store
    const newReg = addRegistration({
      registrationId: regId,
      teamName: resolvedTeamName,
      teamLeaderName: resolvedLeaderName,
      email: resolvedEmail.toLowerCase(),
      phone: resolvedPhone,
      domainId: domain ? domain.id : 'custom',
      domainName: domain ? domain.name : 'Hackathon Event',
      values: { ...values },
      fieldLabels: labelsMap,
    });

    // Update domain registration count
    if (domain) {
      const allDoms = getStoredLocalDomains();
      const updatedDomains = allDoms.map(d => {
        if (d.id === domain.id || d.slug.toLowerCase() === domain.slug.toLowerCase()) {
          return { ...d, registrationCount: (d.registrationCount || 0) + 1 };
        }
        return d;
      });
      localStorage.setItem('ngb_demo_domains', JSON.stringify(updatedDomains));
      window.dispatchEvent(new Event('domains_updated'));
    }

    // Build submitted fields summary for confirmation card
    const summaryList = formFields
      .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT' && values[f.name] !== undefined)
      .map(f => ({
        label: f.label,
        value: Array.isArray(values[f.name]) ? values[f.name].join(', ') : String(values[f.name]),
      }));

    setTimeout(() => {
      setConfirmedReg({
        registrationId: newReg.registrationId,
        teamName: newReg.teamName,
        email: newReg.email,
        domainName: newReg.domainName,
        submittedFields: summaryList,
      });
      setSubmitting(false);
    }, 500);
  };

  // Render individual dynamic field
  const renderFieldInput = (field: FormFieldItem) => {
    const val = values[field.name];
    const isDisabled = isRegistrationPaused || isFormUnpublished || submitting;

    switch (field.type) {
      case 'SECTION':
        return (
          <div style={{
            fontSize: 16, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase',
            letterSpacing: 0.5, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)',
            marginTop: 16, marginBottom: 8,
          }}>
            {field.label}
          </div>
        );

      case 'INFO_TEXT':
        return (
          <div style={{
            background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#cbd5e1', marginBottom: 12,
          }}>
            💡 {field.description || field.label}
          </div>
        );

      case 'LONG_TEXT':
        return (
          <textarea
            rows={4}
            disabled={isDisabled}
            value={val || ''}
            onChange={e => handleValueChange(field.name, e.target.value)}
            placeholder={field.placeholder || 'Enter details...'}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              background: isDisabled ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.85)',
              color: isDisabled ? '#64748b' : '#fff', fontSize: 14,
              border: errors[field.name] ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              outline: 'none', resize: 'vertical',
            }}
          />
        );

      case 'DROPDOWN':
        return (
          <select
            disabled={isDisabled}
            value={val || ''}
            onChange={e => handleValueChange(field.name, e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              background: isDisabled ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.85)',
              color: isDisabled ? '#64748b' : '#fff', fontSize: 14,
              border: errors[field.name] ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              outline: 'none',
            }}
          >
            <option value="">{field.placeholder || '-- Please Select an Option --'}</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'RADIO':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {(field.options || ['Option 1', 'Option 2']).map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: 14, color: '#cbd5e1' }}>
                <input
                  type="radio"
                  name={field.name}
                  disabled={isDisabled}
                  value={opt}
                  checked={val === opt}
                  onChange={() => handleValueChange(field.name, opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'CHECKBOX':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {(field.options && field.options.length > 0 ? field.options : [field.label]).map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: 14, color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  disabled={isDisabled}
                  checked={Array.isArray(val) ? val.includes(opt) : Boolean(val)}
                  onChange={e => {
                    if (field.options && field.options.length > 1) {
                      const current = Array.isArray(val) ? [...val] : [];
                      if (e.target.checked) current.push(opt);
                      else current.splice(current.indexOf(opt), 1);
                      handleValueChange(field.name, current);
                    } else {
                      handleValueChange(field.name, e.target.checked);
                    }
                  }}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'DATE':
        return (
          <input
            type="date"
            disabled={isDisabled}
            value={val || ''}
            onChange={e => handleValueChange(field.name, e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              background: isDisabled ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.85)',
              color: isDisabled ? '#64748b' : '#fff', fontSize: 14,
              border: errors[field.name] ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              outline: 'none',
            }}
          />
        );

      case 'TIME':
        return (
          <input
            type="time"
            disabled={isDisabled}
            value={val || ''}
            onChange={e => handleValueChange(field.name, e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              background: isDisabled ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.85)',
              color: isDisabled ? '#64748b' : '#fff', fontSize: 14,
              border: errors[field.name] ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              outline: 'none',
            }}
          />
        );

      default:
        const inputType = {
          EMAIL: 'email',
          PHONE: 'tel',
          URL: 'url',
          NUMBER: 'number',
        }[field.type] || 'text';

        return (
          <input
            type={inputType}
            disabled={isDisabled}
            value={val || ''}
            onChange={e => handleValueChange(field.name, e.target.value)}
            placeholder={field.placeholder || ''}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              background: isDisabled ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.85)',
              color: isDisabled ? '#64748b' : '#fff', fontSize: 14,
              border: errors[field.name] ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              outline: 'none',
            }}
          />
        );
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading Registration Portal...
      </div>
    );
  }

  // ── Confirmation Certificate View ──────────────────────────────────────────
  if (confirmedReg) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)',
          border: '1px solid rgba(16,185,129,0.35)', borderRadius: 24, padding: '44px 36px',
          maxWidth: 580, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            Registered Successfully!
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            You have registered successfully for <strong style={{ color: '#06b6d4' }}>{confirmedReg.domainName}</strong>
          </p>

          <div style={{
            background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px 24px', marginBottom: 24, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Official Registration ID</span>
              <span style={{ color: '#06b6d4', fontWeight: 800, fontFamily: 'monospace', fontSize: 16 }}>
                {confirmedReg.registrationId}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Registered Participant / Team</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{confirmedReg.teamName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Status</span>
              <span style={{ color: '#34d399', fontWeight: 800, fontSize: 13 }}>● REGISTERED</span>
            </div>

            {/* Submitted Form Fields Summary */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                Submitted Form Responses:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {confirmedReg.submittedFields.map((sf, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#94a3b8' }}>{sf.label}:</span>
                    <span style={{ color: '#cbd5e1', fontWeight: 600, maxWidth: 280, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sf.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
            📧 A confirmation email has been queued and sent to your email. Your responses have been safely saved.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="/"
              style={{
                padding: '16px 28px', borderRadius: 14,
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15,
                boxShadow: '0 8px 24px rgba(6,182,212,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer',
              }}
            >
              🏠 Tap to open home page
            </a>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => { setConfirmedReg(null); setValues({}); }}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)',
                  color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                Submit Another Response
              </button>
              <a
                href="/dashboard/registrations"
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)',
                  color: '#cbd5e1', textDecoration: 'none', fontWeight: 600, fontSize: 13,
                  border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                View In Admin Panel →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Registration UI ───────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#050a18', color: '#fff',
      padding: '40px 20px', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Top Navbar */}
      <div style={{
        maxWidth: 760, margin: '0 auto 24px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff',
          }}>
            NGB
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.5 }}>Next Gen Buildathon</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Official Participant Registration Portal</div>
          </div>
        </div>
        <a
          href="/dashboard"
          style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 8 }}
        >
          ← Admin Panel
        </a>
      </div>

      {/* Dynamic Domain Track Switcher (Shows ALL Created Domains!) */}
      {allDomains.length > 0 && (
        <div style={{
          maxWidth: 760, margin: '0 auto 24px', background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>🌐 Select Hackathon Track / Domain:</span>
            <span>{allDomains.length} Active Tracks</span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {allDomains.map(d => {
              const isSelected = domain?.slug.toLowerCase() === d.slug.toLowerCase();
              const isPaused = d.status === 'PAUSED' || d.status === 'STOPPED';

              return (
                <button
                  key={d.id}
                  onClick={() => router.push(`/register/${d.slug}`)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: isSelected
                      ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
                      : 'rgba(255,255,255,0.06)',
                    color: '#fff', border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                    boxShadow: isSelected ? '0 4px 14px rgba(6,182,212,0.3)' : 'none',
                  }}
                >
                  <span>{d.name}</span>
                  {isPaused && (
                    <span style={{ fontSize: 10, background: 'rgba(234,179,8,0.25)', color: '#facc15', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>
                      PAUSED
                    </span>
                  )}
                  {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Registration Card */}
      <div style={{
        maxWidth: 760, margin: '0 auto',
        background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
        padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Registration State Alerts */}
        {isRegistrationPaused && (
          <div style={{
            background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 32 }}>⏸️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#facc15', marginBottom: 2 }}>
                Registrations Currently Paused
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                Registrations for <strong>{domain?.name}</strong> have been paused or closed by the organizers. You can select another domain track above or check back soon.
              </div>
            </div>
          </div>
        )}

        {isFormUnpublished && (
          <div style={{
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fb7185', marginBottom: 2 }}>
                Registration Form Not Yet Published
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                The organizers are currently preparing the official registration form for <strong>{domain?.name}</strong>. Please check back shortly!
              </div>
            </div>
          </div>
        )}

        {/* Event Header from Published Domain Form */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
              background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: 12, fontWeight: 800,
            }}>
              🚀 OFFICIAL REGISTRATION PORTAL
            </div>
            {domain && (
              <span style={{
                fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 12,
                background: isRegistrationPaused ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
                color: isRegistrationPaused ? '#facc15' : '#34d399',
              }}>
                ● {isRegistrationPaused ? 'REGISTRATION PAUSED' : 'REGISTRATION OPEN'}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, marginBottom: 8 }}>
            {formTitle || (domain ? `${domain.name} Registration` : 'Hackathon Registration')}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            {formDesc || domain?.description}
          </p>
          {domain?.eventDate && (
            <div style={{ fontSize: 13, color: '#34d399', marginTop: 12, fontWeight: 600 }}>
              📅 Event Date: {new Date(domain.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Dynamic Form Generated from Form Builder - ONLY renders configured fields */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {formFields.map((field) => {
              const isSection = field.type === 'SECTION';
              const isInfo = field.type === 'INFO_TEXT';

              if (isSection || isInfo) {
                return <div key={field.id}>{renderFieldInput(field)}</div>;
              }

              return (
                <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>
                    {field.label} {field.required && <span style={{ color: '#f43f5e' }}>*</span>}
                  </label>

                  {field.description && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{field.description}</span>
                  )}

                  {renderFieldInput(field)}

                  {errors[field.name] && (
                    <span style={{ color: '#fb7185', fontSize: 12, marginTop: 2 }}>{errors[field.name]}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Action */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="submit"
              disabled={isRegistrationPaused || isFormUnpublished || submitting}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 14,
                background: isRegistrationPaused || isFormUnpublished
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                color: isRegistrationPaused || isFormUnpublished ? '#94a3b8' : '#fff',
                fontSize: 16, fontWeight: 800, border: 'none',
                cursor: isRegistrationPaused || isFormUnpublished || submitting ? 'not-allowed' : 'pointer',
                boxShadow: isRegistrationPaused || isFormUnpublished ? 'none' : '0 4px 20px rgba(6,182,212,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {isRegistrationPaused
                ? '⏸️ Registrations Paused for this Track'
                : isFormUnpublished
                ? '⚠️ Form Not Published Yet'
                : submitting
                ? 'Submitting Registration...'
                : '🚀 Submit Registration →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 12 }}>
              {isRegistrationPaused
                ? 'The organizers have paused incoming registrations for this track.'
                : 'By submitting this form, you agree to the hackathon code of conduct and rules.'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
