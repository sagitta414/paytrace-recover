import {record} from '../dist/core.mjs';

export function workflowTimeout(env={}){
 const seconds=env.WORKFLOW_TIMEOUT_SECONDS===undefined?900:Number(env.WORKFLOW_TIMEOUT_SECONDS);
 if(!Number.isInteger(seconds)||seconds<60||seconds>3600)throw Error('WORKFLOW_TIMEOUT_SECONDS must be a whole number from 60 to 3600.');
 return seconds*1000;
}

// Expiring a job never reverses or repeats an access grant. Late callbacks cannot resume it.
export function expireWorkflow(s,{now=Date.now(),timeoutMs=900000}={}){
 if(!s.job?.pending)return false;
 const started=Date.parse(s.job.startedAt||s.events?.at(-1)?.at||s.createdAt);
 const explicit=Date.parse(s.job.deadlineAt||'');
 const deadline=Number.isFinite(explicit)?explicit:Number.isFinite(started)?started+timeoutMs:now;
 if(now<deadline)return false;
 s.job={...s.job,pending:false,expiredAt:new Date(now).toISOString(),error:'Workflow timed out. Refresh the evidence before continuing; any recorded access grant is preserved.'};
 s.proof=null;
 if(s.writes)s.phase='unverified';
 else{s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='needs-evidence';}
 record(s,'Workflow timed out. No additional access grant was applied.');
 return true;
}
