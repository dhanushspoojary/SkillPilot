// Deletes expired or outdated rows. Run from cron/systemd for busy deployments;
// small ones are also cleaned opportunistically by the web app once per hour.
import pg from 'pg';

const days = (name, fallback) => { const n = Number(process.env[name]); return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback; };
const agentDays = days('SKILLPILOT_RETENTION_AGENT_DAYS', 90);
const eventDays = days('SKILLPILOT_RETENTION_EVENTS_DAYS', 90);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, password: process.env.PGPASSWORD || undefined });
try {
  const run = async (label, sql, params = []) => console.log(`${label}: ${(await pool.query(sql, params)).rowCount} deleted`);
  await run('mentor_chat_messages', 'delete from mentor_chat_messages where created_at < now() - make_interval(days=>$1)', [agentDays]);
  await run('mock_interviews', "delete from mock_interviews where status in ('completed','abandoned') and coalesce(completed_at,started_at) < now() - make_interval(days=>$1)", [agentDays]);
  await run('agent_runs', 'delete from agent_runs where created_at < now() - make_interval(days=>$1)', [agentDays]);
  await run('security_events', 'delete from security_events where created_at < now() - make_interval(days=>$1)', [eventDays]);
  await run('sessions', 'delete from sessions where expires_at < now()');
  await run('email_tokens', "delete from email_tokens where expires_at < now() - interval '7 days' or used_at < now() - interval '7 days'");
  await run('rate_limits', "delete from rate_limits where updated_at < now() - interval '2 days'");
} finally { await pool.end(); }
