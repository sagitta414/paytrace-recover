import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {workspaceOverview,workspaceCsv} from '../dist/workspace-model.mjs';
import {pulseMarkup} from '../dist/workspace-widgets.mjs';
const paid=id=>simulatePayment(createCase('match',id));
const resolved=id=>{const s=paid(id);investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);return s;};

test('pulse prioritizes due follow-ups, customer help, and verification without mixing currencies or claiming revenue',()=>{
 const now=Date.now(),a=paid('A'),b=resolved('B'),c=resolved('C');c.phase='unverified';const data=workspaceOverview([a,b,c],{now,reminders:[{caseId:'A',dueAt:new Date(now-1).toISOString()}],followups:[{caseId:'B',kind:'help'}]});
 assert.equal(data.counts.followupsDue,1);assert.equal(data.counts.customerWaiting,1);assert.equal(data.counts.verificationNeeded,1);assert.equal(data.counts.verified,1);assert.deepEqual(data.urgent.map(x=>x.caseId),['A','B','C']);assert.match(data.urgent[1].reasons.join(),/Customer still needs help/);
});

test('pulse never calls stale or unavailable proof a current verified outcome',()=>{const a=resolved('A'),b=resolved('B');a.sources={access:{status:'unavailable'}};b.revision++;const data=workspaceOverview([a,b]);assert.equal(data.counts.verified,0);assert.equal(data.counts.sourceIssues,1);assert.equal(data.counts.verificationNeeded,2);});

test('high priority changes ordering but does not promote a resolved case back into work',()=>{const a=paid('A'),b=paid('B'),c=resolved('C');const data=workspaceOverview([a,b,c],{preferences:[{caseId:'B',priority:'high'},{caseId:'C',priority:'high'}]});assert.equal(data.urgent[0].caseId,'B');assert.ok(!data.urgent.some(r=>r.caseId==='C'));assert.equal(b.writes,0);});

test('CSV escapes formula-leading names, quotes and newlines and omits conversation/email fields',()=>{const a=paid('A');a.customerName=' =HYPERLINK("test")\nnext';const data=workspaceOverview([a],{followups:[{caseId:'A',kind:'reply',preview:'private message',email:'private@example.com'}]});const csv=workspaceCsv(data);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\' =HYPERLINK(""test"")\nnext"'));assert.ok(!csv.includes('private message'));assert.ok(!csv.includes('private@example.com'));assert.match(csv,/Amount \(minor units\)/);});

test('pulse escapes customer data instead of injecting markup',()=>{const s=paid('A');s.customerName='<img src=x onerror=alert(1)>';const html=pulseMarkup(workspaceOverview([s]),{operator:true});assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/Export queue CSV/);});

test('resolved cases do not retain old workflow errors in current attention counts',()=>{const s=resolved('A');s.job={pending:false,error:'An old workflow timed out',expiredAt:new Date().toISOString()};const data=workspaceOverview([s]);assert.equal(data.counts.workflowIssues,0);assert.equal(data.urgent.length,0);assert.equal(data.rows[0].workflowError,null);});
test('payment holds rise to the attention list and never count as verified',()=>{const s=resolved('A');s.paymentHold={status:'REFUNDED',at:new Date().toISOString()};const data=workspaceOverview([s]);assert.equal(data.counts.paymentHolds,1);assert.equal(data.counts.verified,0);assert.match(data.urgent[0].reasons.join(),/Payment change needs merchant review/);});
