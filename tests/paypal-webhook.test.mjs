import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/index.mjs';
import {paypalClient} from '../server/paypal.mjs';

const event=(orderId,captureId='CAP-12345',id='WH-12345')=>({id,event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:captureId,status:'COMPLETED',supplementary_data:{related_ids:{order_id:orderId}}}});

test('signed capture event finds only its sandbox case, confirms PayPal again, and never grants access', async()=>{
  const db=openStore(':memory:');let refreshes=0,verifications=0;
  const paypal={
    create:async()=> 'PP-12345',
    capture:async()=>{throw Error('Webhook must not call capture.');},
    refresh:async s=>{refreshes++;return {id:'CAP-12345',orderId:s.id,userId:s.order.userId,courseId:s.order.courseId,amount:s.order.amount,currency:s.order.currency,status:'COMPLETED',source:'paypal-sandbox'};},
    verifyWebhook:async(raw)=>{verifications++;return JSON.parse(raw).id!=='WH-other';}
  };
  const app=createApp({PUBLIC_URL:'http://localhost',DEMO_OPERATOR_KEY:'operator',PAYPAL_CLIENT_ID:'test',PAYPAL_CLIENT_SECRET:'test',PAYPAL_WEBHOOK_ID:'WEBHOOK-test'},db,{paypal});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const start=await fetch(base+'/api/state'),cookie=start.headers.get('set-cookie').split(';')[0];
    const post=(path,body)=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(body)});
    const created=await(await post('/api/action',{action:'create-case',requestId:randomUUID(),customerName:'Maya',mode:'sandbox'})).json();
    await post('/api/operator',{key:'operator'});
    const order=await(await post('/api/paypal/create',{caseId:created.state.id})).json();
    assert.equal(order.id,'PP-12345');
    const deliver=e=>fetch(base+'/api/paypal/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
    assert.equal((await(await deliver(event('PP-12345','CAP-12345','WH-other'))).status),401);
    assert.equal(db.get(cookie.slice(11)).state.capture,null);
    const first=await deliver(event('PP-12345'));
    assert.equal(first.status,200);assert.equal((await first.json()).status,'processed');
    const state=db.get(cookie.slice(11)).state;
    assert.equal(state.capture.id,'CAP-12345');assert.equal(state.writes,0);assert.equal(state.entitlement.active,false);
    assert.equal(state.sources.payment.status,'available');assert.equal(state.sources.access.status,'available');
    const count=refreshes;
    assert.equal((await(await deliver(event('PP-12345'))).json()).status,'duplicate');
    assert.equal(refreshes,count);assert.equal(verifications,3);
    assert.equal((await(await deliver(event('PP-unmatched','CAP-12345','WH-unmatched'))).json()).status,'unmatched');
  }finally{await new Promise(resolve=>app.server.close(resolve));db.close();}
});

test('fresh PayPal mismatch blocks webhook processing without recording payment',async()=>{
  const db=openStore(':memory:');
  try{
    const {id}=db.create();const s=db.get(id).state;s.intakeMode='sandbox';s.capture=null;s.paypalOrderId='PP-12345';db.save(id,s);
    const {createService}=await import('../server/service.mjs');
    const svc=createService(db,{}, {paypal:{refresh:async()=>({...s.order,id:'CAP-other',status:'COMPLETED'}),create:async()=>{},capture:async()=>{}}});
    await assert.rejects(svc.paypalWebhook(event('PP-12345')),/Fresh PayPal capture/);
    assert.equal(db.get(id).state.capture,null);assert.equal(db.webhookSeen('WH-12345'),false);
  }finally{db.close();}
});

test('PayPal verification postback keeps the event JSON unchanged and uses sandbox credentials',async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url:String(url),options});return String(url).endsWith('/token')?Response.json({access_token:'sandbox-token',expires_in:3600}):Response.json({verification_status:'SUCCESS'});};
  const paypal=paypalClient({PAYPAL_CLIENT_ID:'client',PAYPAL_CLIENT_SECRET:'secret',PAYPAL_WEBHOOK_ID:'WEBHOOK-test'},fetcher);
  const raw='{ "id": "WH-12345", "event_type": "PAYMENT.CAPTURE.COMPLETED" }';
  const headers={'paypal-transmission-id':'transmission','paypal-transmission-time':'2026-10-22T10:00:00Z','paypal-cert-url':'https://api.sandbox.paypal.com/cert','paypal-auth-algo':'SHA256withRSA','paypal-transmission-sig':'signature'};
  assert.equal(await paypal.verifyWebhook(raw,headers),true);
  assert.match(calls[1].url,/api-m\.sandbox\.paypal\.com\/v1\/notifications\/verify-webhook-signature/);
  assert.ok(calls[1].options.body.includes('"webhook_event":'+raw));
  assert.equal(JSON.parse(calls[1].options.body).webhook_id,'WEBHOOK-test');
  await assert.rejects(paypal.verifyWebhook(raw,{}),/signature headers/);
});
