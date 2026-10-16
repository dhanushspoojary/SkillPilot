import { useEffect, useState } from 'react';
import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, CircleHelp, Compass, Crosshair, MessageCircle, Users, RefreshCcw, ShieldCheck, Sparkles, Target, Trophy, Zap, Download, Upload, RotateCcw, } from 'lucide-react';
import { STAGES, SKILLS, passportSummary, readiness, skillStates, stageProgress, type AppState, type PlanAction, } from '../lib/engine';
import { ProgressRing } from './ProgressRing';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';
import { PageIntro, Signal, SkillBar, VerifiedBadge } from './ui';
export type View = 'today' | 'agent' | 'roadmap' | 'skills' | 'assess' | 'mentors' | 'interview' | 'passport' | 'settings';
const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;
export function Today({ state, actions, go, onAction, onUndo, runAgent, running }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
    onAction: (a: PlanAction) => void;
    onUndo: (id: string) => void;
    runAgent: () => void;
    running: boolean;
}) {
    const skills = skillStates(state.evidence);
    const r = readiness(skills);
    const top = actions.slice(0, 3);
    return <>
    <section className="welcome">
      <div>
        <div className="eyebrow"><span className="live-dot"/> PERSONAL CAREER SYSTEM</div>
        <h1>Know what to do <em>next.</em></h1>
        <p>SkillPilot measures what you can prove, finds the gap to your target role, and turns it into a small set of actions.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => go('assess')}><Zap size={16}/> Start adaptive assessment</button>
          <button className="ghost" onClick={() => go('roadmap')}>Open roadmap <ArrowRight size={15}/></button>
        </div>
      </div>
      <div className="readiness"><ProgressRing value={r}/><div className="readiness-copy"><small>CAREER READINESS</small><b>{r}%</b><span>Computed from evidence</span></div></div>
    </section>
    <div className="signal-row">
      <Signal icon={<Target />} label="Target" value="Software Engineer" note={`${skills.length} skills tracked`}/>
      <Signal icon={<Compass />} label="Top gap" value={top[0] ? skillName(top[0].skill) : 'None'} note="largest weighted gap"/>
      <Signal icon={<Trophy />} label="Evidence" value={`${state.evidence.length} signals`} note="stored on the server"/>
      <Signal icon={<ShieldCheck />} label="Verified" value={`${skills.filter((s) => s.verified).length} of ${skills.length}`} note="3+ signals, 2+ source types"/>
    </div>
    <section className="section-block">
      <div className="section-title"><div><span className="kicker">TODAY</span><h2>Your next moves.</h2></div><button className="link" onClick={() => go('roadmap')}>See full plan <ArrowRight size={14}/></button></div>
      <div className="today-grid">
        <div className="action-stack">
          {top.length === 0 && <p className="muted">Nothing left to do for this target role.</p>}
          {top.map((a, i) => (<button className="action-card" key={a.id} onClick={() => onAction(a)} aria-label={`${a.title}. ${a.detail}`}>
              <span className="number">0{i + 1}</span>
              <span className="action-icon">{a.kind === 'PROVE' ? <Crosshair /> : a.kind === 'BUILD' ? <Zap /> : <MessageCircle />}</span>
              <span className="action-copy"><b>{a.title}</b><small>{a.detail} · {a.kind === 'PROVE' ? 'opens assessment' : 'mark done when finished'}</small></span>
              <span className="impact">up to +{a.upTo}</span>
            </button>))}
          {state.activity.length > 0 && <div className="done-strip"><small>DONE THIS CYCLE</small>{state.activity.map((a) => <span key={a.id}><Check size={13}/> {a.id.split(':')[0] === 'MENTOR' ? 'Mentor feedback' : skillName(a.skill)} <button className="link" onClick={() => onUndo(a.id)}>Undo</button></span>)}</div>}
        </div>
        <div className="agent-note">
          <div className="agent-icon"><BrainCircuit /></div><span className="kicker">CAREER AGENT · DETERMINISTIC</span>
          <h3>{state.planNote}</h3>
          <p>Recommendations come from your evidence with fixed rules. The agent can propose and reorder work; it cannot invent scores or send anything without your approval.</p>
          <button onClick={runAgent} disabled={running}>{running ? <><RefreshCcw className="spin" size={14}/> Re-evaluating…</> : <>Re-evaluate my plan <ArrowRight size={14}/></>}</button>
        </div>
      </div>
    </section>
    <section className="section-block split">
      <div><div className="section-title"><div><span className="kicker">SKILL SIGNAL</span><h2>Proof, not just percentages.</h2></div><button className="link" onClick={() => go('skills')}>Skill graph <ArrowRight size={14}/></button></div>
        <div className="skill-list">{[...skills].sort((a, b) => b.gap - a.gap).slice(0, 4).map((s) => <SkillBar key={s.def.id} s={s}/>)}</div></div>
      <div className="career-card"><span className="kicker">TARGET ROLE</span><h3>Software Engineer</h3>
        <p>{top[0] ? `${skillName(top[0].skill)} is the current bottleneck.` : 'All targets are met.'} Closing it moves readiness the most.</p>
        <div className="mini-track"><i style={{ width: `${r}%` }}/></div><small>{r}% of the target profile demonstrated</small>
        <button onClick={() => go('passport')}>View career proof <ArrowRight size={14}/></button></div>
    </section>
  </>;
}
export function Roadmap({ state, actions, go }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
}) {
    const skills = skillStates(state.evidence);
    const prog = STAGES.map((s) => stageProgress(skills, s.skills));
    const current = prog.findIndex((p) => p < 90);
    const top = actions[0];
    return <div className="wide">
    <PageIntro kicker="LIVING ROADMAP" title="A plan that moves when you do." text="Stage progress is computed from the skills each stage needs. New evidence can change the plan without losing your history."/>
    <div className="roadmap-meta"><span><b>12 weeks</b> current cycle</span><span><b>{readiness(skills)}%</b> readiness</span><span><b>{actions.length}</b> open actions</span></div>
    <div className="roadmap-list">{STAGES.map((s, i) => (<div className={i === current ? 'roadmap-row current' : 'roadmap-row'} key={s.n}>
        <span className="road-num">{s.n}</span><div><small>{s.weeks}</small><h3>{s.name}</h3><p>{s.blurb}</p></div>
        <div className="road-progress"><b>{prog[i]}%</b><div><i style={{ width: `${prog[i]}%` }}/></div></div>
      </div>))}</div>
    <div className="agent-wide"><Sparkles /><div><span className="kicker">WHY THE PLAN LOOKS LIKE THIS</span><h3>{top ? top.title : 'Plan complete'}</h3><p>{state.planNote}</p></div>
      {top && <button className="ghost" onClick={() => go(top.route === 'assess' ? 'assess' : 'today', top.route === 'assess' ? top.skill : undefined)}>{top.route === 'assess' ? 'Start retest' : 'Go to today'} <ArrowRight size={14}/></button>}</div>
  </div>;
}
export function Skills({ state }: {
    state: AppState;
}) {
    const skills = skillStates(state.evidence);
    return <div className="wide">
    <PageIntro kicker="SKILL GRAPH" title="Know what you can prove." text="Scores are signals. A skill is verified only with 3+ evidence items from at least two source types."/>
    <div className="skills-grid">{skills.map((s) => (<div className="skill-tile" key={s.def.id}>
        <div className="tile-top"><span>{s.def.name}</span><b>{s.score}%</b></div>
        <div className="bar" role="img" aria-label={`${s.def.name} ${s.score} percent`}><i style={{ width: `${s.score}%` }}/></div>
        <div className="tile-meta"><span><VerifiedBadge verified={s.verified}/></span><span>{s.count} evidence</span></div>
        <small>Target {s.def.target}% · sources: {s.kinds.join(', ') || 'none'}</small>
      </div>))}</div>
    <div className="skill-principle"><CircleHelp /><div><b>Skill confidence is not a self-claim.</b><p>Quiz results carry less weight than projects or mentor review, so one lucky test cannot permanently inflate a profile.</p></div></div>
  </div>;
}
export function Mentors({ state, onSend, selfId }: {
    state: AppState;
    onSend: (mentorId: string, message: string) => void;
    selfId: string;
}) {
    const [mentors, setMentors] = useState<any[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => { fetch('/api/mentors', { cache: 'no-store' }).then(r => r.json()).then(x => setMentors(x.mentors || [])).catch(() => setMentors([])).finally(() => setLoading(false)); }, []);
    return <div className="wide">
    <PageIntro kicker="MENTOR NETWORK" title="Real mentors, not placeholders." text="Only mentors who created an account and were approved by SkillPilot admins appear here. Your request is stored server-side; a mentor review can become verified evidence."/>
    {loading ? <div className="empty-state"><p>Finding approved mentors…</p></div> : mentors.length === 0 ? <div className="empty-state"><UsersIcon /><b>No approved mentors yet.</b><p>That is intentional. SkillPilot never seeds fake mentors. Invite real mentors to sign up and have an admin approve them.</p></div> : <div className="mentor-grid">{mentors.map((m: any, i: number) => { const sent = state.requests.find(r => r.mentorId === m.id); return <div className={i === 0 ? 'mentor-card top' : 'mentor-card'} key={m.id}><div className="mentor-avatar">{m.name.split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase()}</div><span className="match">APPROVED</span><h3>{m.name}</h3><b>{m.focus || 'Career mentor'}</b>{m.bio && <p className="muted">{m.bio}</p>}{sent ? <><p className="sent"><CheckCircle2 size={13}/> Request recorded on the server.</p>{sent.status === 'accepted' && <><MeetingLink requestId={sent.id} canEdit={false}/><ChatPanel requestId={sent.id} selfId={selfId}/></>}</> : open === m.id ? <div className="draft"><label htmlFor={`m-${m.id}`}>Review and edit your message</label><textarea id={`m-${m.id}`} value={text} onChange={e => setText(e.target.value)} rows={5}/><div className="draft-actions"><button className="primary" onClick={() => { onSend(m.id, text); setOpen(null); }}>Send request</button><button className="ghost" onClick={() => setOpen(null)}>Cancel</button></div></div> : <button className="link" onClick={() => { setText(`Hi ${m.name}, I’m working on my career path and would value your feedback on my current skills and next steps.`); setOpen(m.id); }}>Request mentorship <ArrowRight size={13}/></button>}</div>; })}</div>}
  </div>;
}
function UsersIcon() { return <Users size={24}/>; }
export function Passport({ state, setName, notify }: {
    state: AppState;
    setName: (n: string) => void;
    notify: (m: string) => void;
}) {
    const skills = skillStates(state.evidence);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(passportSummary(state.name, state.evidence));
            notify('Summary copied. You decide where to paste it.');
        }
        catch {
            notify('Copy was blocked by the browser.');
        }
    };
    const recent = [...state.evidence].filter((e) => !e.id.startsWith('seed-')).slice(-4).reverse();
    return <div className="passport">
    <div className="passport-top"><div><span className="kicker">SKILL PASSPORT</span>
      <label className="sr-only" htmlFor="pname">Your name</label>
      <input id="pname" className="name-input" value={state.name} placeholder="Add your name" maxLength={60} onChange={(e) => setName(e.target.value)}/>
      <p>Software Engineer pathway · private until you choose to share it</p></div>
      <div className="passport-score"><strong>{readiness(skills)}%</strong><span>READINESS</span></div></div>
    <div className="passport-stats"><div><b>{skills.length}</b><span>skills tracked</span></div><div><b>{skills.filter((s) => s.verified).length}</b><span>verified</span></div><div><b>{state.evidence.length}</b><span>evidence items</span></div><div><b>{recent.length}</b><span>new this cycle</span></div></div>
    <div className="proof-list">{skills.map((s) => <div key={s.def.id}><span><CheckCircle2 size={15}/>{s.def.name}<small>{s.verified ? 'verified' : 'in progress'} · {s.count} evidence</small></span><em>{s.score}%</em></div>)}</div>
    <button className="primary" onClick={copy}><Award size={15}/> Copy passport summary</button>
  </div>;
}
export function SettingsView({ state, onExport }: {
    state: AppState;
    onExport: () => void;
}) {
    const [showAudit, setShowAudit] = useState(false);
    return <div className="wide">
    <PageIntro kicker="ACCOUNT & TRUST" title="Your proof stays server-owned." text="SkillPilot uses your account as the identity boundary. Scores, assessments and mentor evidence are stored on the server; browser storage is only a presentation cache."/>
    <div className="settings-grid">
      <section className="settings-card"><div className="section-title"><div><span className="kicker">DATA EXPORT</span><h2>Take your data with you</h2></div><Download size={20}/></div><p className="muted">Export the latest server profile as JSON. This is a copy of your account data, not a way to forge evidence.</p><div className="settings-actions"><button className="primary" onClick={onExport}>Export account data</button></div></section>
      <section className="settings-card"><div className="section-title"><div><span className="kicker">ACCOUNT</span><h2>Delete your account</h2></div></div><p className="muted">This permanently removes your account and associated server data. You must confirm your current password.</p><button className="ghost" onClick={async () => {
            const password = window.prompt("Enter your current password to permanently delete your account");
            if (!password)
                return;
            const r = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
            const x = await r.json();
            if (!r.ok) {
                window.alert(x.error || "Could not delete account");
                return;
            }
            window.location.href = "/";
        }}>Delete account</button></section><section className="settings-card"><div className="section-title"><div><span className="kicker">AGENT AUDIT</span><h2>What the agent did</h2></div><ShieldCheck size={20}/></div><p className="muted">{state.agentRuns.length} recent agent run{state.agentRuns.length === 1 ? '' : 's'} recorded. The agent can read evidence and propose actions, but it cannot create evidence or approve itself.</p><button className="link" onClick={() => setShowAudit(v => !v)}>{showAudit ? 'Hide audit' : 'View audit'}</button>{showAudit && <div className="audit-list">{state.agentRuns.slice().reverse().map((r) => <div className="audit-row" key={r.id}><b>{r.mode === 'ai' ? 'AI' : 'Fallback'}</b><span>{new Date(r.at).toLocaleString()}</span><p>{r.question}</p><small>{r.proposalCount} proposal{r.proposalCount === 1 ? '' : 's'} · evidence {r.evidenceVersion}{r.model ? ` · ${r.model}` : ''}{r.fallbackReason ? ` · ${r.fallbackReason}` : ''}</small></div>)}{state.agentRuns.length === 0 && <p className="muted">No agent runs yet.</p>}</div>}</section>
    </div>
  </div>;
}
