import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {diagnose,deliveryCheck,scanCases,relatedCases} from '../dist/diagnosis.mjs';
import {seedPortfolio,customerDraft,proofIsCurrent} from '../dist/operations.mjs';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {createApp} from '../server/index.mjs';
const paid=(scenario='match',id='P-1')=>simulatePayment(createCase(scenario,id));

test('delivery window respects the boundary and records detection once without repairing',()=>{
 const s=paid(),now=Date.now();s.paidAt=new Date(now-5*60000).toISOString();
 assert.equal(deliveryCheck(s,{now:now-1}).status,'waiting');
 assert.equal(deliveryCheck(s,{now}).status,'attention');scanCases([s],{now});const at=s.monitor.detectedAt;scanCases([s],{now:now+60000});
 assert.equal(s.monitor.detectedAt,at);assert.equal(s.monitor.beforeComplaint,null);assert.equal(s.writes,0);assert.equal(s.approval,null);
 assert.throws(()=>deliveryCheck(s,{graceMinutes:0}));assert.throws(()=>deliveryCheck(s,{graceMinutes:1.5}));
});
test('pending, missing evidence and unknown capture age are not falsely counted as overdue',()=>{
 const p=paid('pending');assert.equal(deliveryCheck(p).status,'payment_pending');
 const missing=paid('missing');assert.equal(deliveryCheck(missing).status,'review');
 const unknown=paid();delete unknown.paidAt;assert.equal(deliveryCheck(unknown).status,'unknown_age');
});
for(const [scenario,code] of [['wrong-account','wrong_account'],['expired','expired_access'],['pending','pending_payment']])test(scenario+' takes a distinct non-grant route',()=>{
 const s=paid(scenario);assert.equal(diagnose(s).code,code);investigate(s);assert.equal(s.phase,'blocked');assert.throws(()=>rehearse(s));assert.throws(()=>applyRepair(s));assert.equal(s.writes,0);assert.notEqual(customerDraft(s).kind,'verified');
});
test('active conflicting entitlements cannot be overwritten and expiry invalidates a rehearsal',()=>{
 const s=paid();s.entitlement.active=true;s.entitlement.captureId='different';assert.equal(diagnose(s).code,'entitlement_conflict');investigate(s);assert.throws(()=>rehearse(s));
 const eligible=paid();investigate(eligible);rehearse(eligible);eligible.accessExpiresAt=new Date(Date.now()-1).toISOString();assert.throws(()=>approve(eligible,eligible.rehearsal.id));
});
test('related cases require the same merchant, course, failure signature and time window',()=>{
 const s=paid();s.paidAt=new Date(Date.now()-12*60000).toISOString();const cases=seedPortfolio(s);assert.equal(relatedCases(s,cases).length,3);
 cases[1].merchantId='other';cases[2].order.courseId='other-course';cases[6].paidAt=new Date(Date.now()-60*60000).toISOString();assert.equal(relatedCases(s,cases).length,0);
});
test('customer drafts claim success only for a current passed proof',()=>{
 const s=paid();investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s,{lessonAvailable:false});assert.equal(customerDraft(s).kind,'review');
 verify(s);assert.equal(customerDraft(s).kind,'verified');assert.equal(customerDraft(s).sent,false);s.capture.status='REFUNDED';assert.equal(proofIsCurrent(s),false);assert.equal(customerDraft(s).kind,'review');
});
test('monitor refresh preserves missing sample evidence and isolates portfolios',async()=>{
 const db=openStore(':memory:');try{const a=db.create(),b=db.create(),svc=createService(db,{});await svc.action(a.id,{action:'scenario',scenario:'missing'});const r=await svc.scan(a.id,{graceMinutes:10});assert.equal(db.get(a.id).state.evidenceAvailable,false);assert.equal(r.graceMinutes,10);assert.equal(db.grace(b.id),5);await assert.rejects(svc.action(b.id,{action:'select-case',caseId:a.state.id}),/belong/);assert.equal(db.get(a.id).state.writes,0);}finally{db.close();}
});
test('a failed independent content probe leaves repair pending and retry does not grant again',async()=>{
 const db=openStore(':memory:');try{const {id}=db.create();let calls=0;const svc=createService(db,{}, {probe:async token=>{calls++;if(calls===1)throw Error('content unavailable');return db.readLearnerToken(token);}});await svc.action(id,{action:'investigate'});const r=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:r.state.rehearsal.id});await svc.action(id,{action:'repair'});assert.equal(db.get(id).state.phase,'unverified');await svc.action(id,{action:'verify'});assert.equal(db.get(id).state.phase,'verified');assert.equal(db.get(id).state.writes,1);assert.equal(calls,2);}finally{db.close();}
});
test('learner capability expires and cannot gain access from client-side case metadata alone',()=>{
 const db=openStore(':memory:');try{const {id,state}=db.create();const token=db.mintLearnerToken(id,state.id);state.entitlement={...state.entitlement,active:true,captureId:state.capture.id};db.save(id,state);assert.throws(()=>db.readLearnerToken(token));db.grant(id,state);assert.equal(db.readLearnerToken(token).userId,state.order.userId);const expired=db.mintLearnerToken(id,state.id,-1);assert.throws(()=>db.readLearnerToken(expired));db.revokeLearnerToken(token);assert.throws(()=>db.readLearnerToken(token));}finally{db.close();}
});
test('protected HTTP content, separate learner session and verification receipt work end to end',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost'},db);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
 const r=await fetch(base+'/api/state'),cookie=r.headers.get('set-cookie').split(';')[0];const initial=(await r.json()).state;
 const post=async(path,body={})=>fetch(base+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/learner/content')).status,403);
 const learner=await post('learner/session'),learnerCookie=learner.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/learner/content',{headers:{Cookie:learnerCookie}})).status,403);
 await post('action',{action:'investigate'});const preview=await(await post('action',{action:'rehearse'})).json();await post('action',{action:'approve',planId:preview.state.rehearsal.id});
 const repaired=await(await post('action',{action:'repair'})).json();assert.equal(repaired.state.phase,'verified');assert.equal(repaired.state.proof.transport,'authenticated-http');assert.equal(repaired.state.proof.resource.userId,initial.order.userId);
 const content=await(await fetch(base+'/api/learner/content',{headers:{Cookie:learnerCookie}})).json();assert.equal(content.contentId,'light-lesson-01');assert.ok(content.body.length>20);
 assert.equal((await fetch(base+'/api/learner/content',{headers:{Cookie:cookie}})).status,403);
 const draft=await(await fetch(base+'/api/draft',{headers:{Cookie:cookie}})).json();assert.equal(draft.kind,'verified');
 const receipt=await(await fetch(base+'/api/receipt',{headers:{Cookie:cookie}})).json();assert.equal(receipt.current,true);assert.equal(receipt.repair.writes,1);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
test('case portfolio, monitor settings and granted content survive restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'paytrace-ops-')),file=join(dir,'state.sqlite');let db=openStore(file);
 try{const {id}=db.create();const svc=createService(db,{});await svc.scan(id,{graceMinutes:15});await svc.action(id,{action:'investigate'});const r=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:r.state.rehearsal.id});await svc.action(id,{action:'repair'});db.close();db=openStore(file);assert.equal(db.grace(id),15);assert.equal(db.listCases(id).length,7);assert.equal(db.lesson(id).contentId,'light-lesson-01');assert.equal(db.get(id).state.writes,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
