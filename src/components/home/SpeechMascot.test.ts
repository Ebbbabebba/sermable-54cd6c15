/// <reference types="node" />
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mascotMood } from './SpeechMascot';
test('mascot is nervous below 25 percent', () => { assert.equal(mascotMood(24), 'nervous'); });
test('mascot learns from 25 to below 60 percent', () => { assert.equal(mascotMood(25), 'learning'); assert.equal(mascotMood(59), 'learning'); });
test('mascot is confident from 60 to below 90 percent', () => { assert.equal(mascotMood(60), 'confident'); assert.equal(mascotMood(89), 'confident'); });
test('mascot is ready at 90 percent and above', () => { assert.equal(mascotMood(90), 'ready'); assert.equal(mascotMood(100), 'ready'); });