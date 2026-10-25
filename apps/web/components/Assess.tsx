'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  CheckCircle2,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  BookmarkCheck,
  ChevronRight,
  Sparkles,
  Code,
  FileText,
} from 'lucide-react';
import type { Evidence } from '../lib/types';
import {
  validateAssessmentQuestion,
  type ValidatedAssessmentQuestion,
} from '../lib/question-contract';

export type AdaptationPayload = {
  direction: 'ELEVATED' | 'DIAGNOSTIC' | 'RESOLVING';
  previousLevel: number;
  nextLevel: number;
  reason: string;
  skill?: string;
  evidenceCount?: number;
  decisiveReached?: boolean;
};

const SKILL_NAMES: Record<string, string> = {
  'rest-apis': 'REST APIs',
  sql: 'SQL',
  'problem-solving': 'Problem solving',
  javascript: 'JavaScript',
  git: 'Git & GitHub',
  communication: 'Communication',
};

type ResultItem = {
  skill: string;
  asked: number;
  correct: number;
  score: number;
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network error');
}

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) {
    return 'Unable to connect to the SkillPilot server. Please verify your connection or ensure the server is running, then try again.';
  }
  if (msg.includes('rate_limit') || msg.includes('429')) {
    return 'Assessment limit reached for this hour. Please wait a few moments before trying again.';
  }
  if (msg.includes('cooldown')) {
    return 'You recently completed an assessment. Please wait before starting a new diagnostic.';
  }
  return msg || fallback;
}

