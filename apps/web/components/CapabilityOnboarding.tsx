'use client';

import { useState } from 'react';
import { Sparkles, Check, ArrowRight, GraduationCap, Code2, Compass, Clock, X } from 'lucide-react';
import type { StudentCapabilityProfile } from '../lib/capability-profile';

interface Props {
  initialProfile?: StudentCapabilityProfile;
  onSave: (profile: StudentCapabilityProfile) => Promise<void>;
  onClose?: () => void;
  canDismiss?: boolean;
}

export function CapabilityOnboarding({ initialProfile, onSave, onClose, canDismiss = true }: Props) {
  const [eduLevel, setEduLevel] = useState(initialProfile?.educationLevel || 'first_year');
  const [progExp, setProgExp] = useState(initialProfile?.programmingExperience || 'beginner');
  const [careerInterest, setCareerInterest] = useState(initialProfile?.careerInterests?.[0] || 'Software Engineer');
  const [weeklyHours, setWeeklyHours] = useState(initialProfile?.weeklyHours || 5);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        educationLevel: eduLevel,
        programmingExperience: progExp,
        fieldOfStudy: 'computer_science',
        careerInterests: [careerInterest],
        weeklyHours,
        focusAreas: ['Programming Fundamentals', 'Problem Solving'],
        onboardingCompleted: true,
      });
      if (onClose) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboarding-modal">
        <div className="onboarding-head">
          <div className="onboarding-badge">
            <Sparkles size={14} />
            <span>PERSONALIZED CALIBRATION</span>
          </div>
          {canDismiss && onClose && (
            <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close setup">
              <X size={18} />
            </button>
          )}
        </div>

        <h2 id="onboard-title">Welcome to SkillPilot. Tell us where you are starting.</h2>
        <p className="onboarding-sub">
          We tailor your diagnostic questions and roadmap to your real background. Starting as a beginner is expected and valued.
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {/* Question 1: Current Education Level */}
          <div className="onboarding-group">
            <label className="group-label">
              <GraduationCap size={16} /> Current Education Level
            </label>
            <div className="chip-grid">
              {[
                { id: 'first_year', label: '1st Year Student', note: 'Just starting college' },
                { id: 'second_year', label: '2nd Year Student', note: 'Covering core CS topics' },
                { id: 'senior', label: '3rd / 4th Year', note: 'Preparing for placements' },
                { id: 'self_taught', label: 'Self-taught / Bootcamp', note: 'Learning independently' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip-card ${eduLevel === opt.id ? 'active' : ''}`}
                  onClick={() => setEduLevel(opt.id)}
                >
                  <b>{opt.label}</b>
                  <small>{opt.note}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Question 2: Programming Experience */}
          <div className="onboarding-group">
            <label className="group-label">
              <Code2 size={16} /> Prior Programming Experience
            </label>
            <div className="chip-grid">
              {[
                { id: 'beginner', label: 'Complete Beginner', note: 'Never written code before' },
                { id: 'studied_basics', label: 'Basic Coursework', note: 'Studied intro C, C++, or Python' },
                { id: 'small_programs', label: 'Wrote Small Programs', note: 'Comfortable with loops & functions' },
                { id: 'built_projects', label: 'Built Projects', note: 'Created apps, scripts, or websites' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip-card ${progExp === opt.id ? 'active' : ''}`}
                  onClick={() => setProgExp(opt.id)}
                >
                  <b>{opt.label}</b>
                  <small>{opt.note}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Question 3: Career Interest */}
          <div className="onboarding-group">
            <label className="group-label">
              <Compass size={16} /> Primary Career Interest
            </label>
            <div className="chip-grid compact">
              {[
                'Software Engineer',
                'Frontend Engineer',
                'Backend Engineer',
                'Full Stack Engineer',
                'Exploring / Not Sure Yet',
              ].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`chip-card small ${careerInterest === role ? 'active' : ''}`}
                  onClick={() => setCareerInterest(role)}
                >
                  <b>{role}</b>
                </button>
              ))}
            </div>
          </div>

          {/* Question 4: Weekly Commitment */}
          <div className="onboarding-group">
            <label className="group-label">
              <Clock size={16} /> Weekly Learning Availability
            </label>
            <div className="chip-grid compact">
              {[
                { hours: 3, label: '3 hrs/week', note: 'Light pace' },
                { hours: 5, label: '5 hrs/week', note: 'Steady (Recommended)' },
                { hours: 10, label: '10 hrs/week', note: 'Accelerated' },
                { hours: 15, label: '15+ hrs/week', note: 'Intensive' },
              ].map((item) => (
                <button
                  key={item.hours}
                  type="button"
                  className={`chip-card small ${weeklyHours === item.hours ? 'active' : ''}`}
                  onClick={() => setWeeklyHours(item.hours)}
                >
                  <b>{item.label}</b>
                  <small>{item.note}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="onboarding-actions">
            <button type="submit" className="primary submit-setup-btn" disabled={busy}>
              {busy ? 'Saving calibration…' : 'Save & Continue to Dashboard'}
              <ArrowRight size={15} />
            </button>
            {canDismiss && onClose && (
              <button type="button" className="ghost" onClick={onClose} disabled={busy}>
                Skip for now
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
