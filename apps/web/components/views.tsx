'use client';
import { useEffect, useState, useMemo } from 'react';
import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, CircleHelp, Compass, Crosshair, MessageCircle, Users, RefreshCcw, ShieldCheck, Sparkles, Target, Trophy, Zap, Download, Upload, RotateCcw, Share2, Copy, ExternalLink, Lock, Send, Clock, BookOpen, AlertCircle, Play, Layers } from 'lucide-react';
import { STAGES, SKILLS, passportSummary, readiness, skillStates, stageProgress, type AppState, type PlanAction, } from '../lib/engine';
import { ProgressRing } from './ProgressRing';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';
import { PageIntro, Signal, SkillBar, VerifiedBadge } from './ui';
import { AnimatedMarquee, ConnectedSkillNetwork, ScrollReveal, GuidedJourneyProgress, type JourneyStageConfig } from './motion';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import { extractClaimedSkills } from '../lib/assessment-planner';
import { RoadmapSkillTree } from './RoadmapSkillTree';
import { NextActionGuidedModal } from './NextActionGuidedModal';
export type View = 'today' | 'practice' | 'learn' | 'agent' | 'projects' | 'roadmap' | 'skills' | 'assess' | 'mentors' | 'interview' | 'passport' | 'settings';
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
  const [dynamicNextAction, setDynamicNextAction] = useState<any | null>(null);
  const [snoozedActionId, setSnoozedActionId] = useState<string | null>(null);
  const [showGuidedModal, setShowGuidedModal] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/learn/next-action', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.nextAction) {
          setDynamicNextAction(d.nextAction);
          try {
            const dismissed = sessionStorage.getItem('skillpilot_guided_step_v4');
            if (!dismissed) {
              setShowGuidedModal(true);
            }
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.evidence.length, state.activity.length]);

  const handlePerformGuidedAction = (action: any) => {
    setShowGuidedModal(false);
    try {
      sessionStorage.setItem('skillpilot_guided_step_v4', 'performed');
    } catch {}

    if (action.route === 'learn') {
      go('learn', action.lessonId);
    } else if (action.route === 'projects') {
      go('projects', action.projectSlug);
    } else if (action.route === 'assess') {
      go('assess', action.skillId);
    } else if (action.route === 'calibration' && onOpenCalibration) {
      onOpenCalibration();
    } else {
      go(action.route as View);
    }
  };

  const handleDismissGuidedModal = () => {
    setShowGuidedModal(false);
    try {
      sessionStorage.setItem('skillpilot_guided_step_v4', 'dismissed');
    } catch {}
  };

  const skills = skillStates(state.evidence);
  const r = readiness(skills);
  const top = actions.slice(0, 3);
  const stagesProg = STAGES.map((s) => ({ ...s, progress: stageProgress(skills, s.skills) }));
  const currentStage = stagesProg.find((s) => s.progress < 90) ?? stagesProg[stagesProg.length - 1];

  // 1. Primary Action: What, Why, What to do now
  const primaryAction = top[0];
  const wfAction = workflow?.nextRecommendedAction;
  const primaryTitle = dynamicNextAction?.title || wfAction?.title || (primaryAction ? primaryAction.title : 'Take Adaptive Baseline Assessment');
  const primaryReason = dynamicNextAction?.whyItMatters || wfAction?.reason || (state.evidence.length === 0
    ? 'Calibrate your initial baseline across foundational software engineering competencies.'
    : primaryAction
      ? `Closing the gap in ${skillName(primaryAction.skill)} will yield the highest readiness impact.`
      : 'All targets for your current path are met. Retest periodically to maintain verified proof.');
  const primaryNow = dynamicNextAction?.explanation || (primaryAction
    ? (primaryAction.kind === 'PROVE' ? 'Launch the adaptive diagnostic quiz (Levels 0–5) to record authentic proof.' : 'Work through the hands-on project in your workspace.')
    : 'All current benchmarks verified. Retest periodically to maintain proof.');

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
      subtitle: 'Continuous Lessons & Practice',
      status: isLearnDone ? 'completed' : isVerifyDone ? 'active' : 'upcoming',
      badge: state.activity.length > 0 ? `${state.activity.length} Tasks Done` : 'Ready to Learn',
      happening: 'Interactive Socratic lessons, annotated code tracing walkthroughs, and infinite practice questions.',
      why: 'True capability is built by applying concepts. Socratic practice elevates mental models beyond multiple choice guesses.',
      now: dynamicNextAction?.title ? `Next: ${dynamicNextAction.title}` : 'Open the learning workspace to complete execution traces and lock in concept mastery.',
      actionLabel: dynamicNextAction?.buttonLabel || 'Start Learning',
      actionRoute: 'learn',
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
      {/* PRIORITY 1: WARM GREETING & COMPACT PROGRESS STRIP */}
      <section className="welcome dashboard-header">
        <div className="greeting-col">
          <div className="eyebrow"><span className="live-dot" /> SKILLPILOT — CAREER OPERATING SYSTEM</div>
          <h1>Welcome back, <em>{state.name?.trim() || 'Student'}.</em> <span className="sr-only">YOUR POTENTIAL.</span></h1>
          <p>Here is your single highest-impact action today to prove your skills with verifiable evidence.</p>
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
      {/* SECTION B: CAREER READINESS SUMMARY (4 NON-REDUNDANT ESSENTIAL METRICS) */}
      <section className="career-readiness-summary-strip" aria-label="Career Readiness Summary">
        <div className="summary-metric-card">
          <div className="summary-metric-head">
            <span className="summary-metric-title">TARGET CAREER</span>
            <Target size={16} className="metric-icon" />
          </div>
          <div className="summary-metric-value milestone-value">
            <b style={{ fontSize: 16 }}>{careerGoal}</b>
          </div>
          <div className="summary-metric-footnote">
            {workflow?.capabilityProfile?.educationLevel ? `${workflow.capabilityProfile.educationLevel.replace('_', ' ').toUpperCase()} Track` : 'Calibrated Track'}
          </div>
        </div>

        <div className="summary-metric-card highlight-card">
          <div className="summary-metric-head">
            <span className="summary-metric-title">READINESS</span>
            <Award size={16} className="metric-icon highlight-icon" />
          </div>
          <div className="summary-metric-value highlight-value">
            <b>{r}%</b>
            <span className="metric-sublabel">{r > 60 ? 'Competitive' : r > 30 ? 'Developing' : 'Foundational'}</span>
          </div>
          <div className="summary-metric-footnote">
            Authentic server-computed capability
          </div>
        </div>

        <div className="summary-metric-card">
          <div className="summary-metric-head">
            <span className="summary-metric-title">VERIFIED SKILLS</span>
            <CheckCircle2 size={16} className="metric-icon" />
          </div>
          <div className="summary-metric-value">
            <b>{skills.filter((s) => s.verified).length}</b>
            <span className="metric-divider">/</span>
            <span className="metric-total">{skills.length}</span>
          </div>
          <div className="summary-metric-footnote">
            {state.evidence.length} authentic signals recorded
          </div>
        </div>

        <div className="summary-metric-card">
          <div className="summary-metric-head">
            <span className="summary-metric-title">CURRENT MILESTONE</span>
            <Compass size={16} className="metric-icon" />
          </div>
          <div className="summary-metric-value milestone-value">
            <b>Phase {currentStage.n}</b>
            <span className="metric-sublabel">{currentStage.name}</span>
          </div>
          <div className="summary-metric-footnote">
            {stagesProg.find((s) => s.n === currentStage.n)?.progress || 0}% milestone progress
          </div>
        </div>
      </section>

      {/* PRIORITY 2: TODAY'S HERO ACTION (ONE PROMINENT PRIMARY ACTION CARD) */}
      {snoozedActionId === (dynamicNextAction?.id || primaryTitle) ? (
        <section className="priority-card" style={{ borderLeftColor: 'var(--border-color)' }} role="region" aria-label="Snoozed Action">
          <div className="priority-copy">
            <div className="priority-eyebrow" style={{ color: 'var(--text-secondary)' }}>
              <Clock size={14} /> RECOMMENDATION SNOOZED FOR THIS SESSION
            </div>
            <h2 style={{ fontSize: 18, color: 'var(--text-secondary)' }}>You snoozed: {primaryTitle}</h2>
            <p>You have full autonomy over your learning path. Explore any milestone from your roadmap or practice arena.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost" onClick={() => setSnoozedActionId(null)}>
              <RotateCcw size={14} /> Resume recommendation
            </button>
            <button className="primary priority-action-btn" onClick={() => go('roadmap')}>
              <ArrowRight size={14} /> Open full roadmap
            </button>
          </div>
        </section>
      ) : (
        <section className="priority-card hero-primary-action" role="region" aria-label="Today's Primary Action">
          <div className="priority-copy">
            <div className="priority-eyebrow">
              <Zap size={14} /> RECOMMENDED NEXT STEP // ONE PRIMARY ACTION
            </div>
            <h2>{primaryTitle}</h2>
            <p className="priority-why-reason">{primaryReason}</p>

            <div className="priority-meta-chips" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 10px 0', flexWrap: 'wrap' }}>
              <div className="action-objective-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'rgba(136, 116, 199, 0.1)', color: 'var(--primary-purple, #8874C7)', padding: '4px 10px', borderRadius: 8, fontWeight: 500 }}>
                <Target size={13} />
                <span><b>Skill Objective:</b> {dynamicNextAction?.whatYouWillLearn || (primaryAction ? `Strengthen ${skillName(primaryAction.skill)} (Target ${primaryAction.upTo}% readiness)` : 'Calibrate foundational baseline')}</span>
              </div>
              <span className="action-duration-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary, #4A4553)', background: '#FAF9FB', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-color, #E7E3EB)' }}>
                <Clock size={13} color="var(--primary-purple, #8874C7)" />
                Estimated duration: <b>{dynamicNextAction?.estimatedMinutes ? `${dynamicNextAction.estimatedMinutes} mins` : (primaryAction?.time || '15 mins')}</b>
              </span>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #4A4553)', margin: '6px 0 10px 0' }}>
              <b style={{ color: 'var(--text-primary, #17151B)' }}>What to do now:</b> {primaryNow}
            </div>

            <details className="why-this-toggle" style={{ display: 'inline-block', fontSize: 12, marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--primary-purple, #8874C7)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <CircleHelp size={13} /> Why was this task selected for you?
              </summary>
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#FAF9FB', borderRadius: 8, borderLeft: '3px solid var(--primary-purple, #8874C7)', border: '1px solid var(--border-color, #E7E3EB)', color: 'var(--text-secondary, #4A4553)', fontSize: 12, lineHeight: 1.55 }}>
                <p style={{ margin: '0 0 6px 0' }}>{dynamicNextAction?.whyItMatters || primaryReason}</p>
                {dynamicNextAction?.whatToKnowBefore && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 11.5 }}><b>Prerequisites:</b> {dynamicNextAction.whatToKnowBefore}</p>
                )}
                {dynamicNextAction?.completionRequires && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 11.5 }}><b>Completion requires:</b> {dynamicNextAction.completionRequires}</p>
                )}
              </div>
            </details>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
            <button
              className="primary priority-action-btn"
              onClick={() => {
                if (dynamicNextAction) {
                  if (dynamicNextAction.route === 'learn') {
                    go('learn', dynamicNextAction.lessonId);
                  } else if (dynamicNextAction.route === 'projects') {
                    go('projects', dynamicNextAction.projectSlug);
                  } else if (dynamicNextAction.route === 'assess') {
                    go('assess', dynamicNextAction.skillId);
                  } else if (dynamicNextAction.route === 'calibration' && onOpenCalibration) {
                    onOpenCalibration();
                  } else {
                    go(dynamicNextAction.route as View);
                  }
                } else if (primaryAction?.kind === 'BUILD') {
                  go('projects');
                } else {
                  go('assess', primaryAction?.skill);
                }
              }}
            >
              <Zap size={16} /> {dynamicNextAction?.buttonLabel || (primaryAction?.kind === 'BUILD' ? 'Open project workspace' : 'Start adaptive assessment')}
            </button>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <button
                type="button"
                className="link"
                style={{ color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onClick={() => setSnoozedActionId(dynamicNextAction?.id || primaryTitle)}
              >
                Snooze for now
              </button>
              <span style={{ color: 'var(--line)' }}>•</span>
              <button
                type="button"
                className="link"
                style={{ color: 'var(--primary-purple, #8874C7)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 500 }}
                onClick={() => go('roadmap')}
              >
                Pick another task
              </button>
              <span style={{ color: 'var(--line)' }}>•</span>
              <button
                type="button"
                className="link"
                style={{ color: 'var(--primary-purple, #8874C7)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setShowGuidedModal(true)}
              >
                <Sparkles size={11} /> Guided View
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 5-STAGE GUIDED JOURNEY PROGRESS (COLLAPSIBLE DISCLOSURE) */}
      <details className="guided-journey-collapsible" style={{ marginBottom: 20, border: '1px solid var(--border-color, #E7E3EB)', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
        <summary style={{ cursor: 'pointer', padding: '12px 18px', background: '#FAF9FB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, userSelect: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #17151B)', fontWeight: 600 }}>
            <Sparkles size={14} color="var(--primary-purple, #8874C7)" />
            5-Stage Career Stepper ({journeyStages.find((s) => s.status === 'active')?.title || 'In Progress'})
          </span>
          <span style={{ fontSize: 12, color: 'var(--primary-purple, #8874C7)', fontWeight: 500 }}>Toggle 5-stage overview</span>
        </summary>
        <div style={{ padding: '16px 16px 0 16px' }}>
          <GuidedJourneyProgress
            stages={journeyStages}
            activeStageIndex={activeStageIndex}
            onActionClick={(stage) => {
              if (stage.actionRoute === 'calibration' && onOpenCalibration) {
                onOpenCalibration();
              } else if (stage.actionRoute) {
                go(stage.actionRoute as View);
              }
            }}
          />
        </div>
      </details>

      {/* Secondary Tasks Stack (Progressive Disclosure) */}
      {top.slice(1).length > 0 && (
        <details className="upcoming-queue-details" style={{ marginBottom: 24, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ cursor: 'pointer', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, userSelect: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #17151B)', fontWeight: 600 }}>
              <Layers size={14} color="var(--cyan)" />
              Upcoming Queue ({top.slice(1).length} secondary actions)
            </span>
            <span style={{ fontSize: 12, color: 'var(--cyan)' }}>Toggle queue details</span>
          </summary>
          <div className="panel-block" style={{ border: 'none', borderRadius: 0, margin: 0, padding: 16 }}>
            <div className="panel-head" style={{ marginBottom: 12 }}>
              <div>
                <span className="kicker">UPCOMING QUEUE</span>
                <h3 style={{ margin: 0, fontSize: 15 }}>Secondary Learning Actions</h3>
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
        </details>
      )}



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

          <div className="milestone-current-focus" style={{ marginBottom: 20, padding: '12px 14px', background: '#FAF9FB', borderRadius: 10, border: '1px solid var(--border-color, #E7E3EB)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #17151B)' }}>Active Milestone Competencies:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-purple, #8874C7)' }}>{stagesProg.find((s) => s.n === currentStage.n)?.progress || 0}% Verified</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentStage.skills.map((sId) => (
                <span key={sId} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#FFFFFF', border: '1px solid var(--border-color, #E7E3EB)', color: 'var(--text-secondary, #4A4553)', fontWeight: 500 }}>
                  {skillName(sId)}
                </span>
              ))}
            </div>
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
                <div className="editorial-empty-box" style={{ padding: '20px 16px' }}>
                  <AlertCircle size={22} className="empty-icon-pastel" />
                  <h5 className="empty-heading">No verified skills yet</h5>
                  <p className="empty-desc" style={{ marginBottom: 12 }}>Complete an adaptive assessment to establish baseline proof of your technical capabilities.</p>
                  <button type="button" className="btn-sm-action primary" onClick={() => go('assess')}>
                    Start Assessment
                  </button>
                </div>
              ) : (
                <div className="verified-skills-list">
                  {verifiedSkillsList.map((v) => (
                    <div key={v.def.id} className="verified-skill-row">
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.def.name}</span>
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
              <div className="editorial-empty-box">
                <ShieldCheck size={24} className="empty-icon-pastel" />
                <h5 className="empty-heading">Build your skill profile</h5>
                <p className="empty-desc">
                  Complete an assessment to identify your strengths and record authentic evidence in your passport.
                </p>
                <button type="button" className="btn-sm-action primary" onClick={() => go('assess')}>
                  Start Assessment
                </button>
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
                        <td style={{ fontWeight: 600, color: 'var(--text-primary, #17151B)' }}>{skillName(ev.skill)}</td>
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
              </div>
            )}
          </div>

          {/* PRIORITY 8: UPCOMING MENTOR / REASSESSMENT ITEMS */}
          <div className="panel-block" style={{ marginTop: 20 }}>
            <div className="panel-head">
              <div>
                <span className="kicker">MENTOR & REASSESSMENT</span>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>Verified Review</h4>
              </div>
              <button className="link" onClick={() => go('mentors')}>Directory <ArrowRight size={11} /></button>
            </div>
            {state.requests.length === 0 ? (
              <div className="editorial-empty-box" style={{ padding: '18px 14px' }}>
                <Users size={20} className="empty-icon-pastel" />
                <h5 className="empty-heading">Your schedule is clear</h5>
                <p className="empty-desc" style={{ marginBottom: 12 }}>Connect with an approved mentor or practice mock interviews to build review evidence.</p>
                <button type="button" className="btn-sm-action secondary" onClick={() => go('interview')}>
                  Start Mock Interview
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {state.requests.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '8px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Mentor Request</span>
                    <span style={{ color: 'var(--primary)', textTransform: 'capitalize', fontWeight: 600 }}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* SkillPilot 4.0 Guided Next-Task Modal */}
      <NextActionGuidedModal
        action={dynamicNextAction}
        isOpen={showGuidedModal}
        onClose={handleDismissGuidedModal}
        onPerformAction={handlePerformGuidedAction}
        careerGoal={careerGoal}
      />
    </div>
  );
}

export function Roadmap({ state, actions, go, workflow, onOpenCalibration }: {
    state: AppState;
    actions: PlanAction[];
    go: (v: View, focus?: string) => void;
    workflow?: any;
    onOpenCalibration?: () => void;
}) {
    const [actionableTask, setActionableTask] = useState<any | null>(null);

    useEffect(() => {
      let cancelled = false;
      fetch('/api/learn/next-action', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.nextAction) setActionableTask(d.nextAction);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [state.evidence.length, state.activity.length]);

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
    const todayAction = actionableTask?.title || (top ? top.title : 'ALL BENCHMARKS VERIFIED');

    return <div className="wide">
    <PageIntro
      kicker="LIVING ROADMAP"
      title="A plan that moves when you do."
      text="Stage progress is computed from the skills each stage needs. New evidence can change the plan without losing your history."
      contextTriad={{
        happening: `Roadmap for ${goalLabel} calibrated to your proven competencies and ${academicYear}.`,
        why: 'Dependencies ensure foundational syntax and memory management are verified before complex distributed architectures.',
        now: actionableTask ? `Next: ${actionableTask.title}` : top ? `Execute today's action: ${top.title}` : 'All roadmap milestones verified. Retest periodically to build higher confidence.',
      }}
    />

    {isLocked && (
      <div style={{ background: 'var(--surface-navy)', border: '1px solid var(--cyan-border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan)', marginBottom: 8 }}>
          <Sparkles size={18} />
          <b style={{ fontSize: 13, letterSpacing: '0.05em' }}>CALIBRATION REQUIRED TO UNLOCK ROADMAP</b>
        </div>
        <h3 style={{ fontSize: 20, color: 'var(--text-primary, #17151B)', margin: '0 0 8px 0' }}>Personalized Roadmap Calibration Pending</h3>
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

    {actionableTask && (
      <div className="roadmap-actionable-task-card" role="region" aria-label="First Actionable Learning Task">
        <div className="task-kicker">
          <Zap size={14} /> RECOMMENDED LEARNING TASK // ONE-CLICK LAUNCH
        </div>
        <div className="task-body">
          <div className="task-main">
            <h3 className="task-title">{actionableTask.title}</h3>
            <p className="task-why"><b>Why it matters:</b> {actionableTask.whyItMatters}</p>
            <div className="task-details-grid">
              <div><span className="detail-label">WHAT YOU WILL LEARN:</span> {actionableTask.whatYouWillLearn}</div>
              <div><span className="detail-label">PREREQUISITES:</span> {actionableTask.whatToKnowBefore}</div>
              <div><span className="detail-label">ESTIMATED TIME:</span> {actionableTask.estimatedMinutes} minutes</div>
              <div><span className="detail-label">COMPLETION REQUIRES:</span> {actionableTask.completionRequires}</div>
            </div>
          </div>
          <div className="task-cta">
            <button
              type="button"
              className="primary large-start-btn"
              onClick={() => {
                if (actionableTask.route === 'learn') {
                  go('learn', actionableTask.lessonId);
                } else if (actionableTask.route === 'projects') {
                  go('projects', actionableTask.projectSlug);
                } else if (actionableTask.route === 'assess') {
                  go('assess', actionableTask.skillId);
                } else if (actionableTask.route === 'calibration') {
                  if (onOpenCalibration) onOpenCalibration();
                  else go('learn');
                } else {
                  go(actionableTask.route as View);
                }
              }}
            >
              <Play size={14} fill="currentColor" /> {actionableTask.buttonLabel || 'Start Learning'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="roadmap-meta"><span><b>12 weeks</b> current cycle</span><span><b>{readiness(skills)}%</b> readiness</span><span><b>{actions.length}</b> open actions</span></div>
    <RoadmapSkillTree
      state={state}
      actions={actions}
      go={go}
      workflow={workflow}
      onOpenCalibration={onOpenCalibration}
    />
    <div className="agent-wide"><Sparkles /><div><span className="kicker">WHY THE PLAN LOOKS LIKE THIS</span><h3>{top ? top.title : 'Plan complete'}</h3><p>{state.planNote}</p></div>
      {top && <button className="ghost" onClick={() => {
        if (actionableTask?.route === 'learn') {
          go('learn', actionableTask.lessonId);
        } else {
          go(top.route === 'assess' ? 'assess' : 'today', top.route === 'assess' ? top.skill : undefined);
        }
      }}>{actionableTask?.route === 'learn' ? 'Start learning task' : top.route === 'assess' ? 'Start retest' : 'Go to today'} <ArrowRight size={14}/></button>}</div>
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
                notify('Public verification link generated.');
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
            notify('Passport link copied to clipboard.');
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
              <Copy size={13} /> {copied ? 'Copied' : 'Copy Link'}
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
export { SettingsView } from './SettingsView';
