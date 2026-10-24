import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validEmail,
  validPassword,
  passwordHash,
  passwordCheck,
  passwordCheckDummy,
  SESSION_COOKIE,
  requireUser,
  registerUser,
} from './auth.ts';
import { POST as forgotPost } from '../app/api/auth/forgot/route.ts';
import { POST as resendPost } from '../app/api/auth/resend-verification/route.ts';
import { POST as resetPost } from '../app/api/auth/reset/route.ts';
import { POST as verifyPost } from '../app/api/auth/verify/route.ts';
import { POST as signupPost } from '../app/api/auth/signup/route.ts';

test('validEmail validates standard email format and length', () => {
  assert.equal(validEmail('admin@example.com'), true);
  assert.equal(validEmail('poojarydhanush26@gmail.com'), true);
  assert.equal(validEmail('user.name+tag@domain.co.uk'), true);
  assert.equal(validEmail('invalid-email'), false);
  assert.equal(validEmail('@missinguser.com'), false);
  assert.equal(validEmail('missingdomain@'), false);
  assert.equal(validEmail(''), false);
  assert.equal(validEmail('a'.repeat(250) + '@example.com'), false);
});

test('validPassword enforces length between 12 and 72 UTF-8 bytes', () => {
  assert.equal(validPassword('short-pass'), false);
  assert.equal(validPassword('12345678901'), false); // 11 chars
  assert.equal(validPassword('123456789012'), true);  // 12 chars
  assert.equal(validPassword('a-very-strong-admin-password-16+'), true);
  assert.equal(validPassword('a'.repeat(72)), true);
  assert.equal(validPassword('a'.repeat(73)), false);
});

test('passwordCheck verifies bcrypt hashes and passwordCheckDummy safely rejects', async () => {
  const secret = 'my-secure-password-123';
  const hash = await passwordHash(secret);
  assert.equal(await passwordCheck(secret, hash), true);
  assert.equal(await passwordCheck('wrong-password-123', hash), false);
  assert.equal(await passwordCheckDummy(secret), false);
  assert.equal(await passwordCheckDummy('wrong-password-123'), false);
});

test('SESSION_COOKIE is standardized to skillpilot_session', () => {
  assert.equal(SESSION_COOKIE, 'skillpilot_session');
});

test('registerUser rejects invalid input before database transaction', async () => {
  await assert.rejects(() => registerUser('not-an-email', 'ValidPassword123!', 'Alice Student', 'student'), /invalid_email/);
  await assert.rejects(() => registerUser('alice@example.com', 'short', 'Alice Student', 'student'), /password_policy/);
  await assert.rejects(() => registerUser('alice@example.com', 'ValidPassword123!', 'A', 'student'), /invalid_name/);
});

test('requireUser rejects unauthenticated requests with 401 Response', async () => {
  try {
    await requireUser();
    assert.fail('should have thrown 401 Response');
  } catch (err: unknown) {
    assert.ok(err instanceof Response);
    assert.equal((err as Response).status, 401);
  }
});

test('password-reset and email-verification endpoints are safely disabled', async () => {
  const dummyReq = new Request('http://localhost:3000/api/auth/forgot', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  });

  const forgotRes = await forgotPost(dummyReq);
  assert.equal(forgotRes.status, 400);
  const forgotJson = await forgotRes.json();
  assert.match(forgotJson.error, /disabled/i);

  const resendRes = await resendPost(new Request('http://localhost:3000/api/auth/resend-verification', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  }));
  assert.equal(resendRes.status, 400);
  const resendJson = await resendRes.json();
  assert.match(resendJson.error, /no longer required/i);

  const resetRes = await resetPost(new Request('http://localhost:3000/api/auth/reset', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  }));
  assert.equal(resetRes.status, 400);
  const resetJson = await resetRes.json();
  assert.match(resetJson.error, /disabled/i);

  const verifyRes = await verifyPost(new Request('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  }));
  assert.equal(verifyRes.status, 200);
  const verifyJson = await verifyRes.json();
  assert.match(verifyJson.message, /no longer required/i);
});

test('signup endpoint rejects malformed input with 400', async () => {
  const req = new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'bad-email', password: 'short', name: '' }),
  });

  const res = await signupPost(req);
  assert.equal(res.status, 400);
});
