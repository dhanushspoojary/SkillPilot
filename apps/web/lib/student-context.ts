import { db, many, one } from './db.ts';
import { skillStates, readiness, SKILLS, type AppState } from './engine.ts';
import { getStudentCapabilityProfile, type StudentCapabilityProfile } from './capability-profile.ts';
import { getOrComputeWorkflowState, type StudentWorkflowState } from './workflow.ts';

export type MemoryCategory = 'preference' | 'strength' | 'goal' | 'struggle' | 'background' | 'project_interest';

export interface StudentMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  fact: string;
  source: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillCompetencyClassification {
  skillId: string;
  name: string;
  classification: 'self_reported' | 'assessed' | 'demonstrated' | 'mentor_reviewed' | 'verified' | 'unassessed';
  score: number;
  target: number;
  gap: number;
  verified: boolean;
  evidenceCount: number;
  sources: string[];
  notes?: string;
}

export interface CoherentStudentContext {
  student: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  capabilityProfile: StudentCapabilityProfile;
  careerGoal: string;
  workflowStage: string;
  overallReadiness: number;
  skills: SkillCompetencyClassification[];
  verifiedCount: number;
  priorityGap: SkillCompetencyClassification | null;
  activeProjects: Array<{
    slug: string;
    title: string;
    status: string;
    verifiedAt?: string | null;
  }>;
  recentActivities: Array<{
    id: string;
    completedAt: string;
  }>;
  memories: StudentMemory[];
  contextTimestamp: string;
}

/**
 * Builds a trustworthy, coherent student context combining verified server data,
 * self-reported calibration, and durable memories.
 */
export async function getCoherentStudentContext(userId: string): Promise<CoherentStudentContext> {
  // 1. Fetch user profile
  const user = await one<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>(`select id, name, email, role from users where id = $1`, [userId]);

  if (!user) {
    throw new Error('User not found');
  }

  // 2. Fetch capability profile & career goal
  const capabilityProfile = await getStudentCapabilityProfile(userId);
  const careerGoalRow = await one<{ role_name: string }>(
    `select role_name from career_goals where user_id = $1 and active = true order by created_at desc limit 1`,
    [userId],
  ).catch(() => null);
  const careerGoal = careerGoalRow?.role_name || capabilityProfile.careerInterests[0] || 'Software Engineer';

  // 3. Fetch workflow state
  const workflow = await getOrComputeWorkflowState(userId);

  // 4. Fetch authoritative evidence rows
  const evidenceRows = await many<any>(
    `select e.id, s.slug as skill, e.source as kind, e.score, e.confidence, e.captured_at as at
     from user_skill_evidence e
     join skills s on s.id = e.skill_id
     where e.user_id = $1
     order by e.captured_at asc`,
    [userId],
  ).catch(() => []);

  const computedSkills = skillStates(evidenceRows);
  const overallReadiness = readiness(computedSkills);

  // Classify each skill truthfully
  const classifiedSkills: SkillCompetencyClassification[] = computedSkills.map((s) => {
    let classification: SkillCompetencyClassification['classification'] = 'unassessed';
    if (s.verified) {
      classification = 'verified';
    } else if (s.kinds.includes('mentor')) {
      classification = 'mentor_reviewed';
    } else if (s.kinds.includes('project')) {
      classification = 'demonstrated';
    } else if (s.kinds.includes('assessment')) {
      classification = 'assessed';
    } else if (s.count > 0) {
      classification = 'self_reported';
    }

    return {
      skillId: s.def.id,
      name: s.def.name,
      classification,
      score: s.score,
      target: s.def.target,
      gap: s.gap,
      verified: s.verified,
      evidenceCount: s.count,
      sources: s.kinds,
    };
  });

  const gaps = classifiedSkills.filter((s) => s.gap > 0).sort((a, b) => b.gap - a.gap);
  const priorityGap = gaps[0] || null;
  const verifiedCount = classifiedSkills.filter((s) => s.verified).length;

  // 5. Active practical projects
  const projectRows = await many<{
    slug: string;
    title: string;
    status: string;
    verified_at: string | null;
  }>(
    `select slug, title, status, verified_at
     from student_projects
     where user_id = $1
     order by updated_at desc limit 10`,
    [userId],
  ).catch(() => []);

  // 6. Recent completed activities
  const activityRows = await many<{
    source: string;
    completed_at: string;
  }>(
    `select source, completed_at
     from roadmap_actions
     where user_id = $1 and status = 'completed'
     order by completed_at desc limit 15`,
    [userId],
  ).catch(() => []);

  // 7. Durable memories
  const memories = await listStudentMemories(userId);

  return {
    student: user,
    capabilityProfile,
    careerGoal,
    workflowStage: workflow.stage,
    overallReadiness,
    skills: classifiedSkills,
    verifiedCount,
    priorityGap,
    activeProjects: projectRows.map((p) => ({
      slug: p.slug,
      title: p.title,
      status: p.status,
      verifiedAt: p.verified_at ? new Date(p.verified_at).toISOString() : null,
    })),
    recentActivities: activityRows.map((a) => ({
      id: a.source,
      completedAt: new Date(a.completed_at).toISOString(),
    })),
    memories,
    contextTimestamp: new Date().toISOString(),
  };
}

