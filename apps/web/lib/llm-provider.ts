import { GoogleGenAI } from '@google/genai';

/**
 * Prompt version metadata for all AI-generated artifacts and audits.
 */
export const PROMPT_VERSION = 'v2.4.0-gemini';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolParameterSchema {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: Record<string, unknown>;
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text?: string;
  toolCalls?: ToolCall[];
  model: string;
  provider: string;
  promptVersion: string;
  tokensUsed?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

export interface LLMRequestOptions {
  tier?: 'fast' | 'strong';
  tools?: ToolDefinition[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LLMProvider {
  name: string;
  generateResponse(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse>;
  generateText(prompt: string, options?: LLMRequestOptions): Promise<string>;
}

export class LLMRateLimitError extends Error {
  public status = 429;
  constructor(message: string) {
    super(message);
    this.name = 'LLMRateLimitError';
  }
}

/**
 * Redacts API keys and auth tokens from logs and outputs.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/(?:AIza[0-9A-Za-z\-_]{20,})/g, '[GEMINI_KEY_REDACTED]')
    .replace(/(?:sk-ant-[0-9A-Za-z\-_]{20,})/g, '[ANTHROPIC_KEY_REDACTED]')
    .replace(/(?:sk-[0-9A-Za-z\-_]{20,})/g, '[OPENAI_KEY_REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-_\.]+/gi, 'Bearer [TOKEN_REDACTED]')
    .replace(/password\s*[:=]\s*["']?[^"'\s,]+["']?/gi, 'password=[REDACTED]');
}

/**
 * PII minimization: strips real personal identifiers before dispatching context to LLM providers.
 */
export function sanitizePII(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[STUDENT_EMAIL]')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE_NUMBER]')
    .replace(/\b(?:password|passwd|pwd)\b[:=]\s*\S+/gi, 'password=[REDACTED]');
}

/**
 * Server-side kill switch and tool guard checks.
 */
export function isAgentEnabled(): boolean {
  return process.env.SKILLPILOT_AGENT_ENABLED !== 'false';
}

export function isToolDisabled(toolName: string): boolean {
  const disabledStr = process.env.SKILLPILOT_DISABLED_TOOLS || '';
  const disabledList = disabledStr.split(',').map((t) => t.trim().toLowerCase());
  return disabledList.includes(toolName.toLowerCase());
}

/**
 * Exponential backoff with jitter helper for resilient network calls.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1200,
  signal?: AbortSignal,
): Promise<T> {
  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw new Error('aborted');
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.includes('RESOURCE_EXHAUSTED') ||
          err.message.includes('quota') ||
          err.message.includes('rate'));

      const isTransient =
        err instanceof Error &&
        (isRateLimit ||
          err.message.includes('503') ||
          err.message.includes('500') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('network'));

      if (attempt >= maxRetries || !isTransient) {
        if (isRateLimit) {
          throw new LLMRateLimitError(
            'Google Gemini capacity temporarily reached. Operating in verified deterministic fallback mode without losing your progress.',
          );
        }
        throw err;
      }

      const jitter = Math.random() * 400;
      const delay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Google Gemini Provider Adapter using official @google/genai SDK.
 */
export class GeminiProviderAdapter implements LLMProvider {
  public name = 'gemini';
  private client: GoogleGenAI;
  private fastModel: string;
  private strongModel: string;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.fastModel = process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash';
    this.strongModel = process.env.GEMINI_MODEL_STRONG || 'gemini-2.5-flash';
  }

  public getModelName(tier: 'fast' | 'strong' = 'strong'): string {
    return tier === 'fast' ? this.fastModel : this.strongModel;
  }

  public async generateResponse(
    messages: LLMMessage[],
    options: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const tier = options.tier || 'strong';
    const model = this.getModelName(tier);

    // Sanitize message content to preserve student privacy
    const sanitizedMessages = messages.map((m) => ({
      role: m.role,
      content: sanitizePII(m.content),
    }));

    // Convert tool definitions to Gemini functionDeclarations format
    const geminiTools =
      options.tools && options.tools.length > 0
        ? [
            {
              functionDeclarations: options.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
              })),
            },
          ]
        : undefined;

    // Convert chat history to Gemini contents format
    const contents = sanitizedMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const systemInstruction = options.systemPrompt ? sanitizePII(options.systemPrompt) : undefined;

    const response = await retryWithBackoff(
      async () => {
        return await this.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            tools: geminiTools as any,
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 1000,
          },
        });
      },
      3,
      1200,
      options.signal,
    );

    // Extract tool calls and text response
    const toolCalls: ToolCall[] = [];
    let text = '';

    const functionCalls = response.functionCalls ? response.functionCalls : [];
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        toolCalls.push({
          id: `gemini-call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: fc.name || 'unnamed_tool',
          input: (fc.args || {}) as Record<string, unknown>,
        });
      }
    }

    if (response.text) {
      text = response.text.trim();
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model,
      provider: 'gemini',
      promptVersion: PROMPT_VERSION,
      tokensUsed: {
        total: response.usageMetadata?.totalTokenCount,
        prompt: response.usageMetadata?.promptTokenCount,
        completion: response.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  public async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    const res = await this.generateResponse(
      [{ role: 'user', content: prompt }],
      options,
    );
    return res.text || '';
  }
}

/**
 * Anthropic Provider Adapter (Secondary adapter for multi-provider support).
 */
export class AnthropicProviderAdapter implements LLMProvider {
  public name = 'anthropic';
  private apiKey: string;
  private fastModel: string;
  private strongModel: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.fastModel = process.env.ANTHROPIC_MODEL_FAST || 'claude-3-5-haiku-20241022';
    this.strongModel = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
  }

  public async generateResponse(
    messages: LLMMessage[],
    options: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const tier = options.tier || 'strong';
    const model = tier === 'fast' ? this.fastModel : this.strongModel;
    const sanitized = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizePII(m.content),
    }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: options.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1000,
        system: options.systemPrompt ? sanitizePII(options.systemPrompt) : undefined,
        tools: options.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
        messages: sanitized,
      }),
    });

    if (!res.ok) throw new Error(`anthropic_${res.status}`);
    const data = await res.json();
    const toolCalls: ToolCall[] = [];
    let text = '';

    for (const part of data.content || []) {
      if (part.type === 'text') text += part.text;
      if (part.type === 'tool_use') {
        toolCalls.push({
          id: part.id,
          name: part.name,
          input: part.input || {},
        });
      }
    }

    return {
      text: text.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model,
      provider: 'anthropic',
      promptVersion: PROMPT_VERSION,
      tokensUsed: {
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        prompt: data.usage?.input_tokens,
        completion: data.usage?.output_tokens,
      },
    };
  }

  public async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    const res = await this.generateResponse([{ role: 'user', content: prompt }], options);
    return res.text || '';
  }
}

/**
 * Factory to retrieve the configured active LLM provider.
 * Follows provider priority:
 * 1. Google Gemini via GEMINI_API_KEY (Primary per directive)
 * 2. Anthropic via ANTHROPIC_API_KEY (Secondary adapter)
 * 3. Null (Deterministic fallback mode)
 */
export function getActiveLLMProvider(): {
  provider: LLMProvider | null;
  providerName: string;
  isReal: boolean;
  fastModel: string;
  strongModel: string;
} {
  if (!isAgentEnabled()) {
    return {
      provider: null,
      providerName: 'disabled',
      isReal: false,
      fastModel: 'none',
      strongModel: 'none',
    };
  }

  // 1. Google Gemini (Primary)
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const fastModel = process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash';
    const strongModel = process.env.GEMINI_MODEL_STRONG || 'gemini-2.5-flash';
    return {
      provider: new GeminiProviderAdapter(geminiKey),
      providerName: 'gemini',
      isReal: true,
      fastModel,
      strongModel,
    };
  }

  // 2. Anthropic (Secondary adapter)
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    const fastModel = process.env.ANTHROPIC_MODEL_FAST || 'claude-3-5-haiku-20241022';
    const strongModel = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
    return {
      provider: new AnthropicProviderAdapter(anthropicKey),
      providerName: 'anthropic',
      isReal: true,
      fastModel,
      strongModel,
    };
  }

  // 3. Fallback
  return {
    provider: null,
    providerName: 'deterministic',
    isReal: false,
    fastModel: 'deterministic-fast',
    strongModel: 'deterministic-strong',
  };
}
