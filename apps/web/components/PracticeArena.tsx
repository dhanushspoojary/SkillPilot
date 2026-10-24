'use client';

import { useState, useMemo } from 'react';
import {
  Code2,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Filter,
  Layers,
  Terminal,
  ShieldCheck,
  Award,
  BookOpen,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import {
  PRACTICE_PROBLEMS,
  type PracticeProblem,
  type ProgrammingLanguage,
  type ExecutionResult,
} from '../lib/practice-arena';

export function PracticeArena({
  initialProblemSlug,
  onGoToLearn,
  onRequestMentorReview,
}: {
  initialProblemSlug?: string;
  onGoToLearn?: (lessonId?: string) => void;
  onRequestMentorReview?: (problemTitle: string) => void;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialProblemSlug || PRACTICE_PROBLEMS[0].slug
  );
  const [selectedLanguage, setSelectedLanguage] = useState<ProgrammingLanguage>('javascript');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterTrack, setFilterTrack] = useState<string>('all');

  const problem = useMemo(() => {
    return PRACTICE_PROBLEMS.find((p) => p.slug === selectedSlug) || PRACTICE_PROBLEMS[0];
  }, [selectedSlug]);

  const [code, setCode] = useState<string>(
    problem.starterCode[selectedLanguage] || problem.starterCode.javascript || ''
  );
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [executing, setExecuting] = useState<boolean>(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [solved, setSolved] = useState<boolean>(false);
  const [reflectionText, setReflectionText] = useState<string>('');
  const [reflectionSaved, setReflectionSaved] = useState<boolean>(false);

  // When problem or language changes, update starter code
  const handleSelectProblem = (slug: string) => {
    if (slug === selectedSlug) return;
    const currentStarter = problem.starterCode[selectedLanguage] || problem.starterCode.javascript || '';
    if (code.trim() !== currentStarter.trim() && !solved) {
      if (typeof window !== 'undefined' && !window.confirm('Switch problem? Unsaved code in the editor will be discarded.')) {
        return;
      }
    }
    setSelectedSlug(slug);
    const p = PRACTICE_PROBLEMS.find((prob) => prob.slug === slug);
    if (p) {
      setCode(p.starterCode[selectedLanguage] || p.starterCode.javascript || '');
      setHintLevel(0);
      setExecResult(null);
      setErrorMsg('');
      setSolved(false);
      setReflectionSaved(false);
    }
  };

  const handleLanguageChange = (lang: ProgrammingLanguage) => {
    if (lang === selectedLanguage) return;
    const currentStarter = problem.starterCode[selectedLanguage] || problem.starterCode.javascript || '';
    if (code.trim() !== currentStarter.trim() && !solved) {
      if (typeof window !== 'undefined' && !window.confirm('Switch language? Unsaved code in the editor will be discarded.')) {
        return;
      }
    }
    setSelectedLanguage(lang);
    if (problem.starterCode[lang]) {
      setCode(problem.starterCode[lang]);
    }
  };

  const insertSymbol = (sym: string) => {
    setCode((prev) => prev + sym);
  };

  const handleRunCode = async (isSubmission: boolean = false) => {
    setExecuting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/practice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          problemId: problem.id,
          language: selectedLanguage,
          isSubmission,
          hintLevelUsed: hintLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');

      setExecResult(data.result);
      if (isSubmission && data.result.success) {
        setSolved(true);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const filteredProblems = useMemo(() => {
    return PRACTICE_PROBLEMS.filter((p) => {
      if (filterDifficulty !== 'all' && p.difficulty !== filterDifficulty) return false;
      if (filterTrack !== 'all' && p.track !== filterTrack) return false;
      return true;
    });
  }, [filterDifficulty, filterTrack]);

  return (
    <div className="practice-arena-shell" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Bar */}
      <div
        className="practice-arena-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(136, 116, 199, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-purple)',
            }}
          >
            <Code2 size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--main-text)', fontWeight: 700 }}>
              SkillPilot Practice Arena
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--secondary-text)' }}>
              Curated gap-targeted algorithmic challenges with safe sandbox verification & Socratic hint ladder.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className="filter-select"
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              color: 'var(--main-text)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Tracks</option>
            <option value="problem-solving">Problem Solving</option>
            <option value="c-systems">C Systems</option>
            <option value="sql-databases">SQL Databases</option>
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="filter-select"
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              color: 'var(--main-text)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div
        className="practice-workspace-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 380px) 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Problem List & Problem Statement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Problem Switcher */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--secondary-text)', textTransform: 'uppercase' }}>
                Problems ({filteredProblems.length})
              </span>
              <span style={{ fontSize: 11, color: 'var(--primary-purple)', fontWeight: 600 }}>Targeted to your gaps</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {filteredProblems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProblem(p.slug)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 20,
                    border: p.slug === selectedSlug ? '1px solid var(--primary-purple)' : '1px solid var(--border-color)',
                    background: p.slug === selectedSlug ? 'rgba(136, 116, 199, 0.08)' : '#FAF9FB',
                    color: 'var(--main-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 180ms ease',
                  }}
                >
                  <span style={{ fontWeight: p.slug === selectedSlug ? 700 : 500 }}>{p.title}</span>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontWeight: 700,
                      background:
                        p.difficulty === 'easy'
                          ? 'rgba(52, 211, 153, 0.15)'
                          : p.difficulty === 'medium'
                          ? 'rgba(251, 191, 36, 0.15)'
                          : 'rgba(248, 113, 113, 0.15)',
                      color:
                        p.difficulty === 'easy'
                          ? '#10B981'
                          : p.difficulty === 'medium'
                          ? '#D97706'
                          : '#EF4444',
                    }}
                  >
                    {p.difficulty}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Problem Statement Card */}
          <div
            className="problem-detail-card"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 12,
                  background:
                    problem.difficulty === 'easy'
                      ? 'rgba(52, 211, 153, 0.15)'
                      : problem.difficulty === 'medium'
                      ? 'rgba(251, 191, 36, 0.15)'
                      : 'rgba(248, 113, 113, 0.15)',
                  color:
                    problem.difficulty === 'easy'
                      ? '#10B981'
                      : problem.difficulty === 'medium'
                      ? '#D97706'
                      : '#EF4444',
                }}
              >
                {problem.difficulty}
              </span>
              <span style={{ fontSize: 12, color: 'var(--secondary-text)' }}>~{problem.estimatedMinutes} mins</span>
              <span style={{ fontSize: 12, color: 'var(--secondary-text)' }}>• {problem.track}</span>
              {onGoToLearn && (
                <button
                  type="button"
                  onClick={() => onGoToLearn(problem.slug === 'c-pointer-swap' ? 'c-pointers-memory' : 'ps-loop-tracing')}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--primary-purple)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Open interactive walkthrough lesson for this concept"
                >
                  <BookOpen size={12} />
                  <span>Review Concept in Learn</span>
                </button>
              )}
            </div>

            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, color: 'var(--main-text)', fontWeight: 700 }}>{problem.title}</h3>

            <p style={{ fontSize: 13, color: 'var(--secondary-text)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              {problem.statement}
            </p>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--primary-purple)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Examples
              </h4>
              {problem.examples.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    background: '#FAF9FB',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Input: </span>
                    <span style={{ color: 'var(--main-text)', fontWeight: 600 }}>{ex.input}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Output: </span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>{ex.output}</span>
                  </div>
                  {ex.explanation && (
                    <div style={{ marginTop: 4, color: 'var(--secondary-text)', fontFamily: 'sans-serif', fontSize: 11 }}>
                      {ex.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--primary-purple)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Constraints
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--secondary-text)', lineHeight: 1.5 }}>
                {problem.constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Code Editor & Execution Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Editor Container */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
            }}
          >
            {/* Editor Toolbar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#FAF9FB',
                borderBottom: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={15} color="var(--primary-purple)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--main-text)' }}>Editor</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value as ProgrammingLanguage)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    color: 'var(--main-text)',
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>

              {/* Status / Mode info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--secondary-text)' }}>Safe Sandbox Verification</span>
                <button
                  type="button"
                  onClick={() => handleSelectProblem(problem.slug)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--secondary-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  title="Reset code to starter template"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            </div>

            {/* Mobile Keyboard Accessory Bar */}
            <div
              className="keyboard-accessory-bar"
              style={{
                display: 'flex',
                gap: 4,
                padding: '6px 12px',
                background: '#FAF9FB',
                borderBottom: '1px solid var(--border-color)',
                overflowX: 'auto',
              }}
            >
              {['{', '}', '(', ')', '[', ']', ';', ':', '=', '+', '-', '*', '/', '"', "'", 'tab'].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => insertSymbol(sym === 'tab' ? '  ' : sym)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-purple)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={14}
              style={{
                width: '100%',
                background: '#FAF9FB',
                border: 'none',
                color: 'var(--main-text)',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                padding: 16,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              spellCheck={false}
              aria-label="Code editor"
            />

            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#FAF9FB',
                borderTop: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {/* Hint Ladder Trigger */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  disabled={hintLevel >= 5}
                  onClick={() => setHintLevel((lvl) => Math.min(5, lvl + 1))}
                  style={{
                    background: 'rgba(136, 116, 199, 0.08)',
                    border: '1px solid rgba(136, 116, 199, 0.25)',
                    color: 'var(--primary-purple)',
                    padding: '7px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: hintLevel >= 5 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 180ms ease',
                  }}
                >
                  <Lightbulb size={14} />
                  <span>
                    {hintLevel === 0
                      ? 'Need a Hint?'
                      : `Hint Ladder (${hintLevel}/5)`}
                  </span>
                </button>

                {hintLevel > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--secondary-text)' }}>
                    Weight: {Math.max(10, 35 - hintLevel * 5)}/35 pts
                  </span>
                )}
              </div>

              {/* Run & Submit CTAs */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={executing}
                  onClick={() => handleRunCode(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    color: 'var(--main-text)',
                    padding: '7px 18px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 180ms ease',
                  }}
                >
                  <Play size={13} />
                  <span>Run Tests</span>
                </button>

                <button
                  type="button"
                  disabled={executing}
                  onClick={() => handleRunCode(true)}
                  style={{
                    background: 'var(--primary-purple)',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '7px 22px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(136, 116, 199, 0.25)',
                    transition: 'all 180ms ease',
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>{executing ? 'Evaluating…' : 'Submit Solution'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hint Ladder Display Box */}
          {hintLevel > 0 && (
            <div
              className="hint-ladder-box"
              style={{
                background: '#FAF9FB',
                border: '1px solid rgba(136, 116, 199, 0.25)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={16} color="var(--primary-purple)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-purple)' }}>
                  {hintLevel === 1 && 'Level 1: Nudge Question'}
                  {hintLevel === 2 && 'Level 2: Algorithmic Concept'}
                  {hintLevel === 3 && 'Level 3: Pseudo-code Blueprint'}
                  {hintLevel === 4 && 'Level 4: Code Debugging Guidance'}
                  {hintLevel === 5 && 'Level 5: Full Worked Solution'}
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--main-text)',
                  fontFamily: hintLevel >= 3 ? 'monospace' : 'inherit',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {problem.hintLadder[hintLevel - 1]}
              </pre>
            </div>
          )}

          {/* Execution Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: 12,
                borderRadius: 10,
                color: '#EF4444',
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Execution Results Card */}
          {execResult && (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 14,
                padding: 18,
                boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
              }}
            >
              {!execResult.isRunnerAvailable ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>
                      Isolated Sandbox Offline — Solution Drafting Mode
                    </span>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--secondary-text)', lineHeight: 1.5 }}>
                    {execResult.message || 'Dynamic code execution requires an isolated external runner (PISTON_API_URL or JUDGE0_API_URL). To prevent arbitrary code execution on the application server, dynamic execution is safely disabled. Verified evidence is awarded only after genuine runner execution.'}
                  </p>
                  <div style={{ fontSize: 11, color: 'var(--secondary-text)', background: '#FAF9FB', padding: '8px 12px', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border-color)' }}>
                    <b>Configuring Dynamic Runner:</b> Set <code>PISTON_API_URL=http://localhost:2000</code> or <code>JUDGE0_API_URL</code> in environment to enable dynamic test evaluation.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {execResult.success ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : (
                      <XCircle size={18} color="#EF4444" />
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: execResult.success ? '#10B981' : '#EF4444',
                      }}
                    >
                      {execResult.success ? 'All Tests Passed.' : 'Some Test Cases Failed'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--secondary-text)' }}>
                    {execResult.totalPassed} / {execResult.totalTests} passed ({execResult.runtimeMs}ms)
                  </span>
                </div>
              )}

              {/* Per-test case breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {execResult.testCaseResults.map((tc, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#FAF9FB',
                      border: tc.passed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: tc.passed ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                            Case {idx + 1}: {tc.passed ? 'PASS' : tc.status === 'compilation_error' ? 'COMPILE ERROR' : tc.status === 'time_limit_exceeded' ? 'TIME LIMIT' : 'FAIL'}
                          </span>
                          <span style={{ color: 'var(--secondary-text)', marginLeft: 8 }}>Input: {tc.input}</span>
                        </div>
                        <span style={{ color: 'var(--secondary-text)', fontSize: 11 }}>{tc.runtimeMs}ms</span>
                      </div>
                      {tc.compileOutput && (
                        <pre style={{ margin: '6px 0 0', padding: 8, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, color: '#EF4444', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                          {tc.compileOutput}
                        </pre>
                      )}
                      {!tc.passed && !tc.compileOutput && tc.error && (
                        <div style={{ margin: '4px 0 0', color: '#EF4444', fontSize: 11 }}>
                          {tc.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solved Celebration & Reflect & Review */}
          {solved && (
            <div
              className="solved-reflection-card"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 14,
                padding: 20,
                boxShadow: '0 2px 10px rgba(23, 21, 27, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Award size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#10B981', fontWeight: 700 }}>
                  Problem Solved. Authentic Evidence Recorded.
                </h3>
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--secondary-text)' }}>
                Your solution passed verification and has been added to your verified Skill Passport evidence ledger.
              </p>

              {/* Complexity Analysis */}
              <div
                style={{
                  background: '#FAF9FB',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                <div>
                  <b style={{ color: 'var(--main-text)' }}>Time Complexity: </b>
                  <span style={{ color: 'var(--primary-purple)', fontWeight: 600 }}>{problem.timeComplexity}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <b style={{ color: 'var(--main-text)' }}>Space Complexity: </b>
                  <span style={{ color: 'var(--primary-purple)', fontWeight: 600 }}>{problem.spaceComplexity}</span>
                </div>
              </div>

              {/* Self-Reflection: Explain in your own words */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--main-text)',
                    marginBottom: 6,
                  }}
                >
                  Explain it in your own words (Reinforces mental models):
                </label>
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="Explain why this approach works and what trade-offs you considered..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: '#FAF9FB',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--main-text)',
                    fontSize: 12,
                    padding: 10,
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setReflectionSaved(true)}
                  style={{
                    marginTop: 6,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    color: 'var(--main-text)',
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {reflectionSaved ? 'Reflection Saved' : 'Save Reflection'}
                </button>
              </div>

              {/* Mentor Code Review Request */}
              {onRequestMentorReview && (
                <button
                  type="button"
                  onClick={() => onRequestMentorReview(problem.title)}
                  style={{
                    background: 'rgba(136, 116, 199, 0.08)',
                    border: '1px solid var(--primary-purple)',
                    color: 'var(--primary-purple)',
                    padding: '8px 18px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MessageSquare size={13} />
                  <span>Request Mentor Code Review on this Solution</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
