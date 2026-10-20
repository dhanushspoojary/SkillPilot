'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, Bell, CheckCircle2, ChevronRight, ChevronUp, LayoutDashboard, Activity, Gauge, Crosshair, Users, Award, Menu, X, Settings, Mic, Code2, LogOut, GraduationCap, Play, BookOpen, Terminal } from 'lucide-react';
import { defaultState, explainPlan, planActions, toggleActivity, type AppState, type PlanAction, } from '../lib/engine';
import { Assess } from './Assess';
import { AgentPanel } from './AgentPanel';
import { ProjectWorkspace } from './ProjectWorkspace';
import { LearnWorkspace } from './LearnWorkspace';
import { PracticeArena } from './PracticeArena';
import type { Proposal } from '../lib/agent';
import { Mentors, Passport, Roadmap, Skills, Today, SettingsView, type View } from './views';
import { MockInterview } from './MockInterview';
import { CapabilityOnboarding } from './CapabilityOnboarding';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import { CustomCursor, CinematicEntry } from './motion';
const NAV: [
    View,
    string,
    string,
    typeof Gauge
][] = [
    ['today', '01', 'Today', LayoutDashboard],
    ['practice', '02', 'Practice', Terminal],
    ['learn', '03', 'Learn', BookOpen],
    ['projects', '04', 'Projects', Code2],
    ['roadmap', '05', 'Roadmap', Activity],
    ['agent', '06', 'Agent', BrainCircuit],
    ['skills', '07', 'Skills', Gauge],
    ['assess', '08', 'Assess', Crosshair],
    ['mentors', '09', 'Mentors', Users],
    ['interview', '10', 'Mock interview', Mic],
    ['passport', '11', 'Passport', Award],
    ['settings', '12', 'Settings', Settings],
];
export function App({ user, onLogout }: {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
    onLogout?: () => void;
}) {
    const [state, setState] = useState<AppState>(defaultState);
    const [view, setView] = useState<View>('today');
    const [focus, setFocus] = useState<string | undefined>();
    const [menu, setMenu] = useState(false);
    const [toast, setToast] = useState('');
    const [running, setRunning] = useState(false);
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);
    const [round, setRound] = useState(0);
    const [syncStatus, setSyncStatus] = useState<'off' | 'loading' | 'synced' | 'offline'>('off');
    const [capabilityProfile, setCapabilityProfile] = useState<StudentCapabilityProfile | null>(null);
    const [careerGoal, setCareerGoal] = useState('Software Engineer');
    const [workflow, setWorkflow] = useState<any>(null);
    const [showCalibration, setShowCalibration] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);
    const [replayCinematic, setReplayCinematic] = useState(false);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
        if (onLogout) {
            onLogout();
        } else {
            window.location.href = '/';
        }
    };

    useEffect(() => {
        if (!profileOpen) return;

        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setProfileOpen(false);
                triggerButtonRef.current?.focus();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [profileOpen]);
    useEffect(() => {
        let cancelled = false;
        async function boot() {
            try {
                const r = await fetch('/api/profile', { cache: 'no-store' });
                if (!r.ok)
                    throw new Error('profile');
                const x = await r.json();
                if (x.careerGoal)
                    setCareerGoal(x.careerGoal);
                if (x.capabilityProfile) {
                    setCapabilityProfile(x.capabilityProfile);
                    if (x.capabilityProfile.onboardingCompleted !== true) {
                        setShowCalibration(true);
                    }
                } else {
                    setShowCalibration(true);
                }
                if (x.workflow) {
                    setWorkflow(x.workflow);
                    if (x.workflow.stage === 'REGISTERED' || x.workflow.stage === 'ONBOARDING_IN_PROGRESS') {
                        setShowCalibration(true);
                    }
                }
                const remote = x.evidence ? { ...defaultState(), name: x.user?.name ?? user.name, evidence: x.evidence, activity: x.activity ?? [], mentorNoteResolved: (x.activity ?? []).some((a: any) => a.id === 'MENTOR:feedback'), requests: x.requests ?? [], agentRuns: x.agentRuns ?? [], planNote: 'Server evidence loaded. The browser is not authoritative.' } : defaultState();
                if (!cancelled) {
                    setState(remote);
                    setSyncStatus('synced');
                    setApiOnline(true);
                }
            }
            catch {
                if (!cancelled) {
                    setState({ ...defaultState(), name: user.name });
                    setSyncStatus('offline');
                    setApiOnline(false);
                    setToast('Secure server data could not be loaded. Actions that create evidence are disabled until reconnect.');
                }
            }
        }
        void boot();
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        return () => { cancelled = true; };
    }, [user.id, user.name]);
    useEffect(() => {
        if (!toast)
            return;
        const t = window.setTimeout(() => setToast(''), 3200);
        return () => window.clearTimeout(t);
    }, [toast]);
    const actions = useMemo(() => planActions(state, careerGoal, capabilityProfile ?? undefined), [state, careerGoal, capabilityProfile]);
    const go = useCallback((v: View, f?: string) => {
        if ((v as string) === 'calibration') {
            setShowCalibration(true);
            return;
        }
        setView(v);
        setFocus(f);
        setMenu(false);
        if (v === 'assess')
            setRound((n) => n + 1);
    }, []);
    const persistActivity = (actionId: string, done: boolean) => {
        fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId, done }) })
            .then((r) => {
            if (!r.ok)
                throw new Error('save');
        })
            .catch(() => setToast('Could not save your progress to the server.'));
    };
    const onAction = (a: PlanAction) => {
        if (a.route === 'assess')
            return go('assess', a.skill);
        setState((s) => toggleActivity(s, a, new Date().toISOString()));
        persistActivity(a.id, true);
        setToast(a.kind === 'BUILD' ? 'Marked done. Retest to turn the work into evidence.' : 'Marked done.');
    };
    const onUndo = (id: string) => setState((s) => {
        const item = s.activity.find((a) => a.id === id);
        return item ? toggleActivity(s, item, new Date().toISOString()) : s;
    });
    const onUndoSaved = (id: string) => { onUndo(id); persistActivity(id, false); };
    const refreshProfile = async () => {
        const r = await fetch('/api/profile', { cache: 'no-store' });
        if (!r.ok)
            throw new Error('profile');
        const x = await r.json();
        if (x.careerGoal)
            setCareerGoal(x.careerGoal);
        if (x.capabilityProfile)
            setCapabilityProfile(x.capabilityProfile);
        if (x.workflow)
            setWorkflow(x.workflow);
        setState(s => { const next = { ...s, name: x.user?.name ?? s.name, evidence: x.evidence ?? s.evidence, requests: x.requests ?? s.requests, agentRuns: x.agentRuns ?? s.agentRuns }; return { ...next, planNote: explainPlan(next, x.careerGoal, x.capabilityProfile) }; });
    };
    const saveCalibration = async (profile: StudentCapabilityProfile) => {
        try {
            const goal = profile.careerInterests?.[0] || careerGoal;
            const r = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capabilityProfile: profile, careerGoal: goal }),
            });
            if (!r.ok)
                throw new Error('profile_save_failed');
            setCapabilityProfile(profile);
            setCareerGoal(goal);
            setShowCalibration(false);
            setToast('Background calibrated. Assessments and roadmap tailored to your starting level.');
            await refreshProfile();
        }
        catch {
            setToast('Could not save capability calibration.');
        }
    };
    const onFinish = async () => {
        try {
            await refreshProfile();
            setToast('Server accepted the assessment and updated your evidence.');
        }
        catch {
            setToast('The server could not confirm the assessment. No local score was trusted.');
        }
    };
    const onAudit = (audit: import('../lib/types').AgentAudit) => setState((s) => ({ ...s, agentRuns: [...s.agentRuns, audit].slice(-50) }));
    const onSend = async (mentorId: string, message: string) => {
        try {
            const r = await fetch('/api/mentors/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mentorId, message }) });
            const x = await r.json();
            if (!r.ok)
                throw new Error(x.error || 'Request failed');
            await refreshProfile();
            setToast('Mentorship request sent to the approved mentor.');
        }
        catch (e) {
            setToast(e instanceof Error ? e.message : 'Could not send request.');
        }
    };
    const onApprove = (p: Proposal) => {
        if (p.type === 'start_retest')
            return go('assess', p.skill);
        if (p.type === 'send_mentor_request' && p.mentorId && p.message)
            return onSend(p.mentorId, p.message);
        if (p.type === 'share_passport')
            return go('passport');
        if (p.type === 'start_project')
            return go('projects', (p.metadata?.projectSlug as string) || undefined);
        const a = actions.find((x) => x.id === p.actionId);
        if (a)
            onAction(a);
    };
    const exportData = async () => {
        try {
            const r = await fetch('/api/profile', { cache: 'no-store' });
            const x = await r.json();
            if (!r.ok)
                throw new Error('export_failed');
            const payload = { exportedAt: new Date().toISOString(), product: 'SkillPilot', user: x.user, evidence: x.evidence, requests: x.requests, activity: x.activity, agentRuns: x.agentRuns };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `skillpilot-account-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setToast('Latest server account data exported.');
        }
        catch {
            setToast('Could not export server data.');
        }
    };
    const runAgent = async () => {
        setRunning(true);
        try {
            setView('agent');
            setToast('Opening the agent with your server-owned evidence.');
        }
        finally {
            setRunning(false);
        }
    };
    return <div className="app-shell">
    <CustomCursor />
    <CinematicEntry forceShow={replayCinematic} onComplete={() => setReplayCinematic(false)} />
    <aside className={menu ? 'sidebar mobile-open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">S</span><span>SkillPilot</span></div>
      <div className="side-label">CAREER INTELLIGENCE SYSTEM</div>
      <nav aria-label="Main navigation">{NAV.map(([id, num, label, Icon]) => (<button key={id} className={view === id ? 'nav-item active' : 'nav-item'} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><span className="nav-index">{num}</span><Icon size={17}/><span>{label}</span></button>))}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-profile-container" ref={profileMenuRef}>
        {profileOpen && (
          <div
            className="profile-dropdown-menu"
            id="profile-dropdown-menu"
            role="menu"
            aria-label="User account menu"
          >
            <div className="profile-dropdown-header">
              <div className="profile-dropdown-user-info">
                <div className="profile-dropdown-avatar">
                  {(user?.name?.trim()?.[0] || state.name.trim()[0] || 'S').toUpperCase()}
                </div>
                <div className="profile-dropdown-meta">
                  <span className="profile-dropdown-name">{user?.name || state.name.trim() || 'Student'}</span>
                  <span className="profile-dropdown-email">{user?.email || 'student@skillpilot.test'}</span>
                </div>
              </div>
              <div className="profile-dropdown-badge-row">
                <span className="profile-dropdown-role-badge">
                  <GraduationCap size={12} />
                  <span>{(user?.role || 'student').toUpperCase()}</span>
                </span>
                <span className="profile-dropdown-status-badge">
                  <span className="status-dot-pulse" />
                  <span>{apiOnline ? 'Online' : 'Synced'}</span>
                </span>
              </div>
            </div>

            <div className="profile-dropdown-divider" role="separator" />

            <div className="profile-dropdown-items">
              <button
                type="button"
                className="profile-dropdown-item"
                role="menuitem"
                onClick={() => {
                  go('settings');
                  setProfileOpen(false);
                }}
              >
                <Settings size={15} />
                <span>Account Settings</span>
              </button>

              <button
                type="button"
                className="profile-dropdown-item"
                role="menuitem"
                onClick={() => {
                  go('passport');
                  setProfileOpen(false);
                }}
              >
                <Award size={15} />
                <span>Skill Passport</span>
              </button>

              <div className="profile-dropdown-divider" role="separator" />

              <button
                type="button"
                className="profile-dropdown-item logout-item"
                role="menuitem"
                onClick={async () => {
                  setProfileOpen(false);
                  await handleLogout();
                }}
              >
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          ref={triggerButtonRef}
          className={`side-profile side-profile-trigger ${profileOpen ? 'active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-controls="profile-dropdown-menu"
          aria-label="User account and profile menu"
          onClick={() => setProfileOpen((prev) => !prev)}
        >
          <div className="mini-avatar">{(user?.name?.trim()?.[0] || state.name.trim()[0] || 'S').toUpperCase()}</div>
          <div className="side-profile-text">
            <b>{user?.name || state.name.trim() || 'Student'}</b>
            <small>{careerGoal} · {(user?.role || 'student')}</small>
          </div>
          <ChevronUp
            size={16}
            className={`side-profile-chevron ${profileOpen ? 'open' : ''}`}
          />
        </button>
      </div>
    </aside>
    <main id="main-content" className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Close navigation' : 'Open navigation'}>{menu ? <X /> : <Menu />}</button>
        <div className="crumb"><span>SkillPilot</span><ChevronRight size={14}/><b>{NAV.find((n) => n[0] === view)?.[2]}</b></div>
        <div className="top-telemetry-badge">
          <span className="live-dot" />
          <span>SYS.ONLINE // PROD-2.4</span>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="cinema-trigger-btn"
            onClick={() => setReplayCinematic(true)}
            aria-label="Replay cinematic launch sequence"
            title="Launch theatrical entrance"
          >
            <Play size={11} fill="currentColor" />
            <span>CINEMA</span>
          </button>
          <button className="icon-button" aria-label="Notifications" onClick={() => setToast(actions[0] ? `Next: ${actions[0].title}` : 'Nothing pending.')}><Bell size={17}/></button>
        </div>
      </header>
      <div className="page">
        {view === 'today' && <Today state={state} actions={actions} go={go} onAction={onAction} onUndo={onUndoSaved} runAgent={runAgent} running={running} careerGoal={careerGoal} onOpenCalibration={() => setShowCalibration(true)} workflow={workflow} capabilityProfile={capabilityProfile} refreshProfile={refreshProfile}/>}
        {view === 'practice' && (
          <PracticeArena
            initialProblemSlug={focus}
            onGoToLearn={(id) => go('learn', id)}
            onRequestMentorReview={(problemTitle) => {
              go('mentors');
              setToast(`Requested mentor review for "${problemTitle}". Select an approved mentor to dispatch.`);
            }}
          />
        )}
        {view === 'learn' && (
          <LearnWorkspace
            initialLessonId={focus}
            go={go}
            onCompleted={async () => {
              await refreshProfile();
              setToast('Lesson progress recorded!');
            }}
          />
        )}
        {view === 'agent' && <AgentPanel state={state} onApprove={onApprove} onAudit={onAudit} workflow={workflow}/>}
        {view === 'projects' && (
          <ProjectWorkspace
            initialSlug={focus}
            onVerified={async () => {
              await refreshProfile();
              setToast('Project verified! Authentic evidence recorded in your passport ledger.');
            }}
            onAskAgent={() => {
              go('agent');
            }}
          />
        )}
        {view === 'roadmap' && <Roadmap state={state} actions={actions} go={go} workflow={workflow} onOpenCalibration={() => setShowCalibration(true)}/>}
        {view === 'skills' && <Skills state={state} go={go}/>}
        {view === 'assess' && <Assess key={round} evidence={state.evidence} focus={focus} careerGoal={careerGoal} onFinish={onFinish} onDone={() => go('roadmap')}/>}
        {view === 'mentors' && <Mentors state={state} onSend={onSend} selfId={user.id}/>}
        {view === 'interview' && <MockInterview onDone={() => { void refreshProfile().then(() => setToast('Practice evidence saved at reduced confidence.')).catch(() => undefined); }}/>} 
        {view === 'passport' && <Passport state={state} setName={async (name) => {
                setState((s) => ({ ...s, name }));
                try {
                    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                    if (!r.ok)
                        setToast('Could not save your name on the server.');
                }
                catch {
                    setToast('Could not save your name on the server.');
                }
            }} notify={setToast}/>}
        {view === 'settings' && <SettingsView state={state} onExport={exportData}/>}
      </div>
    </main>
    <nav className="mobile-bottom-bar" aria-label="Mobile quick navigation">
      <button
        type="button"
        className={`mobile-tab-item ${view === 'today' ? 'active' : ''}`}
        onClick={() => go('today')}
        aria-label="Home"
      >
        <LayoutDashboard size={20} />
        <span>Home</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'practice' ? 'active' : ''}`}
        onClick={() => go('practice')}
        aria-label="Practice"
      >
        <Terminal size={20} />
        <span>Practice</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'learn' ? 'active' : ''}`}
        onClick={() => go('learn')}
        aria-label="Learn"
      >
        <BookOpen size={20} />
        <span>Learn</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'mentors' ? 'active' : ''}`}
        onClick={() => go('mentors')}
        aria-label="Mentors"
      >
        <Users size={20} />
        <span>Mentors</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${menu ? 'active' : ''}`}
        onClick={() => setMenu((prev) => !prev)}
        aria-label="More navigation"
      >
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
    {showCalibration && view === 'today' && (
      <CapabilityOnboarding
        initialProfile={capabilityProfile ?? undefined}
        onSave={saveCalibration}
        onClose={() => setShowCalibration(false)}
        canDismiss={true}
      />
    )}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
