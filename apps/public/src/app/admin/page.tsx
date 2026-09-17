'use client';

import { useEffect } from 'react';

export default function AdminRedirectPage() {
  useEffect(() => {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
    window.location.href = adminUrl;
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050a18',
      color: '#94a3b8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#06b6d4',
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 16 }}>Redirecting to Admin Dashboard...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
