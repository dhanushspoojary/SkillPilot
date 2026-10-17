import { currentUser } from '../../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import {
  listStudentMemories,
  addStudentMemory,
  deleteStudentMemory,
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
    const category = (body?.category || 'preference') as MemoryCategory;
    const fact = typeof body?.fact === 'string' ? body.fact.trim() : '';

    if (!fact) {
      return json({ error: 'fact is required' }, 400);
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
    const memories = await listStudentMemories(u.id);

    return json({ ok: true, deleted, memories });
  } catch (err) {
    console.error('memories DELETE error', err);
    return json({ error: 'Could not delete memory' }, 500);
  }
}
