import { randomBytes } from 'node:crypto';
import { db, one } from './db.ts';
import { skillStates, readiness } from './engine.ts';
import type { Evidence } from './types.ts';

export interface PassportShareRecord {
  id: string;
  userId: string;
  shareToken: string;
  customHeadline: string | null;
  includeName: boolean;
  includeSkills: boolean;
  includeEvidence: boolean;
  status: 'active' | 'revoked';
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
}

export interface PublicPassportData {
  shareToken: string;
  headline: string;
  studentName: string | null;
  careerGoal: string;
  readiness: number;
  verifiedCount: number;
  totalSkills: number;
  evidenceCount: number;
  skills: Array<{
    id: string;
    name: string;
    score: number;
    target: number;
    verified: boolean;
    evidenceCount: number;
    sources: string[];
    status: string;
    statusLabel: string;
  }>;
  recentEvidence: Array<{
    skillName: string;
    source: string;
    score: number;
    capturedAt: string;
  }>;
  authenticityHash: string;
  verifiedAt: string;
}

export async function createOrGetPassportShare(
  userId: string,
  options: {
    customHeadline?: string;
    includeName?: boolean;
    includeSkills?: boolean;
    includeEvidence?: boolean;
  } = {},
): Promise<PassportShareRecord & { url: string }> {
  // Check for existing active share
  const existing = await one<PassportShareRecord>(
    `select id, user_id as "userId", share_token as "shareToken", custom_headline as "customHeadline",
            include_name as "includeName", include_skills as "includeSkills", include_evidence as "includeEvidence",
            status, views_count as "viewsCount", created_at as "createdAt", updated_at as "updatedAt"
     from passport_shares
     where user_id = $1 and status = 'active'
     order by created_at desc limit 1`,
    [userId],
  ).catch(() => null);

  if (existing) {
    return { ...existing, url: `/passport/${existing.shareToken}` };
  }

  // Create new share token: 24-character URL-safe string
  const token = randomBytes(18).toString('base64url');
  const headline = options.customHeadline?.trim().slice(0, 100) || 'Verified Skill Passport';
  const includeName = options.includeName !== false;
  const includeSkills = options.includeSkills !== false;
  const includeEvidence = options.includeEvidence !== false;

  const inserted = await one<PassportShareRecord>(
    `insert into passport_shares(user_id, share_token, custom_headline, include_name, include_skills, include_evidence, status)
     values($1, $2, $3, $4, $5, $6, 'active')
     returning id, user_id as "userId", share_token as "shareToken", custom_headline as "customHeadline",
               include_name as "includeName", include_skills as "includeSkills", include_evidence as "includeEvidence",
               status, views_count as "viewsCount", created_at as "createdAt", updated_at as "updatedAt"`,
    [userId, token, headline, includeName, includeSkills, includeEvidence],
  );

  if (!inserted) {
    throw new Error('Failed to create passport share');
  }

  return { ...inserted, url: `/passport/${inserted.shareToken}` };
}

export async function revokePassportShare(userId: string, shareToken: string): Promise<boolean> {
  const res = await db().query(
    `update passport_shares
     set status = 'revoked', revoked_at = now(), updated_at = now()
     where user_id = $1 and share_token = $2 and status = 'active'`,
    [userId, shareToken],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getPublicPassport(shareToken: string): Promise<PublicPassportData | null> {
  if (!shareToken || typeof shareToken !== 'string' || shareToken.length < 10) {
    return null;
  }

  const share = await one<PassportShareRecord>(
    `select id, user_id as "userId", share_token as "shareToken", custom_headline as "customHeadline",
            include_name as "includeName", include_skills as "includeSkills", include_evidence as "includeEvidence",
            status, views_count as "viewsCount", created_at as "createdAt", updated_at as "updatedAt"
     from passport_shares
     where share_token = $1 and status = 'active'`,
    [shareToken],
  ).catch(() => null);

  if (!share) {
    return null;
  }

  // Atomically increment views count
  await db().query(
    `update passport_shares set views_count = views_count + 1 where id = $1`,
    [share.id],
  ).catch(() => undefined);

  // Fetch student info
  const user = await one<{ name: string }>(
    `select name from users where id = $1 and status = 'active'`,
    [share.userId],
  );

  if (!user) {
    return null;
  }

  // Fetch career goal
  const goalRow = await one<{ role_name: string }>(
    `select role_name from career_goals where user_id = $1 and active = true order by created_at desc limit 1`,
    [share.userId],
  );
  const careerGoal = goalRow?.role_name || 'Software Engineer';

  // Fetch authoritative evidence items
  const evidenceRows = await db().query(
    `select e.id, s.slug as skill, e.source as kind, e.score::float as score, e.confidence::float as confidence, e.captured_at as at,
            coalesce(e.metadata->>'label', e.source || ' evidence') as label
     from user_skill_evidence e
     join skills s on s.id = e.skill_id
     where e.user_id = $1
     order by e.captured_at asc`,
    [share.userId],
  );

  const evidence: Evidence[] = evidenceRows.rows.map((r: any) => ({
    id: r.id,
    skill: r.skill,
    kind: r.kind,
    score: Number(r.score),
    confidence: Number(r.confidence),
    at: new Date(r.at).toISOString(),
    label: r.label,
  }));

  const computedSkills = skillStates(evidence);
  const readyScore = readiness(computedSkills);
  const verifiedCount = computedSkills.filter((s) => s.verified).length;

  const mappedSkills = share.includeSkills
    ? computedSkills.map((s) => ({
        id: s.def.id,
        name: s.def.name,
        score: s.score,
        target: s.def.target,
        verified: s.verified,
        evidenceCount: s.count,
        sources: s.kinds,
        status: s.status,
        statusLabel: s.statusLabel,
      }))
    : [];

  const recentEvidence = share.includeEvidence
    ? evidence.slice(-5).reverse().map((e) => {
        const found = computedSkills.find((s) => s.def.id === e.skill);
        return {
          skillName: found?.def.name || e.skill,
          source: e.kind,
          score: e.score,
          capturedAt: e.at,
        };
      })
    : [];

  // Authenticity fingerprint
  const authenticityHash = `SKP-${share.id.slice(0, 8).toUpperCase()}-${Math.abs(share.shareToken.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`;

  return {
    shareToken: share.shareToken,
    headline: share.customHeadline || 'Verified Skill Passport',
    studentName: share.includeName ? user.name : 'Verified SkillPilot Student',
    careerGoal,
    readiness: readyScore,
    verifiedCount,
    totalSkills: computedSkills.length,
    evidenceCount: evidence.length,
    skills: mappedSkills,
    recentEvidence,
    authenticityHash,
    verifiedAt: new Date().toISOString(),
  };
}
