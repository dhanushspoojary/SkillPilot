'use client';
import { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  LogOut, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Star, 
  UserCheck, 
  Check, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';

const SKILL_OPTIONS: [string, string][] = [
  ['javascript', 'JavaScript'],
  ['problem-solving', 'Problem solving'],
  ['sql', 'SQL'],
  ['rest-apis', 'REST APIs'],
  ['communication', 'Communication'],
  ['git', 'Git & GitHub']
];

export function MentorWorkspace({ user, onLogout }: {
  user: any;
  onLogout: () => void;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadRequests = () => 
    fetch('/api/mentor/requests', { cache: 'no-store' })
      .then(r => r.json())
      .then(x => {
        if (!x.requests) throw new Error(x.error || 'Could not load requests');
        setRequests(x.requests);
      });

  const loadProfile = () =>
    fetch('/api/mentor/profile', { cache: 'no-store' })
      .then(r => r.json())
      .then(x => {
        if (x.profile) setProfile(x.profile);
      });

  useEffect(() => {
    loadRequests().catch(e => setError(e.message));
    loadProfile().catch(() => {});
  }, []);

  const isApproved = Boolean(profile?.status === 'approved' || user.mentorApproved);
  const isPending = Boolean(profile?.status === 'pending' || (!isApproved && profile?.status !== 'rejected'));
  const isRejected = Boolean(profile?.status === 'rejected');

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError('');
    setProfileSuccess('');

    try {
      const res = await fetch('/api/mentor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: profile?.focus || '',
          bio: profile?.bio || '',
          skills: profile?.skills || []
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save profile');
      }
      setProfile(data.profile);
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  function toggleSkill(skillId: string) {
    const current = profile?.skills || [];
    const updated = current.includes(skillId)
      ? current.filter((s: string) => s !== skillId)
      : [...current, skillId];
    setProfile((p: any) => ({ ...p, skills: updated }));
  }

  async function respond(r: any, status: 'accepted' | 'declined') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mentor/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, status })
      });
      const x = await res.json();
      if (!res.ok) {
        throw new Error(x.error || 'Could not update request');
      }
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to update request');
    } finally {
      setBusy(false);
    }
  }

  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rv, setRv] = useState({ skill: 'rest-apis', score: '80', text: '' });

  async function submitReview(r: any) {
    const score = Number(rv.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError('Score must be between 0 and 100');
      return;
    }
    if (rv.text.trim().length < 10) {
      setError('Write at least 10 characters of evidence-based review');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mentor/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: r.id,
          skill: rv.skill,
          score,
          review: rv.text.trim()
        })
      });
      const x = await res.json();
      if (!res.ok) {
        throw new Error(x.error || 'Could not save review');
      }
      setReviewing(null);
      setRv({ skill: 'rest-apis', score: '80', text: '' });
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  }

  const bioLength = (profile?.bio || '').trim().length;
  const focusLength = (profile?.focus || '').trim().length;

  return (
    <main id="main-content" className="workspace">
      <header className="workspace-top">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>SkillPilot</span>
        </div>
        <div className="workspace-user">
          <span>
            <b>{user.name}</b>
            <small>
              Mentor · {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending approval'}
            </small>
          </span>
          <button className="ghost logout-btn" onClick={onLogout} aria-label="Log out">
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </header>

      <div className="workspace-page">
        <div className="workspace-hero">
          <div>
            <span className="kicker">MENTOR WORKSPACE</span>
            <h1>Turn guidance into <em>evidence.</em></h1>
            <p>
              Only approved mentors can review students. A submitted review becomes an authoritative, server-owned evidence record in the student&apos;s Skill Passport.
            </p>
          </div>
          <div className="trust-card">
            {isApproved ? (
              <>
                <ShieldCheck />
                <b>Approved Mentor</b>
                <span>You can accept assigned students and submit verifiable reviews.</span>
              </>
            ) : isRejected ? (
              <>
                <ShieldAlert style={{ color: 'var(--danger)' }} />
                <b>Application Rejected</b>
                <span>
                  {profile?.rejection_reason || 'Your mentor profile was not approved. Please update your details.'}
                </span>
              </>
            ) : (
              <>
                <Clock style={{ color: 'var(--warning)' }} />
                <b>Approval Pending</b>
                <span>An administrator must approve your mentor profile before students can discover you.</span>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Mentor Profile Section */}
        <section className="workspace-section profile-edit" aria-labelledby="profile-heading">
          <div className="workspace-section-head">
            <div>
              <span className="kicker">YOUR PROFILE</span>
              <h2 id="profile-heading">How students see you</h2>
            </div>
          </div>

          {/* Clear approval state banner */}
          {isPending && (
            <div className="approval-status-banner pending" role="region" aria-label="Profile approval status">
              <Clock size={20} />
              <div>
                <b>Pending Administrator Approval</b>
                <p>
                  Platform administrators require a designated focus and at least 20 characters in your bio before approving your profile.
                  {bioLength < 20 && ` (Current bio: ${bioLength}/20 characters needed)`}
                </p>
              </div>
            </div>
          )}

          {isApproved && (
            <div className="approval-status-banner approved" role="region" aria-label="Profile approval status">
              <CheckCircle2 size={20} />
              <div>
                <b>Active & Discoverable</b>
                <p>Your profile is verified. Students searching for guidance in your skills can send you mentoring requests.</p>
              </div>
            </div>
          )}

          <form className="mentor-profile-form" onSubmit={handleProfileSave}>
            <div className="mentor-form-grid">
              {/* Focus Field */}
              <div className="mentor-field-group">
                <div className="mentor-field-header">
                  <label htmlFor="mentor-focus" className="mentor-field-label">
                    Primary Focus / Domain
                  </label>
                  <span className={`mentor-char-count ${focusLength > 100 ? 'warn' : ''}`}>
                    {profile?.focus?.length || 0}/120
                  </span>
                </div>
                <input
                  id="mentor-focus"
                  value={profile?.focus || ''}
                  placeholder="e.g. Full-stack React, Distributed Systems, System Design Interviews"
                  maxLength={120}
                  onChange={e => setProfile((p: any) => ({ ...p, focus: e.target.value }))}
                />
                <span className="mentor-field-hint">A concise summary of your technical specializations.</span>
              </div>

              {/* Bio Field */}
              <div className="mentor-field-group">
                <div className="mentor-field-header">
                  <label htmlFor="mentor-bio" className="mentor-field-label">
                    Mentor Bio
                  </label>
                  <span className={`mentor-char-count ${bioLength < 20 ? 'warn' : 'good'}`}>
                    {bioLength}/600 {bioLength < 20 ? `(min 20 required)` : `✓`}
                  </span>
                </div>
                <textarea
                  id="mentor-bio"
                  value={profile?.bio || ''}
                  placeholder="Tell students about your industry experience, engineering approach, and what kind of projects you love mentoring..."
                  maxLength={600}
                  rows={4}
                  onChange={e => setProfile((p: any) => ({ ...p, bio: e.target.value }))}
                />
                <span className="mentor-field-hint">
                  {bioLength < 20 
                    ? `⚠️ Admin approval requires at least 20 characters (${20 - bioLength} more needed).`
                    : `Provide helpful context for students seeking guidance.`}
                </span>
              </div>

              {/* Skills Field */}
              <div className="mentor-field-group">
                <div className="mentor-field-header">
                  <span className="mentor-field-label">Mentoring Skills</span>
                  <span className="mentor-char-count">
                    {(profile?.skills || []).length} selected
                  </span>
                </div>
                <span className="mentor-field-hint">Select the skills you are qualified to review and endorse:</span>
                <div className="mentor-skill-chips">
                  {SKILL_OPTIONS.map(([id, name]) => {
                    const isSelected = (profile?.skills || []).includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`mentor-skill-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleSkill(id)}
                        aria-pressed={isSelected}
                      >
                        {isSelected && <Check size={14} />}
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mentor-form-actions">
              <button className="primary" type="submit" disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Saving profile…
                  </>
                ) : (
                  'Save profile'
                )}
              </button>

              {profileSuccess && (
                <div className="save-status-msg success" role="status">
                  <CheckCircle2 size={16} />
                  <span>{profileSuccess}</span>
                </div>
              )}
            </div>
          </form>
        </section>

        {/* Requests Section */}
        <section className="workspace-section" aria-labelledby="requests-heading">
          <div className="workspace-section-head">
            <div>
              <span className="kicker">REQUESTS</span>
              <h2 id="requests-heading">Students who asked for your help</h2>
            </div>
            <span className="count-pill">{requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <UserCheck size={28} />
              <b>No active requests</b>
              <p>When an approved student sends a mentorship request, it will appear here.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map(r => (
                <article className="request-card" key={r.id}>
                  <div className="request-card-header">
                    <div className="request-card-info">
                      <span className="status-chip">{r.status}</span>
                      <h3>{r.student_name}</h3>
                      <p>{r.message}</p>
                      <small>{new Date(r.at).toLocaleString()}</small>
                    </div>

                    <div className="request-card-actions">
                      {r.status === 'pending' && (
                        <>
                          <button
                            className="btn-success"
                            disabled={busy || !isApproved}
                            onClick={() => respond(r, 'accepted')}
                          >
                            Accept
                          </button>
                          <button
                            className="btn-danger"
                            disabled={busy || !isApproved}
                            onClick={() => respond(r, 'declined')}
                          >
                            Decline
                          </button>
                        </>
                      )}

                      <button
                        className="primary"
                        disabled={busy || !isApproved || r.status !== 'accepted'}
                        onClick={() => setReviewing(reviewing === r.id ? null : r.id)}
                      >
                        <Star size={14} />
                        {r.status === 'completed' 
                          ? 'Reviewed' 
                          : r.status === 'accepted' 
                          ? (reviewing === r.id ? 'Close review form' : 'Write review') 
                          : 'Awaiting response'}
                      </button>
                    </div>
                  </div>

                  {reviewing === r.id && r.status === 'accepted' && (
                    <form
                      className="request-review-box"
                      onSubmit={e => {
                        e.preventDefault();
                        void submitReview(r);
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>
                        Submit Authoritative Review for {r.student_name}
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        This assessment score will be signed and stored as an immutable proof record in the student&apos;s Skill Passport.
                      </p>

                      <div className="mentor-field-group">
                        <label htmlFor={`review-skill-${r.id}`} className="mentor-field-label">
                          Skill Evaluated
                        </label>
                        <select
                          id={`review-skill-${r.id}`}
                          value={rv.skill}
                          onChange={e => setRv({ ...rv, skill: e.target.value })}
                        >
                          {SKILL_OPTIONS.map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mentor-field-group">
                        <div className="mentor-field-header">
                          <label htmlFor={`review-score-${r.id}`} className="mentor-field-label">
                            Score (0 to 100)
                          </label>
                          <span className="mentor-char-count">{rv.score}%</span>
                        </div>
                        <input
                          id={`review-score-${r.id}`}
                          type="number"
                          min={0}
                          max={100}
                          value={rv.score}
                          onChange={e => setRv({ ...rv, score: e.target.value })}
                          required
                        />
                      </div>

                      <div className="mentor-field-group">
                        <div className="mentor-field-header">
                          <label htmlFor={`review-text-${r.id}`} className="mentor-field-label">
                            Evidence-Based Feedback
                          </label>
                          <span className={`mentor-char-count ${rv.text.length < 10 ? 'warn' : 'good'}`}>
                            {rv.text.length}/2000 {rv.text.length < 10 ? '(min 10 chars)' : '✓'}
                          </span>
                        </div>
                        <textarea
                          id={`review-text-${r.id}`}
                          value={rv.text}
                          rows={4}
                          minLength={10}
                          maxLength={2000}
                          placeholder="Detail specific observations, problem-solving reasoning, strengths, and areas for improvement..."
                          onChange={e => setRv({ ...rv, text: e.target.value })}
                          required
                        />
                      </div>

                      <div className="mentor-form-actions">
                        <button className="primary" type="submit" disabled={busy}>
                          {busy ? <Loader2 size={16} className="spin" /> : 'Submit review'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setReviewing(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {r.status === 'accepted' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                      <MeetingLink requestId={r.id} canEdit={isApproved} />
                      <ChatPanel requestId={r.id} selfId={user.id} title={`Chat with ${r.student_name}`} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
