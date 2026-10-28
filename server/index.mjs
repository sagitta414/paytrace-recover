import {permissionFor,requirePermission,masked,recoveryAnalytics} from './recovery-center.mjs';
import {prioritize} from './prioritization.mjs';
import {paypalClient} from './paypal.mjs';
import {receivePaypalWebhook} from './paypal-webhooks.mjs';
import {workspaceCsv} from '../dist/workspace-model.mjs';
import {originConfig} from './origins.mjs';
import {checkConnection} from './connection-check.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual} from 'node:crypto';import {openStore} from './store.mjs';import {createService} from './service.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createApp(env=process.env,store=openStore(env.DATABASE_PATH||'./data/courselatch.sqlite'),options={}){
 store.center.configure(env.AUDIT_HMAC_KEY);const paypal=options.paypal||paypalClient(env,options.fetcher||fetch);
 const service=createService(store,env,{...options,paypal,probe:async token=>{const address=server.address();if(!address||typeof address==='string')throw Error('Content service unavailable.');const r=await fetch(`http://127.0.0.1:${address.port}/api/learner/content`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Protected content could not be retrieved.');return r.json();}}),attempts=new Map();const originPolicy=originConfig(env),publicUrl=originPolicy.publicUrl;
 function equal(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
 const server=http.createServer(async(req,res)=>{let identity=null,audited=false,activeRoute='';const json=(status,value)=>{if(identity&&!audited){audited=true;store.center.audit(identity.owner,{actor:identity.actor,role:identity.role,action:req.method+' '+activeRoute+(identity.intent?':'+identity.intent:''),caseId:identity.caseId||null,outcome:status<400?'success':'denied',detail:status>=400?'Request rejected.':identity.auditDetail||''});}value=identity?masked(value,identity.role):value;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};try{
  const url=new URL(req.url,publicUrl);const route=url.pathname;activeRoute=route;
  if(route==='/api/webhooks/paypal'){if(req.method!=='POST')return json(405,{error:'POST required.'});if(!env.PAYPAL_WEBHOOK_ID)return json(503,{error:'PayPal webhook listener is not configured.'});if(String(req.headers['content-type']).split(';')[0]!=='application/json')return json(415,{error:'JSON required.'});let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>100000)return json(413,{error:'Webhook too large.'});chunks.push(c);}const raw=Buffer.concat(chunks).toString('utf8');let event;try{event=JSON.parse(raw);}catch{return json(400,{error:'Invalid webhook JSON.'});}return json(200,await receivePaypalWebhook({headers:req.headers,event,raw,store,paypal,service}));}

  if(route==='/health')return json(200,{ok:true});
  if(route==='/api/learner/content'){if(req.method!=='GET')return json(405,{error:'GET required.'});const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_learner='))?.slice(11);try{return json(200,store.readLearnerToken(token));}catch{return json(403,{error:'Learner authentication or course access is missing.'});}}
  if(route==='/runtime.js'){const config={backend:true,paypal:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),paypalClientId:env.PAYPAL_CLIENT_ID||'',ai:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),workflows:!!(env.RENDER_API_KEY&&env.WORKFLOW_SECRET&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK)};res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.COURSELATCH_RUNTIME='+JSON.stringify(config)+';')}
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
    if(route==='/api/customer/lesson'&&req.method==='GET')return json(200,store.support.lesson(identity.owner,identity.case_id));
    if(route==='/api/customer/message'&&req.method==='POST')return json(200,store.support.mutate(identity.owner,identity.case_id,body));
    return json(404,{error:'Endpoint not found.'});
   }
   if(route==='/api/team/logout'&&req.method==='POST'){res.setHeader('Set-Cookie','pt_team=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return json(200,{ok:true});}
   if(route==='/api/team/session'&&req.method==='POST'){const member=store.center.authenticate(body.token);res.setHeader('Set-Cookie','pt_team='+body.token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+Math.max(0,Math.floor((member.expires-Date.now())/1000))+(publicUrl.protocol==='https:'?'; Secure':''));store.center.audit(member.owner,{actor:member.id,role:member.role,action:'team.sign-in'});return json(200,{ok:true,role:member.role});}
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_session='))?.slice(11);let session=cookie?store.get(cookie):null;
   if(!session){const tt=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pt_team='))?.slice(8);if(tt){const t=store.center.authenticate(tt);session=store.get(t.owner);}}
   if(!session){if(req.method!=='GET'||route!=='/api/state')return json(401,{error:'Start a demo session first.'});session=store.create();res.setHeader('Set-Cookie',`cl_session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`)}
   const teamToken=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pt_team='))?.slice(8);let team=null;if(teamToken){team=store.center.authenticate(teamToken);session=store.get(team.owner);if(!session)return json(401,{error:'Workspace unavailable.'});}
   identity={owner:session.id,actor:team?.id||'workspace-owner',role:team?.role||'admin',intent:typeof body.action==='string'?body.action.slice(0,40):'',auditDetail:route==='/api/case/priority'&&['low','normal','high'].includes(body.priority)?'Priority set to '+body.priority:'',caseId:typeof body.caseId==='string'?body.caseId.slice(0,200):url.searchParams.get('caseId')?.slice(0,200)||null};

   requirePermission(identity.role,permissionFor(route,req.method,body));
   if(route==='/api/providers'&&req.method==='GET')return json(200,{paypal:{mode:'sandbox',configured:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),webhookConfigured:!!env.PAYPAL_WEBHOOK_ID},aiConfigured:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),emailConfigured:!!(env.RESEND_API_KEY&&env.EMAIL_FROM),rawCardStorage:false});
   if(route==='/api/identity')return json(200,{role:identity.role,actor:team?.label||'Demo workspace owner',operator:session.operator,productionAuthentication:false});
   if(route==='/api/analytics'&&req.method==='GET')return json(200,recoveryAnalytics((await service.operations(session.id)).cases,Object.fromEntries(url.searchParams)));
   if(route==='/api/notifications'&&req.method==='GET'){store.center.tick(session.id);return json(200,{items:store.center.notifications(session.id)});}
   if(route==='/api/notifications/read'&&req.method==='POST'){store.center.markRead(session.id,body.id);return json(200,{ok:true});}
   if(route==='/api/automation'&&req.method==='GET')return json(200,store.center.settings(session.id));
   if(route==='/api/automation'&&req.method==='POST')return json(200,store.center.setSettings(session.id,body));
   if(route==='/api/automation/run'&&req.method==='POST')return json(200,store.center.tick(session.id));
   if(route==='/api/audit'&&req.method==='GET')return json(200,store.center.auditLog(session.id,Object.fromEntries(url.searchParams)));
   if(route==='/api/history'&&req.method==='GET')return json(200,{items:store.center.timeline(session.id,url.searchParams.get('caseId'))});
   if(route==='/api/verification'&&req.method==='GET')return json(200,store.center.receipt(session.id,url.searchParams.get('caseId')));
   if(route==='/api/prioritization'){if(req.method==='POST')requirePermission(identity.role,'analyze');return json(200,await prioritize(store.listCases(session.id),{env,fetcher:options.fetcher||fetch,ai:req.method==='POST'}));}
   if(route==='/api/team'&&req.method==='GET')return json(200,{items:store.center.members(session.id)});
   if(route==='/api/team/invite'&&req.method==='POST'){if(!session.operator)return json(403,{error:'Unlock the owner operator session before inviting members.'});const invite=store.center.invite(session.id,body);store.center.audit(session.id,{actor:identity.actor,role:identity.role,action:'team.invite',detail:invite.id+' · '+invite.role});return json(200,{...invite,url:new URL('/recovery.html#team='+invite.token,publicUrl).href});}
   if(route==='/api/team/revoke'&&req.method==='POST'){store.center.revoke(session.id,body.id);store.center.audit(session.id,{actor:identity.actor,role:identity.role,action:'team.revoke',detail:body.id});return json(200,{ok:true});}
   if(route==='/api/paypal/reconcile'&&req.method==='POST'){if(!session.operator)return json(403,{error:'Unlock the operator session first.'});const result=await service.scan(session.id);return json(200,{checkedAt:result.checkedAt,cases:result.cases.length,notice:'Fresh reads only; no payment capture or access grant.'});}
   if(route==='/api/state'&&req.method==='GET')return json(200,{state:session.state,operator:session.operator});
   if(route==='/api/support/inbox'&&req.method==='GET')return json(200,{items:store.support.inbox(session.id)});
   if(route==='/api/support/reminders'&&req.method==='GET')return json(200,{items:store.support.reminders(session.id)});
   if(route==='/api/support'&&req.method==='GET')return json(200,store.support.view(session.id,url.searchParams.get('caseId'),true));
   if(route==='/api/case'&&req.method==='GET')return json(200,await service.caseInfo(session.id,url.searchParams.get('caseId')));
   if(route==='/api/operations'&&req.method==='GET')return json(200,await service.operations(session.id));
   if(route==='/api/workspace'&&req.method==='GET')return json(200,await service.overview(session.id));
   if(route==='/api/workspace/export'&&req.method==='GET'){const csv=workspaceCsv(await service.overview(session.id));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="paytrace-queue.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(csv);}
   if(route==='/api/case/priority'&&req.method==='GET')return json(200,store.casePriority(session.id,url.searchParams.get('caseId')));
   if(route==='/api/connection-check'&&req.method==='GET'){if(!session.operator)return json(403,{error:'Unlock the operator session before testing configured connections.'});return json(200,await checkConnection(url.searchParams.get('kind'),env));}
   const expectedCase=url.searchParams.get('caseId');if(['/api/draft','/api/receipt','/api/lesson'].includes(route)&&expectedCase&&expectedCase!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});
   if(route==='/api/draft'&&req.method==='GET')return json(200,service.draft(session.id));
   if(route==='/api/receipt'&&req.method==='GET')return json(200,service.receipt(session.id));
   if(route==='/api/lesson'&&req.method==='GET'){try{return json(200,service.lesson(session.id))}catch{return json(403,{error:'Course access is locked.'})}}
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
   if(route==='/api/case/priority')return json(200,store.setCasePriority(session.id,body.caseId,body.priority,body.expectedRevision));
   if(route==='/api/monitor/scan')return json(200,await service.scan(session.id,body));
   if(route==='/api/learner/session'){if(body.caseId!==undefined&&body.caseId!==session.state.id)return json(409,{error:'The selected case changed. Reopen it from the queue before continuing.'});if(session.state.currentAccountId&&session.state.currentAccountId!==session.state.order.userId)return json(403,{error:'Sign in with the purchasing account before opening a learner session.'});const token=store.mintLearnerToken(session.id,session.state.id);res.setHeader('Set-Cookie',`cl_learner=${token}; Path=/api/learner; HttpOnly; SameSite=Strict; Max-Age=600${publicUrl.protocol==='https:'?'; Secure':''}`);return json(200,{ok:true,mode:'Scoped demonstration learner session; not production sign-in'});}
   if(route==='/api/operator'){const entry=attempts.get(session.id)||{count:0,until:Date.now()+600000};if(Date.now()>entry.until){entry.count=0;entry.until=Date.now()+600000}entry.count++;attempts.set(session.id,entry);if(entry.count>5)return json(429,{error:'Too many attempts. Try later.'});if(!equal(body.key,env.DEMO_OPERATOR_KEY))return json(403,{error:'Operator key is not configured or does not match.'});store.authorize(session.id);return json(200,{ok:true})}
   if(route==='/api/action')return json(200,await service.action(session.id,body));
   if(route==='/api/paypal/create')return json(200,await service.paypalCreate(session.id,body.caseId));
   if(route==='/api/paypal/capture'){const result=await service.paypalCapture(session.id,body.orderId,body.caseId);await service.scan(session.id);return json(200,result);}
   return json(404,{error:'Endpoint not found.'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
  let pathname=decodeURIComponent(route);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(403,{error:'Forbidden.'});let bytes;try{bytes=await readFile(file)}catch{return json(404,{error:'Not found.'})}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){json([401,403,409].includes(e.status)?e.status:400,{error:e.message?.slice(0,250)||'Request failed.'})}});
 let monitorTimer,mailTimer,scanning=false,mailing=false;
 server.on('listening',()=>{mailTimer=setInterval(async()=>{if(mailing)return;mailing=true;try{await store.support.flush(env,publicUrl);}catch{}finally{mailing=false;}},5000);mailTimer.unref();});server.on('close',()=>clearInterval(mailTimer));
 server.on('listening',()=>{monitorTimer=setInterval(async()=>{if(scanning)return;scanning=true;try{for(const id of store.owners()){await service.scan(id).catch(()=>{});store.center.tick(id);}}finally{scanning=false;}},30000);monitorTimer.unref();});
 server.on('close',()=>clearInterval(monitorTimer));return {server,store,service};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(Number(process.env.PORT||4358),'0.0.0.0',()=>console.log('PayTrace Recover: '+(process.env.PUBLIC_URL||'http://127.0.0.1:4358')))}
