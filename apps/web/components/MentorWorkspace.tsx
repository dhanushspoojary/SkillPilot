'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, ShieldCheck, Star, UserCheck } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { MeetingLink } from './MeetingLink';
const SKILL_OPTIONS: [
    string,
    string
][] = [['javascript', 'JavaScript'], ['problem-solving', 'Problem solving'], ['sql', 'SQL'], ['rest-apis', 'REST APIs'], ['communication', 'Communication'], ['git', 'Git & GitHub']];
export function MentorWorkspace({ user, onLogout }: {
    user: any;
    onLogout: () => void;
}) {
    const [requests, setRequests] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const load = () => fetch('/api/mentor/requests', { cache: 'no-store' }).then(r => r.json()).then(x => {
        if (!x.requests)
            throw new Error(x.error || 'Could not load');
        setRequests(x.requests);
    });
    useEffect(() => { load().catch(e => setError(e.message)); fetch('/api/mentor/profile').then(r => r.json()).then(x => setProfile(x.profile)).catch(() => { }); }, []);
    async function respond(r: any, status: 'accepted' | 'declined') {
        setBusy(true);
        const res = await fetch('/api/mentor/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: r.id, status }) });
        const x = await res.json();
        setBusy(false);
        if (!res.ok) {
            setError(x.error || 'Could not update request');
            return;
        }
        await load();
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
        const res = await fetch('/api/mentor/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: r.id, skill: rv.skill, score, review: rv.text }) });
        const x = await res.json();
        setBusy(false);
        if (!res.ok) {
            setError(x.error || 'Could not save review');
            return;
        }
        setReviewing(null);
        setRv({ skill: 'rest-apis', score: '80', text: '' });
        await load();
    }
    return <main className="workspace"><header className="workspace-top"><div className="brand"><span className="brand-mark">S</span><span>SkillPilot</span></div><div className="workspace-user"><span><b>{user.name}</b><small>Mentor · {user.mentorApproved ? 'Approved' : 'Pending approval'}</small></span><button className="ghost" onClick={onLogout}><LogOut size={14}/>Sign out</button></div></header><div className="workspace-page"><div className="workspace-hero"><div><span className="kicker">MENTOR WORKSPACE</span><h1>Turn guidance into <em>evidence.</em></h1><p>Only approved mentors can review students. A submitted review becomes a server-owned evidence record and cannot be manufactured from the browser.</p></div><div className="trust-card"><ShieldCheck /><b>{user.mentorApproved ? 'Approved mentor' : 'Approval pending'}</b><span>{user.mentorApproved ? 'You can review assigned students.' : 'An admin must approve your mentor profile before students can discover you.'}</span></div></div>{error && <div className="auth-error">{error}</div>}<section className="workspace-section profile-edit"><div className="workspace-section-head"><div><span className="kicker">YOUR PROFILE</span><h2>How students see you</h2></div></div><form className="mentor-profile-form" onSubmit={async (e) => {
            e.preventDefault();
            const r = await fetch('/api/mentor/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
            const x = await r.json();
            if (!r.ok)
                setError(x.error || 'Could not save profile');
            else
                setProfile(x.profile);
        }}><input value={profile?.focus || ''} placeholder="Focus · e.g. React, APIs, interviews" maxLength={120} onChange={e => setProfile((p: any) => ({ ...p, focus: e.target.value }))}/><textarea value={profile?.bio || ''} placeholder="Short mentor bio" maxLength={600} rows={3} onChange={e => setProfile((p: any) => ({ ...p, bio: e.target.value }))}/><input value={(profile?.skills || []).join(', ')} placeholder="Skills · e.g. sql, rest-apis, javascript" maxLength={300} onChange={e => setProfile((p: any) => ({ ...p, skills: e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean) }))}/><button className="primary">Save profile</button></form></section><section className="workspace-section"><div className="workspace-section-head"><div><span className="kicker">REQUESTS</span><h2>Students who asked for your help</h2></div><span className="count-pill">{requests.length}</span></div>{requests.length === 0 ? <div className="empty-state"><UserCheck size={24}/><b>No active requests</b><p>When an approved student sends a request, it will appear here.</p></div> : <div className="request-list">{requests.map(r => <article className="request-card" key={r.id}><div><span className="kicker">{r.status.toUpperCase()}</span><h3>{r.student_name}</h3><p>{r.message}</p><small>{new Date(r.at).toLocaleString()}</small></div>{r.status === 'pending' && <><button className="ghost" disabled={busy || !user.mentorApproved} onClick={() => respond(r, 'accepted')}>Accept</button><button className="ghost" disabled={busy || !user.mentorApproved} onClick={() => respond(r, 'declined')}>Decline</button></>}<button className="primary" disabled={busy || !user.mentorApproved || r.status !== 'accepted'} onClick={() => setReviewing(reviewing === r.id ? null : r.id)}><Star size={14}/>{r.status === 'completed' ? 'Reviewed' : r.status === 'accepted' ? 'Write review' : 'Awaiting response'}</button>{reviewing === r.id && r.status === 'accepted' && <form className="mentor-profile-form" style={{ width: '100%' }} onSubmit={e => { e.preventDefault(); void submitReview(r); }}><label>Skill<select value={rv.skill} onChange={e => setRv({ ...rv, skill: e.target.value })}>{SKILL_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Score (0-100)<input type="number" min={0} max={100} value={rv.score} onChange={e => setRv({ ...rv, score: e.target.value })}/></label><textarea value={rv.text} rows={4} minLength={10} maxLength={2000} placeholder="Evidence-based review (10-2000 characters)" onChange={e => setRv({ ...rv, text: e.target.value })} required/><button className="primary" disabled={busy}>Submit review</button></form>}{r.status === 'accepted' && <><MeetingLink requestId={r.id} canEdit={user.mentorApproved}/><ChatPanel requestId={r.id} selfId={user.id} title={`Chat with ${r.student_name}`}/></>}</article>)}</div>}</section></div></main>;
}
