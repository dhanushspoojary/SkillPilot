'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  ArrowRight,
  LockKeyhole,
  Sparkles,
  Terminal,
  Code2,
  Activity,
  Award,
  CheckCircle2,
  ChevronRight,
  Video,
  Cpu,
  Layers,
} from 'lucide-react';
import { App } from './App';
import { MentorWorkspace } from './MentorWorkspace';
import { AdminWorkspace } from './AdminWorkspace';
import { CustomCursor, AnimatedMarquee } from './motion';

type Role = 'student' | 'mentor' | 'admin';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  mentorApproved: boolean;
}

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const TITLES: Record<Mode, [string, string]> = {
  login: ['Welcome back.', 'Your evidence and agent history are tied to your account.'],
  signup: ['Start your proof trail.', 'Choose how you will use SkillPilot.'],
  forgot: ['Reset your password.', 'Enter your email and we will send a reset link if an account exists.'],
  reset: ['Choose a new password.', 'Use at least 12 characters. You will be signed out everywhere.'],
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) {
    data.error = res.status >= 500 ? 'Server error. Please verify database connection or try again.' : 'Could not continue';
  }
  return { ok: res.ok, status: res.status, data };
}

export function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Strip query parameters from URL if any
    const params = new URLSearchParams(window.location.search);
    if (params.get('verify') || params.get('reset')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    const safetyTimer = window.setTimeout(() => setLoading(false), 3000);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((x) => setUser(x.user ?? null))
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        window.clearTimeout(safetyTimer);
        setLoading(false);
      });
    return () => window.clearTimeout(safetyTimer);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setUnverified(false);
  }

  function scrollToAuth(targetMode: Mode) {
    switchMode(targetMode);
    const el = document.getElementById('auth-station');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = el.querySelector('input');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 300);
      }
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setUnverified(false);
    try {
      if (mode === 'forgot' || mode === 'reset') {
        setError('Email password reset is disabled. Signed-in users can update their password in Settings.');
        return;
      }
      const r = await post(
        mode === 'login' ? '/api/auth/login' : '/api/auth/signup',
        mode === 'login' ? { email, password } : { email, name, password, role },
      );
      if (!r.ok) {
        throw new Error(r.data.error || 'Could not continue');
      }
      setUser(r.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'SKILLPILOT_LOGOUT' });
    try {
      sessionStorage.clear();
    } catch {}
    setUser(null);
    setMode('login');
    setError('');
    setNotice('');
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="brand-mark">S</div>
        <p>Loading your secure workspace…</p>
      </div>
    );
  }

  if (user) {
    if (user.role === 'mentor') return <MentorWorkspace user={user} onLogout={logout} />;
    if (user.role === 'admin') return <AdminWorkspace user={user} onLogout={logout} />;
    return <App user={user} onLogout={logout} />;
  }

  const [title, subtitle] = TITLES[mode];
  const passwordLabel = mode === 'reset' ? 'New password' : 'Password';

  return (
    <main className="auth-shell">
      <CustomCursor />

      {/* 1. Minimal Sticky Top Navigation */}
      <nav className="landing-nav" aria-label="Main navigation">
        <a
          href="#overview"
          className="landing-nav-brand"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="brand-mark">S</span>
          <b>SkillPilot</b>
          <span className="landing-nav-tag">AI CAREER OS</span>
        </a>

        <ul className="landing-nav-links">
          <li><a href="#features">Assessment</a></li>
          <li><a href="#spotlight">Why Proof</a></li>
          <li><a href="#roadmap">12-Week Roadmap</a></li>
          <li><a href="#mentorship">Mentorship</a></li>
          <li><a href="#passport">Skill Passport</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
        </ul>

        <div className="landing-nav-actions">
          <button type="button" className="btn-ghost" onClick={() => scrollToAuth('login')}>
            Sign In
          </button>
          <button type="button" className="btn-lime-sm" onClick={() => scrollToAuth('signup')}>
            Start Your Journey <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* 2. Editorial Hero Section */}
      <section className="landing-hero" id="overview">
        <div className="landing-hero-eyebrow">
          <span className="live-dot" />
          <span>SERVER-OWNED EVIDENCE · ADAPTIVE TESTING · VERIFIED MENTORS</span>
        </div>

        <h1 className="editorial-hero-title">
          Your career,<br />
          <em>proved over time.</em>
        </h1>

        <p className="editorial-hero-sub">
          SkillPilot replaces unverified resume claims with server-scored code execution,
          adaptive diagnostic assessments, and authoritative endorsements from verified mentors.
        </p>

        <div className="landing-hero-actions">
          <button
            type="button"
            className="btn-lime"
            onClick={() => scrollToAuth('signup')}
          >
            Start Your Journey <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="btn-charcoal"
            onClick={() => scrollToAuth('login')}
          >
            Sign In to Workspace
          </button>
        </div>

        <div className="landing-hero-trust">
          <span><ShieldCheck size={16} /> Server-Owned Evidence</span>
          <span><Terminal size={16} /> Isolated Sandbox Execution</span>
          <span><Activity size={16} /> Adaptive Diagnostic Engine</span>
          <span><Award size={16} /> Cryptographically Shareable Passport</span>
        </div>
      </section>

      {/* 3. Prominent Vibrant Lime-Green Feature Section */}
      <section className="landing-lime-section" id="spotlight">
        <div className="landing-lime-header">
          <span className="landing-lime-eyebrow">AUTHENTIC CAPABILITY OVER RESUME INFLATION</span>
          <h2>Proof beats claims. Every single time.</h2>
          <p>
            SkillPilot never relies on self-reported questionnaires or synthetic scores.
            Every skill milestone requires isolated server execution, automated test suites,
            and authoritative mentor verification.
          </p>
        </div>

        <div className="landing-lime-grid">
          <div className="landing-lime-card" id="features">
            <div>
              <div className="landing-lime-card-tag"><Activity size={14} /> ADAPTIVE TESTING ENGINE</div>
              <h3>Dynamic Diagnostic Calibration</h3>
              <p>
                Our assessment engine dynamically calibrates questions according to your performance.
                Beginners establish strong algorithmic baselines, while experienced engineers jump directly
                to architecture and edge cases without wasted cycles.
              </p>
            </div>
          </div>

          <div className="landing-lime-card">
            <div>
              <div className="landing-lime-card-tag"><Terminal size={14} /> SERVER-OWNED RUNTIME</div>
              <h3>Sandboxed Code Execution</h3>
              <p>
                Code solutions and practical project submissions are compiled and executed in secure
                server sandboxes against hidden edge cases. Results are mathematically derived—never guessed.
              </p>
            </div>
          </div>

          <div className="landing-lime-card">
            <div>
              <div className="landing-lime-card-tag"><Layers size={14} /> LIVING CAREER ROADMAP</div>
              <h3>12-Week Milestoned Pathways</h3>
              <p>
                A personalized engineering roadmap that automatically reorganizes as you prove skills.
                Target Software Engineering, Full Stack, or Systems with clear weekly targets and practical deliverables.
              </p>
            </div>
          </div>

          <div className="landing-lime-card">
            <div>
              <div className="landing-lime-card-tag"><Users size={14} /> VETTED HUMAN REVIEWS</div>
              <h3>Administrator-Approved Mentors</h3>
              <p>
                No seeded or unverified profiles. Industry engineers must be vetted and approved by administrators
                before reviewing submissions, conducting LiveKit video calls, and issuing passport endorsements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 12-Week Living Roadmap Highlights */}
      <section className="landing-panel-charcoal" id="roadmap">
        <div className="landing-charcoal-header">
          <span className="landing-charcoal-eyebrow">STRUCTURED PROGRESSION</span>
          <h2>From fundamentals to production architecture.</h2>
          <p>
            Every phase is engineered to eliminate skill gaps through practical execution.
            Track your mastery transparently against industry benchmarks.
          </p>
        </div>

        <div className="landing-roadmap-grid">
          <div className="landing-roadmap-card">
            <span className="landing-roadmap-phase">WEEKS 01–03</span>
            <h4>Algorithmic Foundations</h4>
            <p>Pointers, memory layout, time and space complexity, recursion, and core data structures.</p>
            <span className="landing-roadmap-pill">Level 1 Diagnostic</span>
          </div>

          <div className="landing-roadmap-card">
            <span className="landing-roadmap-phase">WEEKS 04–06</span>
            <h4>Systems & Scalability</h4>
            <p>Database indexing, concurrency primitives, cache eviction algorithms, and execution traces.</p>
            <span className="landing-roadmap-pill">Level 2 Sandbox</span>
          </div>

          <div className="landing-roadmap-card">
            <span className="landing-roadmap-phase">WEEKS 07–09</span>
            <h4>Distributed Services</h4>
            <p>RESTful APIs, idempotency guarantees, authentication layers, and rate-limiting middleware.</p>
            <span className="landing-roadmap-pill">Level 3 Integration</span>
          </div>

          <div className="landing-roadmap-card">
            <span className="landing-roadmap-phase">WEEKS 10–12</span>
            <h4>Production & Verification</h4>
            <p>End-to-end full-stack projects, LiveKit mock interviews, and final mentor passport endorsement.</p>
            <span className="landing-roadmap-pill">Verified Credential</span>
          </div>
        </div>
      </section>

      {/* 5. Dual Showcase: Socratic AI & LiveKit Mock Interviews */}
      <section className="landing-dual-section" id="mentorship">
        <div className="landing-dual-card">
          <div>
            <span className="landing-dual-tag"><Sparkles size={13} /> SOCRATIC GUIDANCE</span>
            <h3>Dialectic AI Career Agent</h3>
            <p>
              Unlike generic assistants that give away code answers, the SkillPilot Agent uses Socratic
              questioning to diagnose logic errors, suggest debugging strategies, and guide you to independent mastery.
            </p>
            <ul className="landing-dual-features">
              <li><CheckCircle2 size={16} /> Never reveals raw solutions prematurely</li>
              <li><CheckCircle2 size={16} /> Explains time and space complexity trade-offs</li>
              <li><CheckCircle2 size={16} /> Analyzes real runtime error logs and failing test assertions</li>
            </ul>
          </div>
          <button type="button" className="btn-charcoal" onClick={() => scrollToAuth('signup')}>
            Try AI Guidance <ArrowRight size={15} />
          </button>
        </div>

        <div className="landing-dual-card">
          <div>
            <span className="landing-dual-tag"><Video size={13} /> LIVEKIT VIDEO & AUDIO</span>
            <h3>1:1 Mock Technical Interviews</h3>
            <p>
              Simulate high-stakes engineering interviews directly in your browser.
              Approved mentors evaluate problem-solving clarity, system design, and communication under realistic conditions.
            </p>
            <ul className="landing-dual-features">
              <li><CheckCircle2 size={16} /> Real-time peer-to-peer WebRTC video and audio</li>
              <li><CheckCircle2 size={16} /> Structured evaluation rubrics scored on evidence</li>
              <li><CheckCircle2 size={16} /> Endorsements automatically flow into your Skill Passport</li>
            </ul>
          </div>
          <button type="button" className="btn-charcoal" onClick={() => scrollToAuth('signup')}>
            Meet Approved Mentors <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* 6. Cryptographic Skill Passport Showcase */}
      <section className="landing-panel-charcoal" id="passport">
        <div className="landing-charcoal-header">
          <span className="landing-charcoal-eyebrow">IMMUTABLE PROOF TRAIL</span>
          <h2>A Skill Passport employers can verify.</h2>
          <p>
            Resumes are self-reported. Skill Passports are backed by cryptographic proof links
            detailing verified test assertions, server execution timestamps, and mentor credentials.
          </p>
        </div>

        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '36px',
            marginBottom: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'left',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-purple)', letterSpacing: '0.08em' }}>VERIFIED SKILL CREDENTIAL</span>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>Software Engineer Track</h3>
              </div>
              <span style={{ background: 'var(--soft-lavender)', color: 'var(--primary-purple)', padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                100% Server Graded
              </span>
            </div>
            <div style={{ height: 1, background: 'var(--border-color)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Evaluated Skills</span>
                <b style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', marginTop: 2 }}>6 Core Tracks</b>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Evidence Records</span>
                <b style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', marginTop: 2 }}>Immutable Database</b>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mentor Verification</span>
                <b style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', marginTop: 2 }}>Hand Endorsed</b>
              </div>
            </div>
          </div>

          <button type="button" className="btn-lime" onClick={() => scrollToAuth('signup')}>
            Build Your Skill Passport <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 7. How SkillPilot Works (3 Steps) */}
      <section className="landing-steps-section" id="how-it-works">
        <div className="landing-steps-header">
          <span className="landing-steps-eyebrow">THREE-STEP JOURNEY</span>
          <h2>How SkillPilot builds your proof trail.</h2>
          <p>Clear, repeatable milestones from initial baseline to cryptographic proof.</p>
        </div>

        <div className="landing-steps-grid">
          <div className="landing-step-card">
            <div className="landing-step-number">01</div>
            <div>
              <h3>Calibrate & Baseline</h3>
              <p>
                Take an introductory diagnostic assessment tailored to your background.
                Identify exact prerequisite gaps and establish your verified readiness score.
              </p>
            </div>
          </div>

          <div className="landing-step-card">
            <div className="landing-step-number">02</div>
            <div>
              <h3>Practice & Execute</h3>
              <p>
                Solve algorithmic challenges and complete projects in our sandboxed runner.
                Code is compiled and checked against hidden test assertions on authoritative servers.
              </p>
            </div>
          </div>

          <div className="landing-step-card">
            <div className="landing-step-number">03</div>
            <div>
              <h3>Verify & Endorse</h3>
              <p>
                Conduct 1:1 LiveKit mock technical interviews with approved mentors.
                Publish your verifiable Skill Passport and share authentic proof with hiring teams.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Dedicated Interactive Authentication Station */}
      <div className="auth-layout" id="auth-station">
        <section className="auth-hero">
          <span className="landing-hero-eyebrow">
            <span className="live-dot" /> SECURE PLATFORM ACCESS
          </span>
          <h2>Access your evidence workspace.</h2>
          <p>
            Sign in to access your living roadmap, continue adaptive assessments,
            and review verified mentor feedback.
          </p>
          <div className="auth-trust">
            <span><ShieldCheck size={16} /> Server-owned evidence records</span>
            <span><LockKeyhole size={16} /> Secure sessions & cryptographic verification</span>
            <span><Users size={16} /> Administrator-approved mentors only</span>
          </div>
        </section>

        <section className="auth-card">
          {(mode === 'login' || mode === 'signup') && (
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </div>
          )}

          <div className="auth-card-head">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {mode === 'signup' && (
            <div className="role-picker" role="radiogroup" aria-label="Select account role">
              <button
                type="button"
                role="radio"
                aria-checked={role === 'student'}
                className={role === 'student' ? 'selected' : ''}
                onClick={() => setRole('student')}
              >
                <GraduationCap size={20} />
                <b>Student</b>
                <small>Build and prove skills</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={role === 'mentor'}
                className={role === 'mentor' ? 'selected' : ''}
                onClick={() => setRole('mentor')}
              >
                <Users size={20} />
                <b>Mentor</b>
                <small>Help students after approval</small>
              </button>
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            {mode === 'signup' && (
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Your full name"
                  required
                />
              </label>
            )}

            {mode !== 'reset' && (
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@domain.com"
                  required
                />
              </label>
            )}

            {mode !== 'forgot' && (
              <label>
                {passwordLabel}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  maxLength={72}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 12 characters"
                  required
                />
                {mode !== 'login' && <small>12–72 UTF-8 bytes, minimum 12 characters.</small>}
              </label>
            )}

            {notice && <div className="auth-notice" role="status">{notice}</div>}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? 'Securing…'
                : mode === 'login'
                ? 'Enter SkillPilot'
                : mode === 'signup'
                ? 'Create account'
                : 'Enter SkillPilot'}
              <ArrowRight size={15} />
            </button>
          </form>

          <p className="auth-foot">
            Mentor accounts stay hidden until an administrator approves them. No seeded mentor profiles exist.
          </p>
        </section>
      </div>

      {/* 9. Animated Marquee Banner */}
      <div className="auth-marquee-wrap">
        <AnimatedMarquee
          items={[
            'SKILLPILOT // CAREER OPERATING SYSTEM',
            'SERVER-OWNED EVIDENCE',
            'ZERO SYNTHETIC SCORES',
            'SOCRATIC AI COMPANION',
            'REAL RUNTIME EVALUATION',
            'VERIFIED MENTOR NETWORK',
          ]}
          speedSeconds={35}
        />
      </div>

      {/* 10. Minimal Editorial Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-nav-brand">
            <span className="brand-mark">S</span>
            <b style={{ color: 'var(--text-primary)' }}>SkillPilot</b>
          </div>
          <div className="landing-footer-copy">
            © {new Date().getFullYear()} SkillPilot. Private, evidence-led career operating system.
          </div>
          <div className="landing-footer-links">
            <a href="#overview">Overview</a>
            <a href="#features">Assessment</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#mentorship">Mentorship</a>
            <a href="#passport">Passport</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
