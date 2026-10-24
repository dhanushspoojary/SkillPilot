'use client';

import { useState, useEffect } from 'react';
import {
  Code2,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Terminal,
  ExternalLink,
  Loader2,
  Check,
  Layers,
  Clock,
  Award,
} from 'lucide-react';
import { PageIntro } from './ui';

import {
  PROJECT_CATALOG,
  type ProjectCatalogItem,
  type ProjectMilestone,
  type ProjectTask,
  type TestCase,
} from '../lib/project-catalog';

interface StudentProjectRecord {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  requiredSkills: string[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  status: 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'needs_revision';
  submissionCode: string | null;
  testResults: TestCase[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ProjectWorkspace({
  onVerified,
  onAskAgent,
  initialSlug,
}: {
  onVerified?: () => void;
  onAskAgent?: (prompt: string) => void;
  initialSlug?: string;
}) {
  const [catalog, setCatalog] = useState<ProjectCatalogItem[]>(PROJECT_CATALOG);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSlug && PROJECT_CATALOG.some((p) => p.slug === initialSlug)
      ? initialSlug
      : 'rest-bookstore-service'
  );
  const [project, setProject] = useState<StudentProjectRecord | null>(null);
  const [code, setCode] = useState<string>(() => {
    const defaultItem = PROJECT_CATALOG.find((p) => p.slug === (initialSlug || 'rest-bookstore-service')) || PROJECT_CATALOG[0];
    return defaultItem.starterCode;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'spec'>('editor');
  const [error, setError] = useState<string>('');

  // Fetch project catalog & student's active status
  useEffect(() => {
    let cancelled = false;
    async function loadProjectData() {
      setError('');
      try {
        const res = await fetch(`/api/projects?slug=${encodeURIComponent(selectedSlug)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load project details');
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.catalog) && data.catalog.length > 0) {
          setCatalog(data.catalog);
        }
        if (data.studentProject) {
          setProject(data.studentProject);
          if (data.studentProject.submissionCode) {
            setCode(data.studentProject.submissionCode);
          }
        }
      } catch (e) {
        if (!cancelled) {
          // Keep local fallback intact
        }
      }
    }

    void loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const activeCatalogItem = catalog.find((p) => p.slug === selectedSlug) || catalog[0] || PROJECT_CATALOG[0];

  const handleResetCode = () => {
    if (!activeCatalogItem) return;
    if (window.confirm('Reset code to initial starter template? Your unsaved edits will be discarded.')) {
      setCode(activeCatalogItem.starterCode);
      setEvaluationFeedback('');
    }
  };

  const handleRunTests = async () => {
    if (evaluating || !code.trim()) return;
    setEvaluating(true);
    setEvaluationFeedback('');
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedSlug,
          code,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');

      if (data.project) {
        setProject(data.project);
      }
      setEvaluationFeedback(data.feedback || (data.passed ? 'All test cases passed.' : 'Some tests failed.'));
      if (data.passed && onVerified) {
        onVerified();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to evaluate code submission');
    } finally {
      setEvaluating(false);
    }
  };

  const isVerified = project?.status === 'verified';
  const testResults = project?.testResults || activeCatalogItem?.testCases || [];
  const passedTestsCount = testResults.filter((t) => t.status === 'passed').length;

  return (
    <div className="wide">
      <PageIntro
        kicker="PRACTICAL PROJECT WORKSPACE"
        title="Build real software. Earn verified credentials."
        text="Implement authentic engineering services in your workspace. Passing deterministic test assertions writes immutable evidence to your Career Passport."
      />

      {/* Project Switcher Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--line)',
          paddingBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {catalog.map((item) => {
            const isSelected = item.slug === selectedSlug;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSelectedSlug(item.slug)}
                className={isSelected ? 'primary' : 'ghost'}
                style={{
                  minHeight: 38,
                  padding: '0 16px',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 20,
                }}
              >
                <Code2 size={15} />
                <span>{item.title}</span>
                {item.difficulty === 'Beginner' && (
                  <span style={{ fontSize: 10, background: 'rgba(34,211,238,0.15)', color: 'var(--cyan)', padding: '2px 6px', borderRadius: 10 }}>
                    Beginner
                  </span>
                )}
                {item.difficulty === 'Intermediate' && (
                  <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.15)', color: '#FBBF24', padding: '2px 6px', borderRadius: 10 }}>
                    Intermediate
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isVerified && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34D399',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <ShieldCheck size={15} />
            <span>VERIFIED ON PASSPORT</span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--cyan)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading project workspace and test suite…</p>
        </div>
      ) : activeCatalogItem ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1fr) minmax(400px, 1.4fr)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Left Column: Project Overview & Test Cases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Overview Card */}
            <div
              style={{
                background: 'var(--surface-navy)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: 'var(--cyan)',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                  }}
                >
                  {activeCatalogItem.difficulty} · ~{activeCatalogItem.estimatedHours} hours
                </span>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary, #17151B)' }}>{activeCatalogItem.title}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {activeCatalogItem.description}
              </p>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {activeCatalogItem.requiredSkills.map((sk) => (
                  <span
                    key={sk}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 6,
                      color: 'var(--cyan)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    #{sk}
                  </span>
                ))}
              </div>

              {/* Objectives */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <h4 style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                  Core Implementation Objectives
                </h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {activeCatalogItem.objectives.map((obj, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Test Suite Card */}
            <div
              style={{
                background: 'var(--surface-navy)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Terminal size={16} color="var(--cyan)" />
                  <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary, #17151B)' }}>Automated Test Suite</h4>
                </div>
                <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700 }}>
                  {passedTestsCount} of {testResults.length} Passed
                </span>
              </div>

              {evaluationFeedback && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 12,
                    fontSize: 12,
                    background: isVerified ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                    border: `1px solid ${isVerified ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                    color: isVerified ? '#34D399' : '#FBBF24',
                  }}
                >
                  {evaluationFeedback}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {testResults.map((tc) => {
                  const isPassed = tc.status === 'passed';
                  const isFailed = tc.status === 'failed';
                  return (
                    <div
                      key={tc.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(0, 0, 0, 0.04)',
                        border: `1px solid ${isPassed ? 'rgba(52, 211, 153, 0.3)' : isFailed ? 'rgba(239, 68, 68, 0.3)' : 'var(--line)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ fontSize: 13, color: 'var(--text-primary, #17151B)' }}>{tc.name}</b>
                        {isPassed && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34D399', fontSize: 11 }}>
                            <CheckCircle2 size={13} /> Passed
                          </span>
                        )}
                        {isFailed && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', fontSize: 11 }}>
                            <XCircle size={13} /> Failed
                          </span>
                        )}
                        {!tc.status && (
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>Pending Run</span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {tc.description}
                      </p>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        Expected: {tc.expectedBehavior}
                      </div>
                      {tc.output && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: 'rgba(0,0,0,0.3)',
                            fontSize: 11,
                            color: isPassed ? '#A7F3D0' : '#FECACA',
                            fontFamily: 'monospace',
                          }}
                        >
                          Output: {tc.output}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {onAskAgent && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    onAskAgent(
                      `I am working on the practical project "${activeCatalogItem.title}". Can you give me hints on how to implement the required methods and pass the tests?`
                    )
                  }
                  style={{
                    width: '100%',
                    marginTop: 14,
                    minHeight: 36,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} color="var(--cyan)" />
                  <span>Ask Career AI for hints on this project</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Code Editor & Execution */}
          <div
            style={{
              background: 'var(--surface-navy)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 640,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                borderBottom: '1px solid var(--line)',
                paddingBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={15} color="var(--cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #17151B)' }}>Solution Implementation</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  ({selectedSlug === 'rest-bookstore-service' ? 'JavaScript' : 'PostgreSQL'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleResetCode}
                  disabled={evaluating}
                  style={{ minHeight: 30, padding: '0 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Reset to starter code"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={handleRunTests}
                  disabled={evaluating || !code.trim()}
                  style={{ minHeight: 32, padding: '0 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {evaluating ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
                  <span>{evaluating ? 'Evaluating…' : 'Run Tests & Verify'}</span>
                </button>
              </div>
            </div>

            {/* Code Input Area */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={evaluating}
                spellCheck={false}
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 520,
                  background: '#FAF9FB',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 16,
                  color: 'var(--main-text)',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p className="auth-error" style={{ marginTop: 12 }} role="alert">
                {error}
              </p>
            )}

            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldCheck size={14} color="var(--cyan)" />
              <span>Safe deterministic execution boundary · Code evaluated against server test criteria</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
