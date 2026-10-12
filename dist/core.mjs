export const COURSE={id:'course-light',name:'The Light & Story Workshop',price:12800,currency:'USD',lesson:'01 / See the light',minutes:12};
export const crew=[
 {name:'Ledger',role:'Payment analyst',trait:'The calm fact-checker',hello:'Let’s start with what we know.',scope:'I check the payment status, amount, and order reference. A familiar name or matching price alone is never enough.'},
 {name:'Relay',role:'Event investigator',trait:'The curious investigator',hello:'I’ll follow the trail with you.',scope:'I connect the payment and store logs. A message arriving is a clue, not proof that access was granted.'},
 {name:'Patch',role:'Repair planner',trait:'The practical fixer',hello:'Let’s preview the smallest useful fix.',scope:'I describe the exact access change and rehearse it against a copy. Nothing changes until you approve.'},
 {name:'Prism',role:'Independent reviewer',trait:'The thoughtful reviewer',hello:'Let’s make sure this really helps.',scope:'I look for contradictions. The case stays open until fresh payment, entitlement, and lesson-access checks agree.'}
];
export function createCase(scenario='match',id='CL-1048'){
 if(!['match','conflict','read-error','missing','restored','changed'].includes(scenario))throw Error('Unknown sample case');
 return {schema:1,id,scenario,phase:'unpaid',revision:0,order:{id,userId:'learner-maya',courseId:COURSE.id,amount:COURSE.price,currency:COURSE.currency},capture:null,entitlement:{userId:'learner-maya',courseId:COURSE.id,active:false,captureId:null},writes:0,reads:0,approval:null,rehearsal:null,proof:null,analysis:null,events:[],createdAt:new Date().toISOString()};
}
export function record(s,what){s.events.push({at:new Date().toISOString(),what});s.events=s.events.slice(-30)}
export function simulatePayment(s){if(s.capture)return s;s.capture={id:'CAP-'+s.id,orderId:s.scenario==='conflict'?'CL-OTHER':s.id,userId:s.order.userId,courseId:s.order.courseId,amount:12800,currency:'USD',status:'COMPLETED',source:'sample'};s.evidenceAvailable=s.scenario!=='missing';if(s.scenario==='restored')s.entitlement={...s.entitlement,active:true,captureId:s.capture.id};s.phase='paid';s.revision++;record(s,'Sample payment completed. Deliberate access-update failure injected.');if(s.scenario==='restored')record(s,'Sample store retry restored access before this investigation.');return s}
export function checks(s){const c=s.capture,o=s.order;return [
 {id:'payment',label:'Completed payment',ok:c?.status==='COMPLETED',detail:c?.status||'No captured payment'},
 {id:'order',label:'Correct order',ok:!!c&&c.orderId===o.id,detail:c?`${c.orderId} → ${o.id}`:'Awaiting payment'},
 {id:'learner',label:'Correct learner',ok:!!c&&c.userId===o.userId,detail:'Purchase belongs to this learner'},
 {id:'course',label:'Purchased course',ok:!!c&&c.courseId===o.courseId,detail:COURSE.name},
 {id:'amount',label:'Amount & currency',ok:!!c&&c.amount===o.amount&&c.currency===o.currency,detail:c?`${(c.amount/100).toFixed(2)} ${c.currency} / expected 128.00 USD`:'128.00 USD expected'}
 ]}
