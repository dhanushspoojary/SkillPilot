"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Code2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
  Trophy,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Award,
  RefreshCw,
  Clock,
  Play,
  Check,
  Bot,
  X,
  Send,
  Table as TableIcon,
} from "lucide-react";
import type { View } from "./views";

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
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
}

interface WalkthroughStep {
  step: number;
  title: string;
  codeSnippet: string;
  language?: string;
  highlightLines?: number[];
  explanation: string;
  mentalModelNote: string;
  traceTable?: {
    iteration: string;
    currentValue: string;
    condition: string;
    updatedValue: string;
  }[];
}

interface LessonExercise {
  id: string;
  concept: string;
  prompt: string;
  codeSnippet?: string;
  language?: string;
  choices: string[];
  hints: string[];
}

interface LessonDetail {
  id: string;
  skillSlug: string;
  language: string;
  title: string;
  summary: string;
  whyItMatters: string;
  prerequisites: string[];
  difficulty: string;
  estimatedMinutes: number;
  keyDefinitions: Array<{ term: string; definition: string; analogy?: string }>;
  walkthroughSteps: WalkthroughStep[];
  commonPitfalls: Array<{
    misconception: string;
    whyItFails: string;
    correctApproach: string;
  }>;
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
  const [activeLessonId, setActiveLessonId] = useState<string>(
    initialLessonId || "ps-loop-tracing",
  );
  const [lessonData, setLessonData] = useState<LessonDetail | null>(null);

  // Single Primary Task Stages: 'intro' | 'walkthrough' | 'practice' | 'catalog'
  const [activeTab, setActiveTab] = useState<
    "intro" | "walkthrough" | "practice" | "catalog"
  >("walkthrough");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Progressive Disclosure Toggles
  const [showAdvancedIntro, setShowAdvancedIntro] = useState(false);
  const [showTraceTable, setShowTraceTable] = useState(true);
  const [showPitfalls, setShowPitfalls] = useState(false);

  // Practice state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<any | null>(null);
  const [conceptsMastery, setConceptsMastery] = useState<Record<string, any>>(
    {},
  );
  const [lessonProgress, setLessonProgress] = useState<any>(null);

  // Dynamic practice generation
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [dynamicQuestion, setDynamicQuestion] = useState<any | null>(null);

  // Unified Next action state
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  // Contextual AI Tutor Flyout/Modal
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Load lesson catalog
  const loadLessons = useCallback(async () => {
    try {
      const res = await fetch("/api/learn/lessons", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setLessons(d.lessons || []);
      }
    } catch (e) {
      console.error("Failed to load lessons", e);
    }
  }, []);

  // Load unified next action
  const loadNextAction = useCallback(async () => {
    try {
      const res = await fetch("/api/learn/next-action", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setNextAction(d.nextAction);
      }
    } catch (e) {
      console.error("Failed to load next action", e);
    }
  }, []);

