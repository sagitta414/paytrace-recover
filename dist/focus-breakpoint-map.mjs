import {crew,evidenceSnapshot,findings,reviewIsCurrent} from './core.mjs';
import {proofIsCurrent} from './operations.mjs';
import {esc} from './customer-shared.mjs';
import {diagnose} from './diagnosis.mjs';

const stages=[
 {id:'payment',title:'PayPal capture',agent:0,sources:['payment']},
 {id:'match',title:'Purchase match',agent:0,sources:['payment','order']},
 {id:'handoff',title:'Enrollment handoff',agent:1,sources:['event']},
 {id:'access',title:'Course entitlement',agent:2,sources:['store']},
 {id:'lesson',title:'Protected lesson',agent:3,sources:['proof']}
];

export function breakPointModel(s,{backend=false,uncertain=false}={}){
 const capture=s.capture,order=s.order,sourcePayment=s.sources?.payment,sourceAccess=s.sources?.access;
 const currentReview=!!s.review&&reviewIsCurrent(s);
 const snapshot=currentReview?s.review.snapshot:evidenceSnapshot(s);
 const paymentUnavailable=s.evidenceAvailable===false||sourcePayment?.status==='unavailable'||(backend&&capture?.source==='paypal-sandbox'&&sourcePayment?.status!=='available');
 const accessUnavailable=sourceAccess?.status==='unavailable';
 const proofCurrent=proofIsCurrent(s)&&!uncertain;
 const paymentComplete=capture?.status==='COMPLETED'&&!paymentUnavailable;
 const exact=paymentComplete&&capture.orderId===order.id&&capture.userId===order.userId&&capture.courseId===order.courseId&&capture.amount===order.amount&&capture.currency===order.currency;
 const entitlement=s.entitlement||{};
 const accessMatches=entitlement.active===true&&entitlement.userId===order.userId&&entitlement.courseId===order.courseId&&entitlement.captureId===capture?.id;
 const reviewFindings=currentReview?(Array.isArray(s.analysis?.findings)?s.analysis.findings:findings(s)):[];
 const byAgent=new Map(reviewFindings.map(item=>[item.agent,item]));
 const scope=backend?(capture?.source==='paypal-sandbox'&&sourcePayment?.status==='available'?'PayPal sandbox record':'Server demo or pending sandbox evidence'):'Fictional browser sample';
 const nodes=[
  {state:paymentUnavailable?'unknown':paymentComplete?'confirmed':capture?.status==='PENDING'?'waiting':capture?'attention':'waiting',detail:paymentUnavailable?'Payment source could not be read.':paymentComplete?'Completed capture recorded.':capture?.status==='PENDING'?'Payment is pending.':capture?'Capture is not completed.':'No capture recorded.'},
  {state:paymentUnavailable?'unknown':!paymentComplete?'waiting':exact?'confirmed':'blocked',detail:paymentUnavailable?'Match cannot be checked without the payment record.':!paymentComplete?'Wait for a completed capture.':exact?'Order, learner, course, amount, and currency agree.':'At least one purchase field conflicts.'},
  {state:!capture?'waiting':snapshot?.event?.subsequentStoreRetry?'confirmed':snapshot?.event?.accessUpdateAttempted?'attention':'unknown',detail:!capture?'No payment handoff to inspect yet.':snapshot?.event?.subsequentStoreRetry?'A later store retry was recorded.':snapshot?.event?.accessUpdateAttempted?'An update attempt was recorded; its success and root cause are not established.':'No access-update attempt is recorded.'},
  {state:accessUnavailable?'unknown':accessMatches?'confirmed':entitlement.active?'blocked':exact?'attention':'waiting',detail:accessUnavailable?'Current access could not be read.':accessMatches?'Matching entitlement is active.':entitlement.active?'Active entitlement belongs to another purchase or identity.':exact?'No matching entitlement is active.':'Wait for an exact payment match before considering access.'},
  {state:proofCurrent?'confirmed':s.proof?.passed?'unknown':s.proof?'attention':'waiting',detail:proofCurrent?'A current protected-lesson check passed.':s.proof?.passed?'Earlier proof is no longer current.':s.proof?'The lesson check did not pass.':'Lesson access has not been verified.'}
 ].map((node,i)=>({...stages[i],...node,finding:byAgent.get(stages[i].agent)||null,records:stages[i].sources.map(key=>({key,value:key==='proof'?s.proof||null:snapshot?.[key]??null})),checkedAt:i<2?sourcePayment?.checkedAt:i===2&&currentReview?s.review.at:i===3?sourceAccess?.checkedAt:i===4?s.proof?.at:null}));
 let breakAt=null,headline='Follow the payment to the lesson.',explanation='Open each step to inspect its source and specialist perspective.';
 const diagnosis=diagnose(s);
 if(paymentUnavailable){headline='The payment record needs a fresh read.';explanation='Do not infer a failed payment or missing access from an unavailable source.';}
 else if(capture&&!paymentComplete){headline='Payment has not been confirmed.';explanation='Access cannot be granted from a pending or incomplete capture.';}
 else if(paymentComplete&&!exact){breakAt='match';headline='The purchase references conflict.';explanation='Ledger needs an exact match before any access correction.';}
 else if(exact&&diagnosis.code==='wrong_account'){breakAt='match';headline='The signed-in account does not match.';explanation='Ask the customer to use the purchasing account. Do not transfer or grant access.';nodes[1].state='blocked';nodes[1].detail='The signed-in account differs from the purchasing account.';}
 else if(exact&&diagnosis.code==='expired_access'){breakAt='access';headline='The purchased access term has ended.';explanation='Review the term or renewal. A past payment does not authorize an extension.';nodes[3].state='blocked';nodes[3].detail='The recorded access term is expired or invalid.';}
 else if(exact&&accessUnavailable){headline='Current course access is unknown.';explanation='Refresh the course service before deciding whether access is missing.';}
 else if(exact&&entitlement.active&&!accessMatches){breakAt='access';headline='An existing entitlement conflicts.';explanation='Do not overwrite access tied to another identity or capture.';}
 else if(exact&&!entitlement.active){breakAt='access';headline='Payment matches. Access has not landed.';explanation='The recorded handoff is a clue, not a proven root cause. Review one narrow grant.';}
 else if(accessMatches&&!proofCurrent){breakAt=s.proof&&!s.proof.passed?'lesson':null;headline=s.proof&&!s.proof.passed?'The lesson check failed.':'Access exists. Lesson proof is next.';explanation='Verify the purchased content without repeating the grant.';}
 else if(proofCurrent){headline='The purchased lesson was verified.';explanation='Technical proof is complete; customer confirmation remains separate.';}
 if(uncertain){breakAt=null;headline='Refresh before locating the break.';explanation='A request may have completed on the server. Current evidence must be loaded again.';}
 return {scope,nodes,breakAt,headline,explanation,currentReview};
}

