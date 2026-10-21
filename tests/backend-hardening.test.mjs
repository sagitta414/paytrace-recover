import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {createApp} from '../server/index.mjs';
const workflowEnv={RENDER_API_KEY:'test',WORKFLOW_SECRET:'test',RENDER_INVESTIGATE_TASK:'investigate',RENDER_RECOVER_TASK:'recover'};
async function prepare(svc,id){await svc.action(id,{action:'investigate'});const r=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:r.state.rehearsal.id});}

test('workflow callbacks enforce order and completed callbacks do not regress state',async()=>{
 const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);const svc=createService(db,workflowEnv,{fetcher:async()=>Response.json({id:'run-test'})});
 const queued=await svc.action(id,{action:'investigate'}),job=queued.state.job.id;
 await assert.rejects(svc.stage(id,'analyze',job),/in order/);await assert.rejects(svc.stage(id,'record',job),/in order/);
 const gathered=await svc.stage(id,'gather',job);await svc.stage(id,'analyze',job);await svc.stage(id,'record',job);
 const events=db.get(id).state.events.length;assert.equal(db.get(id).state.phase,'investigated');
 assert.deepEqual(await svc.stage(id,'gather',job),gathered);assert.equal(db.get(id).state.phase,'investigated');assert.equal(db.get(id).state.events.length,events);
 const preview=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:preview.state.rehearsal.id});const recovery=await svc.action(id,{action:'repair'}),repairJob=recovery.state.job.id;
 await assert.rejects(svc.stage(id,'verify',repairJob),/in order/);await svc.stage(id,'repair',repairJob);await svc.stage(id,'verify',repairJob);
 const before=db.get(id).state;await svc.stage(id,'repair',repairJob);await svc.stage(id,'verify',repairJob);const after=db.get(id).state;
 assert.equal(after.writes,1);assert.equal(after.reads,1);assert.deepEqual(after.events,before.events);assert.equal(after.phase,'verified');
 await assert.rejects(svc.stage(id,'gather',job),/obsolete/);
 }finally{db.close();}
});

test('workflow retries resume a failed stage without replaying completed stages',async()=>{
 const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);let unavailable=true;const svc=createService(db,workflowEnv,{fetcher:async()=>Response.json({id:'run'}),access:(owner,s)=>{if(unavailable)throw Error('outage');return db.readAccess(owner,s);}});
 const queued=await svc.action(id,{action:'investigate'}),job=queued.state.job.id;await assert.rejects(svc.stage(id,'gather',job),/unavailable/);assert.equal(db.get(id).state.job.pending,false);
 unavailable=false;await svc.stage(id,'gather',job);assert.equal(db.get(id).state.job.pending,true);await svc.stage(id,'analyze',job);await svc.stage(id,'record',job);assert.equal(db.get(id).state.phase,'investigated');
 }finally{db.close();}
});

test('stale browser actions and sandbox callbacks cannot target a different selected case',async()=>{
 const db=openStore(':memory:');try{const {id,state:first}=db.create(),svc=createService(db,{});await prepare(svc,id);const other=db.listCases(id).find(s=>s.id!==first.id);await svc.action(id,{action:'select-case',caseId:other.id});
 for(const action of ['repair','verify','investigate','reset','pay'])await assert.rejects(svc.action(id,{action,caseId:first.id}),/selected case changed/);
 assert.equal(db.caseById(id,first.id).writes,0);assert.equal(db.caseById(id,other.id).writes,0);db.authorize(id);
 await assert.rejects(svc.paypalCreate(id,first.id),/selected case changed/);await assert.rejects(svc.paypalCapture(id,'foreign',first.id),/selected case changed/);
 }finally{db.close();}
});

test('retrying sandbox capture refreshes provider evidence without capturing again',async()=>{
 const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);let captureCalls=0,refreshCalls=0;const svc=createService(db,{}, {paypal:{create:async()=> 'PP-test',capture:async s=>{captureCalls++;return {id:'CAP-test',source:'paypal-sandbox',orderId:s.id,userId:s.order.userId,courseId:s.order.courseId,status:'COMPLETED',amount:12800,currency:'USD'};},refresh:async s=>{refreshCalls++;return {...s.capture,status:'REFUNDED'};}}});
 await svc.action(id,{action:'create-case',requestId:randomUUID(),customerName:'Test Buyer',mode:'sandbox'});await svc.paypalCreate(id);await svc.paypalCapture(id,'PP-test');const retry=await svc.paypalCapture(id,'PP-test');assert.equal(retry.state.capture.status,'REFUNDED');assert.equal(captureCalls,1);assert.equal(refreshCalls,1);assert.equal(retry.state.writes,0);
 }finally{db.close();}
});

test('HTTP rejects non-object JSON, oversized bytes, wrong media types, and stale case reads',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost'},db);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{const state=await fetch(base+'/api/state'),cookie=state.headers.get('set-cookie').split(';')[0];await state.json();
 const post=(path,body,type='application/json')=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:'http://localhost','Content-Type':type},body});
 for(const body of ['null','[]','true','"hello"','{'])assert.equal((await post('/api/action',body)).status,400);
 assert.equal((await post('/api/action','{}','application/jsonp')).status,415);
 assert.equal((await post('/api/action',JSON.stringify({text:'界'.repeat(7000)}))).status,413);
 assert.equal((await post('/api/action',JSON.stringify({action:'create-case',requestId:randomUUID(),customerName:'Zoë 林',mode:'sample'}),'application/json; charset=utf-8')).status,200);
 for(const endpoint of ['lesson','draft','receipt'])assert.equal((await fetch(base+'/api/'+endpoint+'?caseId=other',{headers:{Cookie:cookie}})).status,409);
 assert.equal((await post('/api/learner/session',JSON.stringify({caseId:'other'}))).status,409);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});

test('completed workflow stages remain replay-safe after database reopen',async()=>{
 const {mkdtempSync,rmdirSync,existsSync,unlinkSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'paytrace-job-')),file=join(dir,'test.sqlite');let db=openStore(file);
 try{const {id}=db.create();db.authorize(id);let svc=createService(db,workflowEnv,{fetcher:async()=>Response.json({id:'run'})});const queued=await svc.action(id,{action:'investigate'}),job=queued.state.job.id;const gathered=await svc.stage(id,'gather',job);db.close();db=openStore(file);svc=createService(db,workflowEnv);assert.deepEqual(await svc.stage(id,'gather',job),gathered);await svc.stage(id,'analyze',job);await svc.stage(id,'record',job);assert.equal(db.get(id).state.phase,'investigated');
 }finally{db.close();for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);rmdirSync(dir);}
});
