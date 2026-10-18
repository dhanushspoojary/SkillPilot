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
    if (!body) return;
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

  return <div style={{ border: '1px solid var(--line,#2a2f3a)', borderRadius: 12, padding: 12, marginTop: 10 }}>
    <b>{title ?? 'Mentor chat'}</b> <small style={{ opacity: .6 }}>· request-scoped · reportable messages</small>
    <div ref={box} style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
      {messages.length === 0 && <small style={{ opacity: .6 }}>No messages yet. Say hello.</small>}
      {messages.map((m) => <div key={m.id} style={{ alignSelf: m.senderId === selfId ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
        <small style={{ opacity: .6 }}>{m.senderName} · {formatSafeTime(m.at)}</small>
        <div style={{ background: m.senderId === selfId ? 'var(--accent,#5b7cfa)' : 'var(--panel,#1c2028)', color: m.senderId === selfId ? '#fff' : 'inherit', borderRadius: 10, padding: '7px 10px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
        {m.senderId !== selfId && !reported.has(m.id) && <button className="link" style={{ fontSize: 11 }} onClick={() => setReporting(reporting === m.id ? null : m.id)}><Flag size={11}/> Report</button>}
        {reporting === m.id && <div style={{ display: 'flex', gap: 6, marginTop: 4 }}><input value={reportText} maxLength={500} placeholder="Why are you reporting this?" style={{ flex: 1 }} onChange={(e) => setReportText(e.target.value)}/><button className="ghost" onClick={() => void report(m.id)}>Report</button></div>}
      </div>)}
    </div>
    {error && <div className="auth-error">{error}</div>}
    <div style={{ display: 'flex', gap: 8 }}>
      <textarea value={text} maxLength={MAX} rows={2} placeholder={`Message (max ${MAX} characters)`} style={{ flex: 1, resize: 'none' }} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}/>
      <button className="primary" onClick={() => void send()} disabled={!text.trim()}><Send size={14}/> Send</button>
    </div>
  </div>;
}
