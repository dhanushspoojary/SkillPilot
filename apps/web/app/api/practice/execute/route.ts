import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import { executeCodeSafely } from '../../../../lib/practice-arena-server';
import { type ProgrammingLanguage } from '../../../../lib/practice-arena';
import { currentUser } from '../../../../lib/auth';
import { dbRateLimit } from '../../../../lib/guard';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const user = await currentUser();
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!(await dbRateLimit(`practice-exec:${user.id}`, 30, 60000))) {
    return json({ error: 'Execution rate limit exceeded. Please wait a moment.' }, 429);
  }

  try {
    const body = await readJsonBody<{
      code: string;
      problemId: string;
      language: ProgrammingLanguage;
      isSubmission?: boolean;
      hintLevelUsed?: number;
    }>(req, 50000);

    const { code, problemId, language, isSubmission = false, hintLevelUsed = 0 } = body;

    if (!code || !problemId || !language) {
      return json({ error: 'Missing code, problemId, or language' }, 400);
    }

    const result = await executeCodeSafely(code, problemId, language, isSubmission);

    // Only record verified practice evidence when an isolated runner is actively available and tests pass
    if (isSubmission && result.success && result.isRunnerAvailable) {
      await db().query(
        `insert into student_practice_attempts(user_id, question_id, chosen_index, is_correct, hints_used, score_awarded)
         values($1, $2, 0, true, $3, $4)
         on conflict do nothing`,
        [user.id, `practice-${problemId}`, hintLevelUsed, Math.max(10, 35 - hintLevelUsed * 5)]
      ).catch(() => {});
    }

    return json({
      ok: true,
      result,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Execution error' }, 500);
  }
}
