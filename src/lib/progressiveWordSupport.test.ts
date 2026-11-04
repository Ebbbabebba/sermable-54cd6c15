import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { nextSupportWord, progressiveHideCount } from './progressiveWordSupport';

const words = ['Vi', 'vill', 'att', 'kunskap', 'och', 'minnet', 'består.'];
const common = new Set(['att', 'och']);
const order = words.map((_, i) => i);
test('att and och disappear before content words', () => {
  assert.equal(nextSupportWord(words, new Set(), new Set(), common, order), 2);
  assert.equal(nextSupportWord(words, new Set([2]), new Set(), common, order), 4);
});
test('only a few words disappear and a supported round remains before full recall', () => {
  assert.equal(progressiveHideCount(7, 0), 1);
  assert.equal(progressiveHideCount(7, 1), 2);
  assert.equal(progressiveHideCount(7, 20), 3);
  assert.equal(progressiveHideCount(3, 20), 2);
  assert.equal(progressiveHideCount(1, 20), 1);
});
test('missed connectors remain visible after easier successful words', () => {
  assert.equal(nextSupportWord(words, new Set(), new Set([2]), common, order), 4);
});
test('actual difficulty determines order within content words', () => {
  assert.equal(nextSupportWord(['kunskap', 'minnen', 'består.'], new Set(), new Set(), common, [1, 0, 2]), 1);
});
test('pause markers are never selected', () => {
  assert.equal(nextSupportWord(['-2s', 'och'], new Set(), new Set(), common, [0, 1]), 1);
});
test('AI support cannot override observed misses or remove keyword-mode support', () => {
  assert.equal(nextSupportWord(words, new Set(), new Set([2]), common, order, i => i === 3 || i === 5, new Set([3])), 5);
});