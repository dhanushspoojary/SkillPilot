'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Code2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
  Trophy,
  Layers,
  ChevronRight,
  Flame,
  Award,
  RefreshCw,
  Clock,
  Play,
  Check,
} from 'lucide-react';
import type { View } from './views';

interface LessonSummary {
  id: string;
  skillSlug: string;
  title: string;
  summary: string;
  whyItMatters: string;
  difficulty: string;
  estimatedMinutes: number;
  prerequisites: string[];
  exercisesTotal: number;
  exercisesCompleted: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
}

interface WalkthroughStep {
  step: number;
  title: string;
  codeSnippet: string;
  highlightLines?: number[];
  explanation: string;
  mentalModelNote: string;
}

interface LessonExercise {
  id: string;
  concept: string;
  prompt: string;
  codeSnippet?: string;
  choices: string[];
  hints: string[];
}

interface LessonDetail {
  id: string;
  skillSlug: string;
  title: string;
  summary: string;
  whyItMatters: string;
  prerequisites: string[];
  difficulty: string;
  estimatedMinutes: number;
  keyDefinitions: Array<{ term: string; definition: string; analogy?: string }>;
  walkthroughSteps: WalkthroughStep[];
  commonPitfalls: Array<{ misconception: string; whyItFails: string; correctApproach: string }>;
  exercises: LessonExercise[];
}

interface NextAction {
  id: string;
  type: string;
  title: string;
  whatYouWillLearn: string;
  whyItMatters: string;
  whatToKnowBefore: string;
  estimatedMinutes: number;
  completionRequires: string;
  route: string;
  lessonId?: string;
  skillId?: string;
  conceptId?: string;
  projectSlug?: string;
  buttonLabel: string;
  explanation: string;
  progressPercentage?: number;
}

