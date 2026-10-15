import {readCaseSources} from './case-sources.mjs';
import {randomUUID} from 'node:crypto';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify,canOpenLesson,record,fingerprint,attachAnalysis,changeSampleEvidence,restoreSampleEvidence} from '../dist/core.mjs';
import {analyze} from './ai.mjs';import {paypalClient} from './paypal.mjs';
import {scanCases,customerDraft,recoveryReceipt} from '../dist/operations.mjs';
import {validateGrace} from '../dist/diagnosis.mjs';
export function createService(store,env=process.env,{fetcher=fetch,paypal=paypalClient(env,fetcher),probe,access=(owner,s)=>store.readAccess(owner,s)}={}){
 const workflowReady=()=>!!(env.RENDER_API_KEY&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK&&env.WORKFLOW_SECRET);
 async function fresh(s,id){const ok=await readCaseSources(s,id,{paypal,access});store.saveCase(id,s);if(!ok)throw Error('Payment or course access records are unavailable. Refresh both systems before continuing.');}
 function lesson(id){return store.lesson(id);}
 async function verifyFresh(id){const s=store.get(id).state;let available=true;try{await fresh(s,id)}catch{available=false}store.save(id,s);if(s.scenario==='read-error'&&s.reads===0)available=false;let resource=null,access=false;const token=store.mintLearnerToken(id,s.id,30000);try{resource=probe?await probe(token):store.readLearnerToken(token);access=resource?.accessible===true&&resource.userId===s.order.userId&&resource.courseId===s.order.courseId&&resource.captureId===s.capture?.id&&resource.contentId==='light-lesson-01'&&typeof resource.body==='string'&&resource.body.length>20;}catch{}finally{store.revokeLearnerToken(token);}verify(s,{paymentAvailable:available,lessonAvailable:access,transport:probe?'authenticated-http':'scoped-content-adapter',resource:access?{contentId:resource.contentId,userId:resource.userId,courseId:resource.courseId}:null});store.save(id,s);return s}
 async function scan(id,{graceMinutes}={}){return store.lock(id,async()=>{if(graceMinutes!==undefined)store.setGrace(id,validateGrace(graceMinutes));const cases=store.listCases(id);for(const s of cases){if(s.job?.pending)continue;const before=fingerprint(s);if(s.capture?.source==='paypal-sandbox'){try{await fresh(s,id);}catch{}}if(before!==fingerprint(s)&&s.review){s.approval=null;s.rehearsal=null;s.proof=null;s.phase='stale';}}
   scanCases(cases,{graceMinutes:store.grace(id)});for(const s of cases)store.saveCase(id,s);return {cases,graceMinutes:store.grace(id),checkedAt:new Date().toISOString()};});}
 async function stage(id,step,jobId){return store.lock(id,async()=>{let row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;if(!jobId||s.job?.id!==jobId)throw Error('Workflow is obsolete.');if(!({investigate:['gather','analyze','record'],recover:['repair','verify']}[s.job.kind]||[]).includes(step))throw Error('Stage does not belong to this workflow.');try{
  if(step==='gather'){await fresh(s,id);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);return {fingerprint:fingerprint(s)}}
  if(step==='analyze'){s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{} ,fetcher));store.save(id,s);return {mode:s.analysis.mode}}
  if(step==='record'){s.job={...s.job,pending:false,error:null};record(s,'Investigation workflow completed. Merchant decision required.');store.save(id,s);return {phase:s.phase}}
  if(step==='repair'){await fresh(s,id);applyRepair(s);store.grant(id,s);return {writes:s.writes}}
  if(step==='verify'){s=await verifyFresh(id);s.job={...s.job,pending:false};store.save(id,s);return {verified:s.phase==='verified',writes:s.writes}}
  throw Error('Unknown workflow stage.');
 }catch(e){if(jobId){s=store.get(id).state;s.job={...s.job,pending:false,error:e.message};store.save(id,s)}throw e}})}
 async function enqueue(id,kind){const row=store.get(id),s=row.state;const jobId=randomUUID();if(kind==='investigate'){s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='reviewing'}s.job={id:jobId,kind,pending:true};store.save(id,s);try{const r=await fetcher('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:kind==='investigate'?env.RENDER_INVESTIGATE_TASK:env.RENDER_RECOVER_TASK,input:[id,jobId]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Render did not accept the workflow run.');const run=await r.json();const latest=store.get(id).state;latest.job={...latest.job,runId:run.id||null};store.save(id,latest);return {state:latest,job:true}}catch(e){const latest=store.get(id).state;latest.job={...latest.job,pending:false,error:e.message};store.save(id,latest);throw e}}
 async function action(id,body){return store.lock(id,async()=>{const row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;if(s.job?.pending)throw Error('A workflow is already running. Refresh shortly.');
  switch(body.action){
   case 'select-case':s=store.caseById(id,body.caseId);break;
   case 'sample-age':if(s.capture?.source!=='sample')throw Error('Only sample purchase timestamps can be changed.');s.paidAt=new Date(Date.now()-10*60000).toISOString();record(s,'Demo: sample purchase moved ten minutes into the past.');break;
   case 'reset':s=createCase(s.scenario,'CL-'+randomUUID().slice(0,12));break;
   case 'scenario':s=simulatePayment(createCase(body.scenario,'CL-'+randomUUID().slice(0,12)));break;
   case 'pay':if(s.paypalOrderId)throw Error('A PayPal sandbox checkout already exists. Restart before using sample checkout.');simulatePayment(s);break;
   case 'investigate':if(row.operator&&workflowReady())return enqueue(id,'investigate');s.review=null;s.phase='reviewing';store.save(id,s);await fresh(s,id);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{},fetcher));break;
   case 'change-evidence':changeSampleEvidence(s);break;
   case 'restore-evidence':restoreSampleEvidence(s);break;
   case 'rehearse':await fresh(s,id);rehearse(s);break;
   case 'approve':await fresh(s,id);approve(s,body.planId);break;
   case 'repair':if(!s.approval)throw Error('Merchant approval is required.');if(row.operator&&workflowReady())return enqueue(id,'recover');await fresh(s,id);applyRepair(s);store.grant(id,s);s=await verifyFresh(id);break;
   case 'verify':s=await verifyFresh(id);break;
   default:throw Error('Unknown action.');
  }store.save(id,s);if(body.action==='scenario')store.seedAccess(id,s);return {state:s}})}
 async function paypalCreate(id){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(s.capture)throw Error('This purchase already has a payment.');if(!s.paypalOrderId){s.paypalOrderId=await paypal.create(s);store.save(id,s)}return {id:s.paypalOrderId}})}
 async function paypalCapture(id,orderId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(!s.paypalOrderId||s.paypalOrderId!==orderId)throw Error('Sandbox order does not belong to this session.');if(!s.capture){s.capture=await paypal.capture(s);s.paidAt=new Date().toISOString();s.revision++;s.phase='paid';record(s,'PayPal sandbox capture saved; deliberate entitlement failure injected.');store.save(id,s)}return {state:s}})}
 async function caseInfo(id,caseId){return store.lock(id,async()=>{const s=store.get(id).state;if(s.id!==caseId)throw Error('The selected case changed. Reopen it from the queue.');if(!s.job?.pending)await readCaseSources(s,id,{paypal,access});store.save(id,s);return {state:s};});}
 return {caseInfo,action,stage,lesson,paypalCreate,paypalCapture,scan,draft:id=>customerDraft(store.get(id).state,{mode:'server-demo'}),receipt:id=>recoveryReceipt(store.get(id).state,{mode:'server-demo'})};
}
