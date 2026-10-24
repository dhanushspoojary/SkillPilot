/**
 * Mobile & Desktop Microphone Permission Diagnostic and Guidance Helper
 * Provides actionable diagnosis for common mobile permission traps, including Android overlay blocks.
 */

export type MicDiagnostic = {
  status: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure';
  message: string;
  actionRequired?: string;
};

export function diagnoseMicrophoneError(
  errorCode: string,
  isAndroid: boolean = false,
  isSecure: boolean = true
): MicDiagnostic {
  if (!isSecure) {
    return {
      status: 'insecure',
      message: 'Microphone access requires a secure connection (HTTPS).',
      actionRequired: 'Ensure you are browsing over HTTPS or localhost.',
    };
  }

  const normalized = (errorCode || '').toLowerCase();

  if (normalized.includes('service-not-allowed')) {
    return {
      status: 'denied',
      message: 'Speech recognition service is disabled or blocked on this network.',
      actionRequired: 'You can type your answer directly in the text area below.',
    };
  }

  if (normalized.includes('not-allowed') || normalized.includes('notallowed') || normalized.includes('permission_denied')) {
    if (isAndroid) {
      return {
        status: 'denied',
        message: 'Microphone permission blocked by browser or system overlay.',
        actionRequired:
          '1. Close any floating screen bubbles (chat heads, screen recorders, overlay apps).\n2. Tap the lock/tune icon in the address bar -> Permissions -> Allow Microphone.\n3. Tap "Retry Microphone".',
      };
    }
    return {
      status: 'denied',
      message: 'Microphone access was denied in the browser.',
      actionRequired: 'Click the camera/mic icon in your address bar and select "Always allow".',
    };
  }

  if (normalized.includes('notfound') || normalized.includes('devicesnotfound')) {
    return {
      status: 'unsupported',
      message: 'No microphone hardware found on this device.',
      actionRequired: 'Connect a working microphone or headset, or type your answer below.',
    };
  }

  if (normalized.includes('audio-capture')) {
    return {
      status: 'unsupported',
      message: 'Microphone capture failed or audio device is currently in use by another application.',
      actionRequired: 'Close other applications using the microphone and retry.',
    };
  }

  if (normalized.includes('service-not-allowed')) {
    return {
      status: 'denied',
      message: 'Speech recognition service is disabled or blocked on this network.',
      actionRequired: 'You can type your answer directly in the text area below.',
    };
  }

  return {
    status: 'prompt',
    message: 'Could not access microphone: ' + (errorCode || 'unknown error'),
    actionRequired: 'Tap "Retry Microphone" from an explicit user action.',
  };
}