export function fingerprint(s){return JSON.stringify({revision:s.revision,order:s.order,capture:s.capture,entitlement:s.entitlement,evidenceAvailable:s.evidenceAvailable!==false})}
export function investigate(s){if(!s.capture)throw Error('Complete a checkout first.');s.analysis=null;s.rehearsal=null;s.approval=null;s.proof=null;s.review=scriptedReview(s);setReviewPhase(s);record(s,'Challenge round completed: '+s.review.outcome+'.');return s}
export function rehearse(s){requireReview(s,'ready');if(s.phase!=='investigated'||!checks(s).every(x=>x.ok))throw Error('Evidence does not support this repair.');const copy=structuredClone(s.entitlement);copy.active=true;copy.captureId=s.capture.id;s.rehearsal={id:'PLAN-'+s.id+'-'+s.revision,fingerprint:fingerprint(s),before:structuredClone(s.entitlement),after:copy,createdAt:new Date().toISOString(),passed:true};s.phase='rehearsed';record(s,'Rehearsal passed on a copy. Original access remains locked.');return s}
export function approve(s,planId){requireReview(s,'ready');if(s.phase!=='rehearsed'||s.rehearsal?.id!==planId||s.rehearsal.fingerprint!==fingerprint(s))throw Error('This preview is out of date. Investigate and rehearse again.');s.approval={planId,fingerprint:s.rehearsal.fingerprint,at:new Date().toISOString()};s.phase='approved';record(s,'Merchant approved the exact access grant.');return s}
export function applyRepair(s){if(s.writes>0)return s;requireReview(s,'ready');if(!s.approval||s.phase!=='approved'||s.approval.fingerprint!==fingerprint(s)||!checks(s).every(x=>x.ok))throw Error('Approval or fresh evidence is missing or has changed.');s.entitlement={...s.entitlement,active:true,captureId:s.capture.id};s.writes=1;s.revision++;s.phase='verifying';record(s,'Granted access once; verification is still pending.');return s}
export function canOpenLesson(s){return !!s.entitlement.active&&s.entitlement.userId===s.order.userId&&s.entitlement.courseId===s.order.courseId&&s.entitlement.captureId===s.capture?.id}
export function verify(s,{paymentAvailable=true,lessonAvailable=canOpenLesson(s)}={}){if(s.writes!==1)requireReview(s,'verify-only');s.reads++;const items=[{label:'Fresh payment record',ok:paymentAvailable&&s.evidenceAvailable!==false&&checks(s).every(x=>x.ok)},{label:'Access belongs to this learner and course',ok:canOpenLesson(s)},{label:'Protected lesson can be opened',ok:lessonAvailable}];s.proof={at:new Date().toISOString(),checks:items,passed:items.every(x=>x.ok)};s.phase=s.proof.passed?'verified':'unverified';record(s,s.proof.passed?'Verified: payment, access record, and lesson check agree.':'Verification incomplete. Case remains open; no repeat correction.');return s}
export function findings(s){const conflict=!checks(s).every(x=>x.ok);return [
 {agent:0,summary:conflict?'I found a completed payment, but its order reference doesn’t match this purchase. We need the correct payment before we proceed.':'I found one completed $128 payment tied to Maya’s purchase. The amount, currency, and order reference agree.',sources:['payment','order'],unknown:'A payment record alone does not prove course access.'},
 {agent:1,summary:'The payment was recorded, then the access-grant job logged a timeout. That locates the failed step. It doesn’t establish why the timeout happened.',sources:['event','store'],unknown:'The underlying cause of the timeout remains unknown.'},
 {agent:2,summary:conflict?'I’m holding the repair. A matching amount cannot connect a payment to the wrong order.':'The smallest correction is one access grant for the course already purchased. I can rehearse that change without touching the real record.',sources:['store','order'],unknown:'A preview cannot prove a real write will succeed.'},
 {agent:3,summary:conflict?'Good catch. Let’s stop here and request a receipt with the correct order reference. Access stays locked.':'You stay in control. After approval, I’ll check the payment again, the access record, and whether the lesson really opens.',sources:['payment','store'],unknown:'We cannot mark this recovered until all three outcome checks pass.'}
 ]}

