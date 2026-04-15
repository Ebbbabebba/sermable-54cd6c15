/**
 * Request microphone access with proper iOS/Samsung compatibility.
 * 
 * navigator.permissions.query({ name: 'microphone' }) is NOT supported
 * on Safari/iOS/Samsung Internet. The only reliable cross-browser way
 * to request mic access is to call getUserMedia directly.
 */
export async function requestMicrophoneAccess(
  audioConstraints: MediaTrackConstraints = {
    sampleRate: 24000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new MicrophoneError(
      'not-supported',
      'Your browser does not support audio recording. Please use Safari on iOS or Chrome on Android.'
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    return stream;
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw new MicrophoneError(
        'denied',
        'Microphone access was denied. Please allow microphone access in your device settings and try again.'
      );
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      throw new MicrophoneError(
        'not-found',
        'No microphone was found on this device.'
      );
    }
    throw new MicrophoneError(
      'unknown',
      `Could not access microphone: ${err.message || 'Unknown error'}`
    );
  }
}

export class MicrophoneError extends Error {
  code: 'denied' | 'not-supported' | 'not-found' | 'unknown';
  
  constructor(code: 'denied' | 'not-supported' | 'not-found' | 'unknown', message: string) {
    super(message);
    this.code = code;
    this.name = 'MicrophoneError';
  }
}
