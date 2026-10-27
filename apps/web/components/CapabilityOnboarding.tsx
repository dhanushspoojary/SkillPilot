'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Check,
  ArrowRight,
  GraduationCap,
  Code2,
  Compass,
  Clock,
  X,
  MessageSquare,
  Bot,
  User,
  RotateCcw,
  CheckCircle2,
  Send,
  Loader2,
  Target,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Terminal,
  Trophy,
} from 'lucide-react';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import {
  generateTurnId,
  sanitizeDialogueTurns,
  mergeOrAppendTurn,
  ONBOARDING_TOPIC_CONFIGS,
  type OnboardingTurn,
} from '../lib/onboarding-dialogue';
import type { AdaptiveOnboardingState } from '../lib/adaptive-onboarding';

export const ONBOARDING_SKILL_CATEGORIES = [
  {
    category: 'Programming Languages',
    skills: ['C', 'C++', 'Python', 'JavaScript', 'Java', 'Go'],
  },
  {
    category: 'Problem Solving & DSA',
    skills: ['Loop Logic', 'Arrays & Strings', 'Stacks & Queues', 'Big-O Notation', 'Recursion & Trees'],
  },
  {
    category: 'Web Development',
    skills: ['HTML5 & CSS3', 'React & State', 'Node.js & Express', 'DOM & Async JS'],
  },
  {
    category: 'Databases',
    skills: ['SQL Queries', 'PostgreSQL', 'Schema Design', 'Relational Joins & Aggregations'],
  },
  {
    category: 'APIs & Systems',
    skills: ['REST APIs', 'Git & GitHub', 'Linux CLI', 'HTTP & Networking'],
  },
  {
    category: 'Interview Prep & Projects',
    skills: ['Mock Technical Interviews', 'System Design Basics', 'Code Tracing & Debugging'],
  },
];

interface Props {
  initialProfile?: StudentCapabilityProfile;
  onSave: (profile: StudentCapabilityProfile) => Promise<void>;
  onClose?: () => void;
  canDismiss?: boolean;
  onNavigateToRoadmap?: () => void;
  onStartDiagnostic?: () => void;
  initialTab?: 'discovery' | 'adaptive_assessment';
}

interface SummaryData {
  educationLevel: string;
  programmingExperience: string;
  struggles: string;
  careerGoal: string;
  weeklyHours: number;
  selfReported: boolean;
}

