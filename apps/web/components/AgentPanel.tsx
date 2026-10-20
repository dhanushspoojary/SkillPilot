'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  BrainCircuit,
  Check,
  Send,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RefreshCcw,
  Trash2,
  Loader2,
  Plus,
  MessageSquare,
  Search,
  Edit2,
  Copy,
  CheckCheck,
  RotateCcw,
  X,
  Code2,
  Volume2,
  Mic,
  MicOff,
} from 'lucide-react';
import type { AppState, AgentAudit } from '../lib/engine';
import type { AgentReply, Proposal } from '../lib/agent';
import { PageIntro } from './ui';
import { formatSafeTime } from '../lib/date-format';

interface ChatMessage {
  id: string;
  sender: 'student' | 'agent';
  text: string;
  time: string;
  replyData?: AgentReply;
}

interface ThreadItem {
  id: string;
  title: string;
  updated_at: string;
  message_count?: number;
}

interface StudentMemoryItem {
  id: string;
  category: string;
  fact: string;
  confidence: number;
  createdAt: string;
}

// Code Block with Copy-to-Clipboard Button
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#0D1117',
        borderRadius: 8,
        border: '1px solid var(--line)',
        margin: '10px 0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          padding: '6px 12px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--cyan)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 700,
          }}
        >
          {lang || 'CODE'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'none',
            border: 'none',
            color: copied ? '#34D399' : 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre
        style={{
          padding: '12px 14px',
          overflowX: 'auto',
          margin: 0,
          fontSize: 13,
          fontFamily: 'Consolas, Monaco, monospace',
          color: '#A5F3FC',
          lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Markdown Table Parser and Renderer
function renderMarkdownTable(lines: string[], keyPrefix: number) {
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
  );

  if (rows.length < 2) return null;
  const header = rows[0];
  const bodyRows = rows.slice(2); // Skip separator row

  return (
    <div
      key={`table-${keyPrefix}`}
      style={{
        overflowX: 'auto',
        margin: '12px 0',
        borderRadius: 8,
        border: '1px solid var(--line)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          textAlign: 'left',
          background: 'var(--surface-navy)',
        }}
      >
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid var(--line)' }}>
            {header.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '8px 12px',
                  color: 'var(--cyan)',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: rIdx < bodyRows.length - 1 ? '1px solid var(--line)' : 'none',
                background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Rich Message Content Renderer (Code, Tables, Text)
function renderMessageContent(text: string) {
  // First split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstLineEnd = part.indexOf('\n');
      const lang = firstLineEnd > 3 ? part.slice(3, firstLineEnd).trim() : '';
      const code = firstLineEnd > 3 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
      return <CodeBlock key={idx} code={code} lang={lang} />;
    }

    // Check for markdown tables inside text segments
    const lines = part.split('\n');
    const elements: React.ReactNode[] = [];
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableLines.push(line);
      } else {
        if (tableLines.length >= 2) {
          elements.push(renderMarkdownTable(tableLines, i));
          tableLines = [];
        }
        if (line.trim()) {
          elements.push(
            <p key={`p-${idx}-${i}`} style={{ margin: '4px 0', lineHeight: 1.5 }}>
              {line}
            </p>
          );
        }
      }
    }

    if (tableLines.length >= 2) {
      elements.push(renderMarkdownTable(tableLines, 9999));
    }

    return <div key={idx}>{elements}</div>;
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
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [handled, setHandled] = useState<string[]>([]);
  const [memories, setMemories] = useState<StudentMemoryItem[]>([]);
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>('');
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceInput = () => {
    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setListening(false);
      return;
    }
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setQ((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
      setError('Could not access microphone.');
    }
  };

  const speakText = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (speakingMsgId === msgId) {
        setSpeakingMsgId(null);
        return;
      }
    }
    const cleanText = text.replace(/[`*#_>~-]/g, ' ').slice(0, 500);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Load threads list on mount
  const loadThreads = async (selectLatest = false) => {
    try {
      const res = await fetch('/api/conversations?threads=true', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
        if (data.threads.length > 0 && (selectLatest || !activeThreadId)) {
          setActiveThreadId(data.threads[0].id);
        }
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    void loadThreads(true);
  }, []);

  // Load messages whenever activeThreadId changes
  useEffect(() => {
    let cancelled = false;
    async function loadThreadMessages() {
      if (!activeThreadId) return;
      try {
        const res = await fetch(`/api/conversations?threadId=${encodeURIComponent(activeThreadId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const loaded: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            sender: m.role === 'user' ? 'student' : 'agent',
            text: m.content,
            time: formatSafeTime(m.createdAt || m.created_at, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
            replyData: m.metadata?.replyData || undefined,
          }));
          setMessages(loaded);
        } else {
          setMessages([
            {
              id: 'welcome-default',
              sender: 'agent',
              text:
                state.evidence.length === 0
                  ? 'Welcome to your Career AI workspace. I am ready to help you explore concepts, plan practice, and prepare for diagnostics.'
                  : `Hello! I have reviewed your verified evidence profile. What would you like to focus on in this thread?`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } catch {
        // Fallback
      }
    }

    void loadThreadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, state.evidence.length]);

  // Load student memories
  const loadStudentMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await fetch('/api/agent/memories', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      const res = await fetch(`/api/agent/memories?id=${encodeURIComponent(memoryId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const handleCreateThread = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.thread) {
          setThreads((prev) => [data.thread, ...prev]);
          setActiveThreadId(data.thread.id);
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleRenameThread = async (threadId: string) => {
    if (!editThreadTitle.trim()) {
      setEditingThreadId(null);
      return;
    }
    try {
      const res = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, title: editThreadTitle.trim() }),
      });
      if (res.ok) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: editThreadTitle.trim() } : t))
        );
      }
    } catch {
      // Ignore
    } finally {
      setEditingThreadId(null);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!window.confirm('Delete this conversation thread?')) return;
    try {
      const res = await fetch(`/api/conversations?threadId=${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = threads.filter((t) => t.id !== threadId);
        setThreads(remaining);
        if (activeThreadId === threadId) {
          if (remaining.length > 0) {
            setActiveThreadId(remaining[0].id);
          } else {
            void handleCreateThread();
          }
        }
      }
    } catch {
      // Ignore
    }
  };

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, searchQuery]);

  const suggestedPrompts = useMemo(() => {
    const stage = workflow?.stage || (state.evidence.length === 0 ? 'REGISTERED' : 'LEARNING_IN_PROGRESS');
    if (['REGISTERED', 'ONBOARDING_IN_PROGRESS', 'ONBOARDING_COMPLETE'].includes(stage)) {
      return [
        'How do I prepare for my first diagnostic?',
        'Teach me C basics from scratch',
        'Explain pointers simply with code',
        'Tell me about practical projects I can build',
      ];
    }
    if (['ASSESSMENT_COMPLETE', 'SKILL_BASELINE_REVIEW', 'SKILLS_CONFIRMED'].includes(stage)) {
      return [
        'Create a learning plan for REST APIs',
        'Give me a practice question on pointers',
        'Tell me about practical projects I can build',
        'What should I focus on this week?',
      ];
    }
    return [
      'Create a learning plan for REST APIs',
      'Explain pointers simply with code',
      'Give me a practice question on pointers',
      'Tell me about practical projects I can build',
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

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const userText = question.trim();
    lastQuestionRef.current = userText;
    setQ('');
    setBusy(true);
    setError('');

    const ctl = new AbortController();
    abortControllerRef.current = ctl;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'student',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const idempotencyKey = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch('/api/agent', {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          question: userText,
          threadId: activeThreadId || undefined,
          idempotencyKey,
          state: { v: 2, activity: state.activity, requests: state.requests },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      const result = data as AgentReply & { threadId?: string };

      if (result.threadId && result.threadId !== activeThreadId) {
        setActiveThreadId(result.threadId);
        void loadThreads();
      }

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
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'aborted')) {
        setError('Generation stopped by student.');
        return;
      }
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
      abortControllerRef.current = null;
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setBusy(false);
      setError('Generation stopped.');
    }
  };

  const handleRetry = () => {
    if (lastQuestionRef.current && !busy) {
      void ask(lastQuestionRef.current);
    }
  };

  return (
    <div className="wide">
      <PageIntro
        kicker="CAREER AGENT"
        title="Genuinely intelligent, multi-threaded career guidance."
        text="Your companion reads your verified evidence, maintains durable learning memories, and explains code Socratically with test-driven practical projects."
      />

      {/* Main Workspace Layout with Threads Sidebar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 280px) minmax(400px, 1fr)',
          gap: 16,
          background: 'var(--surface-navy)',
          borderRadius: 12,
          border: '1px solid var(--line)',
          overflow: 'hidden',
          minHeight: 680,
        }}
      >
        {/* Left Column: Multi-thread Sidebar */}
        <div
          style={{
            borderRight: '1px solid var(--line)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* New Chat Button & Search */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
            <button
              type="button"
              className="primary"
              onClick={handleCreateThread}
              style={{
                width: '100%',
                minHeight: 36,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Plus size={15} />
              <span>New Conversation</span>
            </button>

            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                style={{
                  width: '100%',
                  height: 32,
                  fontSize: 12,
                  paddingLeft: 30,
                  paddingRight: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  color: '#FFFFFF',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Threads List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
            {filteredThreads.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                No conversations found
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isActive = t.id === activeThreadId;
                const isEditing = editingThreadId === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (!isEditing) setActiveThreadId(t.id);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      marginBottom: 4,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(34, 211, 238, 0.12)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(34, 211, 238, 0.3)' : 'transparent'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                      <MessageSquare size={14} color={isActive ? 'var(--cyan)' : 'var(--muted)'} />
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editThreadTitle}
                          onChange={(e) => setEditThreadTitle(e.target.value)}
                          onBlur={() => handleRenameThread(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameThread(t.id);
                            if (e.key === 'Escape') setEditingThreadId(null);
                          }}
                          style={{
                            fontSize: 12,
                            background: '#000',
                            border: '1px solid var(--cyan)',
                            color: '#FFF',
                            padding: '2px 6px',
                            borderRadius: 4,
                            width: '100%',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.title}
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <div style={{ display: 'flex', gap: 4, opacity: isActive ? 1 : 0.4 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingThreadId(t.id);
                            setEditThreadTitle(t.title);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                          title="Rename thread"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(t.id);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                          title="Delete thread"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: Learning Memories Link */}
          <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setShowMemoriesModal(true);
                void loadStudentMemories();
              }}
              style={{
                width: '100%',
                minHeight: 32,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <BrainCircuit size={14} color="var(--cyan)" />
              <span>Inspect Durable Memories</span>
            </button>
          </div>
        </div>

        {/* Right Column: Chat Stream & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header Bar */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color="var(--cyan)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                {threads.find((t) => t.id === activeThreadId)?.title || 'Career AI Assistant'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>PostgreSQL Immutable Evidence Ledger</span>
            </div>
          </div>

          {/* Chat Scroll Area */}
          <div
            className="chat-scroll-area"
            role="log"
            aria-live="polite"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.sender}`}>
                <div className="msg-content">
                  {renderMessageContent(m.text)}

                  {/* Message Action Controls (Retry & Edit for Student) */}
                  {m.sender === 'student' && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                      <button
                        type="button"
                        onClick={() => setQ(m.text)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                      >
                        Edit in prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => ask(m.text)}
                        style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', padding: 0 }}
                      >
                        Retry question
                      </button>
                    </div>
                  )}

                  {m.sender === 'agent' && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                      <button
                        type="button"
                        onClick={() => speakText(m.id, m.text)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: speakingMsgId === m.id ? 'var(--cyan)' : 'var(--muted)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                        }}
                        title={speakingMsgId === m.id ? 'Stop reading aloud' : 'Read aloud'}
                      >
                        <Volume2 size={12} />
                        <span>{speakingMsgId === m.id ? 'Stop reading' : 'Read aloud'}</span>
                      </button>
                    </div>
                  )}

                  {/* Action Proposals */}
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
                            background: '#0D1117',
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
                                  : p.type === 'start_project'
                                  ? 'Open Project Workspace'
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
                  <span>Evaluating verified evidence, context, and prerequisites…</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input & Prompt Suggestions */}
          <div style={{ padding: 16, borderTop: '1px solid var(--line)', background: 'rgba(0,0,0,0.1)' }}>
            <div className="prompt-chips" style={{ marginBottom: 10 }}>
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
                placeholder="Ask about C fundamentals, pointers, learning plans, or practical projects…"
                onChange={(e) => setQ(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={busy}
                style={{
                  background: listening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: listening ? '1px solid #EF4444' : '1px solid var(--line)',
                  color: listening ? '#EF4444' : 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '0 10px',
                  height: 38,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={listening ? 'Listening... click to stop' : 'Dictate with microphone'}
                aria-label={listening ? 'Stop listening' : 'Dictate question with microphone'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {busy ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCancel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#F87171',
                  }}
                  title="Stop generating"
                >
                  <X size={15} />
                  <span>Stop</span>
                </button>
              ) : (
                <button className="primary" disabled={busy || !q.trim()}>
                  <Send size={15} />
                  <span>Ask</span>
                </button>
              )}
            </form>

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <p className="auth-error" style={{ margin: 0 }} role="alert">
                  {error}
                </p>
                {lastQuestionRef.current && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--cyan)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <RotateCcw size={13} />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Durable Memories Inspection Modal */}
      {showMemoriesModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowMemoriesModal(false)}
        >
          <div
            style={{
              background: 'var(--surface-navy)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BrainCircuit size={18} color="var(--cyan)" />
                <h3 style={{ margin: 0, color: '#FFFFFF' }}>Durable Student Memories</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMemoriesModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              These verified learning memories inform your AI career companion. You have full ownership and can remove any memory at any time.
            </p>

            {loadingMemories ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--cyan)' }}>
                <Loader2 size={20} className="spin" />
              </div>
            ) : memories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>
                No explicit learning memories saved yet. Memories are automatically recorded as you share your learning preferences, struggles, and goals.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {memories.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          color: 'var(--cyan)',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {m.category}
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#FFFFFF' }}>{m.fact}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(m.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title="Delete this memory"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
