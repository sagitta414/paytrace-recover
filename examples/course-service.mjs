// Reference course platform for local integration testing. Run separately from PayTrace.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {timingSafeEqual} from 'node:crypto';

export function createCourseService({key,file='./data/reference-course.sqlite'}={}) {
  if (!key || key.length < 16) throw Error('Set COURSE_SERVICE_KEY to a private value of at least 16 characters.');
  if (file !== ':memory:') mkdirSync(dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS grants (
    case_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
    capture_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE
  )`);
  const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
  const response=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  const server=http.createServer(async(req,res)=>{
    if(!equal(req.headers.authorization,`Bearer ${key}`))return response(res,401,{error:'Course service authentication required.'});
    if(req.method!=='POST')return response(res,405,{error:'POST required.'});
    if(String(req.headers['content-type']).split(';')[0].trim().toLowerCase()!=='application/json')return response(res,415,{error:'JSON required.'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)return response(res,413,{error:'Request too large.'});}
    let body;try{body=JSON.parse(raw)}catch{return response(res,400,{error:'Invalid JSON.'});}
    const path=new URL(req.url,'http://localhost').pathname;
    if(!body||typeof body!=='object'||Array.isArray(body)||!['caseId','userId','courseId'].every(name=>typeof body[name]==='string'&&body[name].length>0&&body[name].length<=128)||(path!=='/v1/access/check'&&!(typeof body.captureId==='string'&&body.captureId.length>0&&body.captureId.length<=128)))return response(res,400,{error:'A complete purchase identity is required.'});
    const row=db.prepare('SELECT * FROM grants WHERE case_id=?').get(body.caseId);
    const identity={userId:body.userId,courseId:body.courseId,captureId:body.captureId};
    if(row&&(row.user_id!==identity.userId||row.course_id!==identity.courseId||row.capture_id!==identity.captureId))return response(res,409,{error:'Case already belongs to a different purchase.'});
    if(path==='/v1/access/check')return response(res,200,{userId:identity.userId,courseId:identity.courseId,active:!!row,captureId:row?.capture_id||null});
    if(path==='/v1/access/grants'){
      const expected=`paytrace:${body.caseId}:${body.captureId}`;
      if(req.headers['idempotency-key']!==expected)return response(res,400,{error:'Stable grant idempotency key required.'});
      if(!row)db.prepare('INSERT INTO grants VALUES (?,?,?,?,?)').run(body.caseId,identity.userId,identity.courseId,identity.captureId,expected);
      return response(res,200,{...identity,active:true});
    }
    if(path==='/v1/access/lesson-probe'){
      if(!row)return response(res,403,{error:'This learner does not have course access.'});
      return response(res,200,{...identity,accessible:true,contentId:'light-lesson-01',body:'Find a window with soft, indirect daylight. Place an everyday object beside it. Make three frames: facing the light, beside it, and against it.'});
    }
    return response(res,404,{error:'Endpoint not found.'});
  });
  return {server,close:()=>{db.close();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {server}=createCourseService({key:process.env.COURSE_SERVICE_KEY,file:process.env.COURSE_SERVICE_DATABASE||'./data/reference-course.sqlite'});
  const port=Number(process.env.PORT||process.env.COURSE_SERVICE_PORT||4360);
  const host=process.env.COURSE_SERVICE_HOST||'127.0.0.1';
  server.listen(port,host,()=>console.log(`Reference course service listening on ${host}:${port}`));
}
