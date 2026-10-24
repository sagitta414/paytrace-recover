import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {storyChapters} from '../dist/story-chapters.mjs';

test('the story only completes after an approved correction, verification and customer confirmation',()=>{
 const s=simulatePayment(createCase());
 assert.equal(storyChapters(s,{started:true}).filter(x=>x.status==='done').length,1);
 investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);
 assert.equal(storyChapters(s,{started:true})[5].status,'current');
 verify(s);
 assert.equal(storyChapters(s,{started:true})[6].status,'current');
 assert.equal(storyChapters(s,{started:true,opened:true,confirmed:true})[6].status,'done');
 assert.equal(storyChapters(s,{started:true,opened:true,confirmed:true,help:true})[6].status,'reopened');
});
test('a mismatched purchase holds decision, correction, and proof',()=>{
 const s=simulatePayment(createCase('conflict'));investigate(s);
 assert.deepEqual(storyChapters(s,{started:true}).slice(3).map(x=>x.status),['held','held','held','held']);
});
test('failed verification never becomes a completed outcome',()=>{
 const s=simulatePayment(createCase('read-error'));investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s,{paymentAvailable:false,lessonAvailable:false});
 assert.equal(storyChapters(s,{started:true})[5].status,'needs-check');
 assert.equal(storyChapters(s,{started:true,opened:true,confirmed:true})[6].status,'needs-check');
});
