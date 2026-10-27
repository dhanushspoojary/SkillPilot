import { currentUser } from '../../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import {
  listStudentMemories,
  addStudentMemory,
  deleteStudentMemory,
  updateStudentMemory,
  type MemoryCategory,
} from '../../../../lib/student-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const memories = await listStudentMemories(u.id);
  return json({ memories });
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'preference',
  'strength',
  'goal',
  'struggle',
  'background',
  'project_interest',
]);

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 10000);
    const rawCategory = body?.category || 'preference';
    if (!VALID_CATEGORIES.has(rawCategory)) {
      return json(
        {
          error:
            'Invalid category. Allowed: preference, strength, goal, struggle, background, project_interest',
        },
        400
      );
    }
    const category = rawCategory as MemoryCategory;
    const fact = typeof body?.fact === 'string' ? body.fact.trim() : '';

    if (!fact) {
      return json({ error: 'fact is required' }, 400);
    }
    if (fact.length > 500) {
      return json({ error: 'fact must not exceed 500 characters' }, 400);
    }

    const memory = await addStudentMemory(u.id, category, fact, 'student_input');
    const memories = await listStudentMemories(u.id);

    return json({ ok: true, memory, memories }, 201);
  } catch (err) {
    console.error('memories POST error', err);
    return json({ error: 'Could not save memory' }, 500);
  }
}

export async function DELETE(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const url = new URL(req.url);
    const queryId = url.searchParams.get('id') || url.searchParams.get('memoryId');
    let bodyId = '';
    try {
      const body = await readJsonBody<any>(req, 10000);
      bodyId = body?.memoryId || body?.id || '';
    } catch {
      // Empty body is allowed when query param is provided
    }

    const memoryId = queryId || bodyId;
    if (!memoryId) {
      return json({ error: 'memoryId is required' }, 400);
    }

    const deleted = await deleteStudentMemory(u.id, memoryId);
    if (!deleted) {
      return json({ error: 'Memory not found or not owned by user' }, 404);
    }
    const memories = await listStudentMemories(u.id);

    return json({ ok: true, deleted, memories });
  } catch (err) {
    console.error('memories DELETE error', err);
    return json({ error: 'Could not delete memory' }, 500);
  }
}

export async function PATCH(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 10000);
    const memoryId = typeof body?.id === 'string' ? body.id : typeof body?.memoryId === 'string' ? body.memoryId : '';
    const fact = typeof body?.fact === 'string' ? body.fact.trim() : '';

    if (!memoryId || !fact) {
      return json({ error: 'memoryId and fact are required' }, 400);
    }

    const updated = await updateStudentMemory(u.id, memoryId, fact);
    if (!updated) {
      return json({ error: 'Memory not found or not owned by user' }, 404);
    }

    const memories = await listStudentMemories(u.id);
    return json({ ok: true, updated, memories });
  } catch (err) {
    console.error('memories PATCH error', err);
    return json({ error: 'Could not update memory' }, 500);
  }
}
