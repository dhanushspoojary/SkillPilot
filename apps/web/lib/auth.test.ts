import test from 'node:test';
import assert from 'node:assert/strict';
import { validEmail, validPassword, passwordHash, passwordCheck, passwordCheckDummy } from './auth.ts';

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
