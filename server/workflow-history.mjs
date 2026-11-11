const expectedStages={investigate:['gather','analyze','record'],recover:['repair','verify']};

// Preserve a task-run reference after the latest job is replaced. This is
// case evidence, not authorization or proof that the recovery succeeded.
export function rememberWorkflowRun(s,at=new Date().toISOString()){
 const job=s.job;if(!job?.runId||!expectedStages[job.kind])return;
 const completedStages=expectedStages[job.kind].filter(stage=>Object.hasOwn(job.completed||{},stage));
 const status=job.expiredAt?'timed-out':job.error?'failed':job.pending?'running':completedStages.length===expectedStages[job.kind].length?'completed':'incomplete';
 const previous=Array.isArray(s.workflowRuns)?s.workflowRuns:[];
 const existing=previous.find(run=>run.jobId===job.id);
 const record={jobId:job.id,kind:job.kind,runId:job.runId,startedAt:job.startedAt,finishedAt:status==='running'?null:existing?.finishedAt||at,status,completedStages};
 s.workflowRuns=[...previous.filter(run=>run.jobId!==job.id),record].slice(-8);
}
