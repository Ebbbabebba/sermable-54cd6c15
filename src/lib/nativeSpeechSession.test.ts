import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createNativeSpeechSession } from './nativeSpeechSession';

function fakePlugin() {
  const callbacks = new Map<string, (data: any) => void>();
  let starts = 0;
  let stops = 0;
  const plugin = {
    start: async () => { starts++; callbacks.get('listeningState')?.({ status: 'started' }); },
    stop: async () => { stops++; callbacks.get('listeningState')?.({ status: 'stopped' }); },
    isListening: async () => ({ listening: true }),
    addListener: async (event: string, callback: (data: any) => void) => {
      callbacks.set(event, callback);
      return { remove: async () => { callbacks.delete(event); } };
    },
  };
  return { plugin, callbacks, starts: () => starts, stops: () => stops };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function options(onTranscript = (_text: string) => {}) {
  return { language: 'sv-SE', choose: (matches: string[]) => matches[0], onTranscript, onReady: () => {}, onError: () => {} };
}

test('duplicate stop events schedule only one microphone restart', async () => {
  const fake = fakePlugin();
  const session = await createNativeSpeechSession(fake.plugin, options());
  await session.start();
  fake.callbacks.get('listeningState')?.({ status: 'stopped' });
  fake.callbacks.get('listeningState')?.({ status: 'stopped' });
  await wait(760);
  assert.equal(fake.starts(), 2);
  await session.stop();
});

test('stopping cancels restart and removes callbacks before releasing microphone', async () => {
  const fake = fakePlugin();
  const session = await createNativeSpeechSession(fake.plugin, options());
  await session.start();
  fake.callbacks.get('listeningState')?.({ status: 'stopped' });
  await session.stop();
  await wait(760);
  assert.equal(fake.starts(), 1);
  assert.equal(fake.callbacks.size, 0);
  assert.equal(fake.stops(), 1);
});

test('lesson reset strips the old native utterance while forwarding new spoken words', async () => {
  const fake = fakePlugin();
  const texts: string[] = [];
  const session = await createNativeSpeechSession(fake.plugin, options(text => texts.push(text)));
  await session.start();
  fake.callbacks.get('partialResults')?.({ matches: ['Hej allihopa'] });
  session.clearBuffer();
  fake.callbacks.get('partialResults')?.({ matches: ['Hej allihopa'] });
  fake.callbacks.get('partialResults')?.({ matches: ['Hej allihopa Tack'] });
  fake.callbacks.get('partialResults')?.({ matches: ['Hej allihopa Tack för'] });
  assert.deepEqual(texts, ['Hej allihopa', 'Tack', 'Tack för']);
  await session.stop();
});

test('already-listening start failure never toggles a healthy microphone', async () => {
  const fake = fakePlugin();
  fake.plugin.start = async () => { throw new Error('already listening'); };
  const session = await createNativeSpeechSession(fake.plugin, options());
  await session.start();
  await wait(760);
  assert.equal(fake.stops(), 0);
  await session.stop();
});