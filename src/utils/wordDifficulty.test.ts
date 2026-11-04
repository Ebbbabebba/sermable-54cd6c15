import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getWordDifficultyResults, recordRepDifficulty, getEasiestWordIndices } from './wordDifficulty';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });
test('only actual matches count as correct, not skipped or failed words', () => {
  recordRepDifficulty('matches', 4, [1], [0, 1, 2]);
  assert.deepEqual(getWordDifficultyResults('matches', 4).correct, [1, 0, 1, 0]);
  assert.deepEqual(getWordDifficultyResults('matches', 4).errors, [0, 1, 0, 0]);
});
test('equal-length sentences keep independent performance histories', () => {
  recordRepDifficulty('beat:att och solen', 3, [0], [1, 2]);
  assert.deepEqual(getWordDifficultyResults('beat:jag kan prata', 3).errors, [0, 0, 0]);
});
test('demonstrated correct words precede unattempted words and missed words', () => {
  recordRepDifficulty('ranking', 3, [0], [2]);
  assert.deepEqual(getEasiestWordIndices('ranking', 3), [2, 1, 0]);
});