'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  BrainCircuit,
  Check,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  ArrowRight,
  RefreshCcw,
  Info,
  RotateCcw,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { AppState, AgentAudit } from '../lib/engine';
import type { AgentReply, Proposal } from '../lib/agent';
import { PageIntro } from './ui';

interface ChatMessage {
  id: string;
  sender: 'student' | 'agent';
  text: string;
  time: string;
  replyData?: AgentReply;
}

function renderMessageText(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstLineEnd = part.indexOf('\n');
      const lang = firstLineEnd > 3 ? part.slice(3, firstLineEnd).trim() : '';
      const code = firstLineEnd > 3 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
      return (
        <pre
          key={idx}
          style={{
            background: 'var(--surface-navy)',
            padding: '12px 14px',
            borderRadius: 8,
            overflowX: 'auto',
            border: '1px solid var(--line)',
            margin: '8px 0',
            fontSize: 13,
            fontFamily: 'monospace',
            color: '#A5F3FC',
          }}
        >
          {lang && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                marginBottom: 4,
                letterSpacing: '0.05em',
                fontWeight: 700,
              }}
            >
              {lang}
            </div>
          )}
          <code>{code}</code>
        </pre>
      );
    }
    return (
      <p key={idx} style={{ whiteSpace: 'pre-line', margin: '4px 0' }}>
        {part}
      </p>
    );
  });
}

export function AgentPanel({
  state,
  onApprove,
  onAudit,
  workflow,
}: {
  state: AppState;
  onApprove: (p: Proposal) => void;
  onAudit: (audit: AgentAudit) => void;
  workflow?: any;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'agent',
      text:
        state.evidence.length === 0
          ? 'Welcome to your Career Companion. I have inspected your profile. Since you have not yet completed a diagnostic, your first step is to establish a skill baseline so we can build your personalized roadmap.'
          : `Hello! I have reviewed your ${state.evidence.length} verified signals. Ask me anything about your current bottlenecks, roadmap priorities, or approved mentors.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [error, setError] = useState('');
  const [handled, setHandled] = useState<string[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load durable conversation history on mount
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const res = await fetch('/api/conversations', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
          return;
        }

        const loaded: ChatMessage[] = data.messages.map((m: any) => ({
          id: m.id,
          sender: m.role === 'user' ? 'student' : 'agent',
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          replyData: m.metadata?.replyData || undefined,
        }));

        setMessages(loaded);
      } catch {
        // Fallback to initial local welcome
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const suggestedPrompts = useMemo(() => {
    const stage = workflow?.stage || (state.evidence.length === 0 ? 'REGISTERED' : 'LEARNING_IN_PROGRESS');
    if (['REGISTERED', 'ONBOARDING_IN_PROGRESS', 'ONBOARDING_COMPLETE'].includes(stage)) {
      return [
        'How do I prepare for my first diagnostic?',
        'Teach me C basics from scratch',
        'Explain pointers simply with code',
        'What is evaluated in the baseline assessment?',
      ];
    }
    if (['ASSESSMENT_COMPLETE', 'SKILL_BASELINE_REVIEW', 'SKILLS_CONFIRMED'].includes(stage)) {
      return [
        'Explain my current skill baseline and top gap',
        'Should I retest or start learning now?',
        'What are pointers in C with an example?',
        'How do arrays work in memory?',
      ];
    }
    return [
      'What should I focus on this week?',
      'Explain pointers simply with code',
      'How do I fix memory leaks in C?',
      'Which approved mentor matches my focus area?',
    ];
  }, [workflow?.stage, state.evidence.length]);

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

  async function clearHistory() {
    if (clearing || busy) return;
    setClearing(true);
    try {
      await fetch('/api/conversations', { method: 'DELETE' });
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          sender: 'agent',
          text:
            state.evidence.length === 0
              ? 'Welcome to your Career Companion. Conversation history cleared. Ask me anything about preparing for your baseline diagnostic or learning programming fundamentals.'
              : `Hello! Conversation history cleared. I have access to your ${state.evidence.length} verified signals. How can I help you today?`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setClearing(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="ghost"
              onClick={clearHistory}
              disabled={clearing || busy}
              style={{ fontSize: 11, padding: '3px 8px', height: 26, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Clear persistent conversation history"
            >
              {clearing ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
              <span>Clear chat</span>
            </button>
            <small className="muted">Strict anti-tamper boundary</small>
          </div>
        </div>

        <div className="chat-scroll-area">
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.sender}`}>
              <div className="msg-content">
                {renderMessageText(m.text)}

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
                    <small
                      style={{
                        color: 'var(--cyan)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <ShieldCheck size={14} /> RECOMMENDED NEXT STEP
                    </small>
                    {m.replyData.proposals.map((p) => (
                      <div
                        className="proposal"
                        key={p.id}
                        style={{
                          background: 'var(--surface-navy)',
                          border: '1px solid var(--line)',
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <b style={{ color: '#FFFFFF', fontSize: 14 }}>{p.label}</b>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0' }}>
                            {p.reason}
                          </p>
                          {p.message && (
                            <blockquote
                              style={{
                                borderLeft: '2px solid var(--cyan)',
                                paddingLeft: 8,
                                margin: '6px 0',
                                color: 'var(--muted)',
                                fontSize: 12,
                              }}
                            >
                              {p.message}
                            </blockquote>
                          )}
                        </div>

                        {handled.includes(p.id) ? (
                          <span
                            style={{
                              color: 'var(--cyan)',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginTop: 8,
                            }}
                          >
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
                              {p.type === 'send_mentor_request'
                                ? 'Review & send to mentor'
                                : p.type === 'start_retest'
                                ? 'Start retest now'
                                : p.type === 'share_passport'
                                ? 'Open passport sharing'
                                : 'Apply to plan'}
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
            {suggestedPrompts.map((prompt) => (
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
              placeholder="Ask about C fundamentals, pointers, skill bottlenecks, or mentors…"
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
