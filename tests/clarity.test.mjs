import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {caseHandoff,priorities,agentRunView} from '../dist/focus-clarity.mjs';
import {queueFor,nextStep,caseLabel} from '../dist/focus-model.mjs';
import {customerNext,customerNextMarkup} from '../dist/customer-clarity.mjs';

test('frontend handoffs distinguish approval, failed verification and stale proof',()=>{
 const s=simulatePayment(createCase());investigate(s);rehearse(s);
 assert.equal(priorities([s])[0].items.length,1);
 approve(s,s.rehearsal.id);applyRepair(s);verify(s,{lessonAvailable:false});
 assert.match(caseHandoff(s).title,/without another grant/);
 assert.equal(priorities([s])[1].items.length,1);
 verify(s);assert.match(caseHandoff(s).title,/Access verified/);
 assert.match(caseHandoff(s,true).title,/Refresh/);
 s.revision++;assert.doesNotMatch(caseHandoff(s).title,/Access verified/);
});
test('interrupted agent review returns to attention with a clear retry',()=>{
 const s=simulatePayment(createCase());s.phase='review-failed';s.review=null;s.job={pending:false,error:'AI challenge round could not complete.'};
 assert.equal(queueFor(s),'attention');assert.equal(nextStep(s)[0],'investigate');
 assert.match(nextStep(s)[1],/Retry agent review/);assert.match(caseLabel(s),/interrupted/);
 assert.match(caseHandoff(s).title,/stopped/);assert.equal(priorities([s])[2].items.length,1);
});
test('agent run view separates live progress, failed review, and scripted result',()=>{
 const s={agentRun:{mode:'model',status:'running',step:'finding-1',agent:1,completed:['finding-0']}};
 let view=agentRunView(s);assert.match(view.title,/Relay/);assert.equal(view.steps[0].state,'received');assert.equal(view.steps[1].state,'working');
 s.agentRun.status='failed';view=agentRunView(s);assert.match(view.title,/interrupted/);assert.match(view.detail,/No recommendation/);
 s.agentRun={mode:'scripted',status:'complete',step:'done',agent:null,completed:[]};view=agentRunView(s);assert.match(view.detail,/Scripted demo/);assert.equal(view.steps[0].state,'scripted');
});
test('customer handoff gives reopened help and evidence requests priority over success',()=>{
 assert.equal(customerNext({verified:true,confirmedAt:'today',help:true}).title,'Your request is still open');
 assert.equal(customerNext({verified:true,request:'Please check the receipt'}).owner,'You');
 assert.match(customerNext({verified:false,confirmedAt:'yesterday'}).title,/being reviewed/);
 assert.match(customerNext({verified:true}).title,/Try opening/);
 const html=customerNextMarkup({request:'<img onerror=alert(1)>',messages:[]});
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});
