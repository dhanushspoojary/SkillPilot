import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { SkillState } from '../lib/engine';

export function PageIntro({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return <div className="page-intro"><span className="kicker">{kicker}</span><h1>{title}</h1><p>{text}</p></div>;
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
