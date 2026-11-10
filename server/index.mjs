import {originConfig} from './origins.mjs';
import {checkConnection} from './connection-check.mjs';
import {paypalClient} from './paypal.mjs';
import {workspaceOverview,workspaceCsv} from '../dist/workspace-model.mjs';
import {recoveryAnalytics,requirePermission,permissionFor,masked} from './recovery-center.mjs';
import {prioritize} from './prioritization.mjs';
import {createBackup} from './backups.mjs';
import {identityProvider} from './authn.mjs';
import {detectIncident,rehearseAutopilot,disputePacket} from '../dist/intelligence-lab.mjs';
import {incidentDetective} from '../dist/access-assurance.mjs';
import {analyzeIncident} from './incident-analysis.mjs';
import {demoStore} from './demo-store.mjs';
import {autonomyOverview} from './autonomy-overview.mjs';
import {mapStoreEvent,suggestMapping,validateMapping,checkMappedPayment} from './connector-studio.mjs';
import {preventionPatterns,replayMapping} from './prevention-studio.mjs';
import {fixWatch} from './fix-watch.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual,randomUUID} from 'node:crypto';import {openStore} from './store.mjs';import {createService} from './service.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createApp(env=process.env,store=openStore(env.DATABASE_PATH||'./data/courselatch.sqlite'),options={}){
 const paypal=options.paypal||paypalClient(env,options.fetcher||fetch);
 const service=createService(store,env,{fetcher:options.fetcher||fetch,paypal,course:options.course,probe:async token=>{const address=server.address();if(!address||typeof address==='string')throw Error('Content service unavailable.');const r=await fetch(`http://127.0.0.1:${address.port}/api/learner/content`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Protected content could not be retrieved.');return r.json();}}),storefront=demoStore(store,paypal,service),attempts=new Map();const originPolicy=originConfig(env),publicUrl=originPolicy.publicUrl;
 const auth=identityProvider({...env,PUBLIC_URL:publicUrl.href},store.accounts,{fetcher:options.fetcher||fetch,verifyToken:options.verifyToken});
 if(auth.required&&!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY))throw Error('Verified merchant mode requires a separate course-access connector.');
 store.center.configure(env.AUDIT_HMAC_KEY);
 function equal(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
 const server=http.createServer(async(req,res)=>{let teamRole=null;const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(teamRole&&status<400?masked(value,teamRole):value))};try{
  const url=new URL(req.url,publicUrl);const route=url.pathname;
  res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  if(publicUrl.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
  if(['/account.html','/recovery.html','/intelligence.html','/customer.html','/course.html','/connection-studio.html','/passport.html','/digital-orders.html'].includes(route))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if(['/focus.html','/store-demo.html'].includes(route))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://www.paypal.com https://www.paypalobjects.com; connect-src 'self' https://www.paypal.com https://www.sandbox.paypal.com; frame-src https://www.paypal.com https://www.sandbox.paypal.com; style-src 'self' 'unsafe-inline' https://www.paypalobjects.com; img-src 'self' data: https://www.paypal.com https://www.paypalobjects.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
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
  if(route==='/health'){try{const healthy=store.databaseCheck();return json(healthy?200:503,{ok:healthy})}catch{return json(503,{ok:false,error:'Database integrity check failed.'})}}
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
   const internal=route==='/api/internal/stage',trustedIntake=['/api/intake/intent','/api/intake/purchase','/api/intake/event'].includes(route);
   if(internal&&!equal(req.headers.authorization,'Bearer '+env.WORKFLOW_SECRET))return json(401,{error:'Workflow authentication required.'});
   if(internal&&!env.WORKFLOW_SECRET)return json(401,{error:'Workflow authentication required.'});
   if(req.method==='POST'&&!internal&&!trustedIntake&&!originPolicy.allows(req.headers.origin))return json(403,{error:'Same-origin request required.'});
   if(trustedIntake&&req.headers.origin)return json(403,{error:'Store intake is server-to-server only.'});
   let body={};if(req.method==='POST'){if(String(req.headers['content-type']).split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'JSON required.'});const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000)return json(413,{error:'Request too large.'});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(400,{error:'Invalid JSON.'})}if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'A JSON object is required.'});}
   const accountToken=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pt_account='))?.slice(11);
   const account=accountToken?store.accounts.authenticate(accountToken):null;
   if(route==='/api/auth/session'&&req.method==='GET')return json(200,{account:account?{email:account.email,role:account.role,owner:account.owner,memberships:store.accounts.memberships(account.userId)}:null,...auth.config()});
   if(route==='/api/auth/logout'&&req.method==='POST'){if(accountToken)store.accounts.logout(accountToken);res.setHeader('Set-Cookie',auth.cookie('pt_account','',0));return json(200,{ok:true});}
   if(route==='/api/auth/accept'&&req.method==='POST'){if(!account)return json(401,{error:'Verified sign-in required.'});return json(200,store.accounts.accept(accountToken,body.token));}
   if(route==='/api/auth/workspace'&&req.method==='POST'){if(!account)return json(401,{error:'Verified sign-in required.'});store.accounts.select(accountToken,body.owner);return json(200,{ok:true});}
   if(internal){if(req.method!=='POST')return json(405,{error:'POST required.'});const result=await service.stage(body.sessionId,body.stage,body.jobId);return json(200,result)}
   if(trustedIntake){if(req.method!=='POST')return json(405,{error:'POST required.'});const bearer=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null,owner=store.intakeOwner(bearer);if(!owner)return json(401,{error:'Trusted store authentication required.'});if(!store.durable.allow('trusted-intake:'+owner,20))return json(429,{error:'Store intake rate limit reached.'});if(route==='/api/intake/intent')return json(200,await service.registerPurchaseIntent(owner,body));let connectorRevision=null;const purchase=route==='/api/intake/event'?(()=>{const config=store.connectorMapping(owner);if(!config.active)throw Error('Activate the merchant mapping with a completed sandbox capture before sending store events.');connectorRevision=config.revision;return mapStoreEvent(body,config.mapping);})():body;const result=await service.intakePurchase(owner,purchase,{connectorRevision});return json(result.status==='created'?201:200,result);}
   if(route.startsWith('/api/customer/')){
    const key='customer:'+req.socket.remoteAddress,rate=attempts.get(key)||{count:0,until:Date.now()+60000};if(Date.now()>rate.until){rate.count=0;rate.until=Date.now()+60000;}rate.count++;attempts.set(key,rate);if(rate.count>120)return json(429,{error:'Please wait a minute before trying again.'});
    if(route==='/api/customer/request-link'&&req.method==='POST')return json(200,store.support.requestLink(body.reference,body.email));
    if(route==='/api/customer/session'&&req.method==='POST'){const token=store.support.exchange(body.token);res.setHeader('Set-Cookie',`pt_customer=${token}; Path=/api/customer; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true});}
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pt_customer='))?.slice(12);let identity;try{identity=store.support.authenticate(token);}catch{return json(401,{error:'Open your private link or request a new one to view this case.'});}
    const expected=body.caseId||url.searchParams.get('caseId');if(expected&&expected!==identity.case_id)return json(409,{error:'A different customer case is open in this browser. Reopen the private link for this case before continuing.'});
    if(route==='/api/customer/case'&&req.method==='GET')return json(200,store.support.view(identity.owner,identity.case_id));
    if(route==='/api/customer/lesson'&&req.method==='GET'){const lesson=await service.customerLesson(identity.owner,identity.case_id);return json(200,{...lesson,browserChallenge:store.support.issueBrowserChallenge(identity.owner,identity.case_id,lesson.body,token)});}
    if(route==='/api/customer/browser-proof'&&req.method==='POST')return json(200,store.support.acknowledgeBrowserLesson(identity.owner,identity.case_id,body.token,body.digest,token));
    if(route==='/api/customer/self-check'&&req.method==='POST'){
     if(!store.durable.allow('customer-self-check:'+identity.owner+':'+identity.case_id,3))return json(429,{error:'Please wait a minute before checking again.'});
     return json(200,await service.customerSelfCheck(identity.owner,identity.case_id));
    }
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
   if(route==='/api/state'&&req.method==='GET')return json(200,{state:session.state,operator:session.operator,...(url.searchParams.get('bootstrap')==='1'?{cases:store.listCases(session.id)}:{})});
   if(route==='/api/identity'&&req.method==='GET')return json(200,{actor:account?.email||member?.label||'Demo workspace owner',role:account?.role||member?.role||'admin',operator:session.operator,productionAuthentication:auth.required});
   if(route==='/api/course/demo-check'&&req.method==='POST'){
    if(auth.required)return json(403,{error:'Sandbox course lookup is unavailable in verified merchant mode.'});
    if(!store.durable.allow('course-check:'+session.id,12))return json(429,{error:'Too many course checks. Please try again shortly.'});
    return json(200,storefront.courseCheck(session.id,body));
   }
   if(route==='/api/course/demo-help'&&req.method==='POST'){
    if(auth.required)return json(403,{error:'Sandbox course help is unavailable in verified merchant mode.'});
    if(!store.durable.allow('course-help:'+session.id,5))return json(429,{error:'Too many support requests. Please try again shortly.'});
    return json(200,storefront.courseHelp(session.id,body));
   }
   if(route==='/api/intake/key'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Merchant operator access required.'});return json(200,store.intakeKeyStatus(session.id));}
   if(route==='/api/connector/mapping'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Merchant operator access required.'});return json(200,store.connectorMapping(session.id));}
   if(route.startsWith('/api/demo-store/')){if(auth.required)return json(403,{error:'The demo storefront is unavailable in verified merchant mode.'});if(!session.operator)return json(403,{error:'Unlock merchant controls to use the sandbox storefront.'});if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)return json(503,{error:'PayPal sandbox is not configured.'});
    if(route==='/api/demo-store/status'&&req.method==='GET')return json(200,storefront.status(session.id,url.searchParams.get('requestId')));
    if(req.method!=='POST')return json(405,{error:'POST required.'});if(!store.durable.allow('demo-store:'+session.id,20))return json(429,{error:'Sandbox storefront rate limit reached.'});
    if(route==='/api/demo-store/start')return json(200,await storefront.start(session.id,body));
    if(route==='/api/demo-store/complete')return json(200,await storefront.complete(session.id,body));
    return json(404,{error:'Unknown storefront action.'});}
   if(route==='/api/team'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view team access.'});return json(200,{items:auth.required?store.accounts.members(session.id):store.center.members(session.id)});}
   if(route==='/api/analytics'&&req.method==='GET')return json(200,recoveryAnalytics(store.listCases(session.id),Object.fromEntries(url.searchParams)));
   if(route==='/api/prevention'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock merchant controls to review prevention patterns.'});return json(200,preventionPatterns(store.listCases(session.id)));}
   if(route==='/api/prevention/fix-watch'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock merchant controls to review connector outcomes.'});return json(200,fixWatch(store.listCases(session.id),store.connectorMapping(session.id),{graceMinutes:store.grace(session.id)}));}
   if(route==='/api/notifications'&&req.method==='GET')return json(200,{items:store.center.notifications(session.id)});
   if(route==='/api/verification'&&req.method==='GET')return json(200,store.center.receipt(session.id,url.searchParams.get('caseId')));
   if(route==='/api/history'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view case history.'});return json(200,{items:store.center.timeline(session.id,url.searchParams.get('caseId'))});}
   if(route==='/api/prioritization'&&req.method==='GET')return json(200,await prioritize(store.listCases(session.id),{env,fetcher:options.fetcher||fetch}));
   if(route==='/api/automation'&&req.method==='GET')return json(200,store.center.settings(session.id));
   if(route==='/api/autonomy'&&req.method==='GET'){
    const saved=store.autopilot(session.id),simulate=url.searchParams.has('simulate');
    let policy=saved;
    if(simulate){
     const amount=Number(url.searchParams.get('maxAmountCents')),limit=Number(url.searchParams.get('dailyLimit'));
     if(!Number.isInteger(amount)||amount<1||amount>50000||!Number.isInteger(limit)||limit<1||limit>10)return json(400,{error:'Choose an amount from 1 to 50000 cents and a daily limit from 1 to 10.'});
     policy={...saved,enabled:url.searchParams.get('enabled')==='true',maxAmountCents:amount,dailyLimit:limit};
    }
    const worker=store.durable.status('worker'),backup=store.durable.status('backup');
    return json(200,{...autonomyOverview(store.listCases(session.id),policy,{ready:service.autopilotReady(),workflows:!!(env.RENDER_API_KEY&&env.WORKFLOW_SECRET&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK),backup,database:store.databaseCheck(),worker:!!worker&&Date.now()-Date.parse(worker.at)<150000}),simulated:simulate});
   }
   if(route==='/api/audit'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view audit records.'});return json(200,store.center.auditLog(session.id,Object.fromEntries(url.searchParams)));}
   if(route==='/api/providers'&&req.method==='GET')return json(200,{paypal:{configured:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),webhookConfigured:!!env.PAYPAL_WEBHOOK_ID}});
   if(route==='/api/operations/status'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to view operations.'});const worker=store.durable.status('worker'),backup=store.durable.status('backup');return json(200,{database:store.databaseCheck(),worker:{running:!!worker&&Date.now()-Date.parse(worker.at)<150000,lastRun:worker?.at||null},backup,liveAcceptance:{verified:false,reason:'Connected acceptance has not been recorded.'},authentication:{configured:auth.configured,mfaRequired:auth.config().requireMfa},courseConnector:!!(env.COURSE_ACCESS_URL&&env.COURSE_ACCESS_API_KEY),audit:{keyed:!!env.AUDIT_HMAC_KEY,checkpoint:null},deployment:auth.required?'Verified merchant mode. Connected sandbox acceptance is still pending.':'Sandbox demonstration. Production identity and connected acceptance are pending.',jobs:store.durable.jobs().filter(job=>!job.owner||job.owner===session.id),events:store.durable.events()});}
   if(route==='/api/support/inbox'&&req.method==='GET')return json(200,{items:store.support.inbox(session.id)});
   if(route==='/api/support/reminders'&&req.method==='GET')return json(200,{items:store.support.reminders(session.id)});
   if(route==='/api/support/outcomes'&&req.method==='GET')return json(200,{confirmedCaseIds:store.support.confirmedCaseIds(session.id)});
   if(route==='/api/support'&&req.method==='GET')return json(200,store.support.view(session.id,url.searchParams.get('caseId'),true));
   if(route==='/api/case'&&req.method==='GET')return json(200,{state:store.caseById(session.id,url.searchParams.get('caseId'))});
   if(route==='/api/operations'&&req.method==='GET')return json(200,{cases:store.listCases(session.id),graceMinutes:store.grace(session.id)});
   if(route==='/api/workspace'&&req.method==='GET')return json(200,workspaceOverview(store.listCases(session.id).filter(s=>url.searchParams.get('source')!=='sandbox'||s.intakeMode==='sandbox'||s.capture?.source==='paypal-sandbox'),{preferences:store.preferences(session.id),reminders:store.support.reminders(session.id),followups:store.support.inbox(session.id),promises:store.support.promises(session.id),graceMinutes:store.grace(session.id),backend:true}));
   if(route==='/api/workspace/export'&&req.method==='GET'){
    if(!session.operator)return json(403,{error:'Unlock the operator session before exporting the queue.'});
    const csv=workspaceCsv(workspaceOverview(store.listCases(session.id).filter(s=>url.searchParams.get('source')!=='sandbox'||s.intakeMode==='sandbox'||s.capture?.source==='paypal-sandbox'),{preferences:store.preferences(session.id),reminders:store.support.reminders(session.id),followups:store.support.inbox(session.id),promises:store.support.promises(session.id),graceMinutes:store.grace(session.id)}));
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="paytrace-queue.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(csv);
   }
   if(route==='/api/case/priority'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage case priority.'});return json(200,store.casePriority(session.id,url.searchParams.get('caseId')));}
   if(route==='/api/autopilot'&&req.method==='GET')return json(200,{policy:store.autopilot(session.id),ready:service.autopilotReady()});
   if(route==='/api/intelligence'&&req.method==='GET'){
    if(!session.operator)return json(403,{error:'Unlock the merchant session to inspect case intelligence.'});
    const policy=store.autopilot(session.id),max=Number(url.searchParams.get('maxAmountCents')||policy.maxAmountCents),limit=Number(url.searchParams.get('dailyLimit')||policy.dailyLimit);
    if(!Number.isInteger(max)||max<1||max>50000||!Number.isInteger(limit)||limit<1||limit>10)return json(400,{error:'Use a policy amount from 1 to 50000 cents and daily limit from 1 to 10.'});
    const cases=store.listCases(session.id),preview={...policy,maxAmountCents:max,dailyLimit:limit};
    return json(200,{incident:detectIncident(cases),policy:preview,rehearsal:rehearseAutopilot(cases,preview),caseOptions:cases.map(s=>({id:s.id,phase:s.phase,source:s.capture?.source==='paypal-sandbox'?'sandbox':'sample'}))});
   }
   if(route==='/api/intelligence/discover'&&req.method==='GET'){
    if(!session.operator)return json(403,{error:'Unlock the merchant session to scan PayPal reporting.'});
    return json(200,{state:'disabled',items:[],detail:'PayPal reporting discovery is paused while sandbox credentials are shared across workspaces. Use a merchant-bound checkout or trusted purchase intent instead.'});
   }
   if(route==='/api/intelligence/incident/probe'&&req.method==='POST'){
    if(!session.operator)return json(403,{error:'Unlock the merchant session to investigate an incident.'});
    const incident=detectIncident(store.listCases(session.id));
    if(!incident.active)return json(409,{error:'No current sandbox cluster qualifies for incident checks.'});
    if(!store.durable.allow('incident-probe:'+session.id,1))return json(429,{error:'Wait a minute before running another incident check.'});
    const results=await Promise.all(incident.caseIds.slice(0,5).map(async caseId=>{let state='unavailable';try{state=(await service.customerSelfCheck(session.id,caseId)).state;}catch{}return {caseId,state};}));
    const report=incidentDetective(incident,results);
    try{return json(200,await analyzeIncident(report,env,options.fetcher||fetch));}catch{return json(200,{...report,notice:'Model readout unavailable; fixed evidence checks remain visible.'});}
   }
   if(route==='/api/intelligence/packet'&&req.method==='GET'){
    if(!session.operator)return json(403,{error:'Unlock the merchant session to prepare a case packet.'});
    const id=url.searchParams.get('caseId');if(!id)return json(400,{error:'Choose a case first.'});
    const s=store.caseById(session.id,id),customer=store.support.view(session.id,id,true);
    return json(200,disputePacket(s,customer));
   }
   if(route==='/api/connection-check'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session before testing configured connections.'});return json(200,await checkConnection(url.searchParams.get('kind'),env));}
   const expectedCase=url.searchParams.get('caseId');if(['/api/draft','/api/receipt','/api/run-report','/api/passport','/api/lesson'].includes(route)&&expectedCase&&expectedCase!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});
   if(route==='/api/draft'&&req.method==='GET')return json(200,service.draft(session.id));
   if(route==='/api/receipt'&&req.method==='GET')return json(200,service.receipt(session.id));
   if(route==='/api/run-report'&&req.method==='GET')return json(200,service.runReport(session.id));
   if(route==='/api/passport'&&req.method==='GET')return json(200,store.support.passport(session.id,session.state.id,true));
   if(route==='/api/lesson'&&req.method==='GET'){try{return json(200,await service.lesson(session.id))}catch{return json(403,{error:'Course access is locked.'})}}
   if(req.method!=='POST')return json(405,{error:'POST required.'});
   if(route==='/api/intake/key'){if(!session.operator)return json(403,{error:'Merchant operator access required.'});const key=store.rotateIntakeKey(session.id);store.center.audit(session.id,{action:'store-intake.rotate-key',detail:'Previous store intake key revoked.'});return json(200,{key,notice:'Copy this key to the store server now. It is shown once and replaces the previous key.'});}
   if(route==='/api/prevention/replay'){if(!session.operator)return json(403,{error:'Unlock merchant controls to rehearse a mapping.'});return json(200,replayMapping(body.events,body.mapping,store.connectorMapping(session.id).mapping));}
   if(route.startsWith('/api/connector/')){
    if(!session.operator)return json(403,{error:'Unlock merchant controls to configure a store connector.'});
    if(route==='/api/connector/suggest'){if(!store.durable.allow('connector-ai:'+session.id,5))return json(429,{error:'Wait before requesting another mapping suggestion.'});return json(200,await suggestMapping(body.sample,env,options.fetcher||fetch));}
    if(route==='/api/connector/preview'){const purchase=mapStoreEvent(body.sample,body.mapping||store.connectorMapping(session.id).mapping);const payment=body.verifyPayPal?await checkMappedPayment(purchase,paypal,store.purchaseIntent(session.id,purchase.caseId)):{matched:false,reason:'Mapping valid. PayPal has not been checked; this is not payment proof.'};return json(200,{purchase,payment,accessChange:false,saved:false});}
    if(route==='/api/connector/mapping'){const mapping=validateMapping(body.mapping);mapStoreEvent(body.sample,mapping);const result=await store.lock(session.id,()=>store.saveConnectorMapping(session.id,mapping,body.expectedRevision));store.center.audit(session.id,{action:'store-connector.save-mapping',detail:'Draft field mapping saved; activation removed.'});return json(200,result);}
    if(route==='/api/connector/activate'){if(!store.durable.allow('connector-activate:'+session.id,5))return json(429,{error:'Wait before verifying another sandbox order.'});const config=store.connectorMapping(session.id);if(!config.mapping||config.revision!==body.expectedRevision)return json(409,{error:'The saved mapping changed. Reload it before activation.'});const purchase=mapStoreEvent(body.sample,config.mapping),payment=await checkMappedPayment(purchase,paypal,store.purchaseIntent(session.id,purchase.caseId));if(!payment.matched)return json(409,{error:payment.reason});const result=await store.lock(session.id,()=>store.activateConnectorMapping(session.id,body.expectedRevision));store.center.audit(session.id,{action:'store-connector.activate',detail:'Fresh completed sandbox capture matched mapped purchase. No case or access write.'});return json(200,{...result,purchase,payment});}
    return json(404,{error:'Unknown connector action.'});
   }
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
   if(route==='/api/support/update-mode'){if(!session.operator)return json(403,{error:'Unlock the operator session first.'});return json(200,store.support.setUpdateMode(session.id,body.caseId,body.mode));}
   if(route==='/api/case/priority'){if(!session.operator)return json(403,{error:'Unlock the operator session to manage case priority.'});const result=store.setCasePriority(session.id,body.caseId,body.priority,body.expectedRevision);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'case.priority',caseId:body.caseId});return json(200,result);}
   if(route==='/api/monitor/scan'){const result=await service.scan(session.id,body);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result)}
   if(route==='/api/autopilot'){const policy=await service.setAutopilot(session.id,body);if(policy.enabled)setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,{policy,ready:service.autopilotReady()});}
   if(route==='/api/learner/session'){if(auth.required)return json(403,{error:'Use the private customer case link and course platform.'});if(body.caseId!==undefined&&body.caseId!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});if(session.state.currentAccountId&&session.state.currentAccountId!==session.state.order.userId)return json(403,{error:'Sign in with the purchasing account before opening a learner session.'});const token=store.mintLearnerToken(session.id,session.state.id);res.setHeader('Set-Cookie',`cl_learner=${token}; Path=/api/learner; HttpOnly; SameSite=Strict; Max-Age=600${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true,mode:'Scoped demonstration learner session; not production sign-in'});}
   if(route==='/api/operator'){if(auth.required)return json(403,{error:'Verified roles replace the demo operator key.'});const entry=attempts.get(session.id)||{count:0,until:Date.now()+600000};if(Date.now()>entry.until){entry.count=0;entry.until=Date.now()+600000}entry.count++;attempts.set(session.id,entry);if(entry.count>5)return json(429,{error:'Too many attempts. Try later.'});if(!equal(body.key,env.DEMO_OPERATOR_KEY))return json(403,{error:'Operator key is not configured or does not match.'});store.authorize(session.id);return json(200,{ok:true})}
   if(route==='/api/agent/question'){if(!session.operator)return json(403,{error:'Unlock the operator session before asking an AI specialist.'});return json(200,await service.agentQuestion(session.id,body));}
   if(route==='/api/action'){if(auth.required&&(['reset','scenario','pay','sample-age','change-evidence','restore-evidence'].includes(body.action)||body.action==='create-case'&&body.mode!=='sandbox'))return json(403,{error:'Sample mutations are disabled in verified merchant mode.'});const result=await service.action(session.id,body);store.center.audit(session.id,{actor:account?.userId||member?.label||'owner',role:teamRole||'admin',action:'case.'+String(body.action).slice(0,80),caseId:body.caseId||session.state.id});return json(200,result);}
   if(route==='/api/case/refresh')return json(200,await service.caseInfo(session.id,body.caseId));
   if(route==='/api/paypal/create'){const result=await service.paypalCreate(session.id,body.caseId);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'paypal.create',caseId:body.caseId||session.state.id});return json(200,result);}
   if(route==='/api/paypal/capture'){const result=await service.paypalCapture(session.id,body.orderId,body.caseId);store.center.audit(session.id,{actor:member?.label||'owner',role:member?.role||'admin',action:'paypal.capture',caseId:body.caseId||session.state.id});await service.scan(session.id);setImmediate(()=>service.autoTriage(session.id).catch(()=>{}));return json(200,result);}
   return json(404,{error:'Endpoint not found.'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
  let pathname=decodeURIComponent(route);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(403,{error:'Forbidden.'});let bytes;try{bytes=await readFile(file)}catch{return json(404,{error:'Not found.'})}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){
  if(/database disk image is malformed|SQLITE_CORRUPT|SQLITE_NOTADB|database is locked/i.test(String(e.code||'')+' '+String(e.message||''))){
   const reference='PT-'+randomUUID().slice(0,8).toUpperCase();
   console.error('Database request failed',reference);
   return json(503,{error:`Case records are temporarily unavailable. Refresh safely or contact support with reference ${reference}.`});
  }
  json(e.status||400,{error:e.message?.slice(0,250)||'Request failed.'});
 }});
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
