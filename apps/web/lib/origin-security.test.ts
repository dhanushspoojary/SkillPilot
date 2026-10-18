import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireOrigin } from './server-security.ts';
import { originOk } from './guard.ts';

describe('Origin Validation & CSRF Protection', () => {
  const originalEnv = { ...process.env };

  test('originOk correctly handles trailing slashes and port normalizations', () => {
    (process.env as any).NODE_ENV = 'development';
    assert.strictEqual(originOk('POST', 'http://localhost:3000', 'http://localhost:3000/'), true);
    assert.strictEqual(originOk('POST', 'http://127.0.0.1:3000', 'http://localhost:3000'), true);
    assert.strictEqual(originOk('POST', 'http://localhost:3000', 'http://localhost:3000'), true);
    assert.strictEqual(originOk('POST', 'https://attacker.com', 'http://localhost:3000'), false);
  });

  test('requireOrigin permits legitimate same-origin requests matching configured origin', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'development';

    const req = new Request('http://localhost:3000/api/assess/start', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });

    assert.strictEqual(requireOrigin(req), true);
  });

  test('requireOrigin permits legitimate same-origin requests matching host header', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'development';

    // Student visits via 127.0.0.1:3000
    const req127 = new Request('http://127.0.0.1:3000/api/assess/start', {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3000',
        host: '127.0.0.1:3000',
      },
    });
    assert.strictEqual(requireOrigin(req127), true);

    // Student visits via LAN IP 192.168.1.102:3000
    const reqLAN = new Request('http://192.168.1.102:3000/api/assess/start', {
      method: 'POST',
      headers: {
        origin: 'http://192.168.1.102:3000',
        host: '192.168.1.102:3000',
      },
    });
    assert.strictEqual(requireOrigin(reqLAN), true);
  });

  test('requireOrigin blocks unauthorized cross-origin requests', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'development';

    const evilReq = new Request('http://localhost:3000/api/assess/start', {
      method: 'POST',
      headers: {
        origin: 'https://evil-attacker.example.com',
        host: 'localhost:3000',
      },
    });

    assert.strictEqual(requireOrigin(evilReq), false);
  });

  test('requireOrigin blocks requests with sec-fetch-site: cross-site', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'development';

    const crossSiteReq = new Request('http://localhost:3000/api/assess/start', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'sec-fetch-site': 'cross-site',
      },
    });

    assert.strictEqual(requireOrigin(crossSiteReq), false);
  });

  test('requireOrigin allows missing origin header when sec-fetch-site is same-origin', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'production';

    const sameOriginFetch = new Request('http://localhost:3000/api/assess/start', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        'sec-fetch-site': 'same-origin',
      },
    });

    assert.strictEqual(requireOrigin(sameOriginFetch), true);
  });

  test('requireOrigin allows same-origin referer when origin header is missing', () => {
    process.env.SKILLPILOT_ALLOWED_ORIGIN = 'http://localhost:3000';
    (process.env as any).NODE_ENV = 'production';

    const refererReq = new Request('http://localhost:3000/api/assess/start', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        referer: 'http://localhost:3000/assess',
      },
    });

    assert.strictEqual(requireOrigin(refererReq), true);
  });

  // Restore env
  process.env = originalEnv;
});
