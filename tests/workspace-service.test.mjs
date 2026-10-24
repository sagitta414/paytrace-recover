import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';
import {createApp} from '../server/index.mjs';
import {fingerprint} from '../dist/core.mjs';

test('priorities persist and concurrent edits cannot overwrite each other or invalidate approval',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'paytrace-priority-')),file=join(dir,'test.sqlite');let db=openStore(file);
 try{const {id,state}=db.create(),svc=createService(db,{});await svc.action(id,{action:'investigate'});let result=await svc.action(id,{action:'rehearse'});await svc.action(id,{action:'approve',planId:result.state.rehearsal.id});const before=fingerprint(db.get(id).state),approved=db.get(id).state.approval;
 const saved=db.setCasePriority(id,state.id,'high',0);assert.equal(saved.revision,1);assert.throws(()=>db.setCasePriority(id,state.id,'low',0),e=>e.status===409);assert.throws(()=>db.setCasePriority(id,state.id,'invalid',1));assert.equal(fingerprint(db.get(id).state),before);assert.deepEqual(db.get(id).state.approval,approved);
 db.close();db=openStore(file);assert.equal(db.casePriority(id,state.id).priority,'high');assert.equal(db.casePriority(id,state.id).revision,1);assert.equal(db.get(id).state.phase,'approved');
 }finally{db.close();for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);rmdirSync(dir);}
});

test('workspace metrics include due reminders and customer replies without exposing their text',async()=>{const db=openStore(':memory:');try{const {id,state}=db.create();const now=Date.now();db.support.reminder(id,state.id,new Date(now+60000).toISOString(),'private reminder detail');db.support.mutate(id,state.id,{action:'help',text:'private customer detail',requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});let reads=0;const svc=createService(db,{}, {clock:()=>now+61000,access:()=>{reads++;throw Error('must not make provider calls');}});const data=await svc.overview(id);assert.equal(data.counts.followupsDue,1);assert.equal(data.counts.customerWaiting,1);assert.equal(data.urgent[0].caseId,state.id);assert.equal(reads,0);assert.ok(!JSON.stringify(data).includes('private reminder detail'));assert.ok(!JSON.stringify(data).includes('private customer detail'));}finally{db.close();}});

test('workspace HTTP endpoints enforce owner scope, origins, revisions and safe export',async()=>{
 const db=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost'},db);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{const a=await fetch(base+'/api/state'),ac=a.headers.get('set-cookie').split(';')[0],sa=(await a.json()).state,b=await fetch(base+'/api/state'),bc=b.headers.get('set-cookie').split(';')[0],sb=(await b.json()).state;
 const post=(body,cookie=ac,origin='http://localhost')=>fetch(base+'/api/case/priority',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/workspace')).status,401);assert.equal((await fetch(base+'/api/workspace/export')).status,401);
 assert.equal((await post({caseId:sa.id,priority:'high',expectedRevision:0},ac,'https://evil.test')).status,403);
 assert.equal((await post({caseId:sa.id,priority:'high',expectedRevision:0},bc)).status,400);
 const results=await Promise.all([post({caseId:sa.id,priority:'high',expectedRevision:0}),post({caseId:sa.id,priority:'low',expectedRevision:0})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const priority=await(await fetch(base+'/api/case/priority?caseId='+sa.id,{headers:{Cookie:ac}})).json();assert.equal(priority.revision,1);
 const workspace=await(await fetch(base+'/api/workspace',{headers:{Cookie:ac}})).json();assert.ok(workspace.rows.some(r=>r.caseId===sa.id));assert.ok(!workspace.rows.some(r=>r.caseId===sb.id));assert.equal(db.get(ac.split('=')[1]).state.id,sa.id);
 const exportResponse=await fetch(base+'/api/workspace/export',{headers:{Cookie:ac}});assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-type'),/text\/csv/);assert.match(exportResponse.headers.get('content-disposition'),/attachment/);const csv=await exportResponse.text();assert.ok(csv.includes(sa.id));assert.ok(!csv.includes(sb.id));assert.match(csv,/Source status/);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
