import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {reportStoryHelp,acknowledgeStoryHelp,confirmStoryAccess} from '../dist/story-followup.mjs';
import {outcomeFacts} from '../dist/story-model.mjs';

test('customer help reopens confirmation without replaying the grant',()=>{
 const s=simulatePayment(createCase());investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);
 const support={messages:[],help:false,confirmedAt:null};
 confirmStoryAccess(s,support,{opened:true});
 assert.equal(outcomeFacts(s,support).customerConfirmed,true);
 reportStoryHelp(support);
 assert.equal(outcomeFacts(s,support).customerConfirmed,false);
 assert.equal(outcomeFacts(s,support).customerNeedsHelp,true);
 acknowledgeStoryHelp(support);
 assert.ok(support.acknowledgedAt);
 assert.throws(()=>confirmStoryAccess(s,support,{opened:false}),/Open the verified lesson/);
 verify(s);
 confirmStoryAccess(s,support,{opened:true});
 assert.equal(s.writes,1);
 assert.equal(s.reads,2);
 assert.equal(outcomeFacts(s,support).customerConfirmed,true);
});
test('unverified cases cannot be confirmed',()=>{
 const s=simulatePayment(createCase());
 assert.throws(()=>confirmStoryAccess(s,{help:false},{opened:true}),/verified lesson/);
});
