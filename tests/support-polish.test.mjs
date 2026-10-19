import test from 'node:test';
import assert from 'node:assert/strict';
import {emailStatus,resolutionSteps,replyTemplates} from '../dist/support-polish.mjs';

test('resolution distinguishes active access from verification and reopened customer help',()=>{
 const state={entitlement:{active:true}};
 assert.deepEqual(resolutionSteps(state,{verified:false,confirmedAt:'old'}).map(s=>s.done),[true,false,false]);
 assert.deepEqual(resolutionSteps(state,{verified:true,confirmedAt:'now',help:true}).map(s=>s.done),[true,true,false]);
 assert.deepEqual(resolutionSteps(state,{verified:true,confirmedAt:'now',help:false}).map(s=>s.done),[true,true,true]);
});
test('email labels and suggested replies do not overstate delivery or access',()=>{
 assert.match(emailStatus('accepted-by-provider')[1],/does not prove/);
 assert.match(emailStatus('delivery-unknown')[0],/unconfirmed/);
 assert.match(emailStatus('not-configured')[0],/setup needed/);
 assert.match(replyTemplates({verified:false})[0][1],/still open/);
 assert.doesNotMatch(replyTemplates({verified:false})[0][1],/check has passed/);
 assert.match(replyTemplates({verified:true})[0][1],/let us know whether it works/);
});
