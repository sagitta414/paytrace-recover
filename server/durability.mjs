import {randomUUID,createHash} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
export function durability(db,{clock=Date.now}={}){
 db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS runtime_leases(name TEXT PRIMARY KEY,token TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS durable_jobs(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,payload TEXT,state TEXT,due INTEGER,attempts INTEGER DEFAULT 0,max_attempts INTEGER DEFAULT 5,token TEXT,expires INTEGER,last_error TEXT,updated INTEGER);
 CREATE TABLE IF NOT EXISTS access_intents(owner TEXT,case_id TEXT,value TEXT NOT NULL,PRIMARY KEY(owner,case_id));
 CREATE TABLE IF NOT EXISTS ops_events(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,kind TEXT,level TEXT,detail TEXT);
 CREATE TABLE IF NOT EXISTS request_limits(key TEXT,bucket INTEGER,count INTEGER,PRIMARY KEY(key,bucket));
 CREATE TABLE IF NOT EXISTS ops_status(name TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 const context=new AsyncLocalStorage();
 function claimLease(name,ttl=30000){const token=randomUUID(),at=clock();const result=db.prepare('INSERT INTO runtime_leases VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE runtime_leases.expires<=?').run(name,token,at+ttl,at);return result.changes?token:null;}
 const renew=(name,token,ttl=30000)=>!!db.prepare('UPDATE runtime_leases SET expires=? WHERE name=? AND token=? AND expires>?').run(clock()+ttl,name,token,clock()).changes;
 const release=(name,token)=>db.prepare('DELETE FROM runtime_leases WHERE name=? AND token=?').run(name,token);
 function guard(name){const c=context.getStore();if(c?.name===name&&!db.prepare('SELECT 1 FROM runtime_leases WHERE name=? AND token=? AND expires>?').get(name,c.token,clock())){const e=Error('Workspace lease expired. Refresh before retrying.');e.status=409;throw e;}}
 async function locked(name,fn){const deadline=clock()+20000;let token;while(!(token=claimLease(name))){if(clock()>=deadline){const e=Error('Workspace is busy. Retry shortly.');e.status=409;throw e;}await new Promise(r=>setTimeout(r,100));}const timer=setInterval(()=>{try{renew(name,token);}catch{}},5000);timer.unref();try{return await context.run({name,token},fn);}finally{clearInterval(timer);release(name,token);}}
 function queue({id,owner=null,kind,payload={},due=clock(),maxAttempts=5}){db.prepare("INSERT OR IGNORE INTO durable_jobs VALUES (?,?,?,?,?,?,0,?,NULL,NULL,NULL,?)").run(id,owner,kind,JSON.stringify(payload),'queued',due,maxAttempts,clock());}
 function claimJob(ttl=120000){db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE durable_jobs SET state='failed',last_error='LEASE_RETRIES_EXHAUSTED' WHERE state='running' AND expires<=? AND attempts>=max_attempts").run(clock());const row=db.prepare("SELECT * FROM durable_jobs WHERE (state='queued' AND due<=?) OR (state='running' AND expires<=?) ORDER BY due LIMIT 1").get(clock(),clock());if(!row){db.exec('COMMIT');return null;}const token=randomUUID();db.prepare("UPDATE durable_jobs SET state='running',attempts=attempts+1,token=?,expires=?,updated=? WHERE id=?").run(token,clock()+ttl,clock(),row.id);db.exec('COMMIT');return {...row,attempts:row.attempts+1,token,payload:JSON.parse(row.payload)};}catch(e){db.exec('ROLLBACK');throw e;}}
 const heartbeat=(id,token)=>!!db.prepare("UPDATE durable_jobs SET expires=?,updated=? WHERE id=? AND token=? AND state='running' AND expires>?").run(clock()+120000,clock(),id,token,clock()).changes;
 function finish(job,{repeatMs}={}){if(!db.prepare("UPDATE durable_jobs SET state=?,due=?,attempts=0,token=NULL,expires=NULL,last_error=NULL,updated=? WHERE id=? AND token=? AND state='running' AND expires>?").run(repeatMs?'queued':'done',clock()+(repeatMs||0),clock(),job.id,job.token,clock()).changes)throw Error('Job lease was lost. Result must be reconciled.');}
 function fail(job,code='JOB_FAILED'){const n=job.attempts;db.prepare("UPDATE durable_jobs SET state=?,due=?,attempts=?,token=NULL,expires=NULL,last_error=?,updated=? WHERE id=? AND token=?").run(n>=job.max_attempts?'failed':'queued',clock()+Math.min(3600000,30000*2**Math.min(n,7)),n,code,clock(),job.id,job.token);event('job.failed','error',job.kind+' failed; inspect the authorized operations screen.');}
 function retry(id){if(!db.prepare("UPDATE durable_jobs SET state='queued',due=?,attempts=0,last_error=NULL WHERE id=? AND state='failed'").run(clock(),id).changes)throw Error('Only a failed job can be retried.');}
 const jobs=()=>db.prepare('SELECT id,owner,kind,state,due,attempts,max_attempts AS maxAttempts,last_error AS error,updated FROM durable_jobs ORDER BY updated DESC LIMIT 100').all();
 const intent=(owner,id)=>{const row=db.prepare('SELECT value FROM access_intents WHERE owner=? AND case_id=?').get(owner,id);return row?JSON.parse(row.value):null;};
 function saveIntent(owner,id,value){guard(owner);db.prepare('INSERT INTO access_intents VALUES (?,?,?) ON CONFLICT(owner,case_id) DO UPDATE SET value=excluded.value').run(owner,id,JSON.stringify(value));}
 function event(kind,level,detail){db.prepare('INSERT INTO ops_events(at,kind,level,detail) VALUES (?,?,?,?)').run(clock(),kind,level,detail);db.prepare('DELETE FROM ops_events WHERE id NOT IN (SELECT id FROM ops_events ORDER BY id DESC LIMIT 1000)').run();}
 const events=()=>db.prepare('SELECT at,kind,level,detail FROM ops_events ORDER BY id DESC LIMIT 50').all();
 const status=name=>{const r=db.prepare('SELECT value FROM ops_status WHERE name=?').get(name);return r?JSON.parse(r.value):null;};
 const setStatus=(name,value)=>db.prepare('INSERT INTO ops_status VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(name,JSON.stringify(value));
 function allow(value,limit=30,windowMs=60000){const at=Math.floor(clock()/windowMs),key=createHash('sha256').update(value).digest('hex');db.prepare('DELETE FROM request_limits WHERE bucket<?').run(at-2);const row=db.prepare('INSERT INTO request_limits VALUES (?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1 RETURNING count').get(key,at);return row.count<=limit;}
 const job=id=>db.prepare('SELECT id,owner,state FROM durable_jobs WHERE id=?').get(id);
 return {job,allow,claimLease,renew,release,guard,locked,queue,claimJob,heartbeat,finish,fail,retry,jobs,intent,saveIntent,event,events,status,setStatus};
}
