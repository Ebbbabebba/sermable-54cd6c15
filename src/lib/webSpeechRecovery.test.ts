import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createWebSpeechRecovery } from './webSpeechRecovery';

test('repeated silent session ends never exhaust retries or introduce backoff', () => {
  const recovery = createWebSpeechRecovery();
  for (let i = 0; i < 20; i++) {
    assert.equal(recovery.error('no-speech'), false);
    assert.equal(recovery.exhausted(), false);
    assert.equal(recovery.delay(), 0);
  }
});

test('normal session ends do not count as failures', () => {
  const recovery = createWebSpeechRecovery();
  for (let i = 0; i < 20; i++) {
    assert.equal(recovery.exhausted(), false);
    assert.equal(recovery.delay(), 0);
  }
});

test('real nonterminal errors retain bounded retries and backoff', () => {
  const recovery = createWebSpeechRecovery();
  for (const delay of [700, 1400, 2800, 4000, 4000]) {
    assert.equal(recovery.error('network'), false);
    assert.equal(recovery.delay(), delay);
    assert.equal(recovery.exhausted(), false);
  }
  recovery.error('network');
  assert.equal(recovery.exhausted(), true);
  recovery.reset();
  assert.equal(recovery.exhausted(), false);
  assert.equal(recovery.delay(), 0);
});

test('permission and unavailable capture errors remain terminal', () => {
  const recovery = createWebSpeechRecovery();
  for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']) {
    assert.equal(recovery.error(code), true);
  }
});

test('silence clears previous transient failures', () => {
  const recovery = createWebSpeechRecovery();
  recovery.error('network');
  recovery.error('no-speech');
  assert.equal(recovery.delay(), 0);
  assert.equal(recovery.exhausted(), false);
});