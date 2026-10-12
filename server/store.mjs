import {DatabaseSync} from 'node:sqlite';import {mkdirSync} from 'node:fs';import {dirname} from 'node:path';import {randomUUID} from 'node:crypto';
import {createCase,simulatePayment} from '../dist/core.mjs';
export function openStore(file){if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL, operator INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL)');const locks=new Map();return {
 create(){const id=randomUUID();const state=simulatePayment(createCase('match','CL-'+randomUUID().slice(0,12)));db.prepare('INSERT INTO sessions VALUES (?,?,0,?)').run(id,JSON.stringify(state),Date.now());return {id,state,operator:false}},
 get(id){const row=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);if(!row)return null;return {id,state:JSON.parse(row.value),operator:!!row.operator}},
 save(id,state){db.prepare('UPDATE sessions SET value=?,updated=? WHERE id=?').run(JSON.stringify(state),Date.now(),id)},
 authorize(id){db.prepare('UPDATE sessions SET operator=1 WHERE id=?').run(id)},
 async lock(id,fn){const before=locks.get(id)||Promise.resolve();let release;const after=new Promise(r=>release=r);locks.set(id,after);await before;try{return await fn()}finally{release();if(locks.get(id)===after)locks.delete(id)}},
 close(){db.close()}
 }}
