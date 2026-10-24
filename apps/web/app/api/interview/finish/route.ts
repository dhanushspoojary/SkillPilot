import { currentUser } from '../../../../lib/auth';
import { many, one, tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, isUuid } from '../../../../lib/server-security';
import { SKILLS } from '../../../../lib/questions';
import { buildScoringUserMessage, fallbackScore, parseScores, PRACTICE_CONFIDENCE_AI, PRACTICE_CONFIDENCE_FALLBACK, SCORING_SYSTEM, INTERVIEW_QUESTION_COUNT, INTERVIEW_MAX_SCORING_CHARS } from '../../../../lib/interview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u || u.role !== 'student') return json({ error: 'Student account required' }, 401);
  if (!(await dbRateLimit(`interview-finish:${u.id}`, 12, 3600000))) return json({ error: 'Too many scoring requests this hour.' }, 429);

  try {
    const b = await readJsonBody<any>(req, 10000);
    const interviewId = typeof b.interviewId === 'string' ? b.interviewId : null;
    if (!isUuid(interviewId)) return json({ error: 'Valid interview id required' }, 400);

    const owned = await one<any>(
      `update mock_interviews set status='scoring',updated_at=now() where id=$1 and user_id=$2 and (status='started' or (status='scoring' and updated_at < now()-interval '2 minutes')) returning id,skill_slug`,
      [interviewId, u.id],
    );
    if (!owned) return json({ error: 'Interview not found or already scored' }, 409);

    const rows = await many<any>(`select position,prompt,transcript,latency_ms as "latencyMs" from mock_interview_questions where interview_id=$1 order by position`, [interviewId]);
    if (rows.length !== INTERVIEW_QUESTION_COUNT || rows.some((r) => !r.transcript)) {
      await one(`update mock_interviews set status='started',updated_at=now() where id=$1 and user_id=$2 and status='scoring'`, [interviewId, u.id]);
      return json({ error: 'Answer every question before finishing' }, 409);
    }

    const totalTranscriptChars = rows.reduce((sum, r) => sum + String(r.transcript).length, 0);
    if (totalTranscriptChars > INTERVIEW_MAX_SCORING_CHARS) {
      await one(`update mock_interviews set status='started',updated_at=now() where id=$1 and user_id=$2 and status='scoring'`, [interviewId, u.id]);
      return json({ error: 'Interview answers are too large to score safely. Shorten the answers and try again.' }, 413);
    }

    const skillName = SKILLS.find((s) => s.id === owned.skill_slug)?.name ?? owned.skill_slug;
    let mode: 'ai' | 'fallback' = 'fallback';
    let model: string | null = null;
    let scores: { position: number; score: number; feedback: string }[] | null = null;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      mode = 'ai';
      model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 30000);
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model, max_tokens: 1200, system: SCORING_SYSTEM, messages: [{ role: 'user', content: buildScoringUserMessage(skillName, rows) }] }),
          });
          if (!res.ok) throw new Error(`provider_${res.status}`);
          const parsed: any = await res.json();
          const text = (parsed.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
          scores = parseScores(text, rows.length);
        } finally { clearTimeout(timer); }
      } catch { scores = null; }
      if (!scores) mode = 'fallback';
    }

    if (!scores) scores = rows.map((r) => ({ position: r.position, ...fallbackScore(r.transcript) }));
    const confidence = mode === 'ai' ? PRACTICE_CONFIDENCE_AI : PRACTICE_CONFIDENCE_FALLBACK;
    const avg = Math.round(rows.reduce((sum, r, i) => sum + scores![i].score, 0) / rows.length);

    const result = await tx(async (c) => {
      for (const s of scores!) {
        await c.query(`update mock_interview_questions set score=$1,feedback=$2 where interview_id=$3 and position=$4`, [s.score, s.feedback, interviewId, s.position]);
      }
      await c.query(`update mock_interviews set status='completed',mode=$1,model=$2,server_score=$3,completed_at=now(),updated_at=now() where id=$4 and user_id=$5`, [mode, model, avg, interviewId, u.id]);
      const skillRow = await c.query('select id from skills where slug=$1', [owned.skill_slug]);
      await c.query(
        `insert into user_skill_evidence(user_id,skill_id,source,score,confidence,metadata)
         values($1,$2,'practice',$3,$4,$5)`,
        [u.id, skillRow.rows[0].id, avg, confidence, JSON.stringify({ label: mode === 'ai' ? 'AI-scored voice mock interview' : 'Offline voice mock interview score', interviewId, mode })],
      );
      return { avg, mode };
    });

    const questions = await many<any>(`select position,prompt,transcript,score,feedback from mock_interview_questions where interview_id=$1 order by position`, [interviewId]);
    return json({ interview: { id: interviewId, skill: owned.skill_slug, score: result.avg, mode: result.mode, model, confidence, questions } });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not score interview' }, 500);
  }
}
