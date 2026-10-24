'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { interviewableSkills } from '../lib/interview';

declare global { interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; } }

export function MockInterview({ onDone }: { onDone: () => void }) {
  const [skill, setSkill] = useState('');
  const [iv, setIv] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [live, setLive] = useState('');
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const rec = useRef<any>(null);
  const startedAt = useRef(0);
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;

  useEffect(() => () => { try { rec.current?.stop(); } catch {} }, []);

  async function start() {
    setError('');
    try {
      const r = await fetch('/api/interview/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill }) });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not start'); return; }
      setIv(x.interview); setIdx(0); setLive(''); setTyped(''); setResult(null);
    } catch { setError('Network error. Please try again.'); }
  }

  function listen() {
    if (!SR) return;
    const inst = new SR();
    inst.lang = 'en-US'; inst.interimResults = true; inst.continuous = true;
    inst.onresult = (e: any) => setLive(Array.from(e.results).map((res: any) => res[0].transcript).join(' ').slice(0, 6000));
    inst.onend = () => setListening(false);
    inst.onerror = () => setListening(false);
    rec.current = inst; startedAt.current = Date.now(); setLive(''); setListening(true);
    try { inst.start(); } catch { setListening(false); }
  }

  function stopListen() { try { rec.current?.stop(); } catch {} setListening(false); }

  async function submitAnswer() {
    const transcript = (typed.trim() || live.trim()).slice(0, 6000);
    if (!transcript) { setError('Answer out loud or type your answer.'); return; }
    setError(''); stopListen();
    try {
      const r = await fetch('/api/interview/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interviewId: iv.id, position: iv.questions[idx].position, transcript, latencyMs: startedAt.current ? Date.now() - startedAt.current : null }) });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not save answer'); return; }
      setLive(''); setTyped('');
      if (idx + 1 < iv.questions.length) setIdx(idx + 1);
      else await finish();
    } catch { setError('Network error. Please try again.'); }
  }

  async function finish() {
    setError('Scoring your answers…');
    try {
      const r = await fetch('/api/interview/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interviewId: iv.id }) });
      const x = await r.json();
      if (!r.ok) { setError(x.error || 'Could not score'); return; }
      setResult(x.interview); setIv(null); setError(''); onDone();
    } catch { setError('Network error while scoring. Try again.'); }
  }

  if (result) return <div className="wide">
    <h2>Mock interview result: {result.score}/100</h2>
    <p className="muted">Mode: {result.mode === 'ai' ? `AI-scored (${result.model ?? 'configured model'})` : 'offline heuristic'} · practice evidence confidence {Math.round(result.confidence * 100)}%, intentionally lower than mentor review.</p>
    {result.questions.map((q: any) => <div key={q.position} style={{ border: '1px solid var(--line,#2a2f3a)', borderRadius: 12, padding: 12, margin: '10px 0' }}><b>Q{q.position}. {q.prompt}</b><p className="muted">“{q.transcript}”</p><span className="count-pill">{q.score ?? '—'}/100</span><p>{q.feedback}</p></div>)}
    <button className="ghost" onClick={() => setResult(null)}>Run another interview</button>
  </div>;

  if (!iv) return <div className="wide">
    <h2>Voice mock interview</h2>
    <p className="muted">Three questions for a selected skill. Speech is transcribed in your browser; only the transcript reaches SkillPilot for scoring. Audio is not uploaded.</p>
    {error && <div className="auth-error">{error}</div>}
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <select value={skill} onChange={(e) => setSkill(e.target.value)}><option value="">Choose a skill</option>{interviewableSkills().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button className="primary" disabled={!skill} onClick={() => void start()}>Start interview</button>
    </div>
  </div>;

  const q = iv.questions[idx];
  return <div className="wide">
    <small className="kicker">QUESTION {idx + 1} OF {iv.questions.length}</small>
    <h2>{q.prompt}</h2>
    {error && <div className="auth-error">{error}</div>}
    <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
      {SR && (listening ? <button className="ghost" onClick={stopListen}><Square size={14}/> Stop recording</button> : <button className="primary" onClick={listen}><Mic size={14}/> Answer with voice</button>)}
      {!SR && <small className="muted"><MicOff size={13}/> Speech recognition is not available here — type your answer instead.</small>}
    </div>
    {listening && <p style={{ minHeight: 60, whiteSpace: 'pre-wrap' }}>{live || <span className="muted">Listening…</span>}</p>}
    <textarea rows={5} maxLength={6000} placeholder={SR ? 'Or type / edit your answer here' : 'Type your spoken-style answer'} value={typed} onChange={(e) => setTyped(e.target.value)}/>
    <button className="primary" style={{ marginTop: 8 }} onClick={() => void submitAnswer()}>{idx + 1 < iv.questions.length ? 'Next question' : 'Finish & score'}</button>
  </div>;
}
