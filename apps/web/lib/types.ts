export type EvidenceKind = 'assessment' | 'project' | 'mentor' | 'practice';

export interface SkillDef {
  id: string;
  name: string;
  target: number;
  weight: number;
  assessable?: boolean;
  task: { title: string; detail: string; minutes: number };
}

export interface Evidence {
  id: string;
  skill: string;
  kind: EvidenceKind;
  score: number; // 0-100
  confidence: number; // 0-1, how much this item counts
  at: string; // ISO timestamp
  label: string;
  metadata?: Record<string, unknown>;
}

export interface Activity {
  id: string; // action id, e.g. BUILD:rest-apis
  skill: string;
  kind: ActionKind;
  at: string;
}

export type ActionKind = 'BUILD' | 'PROVE' | 'MENTOR';

export interface Question {
  id: string;
  skill: string;
  level: 0 | 1 | 2 | 3 | 4 | 5 | number;
  q: string;
  options: string[];
  answer: number;
  why: string;
  prerequisiteConcept?: string;
  misconceptions?: Record<number, string>;
}

export interface Mentor {
  id: string;
  name: string;
  initials: string;
  focus: string;
  strengths: Record<string, number>;
}

export type SkillStatus =
  | 'not_assessed'
  | 'insufficient_evidence'
  | 'emerging'
  | 'foundational'
  | 'independent_application'
  | 'self_reported'
  | 'demonstrated'
  | 'practical_submitted'
  | 'mentor_verified';

export interface SkillState {
  def: SkillDef;
  score: number;
  count: number;
  kinds: EvidenceKind[];
  verified: boolean;
  gap: number;
  status: SkillStatus;
  statusLabel: string;
}

export interface PlanAction {
  id: string;
  kind: ActionKind;
  skill: string;
  title: string;
  detail: string;
  reason: string;
  upTo: number; // estimated maximum readiness points
  priority: number;
  route: 'complete' | 'assess';
}

export interface MentorRequest {
  id: string;
  mentorId: string;
  message: string;
  status: 'sent' | 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  at: string;
}

export interface AgentAudit {
  id: string;
  at: string;
  mode: 'ai' | 'fallback';
  question: string;
  model?: string;
  fallbackReason?: string;
  proposalCount: number;
  evidenceVersion: string;
}

export interface AppState {
  v: 2;
  name: string;
  evidence: Evidence[];
  activity: Activity[];
  mentorNoteResolved: boolean;
  requests: MentorRequest[];
  planNote: string;
  agentRuns: AgentAudit[];
}
