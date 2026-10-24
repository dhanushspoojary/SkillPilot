import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationRequired, retentionDays, assertProductionConfig } from './config.ts';
import { hashSecret } from './hash-secret.ts';
import { sendMail } from './mailer.ts';
import { hashEmailToken } from './token-hash.ts';
function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
    const old: Record<string, string | undefined> = {};
    for (const k of Object.keys(vars)) {
        old[k] = process.env[k];
        if (vars[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = vars[k];
    }
    const restore = () => {
        for (const k of Object.keys(old)) {
            if (old[k] === undefined)
                delete process.env[k];
            else
                process.env[k] = old[k];
        }
    };
    try {
        const r = fn();
        if (r instanceof Promise)
            return r.finally(restore);
        restore();
        return r;
    }
    catch (e) {
        restore();
        throw e;
    }
}
test('verification is disabled across all environments', () => {
    withEnv({ SKILLPILOT_REQUIRE_EMAIL_VERIFICATION: undefined, NODE_ENV: 'production' }, () => assert.equal(verificationRequired(), false));
    withEnv({ SKILLPILOT_REQUIRE_EMAIL_VERIFICATION: 'true', NODE_ENV: 'development' }, () => assert.equal(verificationRequired(), false));
    withEnv({ SKILLPILOT_REQUIRE_EMAIL_VERIFICATION: 'false', NODE_ENV: 'production' }, () => assert.equal(verificationRequired(), false));
});
test('production refuses to run without a real hash secret', () => {
    withEnv({ NODE_ENV: 'production', SKILLPILOT_HASH_SECRET: undefined, NEXT_PHASE: undefined }, () => assert.throws(() => hashSecret(), /SKILLPILOT_HASH_SECRET/));
    withEnv({ NODE_ENV: 'production', SKILLPILOT_HASH_SECRET: 'short', NEXT_PHASE: undefined }, () => assert.throws(() => hashSecret()));
    withEnv({ NODE_ENV: 'production', SKILLPILOT_HASH_SECRET: 'x'.repeat(32) }, () => assert.equal(hashSecret(), 'x'.repeat(32)));
    withEnv({ NODE_ENV: 'development', SKILLPILOT_HASH_SECRET: undefined }, () => assert.ok(hashSecret()));
});
test('retention days fall back for missing or invalid values', () => {
    withEnv({ SKILLPILOT_RETENTION_AGENT_DAYS: undefined }, () => assert.equal(retentionDays('AGENT', 90), 90));
    withEnv({ SKILLPILOT_RETENTION_AGENT_DAYS: '0' }, () => assert.equal(retentionDays('AGENT', 90), 90));
    withEnv({ SKILLPILOT_RETENTION_AGENT_DAYS: '30' }, () => assert.equal(retentionDays('AGENT', 90), 30));
});
test('mailer posts to the provider and reports failures without throwing', async () => {
    await withEnv({ RESEND_API_KEY: 'key', MAIL_FROM: 'SkillPilot <no-reply@example.com>' }, async () => {
        let seen: any;
        const ok = await sendMail({ to: 'a@b.c', subject: 's', text: 't' }, (async (url: any, init: any) => { seen = { url, init }; return new Response('{}', { status: 200 }); }) as any);
        assert.equal(ok, true);
        assert.equal(seen.url, 'https://api.resend.com/emails');
        assert.equal(seen.init.headers.authorization, 'Bearer key');
        assert.deepEqual(JSON.parse(seen.init.body).to, ['a@b.c']);
        assert.equal(await sendMail({ to: 'a@b.c', subject: 's', text: 't' }, (async () => new Response('no', { status: 500 })) as any), false);
        assert.equal(await sendMail({ to: 'a@b.c', subject: 's', text: 't' }, (async () => { throw new Error('down'); }) as any), false);
    });
});
test('email tokens are stored only as SHA-256 hashes', () => {
    const h = hashEmailToken('abc');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.notEqual(h, 'abc');
    assert.equal(h, hashEmailToken('abc'));
});

test('production configuration fails closed when public security requirements are missing', () => {
    withEnv({ NODE_ENV: 'production', SKILLPILOT_ALLOWED_ORIGIN: 'http://example.com', SKILLPILOT_SECURE_COOKIES: 'true' }, () => assert.throws(() => assertProductionConfig(), /HTTPS/));
    withEnv({ NODE_ENV: 'production', SKILLPILOT_ALLOWED_ORIGIN: 'https://example.com', SKILLPILOT_SECURE_COOKIES: 'false' }, () => assert.throws(() => assertProductionConfig(), /Secure cookies/));
    withEnv({ NODE_ENV: 'production', SKILLPILOT_ALLOWED_ORIGIN: 'https://example.com', SKILLPILOT_SECURE_COOKIES: 'true', RESEND_API_KEY: undefined, MAIL_FROM: undefined }, () => assert.doesNotThrow(() => assertProductionConfig()));
});
