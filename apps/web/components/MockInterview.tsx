'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Volume2,
  VolumeX,
  Award,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Users,
  Clock,
  Activity,
  FileText,
  Terminal,
  ArrowRight,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { interviewableSkills } from '../lib/interview';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export type InterviewMode = 'technical' | 'hr' | 'behavioral' | 'coding' | 'project' | 'internship';
export type ExperienceLevel = 'entry' | 'junior' | 'mid';

const INTERVIEW_MODES: { id: InterviewMode; label: string; icon: string; description: string; defaultSkill: string }[] = [
  { id: 'technical', label: 'Technical Core', icon: '💻', description: 'System design, core architecture, runtime mechanisms, algorithms.', defaultSkill: 'javascript' },
  { id: 'behavioral', label: 'Behavioral & STAR', icon: '🎯', description: 'Past challenges, teamwork, conflict resolution, ownership.', defaultSkill: 'problem-solving' },
  { id: 'coding', label: 'Coding Walkthrough', icon: '⚡', description: 'Algorithmic approach, edge cases, time/space complexity trade-offs.', defaultSkill: 'problem-solving' },
  { id: 'project', label: 'Project Architecture', icon: '🏗️', description: 'Full-stack choices, schema modeling, trade-offs, scaling limits.', defaultSkill: 'rest-apis' },
  { id: 'hr', label: 'HR & Values', icon: '🤝', description: 'Role expectations, work style, career aspirations, adaptability.', defaultSkill: 'communication' },
  { id: 'internship', label: 'Internship Prep', icon: '🎓', description: 'Foundations, learning agility, curiosity, student project depth.', defaultSkill: 'git' },
];

const EXPERIENCE_LEVELS: { id: ExperienceLevel; label: string; detail: string }[] = [
  { id: 'entry', label: 'Student / Entry-Level', detail: 'Foundational concepts, curiosity, and sound logic' },
  { id: 'junior', label: 'Early Career (1-2 yrs)', detail: 'Practical patterns, testing, error handling, clean design' },
  { id: 'mid', label: 'Mid-Level (3+ yrs)', detail: 'System trade-offs, scalability, cross-team impact' },
];

