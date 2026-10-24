'use client';

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import type { AppState, PlanAction, SkillState } from '../lib/engine';
import { skillStates, SKILL_PREREQUISITES, STAGES } from '../lib/engine';
import type { View } from './views';

export interface MilestoneNode {
  id: string;
  name: string;
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

interface Props {
  state: AppState;
  actions: PlanAction[];
  go: (v: View, focus?: string) => void;
  workflow?: any;
  onOpenCalibration?: () => void;
}

export function RoadmapSkillTree({ state, actions, go, workflow, onOpenCalibration }: Props) {
  const [selectedNode, setSelectedNode] = useState<MilestoneNode | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

    // If it is the first actionable milestone
    return 'available';
  };

  return (
    <div className="roadmap-skill-tree-container">
      <div className="skill-tree-legend">
        <span className="legend-item"><span className="legend-dot completed" /> Completed</span>
        <span className="legend-item"><span className="legend-dot active" /> In Progress</span>
        <span className="legend-item"><span className="legend-dot available" /> Available</span>
        <span className="legend-item"><span className="legend-dot locked" /> Locked (Prerequisite Pending)</span>
      </div>

      <div className="skill-tree-path" role="tree" aria-label="Personalized Career Learning Path">
        {MILESTONES_GRAPH.map((node, idx) => {
          const nodeState = getNodeState(node);
          const skillData = skillsMap.get(node.id);
          const score = skillData?.score || 0;
          const isSelected = selectedNode?.id === node.id;

          return (
            <div
              key={node.id}
              className={`skill-tree-node-row ${nodeState} ${isSelected ? 'selected' : ''}`}
            >
              {/* Connector Line */}
              {idx > 0 && <div className={`tree-connector ${nodeState}`} aria-hidden="true" />}

              {/* Node Card */}
              <button
                type="button"
                className={`skill-node-card ${nodeState}`}
                onClick={() => setSelectedNode(node)}
                aria-label={`${node.name}. State: ${nodeState}. Score: ${score}%. Click for details.`}
              >
                <div className="node-icon-col">
                  {nodeState === 'completed' ? (
                    <div className="node-icon-wrap completed">
                      <CheckCircle2 size={20} />
                    </div>
                  ) : nodeState === 'active' ? (
                    <div className="node-icon-wrap active">
                      <Sparkles size={18} />
                    </div>
                  ) : nodeState === 'available' ? (
                    <div className="node-icon-wrap available">
                      <Play size={16} fill="currentColor" />
                    </div>
                  ) : (
                    <div className="node-icon-wrap locked">
                      <Lock size={16} />
                    </div>
                  )}
                </div>

                <div className="node-content-col">
                  <div className="node-meta-row">
                    <span className="node-stage-badge">Stage {node.stageNum} · {node.stageName}</span>
                    <span className={`node-state-pill ${nodeState}`}>
                      {nodeState === 'completed'
                        ? 'VERIFIED'
                        : nodeState === 'active'
                        ? 'IN PROGRESS'
                        : nodeState === 'available'
                        ? 'READY TO START'
                        : 'PREREQUISITE LOCKED'}
                    </span>
                  </div>

                  <h3 className="node-title">{node.name}</h3>

                  <div className="node-progress-strip">
                    <div className="progress-bar-track">
                      <div
                        className={`progress-bar-fill ${nodeState}`}
                        style={{ width: `${Math.max(score, nodeState === 'completed' ? 100 : 0)}%` }}
                      />
                    </div>
                    <span className="progress-label">{score}%</span>
                  </div>

                  <div className="node-action-hint">
                    {nodeState === 'completed' ? (
                      <span className="hint-text verified">
                        <ShieldCheck size={13} /> Competency proven with server evidence
                      </span>
                    ) : nodeState === 'locked' ? (
                      <span className="hint-text locked">
                        Requires: {node.prerequisites.map((p) => skillsMap.get(p)?.def.name || p).join(', ')}
                      </span>
                    ) : (
                      <span className="hint-text actionable">
                        <ArrowRight size={13} /> Click to view learning activities & requirements
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={18} className="node-chevron" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Accessible Detail Side Drawer */}
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
                <span className="drawer-kicker">MILESTONE DETAILS</span>
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

              {/* Primary Launch Action */}
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
                        <Code2 size={16} /> Hands-on Project
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
