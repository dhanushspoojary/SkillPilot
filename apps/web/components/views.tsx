import { useEffect, useState } from 'react';
import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, CircleHelp, Compass, Crosshair, MessageCircle, Users, RefreshCcw, ShieldCheck, Sparkles, Target, Trophy, Zap, Download, Upload, RotateCcw, Share2, Copy, ExternalLink, Lock } from 'lucide-react';
import { STAGES, SKILLS, passportSummary, readiness, skillStates, stageProgress, type AppState, type PlanAction, } from '../lib/engine';
import { ProgressRing } from './ProgressRing';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';
import { PageIntro, Signal, SkillBar, VerifiedBadge } from './ui';
export type View = 'today' | 'agent' | 'roadmap' | 'skills' | 'assess' | 'mentors' | 'interview' | 'passport' | 'settings';
const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;
export function Today({ state, actions, go, onAction, onUndo, runAgent, running, careerGoal = 'Software Engineer', onOpenCalibration, workflow }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
    onAction: (a: PlanAction) => void;
    onUndo: (id: string) => void;
    runAgent: () => void;
    running: boolean;
    careerGoal?: string;
    onOpenCalibration?: () => void;
    workflow?: any;
}) {
    const skills = skillStates(state.evidence);
    const r = readiness(skills);
    const top = actions.slice(0, 3);
    const stagesProg = STAGES.map((s) => ({ ...s, progress: stageProgress(skills, s.skills) }));
    const currentStage = stagesProg.find((s) => s.progress < 90) ?? stagesProg[stagesProg.length - 1];

    const primaryAction = top[0];
    const wfAction = workflow?.nextRecommendedAction;
    const primaryTitle = wfAction?.title || (primaryAction ? primaryAction.title : 'Take Adaptive Baseline Assessment');
    const primaryReason = wfAction?.reason || (state.evidence.length === 0
      ? 'Calibrate your initial baseline across foundational software engineering competencies.'
      : primaryAction
        ? `Closing the gap in ${skillName(primaryAction.skill)} will yield the highest readiness impact.`
        : 'All targets for your current path are met. Retest periodically to maintain verified proof.');

    return <div className="today-dashboard">
    <section className="welcome dashboard-header">
      <div className="greeting-col">
        <div className="eyebrow"><span className="live-dot" /> PERSONAL CAREER SYSTEM</div>
        <h1>Know what to do <em>next.</em></h1>
        <p>SkillPilot measures verified evidence, maps skill gaps to your target role, and guides high-impact actions.</p>
      </div>
      <div className="goal-badge-wrap">
        <div className="goal-pill">
          <Target size={14} />
          <span>Target: <b>{careerGoal}</b></span>
        </div>
        {onOpenCalibration && (
          <button type="button" className="calibrate-btn" onClick={onOpenCalibration}>
            <Sparkles size={13} /> Calibrate background
          </button>
        )}
      </div>
    </section>

    <section className="priority-card">
      <div className="priority-copy">
        <div className="priority-eyebrow">
          <Zap size={14} /> RECOMMENDED NEXT STEP
        </div>
        <h2>{primaryTitle}</h2>
        <p>{primaryReason}</p>
      </div>
      <button
        className="primary priority-action-btn"
        onClick={() => go('assess', primaryAction?.skill)}
      >
        <Zap size={16} /> Start adaptive assessment
      </button>
    </section>

    <div className="dashboard-grid">
      <div className="panel-block">
        <div className="panel-head">
          <div>
            <span className="kicker">NEXT STEPS</span>
            <h3>High-Priority Learning Tasks</h3>
          </div>
          <button className="link" onClick={() => go('roadmap')}>
            See full plan <ArrowRight size={14} />
          </button>
        </div>
        <div className="action-stack task-list">
          {top.length === 0 && <p className="muted">Nothing left to do for this target role.</p>}
          {top.map((a, i) => (
            <button
              className="action-card task-row"
              key={a.id}
              onClick={() => onAction(a)}
              aria-label={`${a.title}. ${a.detail}`}
            >
              <span className="task-index">0{i + 1}</span>
              <span className="action-icon">
                {a.kind === 'PROVE' ? <Crosshair size={18} /> : a.kind === 'BUILD' ? <Zap size={18} /> : <MessageCircle size={18} />}
              </span>
              <span className="task-info">
                <b>{a.title}</b>
                <small>{a.detail} · ~15 mins · Prereq: None · {a.kind === 'PROVE' ? 'starts quiz' : 'mark complete'}</small>
              </span>
              <span className="task-impact">+{a.upTo}% readiness</span>
            </button>
          ))}
          {state.activity.length > 0 && (
            <div className="done-strip">
              <small>DONE THIS CYCLE</small>
              {state.activity.map((a) => (
                <span key={a.id}>
                  <Check size={13} /> {a.id.split(':')[0] === 'MENTOR' ? 'Mentor feedback' : skillName(a.skill)}{' '}
                  <button className="link" onClick={() => onUndo(a.id)}>Undo</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="agent-note" style={{ marginTop: '20px' }}>
          <div className="agent-icon"><BrainCircuit /></div>
          <span className="kicker">DETERMINISTIC CAREER INTELLIGENCE · VERIFIED SERVER EVIDENCE</span>
          <h3>{state.planNote}</h3>
          <p>Recommendations are derived strictly from your verified evidence using deterministic rules. The agent proposes actions; it cannot invent scores.</p>
          <button onClick={runAgent} disabled={running}>
            {running ? <><RefreshCcw className="spin" size={14} /> Re-evaluating…</> : <>Re-evaluate my plan <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      <div className="dashboard-sidebar-col">
        <div className="panel-block">
          <div className="panel-head">
            <h3>Career Readiness</h3>
            <span className="badge-cyan">{state.evidence.length} evidence</span>
          </div>
          <div className="readiness" style={{ marginBottom: '16px' }}>
            <ProgressRing value={r} />
            <div className="readiness-copy">
              <small>COMPUTED READINESS</small>
              <b>{r}%</b>
              <span>{skills.filter((s) => s.verified).length} of {skills.length} verified</span>
            </div>
          </div>

          <div className="panel-head" style={{ marginTop: '20px', marginBottom: '10px' }}>
            <div>
              <span className="kicker">COMPACT ROADMAP</span>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF' }}>Current: {currentStage.name}</h4>
            </div>
            <button className="link" onClick={() => go('roadmap')}>Roadmap <ArrowRight size={12} /></button>
          </div>
          <div className="compact-roadmap">
            {stagesProg.map((st) => (
              <div key={st.n} className="stage-item">
                <div className="stage-label">
                  <span>Phase {st.n}: <b>{st.name}</b></span>
                  <span>{st.progress}%</span>
                </div>
                <div className="stage-bar-track">
                  <div className="stage-bar-fill" style={{ width: `${st.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-head">
            <div>
              <span className="kicker">VERIFIED SKILLS</span>
              <h3>Truthful Skill Status</h3>
            </div>
            <button className="link" onClick={() => go('skills')}>
              Graph <ArrowRight size={12} />
            </button>
          </div>
          <div className="skill-pills-list">
            {skills.map((s) => (
              <div key={s.def.id} className="skill-row-compact">
                <div className="skill-title-area">
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF' }}>{s.def.name}</span>
                  <span className={`skill-status-tag ${s.status}`}>
                    {s.statusLabel}
                  </span>
                </div>
                <b style={{ fontSize: '13px', color: s.count > 0 ? '#00F0FF' : 'var(--text-secondary)' }}>
                  {s.count > 0 ? `${s.score}%` : '—'}
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
export function Roadmap({ state, actions, go, workflow }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
    workflow?: any;
}) {
    const skills = skillStates(state.evidence);
    const prog = STAGES.map((s) => stageProgress(skills, s.skills));
    const current = prog.findIndex((p) => p < 90);
    const top = actions[0];
    const isLocked = Boolean(workflow?.featuresLocked?.roadmap);

    return <div className="wide">
    <PageIntro kicker="LIVING ROADMAP" title="A plan that moves when you do." text="Stage progress is computed from the skills each stage needs. New evidence can change the plan without losing your history."/>

    {isLocked && (
      <div style={{ background: 'var(--surface-navy)', border: '1px solid var(--cyan-border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan)', marginBottom: 8 }}>
          <Sparkles size={18} />
          <b style={{ fontSize: 13, letterSpacing: '0.05em' }}>CALIBRATION REQUIRED TO UNLOCK ROADMAP</b>
        </div>
        <h3 style={{ fontSize: 20, color: '#FFFFFF', margin: '0 0 8px 0' }}>Personalized Roadmap Calibration Pending</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 18px 0', lineHeight: 1.5, maxWidth: 640 }}>
          {workflow?.featuresLocked?.roadmapReason || 'Your step-by-step career roadmap is personalized to your confirmed skill baseline. Complete your initial diagnostic assessment to unlock your roadmap.'}
        </p>
        <button
          className="primary"
          onClick={() => go('assess')}
          style={{ minHeight: 40, padding: '0 20px', fontSize: 13 }}
        >
          {workflow?.stage === 'SKILL_BASELINE_REVIEW' || workflow?.stage === 'SKILLS_CONFIRMED'
            ? 'Review & Confirm Skill Baseline'
            : 'Start Diagnostic Assessment'}
          <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </button>
      </div>
    )}

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
        <div className="tile-top"><span>{s.def.name}</span><b>{s.count > 0 ? `${s.score}%` : 'Unassessed'}</b></div>
        <div className="bar" role="img" aria-label={`${s.def.name} ${s.score} percent`}><i style={{ width: `${s.score}%` }}/></div>
        <div className="tile-meta"><span><VerifiedBadge verified={s.verified}/></span><span className={`skill-status-tag ${s.status}`}>{s.statusLabel}</span><span>{s.count} evidence</span></div>
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
    const [share, setShare] = useState<{ shareToken: string; url: string; viewsCount: number } | null>(null);
    const [loadingShare, setLoadingShare] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch('/api/passport/share', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d.share) setShare(d.share); })
            .catch(() => {});
    }, []);

    const generateShareLink = async () => {
        setLoadingShare(true);
        try {
            const r = await fetch('/api/passport/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const d = await r.json();
            if (d.share) {
                setShare(d.share);
                notify('Public verification link generated!');
            }
        } catch {
            notify('Could not generate verification link.');
        } finally {
            setLoadingShare(false);
        }
    };

    const revokeShareLink = async () => {
        if (!share) return;
        try {
            await fetch('/api/passport/share', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareToken: share.shareToken }),
            });
            setShare(null);
            notify('Passport link revoked. Public access removed.');
        } catch {
            notify('Could not revoke link.');
        }
    };

    const copyShareUrl = async () => {
        if (!share) return;
        const fullUrl = `${window.location.origin}${share.url}`;
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            notify('Passport link copied to clipboard!');
            setTimeout(() => setCopied(false), 2500);
        } catch {
            notify('Copy was blocked by the browser.');
        }
    };

    const copyTextSummary = async () => {
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

    {/* Share Management Section */}
    <div className="passport-share-box">
      <div className="share-box-head">
        <h4><Share2 size={15} /> Public Verified Card</h4>
        {share && <span className="auth-hash" style={{ fontSize: '11px', color: 'var(--cyan)' }}>{share.viewsCount} view{share.viewsCount === 1 ? '' : 's'}</span>}
      </div>

      {share ? (
        <>
          <div className="share-url-row">
            <input
              type="text"
              readOnly
              className="share-url-input"
              value={typeof window !== 'undefined' ? `${window.location.origin}${share.url}` : share.url}
              aria-label="Public passport link"
            />
            <button type="button" className="btn-sm-action primary" onClick={copyShareUrl}>
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="share-actions">
            <a href={share.url} target="_blank" rel="noopener noreferrer" className="btn-sm-action ghost">
              <ExternalLink size={13} /> View Public Card
            </a>
            <button type="button" className="btn-sm-action danger" onClick={revokeShareLink}>
              <Lock size={13} /> Revoke Link
            </button>
          </div>
        </>
      ) : (
        <div className="share-actions">
          <button type="button" className="btn-sm-action primary" onClick={generateShareLink} disabled={loadingShare}>
            <Share2 size={13} /> {loadingShare ? 'Generating…' : 'Generate Public Verification Link'}
          </button>
        </div>
      )}
    </div>

    <div className="passport-stats">
      <div><b>{skills.length}</b><span>skills tracked</span></div>
      <div><b>{skills.filter((s) => s.verified).length}</b><span>verified</span></div>
      <div><b>{state.evidence.length}</b><span>evidence items</span></div>
      <div><b>{recent.length}</b><span>new this cycle</span></div>
    </div>

    <div className="proof-list">
      {skills.map((s) => (
        <div key={s.def.id}>
          <span>
            <CheckCircle2 size={15} /> {s.def.name}
            <small>{s.statusLabel} · {s.count} evidence</small>
          </span>
          <em>{s.count > 0 ? `${s.score}%` : '—'}</em>
        </div>
      ))}
    </div>

    <button className="primary" onClick={copyTextSummary}><Award size={15}/> Copy passport summary</button>
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
