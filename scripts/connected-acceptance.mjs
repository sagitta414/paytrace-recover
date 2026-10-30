import {assessAcceptance} from '../server/acceptance-check.mjs';

const {PAYTRACE_ACCEPTANCE_URL:site,PAYTRACE_ACCEPTANCE_CASE_ID:caseId,PAYTRACE_ACCEPTANCE_COOKIE:cookie,PAYTRACE_ACCEPTANCE_MODE:mode='connected'}=process.env;
if(!site||!caseId||!cookie)throw Error('Set PAYTRACE_ACCEPTANCE_URL, PAYTRACE_ACCEPTANCE_CASE_ID, and PAYTRACE_ACCEPTANCE_COOKIE in your private shell.');
const base=new URL(site);
if(base.username||base.password||base.search||base.hash||!['https:','http:'].includes(base.protocol)||base.protocol==='http:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Use HTTPS or local HTTP for the acceptance URL.');
if(!/^CL-[A-Za-z0-9-]{6,80}$/.test(caseId))throw Error('A valid PayTrace case ID is required.');
if(!/^(pt_account|cl_session)=[A-Za-z0-9_-]{16,256}$/.test(cookie))throw Error('Use one private account or demo session cookie.');
async function get(path){const url=new URL(path,base);const response=await fetch(url,{headers:{Cookie:cookie,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`${path.split('?')[0]} returned HTTP ${response.status}. Select this case in the merchant desk and check your session.`);return response.json();}
const query=encodeURIComponent(caseId);
const first=await get(`/api/case?caseId=${query}`);
const [report,receipt,latest]=await Promise.all([get(`/api/run-report?caseId=${query}`),get(`/api/verification?caseId=${query}`),get('/api/state')]);
if(first.state?.revision!==latest.state?.revision||first.state?.id!==latest.state?.id||first.state?.proof?.at!==latest.state?.proof?.at)throw Error('The case changed during acceptance. Refresh and run the check again.');
const result=assessAcceptance(first.state,report,receipt,{mode});
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
