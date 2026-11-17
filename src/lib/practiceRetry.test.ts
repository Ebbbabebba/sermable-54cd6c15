import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restorePracticeSupport } from './practiceRetry';

test('retry reveals a misheard hidden word without crediting it or removing other hidden support', () => {
  const matched = new Set([0]);
  const result = restorePracticeSupport(new Set([0, 1]), [0, 1], new Set(), [0, 1], matched);
  assert.deepEqual([...result.hidden], [0]);
  assert.deepEqual(result.order, [0]);
  assert.deepEqual([...result.protectedWords], [1]);
  assert.deepEqual([...matched], [0]);
});
test('retry also protects a misheard visible last word and excludes pause markers', () => {
  const result = restorePracticeSupport(new Set(), [], new Set(), [0, 2], new Set([0]));
  assert.deepEqual([...result.protectedWords], [2]);
  assert.equal(result.hidden.size, 0);
});