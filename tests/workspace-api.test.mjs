import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
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