export function CapabilityOnboarding({
  initialProfile,
  onSave,
  onClose,
  canDismiss = true,
  onNavigateToRoadmap,
  onStartDiagnostic,
  initialTab = 'discovery',
}: Props) {
  const [activeTab, setActiveTab] = useState<'discovery' | 'adaptive_assessment'>(initialTab);
  const [mode, setMode] = useState<'conversational' | 'form'>('conversational');
  const [busy, setBusy] = useState(false);
  const [customText, setCustomText] = useState('');
  const [turns, setTurns] = useState<OnboardingTurn[]>([]);
  const [activeTurn, setActiveTurn] = useState<OnboardingTurn | null>(() => {
    const first = ONBOARDING_TOPIC_CONFIGS[0];
    return {
      id: generateTurnId(first.topic),
      topic: first.topic,
      question: first.defaultQuestion,
      explanation: first.explanation,
      options: first.options,
      multiSelect: first.multiSelect,
      allowSkip: true,
    };
  });
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');

  // Fallback form state
  const [eduLevel, setEduLevel] = useState(initialProfile?.educationLevel || 'first_year');
  const [progExp, setProgExp] = useState(initialProfile?.programmingExperience || 'beginner');
  const [careerInterest, setCareerInterest] = useState(initialProfile?.careerInterests?.[0] || 'Software Engineer');
  const [weeklyHours, setWeeklyHours] = useState(initialProfile?.weeklyHours || 5);
  const [skillsToLearn, setSkillsToLearn] = useState<string[]>(
    initialProfile?.skillsToLearn || ['Problem Solving', 'Data Structures & Algorithms', 'Web Development']
  );
  const [skillsKnown, setSkillsKnown] = useState<string[]>(initialProfile?.skillsKnown || []);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  // Adaptive Technical Assessment State
  const [assessmentSession, setAssessmentSession] = useState<AdaptiveOnboardingState | null>(null);
  const [assessmentInput, setAssessmentInput] = useState('');
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const assessmentScrollRef = useRef<HTMLDivElement>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);

  // Initialize dynamic onboarding from server
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch('/api/workflow', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const rawDialogue = data.state?.onboardingDialogue || [];
        const dialogue = sanitizeDialogueTurns(rawDialogue);

        if (dialogue.length > 0) {
          const answered = dialogue.filter((d) => d.answer);
          const unanswered = dialogue.find((d) => !d.answer);
          setTurns(answered);

          if (unanswered) {
            setActiveTurn(unanswered);
          } else {
            // Check if all topic stages have been answered
            const answeredTopics = new Set(answered.map((d) => d.topic));
            const nextTopicDef = ONBOARDING_TOPIC_CONFIGS.find((cfg) => !answeredTopics.has(cfg.topic));

            if (!nextTopicDef || answered.length >= ONBOARDING_TOPIC_CONFIGS.length) {
              const edu = answered.find((d) => d.topic === 'education')?.answer || '1st Year Student';
              const exp = answered.find((d) => d.topic === 'experience')?.answer || 'Beginner';
              const struggles = answered.find((d) => d.topic === 'struggles')?.answer || 'Problem Solving';
              const goals = answered.find((d) => d.topic === 'goals')?.answer || 'Software Engineer';
              const avail = answered.find((d) => d.topic === 'availability')?.answer || '5 hours';
              setSummary({
                educationLevel: edu,
                programmingExperience: exp,
                struggles,
                careerGoal: goals,
                weeklyHours: parseInt(avail.match(/\d+/)?.[0] || '5', 10),
                selfReported: true,
              });
              setEduLevel(edu);
              setProgExp(exp);
              setActiveTurn(null);
            } else {
              setActiveTurn({
                id: generateTurnId(nextTopicDef.topic),
                topic: nextTopicDef.topic,
                question: nextTopicDef.defaultQuestion,
                explanation: nextTopicDef.explanation,
                options: nextTopicDef.options,
                multiSelect: nextTopicDef.multiSelect,
                allowSkip: true,
              });
            }
          }
        } else {
          const first = ONBOARDING_TOPIC_CONFIGS[0];
          setActiveTurn({
            id: generateTurnId(first.topic),
            topic: first.topic,
            question: first.defaultQuestion,
            explanation: first.explanation,
            options: first.options,
            multiSelect: first.multiSelect,
            allowSkip: true,
          });
        }
      } catch {
        // Fallback to static first turn
        const first = ONBOARDING_TOPIC_CONFIGS[0];
        setActiveTurn({
          id: generateTurnId(first.topic),
          topic: first.topic,
          question: first.defaultQuestion,
          explanation: first.explanation,
          options: first.options,
          multiSelect: first.multiSelect,
          allowSkip: true,
        });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Check if an existing adaptive technical assessment session is active (for safe resume)
  useEffect(() => {
    let cancelled = false;
    async function checkActiveAssessment() {
      try {
        const res = await fetch('/api/onboarding/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetRole: careerInterest }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.session) {
          setAssessmentSession(data.session);
          if (data.session.history?.length > 0 && !data.session.isComplete) {
            setActiveTab('adaptive_assessment');
          }
        }
      } catch {}
    }

    checkActiveAssessment();
    return () => {
      cancelled = true;
    };
  }, [careerInterest]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, activeTurn, summary]);

  useEffect(() => {
    assessmentScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assessmentSession?.history?.length, assessmentSession?.currentQuestion]);

  // Handle Escape key dismissal when dismissible
  useEffect(() => {
    if (!canDismiss || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canDismiss, onClose]);

  // Restart discovery dialogue
  const handleRestart = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restart');
      setTurns([]);
      setSummary(null);
      if (data.nextTurn) {
        setActiveTurn(data.nextTurn);
      } else {
        const first = ONBOARDING_TOPIC_CONFIGS[0];
        setActiveTurn({
          id: generateTurnId(first.topic),
          topic: first.topic,
          question: first.defaultQuestion,
          explanation: first.explanation,
          options: first.options,
          multiSelect: first.multiSelect,
          allowSkip: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restart');
    } finally {
      setBusy(false);
    }
  };

  // Rewind one turn
  const handleBack = async () => {
    if (busy || turns.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'back' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rewind turn');
      if (data.state) {
        const answered = (data.state.onboardingDialogue || []).filter((d: any) => d.answer);
        setTurns(answered);
        if (data.activeTurn) {
          setActiveTurn(data.activeTurn);
        } else if (data.state.onboardingDialogue?.length) {
          const last = data.state.onboardingDialogue[data.state.onboardingDialogue.length - 1];
          setActiveTurn(last);
        }
        setSummary(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not go back');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (busy) return;
    await handleAnswer('Skipped / Not sure yet');
  };

  // Answer a turn
  const handleAnswer = async (answerText: string) => {
    const trimmedAnswer = answerText.trim();
    if (!trimmedAnswer || busy) return;
    setBusy(true);
    setError('');

    const currentTurn: OnboardingTurn = activeTurn || {
      id: generateTurnId('step'),
      topic: 'education',
      question: '',
    };

    const existingTurn = turns.find(
      (t) => t.id === currentTurn.id || (Boolean(t.topic) && t.topic === currentTurn.topic),
    );

    const turnWithAnswer: OnboardingTurn = {
      ...currentTurn,
      answer: trimmedAnswer,
    };

    setTurns((prev) => mergeOrAppendTurn(prev, turnWithAnswer));
    setActiveTurn(null);
    setCustomText('');

    try {
      const res = await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: trimmedAnswer, topic: currentTurn.topic }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record response');

      if (data.isComplete && data.summary) {
        setSummary(data.summary);
        setCareerInterest(data.summary.careerGoal || 'Software Engineer');
        setWeeklyHours(data.summary.weeklyHours || 5);
        if (data.summary.educationLevel) setEduLevel(data.summary.educationLevel);
        if (data.summary.programmingExperience) setProgExp(data.summary.programmingExperience);
      } else if (data.nextTurn) {
        const nextTurn: OnboardingTurn = {
          ...data.nextTurn,
          id: data.nextTurn.id || generateTurnId(data.nextTurn.topic || 'step'),
        };
        setActiveTurn(nextTurn);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit answer. Please retry.');
      setActiveTurn(currentTurn);
      if (existingTurn) {
        setTurns((prev) => prev.map((t) => (t.id === existingTurn.id ? existingTurn : t)));
      } else {
        setTurns((prev) => prev.filter((t) => t.id !== currentTurn.id));
      }
    } finally {
      setBusy(false);
    }
  };

  // Complete onboarding discovery and save profile
  const handleFinalConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const chosenGoal = summary?.careerGoal || careerInterest;
      const hours = summary?.weeklyHours || weeklyHours;
      const finalEduLevel = summary?.educationLevel || eduLevel;
      const finalProgExp = summary?.programmingExperience || progExp;
      await onSave({
        educationLevel: finalEduLevel,
        programmingExperience: finalProgExp,
        fieldOfStudy: 'computer_science',
        careerInterests: [chosenGoal],
        weeklyHours: hours,
        focusAreas: skillsToLearn.length > 0 ? skillsToLearn : [summary?.struggles || 'Programming Fundamentals'],
        skillsToLearn,
        skillsKnown,
        onboardingCompleted: true,
      });

      // Transition to adaptive technical assessment
      if (onStartDiagnostic) {
        onStartDiagnostic();
      } else {
        await startAdaptiveAssessment(chosenGoal);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize calibration');
      setBusy(false);
    }
  };

  // Quick form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }).catch(() => {});

      await onSave({
        educationLevel: eduLevel,
        programmingExperience: progExp,
        fieldOfStudy: 'computer_science',
        careerInterests: [careerInterest],
        weeklyHours,
        focusAreas: skillsToLearn.length > 0
          ? skillsToLearn
          : careerInterest === 'Frontend Engineer'
          ? ['JavaScript', 'Frontend Engineering']
          : careerInterest === 'Backend Engineer'
          ? ['SQL', 'Backend Engineering']
          : ['Programming Fundamentals', 'Problem Solving'],
        skillsToLearn,
        skillsKnown,
        onboardingCompleted: true,
      });

      // Launch technical diagnostic directly if available
      if (onStartDiagnostic) {
        onStartDiagnostic();
      } else {
        await startAdaptiveAssessment(careerInterest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save calibration');
      setBusy(false);
    }
  };

  // Start or transition into the Adaptive Assessment
  const startAdaptiveAssessment = async (role?: string) => {
    setAssessmentBusy(true);
    setAssessmentError('');
    try {
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: role || careerInterest || 'Software Engineer' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start adaptive assessment');
      setAssessmentSession(data.session);
      setActiveTab('adaptive_assessment');
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Could not start technical assessment');
    } finally {
      setAssessmentBusy(false);
      setBusy(false);
    }
  };

  // Submit Answer in Adaptive Technical Assessment
  const handleAssessmentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!assessmentSession || !assessmentInput.trim() || assessmentBusy) return;

    setAssessmentBusy(true);
    setAssessmentError('');
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: assessmentSession.sessionId,
          answer: assessmentInput.trim(),
          targetRole: assessmentSession.targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process answer');
      setAssessmentSession(data.session);
      setAssessmentInput('');
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Submission failed. Please retry.');
    } finally {
      setAssessmentBusy(false);
    }
  };

  // Skip question in Adaptive Technical Assessment
  const handleAssessmentSkip = async () => {
    if (!assessmentSession || assessmentBusy) return;
    setAssessmentBusy(true);
    setAssessmentError('');
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: assessmentSession.sessionId,
          answer: 'Skipped / Unfamiliar with this concept',
          targetRole: assessmentSession.targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to skip question');
      setAssessmentSession(data.session);
      setAssessmentInput('');
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Skip failed. Please retry.');
    } finally {
      setAssessmentBusy(false);
    }
  };

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
      onClick={(e) => {
        if (canDismiss && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="onboarding-modal" style={{ maxWidth: 720, maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header / Tabs */}
        <div className="onboarding-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="onboarding-badge">
              <Sparkles size={14} />
              <span>SKILLPILOT 2.1 // ADAPTIVE ONBOARDING</span>
            </div>
            <div style={{ display: 'flex', gap: 4, background: '#FAF9FB', padding: 2, borderRadius: 8, border: '1px solid #E7E3EB' }}>
              <button
                type="button"
                className={`ghost ${activeTab === 'discovery' ? 'active-tab-btn' : ''}`}
                style={{ fontSize: 11, padding: '3px 8px', height: 26, borderRadius: 6, fontWeight: activeTab === 'discovery' ? 700 : 500 }}
                onClick={() => setActiveTab('discovery')}
              >
                1. Background
              </button>
              <button
                type="button"
                className={`ghost ${activeTab === 'adaptive_assessment' ? 'active-tab-btn' : ''}`}
                style={{ fontSize: 11, padding: '3px 8px', height: 26, borderRadius: 6, fontWeight: activeTab === 'adaptive_assessment' ? 700 : 500 }}
                onClick={() => {
                  if (!assessmentSession) {
                    startAdaptiveAssessment();
                  } else {
                    setActiveTab('adaptive_assessment');
                  }
                }}
              >
                2. Technical Diagnostic
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'discovery' && (
              <button
                type="button"
                className="ghost"
                style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
                onClick={() => setMode(mode === 'conversational' ? 'form' : 'conversational')}
              >
                {mode === 'conversational' ? 'Quick Form' : 'Dialogue'}
              </button>
            )}
            {canDismiss && onClose && (
              <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close setup">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: BACKGROUND DISCOVERY */}
        {activeTab === 'discovery' ? (
          <div>
            <h2 id="onboard-title">Welcome to SkillPilot. Tell us where you are starting.</h2>
            <p className="onboarding-sub">
              We tailor your diagnostic questions and roadmap to your real background. Starting as a beginner is expected and valued.
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {mode === 'conversational' ? (
              <div className="onboarding-chat-stream" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!summary && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A4553', marginBottom: 6 }}>
                      <span>Question {Math.min(turns.length + 1, ONBOARDING_TOPIC_CONFIGS.length)} of {ONBOARDING_TOPIC_CONFIGS.length}</span>
                      <span>{Math.round((turns.length / ONBOARDING_TOPIC_CONFIGS.length) * 100)}% calibrated</span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: '#E7E3EB', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(turns.length / ONBOARDING_TOPIC_CONFIGS.length) * 100}%`, height: '100%', background: '#8874C7', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}

                {/* Answered turns */}
                {turns.map((turn, idx) => (
                  <div key={turn.id || `turn-${turn.topic || idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FAF9FB', border: '1px solid #E7E3EB', color: '#8874C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Bot size={16} />
                      </div>
                      <div style={{ background: '#FAF9FB', padding: '12px 16px', borderRadius: 12, color: '#17151B', fontSize: 14, flex: 1, border: '1px solid #E7E3EB' }}>
                        {turn.question}
                      </div>
                    </div>
                    {turn.answer && (
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                        <div style={{ background: '#8874C7', padding: '10px 16px', borderRadius: 12, color: '#FFFFFF', fontSize: 14, maxWidth: '80%' }}>
                          {turn.answer}
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#DCD2F0', color: '#17151B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <User size={15} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Active Turn */}
                {activeTurn && !summary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FAF9FB', border: '1px solid #E7E3EB', color: '#8874C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Bot size={16} />
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: 12, color: '#17151B', fontSize: 14, flex: 1, border: '1px solid #8874C7', boxShadow: '0 4px 12px rgba(136,116,199,0.08)' }}>
                        <b style={{ display: 'block', marginBottom: 6 }}>{activeTurn.question}</b>
                        {activeTurn.explanation && (
                          <small style={{ color: '#4A4553', display: 'block', fontSize: 12, lineHeight: 1.4 }}>
                            {activeTurn.explanation}
                          </small>
                        )}
                      </div>
                    </div>

                    {/* Predefined options */}
                    {activeTurn.options && activeTurn.options.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 38 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                          {activeTurn.options.map((opt) => {
                            const isSelected = selectedChips.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={`chip-card small ${isSelected ? 'active' : ''}`}
                                disabled={busy}
                                onClick={() => {
                                  if (activeTurn.multiSelect) {
                                    setSelectedChips((prev) =>
                                      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                                    );
                                  } else {
                                    handleAnswer(opt);
                                  }
                                }}
                              >
                                <b>{opt}</b>
                              </button>
                            );
                          })}
                        </div>

                        {activeTurn.multiSelect && selectedChips.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <button
                              type="button"
                              className="primary small"
                              disabled={busy}
                              onClick={() => {
                                handleAnswer(selectedChips.join(', '));
                                setSelectedChips([]);
                              }}
                            >
                              Confirm selected ({selectedChips.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Free text answer */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customText.trim()) handleAnswer(customText);
                      }}
                      style={{ display: 'flex', gap: 8, paddingLeft: 38, marginTop: 4 }}
                    >
                      <input
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="Or type a custom answer…"
                        disabled={busy}
                        style={{ flex: 1, background: '#FAF9FB', border: '1px solid #E7E3EB', borderRadius: 8, padding: '10px 14px', color: '#17151B', fontSize: 13 }}
                      />
                      <button
                        type="submit"
                        className="primary"
                        disabled={busy || !customText.trim()}
                        style={{ minHeight: 38, padding: '0 16px' }}
                      >
                        {busy ? <Loader2 size={15} className="spin" /> : <Send size={14} />}
                      </button>
                    </form>

                    <div style={{ display: 'flex', gap: 10, paddingLeft: 38, marginTop: 4 }}>
                      {turns.length > 0 && (
                        <button
                          type="button"
                          className="ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          disabled={busy}
                          onClick={handleBack}
                        >
                          ← Back
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        style={{ fontSize: 12, padding: '4px 10px', color: '#4A4553' }}
                        disabled={busy}
                        onClick={handleSkip}
                      >
                        Skip / Not sure yet
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed Discovery Summary Card */}
                {summary && (
                  <div style={{ background: '#FAF9FB', border: '1px solid #E7E3EB', borderRadius: 16, padding: 24, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8874C7', marginBottom: 12 }}>
                      <CheckCircle2 size={20} />
                      <b style={{ fontSize: 15 }}>BACKGROUND CALIBRATION CONFIRMED</b>
                    </div>
                    <p style={{ color: '#4A4553', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
                      Your learning profile is calibrated. To unlock your personalized roadmap with verified evidence, proceed to the <b>Adaptive Technical Diagnostic</b>.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                      <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                        <small style={{ color: '#4A4553', display: 'block', fontSize: 11 }}>EDUCATION STAGE</small>
                        <b style={{ color: '#17151B', fontSize: 13 }}>{summary.educationLevel}</b>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                        <small style={{ color: '#4A4553', display: 'block', fontSize: 11 }}>PRIOR EXPERIENCE</small>
                        <b style={{ color: '#17151B', fontSize: 13 }}>{summary.programmingExperience}</b>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                        <small style={{ color: '#4A4553', display: 'block', fontSize: 11 }}>TARGET CAREER</small>
                        <b style={{ color: '#17151B', fontSize: 13 }}>{summary.careerGoal}</b>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                        <small style={{ color: '#4A4553', display: 'block', fontSize: 11 }}>WEEKLY AVAILABILITY</small>
                        <b style={{ color: '#17151B', fontSize: 13 }}>{summary.weeklyHours} hours/week</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={handleRestart}
                        disabled={busy}
                        style={{ fontSize: 13 }}
                      >
                        <RotateCcw size={14} style={{ marginRight: 6 }} /> Restart Dialogue
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={handleFinalConfirm}
                        disabled={busy}
                        style={{ minHeight: 42, padding: '0 22px', fontSize: 13 }}
                      >
                        {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={15} style={{ marginRight: 6 }} />}
                        Launch Adaptive Technical Diagnostic
                      </button>
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            ) : (
              /* Quick Form Mode */
              <form onSubmit={handleFormSubmit} className="onboarding-form">
                <div className="onboarding-group">
                  <label className="group-label">
                    <GraduationCap size={16} /> Current Education Level
                  </label>
                  <div className="chip-grid">
                    {[
                      { id: 'first_year', label: '1st Year Student', note: 'Just starting college' },
                      { id: 'second_year', label: '2nd Year Student', note: 'Covering core CS topics' },
                      { id: 'senior', label: '3rd / 4th Year', note: 'Preparing for placements' },
                      { id: 'self_taught', label: 'Self-taught / Bootcamp', note: 'Learning independently' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`chip-card ${eduLevel === opt.id ? 'active' : ''}`}
                        onClick={() => setEduLevel(opt.id)}
                      >
                        <b>{opt.label}</b>
                        <small>{opt.note}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-group">
                  <label className="group-label">
                    <Code2 size={16} /> Prior Programming Experience
                  </label>
                  <div className="chip-grid">
                    {[
                      { id: 'beginner', label: 'Complete Beginner', note: 'Never written code before' },
                      { id: 'studied_basics', label: 'Basic Coursework', note: 'Studied intro C, C++, or Python' },
                      { id: 'small_programs', label: 'Wrote Small Programs', note: 'Comfortable with loops & functions' },
                      { id: 'built_projects', label: 'Built Projects', note: 'Created apps, scripts, or websites' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`chip-card ${progExp === opt.id ? 'active' : ''}`}
                        onClick={() => setProgExp(opt.id)}
                      >
                        <b>{opt.label}</b>
                        <small>{opt.note}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-group">
                  <label className="group-label">
                    <Compass size={16} /> Target Career Role
                  </label>
                  <div className="chip-grid">
                    {[
                      { id: 'Frontend Engineer', label: 'Frontend Engineer', note: 'UI, React, JavaScript' },
                      { id: 'Backend Engineer', label: 'Backend Engineer', note: 'APIs, SQL, Databases' },
                      { id: 'Software Engineer', label: 'Software Engineer', note: 'Full-stack & Systems' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`chip-card ${careerInterest === opt.id ? 'active' : ''}`}
                        onClick={() => {
                          setCareerInterest(opt.id);
                          if (opt.id === 'Frontend Engineer') {
                            setSkillsToLearn(['JavaScript', 'React', 'Frontend Engineering']);
                            setSkillsKnown((prev) => Array.from(new Set([...prev, 'JavaScript'])));
                          } else if (opt.id === 'Backend Engineer') {
                            setSkillsToLearn(['SQL', 'REST APIs', 'Backend Engineering']);
                            setSkillsKnown((prev) => Array.from(new Set([...prev, 'SQL'])));
                          }
                        }}
                      >
                        <b>{opt.label}</b>
                        <small>{opt.note}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-actions">
                  <button type="submit" className="primary submit-setup-btn" disabled={busy}>
                    {busy ? 'Launching Diagnostic…' : 'Save & Launch Adaptive Diagnostic'}
                    <ArrowRight size={15} />
                  </button>
                  {canDismiss && onClose && (
                    <button type="button" className="ghost" onClick={onClose} disabled={busy}>
                      Skip for now
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        ) : (
          /* TAB 2: LLM-DRIVEN ADAPTIVE TECHNICAL ASSESSMENT */
          <div className="adaptive-assessment-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header info bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#FAF9FB', padding: '12px 16px', borderRadius: 12, border: '1px solid #E7E3EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={15} color="#8874C7" />
                <span style={{ fontSize: 13, color: '#17151B' }}>
                  Target Role: <b>{assessmentSession?.targetRole || careerInterest}</b>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4A4553', background: '#FFFFFF', padding: '4px 10px', borderRadius: 999, border: '1px solid #E7E3EB' }}>
                <span className="live-dot" />
                <span>{assessmentSession?.provenance === 'llm' ? 'Gemini Adaptive LLM' : 'Verified Adaptive Engine'}</span>
              </div>
            </div>

            {assessmentError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                {assessmentError}
              </div>
            )}

            {/* Assessment not complete: render active conversation & input */}
            {!assessmentSession?.isComplete ? (
              <>
                {/* Dynamic Progress indicator */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4A4553', marginBottom: 6 }}>
                    <span>Questions Evaluated: <b>{assessmentSession?.questionCount || 0}</b></span>
                    <span>Adaptive Diagnostic (3–6 questions based on evidence)</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: '#E7E3EB', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (((assessmentSession?.questionCount || 0) + 0.5) / 6) * 100)}%`,
                        height: '100%',
                        background: '#8874C7',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* History of answered questions with evaluations */}
                {assessmentSession?.history?.map((h) => (
                  <div key={h.questionNumber} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {/* Bot Question */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FAF9FB', border: '1px solid #E7E3EB', color: '#8874C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Bot size={16} />
                      </div>
                      <div style={{ background: '#FAF9FB', padding: '12px 16px', borderRadius: 12, color: '#17151B', fontSize: 14, flex: 1, border: '1px solid #E7E3EB' }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#E9B3D0', color: '#17151B' }}>
                            {h.skillId.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#4A4553' }}>
                            Level {h.difficulty} · {h.questionType}
                          </span>
                        </div>
                        {h.questionText}
                      </div>
                    </div>

                    {/* Student Answer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                      <div style={{ background: '#8874C7', padding: '10px 16px', borderRadius: 12, color: '#FFFFFF', fontSize: 14, maxWidth: '85%', whiteSpace: 'pre-wrap', fontFamily: h.studentAnswer.includes('{') ? 'var(--font-mono, monospace)' : 'inherit' }}>
                        {h.studentAnswer}
                      </div>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#DCD2F0', color: '#17151B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <User size={15} />
                      </div>
                    </div>

                    {/* Evaluator Feedback Card */}
                    <div style={{ paddingLeft: 38 }}>
                      <div style={{ background: '#FFFFFF', border: '1px solid #E7E3EB', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: '#4A4553' }}>{h.evaluation.summary}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background:
                              h.evaluation.correctness === 'correct'
                                ? '#D1FAE5'
                                : h.evaluation.correctness === 'partial'
                                ? '#FEF3C7'
                                : '#FEE2E2',
                            color:
                              h.evaluation.correctness === 'correct'
                                ? '#065F46'
                                : h.evaluation.correctness === 'partial'
                                ? '#92400E'
                                : '#991B1B',
                          }}
                        >
                          {h.evaluation.correctness.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Active Question Card */}
                {assessmentSession?.currentQuestion?.text && (
                  <div style={{ background: '#FFFFFF', border: '2px solid #8874C7', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(136,116,199,0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#DCD2F0', color: '#17151B' }}>
                          {assessmentSession.currentQuestion.skill_id.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: '#4A4553', fontWeight: 600 }}>
                          Level {assessmentSession.currentQuestion.difficulty} · {assessmentSession.currentQuestion.question_type}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: '#8874C7', fontWeight: 700 }}>
                        ACTIVE QUESTION
                      </span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#17151B', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                      {assessmentSession.currentQuestion.text}
                    </h3>

                    {/* Answer Input Area */}
                    <form onSubmit={handleAssessmentSubmit}>
                      <textarea
                        value={assessmentInput}
                        onChange={(e) => setAssessmentInput(e.target.value)}
                        placeholder="Explain your approach, trace loop/state changes, or type code here…"
                        rows={4}
                        disabled={assessmentBusy}
                        style={{
                          width: '100%',
                          background: '#FAF9FB',
                          border: '1px solid #E7E3EB',
                          borderRadius: 10,
                          padding: '12px 14px',
                          color: '#17151B',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={handleAssessmentSkip}
                          disabled={assessmentBusy}
                          style={{ fontSize: 12, color: '#4A4553' }}
                        >
                          I'm not sure / Skip question
                        </button>

                        <button
                          type="submit"
                          className="primary"
                          disabled={assessmentBusy || !assessmentInput.trim()}
                          style={{ minHeight: 40, padding: '0 20px', fontSize: 13 }}
                        >
                          {assessmentBusy ? (
                            <>
                              <Loader2 size={15} className="spin" style={{ marginRight: 6 }} />
                              Evaluating answer…
                            </>
                          ) : (
                            <>
                              Submit Explanation
                              <ArrowRight size={14} style={{ marginLeft: 6 }} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div ref={assessmentScrollRef} />
              </>
            ) : (
              /* Assessment Complete Summary */
              <div style={{ background: '#FFFFFF', border: '1px solid #E7E3EB', borderRadius: 16, padding: 28, boxShadow: '0 12px 32px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#17151B' }}>
                      Adaptive Assessment Complete!
                    </h3>
                    <small style={{ color: '#4A4553', fontSize: 12 }}>
                      Server-verified skill baseline synthesized into your evidence ledger.
                    </small>
                  </div>
                </div>

                <p style={{ color: '#17151B', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
                  <b>Diagnostic Conclusion:</b> {assessmentSession.completionReason}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <div style={{ background: '#FAF9FB', padding: 14, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <CheckCircle2 size={14} /> ASSESSED STRENGTHS
                    </span>
                    {assessmentSession.assessedStrengths.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {assessmentSession.assessedStrengths.map((s) => (
                          <span key={s} style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#4A4553' }}>Foundational focus recommended</span>
                    )}
                  </div>

                  <div style={{ background: '#FAF9FB', padding: 14, borderRadius: 10, border: '1px solid #E7E3EB' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8874C7', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <Compass size={14} /> IDENTIFIED LEARNING GAPS
                    </span>
                    {assessmentSession.assessedGaps.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {assessmentSession.assessedGaps.map((s) => (
                          <span key={s} style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', color: '#6B21A8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#4A4553' }}>No major foundational gaps found</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    className="primary"
                    style={{ minHeight: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}
                    onClick={() => {
                      if (onStartDiagnostic) {
                        onStartDiagnostic();
                      } else if (onNavigateToRoadmap) {
                        onNavigateToRoadmap();
                      } else if (onClose) {
                        onClose();
                      }
                    }}
                  >
                    Start Diagnostic Assessment
                    <ArrowRight size={15} style={{ marginLeft: 6 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
