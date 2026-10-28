import {proofFresh} from './verification-policy.mjs';
// Shared deterministic diagnosis. AI may explain these facts, never override eligibility.
export function diagnose(s,now=Date.now()) {
 if(s.restrictedView&&s.redactedDiagnosis)return s.redactedDiagnosis;
 if(s.paymentHold)return {code:'payment_hold',title:'Payment changed — review required',detail:'Access is paused or under review after a provider payment change.',next:'Review payment evidence with the merchant. No repeat grant is allowed.',repair:false};

 const result=(code,title,detail,next,repair=false)=>({code,title,detail,next,repair});
 if(s.evidenceAvailable===false)return result('missing_evidence','Payment evidence unavailable','The original payment cannot be read. A receipt alone does not establish current status.','Request fresh payment evidence.');
 if(!s.capture)return result('unpaid','No captured payment','Checkout has not produced a captured payment.','Complete or inspect checkout.');
 if(s.capture.status==='PENDING')return result('pending_payment','Payment is still pending','Approval or initiation is not a completed payment.','Wait for confirmed payment; do not grant access.');
 if(s.capture.status!=='COMPLETED')return result('ineligible_payment','Payment does not qualify',`Current payment status: ${s.capture.status}.`,'Review payment status with the merchant; do not grant access.');
 const o=s.order,c=s.capture;
 if(c.orderId!==o.id||c.userId!==o.userId||c.courseId!==o.courseId||c.amount!==o.amount||c.currency!==o.currency)return result('purchase_mismatch','Purchase evidence conflicts','At least one payment field does not match this exact purchase.','Request the correct purchase reference.');
 if(s.currentAccountId&&s.currentAccountId!==o.userId)return result('wrong_account','A different account is signed in','The signed-in account differs from the account tied to the purchase.','Ask the customer to sign in to the purchasing account. Do not transfer access.');
 if(s.accessExpiresAt&&(!Number.isFinite(Date.parse(s.accessExpiresAt))||Date.parse(s.accessExpiresAt)<=now))return result('expired_access','Access term has ended','The recorded access term is expired or invalid. A past payment does not authorize an extension.','Review the purchased term or renewal with the merchant.');
 if(s.entitlement.active&&s.entitlement.userId===o.userId&&s.entitlement.courseId===o.courseId&&s.entitlement.captureId===c.id)return result('access_present','Access is already present','The entitlement matches this learner, course, and capture.','Verify delivery without granting access again.');
 if(s.entitlement.active)return result('entitlement_conflict','Existing access conflicts','An active entitlement belongs to a different purchase or identity.','Escalate the conflicting entitlement; do not overwrite it.');
 return result('missing_enrollment','Paid, but enrollment is missing',s.fulfillment?.code==='ENROLLMENT_TIMEOUT'?'The enrollment update logged a timeout. Its underlying cause is not established.':'The payment matches, but the entitlement is absent. The cause is not established.','Rehearse one access grant, then ask for merchant approval.',true);
}
export function validateGrace(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>60)throw Error('Choose a whole-number access window from 1 to 60 minutes.');return n}
export function deliveryCheck(s,{now=Date.now(),graceMinutes=5}={}) {
 validateGrace(graceMinutes);const diagnosis=diagnose(s,now),paidAt=Date.parse(s.paidAt||s.capture?.createdAt||'');
 const elapsedMinutes=Number.isFinite(paidAt)?Math.max(0,(now-paidAt)/60000):null;
 let status=diagnosis.code==='access_present'?(s.phase==='verified'&&s.proof?.passed&&proofFresh(s,now)?'resolved':'access_present'):diagnosis.code==='pending_payment'?'payment_pending':diagnosis.code==='unpaid'?'unpaid':'review';
 if(diagnosis.code==='missing_enrollment')status=elapsedMinutes===null?'unknown_age':elapsedMinutes<graceMinutes?'waiting':'attention';
 return {status,diagnosis,elapsedMinutes,graceMinutes,checkedAt:new Date(now).toISOString()};
}
export function scanCases(cases,options={}){return cases.map(s=>{const check=deliveryCheck(s,options);s.monitor={...s.monitor,...check};if(check.status==='attention'&&!s.monitor.detectedAt){s.monitor.detectedAt=check.checkedAt;s.monitor.beforeComplaint=s.complaintAt?Date.parse(check.checkedAt)<Date.parse(s.complaintAt):null;}return s;});}
export function relatedCases(selected,cases,{windowMinutes=15,now=Date.now()}={}) {
 if(diagnose(selected,now).code!=='missing_enrollment'||!selected.fulfillment?.code)return [];
 const at=Date.parse(selected.paidAt||'');if(!Number.isFinite(at))return [];
 return cases.filter(s=>s.id!==selected.id&&s.merchantId===selected.merchantId&&s.order.courseId===selected.order.courseId&&s.fulfillment?.code===selected.fulfillment.code&&diagnose(s,now).code==='missing_enrollment'&&Number.isFinite(Date.parse(s.paidAt||''))&&Math.abs(Date.parse(s.paidAt)-at)<=windowMinutes*60000);
}
