/// <reference types="node" />
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pushMessage, subscribe, dismissMessage, type InlineMessage } from './InlineMessages';
import { toast } from '@/hooks/use-toast';

function collect(): { seen: InlineMessage[]; stop: () => void } {
  dismissMessage();
  let seen: InlineMessage[] = [];
  const stop = subscribe((m) => { seen = m; });
  return { get seen() { return seen; }, stop };
}

test('confirmation pop-ups are not shown', () => {
  const box = collect();
  pushMessage('Tal skapat', { description: 'Lagt till i listan', duration: 0 });
  pushMessage({ title: 'Klart', variant: 'success', duration: 0 } as any);
  pushMessage({ title: 'Tips', variant: 'info', duration: 0 } as any);
  assert.equal(box.seen.length, 0);
  box.stop();
});

test('errors are still shown', () => {
  const box = collect();
  pushMessage('Något gick fel', { description: 'Försök igen', variant: 'error', duration: 0 });
  assert.equal(box.seen.length, 1);
  assert.equal(box.seen[0].title, 'Något gick fel');
  box.stop();
});

test('use-toast confirmations are hidden, destructive ones stay', () => {
  const box = collect();
  toast({ title: 'Tal raderat', description: 'Det är borta nu' });
  assert.equal(box.seen.length, 0);
  toast({ title: 'Fel', description: 'Kunde inte spara', variant: 'destructive' });
  assert.equal(box.seen.length, 1);
  assert.equal(box.seen[0].title, 'Fel');
  box.stop();
});
