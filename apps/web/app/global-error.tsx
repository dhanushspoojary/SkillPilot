'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SkillPilot global error caught:', error.message);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F8FAFC', color: '#0F172A' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <div style={{ background: '#FEE2E2', color: '#DC2626', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <AlertTriangle size={32} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }}>SKILLPILOT RECOVERY</span>
          <h1 style={{ fontSize: '28px', margin: '12px 0 8px 0' }}>Application encountered an unexpected state</h1>
          <p style={{ color: '#64748B', maxWidth: '440px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            We encountered an unexpected error. Your saved data is intact. Please refresh or retry.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: '#EA580C',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCcw size={16} /> Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
