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
} from 'lucide-react';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import {
  generateTurnId,
  sanitizeDialogueTurns,
  mergeOrAppendTurn,
  ONBOARDING_TOPIC_CONFIGS,
  type OnboardingTurn,
} from '../lib/onboarding-dialogue';

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
}: Props) {
  const [mode, setMode] = useState<'conversational' | 'form'>('conversational');
  const [busy, setBusy] = useState(false);
  const [customText, setCustomText] = useState('');
  const [turns, setTurns] = useState<OnboardingTurn[]>([]);
  const [activeTurn, setActiveTurn] = useState<OnboardingTurn | null>(null);
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

  const scrollRef = useRef<HTMLDivElement>(null);

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
              // Completed
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
              setActiveTurn(null);
            } else {
              // Create next turn for the first unanswered topic
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
          // Fresh default initial turn
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
        // Fallback default
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

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

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


  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, activeTurn, summary]);

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

    // Optimistically update turns state without duplicate keys or duplicate topics
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
        // Also update local form state
        setCareerInterest(data.summary.careerGoal || 'Software Engineer');
        setWeeklyHours(data.summary.weeklyHours || 5);
      } else if (data.nextTurn) {
        const nextTurn: OnboardingTurn = {
          ...data.nextTurn,
          id: data.nextTurn.id || generateTurnId(data.nextTurn.topic || 'step'),
        };
        setActiveTurn(nextTurn);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit answer. Please retry.');
      // Restore turn so student can re-attempt
      setActiveTurn(currentTurn);
      if (existingTurn) {
        // Roll back to previously valid answer without discarding it
        setTurns((prev) => prev.map((t) => (t.id === existingTurn.id ? existingTurn : t)));
      } else {
        // Remove optimistic entry if it was a new turn
        setTurns((prev) => prev.filter((t) => t.id !== currentTurn.id));
      }
    } finally {
      setBusy(false);
    }
  };

  // Complete onboarding
  const handleFinalConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      // 1. Mark onboarding complete in workflow engine
      await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      // 2. Persist student capability profile
      const chosenGoal = summary?.careerGoal || careerInterest;
      const hours = summary?.weeklyHours || weeklyHours;
      await onSave({
        educationLevel: eduLevel,
        programmingExperience: progExp,
        fieldOfStudy: 'computer_science',
        careerInterests: [chosenGoal],
        weeklyHours: hours,
        focusAreas: skillsToLearn.length > 0 ? skillsToLearn : [summary?.struggles || 'Programming Fundamentals'],
        skillsToLearn,
        skillsKnown,
        onboardingCompleted: true,
      });

      if (onClose) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize calibration');
    } finally {
      setBusy(false);
    }
  };

  // Quick form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // Complete through workflow endpoint
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
      if (onClose) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save calibration');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboarding-modal" style={{ maxWidth: 660, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="onboarding-head">
          <div className="onboarding-badge">
            <Sparkles size={14} />
            <span>DYNAMIC AI ONBOARDING</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="ghost"
              style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
              onClick={() => setMode(mode === 'conversational' ? 'form' : 'conversational')}
            >
              {mode === 'conversational' ? 'Switch to Quick Form' : 'Switch to Dialogue'}
            </button>
            {canDismiss && onClose && (
              <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close setup">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <h2 id="onboard-title">Welcome to SkillPilot. Tell us where you are starting.</h2>
        <p className="onboarding-sub">
          We tailor your diagnostic questions and roadmap to your real background. Starting as a beginner is expected and valued.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {mode === 'conversational' ? (
          <div className="onboarding-chat-stream" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Progress indicator */}
            {!summary && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                  <span>Question {Math.min(turns.length + 1, ONBOARDING_TOPIC_CONFIGS.length)} of {ONBOARDING_TOPIC_CONFIGS.length}</span>
                  <span>{Math.round((turns.length / ONBOARDING_TOPIC_CONFIGS.length) * 100)}% calibrated</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(turns.length / ONBOARDING_TOPIC_CONFIGS.length) * 100}%`, height: '100%', background: 'var(--cyan)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {/* Answered turns */}
            {turns.map((turn, idx) => (
              <div key={turn.id || `turn-${turn.topic || idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-indigo)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={16} />
                  </div>
                  <div style={{ background: 'var(--surface-indigo)', padding: '12px 16px', borderRadius: 12, color: '#FFFFFF', fontSize: 14, flex: 1, border: '1px solid var(--line)' }}>
                    {turn.question}
                  </div>
                </div>
                {turn.answer && (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                    <div style={{ background: 'var(--primary)', padding: '10px 16px', borderRadius: 12, color: '#FFFFFF', fontSize: 14, maxWidth: '80%' }}>
                      {turn.answer}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
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
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-indigo)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={16} />
                  </div>
                  <div style={{ background: 'var(--surface-navy)', padding: '14px 18px', borderRadius: 12, color: '#FFFFFF', fontSize: 14, flex: 1, border: '1px solid var(--cyan-border)', boxShadow: 'var(--shadow-sm)' }}>
                    <b style={{ color: 'var(--cyan)', display: 'block', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Step {turns.length + 1} of {ONBOARDING_TOPIC_CONFIGS.length} · {activeTurn.topic.toUpperCase().replace('_', ' ')}
                    </b>
                    <div>{activeTurn.question}</div>
                    {activeTurn.explanation && (
                      <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 8, fontStyle: 'italic', opacity: 0.9 }}>
                        {activeTurn.explanation}
                      </div>
                    )}
                  </div>
                </div>

                {/* Option Chips (Single or Multi-select) */}
                {activeTurn.options && activeTurn.options.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 38 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {activeTurn.options.map((opt, i) => {
                        const isSelected = selectedChips.includes(opt);
                        return (
                          <button
                            key={i}
                            type="button"
                            className="chip-card small"
                            style={{
                              background: isSelected ? 'var(--primary)' : 'var(--surface-indigo)',
                              borderColor: isSelected ? 'var(--cyan)' : undefined,
                              color: isSelected ? '#FFFFFF' : undefined,
                              cursor: busy ? 'not-allowed' : 'pointer',
                            }}
                            disabled={busy}
                            onClick={() => {
                              if (activeTurn.multiSelect) {
                                if (opt.includes('None') || opt.includes('fresh')) {
                                  setSelectedChips([opt]);
                                } else {
                                  const filtered = selectedChips.filter((c) => !c.includes('None') && !c.includes('fresh'));
                                  setSelectedChips(
                                    isSelected ? filtered.filter((c) => c !== opt) : [...filtered, opt]
                                  );
                                }
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
                          Confirm selected skills ({selectedChips.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Free text custom answer */}
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
                    style={{ flex: 1, background: 'var(--surface-indigo)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', color: '#FFF', fontSize: 13 }}
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

                {/* Back and Skip navigation buttons */}
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
                    style={{ fontSize: 12, padding: '4px 10px', color: 'var(--text-secondary)' }}
                    disabled={busy}
                    onClick={handleSkip}
                  >
                    Skip / Not sure yet
                  </button>
                </div>
              </div>
            )}

            {/* Completed Summary Card */}
            {summary && (
              <div style={{ background: 'var(--surface-navy)', border: '1px solid var(--cyan-border)', borderRadius: 12, padding: 20, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyan)', marginBottom: 12 }}>
                  <CheckCircle2 size={18} />
                  <b style={{ fontSize: 14 }}>SELF-REPORTED BASELINE SUMMARY</b>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                  Here is the profile we compiled from our dialogue. We will use this to generate beginner-friendly diagnostic questions.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'var(--surface-indigo)', padding: 12, borderRadius: 8 }}>
                    <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>EDUCATION STAGE</small>
                    <b style={{ color: '#FFF', fontSize: 13 }}>{summary.educationLevel}</b>
                  </div>
                  <div style={{ background: 'var(--surface-indigo)', padding: 12, borderRadius: 8 }}>
                    <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>PRIOR EXPERIENCE</small>
                    <b style={{ color: '#FFF', fontSize: 13 }}>{summary.programmingExperience}</b>
                  </div>
                  <div style={{ background: 'var(--surface-indigo)', padding: 12, borderRadius: 8 }}>
                    <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>PRIMARY CAREER GOAL</small>
                    <b style={{ color: '#FFF', fontSize: 13 }}>{summary.careerGoal}</b>
                  </div>
                  <div style={{ background: 'var(--surface-indigo)', padding: 12, borderRadius: 8 }}>
                    <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>WEEKLY AVAILABILITY</small>
                    <b style={{ color: '#FFF', fontSize: 13 }}>{summary.weeklyHours} hours/week</b>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,240,255,0.06)', borderLeft: '3px solid var(--cyan)', padding: '10px 14px', borderRadius: 4, marginBottom: 20 }}>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    <b>Important:</b> This is your self-reported starting profile. Your personalized roadmap will unlock after you verify these concepts in your diagnostic assessment.
                  </small>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={async () => {
                      setSummary(null);
                      setTurns([]);
                      const first = ONBOARDING_TOPIC_CONFIGS[0];
                      const freshTurn: OnboardingTurn = {
                        id: generateTurnId(first.topic),
                        topic: first.topic,
                        question: first.defaultQuestion,
                        explanation: first.explanation,
                        options: first.options,
                        multiSelect: first.multiSelect,
                        allowSkip: true,
                      };
                      setActiveTurn(freshTurn);
                      try {
                        const res = await fetch('/api/workflow/onboarding', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'restart' }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.nextTurn) {
                            setActiveTurn(data.nextTurn);
                          }
                        }
                      } catch {}
                    }}
                    disabled={busy}
                  >
                    <RotateCcw size={14} /> Restart Dialogue
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleFinalConfirm}
                    disabled={busy}
                    style={{ minHeight: 42, padding: '0 20px' }}
                  >
                    {busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
                    Confirm Profile & Start Diagnostic
                  </button>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        ) : (
          /* Form Fallback Mode */
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
                <Compass size={16} /> Primary Career Interest
              </label>
              <div className="chip-grid compact">
                {[
                  'Software Engineer',
                  'Frontend Engineer',
                  'Backend Engineer',
                  'Full Stack Engineer',
                  'Exploring / Not Sure Yet',
                ].map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`chip-card small ${careerInterest === role ? 'active' : ''}`}
                    onClick={() => setCareerInterest(role)}
                  >
                    <b>{role}</b>
                  </button>
                ))}
              </div>
            </div>

            <div className="onboarding-group">
              <label className="group-label">
                <Clock size={16} /> Weekly Learning Availability
              </label>
              <div className="chip-grid compact">
                {[
                  { hours: 3, label: '3 hrs/week', note: 'Light pace' },
                  { hours: 5, label: '5 hrs/week', note: 'Steady (Recommended)' },
                  { hours: 10, label: '10 hrs/week', note: 'Accelerated' },
                  { hours: 15, label: '15+ hrs/week', note: 'Intensive' },
                ].map((item) => (
                  <button
                    key={item.hours}
                    type="button"
                    className={`chip-card small ${weeklyHours === item.hours ? 'active' : ''}`}
                    onClick={() => setWeeklyHours(item.hours)}
                  >
                    <b>{item.label}</b>
                    <small>{item.note}</small>
                  </button>
                ))}
              </div>
            </div>

            {/* Searchable Categorized Skill Selector */}
            <div className="onboarding-group">
              <label className="group-label">
                <Sparkles size={16} /> Select Skills: Prior Knowledge vs What You Want to Learn
              </label>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                Click once to mark as <b>"Want to Learn"</b> (Green), click again to mark as <b>"Know Already"</b> (Blue).
              </p>
              <input
                type="text"
                value={skillSearchQuery}
                onChange={(e) => setSkillSearchQuery(e.target.value)}
                placeholder="Search skills (e.g. C, Python, SQL, React, Loops, APIs)..."
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: '#FFF',
                  fontSize: 13,
                  marginBottom: 14,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ONBOARDING_SKILL_CATEGORIES.map((cat, idx) => {
                  const filtered = cat.skills.filter((s) =>
                    s.toLowerCase().includes(skillSearchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div key={idx} style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--cyan)', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                        {cat.category.toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {filtered.map((skill) => {
                          const isLearn = skillsToLearn.includes(skill);
                          const isKnown = skillsKnown.includes(skill);
                          let badgeBg = 'transparent';
                          let badgeBorder = 'var(--line)';
                          let badgeColor = 'var(--text-secondary)';
                          let label = skill;

                          if (isLearn) {
                            badgeBg = 'rgba(16, 185, 129, 0.18)';
                            badgeBorder = 'rgba(16, 185, 129, 0.4)';
                            badgeColor = '#34D399';
                            label = `${skill} ★ Want to Learn`;
                          } else if (isKnown) {
                            badgeBg = 'rgba(77, 141, 255, 0.18)';
                            badgeBorder = 'rgba(77, 141, 255, 0.4)';
                            badgeColor = '#60A5FA';
                            label = `${skill} ✓ Know Already`;
                          }

                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => {
                                if (!isLearn && !isKnown) {
                                  setSkillsToLearn((prev) => [...prev, skill]);
                                } else if (isLearn) {
                                  setSkillsToLearn((prev) => prev.filter((s) => s !== skill));
                                  setSkillsKnown((prev) => [...prev, skill]);
                                } else {
                                  setSkillsKnown((prev) => prev.filter((s) => s !== skill));
                                }
                              }}
                              style={{
                                background: badgeBg,
                                border: `1px solid ${badgeBorder}`,
                                color: badgeColor,
                                padding: '5px 12px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="onboarding-actions">
              <button type="submit" className="primary submit-setup-btn" disabled={busy}>
                {busy ? 'Saving calibration…' : 'Save & Continue to Diagnostic'}
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
    </div>
  );
}
