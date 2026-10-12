import {task} from '@renderinc/sdk/workflows';
const options=name=>({name,retry:{maxRetries:2,waitDurationMs:1000,backoffScaling:2},timeoutSeconds:300});
async function call(stage,sessionId,jobId){if(!process.env.APP_URL||!process.env.WORKFLOW_SECRET)throw Error('Configure APP_URL and WORKFLOW_SECRET.');const base=new URL(process.env.APP_URL);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('APP_URL must use HTTPS.');const r=await fetch(new URL('/api/internal/stage',base),{method:'POST',headers:{Authorization:'Bearer '+process.env.WORKFLOW_SECRET,'Content-Type':'application/json'},body:JSON.stringify({stage,sessionId,jobId}),signal:AbortSignal.timeout(240000)});const j=await r.json();if(!r.ok)throw Error(j.error||'Workflow stage failed');return j}
const gather=task(options('gatherEvidence'),(_ctx,id,job)=>call('gather',id,job));
const analyze=task(options('consultSpecialists'),(_ctx,id,job)=>call('analyze',id,job));
const record=task(options('recordFindings'),(_ctx,id,job)=>call('record',id,job));
const repair=task(options('applyApprovedRepair'),(_ctx,id,job)=>call('repair',id,job));
const verify=task(options('verifyLearnerAccess'),(_ctx,id,job)=>call('verify',id,job));
task(options('investigate'),async(ctx,id,job)=>{await ctx.run(gather,id,job);await ctx.run(analyze,id,job);return ctx.run(record,id,job)});
task(options('recover'),async(ctx,id,job)=>{await ctx.run(repair,id,job);return ctx.run(verify,id,job)});