/**
 * Formats concise, task-relevant context for injecting into LLM system prompts without token bloating.
 */
export function formatContextForPrompt(ctx: CoherentStudentContext, taskHint = 'general'): string {
  const verifiedSkillsStr = ctx.skills
    .filter((s) => s.verified)
    .map((s) => `${s.name} (${s.score}%)`)
    .join(', ') || 'None verified yet';

  const assessedGapsStr = ctx.skills
    .filter((s) => s.gap > 0)
    .map((s) => `${s.name} (Current: ${s.score}%, Target: ${s.target}%)`)
    .join(', ') || 'None';

  const memoriesStr = ctx.memories.length > 0
    ? ctx.memories.map((m) => `- [${m.category}] ${m.fact}`).join('\n')
    : 'No explicit student memories saved.';

  const projectsStr = ctx.activeProjects.length > 0
    ? ctx.activeProjects.map((p) => `- ${p.title} (${p.status})`).join('\n')
    : 'No practical projects started yet.';

  return `
[STUDENT AUTHORITATIVE CONTEXT]
- Name: ${ctx.student.name}
- Career Goal: ${ctx.careerGoal}
- Education Stage: ${ctx.capabilityProfile.educationLevel} (${ctx.capabilityProfile.fieldOfStudy})
- Experience Level: ${ctx.capabilityProfile.programmingExperience}
- Available Study Time: ${ctx.capabilityProfile.weeklyHours} hrs/week
- Workflow Stage: ${ctx.workflowStage}
- Readiness Score: ${ctx.overallReadiness}% (${ctx.verifiedCount} of ${ctx.skills.length} verified)
- Verified Skills: ${verifiedSkillsStr}
- Current Priority Gaps: ${assessedGapsStr}
- Top Focus: ${ctx.priorityGap ? `${ctx.priorityGap.name} (gap: ${ctx.priorityGap.gap}%)` : 'Ready for advanced projects'}

[ACTIVE PRACTICAL PROJECTS]
${projectsStr}

[SAVED LEARNING MEMORIES]
${memoriesStr}
`;
}

/**
 * Lists all durable memories for a student.
 */
export async function listStudentMemories(userId: string): Promise<StudentMemory[]> {
  const rows = await many<{
    id: string;
    userId: string;
    category: MemoryCategory;
    fact: string;
    source: string;
    confidence: string;
    createdAt: string;
    updatedAt: string;
  }>(
    `select id, user_id as "userId", category, fact, source, confidence,
            created_at as "createdAt", updated_at as "updatedAt"
     from student_memories
     where user_id = $1
     order by updated_at desc limit 50`,
    [userId],
  ).catch(() => []);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    category: r.category,
    fact: r.fact,
    source: r.source,
    confidence: Number(r.confidence || 0.8),
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}

/**
 * Adds a new durable learning memory for a student.
 */
export async function addStudentMemory(
  userId: string,
  category: MemoryCategory,
  fact: string,
  source = 'conversation',
  confidence = 0.85,
): Promise<StudentMemory> {
  const cleanFact = fact.trim().slice(0, 300);
  const res = await db().query(
    `insert into student_memories(user_id, category, fact, source, confidence, created_at, updated_at)
     values($1, $2, $3, $4, $5, now(), now())
     returning id, user_id as "userId", category, fact, source, confidence, created_at as "createdAt", updated_at as "updatedAt"`,
    [userId, category, cleanFact, source, confidence],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    fact: row.fact,
    source: row.source,
    confidence: Number(row.confidence),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Deletes a student learning memory (student-controlled memory management).
 */
export async function deleteStudentMemory(userId: string, memoryId: string): Promise<boolean> {
  const res = await db().query(
    `delete from student_memories where id = $1 and user_id = $2`,
    [memoryId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}
