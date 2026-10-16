import { SKILLS } from './questions.ts';

export type ActivityKind = 'BUILD' | 'PROVE' | 'MENTOR';
export interface ActivityRow { id: string; skill: string; kind: ActivityKind; at: string }

/** Validates an action id a client may mark done. PROVE actions are never client-reportable. */
export function parseActionId(id: unknown): { kind: 'BUILD' | 'MENTOR'; skill: string } | null {
  if (typeof id !== 'string') return null;
  const m = /^(BUILD|MENTOR):([a-z-]{1,40})$/.exec(id);
  if (!m) return null;
  if (m[1] === 'MENTOR') return m[2] === 'feedback' ? { kind: 'MENTOR', skill: 'communication' } : null;
  return SKILLS.some((s) => s.id === m[2]) ? { kind: 'BUILD', skill: m[2] } : null;
}

/** Turns a stored roadmap_actions.source into the activity shape the engine understands. */
export function activityFromSource(source: string, at: string): ActivityRow | null {
  const parsed = parseActionId(source);
  if (parsed) return { id: source, skill: parsed.skill, kind: parsed.kind, at };
  const m = /^PROVE:([a-z-]+)$/.exec(source);
  return m && SKILLS.some((s) => s.id === m[1]) ? { id: source, skill: m[1], kind: 'PROVE', at } : null;
}
