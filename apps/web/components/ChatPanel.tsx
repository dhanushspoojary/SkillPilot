'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, Send } from 'lucide-react';
import { formatSafeTime } from '../lib/date-format';

const MAX = 2000;
const POLL_MS = 4000;

type Message = { id: string; senderId: string; senderName: string; body: string; at: string };

export function ChatPanel({ requestId, selfId, title }: { requestId: string; selfId: string; title?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reported, setReported] = useState<Set<string>>(new Set());
  const lastAt = useRef('1970-01-01T00:00:00.000Z');
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/mentor-requests/${requestId}/chat?after=${encodeURIComponent(lastAt.current)}`, { cache: 'no-store' });
      if (!r.ok) return;
      const x = await r.json();
      if (Array.isArray(x.messages) && x.messages.length) {
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id));
          return [...current, ...x.messages.filter((m: Message) => !seen.has(m.id))];
        });
        lastAt.current = x.messages[x.messages.length - 1].at;
      }
    } catch { /* polling retries automatically */ }
  }, [requestId]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => { if (!stopped) await load(); };
    void tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [load]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const r = await fetch(`/api/mentor-requests/${requestId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not send'); return; }
      setText('');
      await load();
    } catch { setError('Network error. Please try again.'); }
    finally { setSending(false); }
  }

  async function report(messageId: string) {
    const reason = reportText.trim();
    if (!reason) return;
    const r = await fetch(`/api/mentor-requests/${requestId}/chat/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, reason }),
    });
    const x = await r.json();
    if (!r.ok) { setError(x.error || 'Could not report'); return; }
    setReported((current) => new Set(current).add(messageId));
    setReporting(null); setReportText('');
    setMessages((current) => current.filter((m) => m.id !== messageId));
  }

  return (
    <div style={{ border: '1px solid var(--border, #E7E3EB)', borderRadius: 12, padding: 14, marginTop: 12, background: 'var(--surface, #FFFFFF)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border, #E7E3EB)' }}>
        <b style={{ color: 'var(--text-primary, #17151B)', fontSize: '0.95rem' }}>{title ?? 'Mentor chat'}</b>
        <small style={{ color: 'var(--text-secondary, #4A4553)', fontSize: '0.75rem' }}>Request-scoped · Verified messaging</small>
      </div>
      <div ref={box} style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, margin: '10px 0', paddingRight: 4 }}>
        {messages.length === 0 && <p style={{ color: 'var(--text-secondary, #4A4553)', fontSize: '0.85rem', margin: '16px 0', textAlign: 'center' }}>No messages yet. Say hello to begin the conversation.</p>}
        {messages.filter(m => m.body && m.body.trim().length > 0).map((m) => (
          <div key={m.id} style={{ alignSelf: m.senderId === selfId ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #4A4553)', marginBottom: 3, textAlign: m.senderId === selfId ? 'right' : 'left' }}>
              {m.senderName} · {formatSafeTime(m.at)}
            </div>
            <div style={{
              background: m.senderId === selfId ? '#594593' : '#F2EFF7',
              color: m.senderId === selfId ? '#FFFFFF' : '#17151B',
              border: m.senderId === selfId ? '1px solid transparent' : '1px solid #E2DDE8',
              borderRadius: 12,
              borderBottomRightRadius: m.senderId === selfId ? 3 : 12,
              borderBottomLeftRadius: m.senderId !== selfId ? 3 : 12,
              padding: '8px 12px',
              fontSize: '0.9rem',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              {m.body}
            </div>
            {m.senderId !== selfId && !reported.has(m.id) && (
              <button className="link" style={{ fontSize: 11, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary, #4A4553)' }} onClick={() => setReporting(reporting === m.id ? null : m.id)}>
                <Flag size={11}/> Report
              </button>
            )}
            {reporting === m.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input value={reportText} maxLength={500} placeholder="Why are you reporting this?" style={{ flex: 1, fontSize: '0.85rem' }} onChange={(e) => setReportText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void report(m.id); } }}/>
                <button className="ghost" disabled={!reportText.trim()} onClick={() => void report(m.id)}>Report</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea value={text} maxLength={MAX} rows={2} placeholder={`Message (max ${MAX} characters)`} style={{ flex: 1, resize: 'none', borderRadius: 8, border: '1px solid var(--border, #E7E3EB)', padding: '8px 10px', fontSize: '0.9rem' }} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}/>
        <button className="primary" onClick={() => void send()} disabled={!text.trim() || sending} style={{ height: 42, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Send size={14}/> {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
