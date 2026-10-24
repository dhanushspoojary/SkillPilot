import { currentUser } from '../../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import { submitExerciseAttempt } from '../../../../lib/practice-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const body = await readJsonBody<{ lessonId: string; exerciseId: string; chosenIndex?: number; selectedIndex?: number; hintsUsed?: number }>(req);
  if (!body) {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  const { lessonId, exerciseId, hintsUsed } = body;
  const chosenIndex = typeof body.chosenIndex === 'number' ? body.chosenIndex : body.selectedIndex;

  if (typeof lessonId !== 'string' || typeof exerciseId !== 'string' || typeof chosenIndex !== 'number') {
    return json({ error: 'Missing or invalid parameters (lessonId, exerciseId, chosenIndex)' }, 400);
  }

  try {
    const result = await submitExerciseAttempt({
      userId: u.id,
      lessonId,
      exerciseId,
      chosenIndex,
      hintsUsed: typeof hintsUsed === 'number' ? hintsUsed : 0,
    });

    return json({ result });
  } catch (err: any) {
    console.error('Error submitting practice attempt', err);
    return json({ error: err.message || 'Failed to submit attempt' }, 500);
  }
}
