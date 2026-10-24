import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/store.mjs';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {waitingOn} from '../dist/focus-actions.mjs';
import {checkConnection} from '../server/connection-check.mjs';
import {createApp} from '../server/index.mjs';

test('waiting status follows payment, approval, verification and customer handoff',()=>{
 const s=createCase();assert.equal(waitingOn(s),'payment');simulatePayment(s);investigate(s);rehearse(s);assert.equal(waitingOn(s),'approval');approve(s,s.rehearsal.id);applyRepair(s);assert.equal(waitingOn(s),'verification');verify(s);assert.equal(waitingOn(s),'customer');
});
test('reminders persist, belong to one workspace, and never appear in customer projection',()=>{
 const db=openStore(':memory:');try{const a=db.create(),b=db.create(),id=a.state.id,dueAt=new Date(Date.now()+3600000).toISOString();assert.throws(()=>db.support.reminder(a.id,id,new Date(Date.now()-3600000).toISOString()),/future/);db.support.reminder(a.id,id,dueAt,'Ask about access');assert.equal(db.support.reminders(a.id).length,1);assert.equal(db.support.reminders(b.id).length,0);assert.equal(db.support.view(a.id,id).reminder,undefined);db.support.reminder(a.id,id,null);assert.equal(db.support.reminders(a.id).length,0);}finally{db.close();}
});
test('connection checks distinguish configuration, accepted credentials and failure without returning secrets',async()=>{
 assert.equal((await checkConnection('paypal',{},async()=>{throw Error('should not call provider')})).state,'not-configured');
 let called=0;const fetcher=async(url)=>{called++;assert.match(url,/sandbox\.paypal/);return {ok:true,status:200};};const result=await checkConnection('paypal',{PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret'},fetcher);assert.equal(result.state,'connected');assert.equal(called,1);assert.ok(!JSON.stringify(result).includes('secret'));
 const failed=await checkConnection('ai',{OPENAI_API_KEY:'secret',OPENAI_MODEL:'missing'},async()=>({status:404}));assert.equal(failed.state,'failed');assert.ok(!JSON.stringify(failed).includes('secret'));
});
test('course connection check reads a new entitlement without granting access',async()=>{
 const env={COURSE_ACCESS_URL:'https://course.example.test/',COURSE_ACCESS_API_KEY:'private-test-key'};
 assert.equal((await checkConnection('access',{},async()=>{throw Error('must not call')})).state,'not-configured');
 const paths=[];
 const fetcher=async(url,options)=>{paths.push(new URL(url).pathname);assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer private-test-key');assert.equal(options.headers['Idempotency-Key'],undefined);const body=JSON.parse(options.body);assert.match(body.caseId,/^paytrace-connection-/);return {ok:true,status:200,json:async()=>({userId:body.userId,courseId:body.courseId,active:false,captureId:null})};};
 const result=await checkConnection('access',env,fetcher);assert.equal(result.state,'connected');assert.deepEqual(paths,['/v1/access/check']);assert.ok(!JSON.stringify(result).includes('private-test-key'));
 const denied=await checkConnection('access',env,async()=>({ok:false,status:401}));assert.equal(denied.state,'failed');
});
test('connection check HTTP requires operator and reminder writes require matching origin',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost'},db);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{const state=await fetch(base+'/api/state'),cookie=state.headers.get('set-cookie').split(';')[0],body=await state.json();const check=await fetch(base+'/api/connection-check?kind=paypal',{headers:{Cookie:cookie}});assert.equal(check.status,403);
 const payload=JSON.stringify({caseId:body.state.id,dueAt:new Date(Date.now()+3600000).toISOString(),note:'Follow up',requestId:randomUUID()});const post=await fetch(base+'/api/support/reminder',{method:'POST',headers:{Cookie:cookie,Origin:'http://malicious.example','Content-Type':'application/json'},body:payload});assert.equal(post.status,403);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
