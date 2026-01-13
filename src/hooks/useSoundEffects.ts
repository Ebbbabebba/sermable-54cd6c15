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
    // Soft, low "pop" sound - much gentler than a high beep
    playTone(220, 0.08, 'sine'); // A3 note, very short
  }, [playTone]);

  const playSuccess = useCallback(() => {
    // Gentle ascending chime
    playTone(392, 0.1, 'sine'); // G4
    setTimeout(() => playTone(523, 0.15, 'sine'), 80); // C5
  }, [playTone]);

  const playError = useCallback(() => {
    // Soft low tone
    playTone(196, 0.15, 'sine'); // G3
  }, [playTone]);

  const playComplete = useCallback(() => {
    // Happy completion sound
    playTone(392, 0.1, 'sine'); // G4
    setTimeout(() => playTone(494, 0.1, 'sine'), 100); // B4
    setTimeout(() => playTone(587, 0.2, 'sine'), 200); // D5
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
