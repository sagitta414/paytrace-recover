import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {courseAccessClient} from '../server/course-access.mjs';
import {createCourseService} from '../examples/course-service.mjs';

const paypal = {
  create: async () => 'ORDER-sandbox',
  capture: async s => ({id:'CAP-sandbox',orderId:s.id,userId:s.order.userId,courseId:s.order.courseId,amount:12800,currency:'USD',status:'COMPLETED',source:'paypal-sandbox'}),
  refresh: async s => s.capture
};

test('approved sandbox repair writes to a separate course service and verifies its lesson', async () => {
  const db=openStore(':memory:');
  try {
    const {id}=db.create();db.authorize(id);
    let active=false, grants=0, probes=0;
    const course={
      check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active,captureId:active?s.capture.id:null}),
      grant:async s=>{grants++;active=true;return {userId:s.order.userId,courseId:s.order.courseId,active:true,captureId:s.capture.id};},
      probe:async s=>{probes++;return {accessible:active,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id,contentId:'light-lesson-01',body:'Independent protected lesson content returned by the course service.'};}
    };
    const svc=createService(db,{}, {paypal,course});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await svc.action(id,{action:'investigate'});
    const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    const repaired=await svc.action(id,{action:'repair'});
    assert.equal(repaired.state.phase,'verified');
    assert.equal(repaired.state.proof.transport,'external-course-service');
    assert.equal(repaired.state.sources.access.system,'External course access service');
    assert.equal(repaired.state.writes,1);assert.equal(grants,1);assert.equal(probes,1);
    await svc.action(id,{action:'verify'});assert.equal(grants,1);assert.equal(probes,2);
  } finally {db.close();}
});

test('course service grant failure does not record a repair or verify access', async () => {
  const db=openStore(':memory:');
  try {
    const {id}=db.create();db.authorize(id);
    const course={check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active:false,captureId:null}),grant:async()=>{throw Error('course service unavailable');},probe:async()=>{throw Error('locked');}};
    const svc=createService(db,{}, {paypal,course});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await assert.rejects(svc.customerLesson(id,created.state.id),/still being checked/);
    await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    await assert.rejects(svc.action(id,{action:'repair'}),/uncertain/);
    assert.equal(db.get(id).state.writes,0);assert.equal(db.get(id).state.phase,'approved');
  } finally {db.close();}
});

test('external lesson outage leaves the approved grant unverified and retry only probes', async () => {
  const db=openStore(':memory:');
  try {
    const {id}=db.create();db.authorize(id);let active=false,grants=0,probes=0;
    const course={
      check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active,captureId:active?s.capture.id:null}),
      grant:async s=>{grants++;active=true;return {userId:s.order.userId,courseId:s.order.courseId,active:true,captureId:s.capture.id};},
      probe:async s=>{probes++;if(probes===1)throw Error('lesson service unavailable');return {accessible:true,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id,contentId:'light-lesson-01',body:'Protected course content is available again.'};}
    };
    const svc=createService(db,{}, {paypal,course});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    const first=await svc.action(id,{action:'repair'});
    assert.equal(first.state.phase,'unverified');assert.equal(first.state.writes,1);
    const second=await svc.action(id,{action:'verify'});
    assert.equal(second.state.phase,'verified');assert.equal(grants,1);assert.equal(probes,2);
  } finally {db.close();}
});

test('HTTP adapter pins identities and reuses a stable grant idempotency key', async () => {
  const calls=[];let active=false;
  const fetcher=async (url,options)=>{
    calls.push({url:String(url),headers:options.headers,body:JSON.parse(options.body)});
    const x=JSON.parse(options.body);
    if(String(url).endsWith('/grants'))active=true;
    if(String(url).endsWith('/lesson-probe'))return Response.json({accessible:active,userId:x.userId,courseId:x.courseId,captureId:x.captureId,contentId:'light-lesson-01',body:'Protected lesson content from another service.'});
    return Response.json({userId:x.userId,courseId:x.courseId,active,captureId:active?x.captureId:null});
  };
  const client=courseAccessClient({COURSE_ACCESS_URL:'https://courses.example/v1/../',COURSE_ACCESS_API_KEY:'test-key'},fetcher);
  const s={id:'CL-1',order:{userId:'learner-1',courseId:'course-1'},capture:{id:'CAP-1',status:'COMPLETED',source:'paypal-sandbox'}};
  assert.equal((await client.check(s)).active,false);
  assert.equal((await client.grant(s)).active,true);
  assert.equal((await client.probe(s)).accessible,true);
  assert.equal(calls[1].headers['Idempotency-Key'],'paytrace:CL-1:CAP-1');
  assert.equal(calls[1].headers.Authorization,'Bearer test-key');
  assert.equal(calls[1].body.userId,'learner-1');
  assert.throws(()=>courseAccessClient({COURSE_ACCESS_URL:'http://courses.example',COURSE_ACCESS_API_KEY:'secret'}),/HTTPS/);
  const wrong=courseAccessClient({COURSE_ACCESS_URL:'https://courses.example',COURSE_ACCESS_API_KEY:'secret'},async()=>Response.json({userId:'other',courseId:'course-1',active:true,captureId:'CAP-1'}));
  await assert.rejects(wrong.check(s),/mismatched/);
});