export function LearnWorkspace({
  initialLessonId,
  go,
  onCompleted,
}: {
  initialLessonId?: string;
  go: (v: View, focus?: string) => void;
  onCompleted?: () => void;
}) {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string>(initialLessonId || 'ps-loop-tracing');
  const [lessonData, setLessonData] = useState<LessonDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'walkthrough' | 'practice' | 'catalog'>('walkthrough');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Practice state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<any | null>(null);
  const [conceptsMastery, setConceptsMastery] = useState<Record<string, any>>({});
  const [lessonProgress, setLessonProgress] = useState<any>(null);

  // Dynamic practice generation
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [dynamicQuestion, setDynamicQuestion] = useState<any | null>(null);

  // Next action state
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  // AI Socratic mentor quick actions
  const [socraticReply, setSocraticReply] = useState<string | null>(null);
  const [socraticLoading, setSocraticLoading] = useState(false);

  // Load lesson catalog
  const loadLessons = useCallback(async () => {
    try {
      const res = await fetch('/api/learn/lessons', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setLessons(d.lessons || []);
      }
    } catch (e) {
      console.error('Failed to load lessons', e);
    }
  }, []);

  // Load next action
  const loadNextAction = useCallback(async () => {
    try {
      const res = await fetch('/api/learn/next-action', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setNextAction(d.nextAction);
      }
    } catch (e) {
      console.error('Failed to load next action', e);
    }
  }, []);

  // Load specific lesson
  const loadLesson = useCallback(async (id: string) => {
    setLoading(true);
    setAttemptResult(null);
    setSelectedChoice(null);
    setHintsRevealed(0);
    setDynamicQuestion(null);
    setSocraticReply(null);
    try {
      const res = await fetch(`/api/learn/lesson?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setLessonData(d.lesson);
        setConceptsMastery(d.conceptsMastery || {});
        setLessonProgress(d.progress);
        setCurrentStepIndex(0);
        setCurrentExerciseIndex(0);
      }
    } catch (e) {
      console.error('Failed to load lesson', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLessons();
    void loadNextAction();
  }, [loadLessons, loadNextAction]);

  useEffect(() => {
    if (initialLessonId) {
      setActiveLessonId(initialLessonId);
    }
  }, [initialLessonId]);

  useEffect(() => {
    if (activeLessonId) {
      void loadLesson(activeLessonId);
    }
  }, [activeLessonId, loadLesson]);

  // Submit exercise answer
  const handleSubmitAnswer = async () => {
    if (selectedChoice === null || !lessonData || submitting) return;
    setSubmitting(true);
    const activeEx = dynamicQuestion || lessonData.exercises[currentExerciseIndex];
    if (!activeEx) return;

    try {
      const res = await fetch('/api/learn/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lessonData.id,
          exerciseId: activeEx.id,
          chosenIndex: selectedChoice,
          hintsUsed: hintsRevealed,
        }),
      });

      const d = await res.json();
      if (res.ok && d.result) {
        setAttemptResult(d.result);
        if (d.result.conceptMastery) {
          setConceptsMastery((prev) => ({
            ...prev,
            [d.result.conceptMastery.concept]: {
              status: d.result.conceptMastery.level,
              score: d.result.conceptMastery.score,
              solved: d.result.conceptMastery.problemsSolved,
            },
          }));
        }
        if (d.result.lessonProgress) {
          setLessonProgress(d.result.lessonProgress);
        }
        void loadLessons();
        void loadNextAction();
      }
    } catch (err) {
      console.error('Failed to submit answer', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate continuous practice question
  const handleGenerateQuestion = async (conceptName?: string) => {
    if (!lessonData || generatingPractice) return;
    setGeneratingPractice(true);
    setAttemptResult(null);
    setSelectedChoice(null);
    setHintsRevealed(0);
    setSocraticReply(null);

    try {
      const activeEx = lessonData.exercises[currentExerciseIndex];
      const res = await fetch('/api/learn/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillSlug: lessonData.skillSlug,
          topic: conceptName || activeEx?.concept || 'code_tracing',
          difficulty: lessonData.difficulty || 'foundational',
        }),
      });

      const d = await res.json();
      if (res.ok && d.question) {
        setDynamicQuestion(d.question);
      }
    } catch (err) {
      console.error('Failed to generate practice question', err);
    } finally {
      setGeneratingPractice(false);
    }
  };

  // Socratic mentor query
  const handleSocraticPrompt = async (promptType: string) => {
    if (!lessonData || socraticLoading) return;
    setSocraticLoading(true);
    const activeEx = dynamicQuestion || lessonData.exercises[currentExerciseIndex];

    let questionText = '';
    if (promptType === 'simpler') {
      questionText = `Explain the concept "${activeEx?.concept || lessonData.title}" in simpler, beginner-friendly terms with a real-life analogy.`;
    } else if (promptType === 'example') {
      questionText = `Show me another short code example demonstrating "${activeEx?.concept || lessonData.title}" with line-by-line tracing.`;
    } else if (promptType === 'why_wrong') {
      questionText = `I chose option ${selectedChoice !== null ? selectedChoice + 1 : 'an option'} for the question "${activeEx?.prompt}". Explain why this choice is incorrect and what mental model mistake caused it without giving away the answer.`;
    } else if (promptType === 'hint') {
      if (hintsRevealed < (activeEx?.hints?.length || 3)) {
        setHintsRevealed((prev) => prev + 1);
        setSocraticLoading(false);
        return;
      }
      questionText = `Give me a helpful thinking hint for: ${activeEx?.prompt}`;
    }

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          state: { v: 2, currentLesson: lessonData.title, activeConcept: activeEx?.concept },
        }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setSocraticReply(data.answer);
      }
    } catch (err) {
      console.error('Socratic agent query failed', err);
      setSocraticReply('AI mentor is temporarily unavailable. Review the walkthrough steps above.');
    } finally {
      setSocraticLoading(false);
    }
  };

  const activeExercise = dynamicQuestion || (lessonData ? lessonData.exercises[currentExerciseIndex] : null);

  return (
    <div className="learn-workspace wide">
      {/* 1. Header & Context */}
      <div className="learn-header-card">
        <div className="learn-header-meta">
          <span className="learn-skill-tag">
            <Code2 size={13} />
            {lessonData?.skillSlug.replace(/-/g, ' ').toUpperCase() || 'LEARNING TRACK'}
          </span>
          <span className="learn-time-pill">
            <Clock size={12} />
            {lessonData?.estimatedMinutes || 15} MIN ESTIMATED
          </span>
          <span className={`learn-diff-badge ${lessonData?.difficulty || 'foundational'}`}>
            {(lessonData?.difficulty || 'foundational').toUpperCase()}
          </span>
        </div>

        <h1 className="learn-title">{lessonData?.title || 'Interactive Learning Workspace'}</h1>
        <p className="learn-summary">{lessonData?.summary}</p>

        <div className="learn-triad-banner">
          <div className="triad-item">
            <span className="triad-label">WHY AM I LEARNING THIS?</span>
            <p className="triad-text">{lessonData?.whyItMatters}</p>
          </div>
          <div className="triad-item">
            <span className="triad-label">PREREQUISITES</span>
            <p className="triad-text">{lessonData?.prerequisites.join(', ') || 'Introductory logic'}</p>
          </div>
          <div className="triad-item">
            <span className="triad-label">COMPLETION REQUIRES</span>
            <p className="triad-text">Walk through execution traces & solve 2 exercises with 0 hints for verified mastery.</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="learn-tabs-nav" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'walkthrough'}
            className={`learn-tab-btn ${activeTab === 'walkthrough' ? 'active' : ''}`}
            onClick={() => setActiveTab('walkthrough')}
          >
            <BookOpen size={15} />
            <span>01. Interactive Walkthrough</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'practice'}
            className={`learn-tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <Code2 size={15} />
            <span>02. Code Tracing & Practice</span>
            {lessonData && (
              <span className="tab-count-pill">
                {lessonProgress?.exercisesCompleted || 0}/{lessonData.exercises.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'catalog'}
            className={`learn-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Layers size={15} />
            <span>All Lessons ({lessons.length})</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="learn-loading-state">
          <RefreshCw size={24} className="spin" />
          <span>Loading verified lesson curriculum & code execution traces…</span>
        </div>
      )}

      {/* 2. TAB 1: INTERACTIVE WALKTHROUGH */}
      {!loading && activeTab === 'walkthrough' && lessonData && (
        <div className="walkthrough-container">
          {/* Key Definitions Accordion */}
          <div className="definitions-panel">
            <div className="section-kicker">
              <Sparkles size={13} /> CORE MENTAL MODELS & DEFINITIONS
            </div>
            <div className="definitions-grid">
              {lessonData.keyDefinitions.map((def, i) => (
                <div key={i} className="def-card">
                  <div className="def-term">{def.term}</div>
                  <div className="def-body">{def.definition}</div>
                  {def.analogy && (
                    <div className="def-analogy">
                      <Lightbulb size={12} />
                      <span>{def.analogy}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Code Walkthrough */}
          <div className="stepper-panel">
            <div className="stepper-header">
              <div>
                <span className="section-kicker">STEP-BY-STEP CODE TRACING</span>
                <h3 className="stepper-title">
                  Step {currentStepIndex + 1} of {lessonData.walkthroughSteps.length}:{' '}
                  {lessonData.walkthroughSteps[currentStepIndex]?.title}
                </h3>
              </div>
              <div className="stepper-controls">
                <button
                  type="button"
                  className="step-nav-btn"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="step-nav-btn primary"
                  disabled={currentStepIndex >= lessonData.walkthroughSteps.length - 1}
                  onClick={() =>
                    setCurrentStepIndex((p) => Math.min(lessonData.walkthroughSteps.length - 1, p + 1))
                  }
                >
                  Next Step <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="code-viewer-card">
              <div className="code-viewer-header">
                <span className="code-lang">
                  {lessonData.skillSlug === 'c-systems' ? 'C SOURCE' : lessonData.skillSlug === 'sql-databases' ? 'SQL QUERY' : 'JAVASCRIPT'}
                </span>
                <span className="code-line-count">
                  {lessonData.walkthroughSteps[currentStepIndex]?.codeSnippet.split('\n').length} lines
                </span>
              </div>
              <pre className="code-pre">
                <code>
                  {lessonData.walkthroughSteps[currentStepIndex]?.codeSnippet
                    .split('\n')
                    .map((line, idx) => {
                      const isHighlighted = lessonData.walkthroughSteps[
                        currentStepIndex
                      ]?.highlightLines?.includes(idx + 1);
                      return (
                        <div
                          key={idx}
                          className={`code-line ${isHighlighted ? 'highlighted' : ''}`}
                        >
                          <span className="line-num">{idx + 1}</span>
                          <span className="line-text">{line}</span>
                        </div>
                      );
                    })}
                </code>
              </pre>
            </div>

            <div className="explanation-card">
              <div className="explanation-title">
                <Sparkles size={14} /> Execution State & Mechanics
              </div>
              <p className="explanation-text">
                {lessonData.walkthroughSteps[currentStepIndex]?.explanation}
              </p>
              <div className="mental-model-callout">
                <Target size={14} />
                <span>
                  <b>Key Mental Model:</b>{' '}
                  {lessonData.walkthroughSteps[currentStepIndex]?.mentalModelNote}
                </span>
              </div>
            </div>

            {/* Common Pitfalls & Traps */}
            <div className="pitfalls-panel">
              <span className="section-kicker">
                <AlertCircle size={13} /> FREQUENT STUDENT PITFALLS & DEBUGGING
              </span>
              <div className="pitfalls-list">
                {lessonData.commonPitfalls.map((pf, i) => (
                  <div key={i} className="pitfall-card">
                    <div className="pitfall-misconception">
                      <span className="bad-tag">WRONG MENTAL MODEL:</span> {pf.misconception}
                    </div>
                    <div className="pitfall-why">
                      <b>Why it fails:</b> {pf.whyItFails}
                    </div>
                    <div className="pitfall-fix">
                      <span className="good-tag">CORRECT FIX:</span> {pf.correctApproach}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Practice Button */}
            <div className="walkthrough-cta">
              <button
                type="button"
                className="primary large-cta-btn"
                onClick={() => setActiveTab('practice')}
              >
                <Code2 size={16} /> Proceed to Interactive Practice & Tracing Exercises
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB 2: INTERACTIVE PRACTICE & CODE TRACING */}
      {!loading && activeTab === 'practice' && lessonData && (
        <div className="practice-container">
          <div className="practice-grid">
            {/* Left: Active Exercise Card */}
            <div className="practice-main">
              <div className="exercise-card">
                <div className="exercise-header">
                  <div>
                    <span className="exercise-kicker">
                      {dynamicQuestion ? 'DYNAMIC PRACTICE' : `EXERCISE ${currentExerciseIndex + 1} OF ${lessonData.exercises.length}`}
                    </span>
                    <h3 className="exercise-concept">
                      Concept: {(activeExercise?.concept || 'Logic').replace(/_/g, ' ').toUpperCase()}
                    </h3>
                  </div>
                  <div className="exercise-source-badge">
                    {dynamicQuestion ? (
                      <span className="source-tag dynamic">
                        <Sparkles size={11} /> {dynamicQuestion.source === 'gemini_ai' ? 'Gemini AI' : 'Algorithmic Template'}
                      </span>
                    ) : (
                      <span className="source-tag vetted">
                        <Check size={11} /> Vetted Standard
                      </span>
                    )}
                  </div>
                </div>

                <p className="exercise-prompt">{activeExercise?.prompt}</p>

                {activeExercise?.codeSnippet && (
                  <div className="exercise-code-block">
                    <pre>
                      <code>{activeExercise.codeSnippet}</code>
                    </pre>
                  </div>
                )}

                {/* Multiple Choices */}
                <div className="choices-group" role="radiogroup" aria-label="Multiple choice answers">
                  {activeExercise?.choices.map((choice: string, idx: number) => {
                    const isSelected = selectedChoice === idx;
                    let choiceClass = 'choice-item';
                    if (isSelected) choiceClass += ' selected';
                    if (attemptResult) {
                      if (idx === attemptResult.correctIndex) choiceClass += ' correct';
                      else if (isSelected && !attemptResult.isCorrect) choiceClass += ' incorrect';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={choiceClass}
                        disabled={submitting}
                        onClick={() => {
                          setSelectedChoice(idx);
                          setAttemptResult(null);
                        }}
                      >
                        <span className="choice-marker">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="choice-text">{choice}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Submit & Action Controls */}
                <div className="exercise-action-bar">
                  <div className="hints-action-group">
                    <button
                      type="button"
                      className="hint-btn"
                      disabled={hintsRevealed >= (activeExercise?.hints.length || 0)}
                      onClick={() => setHintsRevealed((p) => p + 1)}
                    >
                      <Lightbulb size={14} />
                      <span>
                        {hintsRevealed === 0
                          ? 'Request Hint 1'
                          : hintsRevealed < (activeExercise?.hints.length || 0)
                          ? `Request Hint ${hintsRevealed + 1}`
                          : 'All Hints Revealed'}
                      </span>
                    </button>
                    {hintsRevealed > 0 && (
                      <span className="hint-penalty-note">
                        (Using hints provides partial mastery credit)
                      </span>
                    )}
                  </div>

                  <div className="submit-group">
                    {attemptResult ? (
                      <button
                        type="button"
                        className="primary submit-btn"
                        onClick={() => {
                          if (dynamicQuestion) {
                            void handleGenerateQuestion();
                          } else if (currentExerciseIndex < lessonData.exercises.length - 1) {
                            setCurrentExerciseIndex((p) => p + 1);
                            setSelectedChoice(null);
                            setAttemptResult(null);
                            setHintsRevealed(0);
                            setSocraticReply(null);
                          } else {
                            // Completed all vetted exercises, offer dynamic practice
                            void handleGenerateQuestion();
                          }
                        }}
                      >
                        {attemptResult.isCorrect ? 'Next Problem' : 'Try Another Problem'} <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary submit-btn"
                        disabled={selectedChoice === null || submitting}
                        onClick={handleSubmitAnswer}
                      >
                        {submitting ? 'Evaluating…' : 'Submit Answer'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progressive Hints List */}
                {hintsRevealed > 0 && activeExercise?.hints && (
                  <div className="revealed-hints-panel">
                    {activeExercise.hints.slice(0, hintsRevealed).map((hint: string, i: number) => (
                      <div key={i} className="hint-card">
                        <span className="hint-num">Hint {i + 1}:</span>
                        <span className="hint-content">{hint}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Socratic Feedback Alert */}
                {attemptResult && (
                  <div className={`feedback-card ${attemptResult.isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="feedback-header">
                      {attemptResult.isCorrect ? (
                        <>
                          <CheckCircle2 size={18} className="feedback-icon success" />
                          <b>Demonstrated Competency</b>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={18} className="feedback-icon danger" />
                          <b>Misunderstanding Detected</b>
                        </>
                      )}
                    </div>
                    <p className="feedback-message">{attemptResult.feedback}</p>
                    {attemptResult.misconceptionExplanation && (
                      <div className="misconception-box">
                        <b>Why this is a common trap:</b> {attemptResult.misconceptionExplanation}
                      </div>
                    )}
                    <div className="explanation-box">
                      <b>Mechanics:</b> {attemptResult.explanation}
                    </div>
                    <div className="recommendation-box">
                      <Target size={13} />
                      <span>{attemptResult.nextStepRecommendation}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Socratic AI Mentor Actions Bar */}
              <div className="socratic-bar">
                <span className="socratic-title">
                  <Sparkles size={13} /> AI SOCRATIC TUTOR:
                </span>
                <div className="socratic-chips">
                  <button
                    type="button"
                    className="socratic-chip"
                    disabled={socraticLoading}
                    onClick={() => handleSocraticPrompt('simpler')}
                  >
                    Explain simpler
                  </button>
                  <button
                    type="button"
                    className="socratic-chip"
                    disabled={socraticLoading}
                    onClick={() => handleSocraticPrompt('example')}
                  >
                    Show another example
                  </button>
                  <button
                    type="button"
                    className="socratic-chip"
                    disabled={socraticLoading || selectedChoice === null}
                    onClick={() => handleSocraticPrompt('why_wrong')}
                  >
                    Why is my answer wrong?
                  </button>
                  <button
                    type="button"
                    className="socratic-chip highlight"
                    disabled={generatingPractice}
                    onClick={() => handleGenerateQuestion()}
                  >
                    Generate fresh question
                  </button>
                </div>
              </div>

              {socraticLoading && (
                <div className="socratic-loading">
                  <RefreshCw size={14} className="spin" />
                  <span>Socratic tutor is formulating tailored explanation…</span>
                </div>
              )}

              {socraticReply && !socraticLoading && (
                <div className="socratic-reply-card">
                  <div className="reply-header">
                    <Sparkles size={14} /> Socratic Guidance
                  </div>
                  <p className="reply-text">{socraticReply}</p>
                </div>
              )}
            </div>

            {/* Right: Concept Mastery & Continuous Practice Sidebar */}
            <div className="practice-sidebar">
              {/* Concept Mastery Status Card */}
              <div className="mastery-card">
                <div className="mastery-header">
                  <Award size={16} />
                  <h4>Concept Mastery Status</h4>
                </div>
                <div className="mastery-list">
                  {lessonData.exercises.map((ex, i) => {
                    const m = conceptsMastery[ex.concept] || {
                      status: 'novice',
                      score: 0,
                      solved: 0,
                    };
                    return (
                      <div key={i} className="mastery-item">
                        <div className="mastery-item-top">
                          <span className="concept-name">{ex.concept.replace(/_/g, ' ')}</span>
                          <span className={`mastery-status-pill ${m.status}`}>
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mastery-progress-bar">
                          <div
                            className={`mastery-fill ${m.status}`}
                            style={{ width: `${Math.max(10, m.score)}%` }}
                          />
                        </div>
                        <div className="mastery-meta">
                          <span>{m.solved} solved</span>
                          <span>{m.score}% proficiency</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mastery-criteria-note">
                  <Target size={12} />
                  <span>
                    <b>Mastery Criteria:</b> Requires 2+ distinct questions solved with 0 hints.
                    Evidence is written directly to your passport ledger.
                  </span>
                </div>
              </div>

              {/* Continuous Practice Engine Trigger */}
              <div className="continuous-card">
                <div className="continuous-header">
                  <Flame size={16} />
                  <h4>Continuous Practice Engine</h4>
                </div>
                <p className="continuous-desc">
                  Keep practising after completing this lesson. Generate algorithmic variations and
                  AI-calibrated problems anytime without limits.
                </p>
                <button
                  type="button"
                  className="continuous-btn"
                  disabled={generatingPractice}
                  onClick={() => handleGenerateQuestion()}
                >
                  <RefreshCw size={13} className={generatingPractice ? 'spin' : ''} />
                  <span>Generate New Practice Question</span>
                </button>
              </div>

              {/* Next Action Banner in Sidebar */}
              {nextAction && (
                <div className="sidebar-next-card">
                  <div className="next-kicker">
                    <Zap size={13} /> NEXT BEST ACTION
                  </div>
                  <h4 className="next-title">{nextAction.title}</h4>
                  <p className="next-desc">{nextAction.explanation}</p>
                  <button
                    type="button"
                    className="primary next-btn"
                    onClick={() => {
                      if (nextAction.route === 'learn' && nextAction.lessonId) {
                        setActiveLessonId(nextAction.lessonId);
                      } else {
                        go(nextAction.route as View, nextAction.projectSlug || nextAction.skillId);
                      }
                    }}
                  >
                    {nextAction.buttonLabel} <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 3: LESSONS CATALOG */}
      {!loading && activeTab === 'catalog' && (
        <div className="catalog-container">
          <div className="catalog-header">
            <h3>Verified Continuous Curriculum</h3>
            <p>Select any foundational topic to inspect execution traces and practice.</p>
          </div>
          <div className="lessons-catalog-grid">
            {lessons.map((l) => (
              <div
                key={l.id}
                className={`catalog-card ${l.id === activeLessonId ? 'active' : ''}`}
                onClick={() => {
                  setActiveLessonId(l.id);
                  setActiveTab('walkthrough');
                }}
              >
                <div className="catalog-card-top">
                  <span className="catalog-skill-slug">{l.skillSlug.toUpperCase()}</span>
                  <span className={`catalog-status-badge ${l.status}`}>
                    {l.status === 'completed'
                      ? 'COMPLETED'
                      : l.status === 'in_progress'
                      ? 'IN PROGRESS'
                      : 'NOT STARTED'}
                  </span>
                </div>
                <h4 className="catalog-card-title">{l.title}</h4>
                <p className="catalog-card-summary">{l.summary}</p>
                <div className="catalog-card-footer">
                  <span>
                    <Clock size={12} /> {l.estimatedMinutes}m
                  </span>
                  <span>{l.exercisesCompleted}/{l.exercisesTotal} exercises</span>
                  <span className="open-link">
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
