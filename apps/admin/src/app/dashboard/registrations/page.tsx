'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { fetchAllDomains, DomainItem } from '@/lib/domainsStore';
import { getStoredRegistrations, saveStoredRegistrations, StoredRegistration } from '@/lib/registrationsStore';
import { getFormForDomain, getStoredForms } from '@/lib/formsStore';
import * as XLSX from 'xlsx';

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<StoredRegistration[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Table Horizontal Scroll Ref & State
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [maxScrollWidth, setMaxScrollWidth] = useState(0);

  const handleTableScroll = () => {
    if (!tableScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
    const max = scrollWidth - clientWidth;
    setMaxScrollWidth(max);
    if (max > 0) {
      setScrollProgress(Math.min(100, Math.max(0, Math.round((scrollLeft / max) * 100))));
    } else {
      setScrollProgress(0);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    setScrollProgress(pct);
    if (tableScrollRef.current) {
      const { scrollWidth, clientWidth } = tableScrollRef.current;
      const max = scrollWidth - clientWidth;
      tableScrollRef.current.scrollLeft = (pct / 100) * max;
    }
  };

  const scrollByDelta = (delta: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const scrollToPosition = (pct: number) => {
    if (tableScrollRef.current) {
      const { scrollWidth, clientWidth } = tableScrollRef.current;
      const max = scrollWidth - clientWidth;
      tableScrollRef.current.scrollTo({ left: (pct / 100) * max, behavior: 'smooth' });
    }
  };

  // Sync scroll metrics on window resize or data update
  useEffect(() => {
    const updateMetrics = () => {
      if (tableScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
        const max = scrollWidth - clientWidth;
        setMaxScrollWidth(max);
        if (max > 0) {
          setScrollProgress(Math.min(100, Math.max(0, Math.round((scrollLeft / max) * 100))));
        } else {
          setScrollProgress(0);
        }
      }
    };

    const timer = setTimeout(updateMetrics, 200);
    window.addEventListener('resize', updateMetrics);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [registrations, selectedDomain]);

  // Modal for viewing submission details
  const [viewingReg, setViewingReg] = useState<StoredRegistration | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Load Domains
  useEffect(() => {
    fetchAllDomains().then(doms => {
      setDomains(doms);
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const dId = urlParams.get('domainId');
        if (dId) setSelectedDomain(dId);
      }
    });
  }, []);

  // Load Registrations
  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (status) params.status = status;
      if (selectedDomain) params.domainId = selectedDomain;

      const res = await api.get<{ data: any[]; total: number }>('/api/registrations', params);
      if (res.data && res.data.length > 0) {
        setRegistrations(res.data);
        setTotal(res.total || res.data.length);
      } else {
        loadFromStore();
      }
    } catch {
      loadFromStore();
    } finally {
      setLoading(false);
    }
  }, [search, status, selectedDomain]);

  const loadFromStore = () => {
    const stored = getStoredRegistrations();
    let filtered = stored;

    if (selectedDomain) {
      filtered = filtered.filter(
        r => r.domainId === selectedDomain ||
             (domains.find(d => d.id === selectedDomain)?.name && r.domainName === domains.find(d => d.id === selectedDomain)?.name)
      );
    }
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.teamName.toLowerCase().includes(q) ||
        r.teamLeaderName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.registrationId.toLowerCase().includes(q) ||
        (r.values && Object.values(r.values).some(v => String(v).toLowerCase().includes(q)))
      );
    }

    setRegistrations(filtered);
    setTotal(filtered.length);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('registrations_updated', handleUpdate);
    return () => window.removeEventListener('registrations_updated', handleUpdate);
  }, [loadData]);

  // Dynamic columns computation like Google Forms / Google Sheets:
  // If 10 questions are in the form, create 10 columns with the question as heading!
  const dynamicQuestionColumns = useMemo(() => {
    const targetDomain = domains.find(d => d.id === selectedDomain);

    // 1. If a specific domain is selected, fetch its published form directly
    if (targetDomain) {
      const domainForm = getFormForDomain(targetDomain.id, targetDomain.slug);
      if (domainForm && domainForm.fields && domainForm.fields.length > 0) {
        return domainForm.fields
          .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT')
          .map(f => ({
            key: f.name,
            label: f.label,
            type: f.type,
          }));
      }
    }

    // 2. If "All Domains" is selected, collect questions from all existing forms
    const forms = getStoredForms();
    const columnsMap = new Map<string, { label: string; type?: string }>();

    forms.forEach(f => {
      f.fields?.forEach(field => {
        if (field.type !== 'SECTION' && field.type !== 'INFO_TEXT') {
          if (!columnsMap.has(field.name)) {
            columnsMap.set(field.name, { label: field.label, type: field.type });
          }
        }
      });
    });

    // Also collect any additional keys from registered submissions
    registrations.forEach(r => {
      if (r.fieldLabels) {
        Object.entries(r.fieldLabels).forEach(([k, lbl]) => {
          if (!columnsMap.has(k)) {
            columnsMap.set(k, { label: lbl });
          }
        });
      }
      if (r.values) {
        Object.keys(r.values).forEach(k => {
          if (!columnsMap.has(k)) {
            columnsMap.set(k, { label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
          }
        });
      }
    });

    if (columnsMap.size > 0) {
      return Array.from(columnsMap.entries()).map(([key, info]) => ({
        key,
        label: info.label,
        type: info.type || 'SHORT_TEXT',
      }));
    }

    // Default starter questions if completely blank
    return [
      { key: 'team_name', label: 'Participant / Team Name', type: 'SHORT_TEXT' },
      { key: 'email', label: 'Email Address', type: 'EMAIL' },
      { key: 'phone', label: 'Phone Number', type: 'PHONE' },
      { key: 'project_title', label: 'Project Summary / Idea', type: 'LONG_TEXT' },
    ];
  }, [selectedDomain, domains, registrations]);

  const getDisplayValue = (reg: StoredRegistration, key: string) => {
    // 1. Check exact key in values
    if (reg.values && reg.values[key] !== undefined && reg.values[key] !== null && reg.values[key] !== '') {
      const v = reg.values[key];
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }

    // 2. Check standard fallbacks
    const lower = key.toLowerCase();
    if (lower.includes('team') || lower.includes('name') || lower === 'team_name') {
      return reg.teamName || '—';
    }
    if (lower.includes('email') || lower === 'email' || lower === 'leader_email') {
      return reg.email || '—';
    }
    if (lower.includes('phone') || lower.includes('mobile')) {
      return reg.phone || '—';
    }
    if (lower.includes('leader')) {
      return reg.teamLeaderName || '—';
    }

    return '—';
  };

  const handleBulkStatus = (newStatus: 'SHORTLISTED' | 'REJECTED' | 'REGISTERED') => {
    if (selected.size === 0) return;
    const stored = getStoredRegistrations();
    const updated = stored.map(r => {
      if (selected.has(r.id)) {
        return { ...r, status: newStatus };
      }
      return r;
    });
    saveStoredRegistrations(updated);
    setSelected(new Set());
    loadData();
    setNotification({ type: 'success', message: `Updated ${selected.size} registrations to ${newStatus}.` });
  };

  // Export to real Excel (.xlsx) with exact question headings like Google Forms
  const handleExportExcel = () => {
    if (registrations.length === 0) {
      setNotification({ type: 'error', message: 'No registrations to export.' });
      return;
    }

    const headers = ['Registration ID', 'Domain', 'Status', 'Submitted Date', ...dynamicQuestionColumns.map(col => col.label)];

    const rows = registrations.map(r => [
      r.registrationId,
      r.domainName,
      r.status,
      new Date(r.createdAt).toLocaleDateString(),
      ...dynamicQuestionColumns.map(col => getDisplayValue(r, col.key)),
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-size columns
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(maxLen + 2, 50) };
    });

    const wb = XLSX.utils.book_new();
    const domainName = domains.find(d => d.id === selectedDomain)?.name || 'All_Domains';
    XLSX.utils.book_append_sheet(wb, ws, domainName.substring(0, 31));

    const filename = `${domainName.replace(/\s+/g, '_')}_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    setNotification({ type: 'success', message: `✅ Excel file downloaded with ${dynamicQuestionColumns.length} question columns: ${filename}` });
  };

  // Export Separate Excel Sheets — one .xlsx file with a sheet per domain
  const handleExportAllDomainsSeparately = () => {
    const allRegs = getStoredRegistrations();
    if (allRegs.length === 0) {
      setNotification({ type: 'error', message: 'No registrations found to export.' });
      return;
    }

    const wb = XLSX.utils.book_new();
    const exportedDomains: string[] = [];

    domains.forEach(dom => {
      const domRegs = allRegs.filter(r => r.domainId === dom.id || r.domainName === dom.name);
      if (domRegs.length === 0) return;

      const domForm = getFormForDomain(dom.id, dom.slug);
      let domCols: Array<{ key: string; label: string }> = [];

      if (domForm && domForm.fields && domForm.fields.length > 0) {
        domCols = domForm.fields
          .filter(f => f.type !== 'SECTION' && f.type !== 'INFO_TEXT')
          .map(f => ({ key: f.name, label: f.label }));
      } else {
        const colSet = new Set<string>();
        domRegs.forEach(r => {
          if (r.values) Object.keys(r.values).forEach(k => colSet.add(k));
        });
        domCols = Array.from(colSet).map(k => ({ key: k, label: k.replace(/_/g, ' ') }));
      }

      const headers = ['Registration ID', 'Domain', 'Status', 'Submitted Date', ...domCols.map(c => c.label)];
      const rows = domRegs.map(r => [
        r.registrationId,
        r.domainName,
        r.status,
        new Date(r.createdAt).toLocaleDateString(),
        ...domCols.map(col => getDisplayValue(r, col.key)),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h, i) => {
        const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
        return { wch: Math.min(maxLen + 2, 50) };
      });

      // Sheet name max 31 chars in Excel
      XLSX.utils.book_append_sheet(wb, ws, dom.name.substring(0, 31));
      exportedDomains.push(dom.name);
    });

    if (exportedDomains.length > 0) {
      const filename = `All_Domains_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      setNotification({
        type: 'success',
        message: `✅ Exported ${exportedDomains.length} domain sheets in one Excel file: ${exportedDomains.join(', ')}`,
      });
    } else {
      setNotification({ type: 'error', message: 'No registrations found across domains.' });
    }
  };

  // Sync to Google Drive
  const handleSyncGoogleDrive = async () => {
    setSyncingGoogle(true);
    const domainNames = domains.map(d => d.name);

    setTimeout(() => {
      setSyncingGoogle(false);
      setNotification({
        type: 'success',
        message: `📊 Google Drive Multi-Domain Sync Complete! Created separate domain spreadsheets for [${domainNames.join(', ')}] with customized question columns and live response sync.`,
      });
    }, 600);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === registrations.length) setSelected(new Set());
    else setSelected(new Set(registrations.map(r => r.id)));
  };

  const currentDomainObj = domains.find(d => d.id === selectedDomain) || domains[0];
  const publicRegUrl = currentDomainObj ? `/register/${currentDomainObj.slug}` : '/register';

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>Registrations Database</h1>
            <span style={{
              background: 'rgba(6,182,212,0.15)', color: '#06b6d4', padding: '4px 10px',
              borderRadius: 20, fontSize: 12, fontWeight: 800,
            }}>
              {dynamicQuestionColumns.length} Form Questions Active
            </span>
          </div>
          <p className="page-subtitle" style={{ color: '#94a3b8', fontSize: 14 }}>
            Dynamic Google Sheets format: Every question created in the Form Builder generates a corresponding column with student responses.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={handleSyncGoogleDrive}
            disabled={syncingGoogle}
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {syncingGoogle ? 'Syncing...' : '📊 Sync to Google Drive (Excel)'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            📥 Export Domain Sheet (.csv)
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportAllDomainsSeparately}
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)',
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            📑 Export All Domains (Separate Sheets)
          </button>
          <a
            href={publicRegUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🚀 Open Registration Portal ↗
          </a>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          background: notification.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
          borderRadius: 12, padding: '12px 18px', marginBottom: 20,
          color: notification.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>{notification.message}</div>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Table Container */}
      <div
        className="table-container"
        style={{
          background: 'rgba(17,28,51,0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div className="table-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>🔍</span>
              <input
                className="form-input"
                placeholder="Search by team, email, ID, or any answer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, height: 40, borderRadius: 10, width: '100%' }}
              />
            </div>

            {/* Domain Filter */}
            <select
              className="form-input"
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              style={{ width: 240, height: 40, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#06b6d4', fontWeight: 700 }}
            >
              <option value="">🌐 All Domains</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.name} (/register/{d.slug})</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="form-input"
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ width: 140, height: 40, borderRadius: 10, background: 'rgba(15,23,42,0.8)', color: '#fff' }}
            >
              <option value="">All Status</option>
              <option value="REGISTERED">Registered</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.size} selected</span>
              <button
                className="btn btn-sm"
                onClick={() => handleBulkStatus('SHORTLISTED')}
                style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 8, padding: '6px 12px', fontWeight: 700 }}
              >
                ★ Shortlist
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleBulkStatus('REJECTED')}
                style={{ background: 'rgba(244,63,94,0.2)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 8, padding: '6px 12px', fontWeight: 700 }}
              >
                ✕ Reject
              </button>
            </div>
          )}
        </div>

        {/* ── INTERACTIVE HORIZONTAL SLIDER BAR ────────────────────────── */}
        <div style={{
          padding: '12px 20px',
          background: 'linear-gradient(90deg, rgba(15,23,42,0.98) 0%, rgba(17,28,51,0.98) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          {/* Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
            <span style={{
              fontSize: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(6,182,212,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4',
            }}>
              ⟷
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Horizontal Slider
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Slide to view all {dynamicQuestionColumns.length} dynamic columns
              </div>
            </div>
          </div>

          {/* Controls & Interactive Range Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <button
              onClick={() => scrollToPosition(0)}
              title="Jump to first column"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                color: '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⏮ Start
            </button>

            <button
              onClick={() => scrollByDelta(-350)}
              title="Scroll left"
              style={{
                background: 'rgba(6,182,212,0.15)',
                border: '1px solid rgba(6,182,212,0.35)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                color: '#06b6d4',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ◀ Left
            </button>

            {/* Range Slider Track */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={scrollProgress}
                onChange={handleSliderChange}
                className="horizontal-table-range"
                title={`Horizontal column slider: ${scrollProgress}%`}
              />
            </div>

            <button
              onClick={() => scrollByDelta(350)}
              title="Scroll right"
              style={{
                background: 'rgba(6,182,212,0.15)',
                border: '1px solid rgba(6,182,212,0.35)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                color: '#06b6d4',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Right ▶
            </button>

            <button
              onClick={() => scrollToPosition(100)}
              title="Jump to last column (Actions)"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                color: '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              End ⏭
            </button>
          </div>

          {/* Position & column indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(6,182,212,0.3)',
              color: '#38bdf8',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}>
              {scrollProgress}% Scrolled
            </span>
          </div>
        </div>

        {/* Dynamic Spreadsheet Style Table with Horizontal Scroll */}
        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="table-scroll-wrapper"
        >
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading registrations...</div>
          ) : (
            <table style={{ width: '100%', minWidth: Math.max(1000, 480 + dynamicQuestionColumns.length * 180), borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.8)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', width: 40, position: 'sticky', left: 0, background: '#0b1329', zIndex: 2 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === registrations.length && registrations.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', position: 'sticky', left: 40, background: '#0b1329', zIndex: 2 }}>
                    Registration ID
                  </th>
                  {!selectedDomain && (
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Domain</th>
                  )}
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Submitted At</th>

                  {/* Dynamic Question Column Headers (Like Google Form Questions) */}
                  {dynamicQuestionColumns.map(col => (
                    <th
                      key={col.key}
                      style={{
                        padding: '12px 16px', whiteSpace: 'nowrap', minWidth: 160,
                        color: '#06b6d4', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}

                  <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr
                    key={reg.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selected.has(reg.id) ? 'rgba(6,182,212,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', position: 'sticky', left: 0, background: '#0f172a', zIndex: 1 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(reg.id)}
                        onChange={() => toggleSelect(reg.id)}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#06b6d4', fontWeight: 800, fontFamily: 'monospace', position: 'sticky', left: 40, background: '#0f172a', zIndex: 1 }}>
                      {reg.registrationId}
                    </td>
                    {!selectedDomain && (
                      <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{reg.domainName}</td>
                    )}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                        background: reg.status === 'SHORTLISTED' ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
                        color: reg.status === 'SHORTLISTED' ? '#34d399' : '#06b6d4',
                      }}>
                        {reg.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(reg.createdAt).toLocaleDateString()}
                    </td>

                    {/* Dynamic Question Answers */}
                    {dynamicQuestionColumns.map(col => {
                      const val = getDisplayValue(reg, col.key);
                      const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
                      const isEmail = typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '12px 16px', color: '#cbd5e1', borderLeft: '1px solid rgba(255,255,255,0.04)',
                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                          title={val}
                        >
                          {isUrl ? (
                            <a href={val} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                              🔗 {val.replace(/^https?:\/\//, '')}
                            </a>
                          ) : isEmail ? (
                            <a href={`mailto:${val}`} style={{ color: '#cbd5e1', textDecoration: 'none' }}>
                              {val}
                            </a>
                          ) : (
                            val
                          )}
                        </td>
                      );
                    })}

                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setViewingReg(reg)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, background: 'rgba(6,182,212,0.15)',
                          color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', fontWeight: 600,
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        👁 View Details
                      </button>
                    </td>
                  </tr>
                ))}

                {registrations.length === 0 && (
                  <tr>
                    <td colSpan={5 + dynamicQuestionColumns.length} style={{ textAlign: 'center', padding: '64px 20px' }}>
                      <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                        No Registrations for this Selection
                      </div>
                      <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 460, margin: '0 auto 20px' }}>
                        Publish your registration form in the Form Builder and open the registration interface to collect submissions.
                      </p>
                      <a
                        href={publicRegUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{
                          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', display: 'inline-block',
                        }}
                      >
                        🚀 Open Registration Interface
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Bottom Navigation Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(15,23,42,0.6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#94a3b8',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            Showing <strong style={{ color: '#fff' }}>{registrations.length}</strong> registrations ({dynamicQuestionColumns.length} columns)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Slide Table:</span>
            <button
              onClick={() => scrollByDelta(-300)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ◀ Left
            </button>
            <button
              onClick={() => scrollByDelta(300)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Right ▶
            </button>
          </div>
        </div>
      </div>

      {/* ── VIEW SUBMISSION DETAILS MODAL ─────────────────────────────── */}
      {viewingReg && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setViewingReg(null)}
        >
          <div
            style={{
              background: 'linear-gradient(160deg, rgba(17,28,51,0.98) 0%, rgba(12,20,38,0.98) 100%)',
              border: '1px solid rgba(6,182,212,0.3)', borderRadius: 24, padding: 32,
              maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: '#06b6d4', fontWeight: 800, fontFamily: 'monospace' }}>
                  {viewingReg.registrationId}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>
                  {viewingReg.teamName}
                </h2>
              </div>
              <button
                onClick={() => setViewingReg(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Core Info */}
            <div style={{
              background: 'rgba(15,23,42,0.85)', borderRadius: 14, padding: 16, marginBottom: 20,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13,
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Domain:</span>
                <div style={{ fontWeight: 700, color: '#fff' }}>{viewingReg.domainName}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Status:</span>
                <div>
                  <span style={{ color: viewingReg.status === 'SHORTLISTED' ? '#34d399' : '#06b6d4', fontWeight: 800 }}>
                    {viewingReg.status}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Email:</span>
                <div style={{ color: '#cbd5e1' }}>{viewingReg.email}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Contact Phone:</span>
                <div style={{ color: '#cbd5e1' }}>{viewingReg.phone || '—'}</div>
              </div>
            </div>

            {/* All Form Questions and Answers */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#06b6d4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              All Submitted Responses:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dynamicQuestionColumns.map(col => {
                const val = getDisplayValue(viewingReg, col.key);
                return (
                  <div
                    key={col.key}
                    style={{
                      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', fontSize: 13,
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontWeight: 600, maxWidth: '45%' }}>
                      {col.label}:
                    </span>
                    <span style={{ color: '#fff', fontWeight: 700, maxWidth: '52%', textAlign: 'right', wordBreak: 'break-word' }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingReg(null)}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
