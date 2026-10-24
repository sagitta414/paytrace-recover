import {createCase,simulatePayment} from '../dist/core.mjs';
import {analyze} from '../server/ai.mjs';

if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)throw Error('Set a server-side AI key and model before running this check.');
const state=simulatePayment(createCase());
const progress=[];
const result=await analyze(state,process.env,fetch,step=>{progress.push(`${step.agent}:${step.step}:${step.status}`);});
if(result.mode!=='model'||result.findings.length!==4||!result.review?.snapshot)throw Error('The four-specialist review did not complete.');
console.log(JSON.stringify({provider:result.provider,model:result.model,specialists:result.findings.map(f=>f.agent),outcome:result.review.outcome,openObjections:result.review.objections.filter(o=>o.status==='open').map(o=>({category:o.category||null,question:o.question||null})),callsCompleted:progress.filter(x=>x.endsWith(':completed')).length,accessWrites:state.writes}));
