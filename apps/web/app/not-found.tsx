import Link from 'next/link';
import { Compass, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="auth-shell">
      <header className="auth-brand">
        <span className="brand-mark">S</span>
        <span>SkillPilot</span>
      </header>
      <main className="auth-layout" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="result" style={{ padding: '40px 20px' }}>
          <div className="result-icon-alert" style={{ background: '#F1F5F9', color: '#0F172A', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <Compass size={32} />
          </div>
          <span className="kicker">404 · PAGE NOT FOUND</span>
          <h1 style={{ fontSize: '28px', margin: '12px 0' }}>We couldn't find that page</h1>
          <p className="muted" style={{ fontSize: '15px', maxWidth: '420px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
            The page or resource you requested does not exist or may have been moved. All your account evidence and career roadmap remain safely stored.
          </p>
          <div className="result-actions" style={{ justifyContent: 'center' }}>
            <Link href="/" className="primary" style={{ textDecoration: 'none', padding: '12px 24px' }}>
              Return to SkillPilot <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
