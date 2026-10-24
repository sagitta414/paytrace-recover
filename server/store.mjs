import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createCase,simulatePayment,canOpenLesson} from '../dist/core.mjs';
import {seedPortfolio} from '../dist/operations.mjs';
import {customerSupport} from './customer-support.mjs';
export function openStore(file){
 if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});
 const db=new DatabaseSync(file),locks=new Map();
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL, operator INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS cases (owner TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(owner,id));
 CREATE TABLE IF NOT EXISTS monitor_settings (owner TEXT PRIMARY KEY, grace INTEGER NOT NULL DEFAULT 5);
 CREATE TABLE IF NOT EXISTS course_access (owner TEXT NOT NULL, case_id TEXT NOT NULL, learner TEXT NOT NULL, course TEXT NOT NULL, capture TEXT NOT NULL, PRIMARY KEY(owner,case_id));
 CREATE TABLE IF NOT EXISTS learner_tokens (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, case_id TEXT NOT NULL, learner TEXT NOT NULL, course TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS paypal_webhook_events (id TEXT PRIMARY KEY, owner TEXT NOT NULL, case_id TEXT NOT NULL, processed_at TEXT NOT NULL);`);
 const put=s=>JSON.stringify(s),hash=token=>createHash('sha256').update(token).digest('hex');
 function saveCase(owner,state){db.prepare('INSERT INTO cases VALUES (?,?,?) ON CONFLICT(owner,id) DO UPDATE SET value=excluded.value').run(owner,state.id,put(state));support.sync(owner,state);}
 function get(id){const row=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);return row?{id,state:JSON.parse(row.value),operator:!!row.operator}:null;}
 function save(owner,state){db.prepare('UPDATE sessions SET value=?,updated=? WHERE id=?').run(put(state),Date.now(),owner);saveCase(owner,state);}
 function grantRecord(owner,s){db.prepare('INSERT INTO course_access VALUES (?,?,?,?,?) ON CONFLICT(owner,case_id) DO NOTHING').run(owner,s.id,s.order.userId,s.order.courseId,s.capture.id);}
 function init(owner){const row=get(owner);if(!row)throw Error('Unknown workspace.');if(db.prepare('SELECT count(*) AS n FROM cases WHERE owner=?').get(owner).n)return;for(const s of seedPortfolio(row.state)){saveCase(owner,s);if(canOpenLesson(s))grantRecord(owner,s);}}
 function listCases(owner){init(owner);return db.prepare('SELECT value FROM cases WHERE owner=? ORDER BY id').all(owner).map(r=>JSON.parse(r.value));}
 function caseById(owner,id){init(owner);const r=db.prepare('SELECT value FROM cases WHERE owner=? AND id=?').get(owner,id);if(!r)throw Error('Case does not belong to this workspace.');return JSON.parse(r.value);}
 function savePortfolioCase(owner,s){saveCase(owner,s);if(get(owner)?.state.id===s.id)save(owner,s);}
 function content(owner,caseId,learner,course){const s=caseById(owner,caseId),a=db.prepare('SELECT * FROM course_access WHERE owner=? AND case_id=?').get(owner,caseId);
  if(!a||!canOpenLesson(s)||learner!==s.order.userId||course!==s.order.courseId||a.learner!==learner||a.course!==course||a.capture!==s.capture.id)throw Error('Course access is locked or belongs to another learner.');
  return {accessible:true,userId:learner,courseId:course,captureId:a.capture,contentId:'light-lesson-01',lesson:'See the light',title:'Find the light before the frame.',body:'Find a window with soft, indirect daylight. Place an everyday object beside it. Make three frames: facing the light, beside it, and against it.'};
 }
 const support=customerSupport(db,{caseById,content});
 return {support,
  create(){const id=randomUUID(),state=simulatePayment(createCase('match','CL-'+randomUUID().slice(0,12)));db.prepare('INSERT INTO sessions VALUES (?,?,0,?)').run(id,put(state),Date.now());init(id);return {id,state,operator:false};},get,save,saveCase:savePortfolioCase,listCases,caseById,
  readAccess(owner,s){caseById(owner,s.id);const a=db.prepare('SELECT * FROM course_access WHERE owner=? AND case_id=?').get(owner,s.id);return a?{userId:a.learner,courseId:a.course,active:true,captureId:a.capture}:{userId:s.order.userId,courseId:s.order.courseId,active:false,captureId:null};},
  findByPaypalOrder(orderId){return db.prepare("SELECT owner,id FROM cases WHERE json_extract(value,'$.paypalOrderId')=? LIMIT 2").all(orderId);},
  webhookSeen(eventId){return !!db.prepare('SELECT 1 FROM paypal_webhook_events WHERE id=?').get(eventId);},
  markWebhook(eventId,owner,caseId){db.prepare('INSERT OR IGNORE INTO paypal_webhook_events VALUES (?,?,?,?)').run(eventId,owner,caseId,new Date().toISOString());},
  owners(){return db.prepare('SELECT id FROM sessions').all().map(r=>r.id);},
  grace(owner){return db.prepare('SELECT grace FROM monitor_settings WHERE owner=?').get(owner)?.grace||5;},
  setGrace(owner,n){db.prepare('INSERT INTO monitor_settings VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET grace=excluded.grace').run(owner,n);},
  authorize(id){db.prepare('UPDATE sessions SET operator=1 WHERE id=?').run(id);},
  grant(owner,s){db.exec('BEGIN IMMEDIATE');try{grantRecord(owner,s);save(owner,s);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
  seedAccess(owner,s){if(s.capture?.source==='sample'&&canOpenLesson(s))grantRecord(owner,s);},
  lesson(owner){const s=get(owner)?.state;if(!s)throw Error('No session.');return content(owner,s.id,s.order.userId,s.order.courseId);},
  mintLearnerToken(owner,caseId,ttl=600000){const s=caseById(owner,caseId),token=randomBytes(32).toString('base64url');db.prepare('DELETE FROM learner_tokens WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO learner_tokens VALUES (?,?,?,?,?,?)').run(hash(token),owner,caseId,s.order.userId,s.order.courseId,Date.now()+ttl);return token;},
  readLearnerToken(token){const r=db.prepare('SELECT * FROM learner_tokens WHERE hash=? AND expires>?').get(hash(String(token||'')),Date.now());if(!r)throw Error('Learner session is missing or expired.');return content(r.owner,r.case_id,r.learner,r.course);},
  revokeLearnerToken(token){db.prepare('DELETE FROM learner_tokens WHERE hash=?').run(hash(token));},
  async lock(id,fn){const before=locks.get(id)||Promise.resolve();let release;const after=new Promise(r=>release=r);locks.set(id,after);await before;try{return await fn();}finally{release();if(locks.get(id)===after)locks.delete(id);}},
  close(){db.close();}
 };
}
