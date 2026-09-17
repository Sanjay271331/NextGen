'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PublicRegisterIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');
    fetch(`${apiBase}/api/public/events`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const openEvent = data.data.find((e: any) => e.registrationState === 'OPEN') || data.data[0];
          router.replace(`/register/${openEvent.slug}`);
        } else {
          router.replace('/');
        }
      })
      .catch(() => {
        router.replace('/');
      });
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#94a3b8', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto 16px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p>Loading Registration Portal...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
