import { AccessToken } from 'livekit-server-sdk';

export interface LiveKitCallConfig {
  isConfigured: boolean;
  serverUrl?: string;
  roomName?: string;
  token?: string;
  identity?: string;
  name?: string;
  role?: 'student' | 'mentor';
  message?: string;
}

export interface LiveKitValidationResult {
  valid: boolean;
  reason?: string;
  code?: 'MISSING_ENV' | 'INVALID_URL' | 'MASKED_SECRET' | 'PLACEHOLDER' | 'SHORT_SECRET';
}

/**
 * Validates that LiveKit credentials are real, unmasked, and properly formatted.
 * Specifically detects if a secret was accidentally copied as masked bullet dots (•) from a browser UI.
 */
export function validateLiveKitConfig(): LiveKitValidationResult {
  const url = (process.env.LIVEKIT_URL || '').trim().replace(/^['"]|['"]$/g, '');
  const key = (process.env.LIVEKIT_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const secret = (process.env.LIVEKIT_API_SECRET || '').trim().replace(/^['"]|['"]$/g, '');

  if (!url || !key || !secret) {
    return {
      valid: false,
      code: 'MISSING_ENV',
      reason: 'LiveKit credentials (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are not fully configured in environment.',
    };
  }

  if (!/^(wss?|https?):\/\//i.test(url)) {
    return {
      valid: false,
      code: 'INVALID_URL',
      reason: 'LIVEKIT_URL must start with wss://, ws://, https://, or http://',
    };
  }

  if (url.includes('your-project') || url.includes('example.com') || url.includes('mock.invalid')) {
    return {
      valid: false,
      code: 'PLACEHOLDER',
      reason: 'LIVEKIT_URL contains placeholder domain text.',
    };
  }

  const isMaskedDots = (val: string) => {
    return (
      val.includes('\u2022') || // Bullet •
      val.includes('\u25CF') || // Black circle ●
      val.includes('•••') ||
      /^[•●\*]+$/.test(val)
    );
  };

  const isPlaceholderText = (val: string) => {
    return /^(placeholder|your_|test_secret|none$)/i.test(val);
  };

  if (isMaskedDots(key) || isPlaceholderText(key)) {
    return {
      valid: false,
      code: 'PLACEHOLDER',
      reason: 'LIVEKIT_API_KEY appears to contain masked dots or placeholder text.',
    };
  }

  if (isMaskedDots(secret)) {
    return {
      valid: false,
      code: 'MASKED_SECRET',
      reason: 'LIVEKIT_API_SECRET contains masked bullet dots (•) copied from a password field. Please reveal or copy the plaintext API secret from your LiveKit Cloud dashboard.',
    };
  }

  if (isPlaceholderText(secret)) {
    return {
      valid: false,
      code: 'PLACEHOLDER',
      reason: 'LIVEKIT_API_SECRET is set to placeholder text.',
    };
  }

  if (secret.length < 16) {
    return {
      valid: false,
      code: 'SHORT_SECRET',
      reason: 'LIVEKIT_API_SECRET must be at least 16 characters long.',
    };
  }

  return { valid: true };
}

/**
 * Check if all required server-side LiveKit credentials are valid and unmasked.
 * Never expose LIVEKIT_API_SECRET to the client.
 */
export function isLiveKitConfigured(): boolean {
  return validateLiveKitConfig().valid;
}

/**
 * Get the public WebRTC WebSocket server URL for client connection.
 */
export function getLiveKitServerUrl(): string {
  return (process.env.LIVEKIT_URL || '').trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Deterministically derive room names server-side.
 * Clients are NEVER allowed to choose or supply arbitrary room identifiers.
 */
export function deriveLiveKitRoomName(requestId: string): string {
  return `mentor-call-${requestId}`;
}

/**
 * Generate a short-lived, room-scoped LiveKit Access Token.
 * Tokens expire in 30 minutes by default and grant permissions only for the authorized room.
 */
export async function createLiveKitToken(params: {
  requestId: string;
  userId: string;
  userName: string;
  role: 'student' | 'mentor';
  ttlMinutes?: number;
}): Promise<string> {
  const validation = validateLiveKitConfig();
  if (!validation.valid) {
    throw new Error(`LiveKit is not configured properly: ${validation.reason}`);
  }

  const apiKey = (process.env.LIVEKIT_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim().replace(/^['"]|['"]$/g, '');

  const roomName = deriveLiveKitRoomName(params.requestId);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.userId,
    name: params.userName,
    ttl: `${params.ttlMinutes || 30}m`,
    metadata: JSON.stringify({
      role: params.role,
      requestId: params.requestId,
    }),
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await at.toJwt();
}
