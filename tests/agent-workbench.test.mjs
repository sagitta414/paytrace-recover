import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {agentBrief} from '../dist/focus-agent-workbench.mjs';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/index.mjs';

test('decision brief distinguishes supported preview, blocked purchase, and stale review',()=>{
 const ready=investigate(simulatePayment(createCase()));let brief=agentBrief(ready);assert.equal(brief.tone,'ready');assert.match(brief.next,/Preview/);assert.ok(brief.confirmed.includes('Completed payment'));
 const blocked=investigate(simulatePayment(createCase('conflict')));brief=agentBrief(blocked);assert.equal(brief.tone,'blocked');assert.ok(brief.open.some(text=>text.includes('Correct order')));
 ready.capture.amount=1;brief=agentBrief(ready);assert.equal(brief.tone,'stale');assert.deepEqual(brief.confirmed,[]);
 const recovered=rehearse(investigate(simulatePayment(createCase())));approve(recovered,recovered.rehearsal.id);applyRepair(recovered);brief=agentBrief(recovered);assert.match(brief.next,/Do not repeat/);verify(recovered);assert.match(agentBrief(recovered).title,/verified/);
});

test('agent follow-up endpoint requires same-origin operator session and a current model review',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost',DEMO_OPERATOR_KEY:'test-key'},db);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 try{const page=await(await fetch(base+'/focus.html')).text();assert.match(page,/focus-agent-workbench.css/);assert.equal((await fetch(base+'/focus-agent-workbench.mjs')).status,200);const first=await fetch(base+'/api/state'),cookie=first.headers.get('set-cookie').split(';')[0],state=(await first.json()).state;const body=JSON.stringify({caseId:state.id,agent:0,question:'Does this payment match?',requestId:'52736f41-dccb-49d8-a5ac-bc7afde7c4e7'}),post=(origin,headers={})=>fetch(base+'/api/agent/question',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body});
 assert.equal((await post('http://localhost')).status,401);
 assert.equal((await post('http://localhost',{Cookie:cookie})).status,403);
 assert.equal((await post('http://evil.test',{Cookie:cookie})).status,403);
 assert.equal((await fetch(base+'/api/operator',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({key:'test-key'})})).status,200);
 const unavailable=await post('http://localhost',{Cookie:cookie});assert.equal(unavailable.status,400);assert.match((await unavailable.json()).error,/current model-backed review/);
 assert.equal(db.get(cookie.slice(11)).state.writes,0);
 }finally{await new Promise(resolve=>app.server.close(resolve));db.close();}
});
