import {record} from '../dist/core.mjs';

export function workflowTimeout(env={}){
 const seconds=env.WORKFLOW_TIMEOUT_SECONDS===undefined?900:Number(env.WORKFLOW_TIMEOUT_SECONDS);
 if(!Number.isInteger(seconds)||seconds<60||seconds>3600)throw Error('WORKFLOW_TIMEOUT_SECONDS must be a whole number from 60 to 3600.');
 return seconds*1000;
}

// Expiration never reverses a grant or lets a late callback resume one.
export function expireWorkflow(s,{now=Date.now(),timeoutMs=900000}={}){
 if(!s.job?.pending)return false;
 const started=Date.parse(s.job.startedAt||s.createdAt);
 const deadline=Date.parse(s.job.deadlineAt||'');
 const cutoff=Number.isFinite(deadline)?deadline:Number.isFinite(started)?started+timeoutMs:now;
 if(now<cutoff)return false;
 s.job={...s.job,pending:false,expiredAt:new Date(now).toISOString(),error:'Workflow timed out. Refresh the evidence before continuing.'};
 s.proof=null;
 if(s.writes)s.phase='unverified';
 else{s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='needs-evidence';}
 record(s,'Workflow timed out. No additional access grant was applied.');
 return true;
}
