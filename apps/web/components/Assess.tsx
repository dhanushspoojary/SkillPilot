'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { Evidence } from '../lib/types';
const names: Record<string, string> = { 'rest-apis': 'REST APIs', sql: 'SQL', 'problem-solving': 'Problem solving' };
type Q = {
    id: string;
    skill: string;
    level: number;
    q: string;
    options: string[];
};
export function Assess({ evidence, focus, onFinish, onDone }: {
    evidence: Evidence[];
    focus?: string;
    onFinish: (r?: any[]) => Promise<void> | void;
    onDone: () => void;
}) {
    const [assessmentId, setAssessmentId] = useState('');
    const [q, setQ] = useState<Q | null>(null);
    const [picked, setPicked] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [total, setTotal] = useState(0);
    const [results, setResults] = useState<any[] | null>(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    async function start() {
        setBusy(true);
        setError('');
        setPicked(null);
        setFeedback(null);
        setResults(null);
        try {
            const r = await fetch('/api/assess/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focus }) });
            const x = await r.json();
            if (!r.ok)
                throw new Error(x.error || 'Could not start assessment');
            setAssessmentId(x.assessmentId);
            setQ(x.question);
            setTotal(x.total);
            setIndex(x.index ?? 0);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not start assessment');
        }
        finally {
            setBusy(false);
        }
    }
    useEffect(() => { void start(); }, [focus]);
    async function submit() {
        if (!q || picked === null || !assessmentId || busy)
            return;
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/assess/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assessmentId, questionId: q.id, choice: picked }) });
            const x = await r.json();
            if (!r.ok)
                throw new Error(x.error || 'Could not score answer');
            setFeedback(x.done ? 'Assessment complete.' : 'Answer recorded. The next question has been selected from your current performance.');
            if (x.done) {
                setResults(x.results);
                await onFinish(x.results);
            }
            else {
                window.setTimeout(() => {
                    setQ(x.question);
                    setIndex(typeof x.index === 'number' ? x.index : index + 1);
                    if (x.total)
                        setTotal(x.total);
                    setPicked(null);
                    setFeedback(null);
                    setBusy(false);
                }, 350);
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not submit answer');
            setBusy(false);
        }
    }
    if (error)
        return <div className="assessment-shell"><div className="result"><ShieldCheck /><span className="kicker">SERVER CHECK FAILED</span><h2>Your evidence was not changed.</h2><p>{error}</p><button className="primary" onClick={start}>Try again</button></div></div>;
    if (results)
        return <div className="assessment-shell"><div className="result"><div className="result-icon"><CheckCircle2 /></div><span className="kicker">SERVER-SCORED DIAGNOSTIC COMPLETE</span><h2>{Math.round(results.reduce((s, r) => s + r.score, 0) / Math.max(1, results.length))}%</h2><p>The answer key stayed on the server. The result above is now authoritative evidence tied to your account.</p><ul className="result-list">{results.map(r => <li key={r.skill}><b>{names[r.skill] || r.skill}</b> {r.correct}/{r.asked} correct · signal {r.score}%</li>)}</ul><div className="result-actions"><button className="primary" onClick={onDone}>See updated plan <ArrowRight size={15}/></button><button className="ghost" onClick={start}><RefreshCcw size={15}/> Retake</button></div></div></div>;
    if (busy && !q)
        return <div className="assessment-shell"><div className="result"><ShieldCheck /><span className="kicker">SECURE ASSESSMENT</span><h2>Preparing your diagnostic…</h2><p>Questions are selected server-side and scored on the server.</p></div></div>;
    if (!q)
        return null;
    const answered = picked !== null;
    return <div className="assessment-shell"><div className="assessment-top"><span>ADAPTIVE DIAGNOSTIC · {index + 1}/{total}</span><b>{names[q.skill] || q.skill} · level {q.level}</b></div><h2>{q.q}</h2><div className="options" role="group" aria-label="Answer options">{q.options.map((option, i) => <button key={option} className={feedback ? 'selected-answer' : ''} aria-pressed={picked === i} onClick={() => !answered && !busy && setPicked(i)} disabled={answered || busy}><span>{String.fromCharCode(65 + i)}</span>{option}</button>)}</div>{feedback && <p className="explain" role="status"><b>{feedback}</b></p>}<div className="assessment-foot"><span><ShieldCheck size={13}/> Answer key never leaves the server.</span><button className="primary" onClick={submit} disabled={!answered || busy}>{busy ? 'Scoring…' : index + 1 === total ? 'Finish' : 'Next'} <ArrowRight size={14}/></button></div></div>;
}
