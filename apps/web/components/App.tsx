'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, Bell, CheckCircle2, ChevronRight, ChevronUp, LayoutDashboard, Activity, Gauge, Crosshair, Users, Award, Menu, X, Settings, Mic, Code2, LogOut, GraduationCap, Play, BookOpen, Terminal, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
import { IncomingCallDialog, type ActiveCallData } from './IncomingCallDialog';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
interface NavItem {
    id: View;
    num: string;
    label: string;
    icon: typeof Gauge;
}

interface NavGroup {
    groupTitle: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        groupTitle: 'DASHBOARD',
        items: [
            { id: 'today', num: '01', label: 'Today', icon: LayoutDashboard },
        ],
    },
    {
        groupTitle: 'LEARNING',
        items: [
            { id: 'learn', num: '02', label: 'Learn', icon: BookOpen },
            { id: 'practice', num: '03', label: 'Practice', icon: Terminal },
            { id: 'skills', num: '04', label: 'Skills', icon: Gauge },
            { id: 'assess', num: '05', label: 'Assess', icon: Crosshair },
        ],
    },
    {
        groupTitle: 'CAREER',
        items: [
            { id: 'roadmap', num: '06', label: 'Roadmap', icon: Activity },
            { id: 'projects', num: '07', label: 'Projects', icon: Code2 },
        ],
    },
    {
        groupTitle: 'INTERVIEWS',
        items: [
            { id: 'interview', num: '08', label: 'Mock Interview', icon: Mic },
            { id: 'mentors', num: '09', label: 'Mentors', icon: Users },
        ],
    },
];

const PROFILE_NAV_ITEMS: NavItem[] = [
    { id: 'agent', num: '10', label: 'AI Agent', icon: BrainCircuit },
    { id: 'passport', num: '11', label: 'Skill Passport', icon: Award },
    { id: 'settings', num: '12', label: 'Account Settings', icon: Settings },
];