test('reference course service stores one independent grant and protects lesson content', async () => {
  const {server,close}=createCourseService({key:'local-private-test-key',file:':memory:'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url=`http://127.0.0.1:${server.address().port}`;
    const client=courseAccessClient({COURSE_ACCESS_URL:url,COURSE_ACCESS_API_KEY:'local-private-test-key'});
    const s={id:'CL-case',order:{userId:'learner-1',courseId:'course-1'},capture:{id:'CAP-1',status:'COMPLETED',source:'paypal-sandbox'}};
    assert.equal((await client.check(s)).active,false);
    await assert.rejects(client.probe(s),/HTTP 403/);
    await client.grant(s);await client.grant(s);
    assert.equal((await client.check(s)).active,true);
    assert.equal((await client.probe(s)).accessible,true);
    const refunded={...s,capture:{...s.capture,status:'REFUNDED'}};
    assert.equal((await client.suspend(refunded)).active,false);
    assert.equal((await client.suspend(refunded)).active,false);
    assert.equal((await client.check(s)).active,false);
    await assert.rejects(client.probe(s),/HTTP 403/);
    await assert.rejects(client.grant(s),/HTTP 409/);
    const wrong={...s,order:{...s.order,userId:'other'}};
    await assert.rejects(client.check(wrong),/HTTP 409/);
    const unauthorized=await fetch(url+'/v1/access/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:s.id,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id})});
    assert.equal(unauthorized.status,401);
  } finally {await new Promise(resolve=>server.close(resolve));close();}
});

test('PayTrace completes a sandbox case through the separate HTTP course service', async () => {
  const {server,close}=createCourseService({key:'local-private-test-key',file:':memory:'});
  const db=openStore(':memory:');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const {id}=db.create();db.authorize(id);
    const env={COURSE_ACCESS_URL:`http://127.0.0.1:${server.address().port}`,COURSE_ACCESS_API_KEY:'local-private-test-key'};
    const svc=createService(db,env,{paypal});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    const result=await svc.action(id,{action:'repair'});
    assert.equal(result.state.phase,'verified');
    assert.equal(result.state.proof.transport,'external-course-service');
    assert.equal(result.state.proof.checks.every(item=>item.ok),true);
    assert.equal(db.readAccess(id,result.state).active,false);
    assert.equal((await svc.customerLesson(id,result.state.id)).accessible,true);
    const retry=await svc.action(id,{action:'repair'});
    assert.equal(retry.state.writes,1);
  } finally {await new Promise(resolve=>server.close(resolve));close();db.close();}
});

test('fresh refunded capture suspends the exact course entitlement and keeps the case on hold',async()=>{
  const {server,close}=createCourseService({key:'local-private-test-key',file:':memory:'}),db=openStore(':memory:');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const {id}=db.create();db.authorize(id);let status='COMPLETED';
   const source={...paypal,refresh:async s=>({...s.capture,status})};
   const env={COURSE_ACCESS_URL:`http://127.0.0.1:${server.address().port}`,COURSE_ACCESS_API_KEY:'local-private-test-key'};
   const svc=createService(db,env,{paypal:source});
   const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
   await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
   await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});
   await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});await svc.action(id,{action:'repair'});
   status='REFUNDED';await svc.scan(id);
   const held=db.caseById(id,created.state.id),client=courseAccessClient(env);
   assert.equal(held.paymentHold.status,'REFUNDED');assert.equal(held.paymentHold.externalSuspended,true);
   assert.equal((await client.check(held)).active,false);
   await assert.rejects(client.probe(held),/HTTP 403/);
   await assert.rejects(svc.customerLesson(id,held.id),/Payment is on hold/);
   await assert.rejects(svc.action(id,{action:'repair'}));
  }finally{await new Promise(resolve=>server.close(resolve));close();db.close();}
});

