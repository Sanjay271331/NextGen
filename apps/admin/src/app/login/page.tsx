'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

function LoginFormContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('annapparhaihole@gmail.com');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check URL error query param
  useEffect(() => {
    const errCode = searchParams.get('error');
    if (errCode) {
      const errorMap: Record<string, string> = {
        server_error: 'Server encountered an issue during verification. Please try again.',
        unauthorized: 'Your account is not authorized for administrator access.',
        access_denied: 'Google sign-in authorization was cancelled.',
        invalid_state: 'Security session expired. Please try again.',
        no_code: 'No authorization code received from Google.',
        token_exchange_failed: 'Failed to exchange tokens with Google.',
      };
      setError(errorMap[errCode] || `Sign in failed: ${errCode}`);
    }
  }, [searchParams]);

  // DEV-ONLY: If NEXT_PUBLIC_SKIP_AUTH is enabled, bypass login page entirely
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
      window.location.href = '/dashboard';
    }
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Step 1: Request 6-digit verification code
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('OTP');
        setSuccessMsg(data.message || `Verification code sent to ${email}. Please check your inbox.`);
        setResendTimer(60);
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      } else {
        setError(data.error || 'Failed to send verification code.');
      }
    } catch {
      setError('Unable to reach server. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit code
  const handleVerifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || digits.join('');
    if (fullCode.length < 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Invalid verification code. Please check and try again.');
      }
    } catch {
      setError('Verification service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle individual digit input and auto-advance
  const handleDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...digits];
    // Handle pasting complete 6-digit code
    if (val.length > 1) {
      const pasted = val.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);
      if (pasted.length === 6) {
        handleVerifyCode(newDigits.join(''));
      } else {
        inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      }
      return;
    }

    newDigits[index] = val;
    setDigits(newDigits);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when 6th digit is typed
    if (val && index === 5 && newDigits.join('').length === 6) {
      handleVerifyCode(newDigits.join(''));
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Google OAuth Login Action
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
        return;
      }
      setError(data.error || 'Failed to initialize Google authentication.');
      setLoading(false);
    } catch {
      setError('Unable to reach authentication server.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#050a18', padding: 20, fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Background radial glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 650, height: 650, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)',
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />

      {/* Main Container Card */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(17,28,51,0.95) 0%, rgba(12,20,38,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, padding: '44px 40px', maxWidth: 440, width: '100%',
        textAlign: 'center', position: 'relative', zIndex: 1,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* NGB Badge */}
        <div style={{
          width: 64, height: 64, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 900, color: '#fff',
          boxShadow: '0 0 32px rgba(6,182,212,0.3)',
        }}>
          NGB
        </div>

        <h1 style={{
          fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6,
          background: 'linear-gradient(135deg, #06b6d4 0%, #c084fc 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Next Gen Buildathon
        </h1>

        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>
          {step === 'EMAIL' ? 'Admin Portal Authentication' : 'Enter 6-Digit Verification Code'}
        </p>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            color: '#fb7185', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div style={{
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            color: '#34d399', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>✅</span>
            <div style={{ flex: 1 }}>{successMsg}</div>
          </div>
        )}

        {/* ── STEP 1: ENTER EMAIL ──────────────────────────────────────── */}
        {step === 'EMAIL' && (
          <form onSubmit={handleSendCode}>
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Admin Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 16 }}>
                  ✉️
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  style={{
                    width: '100%', padding: '14px 16px 14px 44px',
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, color: '#fff', fontSize: 15,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 150ms ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#06b6d4')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
              </div>
            </div>

            {/* Primary Action: Send Code */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 20px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginBottom: 16, transition: 'all 150ms ease',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending Code...' : '🔑 Send 6-Digit Code'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Google OAuth Login Option */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '13px 20px',
                background: '#fff', color: '#1f2937',
                borderRadius: 12, fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                transition: 'all 150ms ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}

        {/* ── STEP 2: VERIFY OTP CODE ──────────────────────────────────── */}
        {step === 'OTP' && (
          <div>
            <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 20 }}>
              Verification code sent to <strong style={{ color: '#06b6d4' }}>{email}</strong>
            </p>

            {/* Secure Email Delivery Notice */}
            <div style={{
              background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 14, padding: '12px 16px', marginBottom: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                ✉️ A 6-digit verification code has been dispatched to your email address. It expires in 10 minutes.
              </div>
            </div>

            {/* 6-Digit Individual Input Boxes */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  style={{
                    width: 48, height: 56, textAlign: 'center',
                    fontSize: 22, fontWeight: 800, color: '#fff',
                    background: 'rgba(15,23,42,0.9)',
                    border: d ? '2px solid #06b6d4' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12, outline: 'none',
                    boxShadow: d ? '0 0 12px rgba(6,182,212,0.4)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              type="button"
              onClick={() => handleVerifyCode()}
              disabled={loading || digits.join('').length < 6}
              style={{
                width: '100%', padding: '14px 20px',
                background: digits.join('').length === 6 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.1)',
                color: digits.join('').length === 6 ? '#fff' : '#64748b',
                borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: 'none', cursor: digits.join('').length === 6 && !loading ? 'pointer' : 'not-allowed',
                boxShadow: digits.join('').length === 6 ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
                marginBottom: 16, transition: 'all 150ms ease',
              }}
            >
              {loading ? 'Verifying Code...' : 'Verify & Enter Dashboard →'}
            </button>

            {/* Resend & Change Email */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <button
                type="button"
                onClick={() => setStep('EMAIL')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                ← Change email
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || loading}
                onClick={() => handleSendCode()}
                style={{
                  background: 'none', border: 'none',
                  color: resendTimer > 0 ? '#475569' : '#06b6d4',
                  cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 600,
                }}
              >
                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
            Authorized administrator access only. All authentication attempts are logged.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading Authentication...
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
