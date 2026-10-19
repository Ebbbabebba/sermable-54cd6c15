import { expect, test } from 'bun:test';
import { mascotMood } from './SpeechMascot';
test('mascot is nervous below 25 percent', () => { expect(mascotMood(24)).toBe('nervous'); });
test('mascot learns from 25 to below 60 percent', () => { expect(mascotMood(25)).toBe('learning'); expect(mascotMood(59)).toBe('learning'); });
test('mascot is confident from 60 to below 90 percent', () => { expect(mascotMood(60)).toBe('confident'); expect(mascotMood(89)).toBe('confident'); });
test('mascot is ready at 90 percent and above', () => { expect(mascotMood(90)).toBe('ready'); expect(mascotMood(100)).toBe('ready'); });