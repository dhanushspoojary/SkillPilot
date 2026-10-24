import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMicrophoneError } from './microphone-permission.ts';

describe('Mobile Microphone Permission Diagnostic', () => {
  it('detects insecure context (HTTP)', () => {
    const diag = diagnoseMicrophoneError('not-allowed', false, false);
    assert.equal(diag.status, 'insecure');
    assert.match(diag.message, /HTTPS/);
  });

  it('provides actionable Android overlay guidance when not-allowed on Android', () => {
    const diag = diagnoseMicrophoneError('not-allowed', true, true);
    assert.equal(diag.status, 'denied');
    assert.match(diag.actionRequired!, /floating screen bubbles/);
    assert.match(diag.actionRequired!, /address bar/);
  });

  it('provides desktop address bar instructions when not-allowed on desktop', () => {
    const diag = diagnoseMicrophoneError('not-allowed', false, true);
    assert.equal(diag.status, 'denied');
    assert.match(diag.actionRequired!, /Always allow/);
  });

  it('handles device not found cleanly', () => {
    const diag = diagnoseMicrophoneError('devicesnotfound', false, true);
    assert.equal(diag.status, 'unsupported');
    assert.match(diag.message, /No microphone hardware/);
  });

  it('handles service-not-allowed with typing fallback', () => {
    const diag = diagnoseMicrophoneError('service-not-allowed', true, true);
    assert.equal(diag.status, 'denied');
    assert.match(diag.actionRequired!, /type your answer directly/);
  });
});
