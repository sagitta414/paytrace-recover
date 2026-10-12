import {randomUUID} from 'node:crypto';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify,canOpenLesson,record,fingerprint,attachAnalysis,changeSampleEvidence,restoreSampleEvidence} from '../dist/core.mjs';
import {analyze} from './ai.mjs';import {paypalClient} from './paypal.mjs';
export function createService(store,env=process.env,{fetcher=fetch,paypal=paypalClient(env,fetcher)}={}){
 const workflowReady=()=>!!(env.RENDER_API_KEY&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK&&env.WORKFLOW_SECRET);
 async function fresh(s){if(s.capture?.source==='paypal-sandbox')s.capture=await paypal.refresh(s)}
 function lesson(id){const session=store.get(id);if(!session||!canOpenLesson(session.state))throw Error('Course access is locked.');return {lesson:'See the light',courseId:session.state.order.courseId,userId:session.state.order.userId,accessible:true}}
 async function verifyFresh(id){const s=store.get(id).state;let available=true;try{await fresh(s)}catch{available=false}if(s.scenario==='read-error'&&s.reads===0)available=false;let access=false;try{access=lesson(id).accessible}catch{}verify(s,{paymentAvailable:available,lessonAvailable:access});store.save(id,s);return s}
 async function stage(id,step,jobId){return store.lock(id,async()=>{let row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;if(!jobId||s.job?.id!==jobId)throw Error('Workflow is obsolete.');if(!({investigate:['gather','analyze','record'],recover:['repair','verify']}[s.job.kind]||[]).includes(step))throw Error('Stage does not belong to this workflow.');try{
  if(step==='gather'){await fresh(s);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);return {fingerprint:fingerprint(s)}}
  if(step==='analyze'){s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{} ,fetcher));store.save(id,s);return {mode:s.analysis.mode}}
  if(step==='record'){s.job={...s.job,pending:false,error:null};record(s,'Investigation workflow completed. Merchant decision required.');store.save(id,s);return {phase:s.phase}}
  if(step==='repair'){await fresh(s);applyRepair(s);store.save(id,s);return {writes:s.writes}}
  if(step==='verify'){s=await verifyFresh(id);s.job={...s.job,pending:false};store.save(id,s);return {verified:s.phase==='verified',writes:s.writes}}
  throw Error('Unknown workflow stage.');
 }catch(e){if(jobId){s=store.get(id).state;s.job={...s.job,pending:false,error:e.message};store.save(id,s)}throw e}})}
 async function enqueue(id,kind){const row=store.get(id),s=row.state;const jobId=randomUUID();if(kind==='investigate'){s.review=null;s.analysis=null;s.rehearsal=null;s.approval=null;s.phase='reviewing'}s.job={id:jobId,kind,pending:true};store.save(id,s);try{const r=await fetcher('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:kind==='investigate'?env.RENDER_INVESTIGATE_TASK:env.RENDER_RECOVER_TASK,input:[id,jobId]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Render did not accept the workflow run.');const run=await r.json();const latest=store.get(id).state;latest.job={...latest.job,runId:run.id||null};store.save(id,latest);return {state:latest,job:true}}catch(e){const latest=store.get(id).state;latest.job={...latest.job,pending:false,error:e.message};store.save(id,latest);throw e}}
 async function action(id,body){return store.lock(id,async()=>{const row=store.get(id);if(!row)throw Error('Session not found.');let s=row.state;if(s.job?.pending)throw Error('A workflow is already running. Refresh shortly.');
  switch(body.action){
   case 'reset':s=createCase(s.scenario,'CL-'+randomUUID().slice(0,12));break;
   case 'scenario':s=simulatePayment(createCase(body.scenario,'CL-'+randomUUID().slice(0,12)));break;
   case 'pay':if(s.paypalOrderId)throw Error('A PayPal sandbox checkout already exists. Restart before using sample checkout.');simulatePayment(s);break;
   case 'investigate':if(row.operator&&workflowReady())return enqueue(id,'investigate');s.review=null;s.phase='reviewing';store.save(id,s);await fresh(s);investigate(s);s.review=null;s.phase='reviewing';store.save(id,s);attachAnalysis(s,await analyze(s,row.operator?env:{},fetcher));break;
   case 'change-evidence':changeSampleEvidence(s);break;
   case 'restore-evidence':restoreSampleEvidence(s);break;
   case 'rehearse':await fresh(s);rehearse(s);break;
   case 'approve':await fresh(s);approve(s,body.planId);break;
   case 'repair':if(!s.approval)throw Error('Merchant approval is required.');if(row.operator&&workflowReady())return enqueue(id,'recover');await fresh(s);applyRepair(s);store.save(id,s);s=await verifyFresh(id);break;
   case 'verify':s=await verifyFresh(id);break;
   default:throw Error('Unknown action.');
  }store.save(id,s);return {state:s}})}
 async function paypalCreate(id){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(s.capture)throw Error('This purchase already has a payment.');if(!s.paypalOrderId){s.paypalOrderId=await paypal.create(s);store.save(id,s)}return {id:s.paypalOrderId}})}
 async function paypalCapture(id,orderId){return store.lock(id,async()=>{const row=store.get(id);if(!row?.operator)throw Error('Unlock the operator session first.');const s=row.state;if(!s.paypalOrderId||s.paypalOrderId!==orderId)throw Error('Sandbox order does not belong to this session.');if(!s.capture){s.capture=await paypal.capture(s);s.revision++;s.phase='paid';record(s,'PayPal sandbox capture saved; deliberate entitlement failure injected.');store.save(id,s)}return {state:s}})}
 return {action,stage,lesson,paypalCreate,paypalCapture};
}
