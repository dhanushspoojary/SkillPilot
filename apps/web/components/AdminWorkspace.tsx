'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, LogOut, Search, ShieldCheck, X } from 'lucide-react';
interface MentorRow {
    id: string;
    name: string;
    email: string;
    focus: string;
    status: string;
}
interface UserRow {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'mentor';
    status: 'active' | 'suspended';
    emailVerifiedAt: string | null;
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error || 'Request failed');
    return data as T;
}
const send = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export function AdminWorkspace({ user, onLogout }: {
    user: {
        name: string;
    };
    onLogout: () => void;
}) {
    const [mentors, setMentors] = useState<MentorRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const loadMentors = useCallback(() => api<{
        mentors: MentorRow[];
    }>('/api/admin/mentors').then((x) => setMentors(x.mentors || [])), []);
    const loadUsers = useCallback((q: string) => api<{
        users: UserRow[];
    }>(`/api/admin/users?q=${encodeURIComponent(q)}`).then((x) => setUsers(x.users || [])), []);
    useEffect(() => {
        loadMentors().catch((e) => setError(e.message));
        loadUsers('').catch((e) => setError(e.message));
        api<{ reports: any[] }>('/api/admin/chat-reports').then((x) => setReports(x.reports || [])).catch(() => { });
    }, [loadMentors, loadUsers]);
    async function setMentorStatus(id: string, status: string) {
        const reason = status === 'rejected' ? window.prompt('Reason (optional)') || '' : '';
        try {
            await api('/api/admin/mentors', send('PATCH', { mentorId: id, status, reason }));
            setError('');
            await loadMentors();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Update failed');
        }
    }
    async function setUserStatus(u: UserRow, status: 'active' | 'suspended') {
        if (status === 'suspended' && !window.confirm(`Suspend ${u.name}? They will be signed out immediately.`))
            return;
        try {
            await api('/api/admin/users', send('PATCH', { userId: u.id, status }));
            setError('');
            await loadUsers(query);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Update failed');
        }
    }
    return <main id="main-content" className="workspace">
    <header className="workspace-top">
      <div className="brand"><span className="brand-mark">S</span><span>SkillPilot Admin</span></div>
      <div className="workspace-user">
        <span><b>{user.name}</b><small>Platform administrator</small></span>
        <button className="ghost logout-btn" onClick={onLogout} aria-label="Log out"><LogOut size={14}/>Log out</button>
      </div>
    </header>
    <div className="workspace-page">
      <div className="workspace-hero">
        <div>
          <span className="kicker">ADMIN CONTROL PLANE</span>
          <h1>Protect the <em>trust layer.</em></h1>
          <p>Approve mentors, moderate accounts and keep the evidence network human-verified.</p>
        </div>
        <div className="trust-card"><ShieldCheck /><b>{mentors.filter((m) => m.status === 'pending').length} pending</b><span>Mentors waiting for review</span></div>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><span className="kicker">MENTOR APPROVAL</span><h2>Real people, real approvals</h2></div>
          <span className="count-pill">{mentors.length}</span>
        </div>
        <div className="admin-list">
          {mentors.length === 0
            ? <div className="empty-state"><b>No mentor accounts yet.</b><p>Mentors only appear after they sign up.</p></div>
            : mentors.map((m) => <article className="admin-row" key={m.id}>
              <div className="admin-avatar">{m.name.slice(0, 1).toUpperCase()}</div>
              <div className="admin-main"><b>{m.name}</b><span>{m.email}</span><small>{m.focus || 'No focus added'} · {m.status}</small></div>
              <div className="admin-actions">
                <span className="status-chip">{m.status}</span>
                {m.status !== 'approved' && <button className="primary" onClick={() => setMentorStatus(m.id, 'approved')}><Check size={14}/>Approve</button>}
                {m.status === 'approved' && <button className="ghost" onClick={() => setMentorStatus(m.id, 'suspended')}><X size={14}/>Suspend</button>}
                {m.status !== 'rejected' && m.status !== 'suspended' && <button className="ghost" onClick={() => setMentorStatus(m.id, 'rejected')}><X size={14}/>Reject</button>}
              </div>
            </article>)}
        </div>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><span className="kicker">CHAT MODERATION</span><h2>Reported mentor messages</h2></div>
          <span className="count-pill">{reports.length}</span>
        </div>
        {reports.length === 0 ? <div className="empty-state"><b>No reported messages.</b><p>Reported chat messages remain hidden from participants and are retained here for moderation.</p></div> : <div className="admin-list">{reports.map((r) => <article className="admin-row" key={r.id}>
          <div className="admin-main"><b>{r.senderName || 'Unknown sender'}</b><span>Reported by {r.reporterName || 'unknown user'} · request {r.requestId}</span><small>{new Date(r.reportedAt).toLocaleString()}</small><p className="muted">“{r.body}”</p><small>Reason: {r.reason}</small></div>
        </article>)}</div>}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><span className="kicker">ACCOUNTS</span><h2>Students and mentors</h2></div>
          <span className="count-pill">{users.length}</span>
        </div>
        <form className="mentor-profile-form" onSubmit={(e) => { e.preventDefault(); loadUsers(query).catch((err) => setError(err.message)); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" maxLength={80} aria-label="Search accounts"/>
          <button className="ghost"><Search size={14}/>Search</button>
        </form>
        <div className="admin-list">
          {users.length === 0
            ? <div className="empty-state"><b>No matching accounts.</b></div>
            : users.map((u) => <article className="admin-row" key={u.id}>
              <div className="admin-avatar">{u.name.slice(0, 1).toUpperCase()}</div>
              <div className="admin-main"><b>{u.name}</b><span>{u.email}</span><small>{u.role} · {u.emailVerifiedAt ? 'email confirmed' : 'email unconfirmed'}</small></div>
              <div className="admin-actions">
                <span className="status-chip">{u.status}</span>
                {u.status === 'active'
                    ? <button className="ghost" onClick={() => setUserStatus(u, 'suspended')}><X size={14}/>Suspend</button>
                    : <button className="primary" onClick={() => setUserStatus(u, 'active')}><Check size={14}/>Reactivate</button>}
              </div>
            </article>)}
        </div>
      </section>
    </div>
  </main>;
}