  // Load specific lesson
  const loadLesson = useCallback(async (id: string) => {
    setLoading(true);
    setAttemptResult(null);
    setSelectedChoice(null);
    setHintsRevealed(0);
    setDynamicQuestion(null);
    setShowTraceTable(true);
    try {
      const res = await fetch(
        `/api/learn/lesson?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const d = await res.json();
        setLessonData(d.lesson);
        setConceptsMastery(d.conceptsMastery || {});
        setLessonProgress(d.progress);
        setCurrentStepIndex(0);
        setCurrentExerciseIndex(0);
      }
    } catch (e) {
      console.error("Failed to load lesson", e);
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
    const activeEx =
      dynamicQuestion || lessonData.exercises[currentExerciseIndex];
    if (!activeEx) return;

    try {
      const res = await fetch("/api/learn/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          if (d.result.lessonProgress.status === "completed" && onCompleted) {
            onCompleted();
          }
        }
        void loadLessons();
        void loadNextAction();
      }
    } catch (err) {
      console.error("Failed to submit answer", err);
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

    try {
      const activeEx = lessonData.exercises[currentExerciseIndex];
      const res = await fetch("/api/learn/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillSlug: lessonData.skillSlug,
          topic: conceptName || activeEx?.concept || "code_tracing",
          difficulty: lessonData.difficulty || "foundational",
        }),
      });

      const d = await res.json();
      if (res.ok && d.question) {
        setDynamicQuestion(d.question);
      }
    } catch (err) {
      console.error("Failed to generate practice question", err);
    } finally {
      setGeneratingPractice(false);
    }
  };

  // Socratic AI Tutor Query
  const sendTutorQuery = async (queryText: string) => {
    if (!queryText.trim() || tutorLoading) return;
    setTutorLoading(true);
    setTutorError(null);

    const userMsg = { role: "user" as const, text: queryText.trim() };
    setTutorMessages((prev) => [...prev, userMsg]);
    setTutorInput("");

    const activeEx =
      dynamicQuestion ||
      (lessonData ? lessonData.exercises[currentExerciseIndex] : null);
    const activeStep = lessonData?.walkthroughSteps[currentStepIndex];

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: queryText.trim(),
          state: {
            v: 2,
            currentLesson: lessonData?.title,
            language: lessonData?.language,
            activeConcept: activeEx?.concept || activeStep?.title,
            activeCode: activeEx?.codeSnippet || activeStep?.codeSnippet,
            selectedChoiceIndex: selectedChoice,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setTutorMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.answer },
        ]);
      } else {
        const errorMsg =
          data.error ||
          "The AI tutor is temporarily busy. Review the walkthrough steps or execution table above.";
        setTutorError(errorMsg);
        setTutorMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "I am temporarily unable to connect to the tutor service. In the meantime, look at the execution table to trace how variables evolve pass by pass!",
          },
        ]);
      }
    } catch (err) {
      console.error("AI Tutor request failed", err);
      setTutorError("Network connection issue. Please check your connection.");
      setTutorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Unable to reach the tutor backend. Please verify your connection or consult the walkthrough code example.",
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  // Helper quick actions for AI tutor
  const triggerQuickTutorAction = (
    type: "simpler" | "line" | "hint" | "example" | "why_wrong" | "similar",
  ) => {
    const activeEx =
      dynamicQuestion ||
      (lessonData ? lessonData.exercises[currentExerciseIndex] : null);
    const activeStep = lessonData?.walkthroughSteps[currentStepIndex];

    let prompt = "";
    switch (type) {
      case "simpler":
        prompt = `Explain the concept "${activeEx?.concept || activeStep?.title || lessonData?.title}" in simpler, beginner-friendly terms with a real-life analogy.`;
        break;
      case "line":
        prompt = `Explain the key line of code in "${activeStep?.title || activeEx?.concept}" step-by-step for a beginner.`;
        break;
      case "hint":
        if (activeEx && hintsRevealed < activeEx.hints.length) {
          setHintsRevealed((prev) => prev + 1);
          return;
        }
        prompt = `Give me a helpful thinking hint for: ${activeEx?.prompt || lessonData?.title}`;
        break;
      case "example":
        prompt = `Show me another short, clear code example demonstrating "${activeEx?.concept || activeStep?.title || lessonData?.title}".`;
        break;
      case "why_wrong":
        prompt = `I chose option ${selectedChoice !== null ? selectedChoice + 1 : "an option"} for the question "${activeEx?.prompt}". Explain the misconception behind this answer without giving away the final solution.`;
        break;
      case "similar":
        void handleGenerateQuestion();
        setShowTutorModal(false);
        return;
    }

    setShowTutorModal(true);
    void sendTutorQuery(prompt);
  };

  const activeExercise =
    dynamicQuestion ||
    (lessonData ? lessonData.exercises[currentExerciseIndex] : null);
  const activeStep = lessonData?.walkthroughSteps[currentStepIndex];

  // Language display formatter
  const formatLanguage = (lang?: string) => {
    if (!lang) return "CODE";
    if (lang === "c") return "C SOURCE";
    if (lang === "javascript" || lang === "js") return "JAVASCRIPT";
    if (lang === "sql") return "SQL QUERY";
    return lang.toUpperCase();
  };

  // Difficulty badge label
  const formatDifficulty = (diff?: string) => {
    if (diff === "introductory" || diff === "foundational") return "Beginner";
    if (diff === "intermediate") return "Intermediate";
    if (diff === "advanced") return "Advanced";
    return "Beginner";
  };

  // Calculate simple overall lesson progress percentage (0 - 100)
  const calculateOverallProgress = () => {
    if (!lessonData) return 0;
    const totalSteps = lessonData.walkthroughSteps.length;
    const totalExercises = lessonData.exercises.length;
    const totalTasks = totalSteps + totalExercises;
    if (totalTasks === 0) return 0;

    let completedTasks = 0;
    if (activeTab === "intro") {
      completedTasks = 0.5;
    } else if (activeTab === "walkthrough") {
      completedTasks = currentStepIndex + 1;
    } else if (activeTab === "practice") {
      completedTasks =
        totalSteps +
        (lessonProgress?.exercisesCompleted || currentExerciseIndex);
    }
    return Math.min(100, Math.round((completedTasks / totalTasks) * 100));
  };

  return (
    <div className="learn-workspace wide">
      {/* =========================================================================
          A. LEARNING HEADER (Clean, unbloated, single-task focused)
          ========================================================================= */}
      <header className="learn-primary-header">
        <div className="header-top-row">
          <button
            type="button"
            className="back-nav-btn"
            onClick={() => go("roadmap")}
            aria-label="Back to learning path"
          >
            <ArrowLeft size={16} />
            <span>Back to learning path</span>
          </button>

          <div className="header-utility-actions">
            <button
              type="button"
              className="open-tutor-btn"
              onClick={() => setShowTutorModal(true)}
              aria-label="Open AI Tutor"
            >
              <Bot size={15} />
              <span>Ask AI Tutor</span>
            </button>
            <button
              type="button"
              className={`catalog-toggle-btn ${activeTab === "catalog" ? "active" : ""}`}
              onClick={() =>
                setActiveTab((prev) =>
                  prev === "catalog" ? "walkthrough" : "catalog",
                )
              }
            >
              <Layers size={14} />
              <span>All Lessons ({lessons.length})</span>
            </button>
          </div>
        </div>

        <div className="header-main-row">
          <div className="header-title-block">
            <h1 className="header-lesson-title">
              {lessonData?.title || "Interactive Learning Workspace"}
            </h1>
            <div className="header-meta-chips">
              <span className="step-count-chip">
                {activeTab === "intro" && "Introduction"}
                {activeTab === "walkthrough" &&
                  `Step ${currentStepIndex + 1} of ${lessonData?.walkthroughSteps.length || 1}`}
                {activeTab === "practice" &&
                  `Question ${currentExerciseIndex + 1} of ${lessonData?.exercises.length || 1}`}
                {activeTab === "catalog" && "Curriculum Overview"}
              </span>
              <span className="meta-pill">
                <Clock size={12} />
                <span>{lessonData?.estimatedMinutes || 15} min</span>
              </span>
              <span
                className={`level-pill ${(lessonData?.difficulty || "foundational").toLowerCase()}`}
              >
                {formatDifficulty(lessonData?.difficulty)}
              </span>
              <span className="lang-pill">
                {formatLanguage(lessonData?.language)}
              </span>
            </div>
          </div>

          {/* Simple Clean Progress Indicator */}
          <div className="header-progress-block">
            <div className="progress-labels">
              <span className="progress-caption">Lesson Progress</span>
              <span className="progress-percentage">
                {calculateOverallProgress()}%
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={calculateOverallProgress()}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-fill"
                style={{ width: `${calculateOverallProgress()}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streamlined Step Nav Tabs */}
        <nav
          className="learn-stage-nav"
          role="tablist"
          aria-label="Learning Stages"
        >
          <button
            role="tab"
            aria-selected={activeTab === "intro"}
            className={`stage-tab-btn ${activeTab === "intro" ? "active" : ""}`}
            onClick={() => setActiveTab("intro")}
          >
            <BookOpen size={14} />
            <span>01. Introduction</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "walkthrough"}
            className={`stage-tab-btn ${activeTab === "walkthrough" ? "active" : ""}`}
            onClick={() => setActiveTab("walkthrough")}
          >
            <Play size={14} />
            <span>02. Guided Walkthrough</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "practice"}
            className={`stage-tab-btn ${activeTab === "practice" ? "active" : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            <Code2 size={14} />
            <span>Code Tracing & Practice</span>
            {lessonData && (
              <span className="stage-badge">
                {lessonProgress?.exercisesCompleted || 0}/
                {lessonData.exercises.length}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="learn-loading-state" role="status">
          <RefreshCw size={24} className="spin" />
          <span>
            Loading verified lesson curriculum & code execution traces…
          </span>
        </div>
      )}

      {/* =========================================================================
          B. LESSON INTRODUCTION (Clean structure: What, Why, Short example, CTA)
          ========================================================================= */}
      {!loading && activeTab === "intro" && lessonData && (
        <main className="intro-container">
          <div className="intro-card">
            {/* 1. What you will learn */}
            <section className="intro-section">
              <h2 className="intro-section-heading">What you will learn</h2>
              <p className="intro-text">{lessonData.summary}</p>
            </section>

            {/* 2. Why it matters */}
            <section className="intro-section highlight-box">
              <h2 className="intro-section-heading">Why it matters</h2>
              <p className="intro-text">{lessonData.whyItMatters}</p>
            </section>

            {/* 3. One short example */}
            <section className="intro-section">
              <div className="example-header">
                <h2 className="intro-section-heading">One short example</h2>
                <span className="code-lang-tag">
                  {formatLanguage(lessonData.language)}
                </span>
              </div>
              <div className="intro-code-box">
                <pre>
                  <code>
                    {lessonData.walkthroughSteps[0]?.codeSnippet ||
                      "// Example code"}
                  </code>
                </pre>
              </div>
              <p className="intro-caption">
                In this lesson, you will mentally step through this code
                line-by-line to understand exactly how values evolve.
              </p>
            </section>

            {/* 4. Start learning button */}
            <div className="intro-cta-row">
              <button
                type="button"
                className="primary start-learning-btn"
                onClick={() => setActiveTab("walkthrough")}
              >
                <span>Start Guided Walkthrough</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Expandable Advanced Details: Key Definitions & Prerequisites */}
            <div className="expandable-drawer">
              <button
                type="button"
                className="expandable-trigger"
                onClick={() => setShowAdvancedIntro((prev) => !prev)}
                aria-expanded={showAdvancedIntro}
              >
                <span>
                  Prerequisites & Core Definitions (
                  {lessonData.keyDefinitions.length})
                </span>
                {showAdvancedIntro ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {showAdvancedIntro && (
                <div className="expandable-content">
                  <div className="prereq-note">
                    <b>Prerequisites:</b>{" "}
                    {lessonData.prerequisites.join(", ") || "None required"}
                  </div>
                  <div className="definitions-simple-grid">
                    {lessonData.keyDefinitions.map((def, i) => (
                      <div key={i} className="def-simple-item">
                        <strong className="def-term">{def.term}:</strong>
                        <span className="def-desc"> {def.definition}</span>
                        {def.analogy && (
                          <div className="def-analogy-box">
                            <Lightbulb size={12} />
                            <span>{def.analogy}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
          C & D. GUIDED WALKTHROUGH & STEP-BY-STEP CODE EXPLANATION
          ========================================================================= */}
      {!loading && activeTab === "walkthrough" && lessonData && activeStep && (
        <main className="walkthrough-container">
          <div className="walkthrough-step-card">
            {/* Step Header with Navigation */}
            <div className="step-header">
              <div className="step-title-group">
                <span className="step-kicker">
                  STEP {currentStepIndex + 1} OF{" "}
                  {lessonData.walkthroughSteps.length}
                </span>
                <h2 className="step-concept-title">{activeStep.title}</h2>
              </div>
              <div className="stepper-controls">
                <button
                  type="button"
                  className="step-nav-btn"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                  aria-label="Previous step"
                >
                  <ArrowLeft size={14} />
                  <span>Previous</span>
                </button>
                {currentStepIndex < lessonData.walkthroughSteps.length - 1 ? (
                  <button
                    type="button"
                    className="step-nav-btn primary"
                    onClick={() => setCurrentStepIndex((p) => p + 1)}
                    aria-label="Next step"
                  >
                    <span>Next Step</span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="step-nav-btn primary"
                    onClick={() => setActiveTab("practice")}
                    aria-label="Proceed to practice"
                  >
                    <span>Proceed to Practice</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Code Viewer with Correct Language Tag and Highlighted Lines */}
            <div className="code-viewer-card">
              <div className="code-viewer-header">
                <span className="code-lang">
                  {formatLanguage(activeStep.language || lessonData.language)}
                </span>
                <span className="code-line-count">
                  {activeStep.codeSnippet.split("\n").length} lines
                </span>
              </div>
              <pre className="code-pre">
                <code>
                  {activeStep.codeSnippet.split("\n").map((line, idx) => {
                    const isHighlighted = activeStep.highlightLines?.includes(
                      idx + 1,
                    );
                    return (
                      <div
                        key={idx}
                        className={`code-line ${isHighlighted ? "highlighted" : ""}`}
                      >
                        <span className="line-num">{idx + 1}</span>
                        <span className="line-text">{line}</span>
                      </div>
                    );
                  })}
                </code>
              </pre>
            </div>

            {/* Plain-English Explanation & Key Takeaway */}
            <div className="explanation-card">
              <div className="explanation-title">
                <Sparkles size={14} />
                <span>What is happening in this step</span>
              </div>
              <p className="explanation-text">{activeStep.explanation}</p>
              <div className="mental-model-callout">
                <Target size={14} />
                <span>
                  <b>Key Takeaway:</b> {activeStep.mentalModelNote}
                </span>
              </div>
            </div>

            {/* Optional Execution Trace Table (Section D) */}
            {activeStep.traceTable && activeStep.traceTable.length > 0 && (
              <div className="execution-trace-section">
                <div className="trace-table-header">
                  <div className="trace-title">
                    <TableIcon size={14} />
                    <span>Variable Execution Trace</span>
                  </div>
                  <button
                    type="button"
                    className="trace-toggle-btn"
                    onClick={() => setShowTraceTable((prev) => !prev)}
                    aria-expanded={showTraceTable}
                  >
                    {showTraceTable ? "Hide Table" : "Show Table"}
                  </button>
                </div>

                {showTraceTable && (
                  <div className="trace-table-scroll">
                    <table className="execution-table">
                      <thead>
                        <tr>
                          <th scope="col">Iteration</th>
                          <th scope="col">Current value</th>
                          <th scope="col">Condition</th>
                          <th scope="col">Updated value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeStep.traceTable.map((row, idx) => (
                          <tr key={idx}>
                            <td className="trace-col-iter">{row.iteration}</td>
                            <td className="trace-col-val">
                              {row.currentValue}
                            </td>
                            <td className="trace-col-cond">{row.condition}</td>
                            <td className="trace-col-updated">
                              {row.updatedValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="walkthrough-bottom-bar">
              <div className="left-action">
                <button
                  type="button"
                  className="quick-tutor-trigger"
                  onClick={() => triggerQuickTutorAction("line")}
                >
                  <Bot size={13} />
                  <span>Explain this line with AI Tutor</span>
                </button>
              </div>

              <div className="right-action">
                {currentStepIndex < lessonData.walkthroughSteps.length - 1 ? (
                  <button
                    type="button"
                    className="primary next-step-cta"
                    onClick={() => setCurrentStepIndex((p) => p + 1)}
                  >
                    <span>
                      Next Step ({currentStepIndex + 2} of{" "}
                      {lessonData.walkthroughSteps.length})
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary next-step-cta"
                    onClick={() => setActiveTab("practice")}
                  >
                    <span>Start Practice Exercises</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Common Pitfalls & Traps */}
            {lessonData.commonPitfalls.length > 0 && (
              <div className="pitfalls-accordion">
                <button
                  type="button"
                  className="pitfalls-trigger"
                  onClick={() => setShowPitfalls((p) => !p)}
                  aria-expanded={showPitfalls}
                >
                  <div className="pitfall-trigger-left">
                    <AlertCircle size={14} />
                    <span>
                      Common Traps to Avoid ({lessonData.commonPitfalls.length})
                    </span>
                  </div>
                  {showPitfalls ? (
                    <ChevronUp size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )}
                </button>

                {showPitfalls && (
                  <div className="pitfalls-body">
                    {lessonData.commonPitfalls.map((pf, i) => (
                      <div key={i} className="pitfall-simple-card">
                        <div className="pf-misconception">
                          <span className="trap-pill">Trap:</span>{" "}
                          {pf.misconception}
                        </div>
                        <div className="pf-explanation">
                          <b>Why it fails:</b> {pf.whyItFails}
                        </div>
                        <div className="pf-fix">
                          <b>Correct approach:</b> {pf.correctApproach}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      {/* =========================================================================
          E. PRACTICE QUESTION (Single prominent question, non-punitive feedback)
          ========================================================================= */}
      {!loading && activeTab === "practice" && lessonData && (
        <main className="practice-container">
          <div className="practice-layout">
            {/* Primary Focus: Active Question */}
            <div className="practice-primary-card">
              <div className="exercise-card">
                <div className="exercise-header">
                  <div>
                    <span className="exercise-kicker">
                      {dynamicQuestion
                        ? "DYNAMIC PRACTICE"
                        : `EXERCISE ${currentExerciseIndex + 1} OF ${lessonData.exercises.length}`}
                    </span>
                    <h2 className="exercise-concept">
                      Concept:{" "}
                      {(activeExercise?.concept || "Logic").replace(/_/g, " ")}
                    </h2>
                  </div>
                  <div className="exercise-badge-group">
                    <span className="lang-tag">
                      {formatLanguage(
                        activeExercise?.language || lessonData.language,
                      )}
                    </span>
                    {dynamicQuestion ? (
                      <span className="source-tag dynamic">
                        <Sparkles size={11} /> AI Generated
                      </span>
                    ) : (
                      <span className="source-tag vetted">
                        <Check size={11} /> Core Curriculum
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
                <div
                  className="choices-group"
                  role="radiogroup"
                  aria-label="Multiple choice answers"
                >
                  {activeExercise?.choices.map(
                    (choice: string, idx: number) => {
                      const isSelected = selectedChoice === idx;
                      let choiceClass = "choice-item";
                      if (isSelected) choiceClass += " selected";
                      if (attemptResult) {
                        if (idx === attemptResult.correctIndex)
                          choiceClass += " correct";
                        else if (isSelected && !attemptResult.isCorrect)
                          choiceClass += " incorrect";
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
                    },
                  )}
                </div>

                {/* Actions: Request Hint and Submit Answer */}
                <div className="exercise-action-bar">
                  <div className="hints-action-group">
                    <button
                      type="button"
                      className="hint-btn"
                      disabled={
                        hintsRevealed >= (activeExercise?.hints.length || 0)
                      }
                      onClick={() => setHintsRevealed((p) => p + 1)}
                    >
                      <Lightbulb size={14} />
                      <span>
                        {hintsRevealed === 0
                          ? "Request Hint"
                          : hintsRevealed < (activeExercise?.hints.length || 0)
                            ? `Request Hint ${hintsRevealed + 1}`
                            : "All Hints Shown"}
                      </span>
                    </button>
                    {hintsRevealed > 0 && (
                      <span className="hint-note">
                        (Hints provide supportive guidance)
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
                          } else if (
                            currentExerciseIndex <
                            lessonData.exercises.length - 1
                          ) {
                            setCurrentExerciseIndex((p) => p + 1);
                            setSelectedChoice(null);
                            setAttemptResult(null);
                            setHintsRevealed(0);
                          } else {
                            void handleGenerateQuestion();
                          }
                        }}
                      >
                        <span>
                          {attemptResult.isCorrect
                            ? "Next Problem"
                            : "Try Another Problem"}
                        </span>
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary submit-btn"
                        disabled={selectedChoice === null || submitting}
                        onClick={handleSubmitAnswer}
                      >
                        <span>
                          {submitting ? "Evaluating…" : "Submit Answer"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progressive Hints Display */}
                {hintsRevealed > 0 && activeExercise?.hints && (
                  <div className="revealed-hints-panel">
                    {activeExercise.hints
                      .slice(0, hintsRevealed)
                      .map((hint: string, i: number) => (
                        <div key={i} className="hint-card">
                          <span className="hint-num">Hint {i + 1}:</span>
                          <span className="hint-content">{hint}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Non-punitive Socratic Feedback */}
                {attemptResult && (
                  <div
                    className={`feedback-card ${attemptResult.isCorrect ? "correct" : "incorrect"}`}
                  >
                    <div className="feedback-header">
                      {attemptResult.isCorrect ? (
                        <>
                          <CheckCircle2
                            size={18}
                            className="feedback-icon success"
                          />
                          <b>Demonstrated Competency</b>
                        </>
                      ) : (
                        <>
                          <AlertCircle
                            size={18}
                            className="feedback-icon danger"
                          />
                          <b>Misunderstanding Detected</b>
                        </>
                      )}
                    </div>
                    <p className="feedback-message">{attemptResult.feedback}</p>
                    {attemptResult.misconceptionExplanation && (
                      <div className="misconception-box">
                        <b>Why this is a common trap:</b>{" "}
                        {attemptResult.misconceptionExplanation}
                      </div>
                    )}
                    <div className="explanation-box">
                      <b>Mechanics:</b> {attemptResult.explanation}
                    </div>
                    {attemptResult.nextStepRecommendation && (
                      <div className="recommendation-box">
                        <Target size={13} />
                        <span>{attemptResult.nextStepRecommendation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contextual AI Socratic Tutor Action Chips */}
              <div className="socratic-bar">
                <span className="socratic-title">
                  <Bot size={14} /> AI TUTOR QUICK HELP:
                </span>
                <div className="socratic-chips">
                  <button
                    type="button"
                    className="socratic-chip"
                    onClick={() => triggerQuickTutorAction("simpler")}
                  >
                    Explain simpler
                  </button>
                  <button
                    type="button"
                    className="socratic-chip"
                    onClick={() => triggerQuickTutorAction("example")}
                  >
                    Show another example
                  </button>
                  <button
                    type="button"
                    className="socratic-chip"
                    disabled={selectedChoice === null}
                    onClick={() => triggerQuickTutorAction("why_wrong")}
                  >
                    Why is my choice wrong?
                  </button>
                  <button
                    type="button"
                    className="socratic-chip highlight"
                    disabled={generatingPractice}
                    onClick={() => triggerQuickTutorAction("similar")}
                  >
                    <RefreshCw
                      size={11}
                      className={generatingPractice ? "spin" : ""}
                    />
                    <span>Generate similar question</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Compact Progress, Mastery & Unified Next Action */}
            <aside className="practice-sidebar">
              {/* Compact Mastery Card */}
              <div className="concept-mastery-card mastery-card">
                <div className="mastery-header">
                  <Award size={16} />
                  <h3 className="sidebar-section-title">Concept Mastery</h3>
                </div>
                <div className="mastery-compact-list">
                  {lessonData.exercises.map((ex, i) => {
                    const m = conceptsMastery[ex.concept] || {
                      status: "novice",
                      score: 0,
                      solved: 0,
                    };
                    return (
                      <div key={i} className="mastery-compact-row">
                        <div className="row-top">
                          <span className="concept-name">
                            {ex.concept.replace(/_/g, " ")}
                          </span>
                          <span className={`mastery-badge ${m.status}`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="mastery-progress-bar">
                          <div
                            className={`mastery-fill ${m.status}`}
                            style={{ width: `${Math.max(10, m.score)}%` }}
                          />
                        </div>
                        <div className="mastery-meta-row">
                          <span>{m.solved} solved</span>
                          <span>{m.score}% verified</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unified Next Best Action (Phase 2 Section H) */}
              {nextAction && (
                <div className="sidebar-next-action-card">
                  <div className="next-kicker">
                    <Zap size={13} /> ONE RECOMMENDED NEXT STEP
                  </div>
                  <h4 className="next-action-title">{nextAction.title}</h4>
                  <p className="next-action-desc">{nextAction.explanation}</p>
                  <button
                    type="button"
                    className="primary next-action-btn"
                    onClick={() => {
                      if (nextAction.route === "learn" && nextAction.lessonId) {
                        setActiveLessonId(nextAction.lessonId);
                        setActiveTab("intro");
                      } else {
                        go(
                          nextAction.route as View,
                          nextAction.projectSlug || nextAction.skillId,
                        );
                      }
                    }}
                  >
                    <span>{nextAction.buttonLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </aside>
          </div>
        </main>
      )}

      {/* =========================================================================
          CATALOG VIEW (Curriculum switcher)
          ========================================================================= */}
      {!loading && activeTab === "catalog" && (
        <main className="catalog-container">
          <div className="catalog-header">
            <h2 className="catalog-heading">Continuous Learning Curriculum</h2>
            <p className="catalog-sub">
              Choose any foundational topic to explore step-by-step code traces
              and practice questions.
            </p>
          </div>
          <div className="lessons-catalog-grid">
            {lessons.map((l) => (
              <div
                key={l.id}
                className={`catalog-card ${l.id === activeLessonId ? "active" : ""}`}
                onClick={() => {
                  setActiveLessonId(l.id);
                  setActiveTab("intro");
                }}
              >
                <div className="catalog-card-top">
                  <span className="catalog-skill-slug">
                    {l.skillSlug.replace(/-/g, " ")}
                  </span>
                  <span className={`catalog-status-badge ${l.status}`}>
                    {l.status === "completed"
                      ? "Completed"
                      : l.status === "in_progress"
                        ? "In Progress"
                        : "Not Started"}
                  </span>
                </div>
                <h3 className="catalog-card-title">{l.title}</h3>
                <p className="catalog-card-summary">{l.summary}</p>
                <div className="catalog-card-footer">
                  <span>
                    <Clock size={12} /> {l.estimatedMinutes}m
                  </span>
                  <span>
                    {l.exercisesCompleted}/{l.exercisesTotal} solved
                  </span>
                  <span className="open-link">
                    Open Lesson <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* =========================================================================
          F. CONTEXTUAL AI TUTOR MODAL / FLYOUT
          ========================================================================= */}
      {showTutorModal && (
        <div
          className="tutor-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="AI Tutor"
        >
          <div className="tutor-modal-card">
            <div className="tutor-modal-header">
              <div className="tutor-header-title">
                <Bot size={18} className="tutor-icon" />
                <div>
                  <h3 className="tutor-modal-h3">AI Learning Tutor</h3>
                  <p className="tutor-modal-sub">
                    Context: {lessonData?.title} •{" "}
                    {formatLanguage(lessonData?.language)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="tutor-close-btn"
                onClick={() => setShowTutorModal(false)}
                aria-label="Close AI Tutor"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Chips */}
            <div className="tutor-quick-prompts">
              <button
                type="button"
                className="tutor-quick-chip"
                onClick={() => triggerQuickTutorAction("simpler")}
              >
                Explain simply
              </button>
              <button
                type="button"
                className="tutor-quick-chip"
                onClick={() => triggerQuickTutorAction("line")}
              >
                Explain this line
              </button>
              <button
                type="button"
                className="tutor-quick-chip"
                onClick={() => triggerQuickTutorAction("hint")}
              >
                Give me a hint
              </button>
              <button
                type="button"
                className="tutor-quick-chip"
                onClick={() => triggerQuickTutorAction("example")}
              >
                Another example
              </button>
              {selectedChoice !== null && (
                <button
                  type="button"
                  className="tutor-quick-chip"
                  onClick={() => triggerQuickTutorAction("why_wrong")}
                >
                  Why is my answer wrong?
                </button>
              )}
            </div>

            {/* Conversation Messages */}
            <div className="tutor-messages-scroll">
              {tutorMessages.length === 0 ? (
                <div className="tutor-empty-state">
                  <Sparkles size={24} className="empty-sparkle" />
                  <p className="empty-title">
                    How can I help you understand this concept?
                  </p>
                  <p className="empty-desc">
                    Click any quick question above or type your own question
                    below. I will guide you with Socratic questions and
                    analogies.
                  </p>
                </div>
              ) : (
                tutorMessages.map((msg, i) => (
                  <div key={i} className={`tutor-bubble-row ${msg.role}`}>
                    <div className={`tutor-bubble ${msg.role}`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {tutorLoading && (
                <div className="tutor-bubble-row assistant">
                  <div className="tutor-bubble assistant loading">
                    <RefreshCw size={14} className="spin" />
                    <span>Formulating friendly explanation…</span>
                  </div>
                </div>
              )}
              {tutorError && (
                <div className="tutor-error-banner">
                  <AlertCircle size={14} />
                  <span>{tutorError}</span>
                </div>
              )}
            </div>

            {/* Input Row */}
            <form
              className="tutor-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                void sendTutorQuery(tutorInput);
              }}
            >
              <input
                type="text"
                className="tutor-text-input"
                placeholder="Ask anything about this code or concept…"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                disabled={tutorLoading}
              />
              <button
                type="submit"
                className="tutor-send-btn"
                disabled={!tutorInput.trim() || tutorLoading}
                aria-label="Send query"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
