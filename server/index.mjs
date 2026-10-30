import {originConfig} from './origins.mjs';
import {checkConnection} from './connection-check.mjs';
import {paypalClient} from './paypal.mjs';
import {workspaceOverview,workspaceCsv} from '../dist/workspace-model.mjs';
import {recoveryAnalytics,requirePermission,permissionFor,masked} from './recovery-center.mjs';
import {prioritize} from './prioritization.mjs';
import {createBackup} from './backups.mjs';
import {identityProvider} from './authn.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual} from 'node:crypto';import {openStore} from './store.mjs';import {createService} from './service.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createApp(env=process.env,store=openStore(env.DATABASE_PATH||'./data/courselatch.sqlite'),options={}){
 const paypal=options.paypal||paypalClient(env,options.fetcher||fetch);
 const service=createService(store,env,{paypal,probe:async token=>{const address=server.address();if(!address||typeof address==='string')throw Error('Content service unavailable.');const r=await fetch(`http://127.0.0.1:${address.port}/api/learner/content`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Protected content could not be retrieved.');return r.json();}}),attempts=new Map();const originPolicy=originConfig(env),publicUrl=originPolicy.publicUrl;
 const auth=identityProvider({...env,PUBLIC_URL:publicUrl.href},store.accounts,{fetcher:options.fetcher||fetch,verifyToken:options.verifyToken});
 if(auth.required&&!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY))throw Error('Verified merchant mode requires a separate course-access connector.');
 store.center.configure(env.AUDIT_HMAC_KEY);
 function equal(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
 const server=http.createServer(async(req,res)=>{let teamRole=null;const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(teamRole&&status<400?masked(value,teamRole):value))};try{
  const url=new URL(req.url,publicUrl);const route=url.pathname;
  res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  if(publicUrl.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
  if(['/account.html','/recovery.html'].includes(route))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if(route==='/auth/config')return json(200,auth.config());
  if(route==='/auth/login'&&req.method==='GET'){
   if(!store.durable.allow('login:'+req.socket.remoteAddress,30))return json(429,{error:'Too many sign-in attempts. Wait a minute.'});
   const login=await auth.begin();res.setHeader('Set-Cookie',auth.cookie('pt_login',login.binding,600,'/auth'));
   res.writeHead(302,{Location:login.url,'Cache-Control':'no-store'});return res.end();
  }
  if(route==='/auth/callback'&&req.method==='GET'){
   if(!store.durable.allow('callback:'+req.socket.remoteAddress,60))return json(429,{error:'Too many sign-in responses. Wait a minute.'});
   const binding=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pt_login='))?.slice(9);
   try{const token=await auth.complete({state:url.searchParams.get('state'),code:url.searchParams.get('code'),binding});res.setHeader('Set-Cookie',[auth.cookie('pt_account',token,28800),auth.cookie('pt_login','',0,'/auth')]);res.writeHead(302,{Location:'/account.html','Cache-Control':'no-store'});return res.end();}
   catch{res.setHeader('Set-Cookie',auth.cookie('pt_login','',0,'/auth'));return json(403,{error:'Verified sign-in did not complete. Start again with a fresh MFA login.'});}
  }
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
  if(route==='/api/learner/content'){if(auth.required)return json(403,{error:'Use the private customer case link or course platform.'});if(req.method!=='GET')return json(405,{error:'GET required.'});const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_learner='))?.slice(11);try{return json(200,store.readLearnerToken(token));}catch{return json(403,{error:'Learner authentication or course access is missing.'});}}
  if(route==='/runtime.js'){const config={backend:true,authRequired:auth.required,paypal:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),paypalClientId:env.PAYPAL_CLIENT_ID||'',courseAccess:!!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY),ai:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),workflows:!!(env.RENDER_API_KEY&&env.WORKFLOW_SECRET&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK)};res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.COURSELATCH_RUNTIME='+JSON.stringify(config)+';')}
  if(route.startsWith('/api/')){
   if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed.'});
   const internal=route==='/api/internal/stage';
   if(internal&&!equal(req.headers.authorization,'Bearer '+env.WORKFLOW_SECRET))return json(401,{error:'Workflow authentication required.'});
   if(internal&&!env.WORKFLOW_SECRET)return json(401,{error:'Workflow authentication required.'});
   if(req.method==='POST'&&!internal&&!originPolicy.allows(req.headers.origin))return json(403,{error:'Same-origin request required.'});
   let body={};if(req.method==='POST'){if(String(req.headers['content-type']).split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'JSON required.'});const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000)return json(413,{error:'Request too large.'});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(400,{error:'Invalid JSON.'})}if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'A JSON object is required.'});}
   const accountToken=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pt_account='))?.slice(11);
   const account=accountToken?store.accounts.authenticate(accountToken):null;
   if(route==='/api/auth/session'&&req.method==='GET')return json(200,{account:account?{email:account.email,role:account.role,owner:account.owner,memberships:store.accounts.memberships(account.userId)}:null,...auth.config()});
   if(route==='/api/auth/logout'&&req.method==='POST'){if(accountToken)store.accounts.logout(accountToken);res.setHeader('Set-Cookie',auth.cookie('pt_account','',0));return json(200,{ok:true});}
   if(route==='/api/auth/accept'&&req.method==='POST'){if(!account)return json(401,{error:'Verified sign-in required.'});return json(200,store.accounts.accept(accountToken,body.token));}
   if(route==='/api/auth/workspace'&&req.method==='POST'){if(!account)return json(401,{error:'Verified sign-in required.'});store.accounts.select(accountToken,body.owner);return json(200,{ok:true});}
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
   if(route==='/api/team/session'&&req.method==='POST'){
    if(auth.required)return json(403,{error:'Team bearer links are disabled. Use verified merchant membership.'});
    const member=store.center.authenticate(body.token);
    res.setHeader('Set-Cookie',`pt_team=${body.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`);
    return json(200,{ok:true,role:member.role});
   }
   if(route==='/api/team/logout'&&req.method==='POST'){
    res.setHeader('Set-Cookie',`pt_team=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${publicUrl.protocol==='https:'?'; Secure':''}`);
    return json(200,{ok:true});
   }
   if(auth.required&&(!account||!account.owner||!account.role))return json(401,{error:'Verified merchant sign-in and workspace membership required.'});
   const teamToken=auth.required?null:req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pt_team='))?.slice(8);
   const member=teamToken?store.center.authenticate(teamToken):null;
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_session='))?.slice(11);
   let session=auth.required?store.get(account.owner):member?store.get(member.owner):cookie?store.get(cookie):null;
   if(!session){if(req.method!=='GET'||route!=='/api/state')return json(401,{error:'Start a demo session first.'});session=store.createPublicDemo(req.socket.remoteAddress);res.setHeader('Set-Cookie',`cl_session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`)}
   if(auth.required&&session.mode!=='verified')return json(403,{error:'Verified merchant workspace required.'});
   if(!auth.required&&session.mode==='verified')return json(403,{error:'Verified merchant sign-in required.'});
   if(member||auth.required){teamRole=auth.required?account.role:member.role;requirePermission(teamRole,permissionFor(route,req.method,body));session={...session,operator:session.operator&&['admin','manager'].includes(teamRole)};}
   if(route==='/api/state'&&req.method==='GET')return json(200,{state:session.state,operator:session.operator});
   if(route==='/api/identity'&&req.method==='GET')return json(200,{actor:account?.email||member?.label||'Demo workspace owner',role:account?.role||member?.role||'admin',operator:session.operator,productionAuthentication:auth.required});
   if(route==='/api/team'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view team access.'});return json(200,{items:auth.required?store.accounts.members(session.id):store.center.members(session.id)});}
   if(route==='/api/analytics'&&req.method==='GET')return json(200,recoveryAnalytics(store.listCases(session.id),Object.fromEntries(url.searchParams)));
   if(route==='/api/notifications'&&req.method==='GET'){store.center.tick(session.id);return json(200,{items:store.center.notifications(session.id)});}
   if(route==='/api/verification'&&req.method==='GET')return json(200,store.center.receipt(session.id,url.searchParams.get('caseId')));
   if(route==='/api/history'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view case history.'});return json(200,{items:store.center.timeline(session.id,url.searchParams.get('caseId'))});}
   if(route==='/api/prioritization'&&req.method==='GET')return json(200,await prioritize(store.listCases(session.id),{env,fetcher:options.fetcher||fetch}));
   if(route==='/api/automation'&&req.method==='GET')return json(200,store.center.settings(session.id));
   if(route==='/api/audit'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view audit records.'});return json(200,store.center.auditLog(session.id,Object.fromEntries(url.searchParams)));}
   if(route==='/api/providers'&&req.method==='GET')return json(200,{paypal:{configured:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),webhookConfigured:!!env.PAYPAL_WEBHOOK_ID}});
   if(route==='/api/operations/status'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view operations.'});const worker=store.durable.status('worker'),backup=store.durable.status('backup');return json(200,{database:store.databaseCheck(),worker:{running:!!worker&&Date.now()-Date.parse(worker.at)<150000,lastRun:worker?.at||null},backup,liveAcceptance:{verified:false,reason:'Connected acceptance has not been recorded.'},authentication:{configured:auth.configured,mfaRequired:auth.config().requireMfa},courseConnector:!!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY),audit:{keyed:!!env.AUDIT_HMAC_KEY,checkpoint:null},deployment:auth.required?'Verified merchant mode. Connected sandbox acceptance is still pending.':'Sandbox demonstration. Production identity and connected acceptance are pending.',jobs:store.durable.jobs().filter(job=>!job.owner||job.owner===session.id),events:store.durable.events()});}
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
   if(route==='/api/team/invite'){if(!session.operator)return json(403,{error:'Unlock the operator session to invite team members.'});const invite=auth.required?store.accounts.invite(session.id,{email:body.email||body.label,role:body.role,ttlHours:body.ttlHours}):store.center.invite(session.id,body);store.center.audit(session.id,{actor:account?.userId||member?.label||'owner',role:teamRole||'admin',action:'team.invite',detail:invite.role});return json(200,{...invite,url:new URL(auth.required?'/account.html#invite='+encodeURIComponent(invite.token):'/recovery.html#team='+encodeURIComponent(invite.token),publicUrl).href});}
   if(route==='/api/team/revoke'){if(!session.operator)return json(403,{error:'Unlock the operator session to revoke team access.'});if(auth.required)store.accounts.revoke(session.id,body.id);else store.center.revoke(session.id,body.id);store.center.audit(session.id,{actor:account?.userId||member?.label||'owner',role:teamRole||'admin',action:'team.revoke'});return json(200,{ok:true});}
   if(route==='/api/notifications/read'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage notifications.'});store.center.markRead(session.id,body.id);return json(200,{ok:true});}
   if(route==='/api/prioritization'){if(!session.operator)return json(403,{error:'Unlock the operator session before asking AI to rank cases.'});return json(200,await prioritize(store.listCases(session.id),{env,fetcher:options.fetcher||fetch,ai:true}));}
   if(route==='/api/automation'){if(!session.operator)return json(403,{error:'Unlock the operator session to change follow-up settings.'});return json(200,store.center.setSettings(session.id,body));}
   if(route==='/api/automation/run'){if(!session.operator)return json(403,{error:'Unlock the operator session to check follow-ups.'});return json(200,store.center.tick(session.id));}
   if(route==='/api/paypal/reconcile'){if(!session.operator)return json(403,{error:'Unlock the operator session to reconcile payment records.'});const result=await service.scan(session.id);return json(200,{checkedAt:result.checkedAt,cases:result.cases.length,notice:'Fresh reads only; no payment capture or access grant.'});}
   if(route==='/api/operations/run'){if(!session.operator)return json(403,{error:'Unlock the operator session to run maintenance.'});await cycle();return json(200,{ok:true});}
   if(route==='/api/operations/backup'){if(!session.operator)return json(403,{error:'Unlock the operator session to run a backup.'});if(!env.BACKUP_DIR||!env.BACKUP_ENCRYPTION_KEY)return json(400,{error:'Configure private encrypted backups on the server first.'});store.durable.queue({id:'backup-manual:'+Date.now(),kind:'backup'});return json(200,{queued:true});}
   if(route==='/api/operations/retry'){if(!session.operator)return json(403,{error:'Unlock the operator session to retry maintenance.'});const job=store.durable.job(body.id);if(!job||job.owner&&job.owner!==session.id)return json(403,{error:'Job is outside this workspace.'});store.durable.retry(body.id);return json(200,{ok:true});}
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
   if(route==='/api/case/priority'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage case priority.'});const result=store.setCasePriority(session.id,body.caseId,body.priority,body.expectedRevision);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'case.priority',caseId:body.caseId});return json(200,result);}
   if(route==='/api/monitor/scan'){const result=await service.scan(session.id,body);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result)}
   if(route==='/api/autopilot'){const policy=await service.setAutopilot(session.id,body);if(policy.enabled)setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,{policy,ready:service.autopilotReady()});}
   if(route==='/api/learner/session'){if(auth.required)return json(403,{error:'Use the private customer case link and course platform.'});if(body.caseId!==undefined&&body.caseId!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});if(session.state.currentAccountId&&session.state.currentAccountId!==session.state.order.userId)return json(403,{error:'Sign in with the purchasing account before opening a learner session.'});const token=store.mintLearnerToken(session.id,session.state.id);res.setHeader('Set-Cookie',`cl_learner=${token}; Path=/api/learner; HttpOnly; SameSite=Strict; Max-Age=600${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true,mode:'Scoped demonstration learner session; not production sign-in'});}
   if(route==='/api/operator'){if(auth.required)return json(403,{error:'Verified roles replace the demo operator key.'});const entry=attempts.get(session.id)||{count:0,until:Date.now()+600000};if(Date.now()>entry.until){entry.count=0;entry.until=Date.now()+600000}entry.count++;attempts.set(session.id,entry);if(entry.count>5)return json(429,{error:'Too many attempts. Try later.'});if(!equal(body.key,env.DEMO_OPERATOR_KEY))return json(403,{error:'Operator key is not configured or does not match.'});store.authorize(session.id);return json(200,{ok:true})}
   if(route==='/api/agent/question'){if(!session.operator)return json(403,{error:'Unlock the operator session before asking an AI specialist.'});return json(200,await service.agentQuestion(session.id,body));}
   if(route==='/api/action'){if(auth.required&&(['reset','scenario','pay','sample-age','change-evidence','restore-evidence'].includes(body.action)||body.action==='create-case'&&body.mode!=='sandbox'))return json(403,{error:'Sample mutations are disabled in verified merchant mode.'});const result=await service.action(session.id,body);store.center.audit(session.id,{actor:account?.userId||member?.label||'owner',role:teamRole||'admin',action:'case.'+String(body.action).slice(0,80),caseId:body.caseId||session.state.id});return json(200,result);}
   if(route==='/api/paypal/create'){const result=await service.paypalCreate(session.id,body.caseId);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'paypal.create',caseId:body.caseId||session.state.id});return json(200,result);}
   if(route==='/api/paypal/capture'){const result=await service.paypalCapture(session.id,body.orderId,body.caseId);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'paypal.capture',caseId:body.caseId||session.state.id});await service.scan(session.id);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result);}
   return json(404,{error:'Endpoint not found.'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
  let pathname=decodeURIComponent(route);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(403,{error:'Forbidden.'});let bytes;try{bytes=await readFile(file)}catch{return json(404,{error:'Not found.'})}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){json(e.status||400,{error:e.message?.slice(0,250)||'Request failed.'})}});
 let workerTimer,working=false,lastEnsure=0;
 async function cycle(){if(working)return;working=true;try{
  const d=store.durable;if(Date.now()-lastEnsure>30000){for(const owner of store.owners())d.queue({id:'scan:'+owner,owner,kind:'scan'});d.queue({id:'mail',kind:'mail'});if(env.BACKUP_DIR&&env.BACKUP_ENCRYPTION_KEY)d.queue({id:'backup',kind:'backup'});lastEnsure=Date.now();}
  for(let n=0;n<3;n++){const job=d.claimJob();if(!job)break;const heartbeat=setInterval(()=>{try{d.heartbeat(job.id,job.token)}catch{}},10000);heartbeat.unref();
   try{if(job.kind==='scan'||job.kind==='webhook-reconcile'){await service.scan(job.owner);await service.autoTriage(job.owner);store.center.tick(job.owner);d.finish(job,{repeatMs:job.kind==='scan'?30000:undefined});}
    else if(job.kind==='mail'){await store.support.flush(env,publicUrl);d.finish(job,{repeatMs:5000});}
    else if(job.kind==='backup'){await createBackup(store,env);d.finish(job,{repeatMs:job.id==='backup'?24*3600000:undefined});}
    else d.fail(job,'UNKNOWN_JOB');
   }catch{d.fail(job,job.kind==='scan'?'SCAN_FAILED':job.kind==='mail'?'MAIL_FAILED':'BACKUP_FAILED');}finally{clearInterval(heartbeat);}
  }
  d.setStatus('worker',{at:new Date().toISOString()});
 }finally{working=false;}}
 server.on('listening',()=>{workerTimer=setInterval(()=>cycle().catch(()=>{}),1000);workerTimer.unref();});
 server.on('close',()=>clearInterval(workerTimer));return {server,store,service,auth};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(Number(process.env.PORT||4358),'0.0.0.0',()=>console.log('PayTrace Recover: '+(process.env.PUBLIC_URL||'http://127.0.0.1:4358')))}
