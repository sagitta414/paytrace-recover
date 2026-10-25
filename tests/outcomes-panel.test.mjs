import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {outcomeCounts} from '../dist/focus-outcomes.mjs';

test('outcomes separate a verified recovery, an evidence hold, and an unverified write',()=>{
 const verified=simulatePayment(createCase('match','OUT-1'));investigate(verified);rehearse(verified);approve(verified,verified.rehearsal.id);applyRepair(verified);verify(verified);
 const held=simulatePayment(createCase('conflict','OUT-2'));investigate(held);
 const pending=simulatePayment(createCase('match','OUT-3'));investigate(pending);rehearse(pending);approve(pending,pending.rehearsal.id);applyRepair(pending);
 assert.deepEqual(outcomeCounts([verified,held,pending]),{verified:1,held:1,awaitingVerification:1,sandbox:0,total:3});
});
