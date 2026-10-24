'use client';

import { useEffect, useRef } from 'react';
import {
  Zap,
  Clock,
  Target,
  CheckCircle2,
  X,
  ArrowRight,
  Sparkles,
  Compass,
} from 'lucide-react';
import type { ActionableLearningTask, JourneyStage } from '../lib/next-action-engine';

interface NextActionGuidedModalProps {
  action: ActionableLearningTask | null;
  isOpen: boolean;
  onClose: () => void;
  onPerformAction: (action: ActionableLearningTask) => void;
  careerGoal?: string;
}

const JOURNEY_STEPS: { stage: JourneyStage; label: string; number: number }[] = [
  { stage: 'DISCOVERY', label: 'Discover Yourself', number: 1 },
  { stage: 'DIAGNOSTIC', label: 'Check Your Skills', number: 2 },
  { stage: 'GOALS', label: 'Choose a Goal', number: 3 },
  { stage: 'SKILLS', label: 'Build Your Skills', number: 4 },
  { stage: 'READINESS', label: 'Prove Readiness', number: 5 },
];

export function NextActionGuidedModal({
  action,
  isOpen,
  onClose,
  onPerformAction,
  careerGoal = 'Software Engineer',
}: NextActionGuidedModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus management & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore upon close
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus primary CTA button inside modal
    window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap focus
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !action) return null;

  const currentStepNum = action.journeyStep || 1;

  return (
    <div
      className="guided-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="guided-modal-card"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-modal-title"
        aria-describedby="guided-modal-desc"
      >
        {/* Header with badge and close button */}
        <div className="guided-modal-header">
          <div className="guided-modal-kicker">
            <Sparkles size={14} className="guided-kicker-icon" />
            <span>HERE&apos;S YOUR NEXT STEP</span>
          </div>
          <button
            type="button"
            className="guided-modal-close-btn"
            onClick={onClose}
            aria-label="Close guided suggestion"
          >
            <X size={18} />
          </button>
        </div>

        {/* 5-Stage Journey Progress Tracker */}
        <div className="guided-journey-tracker" aria-label="Learning Journey Progress">
          <div className="guided-journey-steps">
            {JOURNEY_STEPS.map((step) => {
              const isPast = step.number < currentStepNum;
              const isCurrent = step.number === currentStepNum;
              return (
                <div
                  key={step.stage}
                  className={`guided-journey-node ${isCurrent ? 'current' : isPast ? 'completed' : 'future'}`}
                >
                  <div className="node-indicator">
                    {isPast ? <CheckCircle2 size={12} /> : <span>{step.number}</span>}
                  </div>
                  <span className="node-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Title & Meta */}
        <div className="guided-modal-body">
          <h2 id="guided-modal-title" className="guided-action-title">
            {action.title}
          </h2>

          <p id="guided-modal-desc" className="guided-action-explanation">
            {action.explanation}
          </p>

          <div className="guided-meta-chips">
            <div className="meta-chip duration">
              <Clock size={14} />
              <span>
                Estimated time: <b>{action.estimatedMinutes} mins</b>
              </span>
            </div>
            <div className="meta-chip goal">
              <Target size={14} />
              <span>
                Career target: <b>{careerGoal}</b>
              </span>
            </div>
          </div>

          {/* 6 Core Answers structured breakdown */}
          <div className="guided-q-cards">
            <div className="guided-q-card">
              <span className="q-label">WHY THIS MATTERS</span>
              <p className="q-value">{action.whyItMatters}</p>
            </div>

            <div className="guided-q-card">
              <span className="q-label">WHAT HAPPENS WHEN YOU FINISH</span>
              <p className="q-value">{action.whatHappensWhenFinished}</p>
            </div>

            <div className="guided-q-card">
              <span className="q-label">HOW THIS HELPS YOUR GOAL</span>
              <p className="q-value">{action.howItHelpsGoal}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="guided-modal-footer">
          <button
            type="button"
            ref={primaryBtnRef}
            className="primary guided-primary-cta"
            onClick={() => onPerformAction(action)}
          >
            <Zap size={16} />
            <span>{action.buttonLabel}</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            className="ghost guided-defer-btn"
            onClick={onClose}
          >
            Explore Dashboard on My Own
          </button>
        </div>
      </div>
    </div>
  );
}
