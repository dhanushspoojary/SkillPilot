import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { SkillState } from '../lib/engine';

export function PageIntro({
  kicker,
  title,
  text,
  contextTriad,
}: {
  kicker: string;
  title: string;
  text?: string;
  contextTriad?: {
    happening: string;
    why: string;
    now: string;
  };
}) {
  return (
    <div className="page-intro">
      <span className="kicker">{kicker}</span>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {contextTriad && (
        <div className="context-triad-card" role="region" aria-label="Screen context and current objective">
          <div className="triad-item">
            <span className="triad-label">WHAT'S HAPPENING</span>
            <p className="triad-value">{contextTriad.happening}</p>
          </div>
          <div className="triad-divider" aria-hidden="true" />
          <div className="triad-item">
            <span className="triad-label">WHY IT MATTERS</span>
            <p className="triad-value">{contextTriad.why}</p>
          </div>
          <div className="triad-divider" aria-hidden="true" />
          <div className="triad-item highlight">
            <span className="triad-label">WHAT TO DO NOW</span>
            <p className="triad-value">{contextTriad.now}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Signal({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <div className="signal"><span className="signal-icon">{icon}</span><div><small>{label}</small><b>{value}</b><span>{note}</span></div></div>;
}

export function SkillBar({ s }: { s: SkillState }) {
  return (
    <div className="skill-bar">
      <div><span>{s.def.name}</span><small>{s.verified ? 'Verified' : 'Needs proof'} · {s.count} evidence</small></div>
      <b>{s.score}% <small>of {s.def.target}% target</small></b>
      <div className="bar" role="img" aria-label={`${s.def.name} ${s.score} percent, target ${s.def.target}`}><i style={{ width: `${s.score}%` }} /></div>
    </div>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <><ShieldCheck size={12} /> Verified</> : <>Needs proof</>;
}
