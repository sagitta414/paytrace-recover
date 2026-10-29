import {proofFresh} from '../dist/verification-policy.mjs';

// Read-only assessment of a freshly fetched case. This does not initiate a payment,
// approve a repair, replay a grant, or claim that an external provider was contacted.
export function assessAcceptance(state,report,receipt,{mode='connected',now=Date.now()}={}){
 if(!['connected','refund','failed-verification'].includes(mode))throw Error('Choose a known acceptance mode.');
 if(!state||!report||!receipt||state.id!==report.caseId||state.id!==receipt.caseId)throw Error('Acceptance records refer to different cases.');
 const capture=state.capture,order=state.order;
 const exactPayment=!!capture&&capture.source==='paypal-sandbox'&&capture.status==='COMPLETED'&&capture.orderId===order?.id&&capture.userId===order?.userId&&capture.courseId===order?.courseId&&capture.amount===order?.amount&&capture.currency===order?.currency;
 const statuses=new Map((report.checks||[]).map(check=>[check.id,check.status]));
 let checks;
 if(mode==='connected')checks={
  exactSandboxPayment:exactPayment,
  sixConnectedSources:['payment','access','agents','approval','workflow','verification'].every(id=>statuses.get(id)==='passed')&&report.connectedSandboxProof===true,
  oneGrant:state.writes===1,
  currentProtectedLesson:proofFresh(state,now)&&receipt.status==='Verified'&&state.proof?.transport==='external-course-service',
  noPaymentHold:!state.paymentHold
 };
 else if(mode==='refund')checks={
  signedPaymentHold:!!state.paymentHold&&!!report.paymentSignal?.eventId,
  noCurrentVerifiedClaim:receipt.status!=='Verified'&&report.connectedSandboxProof!==true,
  accessSuspended:state.entitlement?.active===false&&state.sources?.access?.status==='available',
  noDuplicateGrant:state.writes<=1
 };
 else checks={
  exactSandboxPayment:exactPayment,
  oneGrantOnly:state.writes===1,
  verificationFailed:state.proof?.passed===false&&receipt.status!=='Verified'&&statuses.get('verification')==='failed',
  noConnectedClaim:report.connectedSandboxProof!==true
 };
 return {mode,caseId:state.id,passed:Object.values(checks).every(Boolean),checks,checkedAt:new Date(now).toISOString(),note:'Saved evidence was checked after a case refresh. Customer confirmation and future access are separate.'};
}
