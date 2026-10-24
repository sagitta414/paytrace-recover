import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {breakPointMap,breakPointModel,purchaseComparison} from '../dist/focus-breakpoint-map.mjs';

const paid=(scenario='match')=>simulatePayment(createCase(scenario));

test('map locates missing access without treating handoff evidence as root cause',()=>{
 const s=paid();investigate(s);const map=breakPointModel(s);
 assert.equal(map.breakAt,'access');assert.equal(map.nodes[2].state,'attention');
 assert.match(map.explanation,/not a proven root cause/);
 const html=breakPointMap(s);assert.match(html,/Inspect payment record/);assert.match(html,/Ledger/);assert.match(html,/Fictional browser sample/);
});

test('unsafe purchase or account conditions never suggest a routine grant',()=>{
 for(const [scenario,breakAt] of [['conflict','match'],['wrong-account','match'],['expired','access']]){
  const map=breakPointModel(paid(scenario));assert.equal(map.breakAt,breakAt);assert.doesNotMatch(map.explanation,/Review one narrow grant/);
 }
 assert.equal(breakPointModel(paid('missing')).nodes[0].state,'unknown');
 assert.equal(breakPointModel(paid('pending')).nodes[0].state,'waiting');
});

test('lesson proof stays separate from grant and uncertain reads suppress verified claim',()=>{
 const s=paid();investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);
 assert.equal(breakPointModel(s).nodes[3].state,'confirmed');
 assert.equal(breakPointModel(s).nodes[4].state,'waiting');
 verify(s);assert.equal(breakPointModel(s).nodes[4].state,'confirmed');
 assert.match(breakPointModel(s,{uncertain:true}).headline,/Refresh/);
 assert.notEqual(breakPointModel(s,{uncertain:true}).nodes[4].state,'confirmed');
});

test('sandbox capture needs an available provider read and source JSON is escaped',()=>{
 const s=paid();s.capture.source='paypal-sandbox';
 assert.equal(breakPointModel(s,{backend:true}).nodes[0].state,'unknown');
 s.sources={payment:{status:'available',checkedAt:'2026-10-24T12:00:00Z'},access:{status:'available'}};
 assert.equal(breakPointModel(s,{backend:true}).nodes[0].state,'confirmed');
 s.order.label='<script>alert(1)</script>';
 const html=breakPointMap(s,{backend:true});assert.doesNotMatch(html,/<script>alert/);assert.match(html,/&lt;script&gt;/);
});

test('purchase comparison pinpoints a conflicting field and does not present unavailable payment as matched',()=>{
 const conflict=paid('conflict'),rows=purchaseComparison(conflict).rows;
 assert.equal(rows.find(row=>row.label==='Order ID').state,'conflict');
 assert.equal(rows.find(row=>row.label==='Amount').state,'match');
 assert.match(breakPointMap(conflict),/Purchase evidence comparison/);
 assert.match(breakPointMap(conflict),/Conflict/);
 const missing=paid('missing');assert.equal(purchaseComparison(missing).counts.match,1);
 assert.equal(purchaseComparison(missing).rows.find(row=>row.label==='Order ID').state,'unknown');
 const sandbox=paid();sandbox.capture.source='paypal-sandbox';
 assert.equal(purchaseComparison(sandbox,{backend:true}).rows.find(row=>row.label==='Payment status').state,'unknown');
 assert.equal(purchaseComparison(conflict,{uncertain:true}).counts.conflict,0);
});
