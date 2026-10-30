import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,existsSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/index.mjs';

test('workspace pulse is scoped, includes customer help, and gates the CSV export',async()=>{
  const store=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost',DEMO_OPERATOR_KEY:'operator-test'},store);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;
  try{
    const first=await fetch(base+'/api/state'),cookie=first.headers.get('set-cookie').split(';')[0],state=(await first.json()).state;
    const other=await fetch(base+'/api/state'),otherCookie=other.headers.get('set-cookie').split(';')[0],otherState=(await other.json()).state;
    store.support.mutate(cookie.split('=')[1],state.id,{action:'help',text:'Private buyer message',requestId:randomUUID()});
    assert.equal((await fetch(base+'/api/workspace')).status,401);
    const overview=await(await fetch(base+'/api/workspace',{headers:{Cookie:cookie}})).json();
    assert.equal(overview.counts.customerWaiting,1);
    assert.ok(overview.rows.some(row=>row.caseId===state.id));
    assert.ok(!JSON.stringify(overview).includes('Private buyer message'));
    const otherOverview=await(await fetch(base+'/api/workspace',{headers:{Cookie:otherCookie}})).json();
    assert.ok(otherOverview.rows.some(row=>row.caseId===otherState.id));
    assert.ok(!otherOverview.rows.some(row=>row.caseId===state.id));
    assert.equal((await fetch(base+'/api/workspace/export',{headers:{Cookie:cookie}})).status,403);
    const unlocked=await fetch(base+'/api/operator',{method:'POST',headers:{Cookie:cookie,Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({key:'operator-test'})});
    assert.equal(unlocked.status,200);
    const response=await fetch(base+'/api/workspace/export',{headers:{Cookie:cookie}}),csv=await response.text();
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/text\/csv/);
    assert.ok(csv.includes(state.id));
    assert.ok(!csv.includes(otherState.id));
    assert.ok(!csv.includes('Private buyer message'));
  }finally{await new Promise(resolve=>app.server.close(resolve));store.close();}
});

test('merchant priority is scoped, revision checked, and does not change recovery approval',async()=>{
  const store=openStore(':memory:'),app=createApp({PUBLIC_URL:'http://localhost',DEMO_OPERATOR_KEY:'operator-test'},store);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;
  try{
    const first=await fetch(base+'/api/state'),cookie=first.headers.get('set-cookie').split(';')[0],state=(await first.json()).state;
    const other=await fetch(base+'/api/state'),otherCookie=other.headers.get('set-cookie').split(';')[0];
    const url=base+'/api/case/priority?caseId='+encodeURIComponent(state.id);
    const post=(body,sessionCookie=cookie,origin='http://localhost')=>fetch(base+'/api/case/priority',{method:'POST',headers:{Cookie:sessionCookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await fetch(url,{headers:{Cookie:cookie}})).status,403);
    assert.equal((await post({caseId:state.id,priority:'high',expectedRevision:0})).status,403);
    await fetch(base+'/api/operator',{method:'POST',headers:{Cookie:cookie,Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({key:'operator-test'})});
    const before=store.caseById(cookie.split('=')[1],state.id);
    assert.equal((await post({caseId:state.id,priority:'high',expectedRevision:0},cookie,'https://other.test')).status,403);
    const results=await Promise.all([post({caseId:state.id,priority:'high',expectedRevision:0}),post({caseId:state.id,priority:'low',expectedRevision:0})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const current=await(await fetch(url,{headers:{Cookie:cookie}})).json();
    assert.equal(current.revision,1);
    assert.equal((await post({caseId:state.id,priority:'normal',expectedRevision:1},otherCookie)).status,403);
    const pulse=await(await fetch(base+'/api/workspace',{headers:{Cookie:cookie}})).json();
    assert.equal(pulse.rows.find(row=>row.caseId===state.id).priority,current.priority);
    const after=store.caseById(cookie.split('=')[1],state.id);
    assert.deepEqual(after.approval,before.approval);
    assert.equal(after.writes,before.writes);
    assert.equal(after.revision,before.revision);
  }finally{await new Promise(resolve=>app.server.close(resolve));store.close();}
});

test('merchant priority survives a database restart and cannot target another workspace',()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrace-priority-')),file=join(directory,'cases.sqlite');
  let store=openStore(file);
  try{
    const first=store.create(),second=store.create();
    assert.equal(store.setCasePriority(first.id,first.state.id,'high',0).revision,1);
    assert.throws(()=>store.casePriority(second.id,first.state.id),/does not belong/);
    store.close();store=openStore(file);
    assert.equal(store.casePriority(first.id,first.state.id).priority,'high');
    assert.equal(store.casePriority(first.id,first.state.id).revision,1);
  }finally{
    store.close();
    for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);
    rmdirSync(directory);
  }
});
