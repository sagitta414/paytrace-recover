import {createCase,simulatePayment} from '../dist/core.mjs';
import {analyze} from '../server/ai.mjs';

if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)throw Error('Set a server-side AI key and model before running this evaluation.');
const cases=[
 {id:'matching-payment-missing-access',scenario:'match',expected:'ready'},
 {id:'wrong-order',scenario:'conflict',expected:'blocked'},
 {id:'payment-record-unavailable',scenario:'missing',expected:'needs-evidence'},
 {id:'access-already-restored',scenario:'restored',expected:'verify-only'},
 {id:'wrong-learner-account',scenario:'wrong-account',expected:'blocked'}
];
// Opt in because each model-backed case runs the full specialist consultation.
if(process.env.AI_EVAL_EXTENDED==='1')cases.push(
 {id:'pending-payment',scenario:'pending',expected:'blocked'},
 {id:'expired-access-term',scenario:'expired',expected:'blocked'},
 {id:'wrong-amount',scenario:'match',expected:'blocked',mutate:s=>{s.capture.amount=1}},
 {id:'wrong-currency',scenario:'match',expected:'blocked',mutate:s=>{s.capture.currency='EUR'}},
 {id:'refunded-capture',scenario:'match',expected:'blocked',mutate:s=>{s.capture.status='REFUNDED'}},
 {id:'wrong-course',scenario:'match',expected:'blocked',mutate:s=>{s.capture.courseId='course-foreign'}},
 {id:'conflicting-entitlement-owner',scenario:'match',expected:'blocked',mutate:s=>{s.entitlement.userId='learner-foreign'}},
 {id:'active-grant-for-other-capture',scenario:'match',expected:'blocked',mutate:s=>{s.entitlement.active=true;s.entitlement.captureId='CAP-foreign'}}
);
const results=[];
for(const item of cases){
 const state=simulatePayment(createCase(item.scenario,'EVAL-'+item.id));
 item.mutate?.(state);
 try{
  const analysis=await analyze(state,process.env);
  results.push({case:item.id,expected:item.expected,actual:analysis.review.outcome,pass:analysis.review.outcome===item.expected,openCategories:analysis.review.objections.filter(o=>o.status==='open').map(o=>o.category||'unknown'),calls:analysis.review.exchange.filter(x=>x.kind==='Finding'||x.kind==='Proposal'||x.kind==='Independent conclusion').length,accessWrites:state.writes});
 }catch(error){results.push({case:item.id,expected:item.expected,actual:'review-error',pass:false,error:error.message,accessWrites:state.writes});}
}
console.log(JSON.stringify({model:process.env.OPENAI_MODEL,results,passed:results.filter(r=>r.pass).length,total:results.length}));
if(results.some(r=>!r.pass))process.exitCode=1;
