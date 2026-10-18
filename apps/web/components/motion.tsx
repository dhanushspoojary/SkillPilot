'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { skillStates, type AppState, SKILLS } from '../lib/engine';
import { Zap, Crosshair, ArrowRight, X, Sparkles, ShieldCheck, Terminal, Award } from 'lucide-react';

/**
 * CustomCursor:
 * - Precise desktop pointer experience inspired by modern digital design studios (DICH aesthetic).
 * - Center dot + outer spring follower ring that expands and shifts over interactive elements.
 * - Automatically disabled on touch screens and when prefers-reduced-motion is active.
 * - Non-intrusive (pointer-events: none, native cursor preserved on interactive text).
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isFinePointer || prefersReducedMotion) {
      return;
    }

    setEnabled(true);

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let animId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }

      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest('button, a, [role="button"], .interactive, .action-card, .nav-item, .option-btn, .skill-node, .task-row, .side-profile')
        );
        const isTextInput = Boolean(
          target.closest('input, textarea, [contenteditable="true"]')
        );
        setHovered(isInteractive && !isTextInput);
        setTyping(isTextInput);
      }
    };

    const render = () => {
      ringX += (mouseX - ringX) * 0.22;
      ringY += (mouseY - ringY) * 0.22;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      animId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className={`custom-cursor-root ${typing ? 'is-typing' : ''}`} aria-hidden="true">
      <div ref={dotRef} className={`cursor-dot ${hovered ? 'is-hover' : ''}`} />
      <div ref={cursorRef} className={`cursor-ring ${hovered ? 'is-hover' : ''}`} />
    </div>
  );
}

/**
 * CinematicEntry:
 * - Theatrical entrance sequence inspired by the reference DICH fashion website.
 * - Sequential typography reveal, animated signal sweep line, and live telemetry readout.
 * - Automatically skipped for returning visitors via sessionStorage ('skillpilot_cinematic_seen').
 * - Respects prefers-reduced-motion and provides an immediate skip control.
 */
