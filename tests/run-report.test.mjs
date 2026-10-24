import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {buildRunReport} from '../dist/run-report.mjs';
import {caseExperience} from '../dist/focus-experience.mjs';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/index.mjs';

function connectedCase(){
 const s=simulatePayment(createCase());s.capture.source='paypal-sandbox';
 s.sources={payment:{status:'available',checkedAt:new Date().toISOString(),system:'PayPal sandbox'},access:{status:'available',checkedAt:new Date().toISOString(),system:'External course access service'}};
 investigate(s);s.review.mode='model';s.analysis={mode:'model',model:'test-model'};
 rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);
 verify(s,{transport:'external-course-service',resource:{contentId:'light-lesson-01',userId:s.order.userId,courseId:s.order.courseId},lessonAvailable:true});
 s.job={kind:'recover',runId:'render-run-1',pending:false,error:null,completed:{repair:{writes:1},verify:{verified:true}}};
 return s;
}

test('connected report requires all six independently recorded criteria',()=>{
 const s=connectedCase(),report=buildRunReport(s,{backend:true});
 assert.equal(report.connectedSandboxProof,true);assert.equal(report.scope,'connected-sandbox');
 assert.equal(report.passed,6);assert.equal(report.checks.every(c=>c.status==='passed'),true);
 assert.match(caseExperience(s,{backend:true}),/Connected sandbox proof/);
 assert.match(caseExperience(s,{backend:true}),/Download run report/);
});

test('scripted and local evidence cannot be presented as a connected sandbox run',()=>{
 const s=simulatePayment(createCase());investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);
 const report=buildRunReport(s,{backend:true});
 assert.equal(report.connectedSandboxProof,false);assert.equal(report.scope,'server-demo');
 assert.equal(report.checks.find(c=>c.id==='payment').status,'demo');
 assert.equal(report.checks.find(c=>c.id==='agents').status,'demo');
 assert.equal(report.checks.find(c=>c.id==='verification').status,'demo');
 assert.doesNotMatch(caseExperience(s,{backend:true}),/Connected sandbox proof/);
});

test('failed Render verification or stale proof removes the connected claim',()=>{
 const s=connectedCase();s.job.completed.verify.verified=false;
 assert.equal(buildRunReport(s,{backend:true}).connectedSandboxProof,false);
 s.job.completed.verify.verified=true;s.revision++;
 const report=buildRunReport(s,{backend:true});
 assert.equal(report.connectedSandboxProof,false);
 assert.equal(report.checks.find(c=>c.id==='verification').status,'pending');
});

test('run report HTTP endpoint belongs to the selected session case',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost'},db);
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 try{
  const start=await fetch(base+'/api/state'),cookie=start.headers.get('set-cookie').split(';')[0],state=(await start.json()).state;
  const report=await(await fetch(base+'/api/run-report?caseId='+encodeURIComponent(state.id),{headers:{Cookie:cookie}})).json();
  assert.equal(report.caseId,state.id);assert.equal(report.connectedSandboxProof,false);
  assert.equal((await fetch(base+'/api/run-report?caseId=other',{headers:{Cookie:cookie}})).status,409);
  assert.equal((await fetch(base+'/api/run-report')).status,401);
 }finally{await new Promise(resolve=>app.server.close(resolve));db.close();}
});
