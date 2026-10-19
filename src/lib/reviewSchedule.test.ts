/// <reference types="node" />
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSchedule } from './reviewSchedule';

const start = new Date(2026, 9, 19, 10, 0, 0);

test('first step is 10 minutes after start', () => {
  assert.equal(buildSchedule(start)[0].getTime(), start.getTime() + 10 * 60 * 1000);
});
test('tonight 19:00 and tomorrow 08:00', () => {
  const s = buildSchedule(start);
  assert.deepEqual(s[1], new Date(2026, 9, 19, 19));
  assert.deepEqual(s[2], new Date(2026, 9, 20, 8));
});
test('then 2, 3, 5, 7 day gaps at 18:00', () => {
  assert.deepEqual(buildSchedule(start).slice(3), [3, 6, 11, 18].map(d => new Date(2026, 9, 19 + d, 18)));
});
test('compresses so last step lands on the target date', () => {
  const target = new Date(2026, 9, 24, 10);
  const s = buildSchedule(start, target);
  assert.equal(s[s.length - 1].getTime(), target.getTime());
});
test('keeps the schedule when the target is far away', () => {
  assert.deepEqual(buildSchedule(start, new Date(2027, 0, 1)), buildSchedule(start));
});
