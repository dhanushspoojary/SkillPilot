'use client';
import { useEffect, useState } from 'react';
import { Video, ShieldCheck } from 'lucide-react';
import { LiveKitVideoCall } from './LiveKitVideoCall';
import { formatSafeDateTime } from '../lib/date-format';

export function MeetingLink({ requestId, canEdit }: { requestId: string; canEdit: boolean }) {
  const [call, setCall] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [at, setAt] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/mentor-requests/${requestId}/call`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((x) => {
        if (active && x?.call) {
          setCall(x.call);
          setUrl(x.call.callUrl ?? '');
          setAt(x.call.callAt ? x.call.callAt.slice(0, 16) : '');
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [requestId]);

  async function save() {
    setError(''); setSaved(false);
    try {
      const r = await fetch(`/api/mentor-requests/${requestId}/call`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callUrl: url.trim(), callScheduledAt: at || null }),
      });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not save link'); return; }
      setCall(x.call); setSaved(true);
    } catch { setError('Network error. Please try again.'); }
  }

  const isLiveKitAvailable = Boolean(call?.livekit?.available);

  return (
    <div style={{ border: '1px solid var(--line,#2a2f3a)', borderRadius: 12, padding: 14, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.01)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <b><Video size={14} style={{ verticalAlign: 'middle', marginRight: 4 }}/> Dedicated Mentor Video Session</b>
          <span style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 999, backgroundColor: isLiveKitAvailable ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)', color: isLiveKitAvailable ? '#10b981' : '#94a3b8' }}>
            {isLiveKitAvailable ? 'LiveKit Ready' : 'Dedicated WebRTC'}
          </span>
        </div>
        <small style={{ opacity: .7 }}>
          {call?.callAt ? `Scheduled: ${formatSafeDateTime(call.callAt, 'Pending')}` : 'Ready to connect'}
        </small>
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="primary"
          onClick={() => setIsCallOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.9rem' }}
        >
          <Video size={16} /> Launch Video Call
        </button>

        {call?.callUrl && (
          <a
            href={call.callUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', textDecoration: 'underline' }}
          >
            External backup link
          </a>
        )}
      </div>

      {canEdit && (
        <details style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
          <summary style={{ cursor: 'pointer' }}>Optional external backup link & schedule settings</summary>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input
              value={url}
              placeholder="https://meet.google.com/… (optional backup)"
              style={{ flex: 2, minWidth: 220 }}
              onChange={(e) => setUrl(e.target.value)}
            />
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}/>
            <button className="ghost" onClick={() => void save()}>Save backup link</button>
          </div>
        </details>
      )}

      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
      {saved && <small style={{ opacity: .7, display: 'block', marginTop: 6, color: '#10b981' }}>Settings saved on the request.</small>}

      <LiveKitVideoCall
        requestId={requestId}
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        externalFallbackUrl={call?.callUrl}
      />
    </div>
  );
}