export function evidenceSnapshot(s){return structuredClone({payment:s.evidenceAvailable===false?null:s.capture,order:s.order,store:{entitlement:s.entitlement,log:'access.grant failed: timeout',cause:'unknown'},event:{paymentRecorded:!!s.capture,accessUpdateAttempted:true,subsequentStoreRetry:s.scenario==='restored',source:s.capture?.source==='sample'?'sample fixture':'CourseLatch sandbox adapter'},checks:s.evidenceAvailable===false?[{id:'payment',ok:false,detail:'Payment record unavailable'}]:checks(s)})}
export function reviewIsCurrent(s){return !!s.review&&s.review.fingerprint===fingerprint(s)}
export function requireReview(s,outcome){if(!reviewIsCurrent(s)||s.review.outcome!==outcome||s.review.objections.some(o=>o.status==='open'))throw Error('The challenge round is incomplete, on hold, or out of date. Investigate again.');}
function setReviewPhase(s){s.phase={ready:'investigated',blocked:'blocked','needs-evidence':'needs-evidence','verify-only':'verify-only'}[s.review.outcome]}
export function scriptedReview(s){
 const failed=checks(s).filter(c=>!c.ok),missing=s.evidenceAvailable===false,restored=canOpenLesson(s);
 const objections=[
  {id:'identity',category:'identity',question:'Does this exact payment belong to this purchase?',sources:['payment','order'],status:failed.length||missing?'open':'resolved',resolution:missing?'The payment record is unavailable.':failed.length?'Unmatched checks: '+failed.map(c=>c.label).join(', ')+'.':'Order, learner, course, amount, currency, and completed status agree.'},
  {id:'duplicate',category:'duplicate',question:'Could access already have been restored?',sources:['store','event'],status:'resolved',resolution:restored?'The current entitlement is already active for this capture. Do not grant it again.':'The current entitlement is inactive. The earlier timeout is not treated as proof of current access.'}
 ];
 const outcome=missing?'needs-evidence':failed.length?'blocked':restored?'verify-only':'ready';
 const proposal=outcome==='ready'?'Grant access once to Maya’s purchased course.':outcome==='verify-only'?'Make no change. Verify the access already present.':'Hold the access grant until the evidence supports it.';
 const entry=(agent,kind,summary,sources)=>({agent,kind,summary,sources});
 return {mode:'scripted',at:new Date().toISOString(),fingerprint:fingerprint(s),snapshot:evidenceSnapshot(s),outcome,proposal,objections,unknown:'The timeout’s underlying cause is unknown. This review establishes eligibility for an access correction, not the cause of the failure.',rounds:1,exchange:[
  entry(2,'Proposal',proposal,['order','store']),
  entry(3,'Challenge','Before we change access: prove the exact payment match, and check whether a retry already fixed this.',['payment','order','store']),
  entry(0,'Evidence response',objections[0].resolution,['payment','order']),
  entry(1,'State response',objections[1].resolution+' The timeout cause remains unknown.',['store','event']),
  entry(3,'Decision',outcome==='ready'?'Both objections are answered. Rehearse the exact grant; the merchant still decides.':outcome==='verify-only'?'Access is already present. Run verification with zero repair writes.':outcome==='blocked'?'The identity objection is unresolved. Stop the repair.':'We need the missing payment record before deciding.',['payment','order','store'])]};
}
export function attachAnalysis(s,analysis){
 if(analysis.review?.fingerprint!==fingerprint(s))throw Error('Evidence changed during the challenge round. Investigate again.');
 // Mandatory checks are recomputed in code. A model may add a hold, never clear one.
 const mandatory=scriptedReview(s);s.analysis=analysis;s.review=structuredClone(analysis.review);
 s.review.objections=[...mandatory.objections,...s.review.objections.filter(o=>!['identity','duplicate'].includes(o.id))];
 if(['blocked','needs-evidence'].includes(mandatory.outcome))s.review.outcome=mandatory.outcome;
 else if(s.review.objections.some(o=>o.status==='open'))s.review.outcome='needs-evidence';
 else s.review.outcome=mandatory.outcome;
 s.review.proposal=s.review.outcome==='needs-evidence'?'Hold the access grant until the remaining objections are answered.':mandatory.proposal;setReviewPhase(s);return s;
}
export function changeSampleEvidence(s){if(s.capture?.source!=='sample'||s.scenario!=='changed'||!s.review||s.writes)throw Error('This sample change is unavailable.');s.capture.orderId='CL-OTHER';s.revision++;s.rehearsal=null;s.approval=null;s.phase='stale';record(s,'Sample evidence changed: payment now points to another order. Previous review invalidated.');return s}
export function restoreSampleEvidence(s){if(s.capture?.source!=='sample'||s.scenario!=='missing')throw Error('This sample evidence action is unavailable.');s.evidenceAvailable=true;s.revision++;s.rehearsal=null;s.approval=null;s.phase='paid';record(s,'Missing sample payment record supplied. A new review is required.');return s}
