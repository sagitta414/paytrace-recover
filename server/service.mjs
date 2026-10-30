import {readCaseSources} from './case-sources.mjs';
import {newCase,validateNewCase} from '../dist/new-case-model.mjs';
import {randomUUID} from 'node:crypto';
import {COURSE,createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify,canOpenLesson,record,fingerprint,reviewIsCurrent,attachAnalysis,changeSampleEvidence,restoreSampleEvidence} from '../dist/core.mjs';
import {analyze,answerQuestion} from './ai.mjs';import {paypalClient} from './paypal.mjs';
import {courseAccessClient} from './course-access.mjs';
import {scanCases,customerDraft,recoveryReceipt,proofIsCurrent} from '../dist/operations.mjs';
import {verificationAge} from '../dist/verification-policy.mjs';
import {diagnose,validateGrace} from '../dist/diagnosis.mjs';
import {buildRunReport} from '../dist/run-report.mjs';
import {withRecoverySpan,noteSpecialistProgress} from './recovery-trace.mjs';
import {expireWorkflow,workflowTimeout} from './workflow-lifecycle.mjs';
export function createService(store,env=process.env,{fetcher=fetch,paypal=paypalClient(env,fetcher),probe,access=(owner,s)=>store.readAccess(owner,s),course=courseAccessClient(env,fetcher)}={}){
 const timeoutMs=workflowTimeout(env);
 const verificationMaxAgeMs=verificationAge(env);
 function reconcileWorkflow(s,id){if(expireWorkflow(s,{timeoutMs}))store.saveCase(id,s);return s;}
 const workflowReady=()=>!!(env.RENDER_API_KEY&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK&&env.WORKFLOW_SECRET);
 const external=s=>Boolean(course&&s.intakeMode==='sandbox');
 function beginAgentRun(s,id,operator){s.agentRun={mode:operator&&env.OPENAI_API_KEY&&env.OPENAI_MODEL?'model':'scripted',status:'running',step:'evidence',agent:null,completed:[],startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};store.save(id,s);}
 function agentProgress(s,id){return async({agent,step,status})=>{noteSpecialistProgress(agent,status);s.agentRun={...s.agentRun,status:'running',step,agent,completed:status==='completed'?[...s.agentRun.completed,step]:s.agentRun.completed,updatedAt:new Date().toISOString()};store.save(id,s);};}
 function finishAgentRun(s,id){s.agentRun={...s.agentRun,status:'complete',step:'done',agent:null,updatedAt:new Date().toISOString()};store.save(id,s);}
 function failAgentRun(s,id){s.agentRun={...(s.agentRun||{mode:'unknown',completed:[],startedAt:new Date().toISOString()}),status:'failed',updatedAt:new Date().toISOString()};store.save(id,s);}
 async function fresh(s,id){
  const savedCaptureId=s.capture?.id;
  const ok=await readCaseSources(s,id,{paypal,access:(owner,state)=>external(state)?course.check(state):access(owner,state),accessSystem:external(s)?'External course access service':'Course access service'});
  const status=s.capture?.status,full=['REFUNDED','REVERSED','DENIED','DECLINED','FAILED'].includes(status),partial=status==='PARTIALLY_REFUNDED';
  if(full||partial){
   const changed=s.paymentHold?.status!==status;
   s.paymentHold={...s.paymentHold,status,at:changed?new Date().toISOString():s.paymentHold.at,action:full?'suspend':'review'};
   s.approval=null;s.rehearsal=null;s.review=null;s.proof=null;s.phase='payment-hold';
   if(changed)record(s,full?'Fresh PayPal evidence confirms an adverse payment change. Access is on hold.':'A partial refund requires merchant review. Access is on hold.');
   store.saveCase(id,s);
   if(full&&external(s)&&ok&&s.entitlement?.active&&s.entitlement.captureId===s.capture.id){
    const c=s.capture,o=s.order,exact=c.source==='paypal-sandbox'&&c.id===savedCaptureId&&c.orderId===o.id&&c.userId===o.userId&&c.courseId===o.courseId&&c.amount===o.amount&&c.currency===o.currency;
    if(!exact){s.paymentHold.suspensionState='identity-mismatch';store.saveCase(id,s);throw Error('Payment identity changed. Course suspension requires merchant review.');}
    if(typeof course.suspend!=='function'){s.paymentHold.suspensionState='unsupported';store.saveCase(id,s);throw Error('Course service cannot confirm access suspension. Payment hold remains.');}
    try{const current=await course.suspend(s,`suspend:${s.id}:${s.capture.id}`);s.entitlement=current;s.paymentHold.externalSuspended=true;s.paymentHold.suspensionState='confirmed';record(s,'Course service confirmed access suspension for the exact purchase.');store.saveCase(id,s);}
    catch{s.paymentHold.suspensionState='pending';store.saveCase(id,s);throw Error('Course access suspension is not confirmed. Payment hold remains and will be retried.');}
   }
   if(!ok)throw Error('Payment or course access records are unavailable. Payment hold remains.');
   return;
  }
  store.saveCase(id,s);if(!ok)throw Error('Payment or course access records are unavailable. Refresh both systems before continuing.');
 }
 async function repairApproved(s,id,{policyRun=false}={}){
  const prior=external(s)?store.accessIntent(id,s.id):null;
  await fresh(s,id);
  if(s.paymentHold)throw Error('Payment is on hold. No access grant is permitted.');
  if(s.writes>0)return;
  if(prior){
   if(prior.captureId!==s.capture?.id||prior.userId!==s.order.userId||prior.courseId!==s.order.courseId)throw Error('External access attempt no longer matches this purchase. Merchant review is required.');
   if(!s.entitlement.active||s.entitlement.captureId!==s.capture.id)throw Error('External access result is uncertain. Recheck the course service; no second grant will be sent.');
   s.writes=1;s.revision++;s.approval=prior.approval;s.phase='verifying';record(s,'Previously approved external grant was found in the course service. No second grant was sent.');store.saveCase(id,s);
   store.saveAccessIntent(id,s.id,{...prior,state:'confirmed'});return;
  }
  if(!s.approval||s.phase!=='approved'||s.approval.fingerprint!==fingerprint(s))throw Error('Approval or fresh evidence is missing or has changed.');
  if(s.approval.mode==='policy'&&!policyRun)throw Error('A policy-authorized grant cannot be retried. Review current evidence and approve a new preview.');
  if(external(s)){
   // Persist the exact operation before sending it. A timeout may mean the grant succeeded.
   const intent={key:`paytrace:${s.id}:${s.capture.id}`,captureId:s.capture.id,userId:s.order.userId,courseId:s.order.courseId,approval:structuredClone(s.approval),state:'pending'};
   store.saveAccessIntent(id,s.id,intent);
   let granted;try{granted=await course.grant(s,intent.key)}catch{store.saveAccessIntent(id,s.id,{...intent,state:'uncertain'});throw Error('External access result is uncertain. Recheck the course service; no second grant will be sent.');}
   applyRepair(s);
   s.entitlement=granted;
   store.saveCase(id,s);
   store.saveAccessIntent(id,s.id,{...intent,state:'confirmed'});
  }else{applyRepair(s);store.grant(id,s);}
 }
 function lesson(id){const s=store.get(id)?.state;if(!s)throw Error('No session.');if(s.paymentHold)throw Error('Payment is on hold.');return external(s)?course.probe(s):store.lesson(id);}
 async function customerLesson(id,caseId){const s=store.caseById(id,caseId);if(s.paymentHold)throw Error('Payment is on hold.');if(!external(s))return store.support.lesson(id,caseId);if(!proofIsCurrent(s)||s.evidenceAvailable===false||Object.values(s.sources||{}).some(x=>x?.status==='unavailable'))throw Error('Access is still being checked.');const value=await course.probe(s);if(value?.accessible!==true||value.userId!==s.order.userId||value.courseId!==s.order.courseId||value.captureId!==s.capture.id||value.contentId!=='light-lesson-01'||typeof value.body!=='string'||value.body.length<=20)throw Error('Protected course content could not be confirmed.');return {accessible:true,title:value.title||'Your purchased lesson',body:value.body,lesson:value.lesson||'Purchased lesson',contentId:value.contentId};}
 async function verifyFresh(id,caseId=store.get(id).state.id){const s=store.caseById(id,caseId);let available=true;try{await fresh(s,id)}catch{available=false}store.saveCase(id,s);if(s.scenario==='read-error'&&s.reads===0)available=false;if(s.paymentHold)available=false;let resource=null,access=false,transport;if(external(s)){transport='external-course-service';if(!s.paymentHold)try{resource=await course.probe(s)}catch{}}else{transport=probe?'authenticated-http':'scoped-content-adapter';const token=store.mintLearnerToken(id,s.id,30000);try{resource=probe?await probe(token):store.readLearnerToken(token)}catch{}finally{store.revokeLearnerToken(token);}}access=!s.paymentHold&&resource?.accessible===true&&resource.userId===s.order.userId&&resource.courseId===s.order.courseId&&resource.captureId===s.capture?.id&&resource.contentId==='light-lesson-01'&&typeof resource.body==='string'&&resource.body.length>20;s.verificationMaxAgeMs=verificationMaxAgeMs;verify(s,{paymentAvailable:available,lessonAvailable:access,transport,resource:access?{contentId:resource.contentId,userId:resource.userId,courseId:resource.courseId}:null});if(s.proof?.passed){s.firstVerifiedAt ||= s.proof.at;s.lastPassingVerification={at:s.proof.at,transport};}store.saveCase(id,s);return s}
 async function scan(id,{graceMinutes}={}){return store.lock(id,async()=>{if(graceMinutes!==undefined)store.setGrace(id,validateGrace(graceMinutes));const cases=store.listCases(id);for(const s of cases){reconcileWorkflow(s,id);if(s.job?.pending)continue;const before=fingerprint(s);if(s.capture?.source==='paypal-sandbox'){try{await fresh(s,id);}catch{}}if(before!==fingerprint(s)&&s.review){s.approval=null;s.rehearsal=null;s.proof=null;s.phase='stale';}}
   scanCases(cases,{graceMinutes:store.grace(id)});for(const s of cases)store.saveCase(id,s);return {cases,graceMinutes:store.grace(id),checkedAt:new Date().toISOString()};});}
 const autopilotReady=()=>!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET&&env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY&&env.OPENAI_API_KEY&&env.OPENAI_MODEL&&course);
 function setAutopilot(id,input){if(!store.get(id)?.operator)throw Error('Unlock the operator session first.');if(typeof input?.enabled!=='boolean'||!Number.isInteger(input.maxAmountCents)||input.maxAmountCents<1||input.maxAmountCents>50000||!Number.isInteger(input.dailyLimit)||input.dailyLimit<1||input.dailyLimit>10)throw Error('Use a valid amount and a daily limit from 1 to 10.');if(input.enabled&&!autopilotReady())throw Error('Connect PayPal sandbox, the course access service, and AI before enabling automatic repair.');const policy={enabled:input.enabled,courseId:COURSE.id,maxAmountCents:input.maxAmountCents,dailyLimit:input.dailyLimit,id:randomUUID(),updatedAt:new Date().toISOString()};return store.setAutopilot(id,policy);}
 async function autoRecoverReady(id,s,policy){
  if(!policy.enabled||!autopilotReady()||!store.get(id)?.operator)return {status:'awaiting-merchant',caseId:s.id};
  if(s.automation?.policyCheckedId===policy.id)return {status:s.automation?.status||'awaiting-merchant',caseId:s.id};
  const eligible=!s.paymentHold&&s.intakeMode==='sandbox'&&s.capture?.source==='paypal-sandbox'&&external(s)&&s.review?.mode==='model'&&s.analysis?.mode==='model'&&reviewIsCurrent(s)&&s.review.outcome==='ready'&&s.review.objections.every(o=>o.status==='resolved')&&s.phase==='investigated'&&s.writes===0&&!s.entitlement.active&&s.order.courseId===policy.courseId&&s.order.amount<=policy.maxAmountCents&&s.order.currency==='USD'&&s.order.userId===s.currentAccountId;
  if(!eligible){s.automation={...s.automation,status:'awaiting-merchant',policyCheckedId:policy.id,policyReason:'Outside automatic recovery policy.'};store.saveCase(id,s);return {status:'awaiting-merchant',caseId:s.id};}
  try{
   await fresh(s,id);
   if(s.paymentHold||!reviewIsCurrent(s)||s.phase!=='investigated'||s.entitlement.active)throw Error('Evidence changed before the automatic preview.');
   rehearse(s);
   if(s.rehearsal.before.active||s.rehearsal.after.userId!==s.order.userId||s.rehearsal.after.courseId!==policy.courseId||s.rehearsal.after.captureId!==s.capture.id)throw Error('Preview is outside policy.');
   if(!store.autopilot(id).enabled||store.autopilot(id).id!==policy.id)throw Error('Automatic recovery policy changed.');
   if(!store.reserveAutopilot(id,s.id,policy))throw Error('Automatic recovery daily limit reached.');
   approve(s,s.rehearsal.id,{mode:'policy',policyId:policy.id});
   s.automation={...s.automation,status:'repairing',policyCheckedId:policy.id};store.saveCase(id,s);
   await repairApproved(s,id,{policyRun:true});
   const result=await verifyFresh(id,s.id);
   result.automation={...result.automation,status:result.phase==='verified'?'verified':'verification-pending',nextAttemptAt:result.phase==='verified'?null:new Date(Date.now()+5*60000).toISOString()};
   record(result,result.phase==='verified'?'Policy recovery verified against payment, access, and protected lesson.':'Policy recovery needs a read-only verification retry. No second grant will be attempted.');
   store.saveCase(id,result);return {status:result.automation.status,caseId:s.id};
  }catch{
   const latest=store.caseById(id,s.id);
   if(latest.writes===0&&!latest.paymentHold){latest.approval=null;latest.rehearsal=null;latest.phase='stale';}
   latest.automation={...latest.automation,status:'needs-attention',policyCheckedId:policy.id,nextAttemptAt:null,error:'Automatic recovery stopped. Review current evidence before any further change.'};
   record(latest,'Automatic recovery stopped safely. Merchant review is required; no automatic grant retry.');store.saveCase(id,latest);return {status:'needs-attention',caseId:s.id};
  }
 }
 async function autoTriage(id){
  return store.lock(id,async()=>{
   const cases=store.listCases(id),policy=store.autopilot(id);
   const existing=cases.find(s=>!s.paymentHold&&s.intakeMode==='sandbox'&&s.capture?.source==='paypal-sandbox'&&s.monitor?.status==='access_present'&&!proofIsCurrent(s)&&!s.job?.pending&&(!s.automation?.nextAttemptAt||Date.parse(s.automation.nextAttemptAt)<=Date.now())&&diagnose(s).code==='access_present');
   if(existing)return withRecoverySpan('auto-verify-existing',existing.id,async()=>{
    const s=existing;try{
     await fresh(s,id);
     if(diagnose(s).code!=='access_present')throw Error('Access changed before verification.');
     if(s.writes===0){investigate(s);if(s.review.outcome!=='verify-only')throw Error('Existing access is not eligible for verification.');}
     store.saveCase(id,s);
     const result=await verifyFresh(id,s.id);
     result.automation={...result.automation,status:result.phase==='verified'?'verified-existing':'verification-pending',nextAttemptAt:result.phase==='verified'?null:new Date(Date.now()+5*60000).toISOString()};
     record(result,result.phase==='verified'?'Existing access was verified automatically without a PayTrace grant.':'Existing access could not be verified yet. A read-only recheck is scheduled.');
     store.saveCase(id,result);return {status:result.automation.status,caseId:result.id};
    }catch{const latest=store.caseById(id,s.id);latest.automation={...latest.automation,status:'needs-attention',nextAttemptAt:new Date(Date.now()+5*60000).toISOString(),error:'Current payment or access could not be confirmed.'};record(latest,'Automatic existing-access check needs attention. No grant was attempted.');store.saveCase(id,latest);return {status:'needs-attention',caseId:s.id};}
   });
   if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return {status:'ai-not-configured'};
   if(!store.get(id)?.operator)return {status:'operator-required'};
   const retry=cases.find(s=>!s.paymentHold&&s.approval?.mode==='policy'&&s.writes===1&&s.phase==='unverified'&&s.automation?.status==='verification-pending'&&Date.parse(s.automation.nextAttemptAt||0)<=Date.now());
   if(retry)return withRecoverySpan('auto-verify',retry.id,async()=>{const result=await verifyFresh(id,retry.id);result.automation={...result.automation,status:result.phase==='verified'?'verified':'verification-pending',nextAttemptAt:result.phase==='verified'?null:new Date(Date.now()+5*60000).toISOString()};store.saveCase(id,result);return {status:result.automation.status,caseId:result.id};});
   const reviewed=policy.enabled&&cases.find(s=>!s.paymentHold&&s.automation?.status==='awaiting-merchant'&&s.automation?.policyCheckedId!==policy.id&&s.review?.mode==='model'&&!s.job?.pending);
   if(reviewed)return withRecoverySpan('auto-recover',reviewed.id,()=>autoRecoverReady(id,reviewed,policy));
   const candidate=cases.find(s=>!s.paymentHold&&s.intakeMode==='sandbox'&&s.capture?.source==='paypal-sandbox'&&s.monitor?.status==='attention'&&!s.review&&!s.job?.pending&&(!s.automation?.nextAttemptAt||Date.parse(s.automation.nextAttemptAt)<=Date.now()));
   if(!candidate)return {status:'nothing-due'};
   return withRecoverySpan('auto-triage',candidate.id,async()=>{
   const s=candidate,now=new Date().toISOString();
   s.automation={...(s.automation||{}),status:'investigating',startedAt:now,attempts:(s.automation?.attempts||0)+1};
   record(s,'Automatic investigation started after the delivery window. No access change was authorized.');
   store.saveCase(id,s);
   try{
    await fresh(s,id);
    if(s.paymentHold||s.monitor?.status!=='attention'||s.entitlement?.active)return {status:'no-longer-missing'};
    investigate(s);s.review=null;s.phase='reviewing';
    s.agentRun={mode:'model',status:'running',step:'evidence',agent:null,completed:[],startedAt:now,updatedAt:now};store.saveCase(id,s);
    const progress=async({agent,step,status})=>{noteSpecialistProgress(agent,status);s.agentRun={...s.agentRun,step,agent,completed:status==='completed'?[...s.agentRun.completed,step]:s.agentRun.completed,updatedAt:new Date().toISOString()};store.saveCase(id,s);};
    attachAnalysis(s,await analyze(s,env,fetcher,progress));
    s.agentRun={...s.agentRun,status:'complete',step:'done',agent:null,updatedAt:new Date().toISOString()};
    s.automation={...s.automation,status:'awaiting-merchant',completedAt:new Date().toISOString(),nextAttemptAt:null};
    record(s,'Automatic evidence review completed. Merchant approval is required for any correction.');
    store.saveCase(id,s);return autoRecoverReady(id,s,policy);
   }catch(e){
    s.review=null;s.analysis=null;if(!s.paymentHold)s.phase='review-failed';
    s.agentRun={...(s.agentRun||{}),status:'failed',updatedAt:new Date().toISOString()};
    s.automation={...s.automation,status:'needs-attention',nextAttemptAt:new Date(Date.now()+5*60000).toISOString(),error:'Investigation could not complete. Retry after checking both connections.'};
    record(s,'Automatic investigation needs attention. No access change was authorized.');
    store.saveCase(id,s);return {status:'needs-attention',caseId:s.id};
   }
   });
  });
 }
 async function stage(id,step,jobId){return store.lock(id,async()=>{
  const row=store.get(id);if(!row)throw Error('Session not found.');let s=reconcileWorkflow(row.state,id);
  if(s.job?.expiredAt)throw Error('Workflow has expired. Start a fresh review or retry verification; this callback cannot resume it.');
  if(!jobId||s.job?.id!==jobId||s.job.caseId!==s.id)throw Error('Workflow is obsolete.');
  const steps={investigate:['gather','analyze','record'],recover:['repair','verify']}[s.job.kind]||[];
  if(!steps.includes(step))throw Error('Stage does not belong to this workflow.');
  if(Object.hasOwn(s.job.completed||{},step))return s.job.completed[step];
  const next=steps.find(name=>!Object.hasOwn(s.job.completed||{},name));
  if(step!==next)throw Error('Workflow stages must run in order.');
  if(!row.operator)throw Error('Workflow requires an authorized operator session.');
  try{
   let result;
   if(step==='gather'){await fresh(s,id);investigate(s);s.review=null;s.phase='reviewing';result={fingerprint:fingerprint(s)};}
   if(step==='analyze'){s.review=null;s.phase='reviewing';beginAgentRun(s,id,true);attachAnalysis(s,await analyze(s,env,fetcher,agentProgress(s,id)));finishAgentRun(s,id);result={mode:s.analysis.mode};}
   if(step==='record'){record(s,'Investigation workflow completed. Merchant decision required.');result={phase:s.phase};}
   if(step==='repair'){await repairApproved(s,id);result={writes:s.writes};}
   if(step==='verify'){s=await verifyFresh(id);result={verified:s.phase==='verified',writes:s.writes};}
   s.job={...s.job,completed:{...s.job.completed,[step]:result},pending:step!==steps.at(-1),error:null};
   store.save(id,s);return result;
  }catch(e){s=store.get(id).state;s.job={...s.job,pending:false,error:e.message};if(s.job.kind==='investigate'){s.phase='review-failed';s.review=null;s.analysis=null;failAgentRun(s,id);record(s,'Investigation stopped before a recommendation was recorded. No repair was authorized.');}store.save(id,s);throw e;}
 });}
 async function enqueue(id,kind){const row=store.get(id),s=row.state;const jobId=randomUUID();if(kind==='investigate'){s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='reviewing';beginAgentRun(s,id,true)}const startedAt=new Date().toISOString();s.job={id:jobId,caseId:s.id,kind,pending:true,startedAt,deadlineAt:new Date(Date.now()+timeoutMs).toISOString(),completed:{}};store.save(id,s);try{const r=await fetcher('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:kind==='investigate'?env.RENDER_INVESTIGATE_TASK:env.RENDER_RECOVER_TASK,input:[id,jobId]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Render did not accept the workflow run.');const run=await r.json();const latest=store.get(id).state;latest.job={...latest.job,runId:run.id||null};store.save(id,latest);return {state:latest,job:true}}catch(e){const latest=store.get(id).state;latest.job={...latest.job,pending:false,error:e.message};if(kind==='investigate'){latest.phase='review-failed';failAgentRun(latest,id);record(latest,'Investigation could not start. No repair was authorized.');}store.save(id,latest);throw e}}
 async function action(id,body){return store.lock(id,async()=>{const row=store.get(id);if(!row)throw Error('Session not found.');let s=reconcileWorkflow(row.state,id);if(body.caseId!==undefined&&body.action!=='select-case'&&body.action!=='create-case'&&body.caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.job?.pending)throw Error('A workflow is already running. Refresh shortly.');
  switch(body.action){
   case 'create-case':{
    const input=validateNewCase(body),portfolio=store.listCases(id),existing=portfolio.find(c=>c.id==='CL-'+input.requestId);
    if(existing){if(JSON.stringify(existing.creationInput)!==JSON.stringify(input))throw Error('This request already created a different case. Refresh the queue.');s=existing;break;}
    if(portfolio.length>=100)throw Error('This demo workspace has reached its 100-case limit.');
    s=newCase(input);break;
   }
   case 'select-case':s=store.caseById(id,body.caseId);break;
   case 'sample-age':if(s.capture?.source!=='sample')throw Error('Only sample purchase timestamps can be changed.');s.paidAt=new Date(Date.now()-10*60000).toISOString();record(s,'Demo: sample purchase moved ten minutes into the past.');break;
   case 'reset':s=createCase(s.scenario,'CL-'+randomUUID().slice(0,12));break;
   case 'scenario':s=simulatePayment(createCase(body.scenario,'CL-'+randomUUID().slice(0,12)));break;
   case 'pay':if(s.intakeMode==='sandbox')throw Error('Use PayPal sandbox checkout for this case. Sample payment is disabled.');if(s.paypalOrderId)throw Error('A PayPal sandbox checkout already exists. Restart before using sample checkout.');simulatePayment(s);break;
   case 'investigate':if(row.operator&&workflowReady())return enqueue(id,'investigate');s.review=null;s.analysis=null;s.phase='reviewing';beginAgentRun(s,id,row.operator);try{await fresh(s,id);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{},fetcher,agentProgress(s,id)));finishAgentRun(s,id);}catch(e){s.phase='review-failed';s.review=null;s.analysis=null;failAgentRun(s,id);record(s,'Investigation stopped before a recommendation was recorded. No repair was authorized.');store.save(id,s);throw e;}break;
   case 'change-evidence':changeSampleEvidence(s);break;
   case 'restore-evidence':restoreSampleEvidence(s);break;
   case 'rehearse':await fresh(s,id);if(s.paymentHold)throw Error('Payment is on hold.');rehearse(s);break;
   case 'approve':await fresh(s,id);if(s.paymentHold)throw Error('Payment is on hold.');approve(s,body.planId);break;
   case 'repair':if(!s.approval&&!(external(s)&&store.accessIntent(id,s.id)))throw Error('Merchant approval is required.');if(row.operator&&workflowReady())return enqueue(id,'recover');await repairApproved(s,id);s=await verifyFresh(id);break;
   case 'verify':s=await verifyFresh(id);break;
   default:throw Error('Unknown action.');
  }store.save(id,s);if(body.action==='scenario')store.seedAccess(id,s);return {state:s}})}
 async function paypalCreate(id,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.capture)throw Error('This purchase already has a payment.');if(!s.paypalOrderId){s.paypalOrderId=await paypal.create(s);store.save(id,s)}return {id:s.paypalOrderId}})}
 async function paypalCapture(id,orderId,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(!s.paypalOrderId||s.paypalOrderId!==orderId)throw Error('Sandbox order does not belong to this session.');if(!s.capture){s.capture=await paypal.capture(s);s.paidAt=new Date().toISOString();s.revision++;s.phase='paid';record(s,'PayPal sandbox capture saved; deliberate entitlement failure injected.');store.save(id,s)}else{await fresh(s,id);store.save(id,s)}return {state:s}})}
 async function paypalWebhook(event){
  if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED'].includes(event?.event_type)){
   const eventId=event.id,orderId=event.resource?.supplementary_data?.related_ids?.order_id;
   if(typeof eventId!=='string'||eventId.length>200||typeof orderId!=='string'||!/^[A-Za-z0-9-]{5,128}$/.test(orderId))throw Error('Payment change event lacks a valid order reference.');
   if(store.webhookSeen(eventId))return {status:'duplicate'};
   const matches=store.findByPaypalOrder(orderId);if(matches.length!==1)return {status:'unmatched'};
   const {owner,id:caseId}=matches[0];return store.lock(owner,async()=>{
    if(store.webhookSeen(eventId))return {status:'duplicate'};
    const s=store.caseById(owner,caseId);if(s.intakeMode!=='sandbox'||s.paypalOrderId!==orderId)throw Error('Payment change does not match this purchase.');
    s.paymentHold={status:'PROVIDER_REVIEW_PENDING',at:new Date().toISOString(),eventType:event.event_type};s.approval=null;s.rehearsal=null;s.review=null;s.proof=null;s.phase='payment-hold';
    record(s,'Signed PayPal payment change received. Access actions are on hold pending a fresh provider check.');store.saveCase(owner,s);
    try{await fresh(s,owner)}catch{record(s,'Provider or course records could not be refreshed. Payment hold remains in place.');store.saveCase(owner,s);}
    store.durable.queue({id:'webhook:'+eventId+':'+owner,owner,kind:'webhook-reconcile'});
    store.markWebhook(eventId,owner,caseId);return {status:'processed',caseId,hold:true};
   });
  }
  if(event?.event_type!=='PAYMENT.CAPTURE.COMPLETED')return {status:'ignored'};
  const eventId=event.id,orderId=event.resource?.supplementary_data?.related_ids?.order_id,captureId=event.resource?.id;
  if(![eventId,orderId,captureId].every(x=>typeof x==='string'&&/^[A-Za-z0-9-]{5,128}$/.test(x))||event.resource?.status!=='COMPLETED')throw Error('Capture event lacks an exact payment reference.');
  if(store.webhookSeen(eventId))return {status:'duplicate'};
  const matches=store.findByPaypalOrder(orderId);
  if(matches.length!==1)return {status:'unmatched'};
  const {owner,id:caseId}=matches[0];
  return store.lock(owner,async()=>{
   if(store.webhookSeen(eventId))return {status:'duplicate'};
   const s=store.caseById(owner,caseId);
   if(s.intakeMode!=='sandbox'||s.paypalOrderId!==orderId||s.capture&&s.capture.id!==captureId)throw Error('Webhook does not match the saved sandbox purchase.');
   // The event is a trigger only. Confirm order ownership and capture status by API.
   const current=await paypal.refresh(s);
   if(current.id!==captureId||current.status!=='COMPLETED'||current.orderId!==s.order.id||current.userId!==s.order.userId||current.courseId!==s.order.courseId||current.amount!==s.order.amount||current.currency!==s.order.currency)throw Error('Fresh PayPal capture does not match this purchase.');
   const wasPaid=!!s.capture;
   s.capture=current;
   s.paymentSignal={source:'paypal-sandbox-webhook',eventId,confirmedAt:new Date().toISOString()};
   if(!wasPaid){s.paidAt=new Date().toISOString();s.revision++;s.phase='paid';record(s,'PayPal sandbox capture confirmed from a signed event; access check started.');}
   try{await fresh(s,owner);}catch{record(s,'Payment confirmed, but current course access could not be read. No repair was made.');}
   scanCases([s],{graceMinutes:store.grace(owner)});
   store.saveCase(owner,s);
   store.durable.queue({id:'webhook:'+eventId+':'+owner,owner,kind:'webhook-reconcile'});
   store.markWebhook(eventId,owner,caseId);
   return {status:'processed',caseId,access:s.sources?.access?.status||'unavailable',monitor:s.monitor?.status||null};
  });
 }
 async function caseInfo(id,caseId){return store.lock(id,async()=>{const s=store.get(id).state;if(s.id!==caseId)throw Error('The selected case changed. Reopen it from the queue.');if(!s.job?.pending)await readCaseSources(s,id,{paypal,access:(owner,state)=>external(state)?course.check(state):access(owner,state),accessSystem:external(s)?'External course access service':'Course access service'});store.save(id,s);return {state:s};});}
 async function agentQuestion(id,{caseId,agent,question,requestId}={}){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session before asking an AI specialist.');const s=row.state;if(caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue.');if(s.job?.pending)throw Error('Wait for the current workflow to finish.');if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw Error('A valid request ID is required.');await fresh(s,id);if(!reviewIsCurrent(s)||s.review?.mode!=='model'||s.analysis?.mode!=='model')throw Error('Run a current model-backed review before asking a specialist.');const prior=(s.agentQuestions||[]).find(item=>item.id===requestId);if(prior){if(prior.agent!==agent||prior.question!==question?.trim()||prior.reviewFingerprint!==s.review.fingerprint)throw Error('This request ID belongs to a different question.');return {state:s,answer:prior};}if((s.agentQuestions||[]).filter(item=>item.reviewFingerprint===s.review.fingerprint).length>=8)throw Error('This review has reached its eight-question limit.');const response=await answerQuestion(s,agent,question,env,fetcher);const entry={id:requestId,...response,reviewFingerprint:s.review.fingerprint,citedSnapshot:Object.fromEntries(response.sources.map(source=>[source,structuredClone(s.review.snapshot[source])])),at:new Date().toISOString(),mode:'model'};s.agentQuestions=[...(s.agentQuestions||[]),entry].slice(-20);record(s,`Merchant asked ${['Ledger','Relay','Patch','Prism'][agent]} a read-only follow-up. No access change was requested.`);store.save(id,s);return {state:s,answer:entry};});}
 const caseKey=id=>store.get(id)?.state?.id||id;
 const traced=(step,id,work)=>withRecoverySpan(step,caseKey(id),work);
 return {
  caseInfo:(id,caseId)=>traced('case-read',id,()=>caseInfo(id,caseId)),
  action:(id,body)=>traced(['investigate','rehearse','approve','repair','verify'].includes(body?.action)?body.action:'other',id,()=>action(id,body)),
  stage:(id,step,jobId)=>traced('workflow-'+step,id,()=>stage(id,step,jobId)),
  lesson,customerLesson,
  paypalCreate:(id,caseId)=>traced('paypal-create',id,()=>paypalCreate(id,caseId)),
  paypalCapture:(id,orderId,caseId)=>traced('paypal-capture',id,()=>paypalCapture(id,orderId,caseId)),
  paypalWebhook:event=>withRecoverySpan('paypal-webhook',event?.resource?.supplementary_data?.related_ids?.order_id,()=>paypalWebhook(event)),
  // The 30-second monitor can scan many demo owners; tracing idle polls would
  // flood the workspace. autoTriage emits a span only when it starts real work.
  scan,autoTriage,setAutopilot:(id,input)=>store.lock(id,()=>setAutopilot(id,input)),autopilotReady,
  agentQuestion,
  draft:id=>customerDraft(store.get(id).state,{mode:'server-demo'}),
  receipt:id=>recoveryReceipt(store.get(id).state,{mode:'server-demo'}),
  runReport:id=>buildRunReport(store.get(id).state,{backend:true})
 };
}
