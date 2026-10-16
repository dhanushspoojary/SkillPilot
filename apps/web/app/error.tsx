'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors safely without leaking sensitive information
    console.error('SkillPilot application error boundary caught:', error.message);
  }, [error]);

  return (
    <div className="auth-shell">
      <header className="auth-brand">
        <span className="brand-mark">S</span>
        <span>SkillPilot</span>
      </header>
      <main className="auth-layout" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="result" style={{ padding: '40px 20px' }}>
          <div
            className="result-icon-alert"
            style={{
              background: '#FEE2E2',
              color: '#DC2626',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
            }}
          >
            <AlertTriangle size={32} />
          </div>
          <span className="kicker">SYSTEM RECOVERY</span>
          <h1 style={{ fontSize: '28px', margin: '12px 0' }}>Something went wrong</h1>
          <p className="muted" style={{ fontSize: '15px', maxWidth: '420px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
            A temporary issue interrupted this view. Your server-owned skill evidence and account records have not been changed.
          </p>
          <div className="result-actions" style={{ justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              className="primary"
              onClick={() => reset()}
              style={{ padding: '12px 24px' }}
            >
              <RefreshCcw size={15} /> Try again
            </button>
            <Link
              href="/"
              className="ghost"
              style={{ textDecoration: 'none', padding: '12px 24px' }}
            >
              Dashboard <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
