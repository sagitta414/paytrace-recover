import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment} from '../dist/core.mjs';
import {recoveryTrail,recoveryTrailMarkup} from '../dist/focus-recovery-trail.mjs';
import {rememberWorkflowRun} from '../server/workflow-history.mjs';

test('trail distinguishes a matching purchase from completed access proof',()=>{
 const s=simulatePayment(createCase());
 const steps=recoveryTrail(s);
 assert.equal(steps[0].state,'Matched');
 assert.equal(steps[4].state,'Not checked');
 assert.match(recoveryTrailMarkup(s),/ILLUSTRATIVE SAMPLE/);
 s.capture.source='paypal-sandbox';
 assert.match(recoveryTrailMarkup(s),/PAYPAL SANDBOX CASE/);
 assert.equal(recoveryTrail(s,{uncertain:true})[0].state,'Recheck needed');
});

test('completed Render investigation survives replacement by recovery job',()=>{
 const s=simulatePayment(createCase());
 s.job={id:'investigate-1',kind:'investigate',runId:'render-investigate-1',startedAt:'2026-11-10T10:00:00Z',pending:true,completed:{gather:{}}};
 rememberWorkflowRun(s);
 assert.equal(s.workflowRuns[0].status,'running');
 s.job={...s.job,pending:false,completed:{gather:{},analyze:{},record:{}}};
 rememberWorkflowRun(s,'2026-11-10T10:01:00Z');
 s.job={id:'recover-1',kind:'recover',runId:'render-recover-1',startedAt:'2026-11-10T10:02:00Z',pending:true,completed:{}};
 rememberWorkflowRun(s);
 assert.equal(s.workflowRuns.length,2);
 assert.equal(s.workflowRuns[0].runId,'render-investigate-1');
 assert.equal(s.workflowRuns[0].status,'completed');
 assert.equal(s.workflowRuns[1].status,'running');
 assert.equal(recoveryTrail(s)[1].reference,'render-investigate-1');
 assert.equal(recoveryTrail(s)[3].reference,'render-recover-1');
 assert.equal(recoveryTrail(s)[1].label,'Render investigation');
 assert.deepEqual(recoveryTrail(s)[1].stages.map(stage=>stage.done),[true,true,true]);
 assert.deepEqual(recoveryTrail(s)[3].stages.map(stage=>stage.done),[false,false]);
 assert.equal(recoveryTrail(s)[3].state,'Render running');
});

test('failed run cannot be displayed as a finished recovery',()=>{
 const s=simulatePayment(createCase());
 s.job={id:'recover-2',kind:'recover',runId:'render-recover-2',startedAt:'2026-11-10T10:02:00Z',pending:false,error:'provider failed',completed:{repair:{}}};
 rememberWorkflowRun(s);
 assert.equal(s.workflowRuns[0].status,'failed');
 assert.equal(recoveryTrail(s)[3].state,'Run needs attention');
 assert.deepEqual(recoveryTrail(s)[3].stages.map(stage=>stage.done),[true,false]);
 assert.equal(recoveryTrail(s)[4].state,'Not checked');
});
