import {fingerprint} from './core.mjs';
import {proofIsCurrent} from './operations.mjs';

// A snapshot of recorded evidence, not a fresh provider query or permanent guarantee.
export function buildRunReport(s,{backend=false}={}){
 const c=s.capture,o=s.order,exact=!!c&&c.status==='COMPLETED'&&c.orderId===o.id&&c.userId===o.userId&&c.courseId===o.courseId&&c.amount===o.amount&&c.currency===o.currency;
 const payment=exact&&s.evidenceAvailable!==false&&s.sources?.payment?.status==='available'&&c.source==='paypal-sandbox'?'passed':exact&&c.source==='sample'?'demo':c&&!exact?'failed':'pending';
 const external=s.sources?.access?.system==='External course access service',accessMatches=!!c&&s.entitlement?.active===true&&s.entitlement.userId===o.userId&&s.entitlement.courseId===o.courseId&&s.entitlement.captureId===c.id;
 const access=s.sources?.access?.status==='unavailable'?'failed':accessMatches&&external&&s.sources?.access?.status==='available'?'passed':accessMatches?'demo':'pending';
 const reviewTied=!!s.review&&(s.review.fingerprint===fingerprint(s)||s.approval?.fingerprint===s.review.fingerprint&&s.rehearsal?.fingerprint===s.review.fingerprint);
 const agents=reviewTied&&s.review.mode==='model'&&s.analysis?.mode==='model'?'passed':reviewTied&&s.review.mode==='scripted'?'demo':s.phase==='review-failed'?'failed':'pending';
 const approved=!!s.approval&&s.approval.planId===s.rehearsal?.id&&(s.writes===1||s.approval.fingerprint===fingerprint(s));
 const approval=approved?'passed':s.writes===0&&proofIsCurrent(s)?'not-needed':'pending';
 const job=s.job,workflow=job?.kind==='recover'&&job.runId&&job.completed?.repair&&job.completed?.verify?.verified===true&&!job.error&&!job.pending?'passed':job?.error?'failed':job?.pending?'pending':job?.kind==='recover'&&job.runId?'failed':s.writes?'demo':'pending';
 const current=proofIsCurrent(s)&&s.evidenceAvailable!==false&&!Object.values(s.sources||{}).some(x=>x?.status==='unavailable');
 const verification=current&&s.proof.transport==='external-course-service'&&external?'passed':current?'demo':s.proof&&!s.proof.passed?'failed':'pending';
 const checks=[
  {id:'payment',label:'PayPal payment',status:payment,reference:c?.source==='paypal-sandbox'?c.id:null,checkedAt:s.sources?.payment?.checkedAt||null,detail:payment==='passed'?'Exact sandbox capture reread.':payment==='demo'?'Sample payment record.':'Exact sandbox payment still needs confirmation.'},
  {id:'access',label:'Course access',status:access,reference:external?'Separate course service':'Built-in demo service',checkedAt:s.sources?.access?.checkedAt||null,detail:access==='passed'?'Separate entitlement matches this purchase.':access==='demo'?'Access is recorded in the demo course.':'Current entitlement is missing or unavailable.'},
  {id:'agents',label:'AI specialists',status:agents,reference:agents==='passed'?s.analysis.model||'Configured model':null,sourceIds:agents==='passed'?[...new Set((s.analysis.findings||[]).flatMap(f=>f.sources||[]))]:[],checkedAt:s.review?.at||null,detail:agents==='passed'?'Model review recorded with cited source IDs.':agents==='demo'?'Scripted specialist consultation.':'A current model review has not been recorded.'},
  {id:'approval',label:'Merchant decision',status:approval,reference:approved?s.approval.planId:null,checkedAt:s.approval?.at||null,detail:approved?'Merchant approved the previewed access grant.':approval==='not-needed'?'Existing access verified without a repair.':'An exact grant approval has not been recorded.'},
  {id:'workflow',label:'Render recovery',status:workflow,reference:job?.runId||null,checkedAt:null,detail:workflow==='passed'?'Recovery run recorded repair and verification stages.':workflow==='demo'?'Recovery ran inside the demo server.':'A completed Render recovery run is not recorded.'},
  {id:'verification',label:'Protected lesson',status:verification,reference:s.proof?.resource?.contentId||null,checkedAt:s.proof?.at||null,detail:verification==='passed'?'Separate course service returned protected content.':verification==='demo'?'Demo lesson access check passed.':'Current lesson access has not passed verification.'}
 ];
 const connectedSandboxProof=backend&&checks.every(x=>x.status==='passed');
 return {schema:1,caseId:s.id,generatedAt:new Date().toISOString(),scope:connectedSandboxProof?'connected-sandbox':backend?'server-demo':'browser-simulation',headline:connectedSandboxProof?'Connected sandbox recovery evidenced':current?'Access verified within the demo scope':'Recovery evidence is incomplete',connectedSandboxProof,passed:checks.filter(x=>x.status==='passed').length,total:checks.length,checks,paymentSignal:s.paymentSignal?.source==='paypal-sandbox-webhook'?{eventId:s.paymentSignal.eventId,confirmedAt:s.paymentSignal.confirmedAt}:null,note:'This report describes saved evidence at the stated times. It does not guarantee ongoing access or customer confirmation.'};
}
