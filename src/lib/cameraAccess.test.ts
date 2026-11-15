import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCameraRequestGuard, isCameraPermissionError } from './cameraAccess';

test('closing the view stops every track returned by a late camera request', () => {
  const guard = createCameraRequestGuard();
  const request = guard.begin();
  let stops = 0;
  guard.cancel();
  assert.equal(guard.accept(request, {getTracks: () => [{stop: () => {stops++;}}, {stop: () => {stops++;}}]}), false);
  assert.equal(stops, 2);
});
test('only the latest request may attach a camera stream', () => {
  const guard = createCameraRequestGuard();
  const old = guard.begin();
  const current = guard.begin();
  assert.equal(guard.current(old), false);
  assert.equal(guard.accept(current, {getTracks: () => []}), true);
});
test('permission denials are distinguished from unavailable cameras', () => {
  assert.equal(isCameraPermissionError(new DOMException('Permission denied', 'NotAllowedError')), true);
  assert.equal(isCameraPermissionError(new DOMException('No camera', 'NotFoundError')), false);
});