export function Assess({
  evidence,
  focus,
  careerGoal = 'Software Engineer',
  onFinish,
  onDone,
}: {
  evidence: Evidence[];
  focus?: string;
  careerGoal?: string;
  onFinish: (r?: any[]) => Promise<void> | void;
  onDone: () => void;
}) {
  const [assessmentId, setAssessmentId] = useState('');
  const [q, setQ] = useState<ValidatedAssessmentQuestion | null>(null);
  const [rawQuestionId, setRawQuestionId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [openEndedAnswer, setOpenEndedAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [isResumed, setIsResumed] = useState(false);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [confirmationStep, setConfirmationStep] = useState<'review' | 'skills_confirmed' | 'all_confirmed'>('review');
  const [selectedGoal, setSelectedGoal] = useState(careerGoal);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [busy, setBusy] = useState(true);
  const [busyMessage, setBusyMessage] = useState('Preparing your diagnostic…');
  const [startError, setStartError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [adaptationInfo, setAdaptationInfo] = useState<AdaptationPayload | null>(null);
  const isMountedRef = useRef(true);
  const startInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (careerGoal) {
      setSelectedGoal(careerGoal);
    }
  }, [careerGoal]);

  const start = useCallback(async (overrideFocus?: string) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setBusy(true);
    setBusyMessage('Preparing your diagnostic…');
    setStartError('');
    setSubmitError('');
    setPicked(null);
    setOpenEndedAnswer('');
    setFeedback(null);
    setAdaptationInfo(null);
    setResults(null);
    setValidationError(null);

    try {
      const targetFocus = overrideFocus !== undefined ? overrideFocus : focus;
      const r = await fetchWithRetry('/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: targetFocus }),
      });

      let data: any = {};
      try {
        data = await r.json();
      } catch {
        /* Non-JSON response */
      }

      if (!r.ok) {
        throw new Error(
          data.error ||
            (r.status === 429
              ? 'Assessment rate limit reached. Please try again shortly.'
              : 'Could not start diagnostic'),
        );
      }

      if (!isMountedRef.current) return;

      const rawQ = data.question;
      const qid =
        rawQ && typeof rawQ === 'object' && ('id' in rawQ || 'question_id' in rawQ)
          ? String((rawQ as any).id || (rawQ as any).question_id)
          : null;
      setRawQuestionId(qid);

      const validation = validateAssessmentQuestion(rawQ);
      if (validation.valid) {
        setQ(validation.question);
        setValidationError(null);
      } else {
        setQ(null);
        setValidationError(validation.error);
      }

      setAssessmentId(data.assessmentId);
      setTotal(data.total || 12);
      setIndex(data.index ?? 0);
      setIsResumed(Boolean(data.resumed));
    } catch (e) {
      if (!isMountedRef.current) return;
      setStartError(friendlyErrorMessage(e, 'Could not start diagnostic'));
    } finally {
      startInFlightRef.current = false;
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  }, [focus]);

  useEffect(() => {
    void start();
  }, [start]);

  const submit = useCallback(
    async (overrideOptions?: { action?: 'skip' | 'dont_know'; choice?: number }) => {
      const isSkipAction =
        overrideOptions?.action === 'skip' || overrideOptions?.action === 'dont_know';
      const targetQid = q?.id || rawQuestionId || 'current';

      if (!isSkipAction && !q) return;
      if (!assessmentId || busy || submitInFlightRef.current) return;

      if (!isSkipAction) {
        if (q?.type === 'multiple_choice' && picked === null) {
          setSubmitError('Please select an answer option above before proceeding to the next question.');
          return;
        }
        if (q?.type !== 'multiple_choice' && !openEndedAnswer.trim()) {
          setSubmitError('Please enter your response or explanation before submitting.');
          return;
        }
      }

      submitInFlightRef.current = true;
      setBusy(true);
      setBusyMessage(isSkipAction ? 'Advancing to next question…' : 'Recording and scoring answer…');
      setSubmitError('');

      try {
        const payload: Record<string, any> = {
          assessmentId,
          questionId: targetQid,
        };

        if (isSkipAction) {
          payload.action = 'skip';
          payload.choice = -1;
        } else if (q?.type === 'multiple_choice') {
          payload.choice = picked;
        } else {
          payload.choice = 0;
          payload.answerText = openEndedAnswer.trim();
        }

        const r = await fetchWithRetry('/api/assess/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let data: any = {};
        try {
          data = await r.json();
        } catch {
          /* Non-JSON response */
        }

        if (!r.ok) {
          throw new Error(data.error || 'Could not record your answer');
        }

        if (!isMountedRef.current) return;

        if (data.done) {
          setFeedback('Assessment complete! Computing your authoritative results…');
          const resList = Array.isArray(data.results) ? data.results : [];
          setResults(resList);
          await onFinish(resList);
          setBusy(false);
          submitInFlightRef.current = false;
        } else {
          if (data.adaptation) {
            setAdaptationInfo(data.adaptation);
          }
          setFeedback(
            isSkipAction
              ? 'Question skipped without score penalty. Next question selected.'
              : data.adaptation?.direction === 'ELEVATED'
              ? `Correct! Elevating challenge to Level ${data.adaptation.nextLevel}.`
              : data.adaptation?.direction === 'DIAGNOSTIC'
              ? `Answer recorded. Routing to Level ${data.adaptation.nextLevel} diagnostic.`
              : 'Answer recorded. Next adaptive question selected.'
          );

          window.setTimeout(() => {
            if (!isMountedRef.current) return;
            try {
              const rawNext = data.question;
              const nextQid =
                rawNext && typeof rawNext === 'object' && ('id' in rawNext || 'question_id' in rawNext)
                  ? String((rawNext as any).id || (rawNext as any).question_id)
                  : null;
              setRawQuestionId(nextQid);

              const nextValidation = validateAssessmentQuestion(rawNext);
              if (nextValidation.valid) {
                setQ(nextValidation.question);
                setValidationError(null);
              } else {
                setQ(null);
                setValidationError(nextValidation.error);
              }

              setIndex(typeof data.index === 'number' ? data.index : index + 1);
              if (data.total) setTotal(data.total);
            } catch (parseErr) {
              console.error('Error parsing next question', parseErr);
            } finally {
              setPicked(null);
              setOpenEndedAnswer('');
              setFeedback(null);
              setBusy(false);
              submitInFlightRef.current = false;
            }
          }, 400);
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        setSubmitError(friendlyErrorMessage(e, 'Could not submit your answer. Please retry.'));
        setBusy(false);
        submitInFlightRef.current = false;
      }
    },
    [q, rawQuestionId, picked, openEndedAnswer, assessmentId, busy, index, onFinish],
  );

  // Keyboard navigation: A/B/C/D or 1/2/3/4 and Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (busy || !q || feedback || results) return;
      const key = e.key.toUpperCase();
      const num = parseInt(e.key, 10);

      if (q.type === 'multiple_choice') {
        if (['A', 'B', 'C', 'D'].includes(key)) {
          const optionIndex = key.charCodeAt(0) - 65;
          if (optionIndex < (q.options?.length ?? 0)) {
            setPicked(optionIndex);
            setSubmitError('');
          }
        } else if (!isNaN(num) && num >= 1 && num <= (q.options?.length ?? 0)) {
          setPicked(num - 1);
          setSubmitError('');
        }
      }

      if (e.key === 'Enter') {
        // Only trigger submit on enter if not in a textarea
        const activeElement = document.activeElement;
        const isTextarea = activeElement instanceof HTMLTextAreaElement;
        if (!isTextarea) {
          e.preventDefault();
          if (q.type === 'multiple_choice' && picked === null) {
            setSubmitError('Please select an answer option above before proceeding to the next question.');
          } else if (q.type !== 'multiple_choice' && !openEndedAnswer.trim()) {
            setSubmitError('Please enter your response or explanation before submitting.');
          } else {
            void submit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, q, feedback, results, picked, openEndedAnswer, submit]);

  // Full start error view (server unreachable before assessment started)
  if (startError) {
    return (
      <div className="assessment-shell">
        <div className="result">
          <div className="result-icon-alert" role="img" aria-label="Error">
            <AlertTriangle size={32} />
          </div>
          <span className="kicker">DIAGNOSTIC SERVICE NOTICE</span>
          <h2>Unable to Start Diagnostic</h2>
          <p className="error-desc">{startError}</p>
          <div className="result-actions">
            <button className="primary" onClick={() => void start()} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
              Retry Connection
            </button>
            <button className="ghost" onClick={onDone}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed results view
  if (results) {
    const avgScore = Math.round(
      results.reduce((s, r) => s + r.score, 0) / Math.max(1, results.length),
    );
    const strengths = results.filter((r) => r.score >= 70);
    const gaps = results.filter((r) => r.score < 70);

    const handleConfirmSkills = async () => {
      setWorkflowBusy(true);
      setWorkflowError('');
      try {
        const res = await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_skills',
            confirmedSkills: results.map((r) => ({ skill: r.skill, score: r.score })),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to confirm baseline on the server.');
        }
        setConfirmationStep('skills_confirmed');
      } catch (err) {
        setWorkflowError(err instanceof Error ? err.message : 'Could not confirm skill baseline.');
      } finally {
        setWorkflowBusy(false);
      }
    };

    const handleConfirmGoals = async () => {
      setWorkflowBusy(true);
      setWorkflowError('');
      try {
        const res = await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_goals',
            goals: [selectedGoal],
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to confirm goals on the server.');
        }
        setConfirmationStep('all_confirmed');
        await onFinish(results);
      } catch (err) {
        setWorkflowError(err instanceof Error ? err.message : 'Could not confirm goals.');
      } finally {
        setWorkflowBusy(false);
      }
    };

    const handleDoneClick = async () => {
      if (confirmationStep !== 'all_confirmed') {
        await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_skills',
            confirmedSkills: results.map((r) => ({ skill: r.skill, score: r.score })),
          }),
        }).catch(() => {});
        await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_goals',
            goals: [selectedGoal],
          }),
        }).catch(() => {});
        await onFinish(results);
      }
      onDone();
    };

    return (
      <div className="assessment-shell">
        <div className="result">
          <div className="result-icon">
            <CheckCircle2 size={36} />
          </div>
          <span className="kicker">SERVER-SCORED DIAGNOSTIC COMPLETE</span>
          <h2 className="score-headline">{avgScore}%</h2>
          <p className="score-sub">
            All questions were scored on the server. Your evidence has been
            authoritatively recorded in your profile.
          </p>

          <div className="results-breakdown">
            <div className="results-col">
              <span className="breakdown-title">
                <BookmarkCheck size={14} /> Strengths Demonstrated
              </span>
              {strengths.length > 0 ? (
                <ul className="result-list">
                  {strengths.map((r) => (
                    <li key={r.skill}>
                      <div>
                        <b>{SKILL_NAMES[r.skill] || r.skill}</b>
                        <small>{r.correct}/{r.asked} correct</small>
                      </div>
                      <span className="score-tag green">{r.score}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-italic">Focus on fundamentals across all skills.</p>
              )}
            </div>

            <div className="results-col">
              <span className="breakdown-title">
                <Sparkles size={14} /> Priority Skill Gaps
              </span>
              {gaps.length > 0 ? (
                <ul className="result-list">
                  {gaps.map((r) => (
                    <li key={r.skill}>
                      <div>
                        <b>{SKILL_NAMES[r.skill] || r.skill}</b>
                        <small>{r.correct}/{r.asked} correct</small>
                      </div>
                      <span className="score-tag orange">{r.score}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-italic">Excellent work! All assessed skills meet targets.</p>
              )}
            </div>
          </div>

          {/* Workflow Calibration & Baseline Confirmation Section */}
          <div style={{ width: '100%', background: 'var(--surface-navy, #F5F3FA)', border: '1px solid var(--cyan-border, #E7E3EB)', borderRadius: 12, padding: 20, textAlign: 'left', marginTop: 8 }}>
            {workflowError && <div className="auth-error" style={{ marginBottom: 14 }}>{workflowError}</div>}
            {confirmationStep === 'review' && (
              <div>
                <span className="kicker" style={{ color: 'var(--primary-purple, #8874C7)' }}>STEP 1: CONFIRM SKILL BASELINE</span>
                <h3 style={{ margin: '4px 0 8px 0', fontSize: 16, color: 'var(--text-primary, #17151B)' }}>Review & Acknowledge Your Baseline</h3>
                <p style={{ color: 'var(--secondary-text, #77727F)', fontSize: 13, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  SkillPilot requires you to confirm this baseline before generating your roadmap. Acknowledging realistic scores ensures your milestones start at your true level without penalty.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="primary"
                    onClick={handleConfirmSkills}
                    disabled={workflowBusy}
                    style={{ minHeight: 40, padding: '0 18px', fontSize: 13 }}
                  >
                    {workflowBusy ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                    Confirm Skill Baseline
                  </button>
                  {gaps.length > 0 && (
                    <button
                      className="ghost"
                      onClick={() => {
                        void start(gaps[0].skill);
                      }}
                      disabled={workflowBusy}
                      style={{ minHeight: 40, padding: '0 14px', fontSize: 13 }}
                    >
                      <RefreshCcw size={14} /> Retest {SKILL_NAMES[gaps[0].skill] || gaps[0].skill}
                    </button>
                  )}
                </div>
              </div>
            )}

            {confirmationStep === 'skills_confirmed' && (
              <div>
                <span className="kicker" style={{ color: 'var(--primary-purple, #8874C7)' }}>STEP 2: CONFIRM LEARNING GOALS</span>
                <h3 style={{ margin: '4px 0 8px 0', fontSize: 16, color: 'var(--text-primary, #17151B)' }}>Baseline Confirmed · Calibrate Career Target</h3>
                <p style={{ color: 'var(--secondary-text, #77727F)', fontSize: 13, margin: '0 0 14px 0', lineHeight: 1.5 }}>
                  Select or confirm your primary career target to tailor your 12-week roadmap milestones:
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`chip-card small ${selectedGoal === role ? 'active' : ''}`}
                      onClick={() => setSelectedGoal(role)}
                      style={{ background: '#FAF9FB', padding: '8px 14px' }}
                    >
                      <b>{role}</b>
                    </button>
                  ))}
                </div>
                <button
                  className="primary"
                  onClick={handleConfirmGoals}
                  disabled={workflowBusy}
                  style={{ minHeight: 40, padding: '0 18px', fontSize: 13 }}
                >
                  {workflowBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                  Confirm Goals & Unlock Roadmap
                </button>
              </div>
            )}

            {confirmationStep === 'all_confirmed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <b style={{ color: 'var(--text-primary, #17151B)', fontSize: 15, display: 'block' }}>Baseline & Goals Confirmed</b>
                  <span style={{ color: 'var(--primary-purple, #8874C7)', fontSize: 12 }}>Roadmap unlocked! Your 12-week milestones reflect your confirmed baseline.</span>
                </div>
              </div>
            )}
          </div>

          <div className="result-actions" style={{ marginTop: 20 }}>
            <button className="primary" onClick={handleDoneClick}>
              See Updated Roadmap <ArrowRight size={15} />
            </button>
            <button className="ghost" onClick={() => void start()}>
              <RefreshCcw size={15} /> Retake Diagnostic
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (busy && !q && !validationError) {
    return (
      <div className="assessment-shell">
        <div className="result">
          <div className="loading-spinner">
            <Loader2 size={36} className="spin text-primary" />
          </div>
          <span className="kicker">SECURE DIAGNOSTIC</span>
          <h2>{busyMessage}</h2>
          <p>
            Questions are generated and scored exclusively on the server. Answer
            keys never touch your device.
          </p>
        </div>
      </div>
    );
  }

  // Question validation failure / Malformed question recovery card
  if (validationError || (!q && !busy)) {
    return (
      <div className="assessment-shell">
        <div className="question-recovery-card" role="alert">
          <div className="result-icon-alert" role="img" aria-label="Notice">
            <AlertTriangle size={36} />
          </div>
          <span className="kicker">ASSESSMENT RESILIENCE RECOVERY</span>
          <h2>Diagnostic Question Notice</h2>
          <p className="error-desc">
            {validationError
              ? `The diagnostic question format could not be verified securely (${validationError}).`
              : 'The question data is currently unavailable.'}
            <br />
            Your verified progress is preserved on the server.
          </p>
          <div className="result-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void submit({ action: 'skip' })}
              disabled={busy}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              Skip to Next Question
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void start()}
              disabled={busy}
            >
              <RefreshCcw size={16} />
              Retry Diagnostic
            </button>
            <button type="button" className="ghost" onClick={onDone}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const answered =
    q.type === 'multiple_choice' ? picked !== null : openEndedAnswer.trim().length > 0;
  const progressPercent = total > 0 ? Math.round(((index + (answered ? 1 : 0)) / total) * 100) : 0;

  return (
    <div className="assessment-shell">
      {/* Resume Banner */}
      {isResumed && (
        <div className="resume-banner" role="status">
          <BookmarkCheck size={16} />
          <span>
            Resumed assessment in progress. Continuing from question {index + 1} of {total}.
          </span>
        </div>
      )}

      {/* Adaptive Progression Banner */}
      {adaptationInfo && (
        <div
          className={`adaptive-progression-banner ${adaptationInfo.direction.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          <div className="adaptive-badge">
            {adaptationInfo.direction === 'ELEVATED' ? (
              <>
                <ArrowUpRight size={15} /> Level {adaptationInfo.previousLevel} → Level {adaptationInfo.nextLevel} (Elevated Challenge)
              </>
            ) : adaptationInfo.direction === 'DIAGNOSTIC' ? (
              <>
                <ArrowDownRight size={15} /> Level {adaptationInfo.previousLevel} → Level {adaptationInfo.nextLevel} (Diagnostic Prerequisite)
              </>
            ) : (
              <>
                <Sliders size={15} /> Calibrated to Level {adaptationInfo.nextLevel}
              </>
            )}
          </div>
          <span className="adaptive-reason">{adaptationInfo.reason}</span>
        </div>
      )}

      {/* Progress Header */}
      <div className="assessment-top">
        <div className="progress-info">
          <span className="kicker">
            QUESTION {index + 1} OF {total}
          </span>
          <div className="progress-bar-track" aria-hidden="true">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>
        <div className="skill-pill">
          <b>{SKILL_NAMES[q.skill] || q.skill}</b>
          <span className="level-badge">Level {q.level}</span>
        </div>
      </div>

      <h2 className="question-text">{q.q}</h2>

      {/* Multiple Choice Question Renderer */}
      {q.type === 'multiple_choice' && (
        <div className="options" role="group" aria-label="Answer options">
          {q.options.map((option, i) => {
            const isSelected = picked === i;
            return (
              <button
                key={`${q.id}-opt-${i}`}
                type="button"
                className={`option-btn ${isSelected ? 'selected-answer' : ''}`}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!busy) {
                    setPicked(i);
                    setSubmitError('');
                  }
                }}
                disabled={busy}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span className="option-content">{option}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Non-Multiple Choice Question Renderer (Conceptual, Code Tracing, Debugging, Practical) */}
      {q.type !== 'multiple_choice' && (
        <div className="open-ended-container">
          {q.codeSnippet && (
            <div className="code-snippet-wrapper">
              <div className="code-header">
                <Code size={14} />
                <span>Code Snippet</span>
              </div>
              <pre className="code-snippet-box">
                <code>{q.codeSnippet}</code>
              </pre>
            </div>
          )}
          <label htmlFor="open-ended-input" className="open-ended-label">
            <FileText size={14} />
            <span>Your Response / Explanation</span>
          </label>
          <textarea
            id="open-ended-input"
            className="open-ended-textarea"
            rows={5}
            value={openEndedAnswer}
            onChange={(e) => {
              setOpenEndedAnswer(e.target.value);
              setSubmitError('');
            }}
            placeholder="Type your explanation, reasoning, or code solution here…"
            disabled={busy}
          />
          <div className="open-ended-actions">
            <button
              type="button"
              className="ghost skip-question-btn"
              onClick={() => void submit({ action: 'skip' })}
              disabled={busy}
            >
              I don&apos;t know / Skip without penalty
            </button>
          </div>
        </div>
      )}

      {/* Submit Inline Error */}
      {submitError && (
        <div className="inline-alert error" role="alert">
          <AlertTriangle size={16} />
          <div className="inline-alert-body">
            <span>{submitError}</span>
            <button
              type="button"
              className="retry-inline-btn"
              onClick={() => void submit()}
              disabled={busy}
            >
              Retry Submission
            </button>
          </div>
        </div>
      )}

      {/* Active feedback */}
      {feedback && (
        <div className="inline-alert success" role="status">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="assessment-foot">
        <span className="security-notice">
          <ShieldCheck size={14} /> Server-scored · Anti-tamper verified
        </span>

        <button
          type="button"
          className={`primary submit-btn ${!answered ? 'needs-answer' : ''}`}
          onClick={() => {
            if (!answered) {
              setSubmitError(
                q.type === 'multiple_choice'
                  ? 'Please select an answer option above before proceeding to the next question.'
                  : 'Please enter your explanation or solution above before proceeding.'
              );
              return;
            }
            void submit();
          }}
          disabled={busy || feedback !== null}
          aria-label={index + 1 === total ? 'Finish diagnostic assessment' : 'Advance to next assessment question'}
        >
          {busy ? (
            <>
              <Loader2 size={14} className="spin" />
              <span>Scoring…</span>
            </>
          ) : index + 1 === total ? (
            <>
              <span>Finish Diagnostic</span>
              <CheckCircle2 size={14} />
            </>
          ) : (
            <>
              <span>Next Question</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
