import { currentUser } from '../../../../lib/auth';
import { many } from '../../../../lib/db';
import { json } from '../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await currentUser();
  if (!admin || admin.role !== 'admin') return json({ error: 'Admin required' }, 403);
  const reports = await many<any>(
    `select m.id,m.body,m.report_reason as reason,m.reported_at as "reportedAt",
            reporter.name as "reporterName", sender.name as "senderName", mr.id as "requestId"
     from mentor_chat_messages m
     join users sender on sender.id=m.sender_id
     left join users reporter on reporter.id=m.reported_by
     join mentor_requests mr on mr.id=m.request_id
     where m.reported_at is not null
     order by m.reported_at desc limit 100`,
  );
  return json({ reports });
}
