import {readCaseSources} from './case-sources.mjs';
import {newCase,validateNewCase} from '../dist/new-case-model.mjs';
import {randomUUID} from 'node:crypto';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify,canOpenLesson,record,fingerprint,reviewIsCurrent,attachAnalysis,changeSampleEvidence,restoreSampleEvidence} from '../dist/core.mjs';
import {analyze,answerQuestion} from './ai.mjs';import {paypalClient} from './paypal.mjs';
import {courseAccessClient} from './course-access.mjs';
import {scanCases,customerDraft,recoveryReceipt,proofIsCurrent} from '../dist/operations.mjs';
import {validateGrace} from '../dist/diagnosis.mjs';
import {buildRunReport} from '../dist/run-report.mjs';
export function createService(store,env=process.env,{fetcher=fetch,paypal=paypalClient(env,fetcher),probe,access=(owner,s)=>store.readAccess(owner,s),course=courseAccessClient(env,fetcher)}={}){
 const workflowReady=()=>!!(env.RENDER_API_KEY&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK&&env.WORKFLOW_SECRET);
 const external=s=>Boolean(course&&s.intakeMode==='sandbox');
 function beginAgentRun(s,id,operator){s.agentRun={mode:operator&&env.OPENAI_API_KEY&&env.OPENAI_MODEL?'model':'scripted',status:'running',step:'evidence',agent:null,completed:[],startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};store.save(id,s);}
 function agentProgress(s,id){return async({agent,step,status})=>{s.agentRun={...s.agentRun,status:'running',step,agent,completed:status==='completed'?[...s.agentRun.completed,step]:s.agentRun.completed,updatedAt:new Date().toISOString()};store.save(id,s);};}
 function finishAgentRun(s,id){s.agentRun={...s.agentRun,status:'complete',step:'done',agent:null,updatedAt:new Date().toISOString()};store.save(id,s);}
 function failAgentRun(s,id){s.agentRun={...(s.agentRun||{mode:'unknown',completed:[],startedAt:new Date().toISOString()}),status:'failed',updatedAt:new Date().toISOString()};store.save(id,s);}
 async function fresh(s,id){const ok=await readCaseSources(s,id,{paypal,access:(owner,state)=>external(state)?course.check(state):access(owner,state),accessSystem:external(s)?'External course access service':'Course access service'});store.saveCase(id,s);if(!ok)throw Error('Payment or course access records are unavailable. Refresh both systems before continuing.');}
 async function repairApproved(s,id){
  await fresh(s,id);
  if(s.writes>0)return;
  if(!s.approval||s.phase!=='approved'||s.approval.fingerprint!==fingerprint(s))throw Error('Approval or fresh evidence is missing or has changed.');
  if(external(s)){
   // The external service must confirm the grant before PayTrace records a write.
   // A timeout leaves approval visible and requires a fresh read before retry.
   const granted=await course.grant(s);
   applyRepair(s);
   s.entitlement=granted;
   store.save(id,s);
  }else{applyRepair(s);store.grant(id,s);}
 }
 function lesson(id){const s=store.get(id)?.state;if(!s)throw Error('No session.');return external(s)?course.probe(s):store.lesson(id);}
 async function customerLesson(id,caseId){const s=store.caseById(id,caseId);if(!external(s))return store.support.lesson(id,caseId);if(!proofIsCurrent(s)||s.evidenceAvailable===false||Object.values(s.sources||{}).some(x=>x?.status==='unavailable'))throw Error('Access is still being checked.');const value=await course.probe(s);if(value?.accessible!==true||value.userId!==s.order.userId||value.courseId!==s.order.courseId||value.captureId!==s.capture.id||value.contentId!=='light-lesson-01'||typeof value.body!=='string'||value.body.length<=20)throw Error('Protected course content could not be confirmed.');return {accessible:true,title:value.title||'Your purchased lesson',body:value.body,lesson:value.lesson||'Purchased lesson',contentId:value.contentId};}
 async function verifyFresh(id){const s=store.get(id).state;let available=true;try{await fresh(s,id)}catch{available=false}store.save(id,s);if(s.scenario==='read-error'&&s.reads===0)available=false;let resource=null,access=false,transport;if(external(s)){transport='external-course-service';try{resource=await course.probe(s)}catch{}}else{transport=probe?'authenticated-http':'scoped-content-adapter';const token=store.mintLearnerToken(id,s.id,30000);try{resource=probe?await probe(token):store.readLearnerToken(token)}catch{}finally{store.revokeLearnerToken(token);}}access=resource?.accessible===true&&resource.userId===s.order.userId&&resource.courseId===s.order.courseId&&resource.captureId===s.capture?.id&&resource.contentId==='light-lesson-01'&&typeof resource.body==='string'&&resource.body.length>20;verify(s,{paymentAvailable:available,lessonAvailable:access,transport,resource:access?{contentId:resource.contentId,userId:resource.userId,courseId:resource.courseId}:null});store.save(id,s);return s}
 async function scan(id,{graceMinutes}={}){return store.lock(id,async()=>{if(graceMinutes!==undefined)store.setGrace(id,validateGrace(graceMinutes));const cases=store.listCases(id);for(const s of cases){if(s.job?.pending)continue;const before=fingerprint(s);if(s.capture?.source==='paypal-sandbox'){try{await fresh(s,id);}catch{}}if(before!==fingerprint(s)&&s.review){s.approval=null;s.rehearsal=null;s.proof=null;s.phase='stale';}}
   scanCases(cases,{graceMinutes:store.grace(id)});for(const s of cases)store.saveCase(id,s);return {cases,graceMinutes:store.grace(id),checkedAt:new Date().toISOString()};});}
 async function autoTriage(id){
  if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return {status:'ai-not-configured'};
  return store.lock(id,async()=>{
   if(!store.get(id)?.operator)return {status:'operator-required'};
   const cases=store.listCases(id),candidate=cases.find(s=>s.intakeMode==='sandbox'&&s.capture?.source==='paypal-sandbox'&&s.monitor?.status==='attention'&&!s.review&&!s.job?.pending&&(!s.automation?.nextAttemptAt||Date.parse(s.automation.nextAttemptAt)<=Date.now()));
   if(!candidate)return {status:'nothing-due'};
   const s=candidate,now=new Date().toISOString();
   s.automation={...(s.automation||{}),status:'investigating',startedAt:now,attempts:(s.automation?.attempts||0)+1};
   record(s,'Automatic investigation started after the delivery window. No access change was authorized.');
   store.saveCase(id,s);
   try{
    await fresh(s,id);
    if(s.monitor?.status!=='attention'||s.entitlement?.active)return {status:'no-longer-missing'};
    investigate(s);s.review=null;s.phase='reviewing';
    s.agentRun={mode:'model',status:'running',step:'evidence',agent:null,completed:[],startedAt:now,updatedAt:now};store.saveCase(id,s);
    const progress=async({agent,step,status})=>{s.agentRun={...s.agentRun,step,agent,completed:status==='completed'?[...s.agentRun.completed,step]:s.agentRun.completed,updatedAt:new Date().toISOString()};store.saveCase(id,s);};
    attachAnalysis(s,await analyze(s,env,fetcher,progress));
    s.agentRun={...s.agentRun,status:'complete',step:'done',agent:null,updatedAt:new Date().toISOString()};
    s.automation={...s.automation,status:'awaiting-merchant',completedAt:new Date().toISOString(),nextAttemptAt:null};
    record(s,'Automatic evidence review completed. Merchant approval is required for any correction.');
    store.saveCase(id,s);return {status:'awaiting-merchant',caseId:s.id};
   }catch(e){
    s.review=null;s.analysis=null;s.phase='review-failed';
    s.agentRun={...(s.agentRun||{}),status:'failed',updatedAt:new Date().toISOString()};
    s.automation={...s.automation,status:'needs-attention',nextAttemptAt:new Date(Date.now()+5*60000).toISOString(),error:'Investigation could not complete. Retry after checking both connections.'};
    record(s,'Automatic investigation needs attention. No access change was authorized.');
    store.saveCase(id,s);return {status:'needs-attention',caseId:s.id};
   }
  });
 }
 async function stage(id,step,jobId){return store.lock(id,async()=>{
  const row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;
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
 async function enqueue(id,kind){const row=store.get(id),s=row.state;const jobId=randomUUID();if(kind==='investigate'){s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='reviewing';beginAgentRun(s,id,true)}s.job={id:jobId,caseId:s.id,kind,pending:true,completed:{}};store.save(id,s);try{const r=await fetcher('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:kind==='investigate'?env.RENDER_INVESTIGATE_TASK:env.RENDER_RECOVER_TASK,input:[id,jobId]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Render did not accept the workflow run.');const run=await r.json();const latest=store.get(id).state;latest.job={...latest.job,runId:run.id||null};store.save(id,latest);return {state:latest,job:true}}catch(e){const latest=store.get(id).state;latest.job={...latest.job,pending:false,error:e.message};if(kind==='investigate'){latest.phase='review-failed';failAgentRun(latest,id);record(latest,'Investigation could not start. No repair was authorized.');}store.save(id,latest);throw e}}
 async function action(id,body){return store.lock(id,async()=>{const row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;if(body.caseId!==undefined&&body.action!=='select-case'&&body.action!=='create-case'&&body.caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.job?.pending)throw Error('A workflow is already running. Refresh shortly.');
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
   case 'rehearse':await fresh(s,id);rehearse(s);break;
   case 'approve':await fresh(s,id);approve(s,body.planId);break;
   case 'repair':if(!s.approval)throw Error('Merchant approval is required.');if(row.operator&&workflowReady())return enqueue(id,'recover');await repairApproved(s,id);s=await verifyFresh(id);break;
   case 'verify':s=await verifyFresh(id);break;
   default:throw Error('Unknown action.');
  }store.save(id,s);if(body.action==='scenario')store.seedAccess(id,s);return {state:s}})}
 async function paypalCreate(id,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(s.capture)throw Error('This purchase already has a payment.');if(!s.paypalOrderId){s.paypalOrderId=await paypal.create(s);store.save(id,s)}return {id:s.paypalOrderId}})}
 async function paypalCapture(id,orderId,caseId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(caseId!==undefined&&caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue before continuing.');if(!s.paypalOrderId||s.paypalOrderId!==orderId)throw Error('Sandbox order does not belong to this session.');if(!s.capture){s.capture=await paypal.capture(s);s.paidAt=new Date().toISOString();s.revision++;s.phase='paid';record(s,'PayPal sandbox capture saved; deliberate entitlement failure injected.');store.save(id,s)}else{await fresh(s,id);store.save(id,s)}return {state:s}})}
 async function paypalWebhook(event){
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
   store.markWebhook(eventId,owner,caseId);
   return {status:'processed',caseId,access:s.sources?.access?.status||'unavailable',monitor:s.monitor?.status||null};
  });
 }
 async function caseInfo(id,caseId){return store.lock(id,async()=>{const s=store.get(id).state;if(s.id!==caseId)throw Error('The selected case changed. Reopen it from the queue.');if(!s.job?.pending)await readCaseSources(s,id,{paypal,access:(owner,state)=>external(state)?course.check(state):access(owner,state),accessSystem:external(s)?'External course access service':'Course access service'});store.save(id,s);return {state:s};});}
 async function agentQuestion(id,{caseId,agent,question,requestId}={}){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session before asking an AI specialist.');const s=row.state;if(caseId!==s.id)throw Error('The selected case changed. Reopen it from the queue.');if(s.job?.pending)throw Error('Wait for the current workflow to finish.');if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw Error('A valid request ID is required.');await fresh(s,id);if(!reviewIsCurrent(s)||s.review?.mode!=='model'||s.analysis?.mode!=='model')throw Error('Run a current model-backed review before asking a specialist.');const prior=(s.agentQuestions||[]).find(item=>item.id===requestId);if(prior){if(prior.agent!==agent||prior.question!==question?.trim()||prior.reviewFingerprint!==s.review.fingerprint)throw Error('This request ID belongs to a different question.');return {state:s,answer:prior};}if((s.agentQuestions||[]).filter(item=>item.reviewFingerprint===s.review.fingerprint).length>=8)throw Error('This review has reached its eight-question limit.');const response=await answerQuestion(s,agent,question,env,fetcher);const entry={id:requestId,...response,reviewFingerprint:s.review.fingerprint,citedSnapshot:Object.fromEntries(response.sources.map(source=>[source,structuredClone(s.review.snapshot[source])])),at:new Date().toISOString(),mode:'model'};s.agentQuestions=[...(s.agentQuestions||[]),entry].slice(-20);record(s,`Merchant asked ${['Ledger','Relay','Patch','Prism'][agent]} a read-only follow-up. No access change was requested.`);store.save(id,s);return {state:s,answer:entry};});}
 return {caseInfo,action,stage,lesson,customerLesson,paypalCreate,paypalCapture,paypalWebhook,scan,autoTriage,agentQuestion,draft:id=>customerDraft(store.get(id).state,{mode:'server-demo'}),receipt:id=>recoveryReceipt(store.get(id).state,{mode:'server-demo'}),runReport:id=>buildRunReport(store.get(id).state,{backend:true})};
}
