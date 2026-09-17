'use client';

import { useEffect, useState } from 'react';

export default function AdminHome() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // DEV-ONLY: Skip authentication if NEXT_PUBLIC_SKIP_AUTH is set to true
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
      window.location.href = '/dashboard';
      return;
    }

    // Check if user is authenticated
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');
    fetch(`${apiBase}/api/auth/me`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      })
      .finally(() => setChecking(false));
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#050a18',
    }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
}
