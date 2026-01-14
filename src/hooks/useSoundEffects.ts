/**
 * Sound Effects Hook
 * Provides audio feedback for UI interactions
 */

import { useCallback, useRef } from 'react';

export type SoundType = 
  | 'click'      // Button click
  | 'success'    // Correct action
  | 'error'      // Wrong action
  | 'complete';  // Task complete

interface SoundEffectsOptions {
  enabled?: boolean;
  volume?: number;
}

export const useSoundEffects = (options: SoundEffectsOptions = {}) => {
  const { enabled = true, volume = 0.3 } = options;
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!enabled) return;

    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Soft attack and release
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      // Audio not supported or blocked
      console.debug('Audio playback failed:', error);
    }
  }, [enabled, volume, getAudioContext]);

  const playClick = useCallback(() => {
    // Bright, cheerful click - higher pitch, sparkly
    playTone(880, 0.06, 'sine'); // A5 - brighter pop
  }, [playTone]);

  const playSuccess = useCallback(() => {
    // Happy ascending major chord arpeggio
    playTone(523, 0.1, 'sine');  // C5
    setTimeout(() => playTone(659, 0.1, 'sine'), 80);  // E5
    setTimeout(() => playTone(784, 0.15, 'sine'), 160); // G5
  }, [playTone]);

  const playError = useCallback(() => {
    // Gentle reminder, not harsh - still friendly
    playTone(330, 0.12, 'sine'); // E4 - softer, less alarming
  }, [playTone]);

  const playComplete = useCallback(() => {
    // Celebratory fanfare - joyful ascending sequence
    playTone(523, 0.08, 'sine');  // C5
    setTimeout(() => playTone(659, 0.08, 'sine'), 70);   // E5
    setTimeout(() => playTone(784, 0.08, 'sine'), 140);  // G5
    setTimeout(() => playTone(1047, 0.25, 'sine'), 210); // C6 - high triumphant finish
  }, [playTone]);

  const play = useCallback((sound: SoundType) => {
    switch (sound) {
      case 'click':
        playClick();
        break;
      case 'success':
        playSuccess();
        break;
      case 'error':
        playError();
        break;
      case 'complete':
        playComplete();
        break;
    }
  }, [playClick, playSuccess, playError, playComplete]);

  return {
    enabled,
    play,
    playClick,
    playSuccess,
    playError,
    playComplete,
  };
};
