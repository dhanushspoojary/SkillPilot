import { retentionDays } from './config';

const INTERVAL_MS = 60 * 60_000;
let lastRun = 0;

/** Deletes data that has outlived its purpose. Safe to run repeatedly and from several instances. */
export async function runRetention(): Promise<Record<string, number>> {
  const { db } = await import('./db');
  const agentDays = retentionDays('AGENT', 90);
  const eventDays = retentionDays('EVENTS', 90);
  const q = async (sql: string, params: unknown[] = []) => (await db().query(sql, params)).rowCount ?? 0;
  return {
    mentor_chat_messages: await q(`delete from mentor_chat_messages where created_at < now() - make_interval(days=>$1)`, [agentDays]),
    mock_interviews: await q(`delete from mock_interviews where status in ('completed','abandoned') and coalesce(completed_at,started_at) < now() - make_interval(days=>$1)`, [agentDays]),
    agent_runs: await q(`delete from agent_runs where created_at < now() - make_interval(days=>$1)`, [agentDays]),
    security_events: await q(`delete from security_events where created_at < now() - make_interval(days=>$1)`, [eventDays]),
    sessions: await q(`delete from sessions where expires_at < now()`),
    email_tokens: await q(`delete from email_tokens where expires_at < now() - interval '7 days' or used_at < now() - interval '7 days'`),
    rate_limits: await q(`delete from rate_limits where updated_at < now() - interval '2 days'`),
  };
}

/** Opportunistic hourly cleanup so small deployments need no cron job. Never throws. */
export async function maybeRunRetention(now = Date.now()): Promise<void> {
  if (now - lastRun < INTERVAL_MS) return;
  lastRun = now;
  try { await runRetention(); } catch (e) { console.error('retention failed', e instanceof Error ? e.message : e); }
}
