import test from 'node:test';
import assert from 'node:assert/strict';
import {activityKind} from '../dist/focus-activity.mjs';
import {activityView} from '../dist/focus-workspace.mjs';
import {connectionReadiness} from '../dist/focus-experience.mjs';
import {sandboxCheckoutReady} from '../dist/focus-new-case.mjs';
import {customerNextMarkup} from '../dist/customer-clarity.mjs';
import {createCase,simulatePayment} from '../dist/core.mjs';

test('activity labels useful categories and exposes full event dates for review',()=>{
 assert.equal(activityKind('Merchant approved one access grant'),'decision');
 assert.equal(activityKind('Verified protected lesson'),'access');
 assert.equal(activityKind('Customer sent a message'),'customer');
 const s=simulatePayment(createCase());s.events=[{at:'2026-10-24T12:30:00Z',what:'Merchant approved one access grant'}];
 const html=activityView([s]);assert.match(html,/data-activity-kind="decision"/);assert.match(html,/2026/);
});

test('first connected case checklist distinguishes configuration from case evidence',()=>{
 const empty=connectionReadiness([],true,{paypal:false,courseAccess:true,ai:true});assert.match(empty,/0 of 4 checkpoints complete/);
 const s=simulatePayment(createCase());s.capture.source='paypal-sandbox';s.sources={payment:{status:'available'},access:{status:'available',system:'External course access service'}};s.review={mode:'model'};
 const ready=connectionReadiness([s],true,{paypal:true});assert.match(ready,/4 of 4 checkpoints complete/);assert.match(ready,/Model review recorded for the case/);
});

test('sandbox intake is unavailable until the server advertises PayPal credentials',()=>{
 assert.equal(sandboxCheckoutReady(true,{paypal:false}),false);
 assert.equal(sandboxCheckoutReady(false,{paypal:true}),false);
 assert.equal(sandboxCheckoutReady(true,{paypal:true}),true);
});

test('customer progress distinguishes latest message from latest merchant reply',()=>{
 const html=customerNextMarkup({verified:false,status:1,next:'Reviewing purchase',messages:[{role:'merchant',at:'2026-10-23T10:00:00Z'},{role:'customer',at:'2026-10-24T10:00:00Z'}]});
 assert.match(html,/Latest case message/);assert.match(html,/Last merchant reply/);
 assert.match(customerNextMarkup({verified:false,status:1,next:'Reviewing purchase',messages:[]}),/No merchant reply recorded yet/);
});
