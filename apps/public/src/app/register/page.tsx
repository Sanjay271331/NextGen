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
      minHeight: '100vh', background: '#02050A', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#9CA3AF', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid rgba(22, 59, 110, 0.4)',
          borderTopColor: '#e84e1b', borderRadius: '50%', margin: '0 auto 16px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ letterSpacing: '0.05em', fontWeight: 600 }}>Loading Registration Track...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
