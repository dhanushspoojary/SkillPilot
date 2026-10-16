import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, CheckCircle2, Award, ExternalLink, Sparkles, ArrowRight, Lock } from 'lucide-react';
import { getPublicPassport } from '../../../lib/passport';
import { ProgressRing } from '../../../components/ProgressRing';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicPassport(token);

  if (!data) {
    return {
      title: 'SkillPilot Passport — Not Found or Revoked',
      description: 'This SkillPilot passport link is invalid or has been revoked by the student.',
    };
  }

  const name = data.studentName || 'SkillPilot Student';
  const desc = `${name} has demonstrated ${data.readiness}% readiness for ${data.careerGoal} with ${data.verifiedCount} verified skills and ${data.evidenceCount} authoritative server evidence items.`;

  return {
    title: `${name} — SkillPilot Verified Career Passport`,
    description: desc,
    openGraph: {
      title: `${name} | SkillPilot Verified Career Passport`,
      description: desc,
      type: 'profile',
      siteName: 'SkillPilot',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | SkillPilot Verified Career Passport`,
      description: desc,
    },
  };
}

export default async function PublicPassportPage({ params }: Props) {
  const { token } = await params;
  const data = await getPublicPassport(token);

  if (!data) {
    return (
      <main className="public-passport-shell">
        <div className="passport-card-container">
          <header className="public-header">
            <div className="brand">
              <span className="brand-mark">S</span>
              <b>SkillPilot</b>
            </div>
          </header>
          <div className="public-card revoked-state">
            <div className="revoked-icon"><Lock size={32} /></div>
            <h2>Passport Link Not Available</h2>
            <p>This verification link is invalid, expired, or has been revoked by the student.</p>
            <Link href="/" className="primary-btn-link">
              Visit SkillPilot <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="public-passport-shell">
      <div className="passport-card-container">
        {/* Top Branding Navigation */}
        <header className="public-header">
          <Link href="/" className="brand">
            <span className="brand-mark">S</span>
            <b>SkillPilot</b>
            <span className="brand-sub">VERIFIED CAREER PROOF</span>
          </Link>
          <div className="authenticity-pill">
            <ShieldCheck size={14} />
            <span>IMMUTABLE SERVER EVIDENCE</span>
          </div>
        </header>

        {/* Visual Passport Card */}
        <article className="public-passport-card" aria-label="Verified Skill Passport Card">
          <div className="card-glare-effect" />
          
          <div className="card-top-row">
            <div className="student-info">
              <span className="passport-kicker">VERIFIED SKILL PASSPORT</span>
              <h1 className="student-name">{data.studentName || 'Verified Student'}</h1>
              <div className="role-target">
                <span>Pathway: <b>{data.careerGoal}</b></span>
              </div>
            </div>

            <div className="readiness-block">
              <ProgressRing value={data.readiness} />
              <div className="readiness-score-display">
                <span className="score-num">{data.readiness}%</span>
                <span className="score-lbl">CAREER READINESS</span>
              </div>
            </div>
          </div>

          <div className="passport-metrics-strip">
            <div className="metric-cell">
              <b>{data.verifiedCount} of {data.totalSkills}</b>
              <span>Skills Verified</span>
            </div>
            <div className="metric-cell">
              <b>{data.evidenceCount}</b>
              <span>Authoritative Signals</span>
            </div>
            <div className="metric-cell">
              <b>Append-Only</b>
              <span>Evidence Ledger</span>
            </div>
            <div className="metric-cell">
              <b className="auth-hash">{data.authenticityHash}</b>
              <span>Authenticity Ref</span>
            </div>
          </div>

          {/* Verified Skills Grid */}
          <div className="passport-skills-section">
            <h3>Verified Technical & Professional Competencies</h3>
            <div className="public-skills-grid">
              {data.skills.map((skill) => (
                <div key={skill.id} className="public-skill-item">
                  <div className="skill-item-head">
                    <span className="skill-name">{skill.name}</span>
                    <span className={`skill-status-tag ${skill.status}`}>
                      {skill.statusLabel}
                    </span>
                  </div>
                  <div className="skill-progress-track">
                    <div className="skill-progress-bar" style={{ width: `${skill.score}%` }} />
                  </div>
                  <div className="skill-item-footer">
                    <small>
                      {skill.verified ? <CheckCircle2 size={12} className="text-green" /> : <Sparkles size={12} />}
                      {skill.evidenceCount} evidence items
                    </small>
                    <b className="skill-score">{skill.score > 0 ? `${skill.score}%` : 'Unassessed'}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Verified Signals */}
          {data.recentEvidence.length > 0 && (
            <div className="recent-evidence-section">
              <h3>Recent Authoritative Evidence Signals</h3>
              <div className="evidence-timeline">
                {data.recentEvidence.map((ev, i) => (
                  <div key={i} className="evidence-timeline-row">
                    <div className="evidence-source-badge">
                      <CheckCircle2 size={13} />
                      <span>{ev.source.toUpperCase()}</span>
                    </div>
                    <span className="evidence-skill">{ev.skillName}</span>
                    <span className="evidence-score">{ev.score}% score recorded</span>
                    <small className="evidence-date">
                      {new Date(ev.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Authenticity Verification Footer */}
          <footer className="card-verify-footer">
            <div className="verification-badge">
              <ShieldCheck size={18} />
              <div>
                <b>Authoritative Verification Guarantee</b>
                <p>This profile is cryptographically tied to PostgreSQL append-only evidence. Scores cannot be manually entered, edited, or fabricated.</p>
              </div>
            </div>
            <div className="timestamp-note">
              Verified: {new Date(data.verifiedAt).toLocaleDateString()}
            </div>
          </footer>
        </article>

        {/* Action Bar */}
        <div className="public-action-bar">
          <Link href="/" className="primary-btn-link">
            Start Your Own Career Passport <ExternalLink size={15} />
          </Link>
        </div>
      </div>
    </main>
  );
}
