'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Users, GraduationCap, ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
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
const TITLES: Record<Mode, [
    string,
    string
]> = {
    login: ['Welcome back.', 'Your evidence and agent history are tied to your account.'],
    signup: ['Start your proof trail.', 'Choose how you will use SkillPilot.'],
    forgot: ['Reset your password.', 'Enter your email and we will send a reset link if an account exists.'],
    reset: ['Choose a new password.', 'Use at least 12 characters. You will be signed out everywhere.'],
};
async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    const [resetToken, setResetToken] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [unverified, setUnverified] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        // Links from emails arrive as /?verify=TOKEN or /?reset=TOKEN. Strip the token from the URL immediately.
        const params = new URLSearchParams(window.location.search);
        const verify = params.get('verify');
        const reset = params.get('reset');
        if (verify || reset)
            window.history.replaceState(null, '', window.location.pathname);
        if (reset) {
            setResetToken(reset);
            setMode('reset');
        }
        if (verify) {
            post('/api/auth/verify', { token: verify }).then((r) => (r.ok ? setNotice(r.data.message) : setError(r.data.error || 'Could not confirm email')));
        }
        const safetyTimer = window.setTimeout(() => setLoading(false), 3000);
        fetch('/api/auth/me', { cache: 'no-store' })
            .then((r) => r.json())
            .then((x) => setUser(x.user ?? null))
            .catch(() => { setUser(null); })
            .finally(() => {
                window.clearTimeout(safetyTimer);
                setLoading(false);
            });
        return () => window.clearTimeout(safetyTimer);
    }, []);
    function switchMode(next: Mode) { setMode(next); setError(''); setNotice(''); setUnverified(false); }
    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        setUnverified(false);
        try {
            if (mode === 'forgot') {
                const r = await post('/api/auth/forgot', { email });
                if (!r.ok)
                    throw new Error(r.data.error || 'Could not continue');
                setNotice(r.data.message);
            }
            else if (mode === 'reset') {
                const r = await post('/api/auth/reset', { token: resetToken, newPassword: password });
                if (!r.ok)
                    throw new Error(r.data.error || 'Could not reset password');
                setPassword('');
                setResetToken('');
                setMode('login');
                setNotice(r.data.message);
            }
            else {
                const r = await post(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', mode === 'login' ? { email, password } : { email, name, password, role });
                if (r.status === 202) {
                    setPassword('');
                    setNotice(r.data.message);
                    return;
                } // signup with email verification
                if (!r.ok) {
                    setUnverified(r.data.code === 'email_unverified');
                    throw new Error(r.data.error || 'Could not continue');
                }
                setUser(r.data.user);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not continue');
        }
        finally {
            setBusy(false);
        }
    }
    async function resendVerification() {
        const r = await post('/api/auth/resend-verification', { email });
        setError('');
        setUnverified(false);
        setNotice(r.data.message || 'If that address has an unconfirmed account, a new link is on its way.');
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
    if (loading)
        return <div className="auth-loading"><div className="brand-mark">S</div><p>Loading your secure workspace…</p></div>;
    if (user) {
        if (user.role === 'mentor')
            return <MentorWorkspace user={user} onLogout={logout}/>;
        if (user.role === 'admin')
            return <AdminWorkspace user={user} onLogout={logout}/>;
        return <App user={user} onLogout={logout}/>;
    }
    const [title, subtitle] = TITLES[mode];
    const passwordLabel = mode === 'reset' ? 'New password' : 'Password';
    return <main className="auth-shell">
    <CustomCursor />
    <div className="auth-brand"><span className="brand-mark">S</span><b>SkillPilot</b><span>Evidence-led career operating system</span></div>
    <div className="auth-layout">
      <section className="auth-hero">
        <span className="eyebrow"><span className="live-dot" /> PRIVATE · EVIDENCE-LED · HUMAN REVIEW</span>
        <h1 className="editorial-hero-title">Your career,<br /><em>proved over time.</em></h1>
        <p className="editorial-hero-sub">Adaptive assessment, verified mentor feedback and an agent that turns real evidence into your next best move.</p>
        <div className="auth-trust">
          <span><ShieldCheck size={16}/>Server-owned evidence</span>
          <span><LockKeyhole size={16}/>Secure sessions</span>
          <span><Users size={16}/>Approved mentors only</span>
        </div>
      </section>
      <section className="auth-card">
        {(mode === 'login' || mode === 'signup') && <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Create account</button>
        </div>}
        <div className="auth-card-head"><h2>{title}</h2><p>{subtitle}</p></div>
        {mode === 'signup' && <div className="role-picker">
          <button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}><GraduationCap /><b>Student</b><small>Build and prove skills</small></button>
          <button type="button" className={role === 'mentor' ? 'selected' : ''} onClick={() => setRole('mentor')}><Users /><b>Mentor</b><small>Help students after approval</small></button>
        </div>}
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required/></label>}
          {mode !== 'reset' && <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></label>}
          {mode !== 'forgot' && <label>{passwordLabel}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required/>
            {mode !== 'login' && <small>12–72 UTF-8 bytes, minimum 12 characters.</small>}
          </label>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          {error && <div className="auth-error" role="alert">{error}{unverified && <> <button type="button" onClick={resendVerification}>Send a new link</button></>}</div>}
          <button className="primary auth-submit" disabled={busy}>
            {busy ? 'Securing…' : mode === 'login' ? 'Enter SkillPilot' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Set new password'}<ArrowRight size={15}/>
          </button>
          {mode === 'login' && <div className="auth-links"><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button></div>}
          {(mode === 'forgot' || mode === 'reset') && <div className="auth-links"><button type="button" onClick={() => switchMode('login')}>Back to sign in</button></div>}
        </form>
        <p className="auth-foot">Mentor accounts stay hidden until an administrator approves them. No seeded mentor profiles exist.</p>
      </section>
    </div>
    <div className="auth-marquee-wrap">
      <AnimatedMarquee items={[
        'SKILLPILOT // CAREER OPERATING SYSTEM',
        'SERVER-OWNED EVIDENCE',
        'ZERO SYNTHETIC SCORES',
        'SOCRATIC AI COMPANION',
        'REAL RUNTIME EVALUATION',
      ]} speedSeconds={35} />
    </div>
  </main>;
}
