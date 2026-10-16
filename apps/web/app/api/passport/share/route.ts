import { requireUser } from '../../../../lib/auth';
import { requireOrigin, json } from '../../../../lib/server-security';
import { createOrGetPassportShare, revokePassportShare } from '../../../../lib/passport';
import { one } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireUser();
  const share = await one<{
    id: string;
    shareToken: string;
    customHeadline: string | null;
    includeName: boolean;
    includeSkills: boolean;
    includeEvidence: boolean;
    status: string;
    viewsCount: number;
    createdAt: string;
  }>(
    `select id, share_token as "shareToken", custom_headline as "customHeadline",
            include_name as "includeName", include_skills as "includeSkills", include_evidence as "includeEvidence",
            status, views_count as "viewsCount", created_at as "createdAt"
     from passport_shares
     where user_id = $1 and status = 'active'
     order by created_at desc limit 1`,
    [user.id],
  ).catch(() => null);

  return json({
    share: share ? { ...share, url: `/passport/${share.shareToken}` } : null,
  });
}

export async function POST(req: Request) {
  requireOrigin(req);
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));

  const share = await createOrGetPassportShare(user.id, {
    customHeadline: typeof body.customHeadline === 'string' ? body.customHeadline : undefined,
    includeName: typeof body.includeName === 'boolean' ? body.includeName : true,
    includeSkills: typeof body.includeSkills === 'boolean' ? body.includeSkills : true,
    includeEvidence: typeof body.includeEvidence === 'boolean' ? body.includeEvidence : true,
  });

  return json({ share }, 201);
}

export async function DELETE(req: Request) {
  requireOrigin(req);
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const shareToken = typeof body.shareToken === 'string' ? body.shareToken : '';

  if (!shareToken) {
    return json({ error: 'shareToken is required' }, 400);
  }

  const success = await revokePassportShare(user.id, shareToken);
  return json({ success, revoked: success });
}
