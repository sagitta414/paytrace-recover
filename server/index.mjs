import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual} from 'node:crypto';import {openStore} from './store.mjs';import {createService} from './service.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createApp(env=process.env,store=openStore(env.DATABASE_PATH||'./data/courselatch.sqlite')){
 const service=createService(store,env),attempts=new Map();const publicUrl=new URL(env.PUBLIC_URL||'http://127.0.0.1:'+(env.PORT||4358));
 function equal(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
 const server=http.createServer(async(req,res)=>{const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};try{
  const url=new URL(req.url,publicUrl);const route=url.pathname;
  if(route==='/health')return json(200,{ok:true});
  if(route==='/runtime.js'){const config={backend:true,paypal:!!(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET),paypalClientId:env.PAYPAL_CLIENT_ID||'',ai:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),workflows:!!(env.RENDER_API_KEY&&env.WORKFLOW_SECRET&&env.RENDER_INVESTIGATE_TASK&&env.RENDER_RECOVER_TASK)};res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.COURSELATCH_RUNTIME='+JSON.stringify(config)+';')}
  if(route.startsWith('/api/')){
   if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed.'});
   const internal=route==='/api/internal/stage';
   if(internal&&!equal(req.headers.authorization,'Bearer '+env.WORKFLOW_SECRET))return json(401,{error:'Workflow authentication required.'});
   if(internal&&!env.WORKFLOW_SECRET)return json(401,{error:'Workflow authentication required.'});
   if(req.method==='POST'&&!internal&&req.headers.origin!==publicUrl.origin)return json(403,{error:'Same-origin request required.'});
   let body={};if(req.method==='POST'){if(!String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'JSON required.'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return json(413,{error:'Request too large.'})}try{body=JSON.parse(raw)}catch{return json(400,{error:'Invalid JSON.'})}}
   if(internal){if(req.method!=='POST')return json(405,{error:'POST required.'});const result=await service.stage(body.sessionId,body.stage,body.jobId);return json(200,result)}
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cl_session='))?.slice(11);let session=cookie?store.get(cookie):null;
   if(!session){if(req.method!=='GET'||route!=='/api/state')return json(401,{error:'Start a demo session first.'});session=store.create();res.setHeader('Set-Cookie',`cl_session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${publicUrl.protocol==='https:'?'; Secure':''}`)}
   if(route==='/api/state'&&req.method==='GET')return json(200,{state:session.state,operator:session.operator});
   if(route==='/api/lesson'&&req.method==='GET'){try{return json(200,service.lesson(session.id))}catch{return json(403,{error:'Course access is locked.'})}}
   if(req.method!=='POST')return json(405,{error:'POST required.'});
   if(route==='/api/operator'){const entry=attempts.get(session.id)||{count:0,until:Date.now()+600000};if(Date.now()>entry.until){entry.count=0;entry.until=Date.now()+600000}entry.count++;attempts.set(session.id,entry);if(entry.count>5)return json(429,{error:'Too many attempts. Try later.'});if(!equal(body.key,env.DEMO_OPERATOR_KEY))return json(403,{error:'Operator key is not configured or does not match.'});store.authorize(session.id);return json(200,{ok:true})}
   if(route==='/api/action')return json(200,await service.action(session.id,body));
   if(route==='/api/paypal/create')return json(200,await service.paypalCreate(session.id));
   if(route==='/api/paypal/capture')return json(200,await service.paypalCapture(session.id,body.orderId));
   return json(404,{error:'Endpoint not found.'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
  let pathname=decodeURIComponent(route);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(403,{error:'Forbidden.'});let bytes;try{bytes=await readFile(file)}catch{return json(404,{error:'Not found.'})}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){json(400,{error:e.message?.slice(0,250)||'Request failed.'})}});return {server,store};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(Number(process.env.PORT||4358),'0.0.0.0',()=>console.log('PayTrace Recover: '+(process.env.PUBLIC_URL||'http://127.0.0.1:4358')))}
