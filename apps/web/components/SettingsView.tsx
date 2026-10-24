'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Sliders,
  Palette,
  Shield,
  Download,
  Trash2,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Target,
  GraduationCap,
  Clock,
  LogOut,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type { AppState } from '../lib/engine';
import type { StudentCapabilityProfile } from '../lib/capability-profile';
import { PageIntro } from './ui';

export type SettingsTab =
  | 'profile'
  | 'learning'
  | 'appearance'
  | 'security'
  | 'data'
  | 'deletion'
  | 'audit';

interface SettingsViewProps {
  state: AppState;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  capabilityProfile?: StudentCapabilityProfile | null;
  careerGoal?: string;
  onExport: () => void;
  onLogout?: () => void;
  onRefresh?: () => Promise<void> | void;
}

export function SettingsView({
  state,
  user,
  capabilityProfile,
  careerGoal = 'Software Engineer',
  onExport,
  onLogout,
  onRefresh,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // --- 1. PROFILE STATE ---
  const [name, setName] = useState(user?.name || state.name || '');
  const [selectedGoal, setSelectedGoal] = useState(careerGoal);
  const [educationLevel, setEducationLevel] = useState(
    capabilityProfile?.educationLevel || 'first_year'
  );
  const [programmingExperience, setProgrammingExperience] = useState(
    capabilityProfile?.programmingExperience || 'beginner'
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Sync with prop updates
  useEffect(() => {
    if (user?.name) setName(user.name);
    else if (state.name) setName(state.name);
  }, [user?.name, state.name]);

  useEffect(() => {
    if (careerGoal) setSelectedGoal(careerGoal);
  }, [careerGoal]);

  useEffect(() => {
    if (capabilityProfile?.educationLevel) setEducationLevel(capabilityProfile.educationLevel);
    if (capabilityProfile?.programmingExperience)
      setProgrammingExperience(capabilityProfile.programmingExperience);
  }, [capabilityProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess('');
    setProfileError('');

    if (name.trim().length < 2) {
      setProfileError('Display name must be at least 2 characters long.');
      setProfileSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          careerGoal: selectedGoal,
          capabilityProfile: {
            ...capabilityProfile,
            educationLevel,
            programmingExperience,
            careerInterests: [selectedGoal],
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setProfileSuccess('Profile preferences saved successfully.');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // --- 2. LEARNING PREFERENCES STATE ---
  const [dailyMinutes, setDailyMinutes] = useState(capabilityProfile?.dailyMinutes || 30);
  const [weeklyHours, setWeeklyHours] = useState(capabilityProfile?.weeklyHours || 5);
  const [preferredPace, setPreferredPace] = useState(capabilityProfile?.preferredPace || 'moderate');
  const [learningSaving, setLearningSaving] = useState(false);
  const [learningSuccess, setLearningSuccess] = useState('');
  const [learningError, setLearningError] = useState('');

  const handleSaveLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    setLearningSaving(true);
    setLearningSuccess('');
    setLearningError('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityProfile: {
            ...capabilityProfile,
            dailyMinutes: Number(dailyMinutes),
            weeklyHours: Number(weeklyHours),
            preferredPace,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save learning preferences');

      setLearningSuccess('Learning preferences updated and persisted.');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setLearningError(err instanceof Error ? err.message : 'Could not save learning preferences.');
    } finally {
      setLearningSaving(false);
    }
  };

  // --- 3. APPEARANCE STATE ---
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>('light');
  const [sidebarDefault, setSidebarDefault] = useState<'expanded' | 'collapsed'>('expanded');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  useEffect(() => {
    try {
      const theme = localStorage.getItem('skillpilot_theme') as 'system' | 'light' | 'dark' | null;
      if (theme) setThemePreference(theme);

      const collapsed = localStorage.getItem('skillpilot_sidebar_collapsed');
      if (collapsed === 'true') setSidebarDefault('collapsed');

      const motion = localStorage.getItem('skillpilot_reduced_motion');
      if (motion === 'true') setReducedMotion(true);
    } catch {}
  }, []);

  const handleSaveAppearance = () => {
    try {
      localStorage.setItem('skillpilot_theme', themePreference);
      localStorage.setItem('skillpilot_sidebar_collapsed', String(sidebarDefault === 'collapsed'));
      localStorage.setItem('skillpilot_reduced_motion', String(reducedMotion));
      setAppearanceSaved(true);
      setTimeout(() => setAppearanceSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save appearance settings', err);
    }
  };

  // --- 4. ACCOUNT & SECURITY STATE ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 12 || newPassword.length > 72) {
      setPasswordError('New password must be between 12 and 72 characters.');
      setPasswordBusy(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      setPasswordBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setPasswordSuccess(
        data.message || 'Password changed successfully. Signing out, please sign in with your new password...'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        if (onLogout) {
          onLogout();
        } else {
          window.location.href = '/';
        }
      }, 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  // --- 5. ACCOUNT DELETION STATE ---
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your current password to authorize account deletion.');
      return;
    }

    setDeleteBusy(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');

      window.location.href = '/';
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete account.');
      setDeleteBusy(false);
    }
  };

  return (
    <div className="wide settings-container">
      <PageIntro
        kicker="SETTINGS & CONTROL CENTER"
        title="Account Preferences & Privacy"
        text="Manage your student identity, learning pacing, security credentials, and server-owned records."
        contextTriad={{
          happening: 'Profile customization, learning calibration, password updates, and data governance.',
          why: 'Ensures your roadmaps, pacing, and security align with your current learning journey.',
          now: 'Update your preferences below or export your server data.',
        }}
      />

      <div className="settings-layout">
        {/* Navigation Tabs Bar */}
        <div className="settings-nav-tabs" role="tablist" aria-label="Settings categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>Profile</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'learning'}
            className={`settings-tab-btn ${activeTab === 'learning' ? 'active' : ''}`}
            onClick={() => setActiveTab('learning')}
          >
            <Sliders size={15} />
            <span>Learning</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={15} />
            <span>Appearance</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'security'}
            className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={15} />
            <span>Security</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'data'}
            className={`settings-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Download size={15} />
            <span>Data & Privacy</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            className={`settings-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Bot size={15} />
            <span>Agent Audit</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'deletion'}
            className={`settings-tab-btn danger ${activeTab === 'deletion' ? 'active' : ''}`}
            onClick={() => setActiveTab('deletion')}
          >
            <Trash2 size={15} />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="settings-content-pane">
          {/* 1. PROFILE SECTION */}
          {activeTab === 'profile' && (
            <div className="settings-card profile-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">STUDENT PROFILE</span>
                  <h2>Personal & Academic Identity</h2>
                </div>
                <User size={20} className="section-icon-pastel" />
              </div>

              <p className="muted" style={{ marginBottom: 20 }}>
                Your profile information helps calibrate your starting diagnostic level and customize your career milestone recommendations.
              </p>

              {profileSuccess && (
                <div className="inline-alert success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="inline-alert error" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={16} />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="settings-form">
                <div className="form-group">
                  <label htmlFor="settings-name">Full Display Name</label>
                  <input
                    id="settings-name"
                    type="text"
                    className="settings-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Enter your name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="settings-email">Email Address</label>
                  <input
                    id="settings-email"
                    type="email"
                    className="settings-input"
                    value={user?.email || 'student@skillpilot.local'}
                    disabled
                    title="Account email address cannot be changed directly."
                  />
                  <small className="field-hint">Primary identity credential (read-only).</small>
                </div>

                <div className="form-group">
                  <label htmlFor="settings-goal">Target Career Pathway</label>
                  <select
                    id="settings-goal"
                    className="settings-input select"
                    value={selectedGoal}
                    onChange={(e) => setSelectedGoal(e.target.value)}
                  >
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                    <option value="Frontend Engineer">Frontend Engineer</option>
                    <option value="Full Stack Engineer">Full Stack Engineer</option>
                    <option value="Data Engineer">Data Engineer</option>
                  </select>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="settings-edu">Academic Year / Stage</label>
                    <select
                      id="settings-edu"
                      className="settings-input select"
                      value={educationLevel}
                      onChange={(e) => setEducationLevel(e.target.value)}
                    >
                      <option value="first_year">First Year (Foundations)</option>
                      <option value="second_year">Second Year (Core CS)</option>
                      <option value="third_year">Third Year (Systems & APIs)</option>
                      <option value="final_year">Final Year (Capstone & Career)</option>
                      <option value="graduated">Graduated / Working Professional</option>
                      <option value="self_taught">Self-Taught / Career Transition</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-exp">Programming Experience</label>
                    <select
                      id="settings-exp"
                      className="settings-input select"
                      value={programmingExperience}
                      onChange={(e) => setProgrammingExperience(e.target.value)}
                    >
                      <option value="beginner">Complete Beginner (Starting out)</option>
                      <option value="small_programs">Basic Syntax (Can write loops & conditionals)</option>
                      <option value="built_projects">Built Practical Projects (Git & frameworks)</option>
                      <option value="experienced">Experienced (Multi-language proficiency)</option>
                    </select>
                  </div>
                </div>

                <div className="settings-actions" style={{ marginTop: 24 }}>
                  <button type="submit" className="primary" disabled={profileSaving}>
                    {profileSaving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    Save Profile Changes
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setName(user?.name || state.name || '');
                      setSelectedGoal(careerGoal);
                      setProfileError('');
                      setProfileSuccess('');
                    }}
                  >
                    Reset Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. LEARNING PREFERENCES SECTION */}
          {activeTab === 'learning' && (
            <div className="settings-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">PRACTICE & STUDY CADENCE</span>
                  <h2>Learning Preferences</h2>
                </div>
                <Sliders size={20} className="section-icon-pastel" />
              </div>

              <p className="muted" style={{ marginBottom: 20 }}>
                Adjust your daily commitment and pacing. SkillPilot shapes your weekly milestone roadmap to fit your actual availability.
              </p>

              {learningSuccess && (
                <div className="inline-alert success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>{learningSuccess}</span>
                </div>
              )}

              {learningError && (
                <div className="inline-alert error" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={16} />
                  <span>{learningError}</span>
                </div>
              )}

              <form onSubmit={handleSaveLearning} className="settings-form">
                <div className="form-group">
                  <label htmlFor="settings-daily-minutes">Daily Practice Commitment</label>
                  <select
                    id="settings-daily-minutes"
                    className="settings-input select"
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  >
                    <option value={15}>15 minutes / day (Bite-sized pacing)</option>
                    <option value={30}>30 minutes / day (Recommended standard)</option>
                    <option value={45}>45 minutes / day (Steady progress)</option>
                    <option value={60}>60 minutes / day (Accelerated track)</option>
                  </select>
                  <small className="field-hint">Defines the estimated time for your primary daily recommendation.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="settings-weekly-hours">Weekly Study Budget</label>
                  <select
                    id="settings-weekly-hours"
                    className="settings-input select"
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  >
                    <option value={3}>~3 hours / week</option>
                    <option value={5}>~5 hours / week (Standard semester pacing)</option>
                    <option value={10}>~10 hours / week (Dedicated preparation)</option>
                    <option value={15}>~15+ hours / week (Bootcamp immersion)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="settings-pace">Preferred Milestone Pace</label>
                  <select
                    id="settings-pace"
                    className="settings-input select"
                    value={preferredPace}
                    onChange={(e) => setPreferredPace(e.target.value)}
                  >
                    <option value="relaxed">Relaxed (Thorough concept reviews & extra exercises)</option>
                    <option value="moderate">Moderate (Standard balanced difficulty progression)</option>
                    <option value="intensive">Intensive (Rapid prerequisite testing & stretch projects)</option>
                  </select>
                </div>

                <div className="settings-actions" style={{ marginTop: 24 }}>
                  <button type="submit" className="primary" disabled={learningSaving}>
                    {learningSaving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    Save Learning Preferences
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. APPEARANCE SECTION */}
          {activeTab === 'appearance' && (
            <div className="settings-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">INTERFACE STYLING</span>
                  <h2>Appearance & Accessibility</h2>
                </div>
                <Palette size={20} className="section-icon-pastel" />
              </div>

              <p className="muted" style={{ marginBottom: 20 }}>
                Configure the client interface styling and motion behaviors. All preferences are preserved in local device storage.
              </p>

              {appearanceSaved && (
                <div className="inline-alert success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>Appearance preferences updated!</span>
                </div>
              )}

              <div className="settings-form">
                <div className="form-group">
                  <label>Color Theme Mode</label>
                  <div className="theme-toggle-row">
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`theme-mode-btn ${themePreference === mode ? 'active' : ''}`}
                        onClick={() => setThemePreference(mode)}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{mode} Theme</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Desktop Navigation Sidebar Default</label>
                  <div className="theme-toggle-row">
                    <button
                      type="button"
                      className={`theme-mode-btn ${sidebarDefault === 'expanded' ? 'active' : ''}`}
                      onClick={() => setSidebarDefault('expanded')}
                    >
                      Expanded (240px with labels)
                    </button>
                    <button
                      type="button"
                      className={`theme-mode-btn ${sidebarDefault === 'collapsed' ? 'active' : ''}`}
                      onClick={() => setSidebarDefault('collapsed')}
                    >
                      Collapsed (72px icons only)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Accessibility: Motion & Effects</label>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(e) => setReducedMotion(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--primary-purple, #8874C7)' }}
                    />
                    <span>Enable Reduced Motion (Disables non-essential transitions & custom cursor animations)</span>
                  </label>
                </div>

                <div className="settings-actions" style={{ marginTop: 24 }}>
                  <button type="button" className="primary" onClick={handleSaveAppearance}>
                    Apply & Save Appearance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. ACCOUNT & SECURITY SECTION */}
          {activeTab === 'security' && (
            <div className="settings-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">SECURITY & CREDENTIALS</span>
                  <h2>Authentication & Password</h2>
                </div>
                <Lock size={20} className="section-icon-pastel" />
              </div>

              <div className="session-status-banner" style={{ background: 'var(--surface-indigo, #FAF9FB)', border: '1px solid var(--border-color, #E7E3EB)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--secondary-text, #77727F)', fontWeight: 600, display: 'block' }}>ACTIVE SESSION</span>
                    <b style={{ color: 'var(--text-primary, #17151B)', fontSize: 14 }}>{user?.email || 'student@skillpilot.local'}</b>
                  </div>
                  <span className="verified-badge-pill" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
                    Active · Role: {user?.role || 'student'}
                  </span>
                </div>
              </div>

              <h3 style={{ fontSize: 16, margin: '0 0 8px 0', color: 'var(--text-primary, #17151B)' }}>Change Password</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                Passwords must be between 12 and 72 characters and will be securely hashed with bcrypt.
              </p>

              {passwordSuccess && (
                <div className="inline-alert success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="inline-alert error" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="settings-form">
                <div className="form-group">
                  <label htmlFor="current-pw">Current Password</label>
                  <input
                    id="current-pw"
                    type="password"
                    className="settings-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter your existing password"
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="new-pw">New Password</label>
                    <input
                      id="new-pw"
                      type="password"
                      className="settings-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Min. 12 characters"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-pw">Confirm New Password</label>
                    <input
                      id="confirm-pw"
                      type="password"
                      className="settings-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>

                <div className="settings-actions" style={{ marginTop: 20 }}>
                  <button type="submit" className="primary" disabled={passwordBusy}>
                    {passwordBusy ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
                    Update Password
                  </button>
                  {onLogout && (
                    <button type="button" className="ghost" onClick={onLogout}>
                      <LogOut size={15} /> Sign Out of Current Session
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* 5. DATA & PRIVACY SECTION */}
          {activeTab === 'data' && (
            <div className="settings-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">DATA SOVEREIGNTY & EXPORT</span>
                  <h2>Export Account Records</h2>
                </div>
                <Download size={20} className="section-icon-pastel" />
              </div>

              <p className="muted" style={{ marginBottom: 16 }}>
                Export your server-owned profile, evidence records, assessment summaries, and activity history as valid, formatted JSON.
              </p>

              <div className="export-spec-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-indigo, #FAF9FB)', border: '1px solid var(--border-color, #E7E3EB)' }}>
                  <b style={{ color: 'var(--text-primary, #17151B)', fontSize: 13, display: 'block', marginBottom: 6 }}>Included in Export:</b>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--secondary-text, #77727F)', lineHeight: 1.6 }}>
                    <li>Account profile & target career role</li>
                    <li>Verified skill evidence records & timestamps</li>
                    <li>Completed roadmap actions & activity history</li>
                    <li>Mentor requests and status audit trail</li>
                    <li>Authenticated agent run outputs</li>
                  </ul>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-indigo, #FAF9FB)', border: '1px solid var(--border-color, #E7E3EB)' }}>
                  <b style={{ color: 'var(--text-primary, #17151B)', fontSize: 13, display: 'block', marginBottom: 6 }}>Strictly Excluded:</b>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--secondary-text, #77727F)', lineHeight: 1.6 }}>
                    <li>Password hashes & credential secrets</li>
                    <li>Session cookie identifiers & LiveKit keys</li>
                    <li>Assessment answer keys before submission</li>
                    <li>Other student or mentor records (strict isolation)</li>
                  </ul>
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" className="primary" onClick={onExport}>
                  <Download size={15} /> Export Account Data (JSON)
                </button>
              </div>
            </div>
          )}

          {/* 6. AGENT AUDIT SECTION */}
          {activeTab === 'audit' && (
            <div className="settings-card" role="tabpanel">
              <div className="section-title">
                <div>
                  <span className="kicker">TRANSPARENCY & AUDIT TRAIL</span>
                  <h2>Agent Activity Log</h2>
                </div>
                <Bot size={20} className="section-icon-pastel" />
              </div>

              <p className="muted" style={{ marginBottom: 16 }}>
                Every action proposed or taken by the AI agent is recorded immutably. The agent operates strictly with your authorization and cannot forge credentials.
              </p>

              <div className="audit-list">
                {state.agentRuns.length === 0 ? (
                  <div className="editorial-empty-box" style={{ padding: 24 }}>
                    <Bot size={28} className="empty-icon-pastel" />
                    <h5 className="empty-heading">No agent interactions yet</h5>
                    <p className="empty-desc">
                      When you query the AI companion or trigger agentic roadmap updates, execution logs will appear here.
                    </p>
                  </div>
                ) : (
                  state.agentRuns
                    .slice()
                    .reverse()
                    .map((r) => (
                      <div className="audit-row" key={r.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className={`badge-mode ${r.mode === 'ai' ? 'ai' : 'fallback'}`}>
                            {r.mode === 'ai' ? 'Live AI Model' : 'Deterministic Fallback'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--secondary-text, #77727F)' }}>
                            {new Date(r.at).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #17151B)' }}>
                          {r.question}
                        </p>
                        <small style={{ color: 'var(--secondary-text, #77727F)', fontSize: 11 }}>
                          {r.proposalCount} proposed action{r.proposalCount === 1 ? '' : 's'} · Model: {r.model || 'gemini-flash'}
                          {r.fallbackReason ? ` · Reason: ${r.fallbackReason}` : ''}
                        </small>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* 7. DANGER ZONE: ACCOUNT DELETION */}
          {activeTab === 'deletion' && (
            <div className="settings-card danger-card" role="tabpanel" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div className="section-title">
                <div>
                  <span className="kicker" style={{ color: '#DC2626' }}>PERMANENT DELETION</span>
                  <h2 style={{ color: '#991B1B' }}>Delete Your Account</h2>
                </div>
                <Trash2 size={20} color="#DC2626" />
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <b style={{ color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <AlertTriangle size={16} /> Warning: Irreversible Action
                </b>
                <p style={{ color: '#7F1D1D', fontSize: 13, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                  Deleting your account permanently removes your identity, authentication credentials, assessed skills, evidence ledger, and mentor requests from our database. This action cannot be undone.
                </p>
              </div>

              {deleteError && (
                <div className="inline-alert error" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={16} />
                  <span>{deleteError}</span>
                </div>
              )}

              {!deleteConfirmOpen ? (
                <button
                  type="button"
                  className="ghost"
                  style={{ color: '#DC2626', borderColor: '#DC2626', fontWeight: 600 }}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Proceed to Account Deletion
                </button>
              ) : (
                <div className="deletion-confirmation-box" style={{ background: '#FFFFFF', border: '1px solid #DC2626', borderRadius: 12, padding: 18 }}>
                  <label htmlFor="confirm-del-pw" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>
                    Enter current password to authorize permanent deletion:
                  </label>
                  <input
                    id="confirm-del-pw"
                    type="password"
                    className="settings-input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your current password"
                    style={{ marginBottom: 16 }}
                  />

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#DC2626', borderColor: '#DC2626' }}
                      onClick={handleDeleteAccount}
                      disabled={deleteBusy}
                    >
                      {deleteBusy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                      Permanently Delete Account
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setDeleteConfirmOpen(false);
                        setDeletePassword('');
                        setDeleteError('');
                      }}
                      disabled={deleteBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
