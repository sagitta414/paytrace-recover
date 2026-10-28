import {originConfig} from './origins.mjs';
import {checkConnection} from './connection-check.mjs';
import {paypalClient} from './paypal.mjs';
import {workspaceOverview,workspaceCsv} from '../dist/workspace-model.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual} from 'node:crypto';import {openStore} from './store.mjs';import {createService} from './service.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createApp(env=process.env,store=openStore(env.DATABASE_PATH||'./data/courselatch.sqlite'),options={}){
 const paypal=options.paypal||paypalClient(env,options.fetcher||fetch);
 const service=createService(store,env,{paypal,probe:async token=>{const address=server.address();if(!address||typeof address==='string')throw Error('Content service unavailable.');const r=await fetch(`http://127.0.0.1:${address.port}/api/learner/content`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Protected content could not be retrieved.');return r.json();}}),attempts=new Map();const originPolicy=originConfig(env),publicUrl=originPolicy.publicUrl;
 function equal(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
 const server=http.createServer(async(req,res)=>{const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};try{
  const url=new URL(req.url,publicUrl);const route=url.pathname;
  if(route==='/health')return json(200,{ok:true});
  if(route==='/api/paypal/webhook'){
   if(req.method!=='POST')return json(405,{error:'POST required.'});
   if(!env.PAYPAL_WEBHOOK_ID||!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)return json(503,{error:'PayPal sandbox webhook is not configured.'});
   if(String(req.headers['content-type']).split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'JSON required.'});
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)return json(413,{error:'Webhook event is too large.'});chunks.push(chunk);}
   const raw=Buffer.concat(chunks).toString('utf8');let event;try{event=JSON.parse(raw)}catch{return json(400,{error:'Invalid webhook JSON.'})}
   if(!event||typeof event!=='object'||Array.isArray(event))return json(400,{error:'A webhook event object is required.'});
   let verified;try{verified=await paypal.verifyWebhook(raw,req.headers)}catch{return json(503,{error:'PayPal signature check is unavailable. Retry delivery.'})}
   if(!verified)return json(401,{error:'PayPal signature verification failed.'});
   try{return json(200,await service.paypalWebhook(event))}catch{return json(503,{error:'Webhook processing could not be confirmed. Retry delivery.'})}
  }
  if(route==='/api/learner/content'){if(req.method!=='GET')return json(405,{error:'GET required.'});const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_learner='))?.slice(11);try{return json(200,store.readLearnerToken(token));}catch{return json(403,{error:'Learner authentication or course access is missing.'});}}
  if(route==='/runtime.js'){const config={backend:true,paypal:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),paypalClientId:env.PAYPAL_CLIENT_ID||'',courseAccess:!!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY),ai:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),workflows:!!(env.RENDER_API_KEY&&env.WORKFLOW_SECRET&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK)};res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.COURSELATCH_RUNTIME='+JSON.stringify(config)+';')}
  if(route.startsWith('/api/')){
   if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed.'});
   const internal=route==='/api/internal/stage';
   if(internal&&!equal(req.headers.authorization,'Bearer '+env.WORKFLOW_SECRET))return json(401,{error:'Workflow authentication required.'});
   if(internal&&!env.WORKFLOW_SECRET)return json(401,{error:'Workflow authentication required.'});
   if(req.method==='POST'&&!internal&&!originPolicy.allows(req.headers.origin))return json(403,{error:'Same-origin request required.'});
   let body={};if(req.method==='POST'){if(String(req.headers['content-type']).split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'JSON required.'});const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000)return json(413,{error:'Request too large.'});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(400,{error:'Invalid JSON.'})}if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'A JSON object is required.'});}
   if(internal){if(req.method!=='POST')return json(405,{error:'POST required.'});const result=await service.stage(body.sessionId,body.stage,body.jobId);return json(200,result)}
   if(route.startsWith('/api/customer/')){
    const key='customer:'+req.socket.remoteAddress,rate=attempts.get(key)||{count:0,until:Date.now()+60000};if(Date.now()>rate.until){rate.count=0;rate.until=Date.now()+60000;}rate.count++;attempts.set(key,rate);if(rate.count>120)return json(429,{error:'Please wait a minute before trying again.'});
    if(route==='/api/customer/request-link'&&req.method==='POST')return json(200,store.support.requestLink(body.reference,body.email));
    if(route==='/api/customer/session'&&req.method==='POST'){const token=store.support.exchange(body.token);res.setHeader('Set-Cookie',`pt_customer=${token}; Path=/api/customer; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true});}
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pt_customer='))?.slice(12);let identity;try{identity=store.support.authenticate(token);}catch{return json(401,{error:'Open your private link or request a new one to view this case.'});}
    const expected=body.caseId||url.searchParams.get('caseId');if(expected&&expected!==identity.case_id)return json(409,{error:'A different customer case is open in this browser. Reopen the private link for this case before continuing.'});
    if(route==='/api/customer/case'&&req.method==='GET')return json(200,store.support.view(identity.owner,identity.case_id));
    if(route==='/api/customer/lesson'&&req.method==='GET')return json(200,await service.customerLesson(identity.owner,identity.case_id));
    if(route==='/api/customer/message'&&req.method==='POST')return json(200,store.support.mutate(identity.owner,identity.case_id,body));
    return json(404,{error:'Endpoint not found.'});
   }
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_session='))?.slice(11);let session=cookie?store.get(cookie):null;
   if(!session){if(req.method!=='GET'||route!=='/api/state')return json(401,{error:'Start a demo session first.'});session=store.createPublicDemo(req.socket.remoteAddress);res.setHeader('Set-Cookie',`cl_session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`)}
   if(route==='/api/state'&&req.method==='GET')return json(200,{state:session.state,operator:session.operator});
   if(route==='/api/support/inbox'&&req.method==='GET')return json(200,{items:store.support.inbox(session.id)});
   if(route==='/api/support/reminders'&&req.method==='GET')return json(200,{items:store.support.reminders(session.id)});
   if(route==='/api/support/outcomes'&&req.method==='GET')return json(200,{confirmedCaseIds:store.support.confirmedCaseIds(session.id)});
   if(route==='/api/support'&&req.method==='GET')return json(200,store.support.view(session.id,url.searchParams.get('caseId'),true));
   if(route==='/api/case'&&req.method==='GET')return json(200,await service.caseInfo(session.id,url.searchParams.get('caseId')));
   if(route==='/api/operations'&&req.method==='GET')return json(200,{cases:store.listCases(session.id),graceMinutes:store.grace(session.id)});
   if(route==='/api/workspace'&&req.method==='GET')return json(200,workspaceOverview(store.listCases(session.id),{preferences:store.preferences(session.id),reminders:store.support.reminders(session.id),followups:store.support.inbox(session.id),graceMinutes:store.grace(session.id)}));
   if(route==='/api/workspace/export'&&req.method==='GET'){
    if(!session.operator)return json(403,{error:'Unlock the operator session before exporting the queue.'});
    const csv=workspaceCsv(workspaceOverview(store.listCases(session.id),{preferences:store.preferences(session.id),reminders:store.support.reminders(session.id),followups:store.support.inbox(session.id),graceMinutes:store.grace(session.id)}));
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="paytrace-queue.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(csv);
   }
   if(route==='/api/case/priority'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage case priority.'});return json(200,store.casePriority(session.id,url.searchParams.get('caseId')));}
   if(route==='/api/autopilot'&&req.method==='GET')return json(200,{policy:store.autopilot(session.id),ready:service.autopilotReady()});
   if(route==='/api/connection-check'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session before testing configured connections.'});return json(200,await checkConnection(url.searchParams.get('kind'),env));}
   const expectedCase=url.searchParams.get('caseId');if(['/api/draft','/api/receipt','/api/run-report','/api/lesson'].includes(route)&&expectedCase&&expectedCase!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});
   if(route==='/api/draft'&&req.method==='GET')return json(200,service.draft(session.id));
   if(route==='/api/receipt'&&req.method==='GET')return json(200,service.receipt(session.id));
   if(route==='/api/run-report'&&req.method==='GET')return json(200,service.runReport(session.id));
   if(route==='/api/lesson'&&req.method==='GET'){try{return json(200,await service.lesson(session.id))}catch{return json(403,{error:'Course access is locked.'})}}
   if(req.method!=='POST')return json(405,{error:'POST required.'});
   if(route==='/api/support'){
    if(!session.operator)return json(403,{error:'Unlock the operator session in the checkout & setup desk first.'});
    const id=body.caseId;store.caseById(session.id,id);
    if(body.action==='contact'){store.support.contact(session.id,id,body.email);return json(200,store.support.view(session.id,id,true));}
    if(body.action==='link'){const token=store.support.mint(session.id,id);return json(200,{url:new URL('/customer.html#'+token,publicUrl).href});}
    if(body.action==='revoke'){store.support.revoke(session.id,id);return json(200,{ok:true});}
    if(body.action==='invite'){const s=store.caseById(session.id,id);const v=store.support.view(session.id,id,true);return json(200,store.support.requestLink(s.order.id,v.email));}
    return json(200,store.support.mutate(session.id,id,body,true));
   }
   if(route==='/api/support/reminder'){if(!session.operator)return json(403,{error:'Unlock the operator session first.'});return json(200,{reminder:store.support.reminder(session.id,body.caseId,body.dueAt,body.note)});}
   if(route==='/api/support/update-promise'){if(!session.operator)return json(403,{error:'Unlock the operator session first.'});return json(200,{nextUpdateAt:store.support.updatePromise(session.id,body.caseId,body.dueAt)});}
   if(route==='/api/case/priority'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage case priority.'});return json(200,store.setCasePriority(session.id,body.caseId,body.priority,body.expectedRevision));}
   if(route==='/api/monitor/scan'){const result=await service.scan(session.id,body);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result)}
   if(route==='/api/autopilot'){const policy=await service.setAutopilot(session.id,body);if(policy.enabled)setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,{policy,ready:service.autopilotReady()});}
   if(route==='/api/learner/session'){if(body.caseId!==undefined&&body.caseId!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});if(session.state.currentAccountId&&session.state.currentAccountId!==session.state.order.userId)return json(403,{error:'Sign in with the purchasing account before opening a learner session.'});const token=store.mintLearnerToken(session.id,session.state.id);res.setHeader('Set-Cookie',`cl_learner=${token}; Path=/api/learner; HttpOnly; SameSite=Strict; Max-Age=600${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true,mode:'Scoped demonstration learner session; not production sign-in'});}
   if(route==='/api/operator'){const entry=attempts.get(session.id)||{count:0,until:Date.now()+600000};if(Date.now()>entry.until){entry.count=0;entry.until=Date.now()+600000}entry.count++;attempts.set(session.id,entry);if(entry.count>5)return json(429,{error:'Too many attempts. Try later.'});if(!equal(body.key,env.DEMO_OPERATOR_KEY))return json(403,{error:'Operator key is not configured or does not match.'});store.authorize(session.id);return json(200,{ok:true})}
   if(route==='/api/agent/question'){if(!session.operator)return json(403,{error:'Unlock the operator session before asking an AI specialist.'});return json(200,await service.agentQuestion(session.id,body));}
   if(route==='/api/action')return json(200,await service.action(session.id,body));
   if(route==='/api/paypal/create')return json(200,await service.paypalCreate(session.id,body.caseId));
   if(route==='/api/paypal/capture'){const result=await service.paypalCapture(session.id,body.orderId,body.caseId);await service.scan(session.id);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result);}
   return json(404,{error:'Endpoint not found.'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
  let pathname=decodeURIComponent(route);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(403,{error:'Forbidden.'});let bytes;try{bytes=await readFile(file)}catch{return json(404,{error:'Not found.'})}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){json(e.status||400,{error:e.message?.slice(0,250)||'Request failed.'})}});
 let workerTimer,working=false,lastEnsure=0;
 async function cycle(){if(working)return;working=true;try{
  const d=store.durable;if(Date.now()-lastEnsure>30000){for(const owner of store.owners())d.queue({id:'scan:'+owner,owner,kind:'scan'});d.queue({id:'mail',kind:'mail'});lastEnsure=Date.now();}
  for(let n=0;n<3;n++){const job=d.claimJob();if(!job)break;const heartbeat=setInterval(()=>{try{d.heartbeat(job.id,job.token)}catch{}},10000);heartbeat.unref();
   try{if(job.kind==='scan'||job.kind==='webhook-reconcile'){await service.scan(job.owner);await service.autoTriage(job.owner);d.finish(job,{repeatMs:job.kind==='scan'?30000:undefined});}
    else if(job.kind==='mail'){await store.support.flush(env,publicUrl);d.finish(job,{repeatMs:5000});}
    else d.fail(job,'UNKNOWN_JOB');
   }catch{d.fail(job,job.kind==='scan'?'SCAN_FAILED':'MAIL_FAILED');}finally{clearInterval(heartbeat);}
  }
 }finally{working=false;}}
 server.on('listening',()=>{workerTimer=setInterval(()=>cycle().catch(()=>{}),1000);workerTimer.unref();});
 server.on('close',()=>clearInterval(workerTimer));return {server,store,service};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(Number(process.env.PORT||4358),'0.0.0.0',()=>console.log('PayTrace Recover: '+(process.env.PUBLIC_URL||'http://127.0.0.1:4358')))}
