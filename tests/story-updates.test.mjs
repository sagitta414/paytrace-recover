import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {suggestedStoryUpdate,sendStoryUpdate} from '../dist/story-updates.mjs';

test('merchant update moves from review to verification without premature success claims',()=>{
 const s=simulatePayment(createCase());const support={sentUpdates:[]},messages=[];
 sendStoryUpdate(s,support,(role,text)=>messages.push({role,text}));
 assert.throws(()=>sendStoryUpdate(s,support,()=>{}),/already been sent/);
 investigate(s);assert.match(suggestedStoryUpdate(s,support).text,/No access change/);
 rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);
 assert.match(suggestedStoryUpdate(s,support).text,/before calling this resolved/);
 verify(s,{paymentAvailable:false,lessonAvailable:false});
 assert.match(suggestedStoryUpdate(s,support).text,/case remains open/);
 verify(s);
 assert.match(suggestedStoryUpdate(s,support).text,/Tell us if it is still locked/);
 assert.doesNotMatch(suggestedStoryUpdate(s,support).text,/you confirmed|resolved/i);
 assert.equal(messages.length,1);
});
test('mismatched payment requests a reference without implying approval',()=>{
 const s=simulatePayment(createCase('conflict'));investigate(s);
 const d=suggestedStoryUpdate(s,{});
 assert.match(d.text,/does not match/);
 assert.match(d.text,/have not changed/);
});
test('customer follow-up remains open even after a passed recheck',()=>{
 const s=simulatePayment(createCase());investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);
 const support={help:true,helpAt:'2026-10-22T12:00:00Z',acknowledgedAt:'2026-10-22T12:01:00Z'};
 assert.equal(suggestedStoryUpdate(s,support),null);
 support.recheckedAt='2026-10-22T12:02:00Z';verify(s);
 const d=suggestedStoryUpdate(s,support);
 assert.match(d.text,/request remains open/);
 assert.doesNotMatch(d.text,/resolved/);
});