test('a mismatched refunded capture holds PayTrace but cannot suspend the course account',async()=>{
  const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);let status='COMPLETED',active=false,suspensions=0;
   const source={...paypal,refresh:async s=>({...s.capture,status,amount:status==='REFUNDED'?s.order.amount-1:s.order.amount})};
   const course={check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active,captureId:active?s.capture.id:null}),grant:async s=>{active=true;return {userId:s.order.userId,courseId:s.order.courseId,active:true,captureId:s.capture.id};},suspend:async()=>{suspensions++;active=false;},probe:async s=>({accessible:active,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id,contentId:'light-lesson-01',body:'Protected content belongs to this exact paid purchase.'})};
   const svc=createService(db,{}, {paypal:source,course});
   const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
   await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
   await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});await svc.action(id,{action:'repair'});
   status='REFUNDED';await svc.scan(id);const held=db.caseById(id,created.state.id);
   assert.equal(held.paymentHold.suspensionState,'identity-mismatch');assert.equal(suspensions,0);assert.equal(active,true);
   await assert.rejects(svc.customerLesson(id,held.id),/Payment is on hold/);
  }finally{db.close();}
});

test('an interrupted suspension stays on hold and retries the same purchase operation',async()=>{
  const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);let status='COMPLETED',active=false,attempts=0;const keys=[];
   const source={...paypal,refresh:async s=>({...s.capture,status})};
   const course={check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active,captureId:active?s.capture.id:null}),grant:async s=>{active=true;return {userId:s.order.userId,courseId:s.order.courseId,active:true,captureId:s.capture.id};},suspend:async(s,key)=>{attempts++;keys.push(key);if(attempts===1)throw Error('network interrupted');active=false;return {userId:s.order.userId,courseId:s.order.courseId,active:false,captureId:null};},probe:async s=>({accessible:active,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id,contentId:'light-lesson-01',body:'Protected content belongs to this exact paid purchase.'})};
   const svc=createService(db,{}, {paypal:source,course});
   const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
   await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
   await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});await svc.action(id,{action:'repair'});
   status='REFUNDED';await svc.scan(id);let held=db.caseById(id,created.state.id);
   assert.equal(held.paymentHold.suspensionState,'pending');assert.equal(active,true);
   await svc.scan(id);held=db.caseById(id,created.state.id);
   assert.equal(held.paymentHold.externalSuspended,true);assert.equal(active,false);assert.equal(attempts,2);assert.equal(keys[0],keys[1]);
  }finally{db.close();}
});

test('an ambiguous external grant is reconciled without sending a second grant', async () => {
  const db=openStore(':memory:');
  try {
    const {id}=db.create();db.authorize(id);
    let active=false,grants=0;
    const course={
      check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active,captureId:active?s.capture.id:null}),
      grant:async()=>{grants++;active=true;throw Error('Transport timed out after the grant');},
      probe:async s=>({accessible:active,userId:s.order.userId,courseId:s.order.courseId,captureId:s.capture.id,contentId:'light-lesson-01',body:'An independently protected lesson was returned to the learner.'})
    };
    const svc=createService(db,{}, {paypal,course});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await svc.action(id,{action:'investigate'});
    const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    await assert.rejects(svc.action(id,{action:'repair'}),/uncertain/);
    assert.equal(grants,1);assert.equal(db.accessIntent(id,created.state.id).state,'uncertain');
    const result=await svc.action(id,{action:'repair'});
    assert.equal(grants,1);assert.equal(result.state.writes,1);assert.equal(result.state.phase,'verified');
  } finally {db.close();}
});

test('a payment reversal trigger places the case on hold before any new grant', async () => {
  const db=openStore(':memory:');
  try {
    const {id}=db.create();db.authorize(id);
    let status='COMPLETED',grants=0;
    const source={...paypal,refresh:async s=>({...s.capture,status})};
    const course={check:async s=>({userId:s.order.userId,courseId:s.order.courseId,active:false,captureId:null}),grant:async()=>{grants++;throw Error('Must not grant');},probe:async()=>{throw Error('Locked');}};
    const svc=createService(db,{}, {paypal:source,course});
    const created=await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'});
    await svc.paypalCreate(id,created.state.id);await svc.paypalCapture(id,'ORDER-sandbox',created.state.id);
    await svc.action(id,{action:'investigate'});const preview=await svc.action(id,{action:'rehearse'});
    await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});
    status='REVERSED';
    const event={id:'WH-reversal-1',event_type:'PAYMENT.CAPTURE.REVERSED',resource:{supplementary_data:{related_ids:{order_id:'ORDER-sandbox'}}}};
    const response=await svc.paypalWebhook(event);
    assert.equal(response.hold,true);assert.equal(db.get(id).state.paymentHold.status,'REVERSED');
    await assert.rejects(svc.action(id,{action:'repair'}));
    await assert.rejects(svc.customerLesson(id,created.state.id),/Payment is on hold/);
    assert.equal(grants,0);
  } finally {db.close();}
});
