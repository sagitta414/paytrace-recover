import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createCase,simulatePayment,canOpenLesson} from '../dist/core.mjs';
import {seedPortfolio} from '../dist/operations.mjs';
import {customerSupport} from './customer-support.mjs';
import {durability} from './durability.mjs';
import {recoveryCenter} from './recovery-center.mjs';
import {accountStore} from './account-store.mjs';
export function openStore(file){
 if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});
 const db=new DatabaseSync(file),locks=new Map();
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL, operator INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS cases (owner TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(owner,id));
 CREATE TABLE IF NOT EXISTS monitor_settings (owner TEXT PRIMARY KEY, grace INTEGER NOT NULL DEFAULT 5);
 CREATE TABLE IF NOT EXISTS autopilot_policies (owner TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS autopilot_reservations (owner TEXT NOT NULL, case_id TEXT NOT NULL, policy_id TEXT NOT NULL, day TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY(owner,case_id));
 CREATE TABLE IF NOT EXISTS course_access (owner TEXT NOT NULL, case_id TEXT NOT NULL, learner TEXT NOT NULL, course TEXT NOT NULL, capture TEXT NOT NULL, PRIMARY KEY(owner,case_id));
 CREATE TABLE IF NOT EXISTS learner_tokens (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, case_id TEXT NOT NULL, learner TEXT NOT NULL, course TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS paypal_webhook_events (id TEXT PRIMARY KEY, owner TEXT NOT NULL, case_id TEXT NOT NULL, processed_at TEXT NOT NULL);`);
 db.exec(`CREATE TABLE IF NOT EXISTS demo_workspaces (owner TEXT PRIMARY KEY, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS demo_creation_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(key,bucket));
 CREATE TABLE IF NOT EXISTS access_intents (owner TEXT NOT NULL, case_id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(owner,case_id));`);
 db.exec('CREATE TABLE IF NOT EXISTS case_preferences (owner TEXT NOT NULL,case_id TEXT NOT NULL,priority TEXT NOT NULL,revision INTEGER NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(owner,case_id));');
 try{db.exec("ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'demo'")}catch(e){if(!/duplicate column name/.test(e.message))throw e;}
 db.exec('PRAGMA busy_timeout=5000');
 const put=s=>JSON.stringify(s),hash=token=>createHash('sha256').update(token).digest('hex');
 function saveCase(owner,state){durable.guard(owner);db.prepare('INSERT INTO cases VALUES (?,?,?) ON CONFLICT(owner,id) DO UPDATE SET value=excluded.value').run(owner,state.id,put(state));support.sync(owner,state);}
 function get(id){const row=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);return row?{id,state:JSON.parse(row.value),operator:!!row.operator,mode:row.mode}:null;}
 function save(owner,state){durable.guard(owner);db.prepare('UPDATE sessions SET value=?,updated=? WHERE id=?').run(put(state),Date.now(),owner);saveCase(owner,state);}
 function grantRecord(owner,s){db.prepare('INSERT INTO course_access VALUES (?,?,?,?,?) ON CONFLICT(owner,case_id) DO NOTHING').run(owner,s.id,s.order.userId,s.order.courseId,s.capture.id);}
 function init(owner){const row=get(owner);if(!row)throw Error('Unknown workspace.');if(row.mode==='verified'||db.prepare('SELECT count(*) AS n FROM cases WHERE owner=?').get(owner).n)return;for(const s of seedPortfolio(row.state)){saveCase(owner,s);if(canOpenLesson(s))grantRecord(owner,s);}}
 function listCases(owner){init(owner);return db.prepare('SELECT value FROM cases WHERE owner=? ORDER BY id').all(owner).map(r=>JSON.parse(r.value));}
 function caseById(owner,id){init(owner);const r=db.prepare('SELECT value FROM cases WHERE owner=? AND id=?').get(owner,id);if(!r)throw Error('Case does not belong to this workspace.');return JSON.parse(r.value);}
 function savePortfolioCase(owner,s){saveCase(owner,s);if(get(owner)?.state.id===s.id)save(owner,s);}
 function content(owner,caseId,learner,course){const s=caseById(owner,caseId),a=db.prepare('SELECT * FROM course_access WHERE owner=? AND case_id=?').get(owner,caseId);
  if(!a||s.paymentHold||!canOpenLesson(s)||learner!==s.order.userId||course!==s.order.courseId||a.learner!==learner||a.course!==course||a.capture!==s.capture.id)throw Error('Course access is locked or belongs to another learner.');
  return {accessible:true,userId:learner,courseId:course,captureId:a.capture,contentId:'light-lesson-01',lesson:'See the light',title:'Find the light before the frame.',body:'Find a window with soft, indirect daylight. Place an everyday object beside it. Make three frames: facing the light, beside it, and against it.'};
 }
 const support=customerSupport(db,{caseById,content});
 const durable=durability(db);
 const center=recoveryCenter(db,{getCase:caseById,listCases,support,grace:owner=>db.prepare('SELECT grace FROM monitor_settings WHERE owner=?').get(owner)?.grace||5});
 function create(){const id=randomUUID(),state=simulatePayment(createCase('match','CL-'+randomUUID().slice(0,12)));db.prepare("INSERT INTO sessions(id,value,operator,updated,mode) VALUES (?,?,0,?,'demo')").run(id,put(state),Date.now());init(id);return {id,state,operator:false};}
 function createWorkspace(){const id=randomUUID(),state=createCase('match','CL-'+randomUUID().slice(0,12));db.prepare("INSERT INTO sessions(id,value,operator,updated,mode) VALUES (?,?,1,?,'verified')").run(id,put(state),Date.now());return id;}
 function createPublicDemo(address){const bucket=Math.floor(Date.now()/3600000),key=hash(String(address||'unknown'));db.exec('BEGIN IMMEDIATE');try{
  db.prepare('DELETE FROM demo_creation_limits WHERE bucket<?').run(bucket-24);
  const total=db.prepare('SELECT count(*) AS n FROM demo_workspaces').get().n;
  const hourly=db.prepare('SELECT count FROM demo_creation_limits WHERE key=? AND bucket=?').get(key,bucket)?.count||0;
  if(total>=500||hourly>=20){const e=Error('Public demo capacity reached. Try again later or use an existing session.');e.status=429;throw e;}
  const session=create();db.prepare('INSERT INTO demo_workspaces VALUES (?,?)').run(session.id,Date.now());
  db.prepare('INSERT INTO demo_creation_limits VALUES (?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1').run(key,bucket);
  db.exec('COMMIT');return session;
 }catch(e){db.exec('ROLLBACK');throw e;}}
 function casePriority(owner,caseId){caseById(owner,caseId);const row=db.prepare('SELECT priority,revision,updated AS updatedAt FROM case_preferences WHERE owner=? AND case_id=?').get(owner,caseId);return {caseId,...(row||{priority:'normal',revision:0,updatedAt:null})};}
 function setCasePriority(owner,caseId,priority,expectedRevision){caseById(owner,caseId);if(!['low','normal','high'].includes(priority)||!Number.isInteger(expectedRevision)||expectedRevision<0)throw Error('Choose a valid priority and current revision.');const old=casePriority(owner,caseId);if(old.revision!==expectedRevision){const error=Error('Priority changed in another tab. Reload before saving.');error.status=409;throw error;}const updatedAt=new Date().toISOString();const write=db.prepare('INSERT INTO case_preferences VALUES (?,?,?,?,?) ON CONFLICT(owner,case_id) DO UPDATE SET priority=excluded.priority,revision=excluded.revision,updated=excluded.updated WHERE case_preferences.revision=?').run(owner,caseId,priority,expectedRevision+1,updatedAt,expectedRevision);if(!write.changes){const error=Error('Priority changed in another tab. Reload before saving.');error.status=409;throw error;}return casePriority(owner,caseId);}
 const accounts=accountStore(db,{createWorkspace});
 return {support,durable,center,accounts,createWorkspace,
  backupTo:destination=>backup(db,destination),
  databaseCheck:()=>db.prepare('PRAGMA quick_check').get().quick_check==='ok',
  create,createPublicDemo,get,save,saveCase:savePortfolioCase,listCases,caseById,
  accessIntent(owner,caseId){const row=db.prepare('SELECT value FROM access_intents WHERE owner=? AND case_id=?').get(owner,caseId);return row?JSON.parse(row.value):null;},
  saveAccessIntent(owner,caseId,value){durable.guard(owner);caseById(owner,caseId);db.prepare('INSERT INTO access_intents VALUES (?,?,?) ON CONFLICT(owner,case_id) DO UPDATE SET value=excluded.value').run(owner,caseId,put(value));},
  readAccess(owner,s){caseById(owner,s.id);const a=db.prepare('SELECT * FROM course_access WHERE owner=? AND case_id=?').get(owner,s.id);return a?{userId:a.learner,courseId:a.course,active:true,captureId:a.capture}:{userId:s.order.userId,courseId:s.order.courseId,active:false,captureId:null};},
  findByPaypalOrder(orderId){return db.prepare("SELECT owner,id FROM cases WHERE json_extract(value,'$.paypalOrderId')=? LIMIT 2").all(orderId);},
  webhookSeen(eventId){return !!db.prepare('SELECT 1 FROM paypal_webhook_events WHERE id=?').get(eventId);},
  markWebhook(eventId,owner,caseId){db.prepare('INSERT OR IGNORE INTO paypal_webhook_events VALUES (?,?,?,?)').run(eventId,owner,caseId,new Date().toISOString());},
  owners(){return db.prepare('SELECT id FROM sessions').all().map(r=>r.id);},
  preferences(owner){get(owner)||listCases(owner);return db.prepare('SELECT case_id AS caseId,priority,revision,updated AS updatedAt FROM case_preferences WHERE owner=?').all(owner);},
  casePriority,setCasePriority,
  grace(owner){return db.prepare('SELECT grace FROM monitor_settings WHERE owner=?').get(owner)?.grace||5;},
  setGrace(owner,n){db.prepare('INSERT INTO monitor_settings VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET grace=excluded.grace').run(owner,n);},
  autopilot(owner){const row=db.prepare('SELECT value FROM autopilot_policies WHERE owner=?').get(owner);return row?JSON.parse(row.value):{enabled:false,courseId:'course-light',maxAmountCents:15000,dailyLimit:2,id:null,updatedAt:null};},
  setAutopilot(owner,policy){db.prepare('INSERT INTO autopilot_policies VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value').run(owner,put(policy));return policy;},
  reserveAutopilot(owner,caseId,policy){const day=new Date().toISOString().slice(0,10);db.exec('BEGIN IMMEDIATE');try{const existing=db.prepare('SELECT 1 FROM autopilot_reservations WHERE owner=? AND case_id=?').get(owner,caseId);const count=db.prepare('SELECT count(*) AS n FROM autopilot_reservations WHERE owner=? AND day=?').get(owner,day).n;if(existing||count>=policy.dailyLimit){db.exec('COMMIT');return false;}db.prepare('INSERT INTO autopilot_reservations VALUES (?,?,?,?,?)').run(owner,caseId,policy.id,day,new Date().toISOString());db.exec('COMMIT');return true;}catch(e){db.exec('ROLLBACK');throw e;}},
  authorize(id){db.prepare('UPDATE sessions SET operator=1 WHERE id=?').run(id);},
  grant(owner,s){db.exec('BEGIN IMMEDIATE');try{grantRecord(owner,s);save(owner,s);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
  seedAccess(owner,s){if(s.capture?.source==='sample'&&canOpenLesson(s))grantRecord(owner,s);},
  lesson(owner){const s=get(owner)?.state;if(!s)throw Error('No session.');return content(owner,s.id,s.order.userId,s.order.courseId);},
  mintLearnerToken(owner,caseId,ttl=600000){const s=caseById(owner,caseId),token=randomBytes(32).toString('base64url');db.prepare('DELETE FROM learner_tokens WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO learner_tokens VALUES (?,?,?,?,?,?)').run(hash(token),owner,caseId,s.order.userId,s.order.courseId,Date.now()+ttl);return token;},
  readLearnerToken(token){const r=db.prepare('SELECT * FROM learner_tokens WHERE hash=? AND expires>?').get(hash(String(token||'')),Date.now());if(!r)throw Error('Learner session is missing or expired.');return content(r.owner,r.case_id,r.learner,r.course);},
  revokeLearnerToken(token){db.prepare('DELETE FROM learner_tokens WHERE hash=?').run(hash(token));},
  async lock(id,fn){const before=locks.get(id)||Promise.resolve();let release;const after=new Promise(r=>release=r);locks.set(id,after);await before;try{return await durable.locked(id,fn);}finally{release();if(locks.get(id)===after)locks.delete(id);}},
  close(){db.close();}
 };
}
