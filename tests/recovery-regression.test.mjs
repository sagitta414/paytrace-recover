import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {traceCaseKey,withRecoverySpan} from '../server/recovery-trace.mjs';

function paid(){return simulatePayment(createCase('match','CL-regression'))}
const unsafe=[
 ['different order',s=>s.capture.orderId='CL-foreign'],
 ['different learner',s=>s.capture.userId='learner-foreign'],
 ['different course',s=>s.capture.courseId='course-foreign'],
 ['lower amount',s=>s.capture.amount=1],
 ['higher amount',s=>s.capture.amount=12801],
 ['different currency',s=>s.capture.currency='EUR'],
 ['pending capture',s=>s.capture.status='PENDING'],
 ['refunded capture',s=>s.capture.status='REFUNDED'],
 ['voided capture',s=>s.capture.status='VOIDED'],
 ['missing capture status',s=>delete s.capture.status],
 ['missing capture order',s=>delete s.capture.orderId],
 ['missing learner',s=>delete s.capture.userId],
 ['wrong signed-in account',s=>s.currentAccountId='learner-foreign'],
 ['expired course term',s=>s.accessExpiresAt=new Date(Date.now()-86400000).toISOString()],
 ['missing payment evidence',s=>s.evidenceAvailable=false],
 ['wrong entitlement learner',s=>s.entitlement.userId='learner-foreign'],
 ['wrong entitlement course',s=>s.entitlement.courseId='course-foreign']
];
for(const [label,mutate] of unsafe)test(`release safety: ${label} cannot authorize an access write`,()=>{
 const s=paid();mutate(s);investigate(s);
 assert.notEqual(s.review.outcome,'ready');
 assert.throws(()=>rehearse(s));
 assert.equal(s.writes,0);
});

for(const [label,mutate] of [
 ['order changes',s=>s.capture.orderId='CL-foreign'],
 ['learner changes',s=>s.capture.userId='learner-foreign'],
 ['payment reverses',s=>s.capture.status='REFUNDED'],
 ['access record changes',s=>s.entitlement.captureId='other-capture']
])test(`release safety: approval expires when ${label}`,()=>{
 const s=paid();investigate(s);rehearse(s);approve(s,s.rehearsal.id);mutate(s);
 assert.throws(()=>applyRepair(s));assert.equal(s.writes,0);
});

test('release safety: failed protected lesson check leaves case open and retry never grants twice',()=>{
 const s=paid();investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);
 verify(s,{lessonAvailable:false});assert.equal(s.phase,'unverified');assert.equal(s.writes,1);
 verify(s,{lessonAvailable:true});assert.equal(s.phase,'verified');assert.equal(s.writes,1);
});

test('release safety: a failed access read after approval does not create a write',async()=>{
 const db=openStore(':memory:');try{
  const {id}=db.create();let fail=false;
  const service=createService(db,{}, {access:(owner,s)=>{if(fail)throw Error('access unavailable');return db.readAccess(owner,s)}});
  await service.action(id,{action:'investigate'});
  const preview=await service.action(id,{action:'rehearse'});
  await service.action(id,{action:'approve',planId:preview.state.rehearsal.id});
  fail=true;await assert.rejects(service.action(id,{action:'repair'}),/unavailable/);
  assert.equal(db.get(id).state.writes,0);
 }finally{db.close()}
});

test('recovery tracing uses a pseudonymous case key and never exports raw errors',async()=>{
 const spans=[],tracer={startActiveSpan(name,options,run){const span={attributes:{...options.attributes},status:null,ended:false,setAttribute(k,v){this.attributes[k]=v},setStatus(v){this.status=v},end(){this.ended=true}};spans.push({name,span});return run(span)}};
 const reference='customer@example.test / PAYPAL-SECRET';
 assert.equal(traceCaseKey(reference).length,16);
 await assert.rejects(withRecoverySpan('repair',reference,async()=>{throw Error('private email and payment token')},{tracer}),/private email/);
 const {name,span}=spans[0];assert.equal(name,'recovery.repair');assert.equal(span.attributes['paytrace.case_key'],traceCaseKey(reference));assert.equal(span.attributes['paytrace.failed'],true);assert.equal(span.ended,true);
 assert.doesNotMatch(JSON.stringify({name,span}),/customer@|PAYPAL-SECRET|private email|payment token/);
});
