import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Award,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Lock,
  Share2,
  Check,
  Code2,
  Layers,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { getPublicPassportByHandle } from '../../../lib/passport';
import { ProgressRing } from '../../../components/ProgressRing';
import { formatSafeDate } from '../../../lib/date-format';

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicPassportByHandle(handle);

  if (!data) {
    return {
      title: 'SkillPilot Passport — Not Found or Private',
      description: 'This SkillPilot profile is private, not found, or has been revoked by the student.',
    };
  }

  const name = data.studentName || 'Verified Developer';
  const desc = `${name} has demonstrated ${data.readiness}% readiness for ${data.careerGoal} with ${data.verifiedCount} verified skills and ${data.evidenceCount} immutable evidence items on SkillPilot.`;

  return {
    title: `${name} — Verified Developer Skill Passport | SkillPilot`,
    description: desc,
    openGraph: {
      title: `${name} | Verified Developer Skill Passport`,
      description: desc,
      type: 'profile',
      siteName: 'SkillPilot',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Verified Developer Skill Passport`,
      description: desc,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const data = await getPublicPassportByHandle(handle);

  if (!data) {
    return (
      <main className="public-passport-shell">
        <div className="passport-card-container">
          <header className="public-header">
            <Link href="/" className="brand">
              <span className="brand-mark">S</span>
              <b>SkillPilot</b>
            </Link>
          </header>
          <div className="public-card revoked-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div className="revoked-icon" style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
              <Lock size={36} color="var(--muted)" />
            </div>
            <h2 style={{ fontSize: 22, color: '#FFFFFF', marginBottom: 8 }}>Profile Is Private or Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 24px' }}>
              The profile for <code>@{handle}</code> is either set to private, invalid, or has not been published yet.
            </p>
            <Link href="/" className="primary-btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Explore SkillPilot</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://skillpilot.dev'}/p/${encodeURIComponent(handle)}`;
  const shareText = `Check out my verified developer skill passport on SkillPilot: ${data.studentName || 'Developer'} (${data.readiness}% ready for ${data.careerGoal})`;

  return (
    <main className="public-passport-shell">
      <div className="passport-card-container" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        {/* Top Header */}
        <header className="public-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="brand-mark">S</span>
            <b style={{ color: '#FFFFFF', fontSize: 18 }}>SkillPilot</b>
            <span className="brand-sub" style={{ fontSize: 11, color: 'var(--cyan)', marginLeft: 4, letterSpacing: '0.05em' }}>
              VERIFIED DEVELOPER PASSPORT
            </span>
          </Link>
          <div
            className="authenticity-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              color: 'var(--cyan)',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={14} />
            <span>IMMUTABLE SERVER EVIDENCE</span>
          </div>
        </header>

        {/* Profile Card Header */}
        <article className="public-passport-card" style={{ background: 'var(--surface-navy)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34D399',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle size={12} />
                  <span>PUBLIC VERIFIED PROFILE</span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>@{handle}</span>
              </div>
              <h1 style={{ fontSize: 28, margin: '0 0 6px 0', color: '#FFFFFF', fontWeight: 700 }}>
                {data.studentName || 'Verified Developer'}
              </h1>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Targeting: <b style={{ color: '#FFFFFF' }}>{data.careerGoal}</b>
              </div>
              <p style={{ margin: '10px 0 0 0', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                “{data.headline}”
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#0D1117', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--line)' }}>
              <ProgressRing value={data.readiness} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role Readiness</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--cyan)' }}>{data.readiness}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{data.verifiedCount} of {data.totalSkills} skills verified</div>
              </div>
            </div>
          </div>

          {/* Verification Tiers Legend */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--line)',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--muted)', fontWeight: 600, marginRight: 4 }}>Verification Tiers:</span>
            <span style={{ color: '#A5B4FC', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              1. Self-Declared
            </span>
            <span style={{ color: '#67E8F9', background: 'rgba(34, 211, 238, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              2. Assessed
            </span>
            <span style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              3. Demonstrated
            </span>
            <span style={{ color: '#FCD34D', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              4. Reviewed
            </span>
            <span style={{ color: '#F472B6', background: 'rgba(236, 72, 153, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              5. Mentor-Endorsed
            </span>
          </div>
        </article>

        {/* Skills Section */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, color: '#FFFFFF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="var(--cyan)" />
            <span>Demonstrated & Calibrated Skills</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {data.skills.map((s) => {
              const tierLabel = s.verified
                ? s.sources.includes('mentor')
                  ? '5. Mentor-Endorsed'
                  : s.sources.includes('project')
                  ? '3. Demonstrated'
                  : '2. Assessed'
                : '1. Self-Declared / In Progress';

              const tierColor = s.verified
                ? s.sources.includes('mentor')
                  ? '#F472B6'
                  : s.sources.includes('project')
                  ? '#34D399'
                  : '#67E8F9'
                : '#94A3B8';

              return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--surface-navy)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <b style={{ color: '#FFFFFF', fontSize: 15 }}>{s.name}</b>
                      <div style={{ fontSize: 11, color: tierColor, fontWeight: 600, marginTop: 2 }}>
                        {tierLabel}
                      </div>
                    </div>
                    <span
                      style={{
                        background: s.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: s.verified ? '#34D399' : 'var(--muted)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {s.score} / {s.target}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 6, margin: '10px 0', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: s.verified ? 'var(--cyan)' : 'var(--primary)',
                        height: '100%',
                        width: `${Math.min(100, Math.round((s.score / s.target) * 100))}%`,
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    <span>{s.evidenceCount} verified evidence items</span>
                    <span>{s.statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Server Evidence Ledger */}
        {data.recentEvidence && data.recentEvidence.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, color: '#FFFFFF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--cyan)" />
              <span>Evidence Ledger (Server Signed)</span>
            </h2>

            <div style={{ background: '#0D1117', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {data.recentEvidence.map((e, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: idx < data.recentEvidence.length - 1 ? '1px solid var(--line)' : 'none',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={15} color="#34D399" />
                    <div>
                      <b style={{ color: '#FFFFFF' }}>{e.skillName}</b>
                      <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>via {e.source}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{e.score} pts</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatSafeDate(e.capturedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Authenticity Certificate & Social Sharing Footer */}
        <footer
          style={{
            background: 'var(--surface-navy)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Authenticity Fingerprint
            </div>
            <code style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 700 }}>
              {data.authenticityHash}
            </code>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Cryptographically verified by SkillPilot engine · {formatSafeDate(data.verifiedAt)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#FFFFFF',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>LinkedIn</span>
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#FFFFFF',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>X / Twitter</span>
            </a>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#FFFFFF',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>WhatsApp</span>
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
