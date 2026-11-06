'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  CheckCircle2,
  Lock,
  Play,
  Sparkles,
  BookOpen,
  Terminal,
  Crosshair,
  Code2,
  ChevronRight,
  X,
  Target,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import type { AppState, PlanAction, SkillState } from '../lib/engine';
import { skillStates, SKILL_PREREQUISITES, STAGES } from '../lib/engine';
import type { View } from './views';

export interface MilestoneNode {
  id: string;
  name: string;
  shortName: string;
  category: string;
  stageNum: string;
  stageName: string;
  prerequisites: string[];
  objective: string;
  whyItMatters: string;
  completionRequirements: string;
  lessonId?: string;
  lessonTitle?: string;
  practiceSlug?: string;
  projectSlug?: string;
}

export const MILESTONES_GRAPH: MilestoneNode[] = [
  {
    id: 'problem-solving',
    name: 'Problem Solving & Algorithmic State',
    shortName: 'Problem Solving',
    category: 'Computer Science Core',
    stageNum: '01',
    stageName: 'Foundations',
    prerequisites: [],
    objective: 'Simulate state transitions, trace loop variables accurately, and avoid off-by-one boundary errors.',
    whyItMatters: 'Tracing bugs account for over 70% of beginner errors. Core mental execution must be reliable before writing complex code.',
    completionRequirements: 'Score >= 70% in adaptive diagnostic and complete loop tracing exercises.',
    lessonId: 'ps-loop-tracing',
    lessonTitle: 'Loop Tracing & Algorithmic State',
    practiceSlug: 'array-sum',
  },
  {
    id: 'git',
    name: 'Git & Distributed Collaboration',
    shortName: 'Git & GitHub',
    category: 'Engineering Tools',
    stageNum: '01',
    stageName: 'Foundations',
    prerequisites: [],
    objective: 'Master branching, atomic commits, resolving merge conflicts, and remote collaboration workflows.',
    whyItMatters: 'Every modern software team coordinates via version control. Clean commit history and branch hygiene are expected on day one.',
    completionRequirements: 'Score >= 75% on version control diagnostics and verify commit hygiene.',
    lessonTitle: 'Git Branching & Pull Requests',
    practiceSlug: 'git-rebase',
  },
  {
    id: 'javascript',
    name: 'JavaScript Scope, Closures & Async',
    shortName: 'JavaScript & Closures',
    category: 'Languages & Runtime',
    stageNum: '01',
    stageName: 'Foundations',
    prerequisites: ['problem-solving'],
    objective: 'Understand lexical scoping, function closures, asynchronous event loops, and variable hoisting.',
    whyItMatters: 'JavaScript powers modern full-stack web architectures. Misunderstanding closures causes memory leaks and async race conditions.',
    completionRequirements: 'Score >= 75% in adaptive assessment and verify closure behavior in code execution.',
    lessonId: 'js-closures-scope',
    lessonTitle: 'Lexical Scope & Closures',
    practiceSlug: 'js-curry',
  },
  {
    id: 'sql',
    name: 'SQL Relational Schemas & Queries',
    shortName: 'SQL Databases',
    category: 'Data & Persistence',
    stageNum: '02',
    stageName: 'Build + Prove',
    prerequisites: ['problem-solving'],
    objective: 'Design normalized tables, construct multi-table JOINs, compute aggregations, and optimize indices.',
    whyItMatters: 'Backend and full-stack systems rely on relational invariants. Inefficient queries degrade server responsiveness.',
    completionRequirements: 'Pass SQLite in-memory sandbox tests with multiple JOINs and aggregations.',
    lessonId: 'sql-joins-grouping',
    lessonTitle: 'Relational JOINs & Aggregations',
    practiceSlug: 'sql-top-spenders',
  },
  {
    id: 'rest-apis',
    name: 'REST APIs & HTTP Web Services',
    shortName: 'REST APIs & HTTP',
    category: 'Backend Systems',
    stageNum: '02',
    stageName: 'Build + Prove',
    prerequisites: ['javascript', 'problem-solving'],
    objective: 'Build semantic HTTP endpoints, enforce authentication headers, handle errors, and validate JSON payloads.',
    whyItMatters: 'APIs are the contract between services. Clean status codes, idempotency, and security boundaries prevent production vulnerabilities.',
    completionRequirements: 'Build and verify an end-to-end API service project with authenticated endpoints.',
    lessonTitle: 'REST Endpoints & HTTP Contracts',
    projectSlug: 'cli-agent',
  },
  {
    id: 'communication',
    name: 'Technical Communication & Review',
    shortName: 'Tech Communication',
    category: 'Professional Practice',
    stageNum: '03',
    stageName: 'Opportunity Cycle',
    prerequisites: ['rest-apis'],
    objective: 'Articulate architectural trade-offs, explain pull request changes, and conduct constructive peer reviews.',
    whyItMatters: 'Senior engineering output is bottlenecked by alignment. Clear technical communication turns individual ability into team leverage.',
    completionRequirements: 'Complete a peer or mentor review session with structured rubric feedback.',
    lessonTitle: 'Code Review & System Explanations',
  },
];

