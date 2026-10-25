import { currentUser } from '../../../lib/auth';
import { dbRateLimit } from '../../../lib/guard';
import { json, requireOrigin, readJsonBody } from '../../../lib/server-security';
import {
  PROJECT_CATALOG,
  getOrStartStudentProject,
  evaluateProjectSubmission,
} from '../../../lib/project-workspace';
import { many } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');

  if (slug) {
    const catalogItem = PROJECT_CATALOG.find((p) => p.slug === slug);
    if (!catalogItem) {
      return json({ error: 'Project not found in catalog' }, 404);
    }
    const project = await getOrStartStudentProject(u.id, slug);
    return json({
      catalog: PROJECT_CATALOG,
      project,
      studentProject: project,
      catalogItem,
    });
  }

  // Return catalog with student status summary
  const studentProjects = await many<{
    slug: string;
    status: string;
    verified_at: string | null;
  }>(
    `select slug, status, verified_at from student_projects where user_id = $1`,
    [u.id],
  ).catch(() => []);

  const projectsWithStatus = PROJECT_CATALOG.map((cat) => {
    const sp = studentProjects.find((s) => s.slug === cat.slug);
    return {
      ...cat,
      studentStatus: sp?.status || 'not_started',
      verifiedAt: sp?.verified_at ? new Date(sp.verified_at).toISOString() : null,
    };
  });

  return json({
    catalog: projectsWithStatus,
  });
}

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  if (!(await dbRateLimit(`project-eval:${u.id}`, 20, 10 * 60000))) {
    return json({ error: 'Too many project evaluations. Slow down.' }, 429);
  }

  try {
    const body = await readJsonBody<any>(req, 50000);
    const slug = typeof body?.slug === 'string' ? body.slug : '';
    const code = typeof body?.code === 'string'
      ? body.code
      : typeof body?.submissionCode === 'string'
      ? body.submissionCode
      : '';

    if (!slug || !code.trim()) {
      return json({ error: 'slug and code are required' }, 400);
    }

    const catalogItem = PROJECT_CATALOG.find((p) => p.slug === slug);
    if (!catalogItem) {
      return json({ error: 'Project not found in catalog' }, 404);
    }

    const evaluation = await evaluateProjectSubmission(u.id, slug, code);
    return json({
      ok: true,
      ...evaluation,
    });
  } catch (err) {
    console.error('projects POST error', err);
    return json({ error: 'Could not evaluate project submission' }, 500);
  }
}
