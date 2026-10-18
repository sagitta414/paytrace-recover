import {checks,reviewIsCurrent} from './core.mjs';
import {proofIsCurrent} from './operations.mjs';
export function decisionBrief(s){
 const current=reviewIsCurrent(s),failed=checks(s).filter(c=>!c.ok);
 const unavailable=s.evidenceAvailable===false||Object.values(s.sources||{}).some(x=>x?.status==='unavailable');
 const verified=proofIsCurrent(s)&&!unavailable;
 return {verified,method:s.review?.mode==='scripted'?'Scripted specialist demonstration':s.review?'Model-assisted review':'Rules-based summary · review pending',found:unavailable?'Current source records are unavailable. Refresh before deciding.':failed.length?'Purchase checks need attention: '+failed.map(c=>c.label).join(', ')+'.':s.entitlement.active?'The payment matches and an access record is active. A separate lesson check establishes the outcome.':'The payment matches this purchase, but purchased access is missing.',recommendation:verified?'No further access change. Ask the customer to confirm their experience.':unavailable?'Hold changes until both systems can be checked.':current?s.review.proposal:'Review current evidence before proposing a correction.',guardrail:verified?'The recorded lesson check passed; customer confirmation is separate.':current&&s.review.outcome==='ready'?'One purchased entitlement, after preview and approval. No additional charge, refund, or account transfer.':'No access grant is authorized by this summary. Failed checks cannot be overridden by agent agreement.',unknown:s.review?.unknown||'The underlying enrollment failure has not been established.'};
}
export function outcomeFacts(s,support=null,now=Date.now()){
 if(support?.caseId&&support.caseId!==s.id)support=null;
 const brief=decisionBrief(s),verified=brief.verified&&support?.verified!==false,start=Date.parse(s.events?.[0]?.at),end=verified?Date.parse(s.proof.at):now;
 const seconds=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,Math.round((end-start)/1000)):null;
 return {caseId:s.id,recordType:s.capture?.source==='paypal-sandbox'?'PayPal sandbox':'Sample demonstration',durationSeconds:seconds,durationLabel:verified?'First recorded event → technical verification':'Elapsed since first recorded event',messages:support?support.messages.filter(m=>m.kind!=='internal'&&m.role!=='automatic').length:null,accessGrants:s.writes,verificationAttempts:s.reads,systemVerified:verified,customerConfirmed:!!(verified&&support?.confirmedAt&&!support?.help),customerNeedsHelp:!!support?.help,approvedAt:s.approval?.at||null,verifiedAt:verified?s.proof.at:null,customerConfirmedAt:verified&&!support?.help?support?.confirmedAt||null:null};
}
