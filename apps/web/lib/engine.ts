import type { Activity, AppState, Evidence, PlanAction, SkillState, } from './types.ts';
import { SKILLS } from './questions.ts';
export type { AppState, Evidence, PlanAction, SkillState, AgentAudit } from './types.ts';
export { SKILLS } from './questions.ts';
const UNVERIFIED_FACTOR = 0.85;
export function defaultState(): AppState {
    return { v: 2, name: '', evidence: [], activity: [], mentorNoteResolved: false, requests: [], planNote: 'No evidence yet. Start with a server-scored diagnostic.', agentRuns: [] };
}
/** Confidence-weighted mean of the evidence for each skill. Verified needs 3+ items from 2+ source kinds. */
export function skillStates(rawEvidence: Evidence[]): SkillState[] {
    // Defensive normalisation: DB drivers and JSON can hand us numeric strings or Date objects.
    const evidence = rawEvidence.map((e) => ({
        ...e,
        score: Number(e.score),
        confidence: Number(e.confidence),
        at: typeof e.at === 'string' ? e.at : new Date(e.at as unknown as string | number).toISOString(),
    }));
    return SKILLS.map((def) => {
        const all = evidence.filter((e) => e.skill === def.id).sort((a, b) => a.at.localeCompare(b.at));
        // Repeated assessments are useful as fresh signals, but an account cannot inflate its
        // profile forever by taking the same diagnostic. Keep only the two latest assessment signals.
        const assessments = all.filter((e) => e.kind === 'assessment').slice(-2);
        const items = [...all.filter((e) => e.kind !== 'assessment'), ...assessments];
        const weight = items.reduce((s, e) => s + e.confidence, 0);
        const score = weight > 0 ? Math.round(items.reduce((s, e) => s + e.score * e.confidence, 0) / weight) : 0;
        const kinds = [...new Set(items.map((e) => e.kind))];
        const verified = items.length >= 3 && kinds.length >= 2;
        return { def, score, count: items.length, kinds, verified, gap: Math.max(0, def.target - score) };
    });
}
function credit(s: SkillState): number {
    return Math.min(s.score / s.def.target, 1) * (s.verified ? 1 : UNVERIFIED_FACTOR);
}
export function readiness(skills: SkillState[]): number {
    const total = skills.reduce((s, k) => s + k.def.weight, 0);
    return Math.round((skills.reduce((s, k) => s + k.def.weight * credit(k), 0) / total) * 100);
}
export function lastAssessmentAt(evidence: Evidence[], skill: string): string | null {
    const times = evidence.filter((e) => e.skill === skill && e.kind === 'assessment' && typeof e.metadata?.assessmentId === 'string').map((e) => e.at);
    return times.length ? times.sort().at(-1)! : null;
}
function hasPendingWork(state: AppState, skill: string): boolean {
    const since = lastAssessmentAt(state.evidence, skill) ?? '';
    return state.activity.some((a) => a.skill === skill && a.kind === 'BUILD' && a.at > since);
}
/** Deterministic next actions, highest priority first. Never invents scores. */
export function planActions(state: AppState): PlanAction[] {
    const skills = skillStates(state.evidence);
    const total = skills.reduce((s, k) => s + k.def.weight, 0);
    const out: PlanAction[] = [];
    for (const s of skills) {
        const unverifiedGap = s.verified ? 0 : 8;
        if (s.gap <= 0 && s.verified)
            continue;
        const priority = s.def.weight * (s.gap + unverifiedGap);
        const upTo = Math.max(1, Math.round((s.def.weight * (s.gap / s.def.target) * 100) / total));
        const facts = `${s.def.name} is ${s.gap} points below target (${s.score} vs ${s.def.target}) with ${s.count} evidence item${s.count === 1 ? '' : 's'}${s.verified ? '' : ', not yet verified'}.`;
        if (s.def.assessable && hasPendingWork(state, s.def.id)) {
            out.push({ id: `PROVE:${s.def.id}`, kind: 'PROVE', skill: s.def.id, title: `Retest ${s.def.name}`, detail: 'Adaptive check · 4 min', reason: `You did the work; a retest turns it into evidence. ${facts}`, upTo, priority: priority + 1000, route: 'assess' });
        }
        else if (s.gap >= 15 || !s.def.assessable) {
            if (s.gap > 0)
                out.push({ id: `BUILD:${s.def.id}`, kind: 'BUILD', skill: s.def.id, title: s.def.task.title, detail: s.def.task.detail, reason: facts, upTo, priority, route: 'complete' });
        }
        else if (s.def.assessable) {
            out.push({ id: `PROVE:${s.def.id}`, kind: 'PROVE', skill: s.def.id, title: `Prove ${s.def.name}`, detail: 'Adaptive check · 4 min', reason: facts, upTo, priority, route: 'assess' });
        }
    }
    // Mentor feedback is only shown when a real mentor request is awaiting review.
    const hasOpenMentorWork = state.requests.some((r) => ['accepted'].includes(r.status));
    if (!state.mentorNoteResolved && hasOpenMentorWork) {
        out.push({ id: 'MENTOR:feedback', kind: 'MENTOR', skill: 'communication', title: 'Review mentor feedback', detail: 'Open mentor session', reason: 'An active mentor session can change your next action.', upTo: 1, priority: 15, route: 'complete' });
    }
    const done = new Set(state.activity.map((a) => a.id));
    return out.filter((a) => a.kind === 'PROVE' || !done.has(a.id)).sort((a, b) => b.priority - a.priority);
}
export function explainPlan(state: AppState): string {
    const top = planActions(state)[0];
    return top ? `${top.title}. ${top.reason}` : 'Every tracked skill meets its target and is verified. Time to raise the target role.';
}
export function toggleActivity(state: AppState, action: PlanAction | {
    id: string;
    skill: string;
    kind: Activity['kind'];
}, at: string): AppState {
    const exists = state.activity.some((a) => a.id === action.id);
    const activity = exists ? state.activity.filter((a) => a.id !== action.id) : [...state.activity, { id: action.id, skill: action.skill, kind: action.kind, at }];
    const resolved = action.id === 'MENTOR:feedback' ? !exists : state.mentorNoteResolved;
    const next = { ...state, activity, mentorNoteResolved: resolved };
    return { ...next, planNote: explainPlan(next) };
}
export function passportSummary(name: string, evidence: Evidence[]): string {
    const skills = skillStates(evidence);
    const lines = skills.map((s) => `- ${s.def.name}: ${s.score}/${s.def.target} (${s.verified ? 'verified' : 'in progress'}, ${s.count} evidence)`);
    return `Skill Passport: ${name || 'Student'}\nReadiness: ${readiness(skills)}%\n${lines.join('\n')}`;
}
/** Roadmap stage progress, computed from the skills each stage needs. */
export const STAGES: {
    n: string;
    name: string;
    weeks: string;
    skills: string[];
    blurb: string;
}[] = [
    { n: '01', name: 'Foundations', weeks: 'Weeks 1–3', skills: ['javascript', 'git', 'problem-solving'], blurb: 'JavaScript · Git · problem solving' },
    { n: '02', name: 'Build + prove', weeks: 'Weeks 4–7', skills: ['rest-apis', 'sql', 'javascript'], blurb: 'APIs · SQL · projects' },
    { n: '03', name: 'Opportunity cycle', weeks: 'Weeks 8–10', skills: ['communication', 'rest-apis'], blurb: 'Portfolio · mentor review' },
    { n: '04', name: 'Interview readiness', weeks: 'Weeks 11–12', skills: ['problem-solving', 'communication', 'sql'], blurb: 'Mock interviews · explaining projects' },
];
export function stageProgress(skills: SkillState[], ids: string[]): number {
    const picked = skills.filter((s) => ids.includes(s.def.id));
    return Math.round((picked.reduce((a, s) => a + credit(s), 0) / picked.length) * 100);
}
/** Strict parser used at trust boundaries. Returns null instead of silently replacing malformed data. */
export function parseStateStrict(raw: string | null): AppState | null {
    if (!raw)
        return null;
    try {
        const p = JSON.parse(raw);
        if ((p?.v !== 1 && p?.v !== 2) || !Array.isArray(p.evidence) || !Array.isArray(p.activity) || !Array.isArray(p.requests))
            return null;
        const okEvidence = p.evidence.every((e: Evidence) => typeof e?.id === 'string' && e.id.length <= 120 && typeof e?.skill === 'string' &&
            Number.isFinite(e.score) && e.score >= 0 && e.score <= 100 &&
            Number.isFinite(e.confidence) && e.confidence >= 0 && e.confidence <= 1 &&
            typeof e.at === 'string' && typeof e.label === 'string' && e.label.length <= 200 &&
            ['assessment', 'project', 'mentor', 'practice'].includes(e.kind) && SKILLS.some((skill) => skill.id === e.skill));
        const okActivity = p.activity.every((a: any) => typeof a?.id === 'string' && a.id.length <= 120 && typeof a?.skill === 'string' && SKILLS.some((skill) => skill.id === a.skill) && ['BUILD', 'PROVE', 'MENTOR'].includes(a.kind) && typeof a.at === 'string');
        const okRequests = p.requests.every((r: any) => typeof r?.mentorId === 'string' && r.mentorId.length <= 100 && typeof r.message === 'string' && r.message.length <= 1200 && ['sent', 'pending', 'accepted', 'declined', 'completed', 'cancelled'].includes(r.status) && typeof r.at === 'string');
        if (!okEvidence || !okActivity || !okRequests)
            return null;
        const agentRuns = Array.isArray(p.agentRuns) ? p.agentRuns.filter((r: any) => typeof r?.id === 'string' && typeof r?.at === 'string' && ['ai', 'fallback'].includes(r.mode) &&
            typeof r.question === 'string' && r.question.length <= 500 && Number.isInteger(r.proposalCount) && r.proposalCount >= 0 && r.proposalCount <= 4 && typeof r.evidenceVersion === 'string' && r.evidenceVersion.length <= 32).slice(-50) : [];
        return { ...defaultState(), ...p, v: 2, name: String(p.name ?? '').slice(0, 60), agentRuns };
    }
    catch {
        return null;
    }
}
/** Validates data read from storage; anything malformed falls back to the default profile. */
export function parseState(raw: string | null): AppState {
    return parseStateStrict(raw) ?? defaultState();
}
