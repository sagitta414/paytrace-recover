import test from 'node:test';
import assert from 'node:assert/strict';
import { storyEntry, storyBridge } from '../dist/focus-narrative.mjs';

test('story handoff opens only Maya’s seeded browser case', () => {
  const cases = [{ id: 'CL-1048', customerName: 'Maya' }];
  assert.equal(storyEntry(cases, false, '?from=story').caseId, 'CL-1048');
  assert.equal(storyEntry(cases, true, '?from=story').caseId, null);
  assert.equal(storyEntry(cases, false, '').active, false);
  assert.equal(storyEntry([{ id: 'CL-1048', customerName: 'Someone else' }], false, '?from=story').caseId, null);
});

test('handoff distinguishes separate demo state and customer perspective', () => {
  const browser = storyBridge({ selected: true });
  assert.match(browser, /separate demo state/);
  assert.match(browser, /story\.html\?perspective=customer/);
  assert.match(storyBridge({ backend: true }), /own server cases/);
  assert.match(storyBridge({ selected: true, verified: true }), /customer gets the final word/);
});
