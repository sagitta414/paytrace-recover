import {openStore} from './store.mjs';
import {createBackup} from './backups.mjs';
import {existsSync} from 'node:fs';

const database=process.env.DATABASE_PATH||'./data/courselatch.sqlite';
if(!existsSync(database))throw Error('Database file does not exist; set DATABASE_PATH to the existing PayTrace database.');
const store=openStore(database);
try{
  const result=await createBackup(store,process.env);
  console.log(JSON.stringify({created:true,file:result.file,encrypted:result.encrypted,restoreVerified:result.restoreVerified}));
}catch(error){
  console.error(error.message);
  process.exitCode=1;
}finally{
  store.close();
}