// Alternating serpentine horizontal position offsets (%)
const SERPENTINE_OFFSETS = [38, 62, 50, 38, 50, 62];

interface Props {
  state: AppState;
  actions: PlanAction[];
  go: (v: View, focus?: string) => void;
  workflow?: any;
  onOpenCalibration?: () => void;
}

export function RoadmapSkillTree({ state, actions, go, workflow, onOpenCalibration }: Props) {
  const [selectedNode, setSelectedNode] = useState<MilestoneNode | null>(null);
  const [curvePaths, setCurvePaths] = useState<Array<{ d: string; state: 'completed' | 'active' | 'upcoming' }>>([]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pathContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const skills = skillStates(state.evidence);
  const skillsMap = new Map(skills.map((s) => [s.def.id, s]));

  // Close detail drawer on Escape key and trap focus
  useEffect(() => {
    if (!selectedNode) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedNode(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNode]);

  const getNodeState = (node: MilestoneNode): 'completed' | 'active' | 'available' | 'locked' => {
    const s = skillsMap.get(node.id);
    if (s?.verified || (s && s.score >= 80 && s.count >= 2)) {
      return 'completed';
    }

    // Check prerequisites
    const prereqsSatisfied = node.prerequisites.every((pid) => {
      const pSkill = skillsMap.get(pid);
      return Boolean(pSkill?.verified || (pSkill && pSkill.score >= 70));
    });

    if (!prereqsSatisfied) {
      return 'locked';
    }

    if (s && s.count > 0 && s.score > 0) {
      return 'active';
    }

    return 'available';
  };

  // Find the designated active milestone (the first in-progress or available milestone)
  const designatedActiveNodeId =
    MILESTONES_GRAPH.find((n) => getNodeState(n) === 'active')?.id ||
    MILESTONES_GRAPH.find((n) => getNodeState(n) === 'available')?.id ||
    MILESTONES_GRAPH[0]?.id;

  // Measure stone positions and compute smooth cubic bezier SVG spine curves
  const updatePaths = () => {
    const container = pathContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const positions: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < MILESTONES_GRAPH.length; i++) {
      const el = nodeRefs.current[i];
      if (el) {
        const stoneBtn = el.querySelector('.stepping-stone-btn');
        const targetRect = stoneBtn ? stoneBtn.getBoundingClientRect() : el.getBoundingClientRect();
        positions.push({
          x: targetRect.left + targetRect.width / 2 - containerRect.left,
          y: targetRect.top + targetRect.height / 2 - containerRect.top,
        });
      }
    }

    if (positions.length < 2) return;

    const segments: Array<{ d: string; state: 'completed' | 'active' | 'upcoming' }> = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const midY = (p1.y + p2.y) / 2;
      const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${p1.x.toFixed(1)} ${midY.toFixed(1)}, ${p2.x.toFixed(1)} ${midY.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      const s1 = getNodeState(MILESTONES_GRAPH[i]);
      const s2 = getNodeState(MILESTONES_GRAPH[i + 1]);
      const segState = s1 === 'completed' && s2 === 'completed'
        ? 'completed'
        : (s1 === 'completed' || s1 === 'active')
        ? 'active'
        : 'upcoming';
      segments.push({ d, state: segState });
    }
    setCurvePaths(segments);
  };

  useEffect(() => {
    updatePaths();
    const timer = setTimeout(updatePaths, 150);
    window.addEventListener('resize', updatePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePaths);
    };
  }, [state.evidence]);

  // Group milestones into stages
  const stages = [
    {
      n: '01',
      name: 'Foundations',
      weeks: 'Weeks 1–3',
      blurb: 'Problem Solving · Git · JavaScript fundamentals',
      nodes: MILESTONES_GRAPH.filter((m) => m.stageNum === '01'),
    },
    {
      n: '02',
      name: 'Build + Prove',
      weeks: 'Weeks 4–7',
      blurb: 'Relational SQL · REST APIs · Applied Backend Services',
      nodes: MILESTONES_GRAPH.filter((m) => m.stageNum === '02'),
    },
    {
      n: '03',
      name: 'Opportunity Cycle',
      weeks: 'Weeks 8–10',
      blurb: 'Technical Communication · Code Review · Verified Portfolio',
      nodes: MILESTONES_GRAPH.filter((m) => m.stageNum === '03'),
    },
  ];

  let globalNodeIndex = 0;

  return (
    <div className="roadmap-skill-tree-container">
      {/* Legend Header */}
      <div className="skill-tree-legend">
        <span className="legend-item"><span className="legend-dot completed" /> Completed & Verified</span>
        <span className="legend-item"><span className="legend-dot active" /> In Progress / Next Up</span>
        <span className="legend-item"><span className="legend-dot available" /> Available</span>
        <span className="legend-item"><span className="legend-dot locked" /> Prerequisite Locked</span>
      </div>

      {/* Main Serpentine Path Container */}
      <div
        ref={pathContainerRef}
        className="skill-tree-path serpentine-progression-path"
        role="list"
        aria-label="Personalized Career Learning Progression Path"
      >
        {/* Continuous SVG Spine Canvas Linking Stepping Stones */}
        <svg
          className="serpentine-svg-canvas"
          aria-hidden="true"
        >
          {/* Base Spine (dashed) */}
          {curvePaths.map((seg, idx) => (
            <path
              key={`base-${idx}`}
              d={seg.d}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="10 10"
            />
          ))}
          {/* Progress Overlay Spine */}
          {curvePaths.map((seg, idx) => (
            <path
              key={`prog-${idx}`}
              d={seg.d}
              fill="none"
              stroke={seg.state === 'completed' ? '#10B981' : seg.state === 'active' ? '#8874C7' : 'transparent'}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={seg.state === 'active' ? '8 6' : undefined}
            />
          ))}
        </svg>

        {/* Stage Units & Stepping Stones */}
        {stages.map((stage) => {
          const completedInStage = stage.nodes.filter((n) => getNodeState(n) === 'completed').length;
          const stagePct = Math.round((completedInStage / stage.nodes.length) * 100);

          return (
            <div key={stage.n} className="serpentine-stage-unit">
              {/* Stage Unit Banner */}
              <div className="stage-unit-banner">
                <div className="stage-banner-header">
                  <span className="stage-banner-badge">STAGE {stage.n}</span>
                  <span className="stage-banner-weeks">{stage.weeks}</span>
                </div>
                <div className="stage-banner-row">
                  <div>
                    <h3 className="stage-banner-title">{stage.name}</h3>
                    <p className="stage-banner-blurb">{stage.blurb}</p>
                  </div>
                  <div className="stage-banner-pct-badge">{stagePct}% complete</div>
                </div>
                <div className="stage-progress-track">
                  <div className="stage-progress-fill" style={{ width: `${stagePct}%` }} />
                </div>
              </div>

              {/* Serpentine Stepping Stone Nodes */}
              <div className="stage-nodes-cluster">
                {stage.nodes.map((node) => {
                  const currIdx = globalNodeIndex++;
                  const nodeState = getNodeState(node);
                  const skillData = skillsMap.get(node.id);
                  const score = skillData?.score || 0;
                  const isSelected = selectedNode?.id === node.id;
                  const isDesignatedActive = node.id === designatedActiveNodeId && nodeState !== 'completed';
                  const xOffset = SERPENTINE_OFFSETS[currIdx % SERPENTINE_OFFSETS.length];

                  return (
                    <div
                      key={node.id}
                      ref={(el) => {
                        nodeRefs.current[currIdx] = el;
                      }}
                      role="listitem"
                      className={`skill-tree-node-row serpentine-node-row ${nodeState} ${isDesignatedActive ? 'designated-active' : ''}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        position: 'relative',
                        margin: '36px 0',
                      }}
                    >
                      <div
                        className="stepping-stone-anchor"
                        style={{
                          ['--stone-offset' as string]: `${(xOffset - 50) * 2.2}px`,
                          transform: 'translateX(var(--stone-offset, 0px))',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        {/* Interactive Stepping Stone Button */}
                        <button
                          type="button"
                          className={`skill-node-card stepping-stone-btn ${nodeState} ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedNode(node)}
                          aria-label={`${node.name}. State: ${nodeState}. Score: ${score}%. Click to view details and launch activities.`}
                        >
                          {/* Floating NEXT indicator for the current milestone */}
                          {isDesignatedActive && (
                            <div className="stone-floating-badge" aria-hidden="true">
                              <span>START</span>
                            </div>
                          )}

                          <div className={`stone-circle-wrap ${nodeState}`}>
                            {nodeState === 'completed' ? (
                              <CheckCircle2 size={30} className="stone-icon completed" />
                            ) : nodeState === 'active' ? (
                              <Sparkles size={28} className="stone-icon active" />
                            ) : nodeState === 'available' ? (
                              <Play size={24} fill="currentColor" className="stone-icon available" />
                            ) : (
                              <Lock size={22} className="stone-icon locked" />
                            )}
                          </div>
                        </button>

                        {/* Stepping Stone Label Card */}
                        <div
                          className="stone-label-card"
                          onClick={() => setSelectedNode(node)}
                          role="button"
                          tabIndex={-1}
                        >
                          <span className="stone-label-title">{node.shortName}</span>
                          <span className={`stone-label-status ${nodeState}`}>
                            {nodeState === 'completed'
                              ? `Verified · ${score}%`
                              : nodeState === 'active'
                              ? `In Progress · ${score}%`
                              : nodeState === 'available'
                              ? 'Ready to Start'
                              : 'Prerequisite Locked'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Accessible Detail Side Drawer / Bottom Sheet */}
      {selectedNode && (
        <>
          <div
            className="roadmap-drawer-backdrop"
            onClick={() => setSelectedNode(null)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            className="roadmap-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedNode.name} Milestone Details`}
          >
            <div className="drawer-header">
              <div>
                <span className="drawer-kicker">STAGE {selectedNode.stageNum} · {selectedNode.stageName.toUpperCase()}</span>
                <h2 className="drawer-title">{selectedNode.name}</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedNode(null)}
                aria-label="Close milestone details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Status Header */}
              <div className="drawer-status-card">
                <div className="status-metric">
                  <span className="status-label">Current State</span>
                  <b className={`status-val ${getNodeState(selectedNode)}`}>
                    {getNodeState(selectedNode).toUpperCase().replace('_', ' ')}
                  </b>
                </div>
                <div className="status-metric">
                  <span className="status-label">Evidence Score</span>
                  <b className="status-val">{skillsMap.get(selectedNode.id)?.score || 0}%</b>
                </div>
                <div className="status-metric">
                  <span className="status-label">Signals Recorded</span>
                  <b className="status-val">{skillsMap.get(selectedNode.id)?.count || 0}</b>
                </div>
              </div>

              {/* Learning Objective */}
              <div className="drawer-section">
                <h4 className="section-title"><Target size={15} /> Learning Objective</h4>
                <p className="section-text">{selectedNode.objective}</p>
              </div>

              {/* Why It Matters */}
              <div className="drawer-section">
                <h4 className="section-title"><HelpCircle size={15} /> Why It Matters for Target Role</h4>
                <p className="section-text">{selectedNode.whyItMatters}</p>
              </div>

              {/* Prerequisites */}
              <div className="drawer-section">
                <h4 className="section-title"><Layers size={15} /> Prerequisite Skills</h4>
                {selectedNode.prerequisites.length === 0 ? (
                  <p className="section-text prereq-met">
                    <CheckCircle2 size={14} color="#10B981" /> Foundational starting root (No prior prerequisites required).
                  </p>
                ) : (
                  <div className="prereq-list">
                    {selectedNode.prerequisites.map((pid) => {
                      const pSkill = skillsMap.get(pid);
                      const isMet = Boolean(pSkill?.verified || (pSkill && pSkill.score >= 70));
                      return (
                        <div key={pid} className={`prereq-item ${isMet ? 'met' : 'unmet'}`}>
                          {isMet ? <CheckCircle2 size={15} color="#10B981" /> : <AlertCircle size={15} color="#DC2626" />}
                          <span className="prereq-name">{pSkill?.def.name || pid}</span>
                          <span className="prereq-score">{pSkill ? `${pSkill.score}%` : 'Not tested'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Completion Requirements */}
              <div className="drawer-section">
                <h4 className="section-title"><ShieldCheck size={15} /> Completion Requirements</h4>
                <p className="section-text requirements-box">{selectedNode.completionRequirements}</p>
              </div>

              {/* Primary Launch Actions */}
              <div className="drawer-action-footer">
                {getNodeState(selectedNode) === 'locked' ? (
                  <div className="locked-warning-box">
                    <Lock size={16} />
                    <span>Prerequisites pending. Complete foundational milestones first to unlock this activity.</span>
                  </div>
                ) : (
                  <div className="launch-buttons-group">
                    {selectedNode.lessonId && (
                      <button
                        type="button"
                        className="primary drawer-cta-btn"
                        onClick={() => {
                          setSelectedNode(null);
                          go('learn', selectedNode.lessonId);
                        }}
                      >
                        <BookOpen size={16} /> Start Lesson: {selectedNode.lessonTitle || 'Interactive Walkthrough'}
                      </button>
                    )}

                    {selectedNode.practiceSlug && (
                      <button
                        type="button"
                        className="ghost drawer-cta-btn"
                        onClick={() => {
                          setSelectedNode(null);
                          go('practice', selectedNode.practiceSlug);
                        }}
                      >
                        <Terminal size={16} /> Practice Problems
                      </button>
                    )}

                    {selectedNode.projectSlug && (
                      <button
                        type="button"
                        className="ghost drawer-cta-btn"
                        onClick={() => {
                          setSelectedNode(null);
                          go('projects', selectedNode.projectSlug);
                        }}
                      >
                        <Code2 size={16} /> Hands-on Practical Project
                      </button>
                    )}

                    <button
                      type="button"
                      className="ghost drawer-cta-btn"
                      onClick={() => {
                        setSelectedNode(null);
                        go('assess', selectedNode.id);
                      }}
                    >
                      <Crosshair size={16} /> Take Diagnostic Assessment
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
