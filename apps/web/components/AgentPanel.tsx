import { useState } from 'react';
import { BrainCircuit, Check, Send, ShieldCheck } from 'lucide-react';
import type { AppState, AgentAudit } from '../lib/engine';
import type { AgentReply, Proposal } from '../lib/agent';
import { PageIntro } from './ui';
const PROMPTS = ['What should I do this week?', 'Why is REST APIs my top gap?', 'Which mentor should I talk to?'];
export function AgentPanel({ state, onApprove, onAudit }: {
    state: AppState;
    onApprove: (p: Proposal) => void;
    onAudit: (audit: AgentAudit) => void;
}) {
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [reply, setReply] = useState<AgentReply | null>(null);
    const [error, setError] = useState('');
    const [handled, setHandled] = useState<string[]>([]);
    async function evidenceVersion(value: AppState['evidence']) {
        try {
            const bytes = new TextEncoder().encode(JSON.stringify(value));
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        }
        catch {
            return 'unavailable';
        }
    }
    async function ask(question: string) {
        if (!question.trim() || busy)
            return;
        setBusy(true);
        setError('');
        setHandled([]);
        try {
            const res = await fetch('/api/agent', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question.trim(), state: { v: 2, activity: state.activity, requests: state.requests } }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error ?? 'Request failed');
            const result = data as AgentReply;
            setReply(result);
            onAudit({ id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), mode: result.mode, question: question.trim(), model: result.model, fallbackReason: result.fallbackReason, proposalCount: result.proposals.length, evidenceVersion: await evidenceVersion(state.evidence) });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'The agent could not be reached.';
            setError(message);
            onAudit({ id: `agent-failed-${Date.now()}`, at: new Date().toISOString(), mode: 'fallback', question: question.trim(), fallbackReason: 'client_error', proposalCount: 0, evidenceVersion: await evidenceVersion(state.evidence) });
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="wide">
    <PageIntro kicker="CAREER AGENT" title="Ask, then approve." text="The agent reads your evidence with fixed tools and proposes next steps. It cannot change a score, verify a skill or send anything. Every proposal waits for your approval."/>
    <form className="agent-form" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
      <label className="sr-only" htmlFor="agent-q">Ask your Career Agent</label>
      <input id="agent-q" value={q} maxLength={500} placeholder="Ask about your plan, gaps or mentors" onChange={(e) => setQ(e.target.value)}/>
      <button className="primary" disabled={busy || !q.trim()}><Send size={14}/> {busy ? 'Thinking…' : 'Ask'}</button>
    </form>
    <div className="chips">{PROMPTS.map((p) => <button key={p} className="ghost" disabled={busy} onClick={() => { setQ(p); ask(p); }}>{p}</button>)}</div>
    {error && <p className="agent-error" role="alert">{error}</p>}
    {reply && <div className="agent-reply" aria-live="polite">
      <div className="agent-icon"><BrainCircuit /></div>
      <span className={reply.mode === 'ai' ? 'badge ai' : 'badge'}>{reply.mode === 'ai' ? `AI · ${reply.model}` : `Deterministic fallback${reply.fallbackReason === 'no_api_key' ? ' · no API key set' : ''}`}</span>
      <p className="answer">{reply.answer}</p>
      {reply.steps.length > 0 && <ol className="trace"><li className="trace-title">What the agent did</li>{reply.steps.map((s, i) => <li key={i}><code>{s.tool}</code> {s.summary}</li>)}</ol>}
      {reply.proposals.length > 0 && <div className="proposals"><small><ShieldCheck size={12}/> PROPOSED · NEEDS YOUR APPROVAL</small>
        {reply.proposals.map((p) => <div className="proposal" key={p.id}><div><b>{p.label}</b><p>{p.reason}</p>{p.message && <blockquote>{p.message}</blockquote>}</div>
          {handled.includes(p.id) ? <span className="sent"><Check size={13}/> Handled</span>
                        : <div className="draft-actions"><button className="primary" onClick={() => { setHandled((h) => [...h, p.id]); onApprove(p); }}>{p.type === 'send_mentor_request' ? 'Approve draft' : p.type === 'start_retest' ? 'Approve and start' : 'Approve'}</button><button className="ghost" onClick={() => setHandled((h) => [...h, p.id])}>Dismiss</button></div>}
        </div>)}</div>}
    </div>}
  </div>;
}
