import {createCase,simulatePayment,canOpenLesson,fingerprint} from './core.mjs';
import {diagnose,scanCases,relatedCases} from './diagnosis.mjs';
export {diagnose,scanCases,relatedCases};
export function seedPortfolio(primary,now=Date.now()){
 const fixtures=[['match','Nora',11],['match','Eli',9],['wrong-account','Alex',18],['expired','Sam',24],['pending','Jo',16],['match','Luca',1]];
 return [primary,...fixtures.map(([scenario,name,age],i)=>{const s=simulatePayment(createCase(scenario,primary.id+'-P'+(i+1)));s.customerName=name;s.order.userId='learner-'+name.toLowerCase();s.capture.userId=s.order.userId;s.entitlement.userId=s.order.userId;s.currentAccountId=scenario==='wrong-account'?'learner-other':s.order.userId;s.paidAt=new Date(now-age*60000).toISOString();s.merchantId=primary.merchantId||'demo-merchant';return s;})];
}
export function proofIsCurrent(s){return s.phase==='verified'&&s.proof?.passed&&s.proof.fingerprint===fingerprint(s)&&canOpenLesson(s);}
export function customerDraft(s,{mode='browser-simulation'}={}){
 const name=s.customerName||'Maya',d=diagnose(s);let text,kind;
 if(proofIsCurrent(s)) {kind='verified';text=`Hi ${name}, we checked access to your Light & Story Workshop purchase (${s.order.id}). The access check passed at ${s.proof.at}. Please sign in to the account used for your purchase and open the first lesson. You do not need to pay again. If you still have trouble, reply with what you see.`;}
 else if(d.code==='wrong_account'){kind='account';text=`Hi ${name}, the signed-in account does not match the account linked to purchase ${s.order.id}. Please sign out and sign in to the account you used for this purchase. We have not transferred or changed access. If you still cannot get in, reply so we can review the account match.`;}
 else if(d.code==='expired_access'){kind='term';text=`Hi ${name}, the access term recorded for purchase ${s.order.id} has ended. We are reviewing the purchased term and any renewal with the merchant. We have not extended access or charged you.`;}
 else if(d.code==='pending_payment'){kind='pending';text=`Hi ${name}, payment for purchase ${s.order.id} is still pending. We cannot confirm access eligibility until the payment completes. Please do not submit another payment while we check its status.`;}
 else {kind='review';text=`Hi ${name}, we are reviewing access to your Light & Story Workshop purchase (${s.order.id}). ${s.writes?'An access update was applied, but successful access has not yet been verified.':'We have not confirmed that access is restored.'} We will check the purchase evidence and let you know the next step. Please do not pay again while we investigate.`;}
 return {kind,text,mode,generatedAt:new Date().toISOString(),evidenceFingerprint:fingerprint(s),method:'Evidence-based template; merchant editable',sent:false};
}
export function recoveryReceipt(s,{mode='browser-simulation'}={}){return {brand:'PayTrace Recover',mode,caseId:s.id,purchase:s.order,diagnosis:diagnose(s),detectedAt:s.monitor?.detectedAt||null,approval:s.approval,repair:{writes:s.writes,operationId:s.writes?'repair:'+s.id:null},verification:s.proof,current:proofIsCurrent(s),workflow:s.job||null,events:s.events};}
