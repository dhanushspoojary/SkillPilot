import { currentUser } from '../../../../lib/auth';
import { json } from '../../../../lib/server-security';
import { determineNextAction } from '../../../../lib/next-action-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const nextAction = await determineNextAction(u.id);
    return json({ nextAction });
  } catch (err: any) {
    console.error('Error determining next action', err);
    return json({ error: 'Failed to determine next action' }, 500);
  }
}
