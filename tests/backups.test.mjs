import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createBackup,restoreBackup,inspectDatabase} from '../server/backups.mjs';

test('encrypted SQLite backup restores all tables and rejects tampering or the wrong key',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'paytrace-backup-'));
  const database=join(dir,'live.sqlite'),restored=join(dir,'restored.sqlite'),bad=join(dir,'bad.sqlite');
  const env={BACKUP_DIR:dir,BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
  const store=openStore(database);
  try{
    const created=store.create();
    const result=await createBackup(store,env);
    assert.equal(result.encrypted,true);
    assert.equal(result.restoreVerified,true);
    const source=join(dir,result.file),encoded=readFileSync(source,'utf8');
    assert.ok(!encoded.includes(created.state.order.id));
    assert.equal(store.durable.status('backup').file,result.file);
    const verified=await restoreBackup(source,restored,env);
    assert.equal(verified.counts.sessions,1);
    assert.equal(inspectDatabase(restored).cases,store.listCases(created.id).length);
    await assert.rejects(restoreBackup(source,bad,{BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('base64')}));
    assert.ok(!readdirSync(dir).includes('bad.sqlite'));
    const tampered=join(dir,'tampered.pbackup'),document=JSON.parse(encoded);
    document.data=Buffer.from('tampered').toString('base64');
    writeFileSync(tampered,JSON.stringify(document));
    await assert.rejects(restoreBackup(tampered,bad,env));
  }finally{
    store.close();
    for(const name of readdirSync(dir))unlinkSync(join(dir,name));
    rmdirSync(dir);
  }
});

test('backup refuses missing encryption and a public output directory',async()=>{
  const store=openStore(':memory:');
  try{
    assert.equal(store.databaseCheck(),true);
    await assert.rejects(createBackup(store,{BACKUP_DIR:'./dist'}),/BACKUP_ENCRYPTION_KEY/);
    await assert.rejects(createBackup(store,{BACKUP_DIR:'./dist',BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('base64')}),/outside the public/);
  }finally{store.close();}
});
