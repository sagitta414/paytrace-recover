import {verificationAge,proofFresh} from '../dist/verification-policy.mjs';
import {courseConnector} from './course-connector.mjs';
import {workflowTimeout,expireWorkflow} from './workflow-lifecycle.mjs';
import {workspaceOverview} from '../dist/workspace-model.mjs';
import {readCaseSources} from './case-sources.mjs';
import {newCase,validateNewCase} from '../dist/new-case-model.mjs';
import {randomUUID} from 'node:crypto';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify,canOpenLesson,record,fingerprint,attachAnalysis,changeSampleEvidence,restoreSampleEvidence} from '../dist/core.mjs';
import {analyze} from './ai.mjs';import {paypalClient} from './paypal.mjs';
import {scanCases,customerDraft,recoveryReceipt} from '../dist/operations.mjs';
import {validateGrace} from '../dist/diagnosis.mjs';
export function createService(store,env=process.env,{fetcher=fetch,paypal=paypalClient(env,fetcher),probe,access=(owner,s)=>store.readAccess(owner,s),clock=Date.now,connector=courseConnector(env,fetcher)}={}){
 const timeoutMs=workflowTimeout(env),maxVerificationAge=verificationAge(env);const readAccess=connector?(owner,s)=>connector.read(owner,s):access;
 function reconcile(s,id){if(s.proof?.passed&&!s.firstVerifiedAt)s.firstVerifiedAt=s.proof.at;s.verificationMaxAgeMs=maxVerificationAge;if(s.phase==='verified'&&s.proof?.passed&&!proofFresh(s,clock())){s.phase='unverified';record(s,'Verification expired. Last passing check is retained; recheck current sources.');store.saveCase(id,s);}if(expireWorkflow(s,{now:clock(),timeoutMs}))store.saveCase(id,s);return s;}
 function reconciledCases(id){return store.listCases(id).map(s=>reconcile(s,id));}
 async function operations(id){return store.lock(id,async()=>({cases:reconciledCases(id),graceMinutes:store.grace(id)}));}
 async function overview(id){return store.lock(id,async()=>workspaceOverview(reconciledCases(id),{preferences:store.preferences(id),reminders:store.support.reminders(id),followups:store.support.inbox(id),graceMinutes:store.grace(id),now:clock()}));}
 const workflowReady=()=>!!(env.RENDER_API_KEY&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK&&env.WORKFLOW_SECRET);
 async function fresh(s,id){const ok=await readCaseSources(s,id,{paypal,access:readAccess});s.verificationMaxAgeMs=maxVerificationAge;
 const managedAccess=s.writes===1||s.entitlement?.active&&s.entitlement.captureId===s.capture?.id;const status=s.capture?.status,full=['REFUNDED','REVERSED','DENIED','DECLINED','FAILED'].includes(status),partial=status==='PARTIALLY_REFUNDED';
 if(full||partial){if(s.paymentHold?.status!==status){s.paymentHold={...s.paymentHold,status,at:new Date(clock()).toISOString(),action:full?'suspend':'review'};record(s,full?'Provider payment changed. Purchased access is suspended pending review.':'Partial refund requires merchant review. No automatic regrant.');}s.approval=null;s.rehearsal=null;s.proof=null;s.review=null;s.phase='payment-hold';
  if(full){store.suspend(id,s);if(connector&&managedAccess&&!s.paymentHold.externalSuspended){try{await connector.suspend(id,s,'suspend:'+id+':'+s.id+':'+s.capture.id);s.paymentHold.externalSuspended=true;}catch{store.durable.event('course.suspend','error','External suspension pending; local access remains blocked.');throw Error('External access suspension could not be confirmed; local access remains blocked.');}}}
 }
 store.saveCase(id,s);if(!ok)throw Error('Payment or course access records are unavailable. Refresh both systems before continuing.');}
 function lesson(id){if(!connector)return store.lesson(id);return (async()=>{const s=store.get(id)?.state;if(s.paymentHold)throw Error('Access is on payment hold.');await fresh(s,id);if(s.paymentHold)throw Error('Access is on payment hold.');return connector.probe(id,s);})();}
 async function verifyFresh(id,{requireSources=false}={}){const s=store.get(id).state;let available=true;try{await fresh(s,id)}catch{available=false;if(requireSources)throw Error("Current sources are unavailable. Refresh the case before retrying this action.");}store.save(id,s);if(s.scenario==='read-error'&&s.reads===0)available=false;let resource=null,access=false;const token=connector?null:store.mintLearnerToken(id,s.id,30000);try{resource=connector?await connector.probe(id,s):probe?await probe(token):store.readLearnerToken(token);access=resource?.accessible===true&&resource.userId===s.order.userId&&resource.courseId===s.order.courseId&&resource.captureId===s.capture?.id&&(connector?typeof resource.contentId==='string':resource.contentId==='light-lesson-01')&&typeof resource.body==='string'&&resource.body.length>20;}catch{}finally{if(token)store.revokeLearnerToken(token);}verify(s,{paymentAvailable:available,lessonAvailable:access,transport:connector?'external-course-api':probe?'authenticated-http':'scoped-content-adapter',resource:access?{contentId:resource.contentId,userId:resource.userId,courseId:resource.courseId}:null});store.save(id,s);return s}
 async function applyAccess(id,s){if(!connector){applyRepair(s);store.grant(id,s);return s;}let intent=store.durable.intent(id,s.id);if(intent&&intent.expected!==connector.identity(s))throw Error('Payment evidence changed after an external access attempt. Review the unresolved operation.');
 if(intent&&s.entitlement.active&&s.entitlement.captureId===s.capture.id){s.writes=1;s.revision++;s.approval=intent.approval;s.phase='verifying';record(s,'Reconciled the previously approved external access grant. No repeated grant.');store.grant(id,s);store.durable.saveIntent(id,s.id,{...intent,state:'confirmed'});return s;}
 const copy=structuredClone(s);applyRepair(copy);intent=intent||{key:'grant:'+id+':'+s.id+':'+s.capture.id,expected:connector.identity(s),approval:s.approval,state:'pending'};store.durable.saveIntent(id,s.id,intent);
 try{copy.entitlement=await connector.grant(id,s,intent.key);store.grant(id,copy);store.durable.saveIntent(id,s.id,{...intent,state:'confirmed'});return copy;}catch{record(s,'External write result is unknown. Retry reconciles with the same operation key.');store.save(id,s);throw Error('External access result is not confirmed. Refresh and retry; no new operation key will be created.');}}
 async function scan(id,{graceMinutes}={}){return store.lock(id,async()=>{if(graceMinutes!==undefined)store.setGrace(id,validateGrace(graceMinutes));const cases=store.listCases(id);let failures=0;for(const s of cases){reconcile(s,id);if(s.job?.pending)continue;const before=fingerprint(s);if(s.paypalOrderId){try{await fresh(s,id);}catch{failures++;}}if(before!==fingerprint(s)&&s.review){s.approval=null;s.rehearsal=null;s.proof=null;s.phase='stale';}}
   scanCases(cases,{graceMinutes:store.grace(id)});for(const s of cases)store.saveCase(id,s);return {cases,failures,graceMinutes:store.grace(id),checkedAt:new Date().toISOString()};});}
 async function stage(id,step,jobId){return store.lock(id,async()=>{
  const row=store.get(id);if(!row)throw Error('Session not found.');let s=reconcile(row.state,id);
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
   if(step==='analyze'){s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,env,fetcher));result={mode:s.analysis.mode};}
   if(step==='record'){record(s,'Investigation workflow completed. Merchant decision required.');result={phase:s.phase};}
   if(step==='repair'){await fresh(s,id);s=await applyAccess(id,s);result={writes:s.writes};}
   if(step==='verify'){s=await verifyFresh(id);result={verified:s.phase==='verified',writes:s.writes};}
   s.job={...s.job,completed:{...s.job.completed,[step]:result},pending:step!==steps.at(-1),error:null};
   store.save(id,s);store.center.audit(id,{action:'workflow.'+step,caseId:s.id,detail:'Authenticated workflow stage completed.'});return result;
  }catch(e){s=store.get(id).state;s.job={...s.job,pending:false,error:e.message};store.save(id,s);store.center.audit(id,{action:'workflow.'+step,caseId:s.id,outcome:'failed',detail:'Workflow stage did not complete.'});throw e;}
 });}
 async function enqueue(id,kind){const row=store.get(id),s=row.state;const jobId=randomUUID();if(kind==='investigate'){s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='reviewing'}s.job={id:jobId,caseId:s.id,kind,pending:true,startedAt:new Date(clock()).toISOString(),deadlineAt:new Date(clock()+timeoutMs).toISOString(),completed:{}};store.save(id,s);try{const r=await fetcher('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:kind==='investigate'?env.RENDER_INVESTIGATE_TASK:env.RENDER_RECOVER_TASK,input:[id,jobId]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Render did not accept the workflow run.');const run=await r.json();const latest=store.get(id).state;latest.job={...latest.job,runId:run.id||null};store.save(id,latest);return {state:latest,job:true}}catch(e){const latest=store.get(id).state;latest.job={...latest.job,pending:false,error:e.message};store.save(id,latest);throw e}}
 async function action(id,body){return store.lock(id,async()=>{const row=store.get(id);if(!row)throw Error('Session not found.');let s=reconcile(row.state,id);if(body.caseId!==undefined&&body.action!=='select-case'&&body.action!=='create-case'&&body.caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.job?.pending)throw Error('A workflow is already running. Refresh shortly.');if(s.paymentHold&&['approve','repair','rehearse'].includes(body.action))throw Error('Payment is on hold. No access change is permitted.');
  store.center.audit(id,{actor:body.auditActor||'system',role:body.auditRole||'system',action:'case.action-attempt',caseId:s.id,outcome:'attempt',detail:['create-case','select-case','investigate','rehearse','approve','repair','verify'].includes(body.action)?body.action:'other'});
  switch(body.action){
   case 'create-case':{
    const input=validateNewCase(body);let external=null;if(connector){if(typeof body.learnerId!=='string'||!body.learnerId.trim()||body.learnerId.length>128||/[\x00-\x1f<>]/.test(body.learnerId))throw Error('Enter the exact learner ID from the course platform.');external={learnerId:body.learnerId.trim(),courseId:env.COURSE_ID||'course-light'};}const requestInput={...input,...external},portfolio=store.listCases(id),existing=portfolio.find(c=>c.id==='CL-'+input.requestId);
    if(existing){if(JSON.stringify(existing.creationInput)!==JSON.stringify(requestInput))throw Error('This request already created a different case. Refresh the queue.');s=existing;break;}
    if(portfolio.length>=100)throw Error('This demo workspace has reached its 100-case limit.');
    s=newCase(input);if(external){s.creationInput=requestInput;s.order.userId=external.learnerId;s.currentAccountId=external.learnerId;s.entitlement.userId=external.learnerId;s.order.courseId=external.courseId;s.entitlement.courseId=external.courseId;s.courseName=env.COURSE_NAME||'The Light & Story Workshop';s.order.amount=Number(env.COURSE_AMOUNT_MINOR||12800);s.order.currency=env.COURSE_CURRENCY||'USD';s.merchantId=id;if(!Number.isSafeInteger(s.order.amount)||s.order.amount<=0||!['USD','EUR','GBP','AUD','CAD'].includes(s.order.currency))throw Error('Configured course price or currency is invalid.');}break;
   }
   case 'select-case':s=store.caseById(id,body.caseId);break;
   case 'sample-age':if(s.capture?.source!=='sample')throw Error('Only sample purchase timestamps can be changed.');s.paidAt=new Date(Date.now()-10*60000).toISOString();record(s,'Demo: sample purchase moved ten minutes into the past.');break;
   case 'reset':s=createCase(s.scenario,'CL-'+randomUUID().slice(0,12));break;
   case 'scenario':s=simulatePayment(createCase(body.scenario,'CL-'+randomUUID().slice(0,12)));break;
   case 'pay':if(s.intakeMode==='sandbox')throw Error('Use PayPal sandbox checkout for this case. Sample payment is disabled.');if(s.paypalOrderId)throw Error('A PayPal sandbox checkout already exists. Restart before using sample checkout.');simulatePayment(s);break;
   case 'investigate':if(row.operator&&workflowReady())return enqueue(id,'investigate');s.review=null;s.phase='reviewing';store.save(id,s);await fresh(s,id);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{},fetcher));break;
   case 'change-evidence':changeSampleEvidence(s);break;
   case 'restore-evidence':restoreSampleEvidence(s);break;
   case 'rehearse':await fresh(s,id);rehearse(s);break;
   case 'approve':await fresh(s,id);approve(s,body.planId);s.approval.actor=body.auditActor||'system';s.approval.role=body.auditRole||'system';break;
   case 'repair':if(connector&&!s.writes&&store.durable.intent(id,s.id)){await fresh(s,id);s=await applyAccess(id,s);s=await verifyFresh(id);break;}if(s.writes){s=await verifyFresh(id,{requireSources:true});break;}if(!s.approval)throw Error('Merchant approval is required.');if(row.operator&&workflowReady())return enqueue(id,'recover');await fresh(s,id);s=await applyAccess(id,s);s=await verifyFresh(id);break;
   case 'verify':s=await verifyFresh(id);break;
   default:throw Error('Unknown action.');
  }store.save(id,s);if(body.action==='scenario')store.seedAccess(id,s);return {state:s}})}
 async function paypalCreate(id,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(s.onboarding)throw Error('Create a case with the exact course-platform learner ID first.');if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.capture)throw Error('This purchase already has a payment.');if(!s.paypalOrderId){s.paypalOrderId=await paypal.create(s);store.save(id,s)}return {id:s.paypalOrderId}})}
 async function paypalCapture(id,orderId,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(!s.paypalOrderId||s.paypalOrderId!==orderId)throw Error('Sandbox order does not belong to this session.');if(!s.capture){s.capture=await paypal.capture(s);s.paidAt=new Date().toISOString();s.revision++;s.phase='paid';record(s,'PayPal sandbox capture saved; deliberate entitlement failure injected.');store.save(id,s)}else{await fresh(s,id);store.save(id,s)}return {state:s}})}
 async function caseInfo(id,caseId){return store.lock(id,async()=>{const s=reconcile(store.get(id).state,id);if(s.id!==caseId)throw Error('The selected case changed. Reopen it from the queue.');if(!s.job?.pending){try{await fresh(s,id);}catch{}}store.save(id,s);return {state:s};});}
 return {operations,overview,caseInfo,action,stage,lesson,paypalCreate,paypalCapture,scan,draft:id=>customerDraft(store.get(id).state,{mode:'server-demo'}),receipt:id=>recoveryReceipt(store.get(id).state,{mode:'server-demo'})};
}