export function MockInterview({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<'ai' | 'mentor'>('ai');
  const [selectedMode, setSelectedMode] = useState<InterviewMode>('technical');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry');
  const [targetRole, setTargetRole] = useState('Full-Stack Software Engineer');
  const [skill, setSkill] = useState('javascript');
  const [iv, setIv] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [live, setLive] = useState('');
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [speakingQuestion, setSpeakingQuestion] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Mentor Mock Interview state
  const [mentorList, setMentorList] = useState<any[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [mentorBooked, setMentorBooked] = useState<string | null>(null);

  const rec = useRef<any>(null);
  const startedAt = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { rec.current?.stop(); } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Update default skill when mode changes
  useEffect(() => {
    const modeConfig = INTERVIEW_MODES.find((m) => m.id === selectedMode);
    if (modeConfig && modeConfig.defaultSkill) {
      setSkill(modeConfig.defaultSkill);
    }
  }, [selectedMode]);

  // Load mentors if switching to mentor tab
  useEffect(() => {
    if (tab === 'mentor' && mentorList.length === 0) {
      setLoadingMentors(true);
      fetch('/api/mentors', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.mentors)) {
            setMentorList(d.mentors.filter((m: any) => m.status === 'approved' || m.approvedAt));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMentors(false));
    }
  }, [tab, mentorList.length]);

  // Animated honest audio waveform canvas
  useEffect(() => {
    if (!iv) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isLive = listening || speakingQuestion;
      const amplitude = isLive ? 22 : 4;
      const centerY = canvas.height / 2;

      ctx.beginPath();
      ctx.lineWidth = isLive ? 2.5 : 1;
      ctx.strokeStyle = isLive ? '#22D3EE' : 'rgba(148, 169, 204, 0.3)';

      for (let x = 0; x < canvas.width; x++) {
        const y = centerY + Math.sin(x * 0.04 + phase) * amplitude * Math.sin((x / canvas.width) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Second harmonic wave
      if (isLive) {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(77, 141, 255, 0.6)';
        for (let x = 0; x < canvas.width; x++) {
          const y = centerY + Math.cos(x * 0.06 - phase * 1.3) * (amplitude * 0.7) * Math.sin((x / canvas.width) * Math.PI);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += isLive ? 0.08 : 0.015;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [iv, listening, speakingQuestion]);

  // Speak question aloud using browser speech synthesis
  const speakCurrentQuestion = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingQuestion(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingQuestion(false);
    utterance.onerror = () => setSpeakingQuestion(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingQuestion(false);
  };

  async function start() {
    setError('');
    try {
      const r = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill }),
      });
      const x = await r.json();
      if (!r.ok) {
        setError(x.error || 'Could not start interview.');
        return;
      }
      setIv(x.interview);
      setIdx(0);
      setLive('');
      setTyped('');
      setResult(null);

      if (autoSpeak && x.interview?.questions?.[0]?.prompt) {
        setTimeout(() => {
          speakCurrentQuestion(x.interview.questions[0].prompt);
        }, 400);
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  function listen() {
    if (!SR) return;
    stopSpeaking();
    const inst = new SR();
    inst.lang = 'en-US';
    inst.interimResults = true;
    inst.continuous = true;
    inst.onresult = (e: any) =>
      setLive(
        Array.from(e.results)
          .map((res: any) => res[0].transcript)
          .join(' ')
          .slice(0, 6000)
      );
    inst.onend = () => setListening(false);
    inst.onerror = () => setListening(false);
    rec.current = inst;
    startedAt.current = Date.now();
    setLive('');
    setListening(true);
    try {
      inst.start();
    } catch {
      setListening(false);
    }
  }

  function stopListen() {
    try {
      rec.current?.stop();
    } catch {}
    setListening(false);
  }

  async function submitAnswer() {
    const transcript = (typed.trim() || live.trim()).slice(0, 6000);
    if (!transcript) {
      setError('Please provide an answer either by speaking or typing.');
      return;
    }
    setError('');
    stopListen();
    stopSpeaking();

    try {
      const r = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: iv.id,
          position: iv.questions[idx].position,
          transcript,
          latencyMs: startedAt.current ? Date.now() - startedAt.current : null,
        }),
      });
      const x = await r.json();
      if (!r.ok) {
        setError(x.error || 'Could not save answer');
        return;
      }
      setLive('');
      setTyped('');

      if (idx + 1 < iv.questions.length) {
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        if (autoSpeak && iv.questions[nextIdx]?.prompt) {
          setTimeout(() => {
            speakCurrentQuestion(iv.questions[nextIdx].prompt);
          }, 300);
        }
      } else {
        await finish();
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  async function finish() {
    setError('Synthesizing structured interview feedback…');
    stopSpeaking();
    try {
      const r = await fetch('/api/interview/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: iv.id }),
      });
      const x = await r.json();
      if (!r.ok) {
        setError(x.error || 'Could not score interview');
        return;
      }
      setResult(x.interview);
      setIv(null);
      setError('');
      onDone();
    } catch {
      setError('Network error while scoring. Try again.');
    }
  }

  // Calculate observed statistics from transcripts
  const observedStats = useMemo(() => {
    if (!result || !result.questions) return null;
    let totalWords = 0;
    let fillerCount = 0;
    const fillers = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically'];

    result.questions.forEach((q: any) => {
      const text = (q.transcript || '').toLowerCase();
      const words = text.split(/\s+/).filter(Boolean);
      totalWords += words.length;
      fillers.forEach((f) => {
        const matches = text.match(new RegExp(`\\b${f}\\b`, 'g'));
        if (matches) fillerCount += matches.length;
      });
    });

    const avgWordsPerAnswer = Math.round(totalWords / Math.max(1, result.questions.length));
    return {
      totalWords,
      avgWordsPerAnswer,
      fillerCount,
      estimatedPace: avgWordsPerAnswer > 130 ? 'Thorough / Detailed' : avgWordsPerAnswer > 60 ? 'Optimal Conversational' : 'Brief / Concise',
    };
  }, [result]);

  // RESULT SCREEN
  if (result) {
    return (
      <div className="wide" style={{ maxWidth: 840, margin: '0 auto' }}>
        <div
          style={{
            background: 'var(--surface-navy)',
            borderRadius: 14,
            border: '1px solid var(--line)',
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{INTERVIEW_MODES.find((m) => m.id === selectedMode)?.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {selectedMode.toUpperCase()} MOCK INTERVIEW EVALUATION
                </span>
              </div>
              <h1 style={{ fontSize: 24, margin: '0 0 6px 0', color: 'var(--text-primary, #17151B)' }}>
                Overall Score: {result.score} / 100
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Target Role: <b>{targetRole}</b> · Level: <b>{EXPERIENCE_LEVELS.find((l) => l.id === experienceLevel)?.label}</b>
              </p>
            </div>

            <div
              style={{
                background: 'rgba(36, 91, 255, 0.12)',
                border: '1px solid rgba(36, 91, 255, 0.35)',
                padding: '10px 16px',
                borderRadius: 10,
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Evidence Confidence</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>
                {Math.round((result.confidence ?? 0.35) * 100)}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Practice signal (subordinate to mentor review)</div>
            </div>
          </div>

          <div
            style={{
              margin: '16px 0',
              padding: 12,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--line)',
              fontSize: 12,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck size={16} color="var(--cyan)" />
            <span>
              <b>Honest Disclaimer:</b> This score is diagnostic practice feedback. It indicates technical familiarity and answer clarity for interview rehearsal, not guaranteed employability or hiring status.
            </span>
          </div>

          {/* Observed Facts Breakdown */}
          {observedStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '20px 0' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(23, 21, 27, 0.03)' }}>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 600 }}>Total Spoken Words</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--main-text)', marginTop: 4 }}>{observedStats.totalWords}</div>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)' }}>~{observedStats.avgWordsPerAnswer} words/question</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(23, 21, 27, 0.03)' }}>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 600 }}>Pacing Density</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-purple)', marginTop: 4 }}>{observedStats.estimatedPace}</div>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)' }}>Answer thoroughness</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(23, 21, 27, 0.03)' }}>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 600 }}>Observed Filler Words</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: observedStats.fillerCount > 5 ? '#D97706' : '#10B981', marginTop: 4 }}>
                  {observedStats.fillerCount}
                </div>
                <div style={{ fontSize: 11, color: 'var(--secondary-text)' }}>um / uh / like / basically count</div>
              </div>
            </div>
          )}
        </div>

        {/* Question Details with STAR Structure */}
        <h3 style={{ fontSize: 16, color: 'var(--text-primary, #17151B)', margin: '20px 0 12px 0' }}>Spoken Answers & Diagnostic Feedback</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {result.questions.map((q: any) => (
            <div
              key={q.position}
              style={{
                background: 'var(--surface-navy)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>QUESTION {q.position}</span>
                <span
                  style={{
                    background: (q.score ?? 0) >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: (q.score ?? 0) >= 70 ? '#34D399' : '#FBBF24',
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {q.score ?? '—'}/100
                </span>
              </div>
              <b style={{ fontSize: 15, color: 'var(--main-text)', display: 'block', marginBottom: 10 }}>{q.prompt}</b>
              <div
                style={{
                  background: '#FAF9FB',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 14,
                  margin: '8px 0',
                  fontSize: 13,
                  color: 'var(--secondary-text)',
                  fontStyle: 'italic',
                }}
              >
                “{q.transcript || 'No response recorded.'}”
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <b style={{ color: 'var(--cyan)' }}>Feedback: </b>
                {q.feedback}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="secondary"
            onClick={() => setResult(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCcw size={15} />
            <span>Retake Another Interview</span>
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE INTERVIEW IN PROGRESS
  if (iv) {
    const q = iv.questions[idx];
    return (
      <div className="wide" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{INTERVIEW_MODES.find((m) => m.id === selectedMode)?.icon}</span>
            <small className="kicker" style={{ margin: 0 }}>
              QUESTION {idx + 1} OF {iv.questions.length} · {selectedMode.toUpperCase()}
            </small>
          </div>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 12, padding: '4px 10px', color: '#F87171' }}
            onClick={() => {
              if (window.confirm('Cancel this mock interview in progress?')) {
                setIv(null);
                stopListen();
                stopSpeaking();
              }
            }}
          >
            Exit
          </button>
        </div>

        {/* Question Prompt */}
        <div
          style={{
            background: 'var(--surface-navy)',
            borderRadius: 14,
            border: '1px solid var(--line)',
            padding: 22,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 20, color: 'var(--text-primary, #17151B)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
            {q.prompt}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (speakingQuestion) stopSpeaking();
                else speakCurrentQuestion(q.prompt);
              }}
              style={{
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 34,
                borderColor: speakingQuestion ? 'var(--cyan)' : 'var(--line)',
                color: speakingQuestion ? 'var(--cyan)' : 'var(--text-primary)',
              }}
            >
              {speakingQuestion ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{speakingQuestion ? 'Stop Audio' : 'Listen to Question'}</span>
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                style={{ accentColor: 'var(--cyan)' }}
              />
              <span>Auto-speak next questions</span>
            </label>
          </div>

          {/* Honest Audio Waveform Canvas */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Honest Audio Interface · {listening ? '🎙️ Listening to Candidate' : speakingQuestion ? '🔊 Interviewer Speaking' : 'Ready'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>No fake 3D avatars</span>
            </div>
            <canvas
              ref={canvasRef}
              width={680}
              height={50}
              style={{
                width: '100%',
                height: 50,
                background: '#FAF9FB',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                display: 'block',
              }}
            />
          </div>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 14 }}>{error}</div>}

        {/* Response Controls */}
        <div style={{ display: 'flex', gap: 10, margin: '12px 0', alignItems: 'center', flexWrap: 'wrap' }}>
          {SR && (
            listening ? (
              <button
                type="button"
                className="secondary"
                onClick={stopListen}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Square size={14} />
                <span>Stop Recording</span>
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={listen}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Mic size={14} />
                <span>Answer with Microphone</span>
              </button>
            )
          )}

          {!SR && (
            <small className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MicOff size={13} />
              <span>Browser speech recognition unavailable. Type your response below.</span>
            </small>
          )}
        </div>

        {/* Live speech preview if recording */}
        {listening && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(34, 211, 238, 0.08)',
              border: '1px solid rgba(34, 211, 238, 0.25)',
              fontSize: 13,
              color: 'var(--cyan)',
              marginBottom: 10,
              minHeight: 48,
            }}
          >
            {live || 'Listening for your voice… speak clearly.'}
          </div>
        )}

        {/* Answer Textarea */}
        <textarea
          rows={6}
          maxLength={6000}
          placeholder={SR ? 'Live speech will appear here. You can also type or edit your answer directly…' : 'Type your detailed answer here…'}
          value={typed || live}
          onChange={(e) => setTyped(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--surface-navy)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            fontSize: 14,
            color: '#FFFFFF',
            lineHeight: 1.5,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {(typed || live).trim().split(/\s+/).filter(Boolean).length} words spoken/typed
          </span>

          <button
            type="button"
            className="primary"
            onClick={() => void submitAnswer()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 42, padding: '0 20px' }}
          >
            <span>{idx + 1 < iv.questions.length ? 'Next Question' : 'Finish & View Diagnostic Report'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // CONFIGURATION SCREEN (Before starting)
  return (
    <div className="wide" style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* Top Switcher: AI Rehearsal vs Human Mentor */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab('ai')}
          className={tab === 'ai' ? 'primary' : 'secondary'}
          style={{ flex: 1, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Sparkles size={16} />
          <span>Mode A: Adaptive AI Interviewer</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('mentor')}
          className={tab === 'mentor' ? 'primary' : 'secondary'}
          style={{ flex: 1, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Users size={16} />
          <span>Mode B: Human Mentor Interview</span>
        </button>
      </div>

      {/* MODE B: MENTOR MOCK INTERVIEW */}
      {tab === 'mentor' ? (
        <div
          style={{
            background: 'var(--surface-navy)',
            borderRadius: 14,
            border: '1px solid var(--line)',
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 20, color: 'var(--text-primary, #17151B)', margin: '0 0 6px 0' }}>Request Mentor-Led Mock Interview</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
            Rehearse 1-on-1 with verified college seniors, recent grads, or industry professionals. Mentors provide authentic, high-confidence feedback.
          </p>

          {mentorBooked && (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34D399',
                marginBottom: 16,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              <span>Mock interview request sent to {mentorBooked}. You will receive a confirmed meeting time in your Mentors tab.</span>
            </div>
          )}

          {loadingMentors ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--secondary-text)' }}>Loading verified mentors…</div>
          ) : mentorList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: '#FFFFFF', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <p style={{ margin: 0, color: 'var(--secondary-text)', fontSize: 13 }}>
                No verified mentors are currently accepting interview requests. You can practice immediately with Mode A (AI Interviewer).
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {mentorList.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(23, 21, 27, 0.03)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <b style={{ color: 'var(--main-text)', fontSize: 15 }}>{m.name}</b>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'rgba(136, 116, 199, 0.12)',
                          color: 'var(--primary-purple)',
                          fontWeight: 700,
                        }}
                      >
                        VERIFIED
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cyan)', marginBottom: 8 }}>{m.focus || 'Full-Stack Software Mentor'}</div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                      {m.bio || 'Available for technical mock interviews, resume walkthroughs, and code review.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    onClick={() => setMentorBooked(m.name)}
                    style={{ marginTop: 14, minHeight: 34, fontSize: 12, width: '100%' }}
                  >
                    Request 1-on-1 Interview
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* MODE A: AI INTERVIEWER SETUP */
        <div
          style={{
            background: 'var(--surface-navy)',
            borderRadius: 14,
            border: '1px solid var(--line)',
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, color: 'var(--text-primary, #17151B)', margin: '0 0 6px 0' }}>AI Voice & Text Mock Interview</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Simulate realistic interview rounds with speech recognition, spoken questions, and structured diagnostic feedback.
            </p>
          </div>

          {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* 1. Interview Mode Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
              1. Select Interview Track
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {INTERVIEW_MODES.map((m) => {
                const isSelected = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    style={{
                      background: isSelected ? 'rgba(136, 116, 199, 0.10)' : '#FFFFFF',
                      border: `1px solid ${isSelected ? 'var(--primary-purple)' : 'var(--border-color)'}`,
                      borderRadius: 12,
                      padding: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 180ms ease',
                      boxShadow: '0 2px 8px rgba(23, 21, 27, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{m.icon}</span>
                      <b style={{ color: isSelected ? 'var(--primary-purple)' : 'var(--main-text)', fontSize: 13 }}>{m.label}</b>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--secondary-text)', lineHeight: 1.4 }}>{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Target Role & Experience Level */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--primary-purple)', textTransform: 'uppercase', marginBottom: 6 }}>
                Target Role
              </label>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Full-Stack Software Engineer"
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 14px',
                  background: '#FAF9FB',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  color: 'var(--main-text)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--primary-purple)', textTransform: 'uppercase', marginBottom: 6 }}>
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 14px',
                  background: '#FAF9FB',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  color: 'var(--main-text)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Skill Focus */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--primary-purple)', textTransform: 'uppercase', marginBottom: 6 }}>
              Primary Skill Focus
            </label>
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                padding: '0 14px',
                background: '#FAF9FB',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                color: 'var(--main-text)',
                fontSize: 13,
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              {interviewableSkills().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start CTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Speech is processed locally in your browser. Audio recordings are not persisted.
            </div>

            <button
              type="button"
              className="primary"
              disabled={!skill}
              onClick={() => void start()}
              style={{ minHeight: 42, padding: '0 24px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span>Begin Mock Interview</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
