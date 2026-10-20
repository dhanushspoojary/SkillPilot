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

/**
 * Check if all required server-side LiveKit credentials are configured.
 * Never expose LIVEKIT_API_SECRET to the client.
 */
export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
}

/**
 * Get the public WebRTC WebSocket server URL for client connection.
 */
export function getLiveKitServerUrl(): string {
  return process.env.LIVEKIT_URL || '';
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
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit credentials (LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are not configured.');
  }

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
