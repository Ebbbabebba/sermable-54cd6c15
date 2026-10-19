/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { dateFormatter, safeLocale } from './dateFormat';

test('keeps a well-formed locale untouched', () => {
  assert.equal(safeLocale('sv-SE'), 'sv-SE');
  assert.equal(safeLocale('de'), 'de');
  assert.equal(safeLocale(undefined), undefined);
});

test('falls back to the base language when the browser reports an unsupported tag', () => {
  assert.equal(safeLocale('en-US@posix'), 'en');
  assert.equal(safeLocale('sv-SE@collation=standard'), 'sv');
  assert.equal(safeLocale('!!!'), undefined);
});

test('formats a date with an unsupported locale instead of throwing', () => {
  const formatted = dateFormatter('en-US@posix', { dateStyle: 'long' }).format(new Date('2026-10-19T09:00:00Z'));
  assert.match(formatted, /2026/);
});

test('still respects the requested language when it is valid', () => {
  const sv = dateFormatter('sv', { month: 'long' }).format(new Date('2026-01-05T09:00:00Z'));
  const en = dateFormatter('en', { month: 'long' }).format(new Date('2026-01-05T09:00:00Z'));
  assert.equal(sv, 'januari');
  assert.equal(en, 'January');
});
