'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredLocalDomains } from '@/lib/domainsStore';
import { getStoredForms } from '@/lib/formsStore';

export default function RegisterIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 1. Check submitted/published forms first
    const forms = getStoredForms();
    const published = forms.find(f => f.status === 'PUBLISHED' && f.domainSlug);
    if (published && published.domainSlug) {
      router.replace(`/register/${published.domainSlug}`);
      return;
    }

    // 2. Check any form with domainSlug
    if (forms.length > 0 && forms[0].domainSlug) {
      router.replace(`/register/${forms[0].domainSlug}`);
      return;
    }

    // 3. Check local domains
    const domains = getStoredLocalDomains();
    if (domains.length > 0 && domains[0].slug) {
      router.replace(`/register/${domains[0].slug}`);
      return;
    }

    router.replace('/dashboard/domains');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      Redirecting to Registration Portal...
    </div>
  );
}
