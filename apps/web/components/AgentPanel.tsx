'use client';

import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Check, Send, ShieldCheck, Sparkles, User, ArrowRight, RefreshCcw, Info } from 'lucide-react';
import type { AppState, AgentAudit } from '../lib/engine';
import type { AgentReply, Proposal } from '../lib/agent';
import { PageIntro } from './ui';

const SUGGESTED_PROMPTS = [
  'What should I focus on this week?',
  'Explain my current skill baseline and top gap',
  'How do I start preparing for a Software Engineer role?',
  'Which approved mentor matches my focus area?',
];

interface ChatMessage {
  id: string;
  sender: 'student' | 'agent';
  text: string;
  time: string;
  replyData?: AgentReply;
}

export function AgentPanel({
  state,
  onApprove,
  onAudit,
}: {
  state: AppState;
  onApprove: (p: Proposal) => void;
  onAudit: (audit: AgentAudit) => void;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'agent',
      text: state.evidence.length === 0
        ? 'Welcome to your Career Companion. I have inspected your profile. Since you have not yet completed a diagnostic, your first step is to establish a skill baseline so we can build your personalized roadmap.'
        : `Hello! I have reviewed your ${state.evidence.length} verified signals. Ask me anything about your current bottlenecks, roadmap priorities, or approved mentors.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [error, setError] = useState('');
  const [handled, setHandled] = useState<string[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function evidenceVersion(value: AppState['evidence']) {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16);
    } catch {
      return 'unavailable';
    }
  }

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const userText = question.trim();
    setQ('');
    setBusy(true);
    setError('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'student',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userText,
          state: { v: 2, activity: state.activity, requests: state.requests },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      const result = data as AgentReply;

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: result.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        replyData: result,
      };

      setMessages((prev) => [...prev, agentMsg]);

      onAudit({
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        mode: result.mode,
        question: userText,
        model: result.model,
        fallbackReason: result.fallbackReason,
        proposalCount: result.proposals.length,
        evidenceVersion: await evidenceVersion(state.evidence),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The agent could not be reached.';
      setError(message);
      onAudit({
        id: `agent-failed-${Date.now()}`,
        at: new Date().toISOString(),
        mode: 'fallback',
        question: userText,
        fallbackReason: 'client_error',
        proposalCount: 0,
        evidenceVersion: await evidenceVersion(state.evidence),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wide">
      <PageIntro
        kicker="CAREER AGENT"
        title="Genuinely intelligent, evidence-grounded guidance."
        text="Your companion reads your verified evidence using secure server-side tools. It never invents fake scores or sends anything without your consent."
      />

      <div className="agent-workspace">
        <div className="agent-status-bar">
          <div className="agent-status-badge">
            <Sparkles size={14} />
            <span>Deterministic Career Intelligence · Verified Server Evidence</span>
          </div>
          <small className="muted">Strict anti-tamper boundary</small>
        </div>

        <div className="chat-scroll-area">
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.sender}`}>
              <div className="msg-content">
                <p>{m.text}</p>

                {m.replyData?.steps && m.replyData.steps.length > 0 && (
                  <div className="trace-box">
                    <span className="trace-title">Verified Tool Execution:</span>
                    {m.replyData.steps.map((s, idx) => (
                      <div key={idx} className="trace-item">
                        <code>{s.tool}</code>
                        <span>{s.summary}</span>
                      </div>
                    ))}
                  </div>
                )}

                {m.replyData?.proposals && m.replyData.proposals.length > 0 && (
                  <div className="proposals" style={{ marginTop: 12 }}>
                    <small style={{ color: 'var(--cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <ShieldCheck size={14} /> RECOMMENDED NEXT STEP
                    </small>
                    {m.replyData.proposals.map((p) => (
                      <div className="proposal" key={p.id} style={{ background: 'var(--surface-navy)', border: '1px solid var(--line)', padding: 12, borderRadius: 8 }}>
                        <div>
                          <b style={{ color: '#FFFFFF', fontSize: 14 }}>{p.label}</b>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0' }}>{p.reason}</p>
                          {p.message && <blockquote style={{ borderLeft: '2px solid var(--cyan)', paddingLeft: 8, margin: '6px 0', color: 'var(--muted)', fontSize: 12 }}>{p.message}</blockquote>}
                        </div>

                        {handled.includes(p.id) ? (
                          <span style={{ color: 'var(--cyan)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <Check size={14} /> Action handled
                          </span>
                        ) : (
                          <div className="draft-actions" style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="primary"
                              style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }}
                              onClick={() => {
                                setHandled((h) => [...h, p.id]);
                                onApprove(p);
                              }}
                            >
                              {p.type === 'send_mentor_request' ? 'Review & send to mentor' : p.type === 'start_retest' ? 'Start retest now' : 'Apply to plan'}
                              <ArrowRight size={13} />
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}
                              onClick={() => setHandled((h) => [...h, p.id])}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="msg-timestamp">{m.time}</span>
            </div>
          ))}

          {busy && (
            <div className="chat-msg agent">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyan)' }}>
                <RefreshCcw size={14} className="spin" />
                <span>Evaluating evidence and checking prerequisites…</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        <div className="agent-input-bar">
          <div className="prompt-chips">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-chip"
                disabled={busy}
                onClick={() => ask(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="agent-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <label className="sr-only" htmlFor="agent-q">
              Ask your Career Agent
            </label>
            <input
              id="agent-q"
              value={q}
              maxLength={500}
              placeholder="Ask about your skill gaps, roadmap, or mentor recommendations…"
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
            />
            <button className="primary" disabled={busy || !q.trim()}>
              <Send size={15} />
              <span>Ask</span>
            </button>
          </form>

          {error && (
            <p className="auth-error" style={{ marginTop: 10 }} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
