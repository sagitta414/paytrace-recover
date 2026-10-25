import {createHash} from 'node:crypto';
import {trace,SpanStatusCode} from '@opentelemetry/api';

// Keep purchase references, learner details, prompts, and provider errors out of telemetry.
const steps=new Set(['case-read','investigate','rehearse','approve','repair','verify','paypal-create','paypal-capture','paypal-webhook','workflow-gather','workflow-analyze','workflow-record','workflow-repair','workflow-verify','auto-triage']);
const phases=new Set(['unpaid','paid','reviewing','investigated','rehearsed','approved','verifying','verified','unverified','blocked','needs-evidence','verify-only','review-failed','stale']);
export function traceCaseKey(reference){return createHash('sha256').update(String(reference||'unknown')).digest('hex').slice(0,16)}
export function noteSpecialistProgress(agent,status){
 if(Number.isInteger(agent)&&agent>=0&&agent<4&&['running','completed'].includes(status))trace.getActiveSpan()?.addEvent('specialist.'+status,{'paytrace.specialist':agent});
}
export async function withRecoverySpan(step,reference,work,{tracer=trace.getTracer('paytrace-recover')}={}){
 const name=steps.has(step)?step:'other';
 return tracer.startActiveSpan('recovery.'+name,{attributes:{'paytrace.case_key':traceCaseKey(reference),'paytrace.step':name}},async span=>{
  try{const result=await work();const phase=result?.state?.phase;if(phases.has(phase))span.setAttribute('paytrace.phase',phase);span.setStatus({code:SpanStatusCode.OK});return result;}
  catch(error){span.setAttribute('paytrace.failed',true);span.setStatus({code:SpanStatusCode.ERROR,message:'Recovery step failed'});throw error;}
  finally{span.end();}
 });
}
