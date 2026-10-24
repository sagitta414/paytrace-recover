import {proofIsCurrent} from './operations.mjs';

// Local story copy. A draft is a suggestion; only an explicit merchant action adds it to the thread.
export function suggestedStoryUpdate(s,support={}){
 const name=s.customerName||'Customer',order=s.order?.id||'your purchase';
 if(support.help){
  if(!support.acknowledgedAt)return null;
  if(!support.recheckedAt)return null;
  return {key:`followup:${support.helpAt}:${s.reads}`,label:'After the follow-up check',why:'A new technical pass does not close a customer-reported problem.',text:s.proof?.passed?`Hi ${name}, we checked the payment, course access, and sample lesson again for ${order}. Those checks passed, but your request remains open until you can use the lesson. Please try opening it and tell us what happens. You do not need to pay again.`:`Hi ${name}, we ran another check for ${order}, but could not confirm lesson access. Your request is still open. We will keep investigating; please do not pay again.`};
 }
 if(support.confirmedAt&&proofIsCurrent(s))return {key:'customer-confirmed',label:'After customer confirmation',why:'The customer, not the technical check, confirmed the experience.',text:`Hi ${name}, thank you for confirming that you can open the lesson for ${order}. We have recorded your confirmation on this case. Reply here if the problem returns.`};
 if(s.review?.outcome==='blocked')return {key:'purchase-mismatch',label:'When the purchase does not match',why:'A completed payment for another order cannot authorize this access grant.',text:`Hi ${name}, the payment reference we checked does not match ${order}. We have not changed your course access. Please reply with the order reference from this purchase’s receipt. Do not share a password or full card details.`};
 if(proofIsCurrent(s))return {key:`verified:${s.reads}`,label:'After technical verification',why:'Invite the customer to try; do not claim they have confirmed success.',text:`Hi ${name}, our payment, course access, and lesson checks passed for ${order}. Please sign in with the purchasing account and try opening the first lesson. Tell us if it is still locked. You do not need to pay again.`};
 if(s.proof&&!s.proof.passed)return {key:`unverified:${s.reads}`,label:'When verification is incomplete',why:'An access update is not proof that the lesson works.',text:`Hi ${name}, an approved access update was recorded for ${order}, but the follow-up lesson check is incomplete. Your case remains open while we check again. Please do not pay again.`};
 if(s.writes)return {key:'access-update',label:'After an approved correction',why:'The change has been applied, but fresh verification is still pending.',text:`Hi ${name}, we applied an approved access update for ${order}. We are checking the payment, course access, and lesson before calling this resolved. You do not need to pay again.`};
 if(s.review)return {key:'evidence-review',label:'During evidence review',why:'The merchant can explain the next step without promising a repair.',text:`Hi ${name}, we checked the sample payment against ${order} and found that course access is missing. We are reviewing the smallest safe correction. No access change has been made yet; we will update you after the merchant decision.`};
 return {key:'received',label:'When the request arrives',why:'Acknowledges the report without claiming the purchase is already fixed.',text:`Hi ${name}, we received your report about ${order}. We will compare the payment and course access records before making any change. You do not need to pay again.`};
}

export function sendStoryUpdate(s,support,send){
 const draft=suggestedStoryUpdate(s,support);
 if(!draft)throw Error('A customer update is not ready yet.');
 support.sentUpdates??=[];
 if(support.sentUpdates.includes(draft.key))throw Error('This update has already been sent in the story.');
 send('merchant',draft.text);
 support.sentUpdates.push(draft.key);
 return draft;
}
