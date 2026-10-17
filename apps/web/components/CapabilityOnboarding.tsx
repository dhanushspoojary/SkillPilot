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

interface Props {
  initialProfile?: StudentCapabilityProfile;
  onSave: (profile: StudentCapabilityProfile) => Promise<void>;
  onClose?: () => void;
  canDismiss?: boolean;
}

interface DialogueTurn {
  id: string;
  topic: string;
  question: string;
  options?: string[];
  answer?: string;
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
  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [activeTurn, setActiveTurn] = useState<DialogueTurn | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');

  // Fallback form state
  const [eduLevel, setEduLevel] = useState(initialProfile?.educationLevel || 'first_year');
  const [progExp, setProgExp] = useState(initialProfile?.programmingExperience || 'beginner');
  const [careerInterest, setCareerInterest] = useState(initialProfile?.careerInterests?.[0] || 'Software Engineer');
  const [weeklyHours, setWeeklyHours] = useState(initialProfile?.weeklyHours || 5);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize dynamic onboarding from server
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch('/api/workflow', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const dialogue: DialogueTurn[] = data.state?.onboardingDialogue || [];
        if (dialogue.length > 0) {
          const answered = dialogue.filter((d) => d.answer);
          const unanswered = dialogue.find((d) => !d.answer);
          setTurns(answered);
          if (unanswered) {
            setActiveTurn(unanswered);
          } else if (answered.length >= 5) {
            // Already complete
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
          } else {
            setActiveTurn(dialogue[dialogue.length - 1]);
          }
        } else {
          // Default initial question
          setActiveTurn({
            id: 'turn-1',
            topic: 'education',
            question: 'Welcome to SkillPilot! Which best describes your current college or learning stage?',
            options: [
              '1st Year Student (Just starting college)',
              '2nd Year Student (Core CS subjects)',
              '3rd / 4th Year (Placement prep)',
              'Self-taught / Bootcamp (Independent learner)',
            ],
          });
        }
      } catch {
        // Fallback default
        setActiveTurn({
          id: 'turn-1',
          topic: 'education',
          question: 'Welcome to SkillPilot! Which best describes your current college or learning stage?',
          options: [
            '1st Year Student (Just starting college)',
            '2nd Year Student (Core CS subjects)',
            '3rd / 4th Year (Placement prep)',
            'Self-taught / Bootcamp (Independent learner)',
          ],
        });
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, activeTurn, summary]);

  // Answer a turn
  const handleAnswer = async (answerText: string) => {
    if (!answerText.trim() || busy) return;
    setBusy(true);
    setError('');

    const currentTurn = activeTurn || {
      id: `turn-${turns.length + 1}`,
      topic: 'general',
      question: '',
    };

    // Optimistically update turns
    const updatedTurns = [
      ...turns,
      { ...currentTurn, answer: answerText.trim() },
    ];
    setTurns(updatedTurns);
    setActiveTurn(null);
    setCustomText('');

    try {
      const res = await fetch('/api/workflow/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record response');

      if (data.isComplete && data.summary) {
        setSummary(data.summary);
        // Also update local form state
        setCareerInterest(data.summary.careerGoal || 'Software Engineer');
        setWeeklyHours(data.summary.weeklyHours || 5);
      } else if (data.nextTurn) {
        setActiveTurn(data.nextTurn);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit answer. Please retry.');
      // Restore turn so student can re-attempt
      setActiveTurn(currentTurn);
      setTurns(turns);
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
        focusAreas: [summary?.struggles || 'Programming Fundamentals'],
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
        focusAreas: ['Programming Fundamentals', 'Problem Solving'],
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
            {/* Answered turns */}
            {turns.map((turn, idx) => (
              <div key={turn.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      Step {turns.length + 1} of 5
                    </b>
                    {activeTurn.question}
                  </div>
                </div>

                {/* Option Chips */}
                {activeTurn.options && activeTurn.options.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 38 }}>
                    {activeTurn.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className="chip-card small"
                        style={{ background: 'var(--surface-indigo)', cursor: busy ? 'not-allowed' : 'pointer' }}
                        disabled={busy}
                        onClick={() => handleAnswer(opt)}
                      >
                        <b>{opt}</b>
                      </button>
                    ))}
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
                    onClick={() => {
                      setSummary(null);
                      setTurns([]);
                      setActiveTurn({
                        id: 'turn-1',
                        topic: 'education',
                        question: 'Welcome to SkillPilot! Which best describes your current college or learning stage?',
                        options: [
                          '1st Year Student (Just starting college)',
                          '2nd Year Student (Core CS subjects)',
                          '3rd / 4th Year (Placement prep)',
                          'Self-taught / Bootcamp (Independent learner)',
                        ],
                      });
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
