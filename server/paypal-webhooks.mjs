import {createHash} from 'node:crypto';
export async function receivePaypalWebhook({headers,event,raw,store,paypal,service}){
 if(typeof event?.id!=='string'||event.id.length>200||typeof event.event_type!=='string')throw Error('Invalid webhook event.');
 await paypal.verifyWebhook(headers,event);
 return store.lock('webhook:'+event.id,async()=>{const saved=store.center.providerEvent(event,createHash('sha256').update(raw).digest('hex'));if(saved.state==='processed')return {accepted:true,duplicate:true};
 const allowed=['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'];
 if(allowed.includes(event.event_type)){
  const order=event.resource?.supplementary_data?.related_ids?.order_id,capture=event.resource?.supplementary_data?.related_ids?.capture_id||event.resource?.id;
  for(const owner of store.owners())if(store.listCases(owner).some(s=>s.paypalOrderId&&(s.paypalOrderId===order||s.capture?.id===capture))){
   await service.scan(owner);store.center.audit(owner,{action:'provider.webhook.reconciled',detail:event.event_type});store.center.tick(owner);
  }
 }
 store.center.completeEvent(event.id);return {accepted:true,duplicate:saved.duplicate};});
}
