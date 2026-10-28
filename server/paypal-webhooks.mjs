import {createHash} from 'node:crypto';
export async function receivePaypalWebhook({headers,event,raw,store,paypal,service,defer}){
 if(typeof event?.id!=='string'||event.id.length>200||typeof event.event_type!=='string')throw Error('Invalid webhook event.');
 await paypal.verifyWebhook(headers,event);
 return store.lock('webhook:'+event.id,async()=>{const saved=store.center.providerEvent(event,createHash('sha256').update(raw).digest('hex'));if(saved.state==='processed')return {accepted:true,duplicate:true};
 let deferred=false;const allowed=['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'];
 if(allowed.includes(event.event_type)){
  const order=event.resource?.supplementary_data?.related_ids?.order_id;let parentCapture=null;for(const link of event.resource?.links||[]){try{const u=new URL(link.href);if(link.rel==='up'&&u.protocol==='https:'&&u.hostname==='api-m.sandbox.paypal.com')parentCapture=u.pathname.match(/^\/v2\/payments\/captures\/([A-Z0-9-]+)$/i)?.[1]||null;}catch{}}const capture=event.resource?.supplementary_data?.related_ids?.capture_id||parentCapture||event.resource?.id;
  for(const owner of store.owners())if(store.listCases(owner).some(s=>s.paypalOrderId&&(s.paypalOrderId===order||s.capture?.id===capture))){
   if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'].includes(event.event_type)){await store.lock(owner,async()=>{for(const saved of store.listCases(owner)){if(!saved.paypalOrderId||!(saved.paypalOrderId===order||saved.capture?.id===capture)||saved.providerHoldHint?.eventId===event.id)continue;saved.providerHoldHint={eventId:event.id,type:event.event_type,at:new Date().toISOString()};saved.paymentHold=saved.paymentHold||{status:'PROVIDER_REVIEW_PENDING',at:new Date().toISOString(),action:'review'};saved.approval=null;saved.rehearsal=null;saved.review=null;saved.proof=null;saved.phase='payment-hold';store.clearLearnerSessions(owner,saved.id);store.saveCase(owner,saved);store.center.audit(owner,{action:'provider.payment-review',caseId:saved.id,detail:'Verified provider event requires authoritative reconciliation.'});}});}
   if(defer){defer(owner,event.id);deferred=true;continue;}await service.scan(owner);store.center.audit(owner,{action:'provider.webhook.reconciled',detail:event.event_type});store.center.tick(owner);
  }
 }
 if(!deferred)store.center.completeEvent(event.id);return {accepted:true,duplicate:saved.duplicate};});
}
