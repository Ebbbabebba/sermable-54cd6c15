import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hasMatchedAudienceTargets, audienceHintOrder, visibleAudienceHints, audienceSilenceStep } from './audiencePractice';

test('silence and skipped words cannot complete a hidden sentence', () => {
  assert.equal(hasMatchedAudienceTargets([0, 1, 2], new Set()), false);
  assert.equal(hasMatchedAudienceTargets([0, 1, 2], new Set([0, 2])), false);
  assert.equal(hasMatchedAudienceTargets([0, 1, 2], new Set([0, 1, 2])), true);
});
test('most missed word appears first in time, then important keywords', () => {
  assert.deepEqual(audienceHintOrder([0, 1, 2, 3], [0, 0, 0, 2], new Set([2])), [3, 2, 0, 1]);
});
test('revealed hints follow script order and spoken hints disappear', () => {
  assert.deepEqual(visibleAudienceHints([3, 2, 0, 1], 3, new Set([2])), [0, 3]);
});
test('hint clock pauses during speech and resumes after two seconds of silence', () => {
  assert.equal(audienceSilenceStep(1999, 400), 0);
  assert.equal(audienceSilenceStep(2000, 400), 400);
});