'use client';
import { useEffect, useState } from 'react';
import { Video } from 'lucide-react';

export function MeetingLink({ requestId, canEdit }: { requestId: string; canEdit: boolean }) {
  const [call, setCall] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [at, setAt] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/mentor-requests/${requestId}/call`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((x) => { if (active && x?.call) { setCall(x.call); setUrl(x.call.callUrl ?? ''); setAt(x.call.callAt ? x.call.callAt.slice(0, 16) : ''); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, [requestId]);

  async function save() {
    setError(''); setSaved(false);
    try {
      const r = await fetch(`/api/mentor-requests/${requestId}/call`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callUrl: url.trim(), callScheduledAt: at || null }),
      });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not save link'); return; }
      setCall(x.call); setSaved(true);
    } catch { setError('Network error. Please try again.'); }
  }

  return <div style={{ border: '1px solid var(--line,#2a2f3a)', borderRadius: 12, padding: 12, marginTop: 10 }}>
    <b><Video size={14}/> Video session</b> <small style={{ opacity: .6 }}>· hosted on an approved meeting service</small>
    {call?.callUrl ? <p style={{ margin: '8px 0' }}>Scheduled {call.callAt ? new Date(call.callAt).toLocaleString() : 'anytime'} — <a href={call.callUrl} target="_blank" rel="noopener noreferrer">Join meeting</a></p> : <p style={{ margin: '8px 0', opacity: .7 }}>No meeting scheduled yet.</p>}
    {canEdit && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      <input value={url} placeholder="https://meet.google.com/…" style={{ flex: 2, minWidth: 220 }} onChange={(e) => setUrl(e.target.value)}/>
      <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}/>
      <button className="primary" onClick={() => void save()}>Save link</button>
    </div>}
    {error && <div className="auth-error">{error}</div>}
    {saved && <small style={{ opacity: .7 }}>Link saved on the request.</small>}
  </div>;
}
