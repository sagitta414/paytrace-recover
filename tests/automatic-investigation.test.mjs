import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.mjs';
import {createService} from '../server/service.mjs';

function model(){let calls=0;return async(_url,options)=>{const body=JSON.parse(options.body),input=JSON.parse(body.input),properties=body.text.format.schema.properties;calls++;let value;
 if(properties.objections)value={objections:[{question:'Does the payment match this purchase?',category:'identity',sources:['payment','order']}]};
 else if(properties.answers)value={answers:input.objections.map(o=>({id:o.id,summary:'The cited payment and order match.',sources:['payment','order']}))};
 else if(properties.decisions)value={summary:'The payment matches; access remains missing.',unknown:'The enrollment failure cause is unknown.',sources:['payment','store'],decisions:input.objections.map(o=>({id:o.id,summary:'The exact capture matches.',sources:['payment','order'],status:'resolved'}))};
 else value={summary:'Payment and access records were reviewed.',unknown:'The root cause is unknown.',sources:['payment','order']};
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});};}

test('automatic investigation waits for a known overdue sandbox purchase, then stops at merchant approval',async()=>{
 const db=openStore(':memory:');try{
  const {id}=db.create(),s=db.get(id).state;
  s.intakeMode='sandbox';s.paypalOrderId='PP-12345';s.capture.source='paypal-sandbox';s.paidAt=new Date(Date.now()-10*60000).toISOString();db.save(id,s);
  const paypal={refresh:async state=>({...state.capture,source:'paypal-sandbox',status:'COMPLETED'}),create:async()=>{},capture:async()=>{}};
  const svc=createService(db,{OPENAI_API_KEY:'test',OPENAI_MODEL:'test-model'},{paypal,fetcher:model()});
  await svc.scan(id);
  assert.equal(db.get(id).state.monitor.status,'attention');
  assert.equal((await svc.autoTriage(id)).status,'operator-required');
  db.authorize(id);
  const result=await svc.autoTriage(id);
  assert.equal(result.status,'awaiting-merchant');
  const reviewed=db.get(id).state;
  assert.equal(reviewed.review.mode,'model');
  assert.equal(reviewed.automation.status,'awaiting-merchant');
  assert.equal(reviewed.writes,0);assert.equal(reviewed.approval,null);
  assert.equal((await svc.autoTriage(id)).status,'nothing-due');
 }finally{db.close();}
});

test('automatic investigation stays inactive without a configured model',async()=>{
 const db=openStore(':memory:');try{const {id}=db.create();db.authorize(id);const svc=createService(db,{});assert.equal((await svc.autoTriage(id)).status,'ai-not-configured');assert.equal(db.get(id).state.writes,0);}finally{db.close();}
});
