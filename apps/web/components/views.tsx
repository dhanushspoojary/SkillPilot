import { useEffect, useState, useMemo } from 'react';
import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, CircleHelp, Compass, Crosshair, MessageCircle, Users, RefreshCcw, ShieldCheck, Sparkles, Target, Trophy, Zap, Download, Upload, RotateCcw, Share2, Copy, ExternalLink, Lock, Send, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { STAGES, SKILLS, passportSummary, readiness, skillStates, stageProgress, type AppState, type PlanAction, } from '../lib/engine';
import { ProgressRing } from './ProgressRing';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';
import { PageIntro, Signal, SkillBar, VerifiedBadge } from './ui';
import { AnimatedMarquee, ConnectedSkillNetwork, ScrollReveal, GuidedJourneyProgress, type JourneyStageConfig } from './motion';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import { extractClaimedSkills } from '../lib/assessment-planner';
export type View = 'today' | 'agent' | 'projects' | 'roadmap' | 'skills' | 'assess' | 'mentors' | 'interview' | 'passport' | 'settings';
const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;

export function Today({
  state,
  actions,
  go,
  onAction,
  onUndo,
  runAgent,
  running,
  careerGoal = 'Software Engineer',
  onOpenCalibration,
  workflow,
  capabilityProfile,
  refreshProfile,
}: {
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
  capabilityProfile?: StudentCapabilityProfile | null;
  refreshProfile?: () => Promise<void>;
}) {
  const skills = skillStates(state.evidence);
  const r = readiness(skills);
  const top = actions.slice(0, 3);
  const stagesProg = STAGES.map((s) => ({ ...s, progress: stageProgress(skills, s.skills) }));
  const currentStage = stagesProg.find((s) => s.progress < 90) ?? stagesProg[stagesProg.length - 1];

  // 1. Primary Action: What, Why, What to do now
  const primaryAction = top[0];
  const wfAction = workflow?.nextRecommendedAction;
  const primaryTitle = wfAction?.title || (primaryAction ? primaryAction.title : 'Take Adaptive Baseline Assessment');
  const primaryReason = wfAction?.reason || (state.evidence.length === 0
    ? 'Calibrate your initial baseline across foundational software engineering competencies.'
    : primaryAction
      ? `Closing the gap in ${skillName(primaryAction.skill)} will yield the highest readiness impact.`
      : 'All targets for your current path are met. Retest periodically to maintain verified proof.');
  const primaryNow = primaryAction
    ? (primaryAction.kind === 'PROVE' ? 'Launch the adaptive diagnostic quiz (Levels 0–5) to record authentic proof.' : 'Work through the hands-on project in your workspace.')
    : 'All current benchmarks verified. Retest periodically to maintain proof.';

  // 2. Claimed vs Verified Skills
  const claimedSkills: string[] = useMemo(() => {
    if (capabilityProfile) {
      return extractClaimedSkills(capabilityProfile).claimedSkills;
    }
    if (workflow?.confirmedSkills && workflow.confirmedSkills.length > 0) {
      return workflow.confirmedSkills;
    }
    return ['problem-solving'];
  }, [capabilityProfile, workflow?.confirmedSkills]);

  const verifiedSkillsList = useMemo(() => {
    return skills.filter((s) => s.count > 0);
  }, [skills]);

  // 3. Real-State 5-Stage Journey Config (01 Discover, 02 Verify, 03 Plan, 04 Learn, 05 Improve)
  const isDiscoverDone = Boolean(capabilityProfile?.onboardingCompleted || workflow?.stage === 'DISCOVERY_COMPLETED');
  const isVerifyDone = state.evidence.length >= 1;
  const isPlanDone = stagesProg.some((s) => s.progress >= 90);
  const isLearnDone = state.activity.length >= 3;
  const isImproveDone = skills.some((s) => s.verified);

  const journeyStages: JourneyStageConfig[] = [
    {
      num: '01',
      id: 'discover',
      title: 'Discover',
      subtitle: 'Background & Skill Claims',
      status: isDiscoverDone ? 'completed' : 'active',
      badge: isDiscoverDone ? 'Calibrated' : 'In Progress',
      happening: 'Conversational discovery captures your academic year, declared skill claims, and daily study availability.',
      why: 'Calibrating your true starting point prevents irrelevant questions and aligns your roadmap to realistic weekly hours.',
      now: isDiscoverDone ? 'Review or adjust your background calibration anytime.' : 'Complete conversational discovery to set your baseline.',
      actionLabel: isDiscoverDone ? 'Review Background' : 'Start Discovery',
      actionRoute: 'calibration',
    },
    {
      num: '02',
      id: 'verify',
      title: 'Verify',
      subtitle: 'Adaptive Diagnostic',
      status: isVerifyDone ? 'completed' : isDiscoverDone ? 'active' : 'upcoming',
      badge: isVerifyDone ? `${state.evidence.length} Signals Verified` : 'Needs Baseline',
      happening: 'Adaptive, prerequisite-aware diagnostic verifies your capabilities across claimed foundational topics (Levels 0–5).',
      why: 'Self-reported claims carry zero score weight. Objective testing creates immutable server proof without testing unearned topics.',
      now: isVerifyDone ? 'Retest periodically or target next competency level.' : 'Take your initial adaptive diagnostic assessment.',
      actionLabel: isVerifyDone ? 'Retest Baseline' : 'Start Diagnostic',
      actionRoute: 'assess',
    },
    {
      num: '03',
      id: 'plan',
      title: 'Plan',
      subtitle: 'Personalized Roadmap',
      status: isPlanDone ? 'completed' : isVerifyDone ? 'active' : 'upcoming',
      badge: isVerifyDone ? 'Milestones Active' : 'Prerequisite Locked',
      happening: 'Living career roadmap dynamically structured from verified evidence into semesters, milestones, and weekly targets.',
      why: 'Dependencies are strictly enforced: advanced topics unlock only after verified foundational evidence is recorded.',
      now: isVerifyDone ? 'Review your customized semester milestone targets.' : 'Complete baseline assessment to unlock your roadmap.',
      actionLabel: 'Inspect Roadmap',
      actionRoute: 'roadmap',
    },
    {
      num: '04',
      id: 'learn',
      title: 'Learn',
      subtitle: 'Bite-Sized Practice & Projects',
      status: isLearnDone ? 'completed' : isVerifyDone ? 'active' : 'upcoming',
      badge: state.activity.length > 0 ? `${state.activity.length} Tasks Done` : 'Ready to Practice',
      happening: 'Targeted hands-on practice: bite-sized tracing challenges, practical systems projects, and code debugging.',
      why: 'True capability is built by applying concepts. Practical project verification elevates confidence beyond quizzes.',
      now: primaryAction ? `Execute today's recommended action: ${primaryAction.title}` : 'Explore available practical projects in your workspace.',
      actionLabel: primaryAction?.kind === 'PROVE' ? 'Start Assessment' : 'Open Projects',
      actionRoute: primaryAction?.kind === 'PROVE' ? 'assess' : 'projects',
    },
    {
      num: '05',
      id: 'improve',
      title: 'Improve',
      subtitle: 'Continuous Mastery & Passport',
      status: isImproveDone ? 'completed' : state.activity.length >= 1 ? 'active' : 'upcoming',
      badge: isImproveDone ? 'Verified Passport' : 'Continuous Cycle',
      happening: 'Continuous capability re-verification, mentor feedback, mock interviews, and verifiable public Skill Passport.',
      why: 'Multi-source evidence prevents skill decay and guarantees high-confidence capability signals to future employers.',
      now: 'Inspect your verified passport summary or request review from an approved mentor.',
      actionLabel: 'View Skill Passport',
      actionRoute: 'passport',
    },
  ];

  const activeStageIndex = !isDiscoverDone ? 0 : !isVerifyDone ? 1 : !isLearnDone ? 3 : isImproveDone ? 4 : 2;

  // 4. Embedded AI Companion State
  const [companionInput, setCompanionInput] = useState('');
  const [companionBusy, setCompanionBusy] = useState(false);
  const [companionReply, setCompanionReply] = useState<string | null>(null);
  const [companionTools, setCompanionTools] = useState<string[]>([]);
  const [companionError, setCompanionError] = useState('');

  const quickPrompts = [
    'Explain simpler',
    'I have 20 minutes',
    'Focus on C first',
    'Why this task?',
    'Harder challenge',
    'Change my roadmap',
  ];

  const handleAskCompanion = async (queryText: string) => {
    if (!queryText.trim() || companionBusy) return;
    const text = queryText.trim();
    setCompanionInput('');
    setCompanionBusy(true);
    setCompanionError('');

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          state: { v: 2, activity: state.activity, requests: state.requests },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent call failed');

      setCompanionReply(data.answer || 'Response received.');
      if (Array.isArray(data.steps)) {
        setCompanionTools(data.steps.map((s: any) => s.tool || 'executed_tool'));
      }
      if (refreshProfile) {
        void refreshProfile();
      }
    } catch (err) {
      setCompanionError(err instanceof Error ? err.message : 'Could not reach agent companion.');
    } finally {
      setCompanionBusy(false);
    }
  };

  // Recent authentic evidence
  const recentEvidence = useMemo(() => {
    return [...state.evidence].filter((e) => !e.id.startsWith('seed-')).slice(-5).reverse();
  }, [state.evidence]);

  return (
    <div className="today-dashboard">
      {/* PRIORITY 1: STATUS & GUIDED JOURNEY STEPPER */}
      <section className="welcome dashboard-header">
        <div className="greeting-col">
          <div className="eyebrow"><span className="live-dot" /> SKILLPILOT — CAREER INTELLIGENCE SYSTEM</div>
          <h1>YOUR POTENTIAL. <em>ENGINEERED.</em></h1>
          <p>Understand your strengths. Close your skill gaps. Build evidence of what you can do.</p>
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

      {/* Guided 5-Stage Stepper: 01 Discover, 02 Verify, 03 Plan, 04 Learn, 05 Improve */}
      <GuidedJourneyProgress
        stages={journeyStages}
        activeStageIndex={activeStageIndex}
        onStageClick={(idx) => {
          const target = journeyStages[idx];
          if (target.id === 'discover' && onOpenCalibration) onOpenCalibration();
          else if (target.id === 'verify') go('assess');
          else if (target.id === 'plan') go('roadmap');
          else if (target.id === 'learn') go('projects');
          else if (target.id === 'improve') go('passport');
        }}
        onActionClick={(stage) => {
          if (stage.id === 'discover' && onOpenCalibration) onOpenCalibration();
          else if (stage.actionRoute) go(stage.actionRoute as View);
        }}
      />

      <AnimatedMarquee items={[
        'ASSESS COMPETENCIES',
        'LEARN WITH SOCRATIC AI',
        'BUILD PRACTICAL SYSTEMS',
        'DEMONSTRATE RUNTIME EVIDENCE',
        'GROW CAREER READINESS',
        'AUTONOMOUS CAREER SYSTEM',
      ]} />

      {/* PRIORITY 2: TODAY'S ACTION (ONE PRIMARY ACTION CARD) */}
      <section className="priority-card" role="region" aria-label="Today's Primary Action">
        <div className="priority-copy">
          <div className="priority-eyebrow">
            <Zap size={14} /> RECOMMENDED NEXT STEP // ONE PRIMARY ACTION
          </div>
          <h2>{primaryTitle}</h2>
          <p>{primaryReason}</p>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--cyan)' }}>
            <b>What to do now:</b> {primaryNow}
          </div>
        </div>
        <button
          className="primary priority-action-btn"
          onClick={() => {
            if (primaryAction?.kind === 'BUILD') {
              go('projects');
            } else {
              go('assess', primaryAction?.skill);
            }
          }}
        >
          <Zap size={16} /> {primaryAction?.kind === 'BUILD' ? 'Open project workspace' : 'Start adaptive assessment'}
        </button>
      </section>

      {/* Secondary Tasks Stack (if any) */}
      {top.slice(1).length > 0 && (
        <div className="panel-block" style={{ marginBottom: 24 }}>
          <div className="panel-head">
            <div>
              <span className="kicker">UPCOMING QUEUE</span>
              <h3 style={{ margin: 0, fontSize: 16 }}>Secondary Learning Actions</h3>
            </div>
            <button className="link" onClick={() => go('roadmap')}>See full roadmap <ArrowRight size={14} /></button>
          </div>
          <div className="action-stack task-list">
            {top.slice(1).map((a, i) => (
              <button
                className="action-card task-row"
                key={a.id}
                onClick={() => onAction(a)}
                aria-label={`${a.title}. ${a.detail}`}
              >
                <span className="task-index">0{i + 2}</span>
                <span className="action-icon">
                  {a.kind === 'PROVE' ? <Crosshair size={18} /> : a.kind === 'BUILD' ? <Zap size={18} /> : <MessageCircle size={18} />}
                </span>
                <span className="task-info">
                  <b>{a.title}</b>
                  <small>{a.detail} · ~{a.time || '15 mins'} · {a.kind === 'PROVE' ? 'starts quiz' : 'mark complete'}</small>
                </span>
                <span className="task-impact">+{a.upTo}% readiness</span>
              </button>
            ))}
          </div>
          {state.activity.length > 0 && (
            <div className="done-strip" style={{ marginTop: 12 }}>
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
      )}

      {/* Interactive Procedural Vector Topology */}
      <ConnectedSkillNetwork state={state} onSelectSkill={(skillId) => go('assess', skillId)} />

      {/* PRIORITY 3, 4, 5: GRID OF MILESTONE, PROGRESS & SKILL INSIGHTS */}
      <div className="dashboard-grid">
        <div className="panel-block">
          {/* PRIORITY 3: CURRENT MILESTONE */}
          <div className="panel-head">
            <div>
              <span className="kicker">CURRENT MILESTONE</span>
              <h3>Phase {currentStage.n}: {currentStage.name}</h3>
            </div>
            <button className="link" onClick={() => go('roadmap')}>Full Plan <ArrowRight size={12} /></button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {currentStage.blurb}
          </p>

          <div className="compact-roadmap" style={{ marginBottom: 20 }}>
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

          {/* PRIORITY 5: SKILL INSIGHTS (CLAIMED VS VERIFIED DISTINCTION) */}
          <div className="skills-column-head" style={{ marginTop: 24 }}>
            <div>
              <span className="kicker">SKILL INSIGHTS</span>
              <h3 style={{ margin: 0 }}>Claimed vs Verified Capability</h3>
            </div>
          </div>
          <p className="skills-column-note">
            Self-reported claims guide diagnostic starting points, but carry zero readiness weight. Verified capability is earned only through server evaluation.
          </p>

          <div className="claimed-vs-verified-grid">
            {/* Column A: Claimed Skills */}
            <div className="skills-column-block">
              <div className="skills-column-head">
                <h4>Claimed Skills</h4>
                <span className="badge-cyan">Self-Reported</span>
              </div>
              <div className="skill-claims-list">
                {claimedSkills.map((c) => (
                  <div key={c} className="skill-claim-row">
                    <span className="skill-claim-name">{skillName(c)}</span>
                    <span className="claim-badge">0% Readiness</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column B: Verified Capabilities */}
            <div className="skills-column-block">
              <div className="skills-column-head">
                <h4>Verified Capabilities</h4>
                <span className="badge-cyan">{verifiedSkillsList.length} Verified</span>
              </div>
              {verifiedSkillsList.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <AlertCircle size={20} style={{ margin: '0 auto 6px auto', display: 'block', color: 'var(--muted)' }} />
                  <span>No skills verified yet. Start an adaptive assessment to build verified proof.</span>
                </div>
              ) : (
                <div className="verified-skills-list">
                  {verifiedSkillsList.map((v) => (
                    <div key={v.def.id} className="verified-skill-row">
                      <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{v.def.name}</span>
                      <div className="verified-skill-meta">
                        <span className="verified-level-tag">{v.score}%</span>
                        <VerifiedBadge verified={v.verified} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PRIORITY 6: RECENT IMMUTABLE EVIDENCE LEDGER */}
          <div style={{ marginTop: 28 }}>
            <div className="panel-head">
              <div>
                <span className="kicker">EVIDENCE LEDGER</span>
                <h3>Recent Server-Verified Proof</h3>
              </div>
              <button className="link" onClick={() => go('passport')}>View Passport <ArrowRight size={12} /></button>
            </div>
            {recentEvidence.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--line)', borderRadius: 8 }}>
                <ShieldCheck size={24} style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--muted)' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  No verified evidence recorded yet. Take an adaptive assessment or complete a project to build verified proof.
                </p>
              </div>
            ) : (
              <div className="evidence-ledger-container">
                <table className="evidence-table">
                  <thead>
                    <tr>
                      <th>SKILL</th>
                      <th>SOURCE</th>
                      <th>SCORE</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvidence.map((ev) => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 600, color: '#FFFFFF' }}>{skillName(ev.skill)}</td>
                        <td><span className="evidence-source-tag">{ev.kind}</span></td>
                        <td style={{ color: 'var(--cyan)' }}>{ev.score}%</td>
                        <td>{new Date(ev.at).toLocaleDateString()}</td>
                        <td><CheckCircle2 size={14} color="#10B981" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR COLUMN */}
        <div className="dashboard-sidebar-col">
          {/* PRIORITY 4: COMPUTED READINESS & PROGRESS */}
          <div className="panel-block">
            <div className="panel-head">
              <h3>Career Readiness</h3>
              <span className="badge-cyan">{state.evidence.length} signals</span>
            </div>
            <div className="readiness" style={{ marginBottom: 16 }}>
              <ProgressRing value={r} />
              <div className="readiness-copy">
                <small>COMPUTED READINESS</small>
                <b>{r}%</b>
                <span>{skills.filter((s) => s.verified).length} of {skills.length} verified</span>
              </div>
            </div>
            {r === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                Awaiting initial verified evidence. Self-reported claims are excluded from readiness until proven.
              </p>
            )}
          </div>

          {/* PRIORITY 7: AI COMPANION (CONVERSATIONAL UI INTEGRATED INTO THE PRODUCT) */}
          <div className="today-ai-companion" role="region" aria-label="AI Career Companion">
            <div className="companion-head">
              <div className="companion-title">
                <BrainCircuit size={17} color="var(--cyan)" />
                <span>AI Career Companion</span>
              </div>
              <button className="link" onClick={() => go('agent')} style={{ fontSize: 11 }}>
                Full Workspace <ArrowRight size={11} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
              Ask anything, adjust your pace, or request prerequisite rationale:
            </p>

            <div className="companion-suggestions">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="companion-chip"
                  disabled={companionBusy}
                  onClick={() => handleAskCompanion(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <form
              className="companion-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleAskCompanion(companionInput);
              }}
            >
              <input
                value={companionInput}
                onChange={(e) => setCompanionInput(e.target.value)}
                placeholder="Ask e.g. 'I have 20 minutes', 'Explain simpler'..."
                disabled={companionBusy}
                maxLength={300}
                aria-label="Ask your career companion"
              />
              <button type="submit" className="primary" disabled={companionBusy || !companionInput.trim()} style={{ padding: '0 12px' }}>
                <Send size={14} />
              </button>
            </form>

            {companionBusy && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCcw size={12} className="spin" />
                <span>Evaluating evidence, prerequisites, and preferences…</span>
              </div>
            )}

            {companionError && (
              <p style={{ margin: '10px 0 0 0', fontSize: 12, color: '#F87171' }}>{companionError}</p>
            )}

            {companionReply && !companionBusy && (
              <div className="companion-output companion-reply">
                <p style={{ margin: 0 }} className="companion-reply-text">{companionReply}</p>
                {companionTools.length > 0 && (
                  <div className="companion-tools-trace">
                    {companionTools.map((t, idx) => (
                      <span key={idx} className="tool-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PRIORITY 8: UPCOMING MENTOR / REASSESSMENT ITEMS */}
          <div className="panel-block" style={{ marginTop: 20 }}>
            <div className="panel-head">
              <div>
                <span className="kicker">MENTOR & REASSESSMENT</span>
                <h4 style={{ margin: 0, fontSize: 14, color: '#FFF' }}>Verified Review</h4>
              </div>
              <button className="link" onClick={() => go('mentors')}>Directory <ArrowRight size={11} /></button>
            </div>
            {state.requests.length === 0 ? (
              <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>No active mentor reviews. Connect with approved mentors to build high-confidence review evidence.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {state.requests.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                    <span style={{ color: '#FFF' }}>Mentor Request</span>
                    <span style={{ color: 'var(--cyan)', textTransform: 'capitalize' }}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Roadmap({ state, actions, go, workflow }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
    workflow?: any;
}) {
    const skills = skillStates(state.evidence);
    const prog = STAGES.map((s) => stageProgress(skills, s.skills));
    const current = Math.max(0, prog.findIndex((p) => p < 90));
    const top = actions[0];
    const isLocked = Boolean(workflow?.featuresLocked?.roadmap);

    const goalLabel = workflow?.confirmedGoals?.[0] || 'SOFTWARE ENGINEER';
    const eduLevel = workflow?.capabilityProfile?.educationLevel || 'first_year';
    const academicYear = eduLevel === 'first_year' ? 'YEAR 1 (FOUNDATIONS)' :
      eduLevel === 'second_year' ? 'YEAR 2 (CORE SYSTEMS)' :
      eduLevel === 'third_year' ? 'YEAR 3 (ADVANCED ARCHITECTURE)' :
      eduLevel === 'final_year' ? 'YEAR 4 (CAPSTONE READINESS)' : 'YEAR 1';

    const semesterFocus = current === 0 ? 'SEM 1: SYNTAX & LOGIC' :
      current === 1 ? 'SEM 2: BUILD & MEMORY' :
      current === 2 ? 'SEM 3: PRACTICAL SYSTEMS' : 'SEM 4: VERIFICATION';

    const monthlyMilestone = current === 0 ? 'MONTH 1: BITE-SIZED TRACING' :
      current === 1 ? 'MONTH 2: ARRAYS & POINTERS' :
      current === 2 ? 'MONTH 3: REST & DB' : 'MONTH 4: CODE REVIEWS';

    const weeklyTarget = `${workflow?.capabilityProfile?.weeklyHours || 5}H / WEEK (30-MIN DAILY PRACTICE)`;
    const todayAction = top ? top.title : 'ALL BENCHMARKS VERIFIED';

    return <div className="wide">
    <PageIntro
      kicker="LIVING ROADMAP"
      title="A plan that moves when you do."
      text="Stage progress is computed from the skills each stage needs. New evidence can change the plan without losing your history."
      contextTriad={{
        happening: `Roadmap for ${goalLabel} calibrated to your proven competencies and ${academicYear}.`,
        why: 'Dependencies ensure foundational syntax and memory management are verified before complex distributed architectures.',
        now: top ? `Execute today's action: ${top.title}` : 'All roadmap milestones verified. Retest periodically to build higher confidence.',
      }}
    />

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

    <div className="roadmap-hierarchy-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span>CAREER GOAL: <b>{goalLabel.toUpperCase()}</b></span>
      <span className="hierarchy-arrow">→</span>
      <span>{academicYear}</span>
      <span className="hierarchy-arrow">→</span>
      <span>{semesterFocus}</span>
      <span className="hierarchy-arrow">→</span>
      <span>{monthlyMilestone}</span>
      <span className="hierarchy-arrow">→</span>
      <span>{weeklyTarget}</span>
      <span className="hierarchy-arrow">→</span>
      <span className="hierarchy-active">TODAY: <b>{todayAction}</b></span>
    </div>

    <div className="roadmap-meta"><span><b>12 weeks</b> current cycle</span><span><b>{readiness(skills)}%</b> readiness</span><span><b>{actions.length}</b> open actions</span></div>
    <div className="roadmap-list">{STAGES.map((s, i) => (<div className={i === current ? 'roadmap-row current' : 'roadmap-row'} key={s.n}>
        <span className="road-num">{s.n}</span><div><small>{s.weeks}</small><h3>{s.name}</h3><p>{s.blurb}</p></div>
        <div className="road-progress"><b>{prog[i]}%</b><div><i style={{ width: `${prog[i]}%` }}/></div></div>
      </div>))}</div>
    <div className="agent-wide"><Sparkles /><div><span className="kicker">WHY THE PLAN LOOKS LIKE THIS</span><h3>{top ? top.title : 'Plan complete'}</h3><p>{state.planNote}</p></div>
      {top && <button className="ghost" onClick={() => go(top.route === 'assess' ? 'assess' : 'today', top.route === 'assess' ? top.skill : undefined)}>{top.route === 'assess' ? 'Start retest' : 'Go to today'} <ArrowRight size={14}/></button>}</div>
  </div>;
}
export function Skills({ state, go }: {
    state: AppState;
    go?: (v: View, focus?: string) => void;
}) {
    const skills = skillStates(state.evidence);
    return <div className="wide">
    <PageIntro
      kicker="SKILL GRAPH & TOPOLOGY"
      title="KNOW WHERE YOU STAND."
      text="Scores are signals. A skill is verified only with 3+ evidence items from at least two source types. Continuous evidence proves ability over time."
      contextTriad={{
        happening: 'Interactive skill network showing your verified competency signals and topological prerequisites.',
        why: 'Scores represent verified signals. 3+ multi-source evidence items are required for full verification.',
        now: 'Select any skill node to review telemetry or start an adaptive diagnostic.',
      }}
    />
    <div style={{ marginBottom: 24 }}>
      <ConnectedSkillNetwork state={state} onSelectSkill={(id) => go?.('assess', id)} />
    </div>
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
    <PageIntro
      kicker="MENTOR NETWORK"
      title="Real mentors, not placeholders."
      text="Only mentors who created an account and were approved by SkillPilot admins appear here. Your request is stored server-side; a mentor review can become verified evidence."
      contextTriad={{
        happening: 'Directory of approved career mentors and registered engineering practitioners.',
        why: 'Mentor feedback counts as high-confidence verification evidence in your skill passport.',
        now: 'Select an approved mentor to request code review or career guidance.',
      }}
    />
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
    <PageIntro
      kicker="SKILL PASSPORT"
      title="Cryptographically Shareable Proof."
      text="Software Engineer pathway · private until you choose to share it."
      contextTriad={{
        happening: 'Cryptographically shareable Skill Passport summarizing your immutable server evidence.',
        why: 'Employers and mentors verify authentic runtime demonstration rather than unverified resume claims.',
        now: 'Generate a public verification link or copy your structured evidence summary.',
      }}
    />
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
    <PageIntro
      kicker="ACCOUNT & TRUST"
      title="Your proof stays server-owned."
      text="SkillPilot uses your account as the identity boundary. Scores, assessments and mentor evidence are stored on the server; browser storage is only a presentation cache."
      contextTriad={{
        happening: 'Account controls, server data export, and complete agent action audit logs.',
        why: 'Your data remains server-owned, verifiable, and exportable at any time.',
        now: 'Export your account JSON or inspect recent deterministic agent operations.',
      }}
    />
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