export function breakPointMap(s,options={}){
 const model=breakPointModel(s,options);
 return `<section class="breakpoint-map" aria-label="Payment to access break point map"><div class="breakpoint-head"><div><span class="eyebrow">PAYMENT → ACCESS / EVIDENCE MAP</span><h2>${esc(model.headline)}</h2><p>${esc(model.explanation)}</p></div><span class="breakpoint-scope">${esc(model.scope)}</span></div><ol class="breakpoint-chain">${model.nodes.map((node,i)=>`<li class="breakpoint-node ${esc(node.state)} ${model.breakAt===node.id?'breakpoint':''}"><details ${model.breakAt===node.id?'open':''}><summary><span class="breakpoint-num">0${i+1}</span><span class="breakpoint-node-title"><strong>${esc(node.title)}</strong><small>${esc(node.state==='confirmed'?'Confirmed':node.state==='blocked'?'Conflict':node.state==='attention'?'Needs attention':node.state==='unknown'?'Unknown':'Awaiting evidence')}</small><small class="breakpoint-freshness">${esc(node.checkedAt?'Checked '+new Date(node.checkedAt).toLocaleString():'No fresh source time')}</small></span><span class="breakpoint-chevron" aria-hidden="true">+</span></summary><div class="breakpoint-detail"><p>${esc(node.detail)}</p><div class="breakpoint-owner"><span class="specialist-avatar specialist-${node.agent}" aria-hidden="true">${esc(crew[node.agent].name[0])}</span><span><strong>${esc(crew[node.agent].name)}</strong><small>${esc(crew[node.agent].role)}</small></span></div><p class="breakpoint-finding">${node.finding?esc(node.finding.summary):'Run or refresh the investigation to see this specialist’s finding.'}</p><div class="breakpoint-sources">${node.records.map(record=>`<details><summary>Inspect ${esc(record.key)} record</summary><pre>${esc(JSON.stringify(record.value,null,2))}</pre></details>`).join('')}</div></div></details></li>`).join('')}</ol><p class="breakpoint-note">The highlighted step is the first actionable break in the recorded chain, not a diagnosis of the underlying cause. Saved citations do not replace fresh provider checks.</p></section>`;
}

export function mountBreakPointMap(root,s,options={}){
 if(!s)return;
 const main=root.querySelector('.case-evidence-column');if(!main)return;
 const section=document.createElement('div');section.innerHTML=breakPointMap(s,options);
 const anchor=main.querySelector('.clarity-specialists')||main.querySelector('.case-column-title');
 anchor?.after(section.firstElementChild);
}