const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), ...PROFILE_NAV_ITEMS];

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
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            try {
                return localStorage.getItem('skillpilot_sidebar_collapsed') === 'true';
            } catch {}
        }
        return false;
    });
    const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);
    const nameDebounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
        };
    }, []);

    // In-app incoming call detection: poll for active calls scoped to the student
    useEffect(() => {
        let stopped = false;
        async function pollActiveCall() {
            if (typeof document !== 'undefined' && document.hidden) return;
            try {
                const res = await fetch('/api/mentor-requests/call/active', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (stopped) return;
                if (data.activeCall && data.activeCall.status === 'ringing') {
                    setActiveCall(data.activeCall);
                } else if (!data.activeCall && activeCall) {
                    setActiveCall(null);
                }
            } catch {
                // Ignore transient network failures
            }
        }

        void pollActiveCall();
        const timer = window.setInterval(pollActiveCall, 3500);
        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [activeCall]);

    const toggleSidebar = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('skillpilot_sidebar_collapsed', String(next));
            } catch {}
            return next;
        });
    };

    const handleLogout = async () => {
        setProfileOpen(false);
        setToast('');
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

    // Handle mobile menu drawer backdrop escape dismissal and background scroll lock
    useEffect(() => {
        if (!menu) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenu(false);
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menu]);
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
                if (!cancelled && view !== 'assess') {
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
                } else if (x.capabilityProfile) {
                    setCapabilityProfile(x.capabilityProfile);
                    if (x.workflow) setWorkflow(x.workflow);
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
        setShowCalibration(false);
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
        setState((s) => toggleActivity(s, a, new Date().toISOString(), careerGoal, capabilityProfile));
        persistActivity(a.id, true);
        setToast(a.kind === 'BUILD' ? 'Marked done. Retest to turn the work into evidence.' : 'Marked done.');
    };
    const onUndo = (id: string) => setState((s) => {
        const item = s.activity.find((a) => a.id === id);
        return item ? toggleActivity(s, item, new Date().toISOString(), careerGoal, capabilityProfile) : s;
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
            setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
    {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${menu ? 'mobile-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span className={`brand-title ${sidebarCollapsed ? 'sr-only' : ''}`}>SkillPilot</span>
        {menu ? (
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMenu(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>
      <div className={`side-label ${sidebarCollapsed ? 'sr-only' : ''}`}>CAREER INTELLIGENCE SYSTEM</div>
      <nav aria-label="Main navigation">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={group.groupTitle} className="nav-group">
            <div className={`nav-group-title ${sidebarCollapsed ? 'sr-only' : ''}`}>{group.groupTitle}</div>
            {sidebarCollapsed && gIdx > 0 && <div className="nav-group-divider" aria-hidden="true" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isActive ? 'nav-item active' : 'nav-item'}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  onClick={() => {
                    go(item.id);
                    if (menu) setMenu(false);
                  }}
                  title={sidebarCollapsed ? `${item.num}. ${item.label}` : undefined}
                  data-tooltip={item.label}
                >
                  <span className="nav-index" aria-hidden="true">{item.num}</span>
                  <Icon size={17} aria-hidden="true" />
                  <span className={`nav-label ${sidebarCollapsed ? 'sr-only' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
        {menu && (
          <div className="nav-group mobile-system-group">
            <div className="nav-group-title">SYSTEM & PROFILE</div>
            {PROFILE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isActive ? 'nav-item active' : 'nav-item'}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    go(item.id);
                    setMenu(false);
                  }}
                  data-tooltip={item.label}
                >
                  <span className="nav-index">{item.num}</span>
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

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
                  go('agent');
                  setProfileOpen(false);
                }}
              >
                <BrainCircuit size={15} />
                <span>AI Career Agent</span>
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
          aria-label={`User account and profile menu: ${user?.name || state.name.trim() || 'Student'}`}
          title={sidebarCollapsed ? `${user?.name || state.name.trim() || 'Student'} (${user?.role || 'student'})` : undefined}
          onClick={() => setProfileOpen((prev) => !prev)}
        >
          <div className="mini-avatar" aria-hidden="true">{(user?.name?.trim()?.[0] || state.name.trim()[0] || 'S').toUpperCase()}</div>
          <div className={`side-profile-text ${sidebarCollapsed ? 'sr-only' : ''}`}>
            <b>{user?.name || state.name.trim() || 'Student'}</b>
            <small>{careerGoal} · {(user?.role || 'student')}</small>
          </div>
          <ChevronUp
            size={16}
            className={`side-profile-chevron ${profileOpen ? 'open' : ''} ${sidebarCollapsed ? 'sr-only' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
    <main id="main-content" className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Close navigation' : 'Open navigation'}>{menu ? <X /> : <Menu />}</button>
        <div className="crumb"><span>SkillPilot</span><ChevronRight size={14}/><b>{ALL_NAV_ITEMS.find((n) => n.id === view)?.label}</b></div>
        <div className="top-actions">
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
              setToast('Lesson progress recorded.');
            }}
          />
        )}
        {view === 'agent' && <AgentPanel state={state} onApprove={onApprove} onAudit={onAudit} workflow={workflow}/>}
        {view === 'projects' && (
          <ProjectWorkspace
            initialSlug={focus}
            onVerified={async () => {
              await refreshProfile();
              setToast('Project verified. Authentic evidence recorded in your passport ledger.');
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
        {view === 'passport' && <Passport state={state} careerGoal={careerGoal} setName={(name) => {
                setState((s) => ({ ...s, name }));
                if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
                nameDebounceRef.current = setTimeout(async () => {
                    try {
                        const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                        if (!r.ok)
                            setToast('Could not save your name on the server.');
                    }
                    catch {
                        setToast('Could not save your name on the server.');
                    }
                }, 500);
            }} notify={setToast}/>}
        {view === 'settings' && (
          <SettingsView
            state={state}
            user={user}
            capabilityProfile={capabilityProfile}
            careerGoal={careerGoal}
            onExport={exportData}
            onLogout={handleLogout}
            onRefresh={refreshProfile}
          />
        )}
      </div>
    </main>
    <nav className="mobile-bottom-bar" aria-label="Mobile quick navigation">
      <button
        type="button"
        className={`mobile-tab-item ${view === 'today' ? 'active' : ''}`}
        aria-current={view === 'today' ? 'page' : undefined}
        onClick={() => go('today')}
        aria-label="Home"
      >
        <LayoutDashboard size={20} />
        <span>Home</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'assess' ? 'active' : ''}`}
        aria-current={view === 'assess' ? 'page' : undefined}
        onClick={() => go('assess')}
        aria-label="Assess"
      >
        <Crosshair size={20} />
        <span>Assess</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'learn' ? 'active' : ''}`}
        aria-current={view === 'learn' ? 'page' : undefined}
        onClick={() => go('learn')}
        aria-label="Learn"
      >
        <BookOpen size={20} />
        <span>Learn</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${view === 'practice' ? 'active' : ''}`}
        aria-current={view === 'practice' ? 'page' : undefined}
        onClick={() => go('practice')}
        aria-label="Practice"
      >
        <Terminal size={20} />
        <span>Practice</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-item ${menu ? 'active' : ''}`}
        onClick={() => setMenu((prev) => !prev)}
        aria-label="More navigation"
        aria-expanded={menu}
        aria-haspopup="dialog"
      >
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
    {showCalibration && view !== 'assess' && (
      <CapabilityOnboarding
        initialProfile={capabilityProfile ?? undefined}
        onSave={saveCalibration}
        onClose={() => setShowCalibration(false)}
        canDismiss={true}
        onStartDiagnostic={() => {
          setShowCalibration(false);
          go('assess');
        }}
        onNavigateToRoadmap={() => {
          setShowCalibration(false);
          go('roadmap');
        }}
      />
    )}
    {activeCall && (
      <IncomingCallDialog
        call={activeCall}
        onDismiss={() => setActiveCall(null)}
      />
    )}
    {toast && (
      <div className="toast" role="status" aria-live="polite">
        <CheckCircle2 size={17} />
        <span>{toast}</span>
        <button type="button" className="toast-dismiss" onClick={() => setToast('')} aria-label="Dismiss notification">✕</button>
      </div>
    )}
  </div>;
}