export function CinematicEntry({
  onComplete,
  forceShow = false,
}: {
  onComplete?: () => void;
  forceShow?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [stage, setStage] = useState(0); // 0: init, 1: headline, 2: telemetry, 3: ready

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    const seen = sessionStorage.getItem('skillpilot_cinematic_seen');
    if (seen && !forceShow) {
      if (onComplete) onComplete();
      return;
    }

    setVisible(true);

    const t1 = setTimeout(() => setStage(1), 250);
    const t2 = setTimeout(() => setStage(2), 700);
    const t3 = setTimeout(() => setStage(3), 1300);
    const t4 = setTimeout(() => {
      dismiss();
    }, 2800);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        dismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [forceShow]);

  const dismiss = () => {
    setFading(true);
    try {
      sessionStorage.setItem('skillpilot_cinematic_seen', 'true');
    } catch {}
    setTimeout(() => {
      setVisible(false);
      if (onComplete) onComplete();
    }, 450);
  };

  if (!visible) return null;

  return (
    <div
      className={`cinematic-entry-overlay ${fading ? 'is-fading' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="SkillPilot Launch Sequence"
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('cinematic-grid-bg') || (e.target as HTMLElement).classList.contains('cinematic-frame')) {
          dismiss();
        }
      }}
    >
      <div className="cinematic-grid-bg" />
      <div className="cinematic-laser-line" />

      <div className="cinematic-frame">
        {/* Top Status Telemetry */}
        <div className="cinematic-topbar">
          <div className="cinematic-brand">
            <span className="brand-mark">S</span>
            <span className="mono-label">SKILLPILOT // INTELLIGENCE PLATFORM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="cinematic-skip-pill"
              onClick={dismiss}
              aria-label="Skip introduction"
            >
              SKIP [ESC]
            </button>
            <div className="cinematic-status-badge">
              <span className="status-dot-pulse" />
              <span>NODE [PROD-2.4] VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Central Theatrical Typography */}
        <div className="cinematic-center">
          <div className={`cinematic-eyebrow ${stage >= 1 ? 'revealed' : ''}`}>
            <span>EVIDENCE-LED CAREER OPERATING SYSTEM</span>
          </div>

          <h1 className="cinematic-headline">
            <span className={`cinematic-word-line ${stage >= 1 ? 'revealed' : ''}`}>
              YOUR POTENTIAL.
            </span>
            <span className={`cinematic-word-line accent ${stage >= 2 ? 'revealed' : ''}`}>
              <em>ENGINEERED.</em>
            </span>
          </h1>

          <div className={`cinematic-telemetry ${stage >= 2 ? 'revealed' : ''}`}>
            <span>[01 REAL EVIDENCE]</span>
            <span className="div">—</span>
            <span>[02 ADAPTIVE ENGINE]</span>
            <span className="div">—</span>
            <span>[03 ZERO MOCK METRICS]</span>
          </div>
        </div>

        {/* Bottom Actions & Skip Trigger */}
        <div className="cinematic-footer">
          <div className="cinematic-hint">
            <span>PRESS <b>SPACE</b> OR <b>ENTER</b> TO ENTER</span>
          </div>
          <button type="button" className="cinematic-skip-btn" onClick={dismiss} aria-label="Skip introduction">
            ENTER WORKSPACE <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AnimatedMarquee:
 * - Kinetic typography banner for editorial brutalism aesthetic.
 * - Continuous, GPU-accelerated horizontal ticker with technical dividers.
 */
export function AnimatedMarquee({
  items = [
    'ASSESS COMPETENCIES',
    'CLOSE SKILL GAPS',
    'BUILD VERIFIED EVIDENCE',
    'AUTONOMOUS CAREER COMPANION',
    'PROVE REAL RUNTIME ABILITY',
    'CONTINUOUS CAREER GUIDANCE',
  ],
  speedSeconds = 32,
}: {
  items?: string[];
  speedSeconds?: number;
}) {
  const content = items.join('   //   ');

  return (
    <div className="marquee-strip" aria-hidden="true">
      <div
        className="marquee-track"
        style={{ animationDuration: `${speedSeconds}s` }}
      >
        <span className="marquee-chunk">{content}   //   </span>
        <span className="marquee-chunk">{content}   //   </span>
        <span className="marquee-chunk">{content}   //   </span>
      </div>
    </div>
  );
}

/**
 * ScrollReveal:
 * - Lightweight viewport intersection observer to reveal content with subtle translation.
 */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * ConnectedSkillNetwork:
 * - Dynamic procedural vector intelligence system powered by the student's actual evidence data.
 * - Accurately distinguishes between:
 *   - Not Assessed (dimmed dashed telemetry)
 *   - Insufficient Evidence (faint blue pulse)
 *   - Emerging (active blue node)
 *   - Foundational (bright electric blue node)
 *   - Independent Application / Verified (cyan glowing node with active pulse rays)
 * - Interactive node tooltips with real scores and direct action triggers.
 */
export function ConnectedSkillNetwork({
  state,
  onSelectSkill,
}: {
  state?: AppState;
  onSelectSkill?: (skillId: string) => void;
}) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Compute live truthful states from student evidence
  const computedSkills = useMemo(() => {
    return skillStates(state?.evidence || []);
  }, [state?.evidence]);

  // Geometric layout coordinates for skills around core
  const skillCoords: Record<string, { x: number; y: number; label: string }> = {
    'problem-solving': { x: 230, y: 110, label: 'Problem Solving' },
    'javascript': { x: 490, y: 95, label: 'JavaScript' },
    'rest-apis': { x: 570, y: 225, label: 'REST APIs' },
    'sql': { x: 480, y: 345, label: 'SQL & Data' },
    'git': { x: 250, y: 335, label: 'Git & GitHub' },
    'communication': { x: 150, y: 220, label: 'Communication' },
  };

  const coreNode = { x: 360, y: 210, label: 'CAREER INTELLIGENCE CORE' };

  const nodes = useMemo(() => {
    return SKILLS.map((def) => {
      const match = computedSkills.find((s) => s.def.id === def.id);
      const coords = skillCoords[def.id] || { x: 360, y: 210, label: def.name };
      return {
        id: def.id,
        label: coords.label,
        name: def.name,
        target: def.target,
        x: coords.x,
        y: coords.y,
        score: match?.score || 0,
        status: match?.status || 'not_assessed',
        statusLabel: match?.statusLabel || 'Not Assessed',
        verified: match?.verified || false,
        count: match?.count || 0,
        kinds: match?.kinds || [],
      };
    });
  }, [computedSkills]);

  const activeSkill = nodes.find((n) => n.id === activeTooltip);

  return (
    <div className="hero-network-wrap" aria-label="Interactive Skill Network">
      {/* Background crosshair coordinates for editorial brutalist aesthetic */}
      <div className="network-grid-decorations" aria-hidden="true">
        <span className="grid-crosshair top-left">+</span>
        <span className="grid-crosshair top-right">+</span>
        <span className="grid-crosshair bottom-left">+</span>
        <span className="grid-crosshair bottom-right">+</span>
        <span className="network-watermark">SKILL_TOPOLOGY // EVIDENCE_MAPPED</span>
      </div>

      <svg
        viewBox="0 0 720 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="hero-network-svg"
      >
        <defs>
          <radialGradient id="networkCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#245BFF" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#245BFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#080D1A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="edgePulse" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#245BFF" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#71E6FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#245BFF" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glowFilter" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient atmospheric backdrop */}
        <circle cx={coreNode.x} cy={coreNode.y} r="195" fill="url(#networkCenterGlow)" />

        {/* Concentric orbital telemetry rings */}
        <circle
          cx={coreNode.x}
          cy={coreNode.y}
          r="165"
          stroke="rgba(148, 169, 204, 0.12)"
          strokeWidth="1"
          strokeDasharray="4 6"
          className="orbital-ring orbital-slow"
        />
        <circle
          cx={coreNode.x}
          cy={coreNode.y}
          r="110"
          stroke="rgba(77, 141, 255, 0.2)"
          strokeWidth="1"
          strokeDasharray="8 4"
          className="orbital-ring orbital-reverse"
        />
        <circle
          cx={coreNode.x}
          cy={coreNode.y}
          r="58"
          stroke="rgba(113, 230, 255, 0.35)"
          strokeWidth="1.2"
          className="orbital-ring"
        />

        {/* Connection rays from Core to Nodes */}
        {nodes.map((n) => {
          const isVerified = n.verified || n.status === 'independent_application';
          const isAssessed = n.count > 0;
          return (
            <line
              key={`core-edge-${n.id}`}
              x1={coreNode.x}
              y1={coreNode.y}
              x2={n.x}
              y2={n.y}
              stroke={
                isVerified
                  ? 'rgba(113, 230, 255, 0.45)'
                  : isAssessed
                  ? 'rgba(77, 141, 255, 0.28)'
                  : 'rgba(148, 169, 204, 0.12)'
              }
              strokeWidth={isVerified ? '1.8' : '1.2'}
              strokeDasharray={isAssessed ? undefined : '3 4'}
            />
          );
        })}

        {/* Outer Ring Edges between Adjacent Skills */}
        {nodes.map((n, idx) => {
          const next = nodes[(idx + 1) % nodes.length];
          return (
            <line
              key={`ring-edge-${n.id}-${next.id}`}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
              stroke="rgba(148, 169, 204, 0.14)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          );
        })}

        {/* Animated signal pulses on verified paths */}
        <line
          x1={coreNode.x}
          y1={coreNode.y}
          x2={skillCoords['problem-solving'].x}
          y2={skillCoords['problem-solving'].y}
          stroke="url(#edgePulse)"
          strokeWidth="2"
          className="pulse-energy-line"
        />
        <line
          x1={coreNode.x}
          y1={coreNode.y}
          x2={skillCoords['rest-apis'].x}
          y2={skillCoords['rest-apis'].y}
          stroke="url(#edgePulse)"
          strokeWidth="2"
          className="pulse-energy-line-2"
        />

        {/* Central Core: AI Career Intelligence Engine */}
        <g className="core-node" filter="url(#glowFilter)">
          <circle cx={coreNode.x} cy={coreNode.y} r="24" fill="#0C1426" stroke="#245BFF" strokeWidth="2.5" />
          <circle cx={coreNode.x} cy={coreNode.y} r="10" fill="#71E6FF" className="core-pulse-dot" />
          <text
            x={coreNode.x}
            y={coreNode.y + 40}
            fill="#71E6FF"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="700"
            letterSpacing="0.08em"
            textAnchor="middle"
          >
            CAREER AI CORE
          </text>
        </g>

        {/* Interactive Data-Driven Skill Nodes */}
        {nodes.map((n) => {
          const isVerified = n.verified || n.status === 'independent_application';
          const isAssessed = n.count > 0;
          const isHovered = activeTooltip === n.id;

          const strokeColor = isVerified
            ? '#71E6FF'
            : n.status === 'foundational'
            ? '#4D8DFF'
            : n.status === 'emerging'
            ? '#245BFF'
            : 'rgba(148, 169, 204, 0.35)';

          const fillColor = isVerified
            ? '#162445'
            : isAssessed
            ? '#111B33'
            : '#0C1426';

          const centerColor = isVerified
            ? '#71E6FF'
            : isAssessed
            ? '#245BFF'
            : 'rgba(148, 169, 204, 0.4)';

          return (
            <g
              key={n.id}
              className={`skill-node ${isHovered ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveTooltip(n.id)}
              onClick={() => {
                setActiveTooltip(n.id);
                if (onSelectSkill) onSelectSkill(n.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Target hit area for accessible touch and mouse */}
              <circle cx={n.x} cy={n.y} r="28" fill="transparent" />

              {/* Node Outer Ring */}
              <circle
                cx={n.x}
                cy={n.y}
                r={isHovered ? 18 : 15}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isVerified || isHovered ? 2.5 : 1.5}
                filter={isVerified || isHovered ? 'url(#glowFilter)' : undefined}
                style={{ transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />

              {/* Node Center Dot */}
              <circle
                cx={n.x}
                cy={n.y}
                r={isHovered ? 7 : 5}
                fill={centerColor}
                style={{ transition: 'all 0.2s ease' }}
              />

              {/* Skill Label */}
              <text
                x={n.x}
                y={n.y + 26}
                fill={isVerified ? '#71E6FF' : isAssessed ? '#F4F7FF' : '#9AA8BF'}
                fontSize="11"
                fontWeight={isHovered || isVerified ? '700' : '500'}
                fontFamily="inherit"
                textAnchor="middle"
              >
                {n.label}
              </text>

              {/* Score pill indicator if assessed */}
              {isAssessed && (
                <text
                  x={n.x}
                  y={n.y - 20}
                  fill={isVerified ? '#71E6FF' : '#4D8DFF'}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {n.score}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Interactive Telemetry Card on Node Hover */}
      {activeSkill && (
        <div className="network-hud-card" role="tooltip">
          <div className="hud-card-head">
            <span className="mono-kicker">NODE: {activeSkill.id.toUpperCase()}</span>
            <button
              type="button"
              className="hud-close"
              onClick={() => setActiveTooltip(null)}
              aria-label="Close skill telemetry"
            >
              <X size={13} />
            </button>
          </div>
          <h4 className="hud-title">{activeSkill.name}</h4>
          <div className="hud-metric-row">
            <span className={`skill-status-tag ${activeSkill.status}`}>
              {activeSkill.statusLabel}
            </span>
            <b className="hud-score">
              {activeSkill.count > 0 ? `${activeSkill.score}% Verified` : 'Unassessed'}
            </b>
          </div>
          <div className="hud-meta">
            <small>Signals: {activeSkill.count} recorded ({activeSkill.kinds.join(', ') || 'none'})</small>
          </div>
          {onSelectSkill && (
            <button
              type="button"
              className="hud-action-btn"
              onClick={() => onSelectSkill(activeSkill.id)}
            >
              {activeSkill.count === 0 ? 'Start Diagnostic' : 'View Skill Details'} <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
