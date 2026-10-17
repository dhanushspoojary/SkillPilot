'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Bell, CheckCircle2, ChevronRight, LayoutDashboard, Activity, Gauge, Crosshair, Users, Award, Menu, X, Settings, Mic } from 'lucide-react';
import { defaultState, explainPlan, planActions, toggleActivity, type AppState, type PlanAction, } from '../lib/engine';
import { Assess } from './Assess';
import { AgentPanel } from './AgentPanel';
import type { Proposal } from '../lib/agent';
import { Mentors, Passport, Roadmap, Skills, Today, SettingsView, type View } from './views';
import { MockInterview } from './MockInterview';
import { CapabilityOnboarding } from './CapabilityOnboarding';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
const NAV: [
    View,
    string,
    typeof Gauge
][] = [
    ['today', 'Today', LayoutDashboard], ['agent', 'Agent', BrainCircuit], ['roadmap', 'Roadmap', Activity], ['skills', 'Skills', Gauge],
    ['assess', 'Assess', Crosshair], ['mentors', 'Mentors', Users], ['interview', 'Mock interview', Mic], ['passport', 'Passport', Award], ['settings', 'Settings', Settings],
];
export function App({ user }: {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
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
                if (x.capabilityProfile)
                    setCapabilityProfile(x.capabilityProfile);
                if (x.workflow)
                    setWorkflow(x.workflow);
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
    const actions = useMemo(() => planActions(state), [state]);
    const go = useCallback((v: View, f?: string) => {
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
        setState(s => { const next = { ...s, name: x.user?.name ?? s.name, evidence: x.evidence ?? s.evidence, requests: x.requests ?? s.requests, agentRuns: x.agentRuns ?? s.agentRuns }; return { ...next, planNote: explainPlan(next) }; });
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
    <aside className={menu ? 'sidebar mobile-open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">S</span><span>SkillPilot</span></div>
      <div className="side-label">CAREER SYSTEM</div>
      <nav aria-label="Main navigation">{NAV.map(([id, label, Icon]) => (<button key={id} className={view === id ? 'nav-item active' : 'nav-item'} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={17}/><span>{label}</span></button>))}</nav>
      <div className="sidebar-spacer"/>
      <div className="side-profile"><div className="mini-avatar">{(state.name.trim()[0] ?? 'S').toUpperCase()}</div>
        <div><b>{state.name.trim() || 'Student'}</b><small>Software Engineer path · API {apiOnline === null ? 'unchecked' : apiOnline ? 'reachable' : 'offline'} · {syncStatus === 'off' ? 'Local only' : `Server ${syncStatus}`}</small></div><ChevronRight size={15}/></div>
    </aside>
    <main id="main-content" className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Close navigation' : 'Open navigation'}>{menu ? <X /> : <Menu />}</button>
        <div className="crumb"><span>SkillPilot</span><ChevronRight size={14}/><b>{NAV.find((n) => n[0] === view)?.[1]}</b></div>
        <div className="top-actions"><button className="icon-button" aria-label="Notifications" onClick={() => setToast(actions[0] ? `Next: ${actions[0].title}` : 'Nothing pending.')}><Bell size={17}/></button></div>
      </header>
      <div className="page">
        {view === 'today' && <Today state={state} actions={actions} go={go} onAction={onAction} onUndo={onUndoSaved} runAgent={runAgent} running={running} careerGoal={careerGoal} onOpenCalibration={() => setShowCalibration(true)} workflow={workflow}/>}
        {view === 'agent' && <AgentPanel state={state} onApprove={onApprove} onAudit={onAudit} workflow={workflow}/>}
        {view === 'roadmap' && <Roadmap state={state} actions={actions} go={go} workflow={workflow}/>}
        {view === 'skills' && <Skills state={state}/>}
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
    {showCalibration && (
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
