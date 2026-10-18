import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSecrets,
  sanitizePII,
  isAgentEnabled,
  isToolDisabled,
  getActiveLLMProvider,
  GeminiProviderAdapter,
  AnthropicProviderAdapter,
  PROMPT_VERSION,
} from './llm-provider.ts';

test('llm-provider: redactSecrets removes sensitive API keys and authorization tokens', () => {
  const sample =
    'Connecting with key AIzaSyDdummy123456789012345678901234 and sk-ant-api03-abcdefghijklmnop123456789 and Bearer secret_token_value';
  const redacted = redactSecrets(sample);

  assert.ok(!redacted.includes('AIzaSyDdummy'));
  assert.ok(!redacted.includes('sk-ant-api03'));
  assert.ok(!redacted.includes('secret_token_value'));
  assert.ok(redacted.includes('[GEMINI_KEY_REDACTED]'));
  assert.ok(redacted.includes('[ANTHROPIC_KEY_REDACTED]'));
  assert.ok(redacted.includes('Bearer [TOKEN_REDACTED]'));
});

test('llm-provider: sanitizePII strips student emails, phone numbers, and credentials', () => {
  const text =
    'Student Alice (alice.student@university.edu, phone: 415-555-1234) asks about password=MySecretPassword123.';
  const sanitized = sanitizePII(text);

  assert.ok(!sanitized.includes('alice.student@university.edu'));
  assert.ok(!sanitized.includes('415-555-1234'));
  assert.ok(!sanitized.includes('MySecretPassword123'));
  assert.ok(sanitized.includes('[STUDENT_EMAIL]'));
  assert.ok(sanitized.includes('[PHONE_NUMBER]'));
  assert.ok(sanitized.includes('password=[REDACTED]'));
});

test('llm-provider: kill switch flags disable agent or specific tools on demand', () => {
  const originalEnabled = process.env.SKILLPILOT_AGENT_ENABLED;
  const originalDisabledTools = process.env.SKILLPILOT_DISABLED_TOOLS;

  try {
    process.env.SKILLPILOT_AGENT_ENABLED = 'false';
    assert.equal(isAgentEnabled(), false);

    process.env.SKILLPILOT_AGENT_ENABLED = 'true';
    assert.equal(isAgentEnabled(), true);

    process.env.SKILLPILOT_DISABLED_TOOLS = 'dangerous_action,send_mentor_request';
    assert.equal(isToolDisabled('dangerous_action'), true);
    assert.equal(isToolDisabled('send_mentor_request'), true);
    assert.equal(isToolDisabled('get_profile'), false);
  } finally {
    process.env.SKILLPILOT_AGENT_ENABLED = originalEnabled;
    process.env.SKILLPILOT_DISABLED_TOOLS = originalDisabledTools;
  }
});

test('llm-provider: getActiveLLMProvider selects Gemini as primary when GEMINI_API_KEY is configured', () => {
  const origGemini = process.env.GEMINI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;

  try {
    // 1. Without keys -> deterministic
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const fallback = getActiveLLMProvider();
    assert.equal(fallback.isReal, false);
    assert.equal(fallback.providerName, 'deterministic');

    // 2. With Gemini -> primary provider
    process.env.GEMINI_API_KEY = 'AIzaSyTestKey123456789012345678901234';
    const gemini = getActiveLLMProvider();
    assert.equal(gemini.isReal, true);
    assert.equal(gemini.providerName, 'gemini');
    assert.ok(gemini.fastModel.includes('flash'));
    assert.ok(gemini.strongModel.includes('flash'));

    // 3. With both Gemini and Anthropic -> Gemini takes priority per user prompt
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const priorityCheck = getActiveLLMProvider();
    assert.equal(priorityCheck.providerName, 'gemini');

    // 4. With only Anthropic -> Anthropic secondary adapter
    delete process.env.GEMINI_API_KEY;
    const anthropic = getActiveLLMProvider();
    assert.equal(anthropic.isReal, true);
    assert.equal(anthropic.providerName, 'anthropic');
  } finally {
    process.env.GEMINI_API_KEY = origGemini;
    process.env.ANTHROPIC_API_KEY = origAnthropic;
  }
});

test('llm-provider: prompt metadata version is formatted correctly', () => {
  assert.ok(PROMPT_VERSION.startsWith('v2.'));
  assert.ok(PROMPT_VERSION.includes('gemini'));
});
