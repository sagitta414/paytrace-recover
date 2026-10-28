import {openStore} from './store.mjs';
import {createService} from './service.mjs';
import {operationsRuntime} from './operations-runtime.mjs';
const store=openStore(process.env.DATABASE_PATH||'./data/courselatch.sqlite');store.center.configure(process.env.AUDIT_HMAC_KEY);const runtime=operationsRuntime(store,createService(store,process.env),process.env);runtime.start();const keepAlive=setInterval(()=>{},60000);async function stop(){runtime.stop();clearInterval(keepAlive);setTimeout(()=>{store.close();process.exit(0);},1000).unref();}process.once('SIGINT',stop);process.once('SIGTERM',stop);
